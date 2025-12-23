/**
 * Assets commands - manage marketplace assets
 */

import { Command } from 'commander';
import { apiGet, apiPostMultipart } from '../../api/client.js';
import { printError } from '../../util/output.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import edn from 'jsedn';

interface Asset {
  path: string;
  'data-raw': string;
  'content-hash'?: string;
}

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
 * Calculates SHA-1 hash of file content
 */
function calculateHash(data: Buffer): string {
  return createHash('sha1').update(data).digest('hex');
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
    // Validate path
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }

    const stat = statSync(path);
    if (!stat.isDirectory()) {
      throw new Error(`${path} is not a directory`);
    }

    // Build query params
    const params: Record<string, string> = { marketplace };
    if (version) {
      params.version = version;
    } else {
      params['version-alias'] = 'latest';
    }

    // Fetch assets from API
    const response = await apiGet<{
      data: Asset[];
      meta: { version?: string; 'aliased-version'?: string };
    }>('/assets/pull', params);

    const remoteVersion = response.meta.version || response.meta['aliased-version'];
    if (!remoteVersion) {
      throw new Error('No version information in response');
    }

    // Read current metadata
    const currentMeta = readAssetMetadata(path);

    // Check if up to date
    if (currentMeta && currentMeta.version === remoteVersion && response.data.length === currentMeta.assets.length) {
      console.log('Assets are up to date.');
      return;
    }

    // Write assets to disk
    const newAssets: Array<{ path: string; 'content-hash': string }> = [];
    for (const asset of response.data) {
      const assetPath = join(path, asset.path);
      const assetDir = dirname(assetPath);

      if (!existsSync(assetDir)) {
        mkdirSync(assetDir, { recursive: true });
      }

      // Decode base64 data
      const data = Buffer.from(asset['data-raw'], 'base64');
      writeFileSync(assetPath, data);

      const hash = calculateHash(data);
      newAssets.push({ path: asset.path, 'content-hash': hash });
    }

    // Prune deleted assets if requested
    if (prune && currentMeta) {
      const remotePaths = new Set(response.data.map(a => a.path));
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

    // Build operations
    const operations: Array<{
      path: string;
      op: 'upsert' | 'delete';
      data?: Buffer;
    }> = [];

    // Find assets to upsert (new or changed)
    const localAssetMap = new Map(localAssets.map(a => [a.path, a]));
    const currentAssetMap = new Map((currentMeta?.assets || []).map(a => [a.path, a['content-hash']]));

    for (const [assetPath, asset] of localAssetMap) {
      const currentHash = currentAssetMap.get(assetPath);
      if (!currentHash || currentHash !== asset.hash) {
        operations.push({
          path: assetPath,
          op: 'upsert',
          data: asset.data,
        });
      }
    }

    // Find assets to delete (if prune enabled)
    if (prune && currentMeta) {
      for (const currentAsset of currentMeta.assets) {
        if (!localAssetMap.has(currentAsset.path)) {
          operations.push({
            path: currentAsset.path,
            op: 'delete',
          });
        }
      }
    }

    // Check if there are any changes
    if (operations.length === 0) {
      console.log('Assets are up to date.');
      return;
    }

    // Build multipart form data
    const fields: Array<{ name: string; value: string | Buffer }> = [
      { name: 'current-version', value: currentVersion },
    ];

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      fields.push({ name: `path-${i}`, value: op.path });
      fields.push({ name: `op-${i}`, value: op.op });
      if (op.op === 'upsert' && op.data) {
        fields.push({ name: `data-raw-${i}`, value: op.data });
      }
    }

    // Upload to API
    const response = await apiPostMultipart<{
      data: {
        version: string;
        'asset-meta': { assets: Array<{ path: string; 'content-hash': string }> };
      };
    }>('/assets/push', { marketplace }, fields);

    // Update local metadata
    writeAssetMetadata(path, {
      version: response.data.version,
      assets: response.data['asset-meta'].assets,
    });

    console.log(`New version ${response.data.version} successfully created.`);
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
