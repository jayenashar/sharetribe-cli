/**
 * Sharetribe CLI - Unofficial 100% compatible implementation
 *
 * Main entry point for the CLI application
 */

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { version } from './commands/version.js';
import { login } from './commands/login.js';
import { logout } from './commands/logout.js';
import { registerProcessCommands } from './commands/process/index.js';
import { registerSearchCommands } from './commands/search/index.js';

// Get package.json for version info
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

const program = new Command();

// Configure the main program
program
  .name('sharetribe-cli')
  .description('Sharetribe CLI - manage transaction processes and marketplace configuration')
  .version(packageJson.version, '-V, --version', 'output the version number')
  .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier');

// Register commands

// version command
program
  .command('version')
  .description('show version')
  .action(() => {
    version();
  });

// login command
program
  .command('login')
  .description('log in with API key')
  .action(async () => {
    await login();
  });

// logout command
program
  .command('logout')
  .description('logout')
  .action(async () => {
    await logout();
  });

// Register process commands
registerProcessCommands(program);

// Register search commands
registerSearchCommands(program);

// TODO: Register additional commands as they are implemented
// - assets (with subcommands)
// - notifications (with subcommands)
// - listing-approval
// - events
// - stripe

// Parse command line arguments
program.parse(process.argv);

// If no command specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
