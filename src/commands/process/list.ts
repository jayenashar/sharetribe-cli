/**
 * Process list command - lists all transaction processes
 */

import { apiGet } from '../../api/client.js';
import { printTable, printError } from '../../util/output.js';

interface Process {
  name: string;
  version?: number;
  alias?: string;
}

interface ProcessListResponse {
  data: Array<{
    'process/name': string;
    'process/version'?: number;
  }>;
}

/**
 * Lists all processes for a marketplace
 */
export async function listProcesses(marketplace: string): Promise<void> {
  try {
    const response = await apiGet<ProcessListResponse>('/processes/query', {
      marketplace,
    });

    const processes = response.data.map((p) => ({
      name: p['process/name'],
      version: p['process/version']?.toString() || '',
    }));

    if (processes.length === 0) {
      console.log('No processes found.');
      return;
    }

    printTable(['name', 'version'], processes);
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to list processes');
    }
    process.exit(1);
  }
}
