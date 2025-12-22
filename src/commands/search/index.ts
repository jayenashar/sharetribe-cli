/**
 * Search command - manage search schemas
 */

import { Command } from 'commander';
import { apiGet } from '../../api/client.js';
import { printTable, printError } from '../../util/output.js';

interface SearchSchema {
  key: string;
  scope: string;
  type: string;
  'schema-for': string;
}

/**
 * Lists all search schemas
 */
async function listSearchSchemas(marketplace: string): Promise<void> {
  try {
    const response = await apiGet<{ data: SearchSchema[] }>('/search-schemas/query', {
      marketplace,
      of: 'dataSchema.of/userProfile,dataSchema.of/listing,dataSchema.of/transaction',
    });

    if (response.data.length === 0) {
      console.log('No search schemas found.');
      return;
    }

    printTable(
      ['schema-for', 'scope', 'key', 'type'],
      response.data.map((s) => ({
        'schema-for': s['schema-for'] || '',
        scope: s.scope || '',
        key: s.key || '',
        type: s.type || '',
      }))
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to list search schemas');
    }
    process.exit(1);
  }
}

/**
 * Registers search commands
 */
export function registerSearchCommands(program: Command): void {
  const searchCmd = program.command('search').description('list all search schemas');

  // Default action - list
  searchCmd.action(async () => {
    const marketplace = program.opts().marketplace;
    if (!marketplace) {
      console.error('Error: --marketplace is required');
      process.exit(1);
    }
    await listSearchSchemas(marketplace);
  });

  // search set
  searchCmd
    .command('set')
    .description('set search schema field')
    .requiredOption('--key <KEY>', 'schema key')
    .requiredOption('--scope <SCOPE>', 'schema scope')
    .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier')
    .action(async () => {
      console.log('search set - not yet implemented');
      process.exit(1);
    });

  // search unset
  searchCmd
    .command('unset')
    .description('unset search schema field')
    .requiredOption('--key <KEY>', 'schema key')
    .requiredOption('--scope <SCOPE>', 'schema scope')
    .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier')
    .action(async () => {
      console.log('search unset - not yet implemented');
      process.exit(1);
    });
}
