/**
 * Version command - displays the CLI version
 *
 * Must match flex-cli output format exactly
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Finds package.json by traversing up from current file
 */
function findPackageJson(): string {
  const __filename = fileURLToPath(import.meta.url);
  let currentDir = dirname(__filename);

  // Traverse up to find package.json
  while (currentDir !== '/') {
    try {
      const pkgPath = join(currentDir, 'package.json');
      const content = readFileSync(pkgPath, 'utf-8');
      return content;
    } catch {
      currentDir = dirname(currentDir);
    }
  }

  throw new Error('Could not find package.json');
}

/**
 * Displays the version of the CLI
 *
 * Output must match flex-cli exactly
 */
export function version(): void {
  const packageJson = JSON.parse(findPackageJson());
  console.log(packageJson.version);
}
