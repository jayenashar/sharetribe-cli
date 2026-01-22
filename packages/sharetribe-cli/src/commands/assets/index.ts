/**
 * Assets commands - manage marketplace assets
 */

import { Command } from 'commander';
import {
  pullAssets as sdkPullAssets,
  pushAssets as sdkPushAssets,
  stageAsset as sdkStageAsset,
} from 'sharetribe-flex-build-sdk';
import { printError } from '../../util/output.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import chalk from 'chalk';
import edn from 'jsedn';


interface AssetMetadata {
  version: string;
  assets: Array<{ path: string; 'content-hash': string }>;
}

/**
 * Reads asset metadata from .flex-cli/asset-meta.edn
 */
function readAssetMetadata(basePath: string): AssetMetadata | null {
  const metaPath = join(basePath, '.flex-cli', 'asset-meta.edn');
  if (!existsSync(metaPath)) {
    return null;
  }

  try {
    const content = readFileSync(metaPath, 'utf-8');
    const parsed = edn.parse(content);

    // Convert EDN map to JavaScript object
    const version = parsed.at(edn.kw(':version'));
    const assets = parsed.at(edn.kw(':assets'));

    const assetList: Array<{ path: string; 'content-hash': string }> = [];
    if (assets && assets.val) {
      for (const asset of assets.val) {
        assetList.push({
          path: asset.at(edn.kw(':path')),
          'content-hash': asset.at(edn.kw(':content-hash')),
        });
      }
    }

    return { version, assets: assetList };
  } catch {
    return null;
  }
}

/**
 * Writes asset metadata to .flex-cli/asset-meta.edn
 */
function writeAssetMetadata(basePath: string, metadata: AssetMetadata): void {
  const metaDir = join(basePath, '.flex-cli');
  if (!existsSync(metaDir)) {
    mkdirSync(metaDir, { recursive: true });
  }

  const assets = metadata.assets.map(a =>
    new edn.Map([
      edn.kw(':path'), a.path,
      edn.kw(':content-hash'), a['content-hash']
    ])
  );

  const ednMap = new edn.Map([
    edn.kw(':version'), metadata.version,
    edn.kw(':assets'), new edn.Vector(assets)
  ]);

  const metaPath = join(basePath, '.flex-cli', 'asset-meta.edn');
  writeFileSync(metaPath, edn.encode(ednMap), 'utf-8');
}

/**
 * Calculates SHA-1 hash of file content matching backend convention
 * Content is prefixed with `${byte-count}|` before hashing
 */
function calculateHash(data: Buffer): string {
  const prefix = Buffer.from(`${data.length}|`, 'utf-8');
  return createHash('sha1').update(prefix).update(data).digest('hex');
}

/**
 * Reads all assets from a directory
 */
function readLocalAssets(basePath: string): Array<{ path: string; data: Buffer; hash: string }> {
  const assets: Array<{ path: string; data: Buffer; hash: string }> = [];

  function scanDir(dir: string, relativePath: string = '') {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      if (entry === '.flex-cli') continue; // Skip metadata directory
      if (entry === '.DS_Store') continue; // Skip .DS_Store files

      const fullPath = join(dir, entry);
      const relPath = relativePath ? join(relativePath, entry) : entry;
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scanDir(fullPath, relPath);
      } else if (stat.isFile()) {
        const data = readFileSync(fullPath);
        const hash = calculateHash(data);
        assets.push({ path: relPath, data, hash });
      }
    }
  }

  scanDir(basePath);
  return assets;
}

/**
 * Validates JSON files
 */
function validateJsonAssets(assets: Array<{ path: string; data: Buffer }>): void {
  for (const asset of assets) {
    if (asset.path.endsWith('.json')) {
      try {
        JSON.parse(asset.data.toString('utf-8'));
      } catch (error) {
        throw new Error(`Invalid JSON in ${asset.path}: ${error}`);
      }
    }
  }
}

/**
 * Pulls assets from remote
 */
async function pullAssets(
  marketplace: string,
  path: string,
  version?: string,
  prune?: boolean
): Promise<void> {
  try {
    // Create directory if it doesn't exist
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }

    const stat = statSync(path);
    if (!stat.isDirectory()) {
      throw new Error(`${path} is not a directory`);
    }

    // Fetch assets from API
    const result = await sdkPullAssets(undefined, marketplace, version ? { version } : undefined);
    const remoteVersion = result.version;

    // Read current metadata
    const currentMeta = readAssetMetadata(path);

    // Check if up to date
    if (currentMeta && currentMeta.version === remoteVersion && result.assets.length === currentMeta.assets.length) {
      console.log('Assets are up to date.');
      return;
    }

    // Write assets to disk
    const newAssets: Array<{ path: string; 'content-hash': string }> = [];
    for (const asset of result.assets) {
      const assetPath = join(path, asset.path);
      const assetDir = dirname(assetPath);

      if (!existsSync(assetDir)) {
        mkdirSync(assetDir, { recursive: true });
      }

      // Decode base64 data
      const data = Buffer.from(asset.dataRaw, 'base64');
      writeFileSync(assetPath, data);

      const hash = calculateHash(data);
      newAssets.push({ path: asset.path, 'content-hash': asset.contentHash || hash });
    }

    // Prune deleted assets if requested
    if (prune && currentMeta) {
      const remotePaths = new Set(result.assets.map(a => a.path));
      for (const localAsset of currentMeta.assets) {
        if (!remotePaths.has(localAsset.path)) {
          const assetPath = join(path, localAsset.path);
          if (existsSync(assetPath)) {
            unlinkSync(assetPath);
          }
        }
      }
    }

    // Update metadata
    writeAssetMetadata(path, {
      version: remoteVersion,
      assets: newAssets,
    });

    console.log(`Version ${remoteVersion} successfully pulled.`);
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to pull assets');
    }
    process.exit(1);
  }
}

/**
 * Filters assets to only those that have changed
 */
function filterChangedAssets(
  existingMeta: Array<{ path: string; 'content-hash': string }>,
  localAssets: Array<{ path: string; hash: string }>
): Array<{ path: string; data: Buffer; hash: string }> {
  const hashByPath = new Map(existingMeta.map(a => [a.path, a['content-hash']]));
  
  return localAssets.filter(asset => {
    const storedHash = hashByPath.get(asset.path);
    // Assets without stored metadata are treated as changed
    return !storedHash || storedHash !== asset.hash;
  });
}

/**
 * Pushes assets to remote
 */
async function pushAssets(
  marketplace: string,
  path: string,
  prune?: boolean
): Promise<void> {
  try {
    // Validate path
    if (!existsSync(path) || !statSync(path).isDirectory()) {
      throw new Error(`${path} is not a valid directory`);
    }

    // Read current metadata
    const currentMeta = readAssetMetadata(path);
    const currentVersion = currentMeta?.version || 'nil';

    // Read local assets
    const localAssets = readLocalAssets(path);

    // Validate JSON files
    validateJsonAssets(localAssets);

    // Filter to only changed assets
    const changedAssets = filterChangedAssets(currentMeta?.assets || [], localAssets);

    // Separate JSON and non-JSON assets
    const isJsonAsset = (assetPath: string): boolean => {
      return assetPath.toLowerCase().endsWith('.json');
    };

    const stageableAssets = changedAssets.filter(a => !isJsonAsset(a.path));

    // Find assets to delete (if prune enabled)
    const localAssetMap = new Map(localAssets.map(a => [a.path, a]));
    const deleteOperations: Array<{ path: string; op: 'delete' }> = [];
    if (prune && currentMeta) {
      for (const currentAsset of currentMeta.assets) {
        if (!localAssetMap.has(currentAsset.path)) {
          deleteOperations.push({
            path: currentAsset.path,
            op: 'delete',
          });
        }
      }
    }

    // Check if there are any changes
    const noOps = changedAssets.length === 0 && deleteOperations.length === 0;
    if (noOps) {
      console.log('Assets are up to date.');
      return;
    }

    // Log changed assets
    if (changedAssets.length > 0) {
      const paths = changedAssets.map(a => a.path).join(', ');
      console.log(chalk.green(`Uploading changed assets: ${paths}`));
    }

    // Stage non-JSON assets
    const stagedByPath = new Map<string, string>();
    if (stageableAssets.length > 0) {
      const paths = stageableAssets.map(a => a.path).join(', ');
      console.log(chalk.green(`Staging assets: ${paths}`));

      for (const asset of stageableAssets) {
        try {
          const stagingResult = await sdkStageAsset(
            undefined,
            marketplace,
            asset.data,
            asset.path
          );
          stagedByPath.set(asset.path, stagingResult.stagingId);
        } catch (error) {
          if (error && typeof error === 'object' && 'code' in error && error.code === 'asset-invalid-content') {
            const detail = 'message' in error ? error.message : 'The file is missing or uses an unsupported format.';
            throw new Error(`Failed to stage image ${asset.path}: ${detail}\nFix the file and rerun assets push to retry staging.`);
          }
          throw error;
        }
      }
    }

    // Build upsert operations
    const upsertOperations = changedAssets.map(asset => {
      const stagingId = stagedByPath.get(asset.path);
      return {
        path: asset.path,
        op: 'upsert' as const,
        ...(stagingId
          ? { stagingId }
          : { data: asset.data, filename: asset.path }),
      };
    });

    // Upload to API
    const result = await sdkPushAssets(
      undefined,
      marketplace,
      currentVersion,
      [...upsertOperations, ...deleteOperations]
    );

    // Update local metadata
    writeAssetMetadata(path, {
      version: result.version,
      assets: result.assets.map(a => ({
        path: a.path,
        'content-hash': a.contentHash,
      })),
    });

    console.log(`New version ${result.version} successfully created.`);
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to push assets');
    }
    process.exit(1);
  }
}

/**
 * Registers assets commands
 */
export function registerAssetsCommands(program: Command): void {
  const assetsCmd = program.command('assets').description('manage marketplace assets');

  // assets pull
  assetsCmd
    .command('pull')
    .description('pull assets from remote')
    .requiredOption('--path <PATH>', 'path to directory where assets will be stored')
    .option('--version <VERSION>', 'version of assets to pull')
    .option('--prune', 'delete local files no longer present as remote assets')
    .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier')
    .action(async (opts) => {
      const marketplace = opts.marketplace || program.opts().marketplace;
      if (!marketplace) {
        console.error('Error: --marketplace is required');
        process.exit(1);
      }
      await pullAssets(marketplace, opts.path, opts.version, opts.prune);
    });

  // assets push
  assetsCmd
    .command('push')
    .description('push assets to remote')
    .requiredOption('--path <PATH>', 'path to directory with assets')
    .option('--prune', 'delete remote assets no longer present locally')
    .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier')
    .action(async (opts) => {
      const marketplace = opts.marketplace || program.opts().marketplace;
      if (!marketplace) {
        console.error('Error: --marketplace is required');
        process.exit(1);
      }
      await pushAssets(marketplace, opts.path, opts.prune);
    });
}
