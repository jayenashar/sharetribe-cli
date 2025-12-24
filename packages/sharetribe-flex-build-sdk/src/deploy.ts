/**
 * Process deployment functions
 *
 * High-level functions for deploying processes to aliases
 */

import { createProcess, pushProcess, createAlias, updateAlias } from './processes.js';
import { serializeProcess } from './edn-process.js';
import type { ProcessDefinition } from './types.js';

export interface DeployProcessOptions {
  /** Process name */
  process: string;
  /** Target alias to deploy to */
  alias: string;
  /** Path to process.edn file (used for display only) */
  path?: string;
  /** Process definition to deploy */
  processDefinition: ProcessDefinition;
}

export interface DeployProcessResult {
  /** Whether a new process was created */
  processCreated: boolean;
  /** Process version number */
  version: number;
  /** Whether a new alias was created */
  aliasCreated: boolean;
  /** Alias name */
  alias: string;
}

/**
 * Deploys a process to an alias
 *
 * This high-level function handles the complete deployment workflow:
 * 1. Creates the process if it doesn't exist
 * 2. Pushes the process definition to create a new version
 * 3. Creates or updates the alias to point to the new version
 *
 * @param apiKey - Sharetribe API key (optional, reads from auth file if not provided)
 * @param marketplace - Marketplace ID
 * @param options - Deployment options
 * @returns Deployment result including version and alias information
 */
export async function deployProcess(
  apiKey: string | undefined,
  marketplace: string,
  options: DeployProcessOptions
): Promise<DeployProcessResult> {
  const { process, alias, processDefinition } = options;

  // Serialize process definition to EDN format
  const processEdn = serializeProcess(processDefinition);

  // Step 1: Try to create the process (will fail if it already exists, which is fine)
  let processCreated = false;
  try {
    await createProcess(apiKey, marketplace, process, processEdn);
    processCreated = true;
  } catch (error: any) {
    // If process already exists, continue
    if (error.code !== 'already-exists') {
      throw error;
    }
  }

  // Step 2: Push the process to create a new version
  const pushResult = await pushProcess(apiKey, marketplace, process, processEdn);

  // Ensure we have a version number
  if (pushResult.version === undefined) {
    throw new Error('Failed to get version number from push result');
  }

  // Step 3: Create or update the alias
  let aliasCreated = false;
  try {
    await createAlias(apiKey, marketplace, process, pushResult.version, alias);
    aliasCreated = true;
  } catch (error: any) {
    // If alias already exists, update it
    if (error.code === 'already-exists') {
      await updateAlias(apiKey, marketplace, process, pushResult.version, alias);
    } else {
      throw error;
    }
  }

  return {
    processCreated,
    version: pushResult.version,
    aliasCreated,
    alias,
  };
}
