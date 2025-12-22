/**
 * Process push command
 */

import { apiPost } from '../../api/client.js';
import { printError, printSuccess } from '../../util/output.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Pushes a new version of an existing process
 */
export async function pushProcess(
  marketplace: string,
  processName: string,
  path: string
): Promise<void> {
  try {
    const processFilePath = join(path, 'process.edn');
    const processContent = readFileSync(processFilePath, 'utf-8');

    const response = await apiPost<{ data: { 'process/version': number }; meta?: { result?: string } }>(
      '/processes/create-version',
      { marketplace },
      {
        name: processName,
        definition: processContent,
      }
    );

    if (response.meta?.result === 'no-changes') {
      console.log('No changes');
    } else {
      printSuccess(`Version ${response.data['process/version']} successfully saved for process ${processName}.`);
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to push process');
    }
    process.exit(1);
  }
}
