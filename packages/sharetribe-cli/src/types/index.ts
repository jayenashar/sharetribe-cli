/**
 * Type definitions for sharetribe-community-cli
 */

export interface CommandContext {
  apiClient?: unknown; // Will be defined when API client is implemented
  marketplace?: string;
  apiKey?: string;
}

export interface CommandOptions {
  marketplace?: string;
  help?: boolean;
  version?: boolean;
}

export interface ProcessDefinition {
  // Will be expanded as we implement process handling
  name: string;
  version?: number;
}
