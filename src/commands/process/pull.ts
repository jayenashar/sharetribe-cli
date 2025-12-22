/**
 * Process pull command
 */

import { apiGet } from '../../api/client.js';
import { printError, printSuccess } from '../../util/output.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Pulls a process from the server
 */
export async function pullProcess(
  marketplace: string,
  processName: string,
  path: string,
  version?: string,
  alias?: string
): Promise<void> {
  try {
    const queryParams: Record<string, string> = {
      marketplace,
      name: processName,
    };

    if (version) {
      queryParams.version = version;
    } else if (alias) {
      queryParams.alias = alias;
    }

    const response = await apiGet<{ data: { definition: string; version: number } }>(
      '/processes/show',
      queryParams
    );

    // Ensure directory exists
    mkdirSync(path, { recursive: true });

    // Write process.edn file
    const processFilePath = join(path, 'process.edn');
    writeFileSync(processFilePath, response.data.definition, 'utf-8');

    printSuccess(`Process ${processName} (version ${response.data.version}) successfully pulled to ${path}.`);
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to pull process');
    }
    process.exit(1);
  }
}
