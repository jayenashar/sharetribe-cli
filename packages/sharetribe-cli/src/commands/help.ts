/**
 * Help command - displays help information
 *
 * Note: Top-level help may differ from flex-cli due to new commands
 * Subcommand help must match flex-cli exactly
 */

import { Command } from 'commander';

/**
 * Registers help command
 *
 * Commander.js handles this automatically, but we can customize if needed
 */
export function registerHelpCommand(program: Command): void {
  // Commander.js provides built-in help functionality
  // This function exists for future customization if needed
  program.addHelpCommand('help [command]', 'display help for command');
}
