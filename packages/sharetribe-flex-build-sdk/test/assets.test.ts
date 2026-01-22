/**
 * Tests for asset management SDK functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stageAsset, pushAssets } from '../src/assets.js';
import * as client from '../src/api/client.js';

// Mock the API client
vi.mock('../src/api/client.js', () => ({
  apiPostMultipart: vi.fn(),
}));

describe('stageAsset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should stage an asset and return staging ID', async () => {
    const mockApiPostMultipart = vi.mocked(client.apiPostMultipart);
    mockApiPostMultipart.mockResolvedValue({
      data: {
        'staging-id': 'staging-12345',
      },
    });

    const result = await stageAsset(
      'test-api-key',
      'test-marketplace',
      Buffer.from('image data'),
      'test.png'
    );

    expect(mockApiPostMultipart).toHaveBeenCalledWith(
      'test-api-key',
      '/assets/stage',
      { marketplace: 'test-marketplace' },
      [
        {
          name: 'file',
          value: Buffer.from('image data'),
          filename: 'test.png',
        },
      ]
    );

    expect(result.stagingId).toBe('staging-12345');
  });

  it('should work without API key (reads from auth file)', async () => {
    const mockApiPostMultipart = vi.mocked(client.apiPostMultipart);
    mockApiPostMultipart.mockResolvedValue({
      data: {
        'staging-id': 'staging-67890',
      },
    });

    const result = await stageAsset(
      undefined,
      'test-marketplace',
      Buffer.from('file data'),
      'document.pdf'
    );

    expect(mockApiPostMultipart).toHaveBeenCalledWith(
      undefined,
      '/assets/stage',
      { marketplace: 'test-marketplace' },
      expect.arrayContaining([
        expect.objectContaining({
          name: 'file',
          filename: 'document.pdf',
        }),
      ])
    );

    expect(result.stagingId).toBe('staging-67890');
  });
});

describe('pushAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should push assets with staging-id when provided', async () => {
    const mockApiPostMultipart = vi.mocked(client.apiPostMultipart);
    mockApiPostMultipart.mockResolvedValue({
      data: {
        version: 'v2',
        'asset-meta': {
          assets: [
            { path: 'test.png', 'content-hash': 'hash123' },
          ],
        },
      },
    });

    const result = await pushAssets(
      'test-api-key',
      'test-marketplace',
      'v1',
      [
        {
          path: 'test.png',
          op: 'upsert',
          stagingId: 'staging-123',
        },
      ]
    );

    expect(mockApiPostMultipart).toHaveBeenCalledWith(
      'test-api-key',
      '/assets/push',
      { marketplace: 'test-marketplace' },
      expect.arrayContaining([
        { name: 'current-version', value: 'v1' },
        { name: 'path-0', value: 'test.png' },
        { name: 'op-0', value: 'upsert' },
        { name: 'staging-id-0', value: 'staging-123' },
      ])
    );

    expect(result.version).toBe('v2');
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].path).toBe('test.png');
    expect(result.assets[0].contentHash).toBe('hash123');
  });

  it('should push assets with data-raw when staging-id is not provided', async () => {
    const mockApiPostMultipart = vi.mocked(client.apiPostMultipart);
    mockApiPostMultipart.mockResolvedValue({
      data: {
        version: 'v2',
        'asset-meta': {
          assets: [
            { path: 'config.json', 'content-hash': 'hash456' },
          ],
        },
      },
    });

    const fileData = Buffer.from('{"test": "data"}');

    const result = await pushAssets(
      'test-api-key',
      'test-marketplace',
      'v1',
      [
        {
          path: 'config.json',
          op: 'upsert',
          data: fileData,
          filename: 'config.json',
        },
      ]
    );

    expect(mockApiPostMultipart).toHaveBeenCalledWith(
      'test-api-key',
      '/assets/push',
      { marketplace: 'test-marketplace' },
      expect.arrayContaining([
        { name: 'current-version', value: 'v1' },
        { name: 'path-0', value: 'config.json' },
        { name: 'op-0', value: 'upsert' },
        expect.objectContaining({
          name: 'data-raw-0',
          value: fileData,
          filename: 'config.json',
        }),
      ])
    );

    expect(result.version).toBe('v2');
  });

  it('should handle delete operations', async () => {
    const mockApiPostMultipart = vi.mocked(client.apiPostMultipart);
    mockApiPostMultipart.mockResolvedValue({
      data: {
        version: 'v2',
        'asset-meta': {
          assets: [],
        },
      },
    });

    const result = await pushAssets(
      'test-api-key',
      'test-marketplace',
      'v1',
      [
        {
          path: 'old-file.txt',
          op: 'delete',
        },
      ]
    );

    expect(mockApiPostMultipart).toHaveBeenCalledWith(
      'test-api-key',
      '/assets/push',
      { marketplace: 'test-marketplace' },
      expect.arrayContaining([
        { name: 'current-version', value: 'v1' },
        { name: 'path-0', value: 'old-file.txt' },
        { name: 'op-0', value: 'delete' },
      ])
    );

    // Should not include data-raw or staging-id for delete operations
    const callArgs = mockApiPostMultipart.mock.calls[0];
    const fields = callArgs[3] as Array<{ name: string }>;
    const fieldNames = fields.map(f => f.name);
    expect(fieldNames).not.toContain('data-raw-0');
    expect(fieldNames).not.toContain('staging-id-0');

    expect(result.version).toBe('v2');
  });

  it('should handle multiple operations', async () => {
    const mockApiPostMultipart = vi.mocked(client.apiPostMultipart);
    mockApiPostMultipart.mockResolvedValue({
      data: {
        version: 'v3',
        'asset-meta': {
          assets: [
            { path: 'new.png', 'content-hash': 'hash1' },
            { path: 'config.json', 'content-hash': 'hash2' },
          ],
        },
      },
    });

    const result = await pushAssets(
      'test-api-key',
      'test-marketplace',
      'v2',
      [
        {
          path: 'new.png',
          op: 'upsert',
          stagingId: 'staging-1',
        },
        {
          path: 'config.json',
          op: 'upsert',
          data: Buffer.from('{}'),
          filename: 'config.json',
        },
        {
          path: 'old.txt',
          op: 'delete',
        },
      ]
    );

    expect(mockApiPostMultipart).toHaveBeenCalledWith(
      'test-api-key',
      '/assets/push',
      { marketplace: 'test-marketplace' },
      expect.arrayContaining([
        { name: 'current-version', value: 'v2' },
        { name: 'path-0', value: 'new.png' },
        { name: 'op-0', value: 'upsert' },
        { name: 'staging-id-0', value: 'staging-1' },
        { name: 'path-1', value: 'config.json' },
        { name: 'op-1', value: 'upsert' },
        { name: 'path-2', value: 'old.txt' },
        { name: 'op-2', value: 'delete' },
      ])
    );

    expect(result.version).toBe('v3');
    expect(result.assets).toHaveLength(2);
  });

  it('should convert staging-id to string', async () => {
    const mockApiPostMultipart = vi.mocked(client.apiPostMultipart);
    mockApiPostMultipart.mockResolvedValue({
      data: {
        version: 'v2',
        'asset-meta': {
          assets: [],
        },
      },
    });

    await pushAssets(
      'test-api-key',
      'test-marketplace',
      'v1',
      [
        {
          path: 'test.png',
          op: 'upsert',
          stagingId: 12345 as any, // Test that it converts to string
        },
      ]
    );

    const callArgs = mockApiPostMultipart.mock.calls[0];
    const fields = callArgs[3] as Array<{ name: string; value: string }>;
    const stagingIdField = fields.find(f => f.name === 'staging-id-0');
    expect(stagingIdField?.value).toBe('12345');
  });
});
