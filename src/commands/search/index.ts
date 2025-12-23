/**
 * Search command - manage search schemas
 */

import { Command } from 'commander';
import { apiGet, apiPostTransit } from '../../api/client.js';
import { keyword, keywordMap } from '../../api/transit.js';
import { printTable, printError } from '../../util/output.js';

interface SearchSchema {
  'dataSchema/key': string;
  'dataSchema/scope': string;
  'dataSchema/valueType': string;
  'dataSchema/cardinality'?: string;
  'dataSchema/defaultValue'?: unknown;
  'dataSchema/doc'?: string;
  'dataSchema/of': string;
}

interface SetSchemaOptions {
  key: string;
  scope: string;
  type: string;
  doc?: string;
  default?: string;
  schemaFor?: string;
}

interface UnsetSchemaOptions {
  key: string;
  scope: string;
  schemaFor?: string;
}

/**
 * Valid values for schema-for parameter
 */
const VALID_SCHEMA_FOR = ['listing', 'userProfile', 'transaction'];

/**
 * Valid scopes by schema type
 */
const VALID_SCOPES: Record<string, string[]> = {
  listing: ['metadata', 'public'],
  userProfile: ['metadata', 'private', 'protected', 'public'],
  transaction: ['metadata', 'protected'],
};

/**
 * Valid types
 */
const VALID_TYPES = ['enum', 'multi-enum', 'boolean', 'long', 'text'];

/**
 * Scope label mapping
 */
const SCOPE_LABELS: Record<string, string> = {
  metadata: 'Metadata',
  private: 'Private data',
  protected: 'Protected data',
  public: 'Public data',
};

/**
 * Validates and coerces a default value based on type
 */
function coerceDefaultValue(value: string, type: string): string | number | boolean | string[] {
  if (type === 'boolean') {
    if (value !== 'true' && value !== 'false') {
      throw new Error(`Default value must be "true" or "false" for boolean type`);
    }
    return value === 'true';
  }

  if (type === 'long') {
    const num = parseFloat(value);
    if (isNaN(num) || !Number.isInteger(num)) {
      throw new Error(`Default value must be an integer for long type`);
    }
    return num;
  }

  if (type === 'multi-enum') {
    return value.split(',').map(v => v.trim());
  }

  return value;
}

/**
 * Validates search schema parameters
 */
function validateSetParams(opts: SetSchemaOptions): void {
  const errors: string[] = [];
  const schemaFor = opts.schemaFor || 'listing';

  // Key validation
  if (opts.key.includes('.')) {
    errors.push('Key cannot include dots (.) - only top-level keys are allowed');
  }

  // Schema-for validation
  if (!VALID_SCHEMA_FOR.includes(schemaFor)) {
    errors.push(`schema-for must be one of: ${VALID_SCHEMA_FOR.join(', ')}`);
  }

  // Scope validation
  const validScopes = VALID_SCOPES[schemaFor] || [];
  if (!validScopes.includes(opts.scope)) {
    errors.push(`scope must be one of: ${validScopes.join(', ')} for ${schemaFor}`);
  }

  // Type validation
  if (!VALID_TYPES.includes(opts.type)) {
    errors.push(`type must be one of: ${VALID_TYPES.join(', ')}`);
  }

  // Type/schema compatibility
  if (opts.type === 'text' && schemaFor === 'userProfile') {
    errors.push('text type is not supported for userProfile schema');
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

/**
 * Validates unset schema parameters
 */
function validateUnsetParams(opts: UnsetSchemaOptions): void {
  const errors: string[] = [];
  const schemaFor = opts.schemaFor || 'listing';

  // Key validation
  if (opts.key.includes('.')) {
    errors.push('Key cannot include dots (.) - only top-level keys are allowed');
  }

  // Schema-for validation
  if (!VALID_SCHEMA_FOR.includes(schemaFor)) {
    errors.push(`schema-for must be one of: ${VALID_SCHEMA_FOR.join(', ')}`);
  }

  // Scope validation
  const validScopes = VALID_SCOPES[schemaFor] || [];
  if (!validScopes.includes(opts.scope)) {
    errors.push(`scope must be one of: ${validScopes.join(', ')} for ${schemaFor}`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

/**
 * Sets a search schema field
 */
async function setSearchSchema(marketplace: string, opts: SetSchemaOptions): Promise<void> {
  try {
    validateSetParams(opts);

    const schemaFor = opts.schemaFor || 'listing';
    const isMultiEnum = opts.type === 'multi-enum';

    // Build request body
    const bodyObj: Record<string, unknown> = {
      key: keyword(opts.key),
      scope: keyword(`dataSchema.scope/${opts.scope}`),
      valueType: keyword(`dataSchema.type/${isMultiEnum ? 'enum' : opts.type}`),
      cardinality: keyword(isMultiEnum ? 'dataSchema.cardinality/many' : 'dataSchema.cardinality/one'),
      of: keyword(`dataSchema.of/${schemaFor}`),
    };

    if (opts.doc) {
      bodyObj.doc = opts.doc;
    }

    if (opts.default !== undefined) {
      bodyObj.defaultValue = coerceDefaultValue(opts.default, opts.type);
    }

    await apiPostTransit('/search-schemas/set', { marketplace }, keywordMap(bodyObj));

    const scopeLabel = SCOPE_LABELS[opts.scope] || opts.scope;
    console.log(`${scopeLabel} schema, ${opts.key} is successfully set for ${schemaFor}.`);
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to set search schema');
    }
    process.exit(1);
  }
}

/**
 * Unsets a search schema field
 */
async function unsetSearchSchema(marketplace: string, opts: UnsetSchemaOptions): Promise<void> {
  try {
    validateUnsetParams(opts);

    const schemaFor = opts.schemaFor || 'listing';

    const bodyObj = {
      key: keyword(opts.key),
      scope: keyword(`dataSchema.scope/${opts.scope}`),
      of: keyword(`dataSchema.of/${schemaFor}`),
    };

    await apiPostTransit('/search-schemas/unset', { marketplace }, keywordMap(bodyObj));

    const scopeLabel = SCOPE_LABELS[opts.scope] || opts.scope;
    console.log(`${scopeLabel} schema, ${opts.key} is successfully unset for ${schemaFor}.`);
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to unset search schema');
    }
    process.exit(1);
  }
}

/**
 * Converts type and cardinality to type label (e.g., "multi-enum" for enum with many cardinality)
 */
function getTypeLabel(valueType: string, cardinality?: string): string {
  // Extract the type name after the last slash (e.g., "dataSchema.type/enum" -> "enum")
  const typeName = valueType.split('/').pop() || valueType;

  // If it's an enum with many cardinality, it's a multi-enum
  if (typeName === 'enum' && cardinality === 'dataSchema.cardinality/many') {
    return 'multi-enum';
  }

  return typeName;
}

/**
 * Converts default value to display string
 */
function getDefaultValueLabel(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  return String(value);
}

/**
 * Extracts the name from a namespaced key (e.g., "dataSchema.scope/public" -> "public")
 */
function extractName(key: string): string {
  return key.split('/').pop() || key;
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

    // Map and sort the data (by schema-for, scope, key)
    const rows = response.data
      .map((s) => ({
        'Schema for': extractName(s['dataSchema/of']),
        'Scope': extractName(s['dataSchema/scope']),
        'Key': extractName(s['dataSchema/key']),
        'Type': getTypeLabel(s['dataSchema/valueType'], s['dataSchema/cardinality']),
        'Default value': getDefaultValueLabel(s['dataSchema/defaultValue']),
        'Doc': s['dataSchema/doc'] || '',
      }))
      .sort((a, b) => {
        // Sort by schema-for, then scope, then key
        if (a['Schema for'] !== b['Schema for']) {
          return a['Schema for'].localeCompare(b['Schema for']);
        }
        if (a['Scope'] !== b['Scope']) {
          return a['Scope'].localeCompare(b['Scope']);
        }
        return a['Key'].localeCompare(b['Key']);
      });

    // Print table using flex-cli compatible formatting
    const headers = ['Schema for', 'Scope', 'Key', 'Type', 'Default value', 'Doc'];

    // Calculate column widths
    // flex-cli uses keywords (e.g., :version) which when stringified include the ':' prefix
    // To match flex-cli widths, we add 1 to header length to simulate the ':' prefix
    const widths: Record<string, number> = {};
    for (const h of headers) {
      widths[h] = h.length + 1;
    }
    for (const row of rows) {
      for (const h of headers) {
        const value = row[h] || '';
        widths[h] = Math.max(widths[h], value.length);
      }
    }

    // Print empty line before table
    console.log('');

    // Print header
    // flex-cli search format: each column padded to max_width, with 2 space separator between columns
    // Last column: padding with trailing space
    const headerParts = headers.map((h, i) => {
      const width = widths[h] || 0;
      const padded = h.padEnd(width);
      return i === headers.length - 1 ? padded + ' ' : padded + '  ';
    });
    console.log(headerParts.join(''));

    // Print rows
    for (const row of rows) {
      const rowParts = headers.map((h, i) => {
        const value = row[h] || '';
        const width = widths[h] || 0;
        const padded = value.padEnd(width);
        return i === headers.length - 1 ? padded + ' ' : padded + '  ';
      });
      console.log(rowParts.join(''));
    }

    // Print empty line after table
    console.log('');
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
  const searchCmd = program
    .command('search')
    .description('list all search schemas')
    .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier')
    .action(async (options) => {
      const marketplace = options.marketplace || program.opts().marketplace;
      if (!marketplace) {
        console.error('Error: --marketplace is required');
        process.exit(1);
      }
      await listSearchSchemas(marketplace);
    });

  // search set
  searchCmd
    .command('set')
    .description('set search schema')
    .requiredOption('--key <KEY>', 'schema key')
    .requiredOption('--scope <SCOPE>', 'schema scope')
    .requiredOption('--type <TYPE>', 'value type (enum, multi-enum, boolean, long, or text)')
    .option('--doc <DOC>', 'description of the schema')
    .option('--default <DEFAULT>', 'default value for search if value is not set')
    .option('--schema-for <SCHEMA_FOR>', 'subject of the schema (listing, userProfile, or transaction)')
    .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier')
    .action(async (opts) => {
      const marketplace = opts.marketplace || program.opts().marketplace;
      if (!marketplace) {
        console.error('Error: --marketplace is required');
        process.exit(1);
      }
      await setSearchSchema(marketplace, {
        key: opts.key,
        scope: opts.scope,
        type: opts.type,
        doc: opts.doc,
        default: opts.default,
        schemaFor: opts.schemaFor,
      });
    });

  // search unset
  searchCmd
    .command('unset')
    .description('unset search schema')
    .requiredOption('--key <KEY>', 'schema key')
    .requiredOption('--scope <SCOPE>', 'schema scope')
    .option('--schema-for <SCHEMA_FOR>', 'subject of the schema (listing, userProfile, or transaction)')
    .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier')
    .action(async (opts) => {
      const marketplace = opts.marketplace || program.opts().marketplace;
      if (!marketplace) {
        console.error('Error: --marketplace is required');
        process.exit(1);
      }
      await unsetSearchSchema(marketplace, {
        key: opts.key,
        scope: opts.scope,
        schemaFor: opts.schemaFor,
      });
    });
}
