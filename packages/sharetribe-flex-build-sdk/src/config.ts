/**
 * Configuration helpers matching flex-cli behavior.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import edn from 'jsedn';

const ENV_FILE = '.env.edn';
const DEFAULT_API_BASE_URL = 'https://flex-build-api.sharetribe.com/v1/build-api';

let envFileContent: any | null | undefined;

function readEnvFile(): any | null {
  const envPath = join(process.cwd(), ENV_FILE);
  if (!existsSync(envPath)) {
    return null;
  }

  try {
    const content = readFileSync(envPath, 'utf-8');
    return edn.parse(content);
  } catch {
    return null;
  }
}

function getEnvValue(name: string): string | undefined {
  const envValue = process.env[name];
  if (envValue) {
    return envValue;
  }

  if (envFileContent === undefined) {
    envFileContent = readEnvFile();
  }

  if (envFileContent && typeof envFileContent.at === 'function') {
    const value = envFileContent.at(name);
    if (typeof value === 'string') {
      return value;
    }
  }

  return undefined;
}

export function getApiBaseUrl(): string {
  return getEnvValue('FLEX_API_BASE_URL') || DEFAULT_API_BASE_URL;
}

export function getConfigMap(): Record<string, string> {
  return {
    'api-base-url': getApiBaseUrl(),
  };
}

export { DEFAULT_API_BASE_URL };
