/**
 * Output formatting utilities
 *
 * Must match flex-cli output format exactly
 */

import chalk from 'chalk';

/**
 * Prints a table with headers and rows
 *
 * Matches flex-cli table formatting
 */
export function printTable(headers: string[], rows: Array<Record<string, string>>): void {
  if (rows.length === 0) {
    return;
  }

  // Calculate column widths
  const widths: Record<string, number> = {};
  for (const header of headers) {
    widths[header] = header.length;
  }

  for (const row of rows) {
    for (const header of headers) {
      const value = row[header] || '';
      widths[header] = Math.max(widths[header] || 0, value.length);
    }
  }

  // Print header
  const headerRow = headers.map((h) => h.padEnd(widths[h] || 0)).join('  ');
  console.log(chalk.bold(headerRow));

  // Print separator
  const separator = headers.map((h) => '-'.repeat(widths[h] || 0)).join('  ');
  console.log(separator);

  // Print rows
  for (const row of rows) {
    const rowStr = headers.map((h) => (row[h] || '').padEnd(widths[h] || 0)).join('  ');
    console.log(rowStr);
  }
}

/**
 * Prints an error message
 */
export function printError(message: string): void {
  console.error(chalk.red(`Error: ${message}`));
}

/**
 * Prints a success message
 */
export function printSuccess(message: string): void {
  console.log(chalk.green(message));
}

/**
 * Prints a warning message
 */
export function printWarning(message: string): void {
  console.log(chalk.yellow(`Warning: ${message}`));
}
