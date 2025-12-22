/**
 * Process command - main entry point for process subcommands
 */

import { Command } from 'commander';
import { listProcesses } from './list.js';
import { createProcess } from './create.js';
import { pushProcess } from './push.js';
import { pullProcess } from './pull.js';
import { createAlias, updateAlias, deleteAlias } from './aliases.js';
import { createOrPushAndCreateOrUpdateAlias } from './combined.js';

/**
 * Registers all process subcommands
 */
export function registerProcessCommands(program: Command): void {
  const processCmd = program
    .command('process')
    .description('manage transaction processes');

  // process list
  processCmd
    .command('list')
    .description('list all processes')
    .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier')
    .action(async (options) => {
      const marketplace = options.marketplace || program.opts().marketplace;
      if (!marketplace) {
        console.error('Error: --marketplace is required');
        process.exit(1);
      }
      await listProcesses(marketplace);
    });

  // process create
  processCmd
    .command('create')
    .description('create a new transaction process')
    .requiredOption('--process <PROCESS_NAME>', 'name for the new process')
    .requiredOption('--path <LOCAL_PROCESS_DIR>', 'path to the directory where the process.edn file is')
    .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier')
    .action(async (options) => {
      const marketplace = options.marketplace || program.opts().marketplace;
      if (!marketplace) {
        console.error('Error: --marketplace is required');
        process.exit(1);
      }
      await createProcess(marketplace, options.process, options.path);
    });

  // process push
  processCmd
    .command('push')
    .description('push a process file to the remote')
    .requiredOption('--process <PROCESS_NAME>', 'name of the process')
    .requiredOption('--path <LOCAL_PROCESS_DIR>', 'path to the directory where the process.edn file is')
    .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier')
    .action(async (options) => {
      const marketplace = options.marketplace || program.opts().marketplace;
      if (!marketplace) {
        console.error('Error: --marketplace is required');
        process.exit(1);
      }
      await pushProcess(marketplace, options.process, options.path);
    });

  // process pull
  processCmd
    .command('pull')
    .description('pull a process from the remote')
    .requiredOption('--process <PROCESS_NAME>', 'name of the process')
    .requiredOption('--path <LOCAL_PROCESS_DIR>', 'path where to save the process')
    .option('--version <VERSION_NUM>', 'version number')
    .option('--alias <PROCESS_ALIAS>', 'alias name')
    .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier')
    .action(async (options) => {
      const marketplace = options.marketplace || program.opts().marketplace;
      if (!marketplace) {
        console.error('Error: --marketplace is required');
        process.exit(1);
      }
      await pullProcess(marketplace, options.process, options.path, options.version, options.alias);
    });

  // process create-alias
  processCmd
    .command('create-alias')
    .description('create a new alias')
    .requiredOption('--process <PROCESS_NAME>', 'name of the process')
    .requiredOption('--version <VERSION_NUM>', 'version number')
    .requiredOption('--alias <ALIAS>', 'alias name')
    .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier')
    .action(async (options) => {
      const marketplace = options.marketplace || program.opts().marketplace;
      if (!marketplace) {
        console.error('Error: --marketplace is required');
        process.exit(1);
      }
      await createAlias(marketplace, options.process, parseInt(options.version), options.alias);
    });

  // process update-alias
  processCmd
    .command('update-alias')
    .description('update an existing alias')
    .requiredOption('--process <PROCESS_NAME>', 'name of the process')
    .requiredOption('--version <VERSION_NUM>', 'version number')
    .requiredOption('--alias <ALIAS>', 'alias name')
    .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier')
    .action(async (options) => {
      const marketplace = options.marketplace || program.opts().marketplace;
      if (!marketplace) {
        console.error('Error: --marketplace is required');
        process.exit(1);
      }
      await updateAlias(marketplace, options.process, parseInt(options.version), options.alias);
    });

  // process delete-alias
  processCmd
    .command('delete-alias')
    .description('delete an alias')
    .requiredOption('--process <PROCESS_NAME>', 'name of the process')
    .requiredOption('--alias <ALIAS>', 'alias name')
    .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier')
    .action(async (options) => {
      const marketplace = options.marketplace || program.opts().marketplace;
      if (!marketplace) {
        console.error('Error: --marketplace is required');
        process.exit(1);
      }
      await deleteAlias(marketplace, options.process, options.alias);
    });

  // process create-or-push-and-create-or-update-alias (combined command)
  processCmd
    .command('create-or-push-and-create-or-update-alias')
    .description('create or push a process file and create or update an alias')
    .requiredOption('--process <PROCESS_NAME>', 'name of the process')
    .requiredOption('--path <LOCAL_PROCESS_DIR>', 'path to the directory with the process files')
    .requiredOption('--alias <ALIAS>', 'alias name')
    .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier')
    .action(async (options) => {
      const marketplace = options.marketplace || program.opts().marketplace;
      if (!marketplace) {
        console.error('Error: --marketplace is required');
        process.exit(1);
      }
      await createOrPushAndCreateOrUpdateAlias(
        marketplace,
        options.process,
        options.path,
        options.alias
      );
    });
}
