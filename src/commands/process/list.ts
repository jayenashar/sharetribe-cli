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

interface ProcessVersion {
  'process/createdAt': string;
  'process/version': number;
  'process/aliases'?: string[];
  'process/transactionCount'?: number;
}

interface ProcessVersionsResponse {
  data: ProcessVersion[];
}

/**
 * Formats timestamp to match flex-cli format for process list
 */
function formatProcessTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const timeString = date.toLocaleTimeString('en-US');

    return `${year}-${month}-${day} ${timeString}`;
  } catch {
    return timestamp;
  }
}

/**
 * Lists all processes for a marketplace
 */
export async function listProcesses(marketplace: string, processName?: string): Promise<void> {
  try {
    // If processName is specified, show version history for that process
    if (processName) {
      const response = await apiGet<ProcessVersionsResponse>('/processes/query-versions', {
        marketplace,
        name: processName,
      });

      if (response.data.length === 0) {
        console.log(`No versions found for process: ${processName}`);
        return;
      }

      const versions = response.data.map((v) => ({
        'Created': formatProcessTimestamp(v['process/createdAt']),
        'Version': v['process/version'].toString(),
        'Aliases': v['process/aliases']?.join(', ') || '',
        'Transactions': v['process/transactionCount']?.toString() || '0',
      }));

      printTable(['Created', 'Version', 'Aliases', 'Transactions'], versions);
    } else {
      // List all processes
      const response = await apiGet<ProcessListResponse>('/processes/query', {
        marketplace,
      });

      const processes = response.data.map((p) => ({
        'Name': p['process/name'],
        'Latest version': p['process/version']?.toString() || '',
      }));

      if (processes.length === 0) {
        console.log('No processes found.');
        return;
      }

      printTable(['Name', 'Latest version'], processes);
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to list processes');
    }
    process.exit(1);
  }
}
