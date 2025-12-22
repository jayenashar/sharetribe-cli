/**
 * Process alias commands
 */

import { apiPost, apiDelete } from '../../api/client.js';
import { printError, printSuccess } from '../../util/output.js';

/**
 * Creates a process alias
 */
export async function createAlias(
  marketplace: string,
  processName: string,
  version: number,
  alias: string
): Promise<void> {
  try {
    const response = await apiPost<{ data: { 'processAlias/alias': string; 'processAlias/version': number } }>(
      '/aliases/create-alias',
      { marketplace },
      {
        name: processName,
        version,
        alias,
      }
    );

    printSuccess(
      `Alias ${response.data['processAlias/alias']} successfully created to point to version ${response.data['processAlias/version']}.`
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to create alias');
    }
    process.exit(1);
  }
}

/**
 * Updates a process alias
 */
export async function updateAlias(
  marketplace: string,
  processName: string,
  version: number,
  alias: string
): Promise<void> {
  try {
    const response = await apiPost<{ data: { 'processAlias/alias': string; 'processAlias/version': number } }>(
      '/aliases/update-alias',
      { marketplace },
      {
        name: processName,
        version,
        alias,
      }
    );

    printSuccess(
      `Alias ${response.data['processAlias/alias']} successfully updated to point to version ${response.data['processAlias/version']}.`
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to update alias');
    }
    process.exit(1);
  }
}

/**
 * Deletes a process alias
 */
export async function deleteAlias(
  marketplace: string,
  processName: string,
  alias: string
): Promise<void> {
  try {
    await apiDelete('/aliases/delete', {
      marketplace,
      name: processName,
      alias,
    });

    printSuccess(`Alias ${alias} successfully deleted.`);
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to delete alias');
    }
    process.exit(1);
  }
}
