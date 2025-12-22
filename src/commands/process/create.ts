/**
 * Process create command
 */

import { apiPost } from '../../api/client.js';
import { printError, printSuccess } from '../../util/output.js';
import { parseProcessFile } from '../../util/edn-process.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Creates a new transaction process
 */
export async function createProcess(
  marketplace: string,
  processName: string,
  path: string
): Promise<void> {
  try {
    const processFilePath = join(path, 'process.edn');
    const processContent = readFileSync(processFilePath, 'utf-8');

    const response = await apiPost<{ data: { 'process/name': string; 'process/version': number } }>(
      '/processes/create',
      { marketplace },
      {
        name: processName,
        definition: processContent,
      }
    );

    printSuccess(
      `Process ${response.data['process/name']} successfully created with version ${response.data['process/version']}.`
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to create process');
    }
    process.exit(1);
  }
}
