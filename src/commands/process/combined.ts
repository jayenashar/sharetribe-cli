/**
 * Combined process command - create-or-push-and-create-or-update-alias
 *
 * This is the enhanced "superset" feature that combines multiple operations
 * into one atomic command
 */

import { apiPost } from '../../api/client.js';
import { printError, printSuccess } from '../../util/output.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ApiError } from '../../api/client.js';

/**
 * Creates or updates alias
 */
async function createOrUpdateAlias(
  marketplace: string,
  processName: string,
  version: number,
  alias: string
): Promise<void> {
  try {
    // Try to update first
    const response = await apiPost<{ data: { 'processAlias/alias': string; 'processAlias/version': number } }>(
      '/aliases/update-alias',
      { marketplace },
      { name: processName, version, alias }
    );

    printSuccess(
      `Alias ${response.data['processAlias/alias']} successfully updated to point to version ${response.data['processAlias/version']}.`
    );
  } catch (error) {
    // If alias not found, create it
    if (error && typeof error === 'object' && 'code' in error && error.code === 'alias-not-found') {
      const response = await apiPost<{ data: { 'processAlias/alias': string; 'processAlias/version': number } }>(
        '/aliases/create-alias',
        { marketplace },
        { name: processName, version, alias }
      );

      printSuccess(
        `Alias ${response.data['processAlias/alias']} successfully created to point to version ${response.data['processAlias/version']}.`
      );
    } else {
      throw error;
    }
  }
}

/**
 * Creates or pushes a process and creates or updates an alias
 *
 * This is an atomic operation that:
 * 1. Tries to push a new version (create-version)
 * 2. If process doesn't exist, creates it
 * 3. Then creates or updates the alias
 */
export async function createOrPushAndCreateOrUpdateAlias(
  marketplace: string,
  processName: string,
  path: string,
  alias: string
): Promise<void> {
  try {
    const processFilePath = join(path, 'process.edn');
    const processContent = readFileSync(processFilePath, 'utf-8');

    let version: number;

    try {
      // Try to push a new version first
      const pushResponse = await apiPost<{ data: { 'process/version': number }; meta?: { result?: string } }>(
        '/processes/create-version',
        { marketplace },
        { name: processName, definition: processContent }
      );

      if (pushResponse.meta?.result === 'no-changes') {
        console.log('No changes');
      } else {
        printSuccess(`Version ${pushResponse.data['process/version']} successfully saved for process ${processName}.`);
      }

      version = pushResponse.data['process/version'];
    } catch (pushError) {
      // If process not found, create it
      if (
        pushError &&
        typeof pushError === 'object' &&
        'code' in pushError &&
        pushError.code === 'tx-process-not-found'
      ) {
        const createResponse = await apiPost<{ data: { 'process/name': string; 'process/version': number } }>(
          '/processes/create',
          { marketplace },
          { name: processName, definition: processContent }
        );

        printSuccess(`Process ${createResponse.data['process/name']} successfully created.`);
        version = createResponse.data['process/version'];
      } else {
        throw pushError;
      }
    }

    // Now create or update the alias
    await createOrUpdateAlias(marketplace, processName, version, alias);
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to create/push process and alias');
    }
    process.exit(1);
  }
}
