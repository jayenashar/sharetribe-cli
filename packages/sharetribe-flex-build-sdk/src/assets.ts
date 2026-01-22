/**
 * Asset management functions
 *
 * Programmatic API for managing marketplace assets
 */

import { apiGet, apiPostMultipart, type MultipartField } from './api/client.js';

export interface Asset {
  path: string;
  dataRaw: string; // base64 encoded
  contentHash?: string;
}

export interface PullAssetsResult {
  version: string;
  assets: Asset[];
}

export interface PushAssetsResult {
  version: string;
  assets: Array<{ path: string; contentHash: string }>;
}

export interface StageAssetResult {
  stagingId: string;
}

/**
 * Pulls assets from remote
 *
 * @param apiKey - Sharetribe API key (optional, reads from auth file if not provided)
 * @param marketplace - Marketplace ID
 * @param options - Pull options
 * @returns Assets and version information
 */
export async function pullAssets(
  apiKey: string | undefined,
  marketplace: string,
  options?: { version?: string }
): Promise<PullAssetsResult> {
  const params: Record<string, string> = { marketplace };

  if (options?.version) {
    params.version = options.version;
  } else {
    params['version-alias'] = 'latest';
  }

  const response = await apiGet<{
    data: Array<{
      path: string;
      'data-raw': string;
      'content-hash'?: string;
    }>;
    meta: { version?: string; 'aliased-version'?: string };
  }>(apiKey, '/assets/pull', params);

  const version = response.meta.version || response.meta['aliased-version'];
  if (!version) {
    throw new Error('No version information in response');
  }

  return {
    version,
    assets: response.data.map(a => ({
      path: a.path,
      dataRaw: a['data-raw'],
      contentHash: a['content-hash'],
    })),
  };
}

/**
 * Stages an asset for upload
 *
 * @param apiKey - Sharetribe API key (optional, reads from auth file if not provided)
 * @param marketplace - Marketplace ID
 * @param fileData - File data as Buffer
 * @param filename - Filename
 * @returns Staging ID
 */
export async function stageAsset(
  apiKey: string | undefined,
  marketplace: string,
  fileData: Buffer,
  filename: string
): Promise<StageAssetResult> {
  const fields: MultipartField[] = [
    { name: 'file', value: fileData, filename },
  ];

  const response = await apiPostMultipart<{
    data: { 'staging-id': string };
  }>(apiKey, '/assets/stage', { marketplace }, fields);

  return {
    stagingId: response.data['staging-id'],
  };
}

/**
 * Pushes assets to remote
 *
 * @param apiKey - Sharetribe API key (optional, reads from auth file if not provided)
 * @param marketplace - Marketplace ID
 * @param currentVersion - Current version (use 'nil' if first push)
 * @param operations - Array of operations to perform
 * @returns New version and asset metadata
 */
export async function pushAssets(
  apiKey: string | undefined,
  marketplace: string,
  currentVersion: string,
  operations: Array<{
    path: string;
    op: 'upsert' | 'delete';
    data?: Buffer;
    stagingId?: string;
    filename?: string;
  }>
): Promise<PushAssetsResult> {
  const fields: MultipartField[] = [
    { name: 'current-version', value: currentVersion },
  ];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    fields.push({ name: `path-${i}`, value: op.path });
    fields.push({ name: `op-${i}`, value: op.op });
    if (op.op === 'upsert') {
      if (op.stagingId) {
        fields.push({ name: `staging-id-${i}`, value: String(op.stagingId) });
      } else if (op.data) {
        const fname = op.filename || op.path;
        fields.push({ name: `data-raw-${i}`, value: op.data, filename: fname });
      }
    }
  }

  const response = await apiPostMultipart<{
    data: {
      version: string;
      'asset-meta': { assets: Array<{ path: string; 'content-hash': string }> };
    };
  }>(apiKey, '/assets/push', { marketplace }, fields);

  return {
    version: response.data.version,
    assets: response.data['asset-meta'].assets.map(a => ({
      path: a.path,
      contentHash: a['content-hash'],
    })),
  };
}
