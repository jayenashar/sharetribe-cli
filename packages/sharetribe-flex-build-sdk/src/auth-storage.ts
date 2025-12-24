/**
 * Authentication storage - manages ~/.config/flex-cli/auth.edn
 *
 * Must maintain 100% compatibility with flex-cli's auth.edn format
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import edn from 'jsedn';

const CONFIG_DIR = join(homedir(), '.config', 'flex-cli');
const AUTH_FILE = join(CONFIG_DIR, 'auth.edn');

export interface AuthData {
  apiKey: string;
}

/**
 * Reads authentication data from ~/.config/flex-cli/auth.edn
 *
 * Returns null if file doesn't exist or is invalid
 */
export function readAuth(): AuthData | null {
  try {
    if (!existsSync(AUTH_FILE)) {
      return null;
    }

    const content = readFileSync(AUTH_FILE, 'utf-8');
    const parsed = edn.parse(content);

    // EDN keys are symbols, get :api-key
    const apiKeySymbol = edn.kw(':api-key');
    const apiKey = parsed.at(apiKeySymbol);

    if (typeof apiKey !== 'string') {
      return null;
    }

    return { apiKey };
  } catch (error) {
    return null;
  }
}

/**
 * Writes authentication data to ~/.config/flex-cli/auth.edn
 *
 * Format must match flex-cli exactly: {:api-key "..."}
 */
export function writeAuth(data: AuthData): void {
  // Ensure config directory exists
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Create EDN map with :api-key
  const authMap = new (edn as any).Map([edn.kw(':api-key'), data.apiKey]);
  const ednString = edn.encode(authMap);

  writeFileSync(AUTH_FILE, ednString, 'utf-8');
}

/**
 * Clears authentication data (deletes auth.edn file)
 */
export async function clearAuth(): Promise<void> {
  try {
    if (existsSync(AUTH_FILE)) {
      const fs = await import('node:fs/promises');
      await fs.unlink(AUTH_FILE);
    }
  } catch (error) {
    // Ignore errors if file doesn't exist
  }
}
