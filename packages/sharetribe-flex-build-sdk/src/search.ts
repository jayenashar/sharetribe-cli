/**
 * Search schema management functions
 *
 * Programmatic API for managing search schemas
 */

import { apiGet, apiPostTransit } from './api/client.js';
import { keyword, keywordMap } from './api/transit.js';

export interface SearchSchema {
  schemaFor: string;
  scope: string;
  key: string;
  type: string;
  defaultValue?: string | number | boolean | string[];
  doc?: string;
}

export interface SetSearchSchemaOptions {
  key: string;
  scope: string;
  type: string;
  doc?: string;
  defaultValue?: string;
  schemaFor?: string;
}

export interface UnsetSearchSchemaOptions {
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
 * Validates search schema parameters for set operation
 */
function validateSetParams(opts: SetSearchSchemaOptions): void {
  const errors: string[] = [];
  const schemaFor = opts.schemaFor || 'listing';

  if (opts.key.includes('.')) {
    errors.push('Key cannot include dots (.) - only top-level keys are allowed');
  }

  if (!VALID_SCHEMA_FOR.includes(schemaFor)) {
    errors.push(`schema-for must be one of: ${VALID_SCHEMA_FOR.join(', ')}`);
  }

  const validScopes = VALID_SCOPES[schemaFor] || [];
  if (!validScopes.includes(opts.scope)) {
    errors.push(`scope must be one of: ${validScopes.join(', ')} for ${schemaFor}`);
  }

  if (!VALID_TYPES.includes(opts.type)) {
    errors.push(`type must be one of: ${VALID_TYPES.join(', ')}`);
  }

  if (opts.type === 'text' && schemaFor === 'userProfile') {
    errors.push('text type is not supported for userProfile schema');
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

/**
 * Validates search schema parameters for unset operation
 */
function validateUnsetParams(opts: UnsetSearchSchemaOptions): void {
  const errors: string[] = [];
  const schemaFor = opts.schemaFor || 'listing';

  if (opts.key.includes('.')) {
    errors.push('Key cannot include dots (.) - only top-level keys are allowed');
  }

  if (!VALID_SCHEMA_FOR.includes(schemaFor)) {
    errors.push(`schema-for must be one of: ${VALID_SCHEMA_FOR.join(', ')}`);
  }

  const validScopes = VALID_SCOPES[schemaFor] || [];
  if (!validScopes.includes(opts.scope)) {
    errors.push(`scope must be one of: ${validScopes.join(', ')} for ${schemaFor}`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

/**
 * Extracts the name from a namespaced key (e.g., "dataSchema.scope/public" -> "public")
 */
function extractName(key: string): string {
  return key.split('/').pop() || key;
}

/**
 * Converts type and cardinality to type label (e.g., "multi-enum" for enum with many cardinality)
 */
function getTypeLabel(valueType: string, cardinality?: string): string {
  const typeName = valueType.split('/').pop() || valueType;
  if (typeName === 'enum' && cardinality === 'dataSchema.cardinality/many') {
    return 'multi-enum';
  }
  return typeName;
}

/**
 * Converts default value to display format
 */
function formatDefaultValue(value: unknown): string | number | boolean | string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value;
  }
  return value as string | number | boolean;
}

/**
 * Lists all search schemas for a marketplace
 *
 * @param apiKey - Sharetribe API key (optional, reads from auth file if not provided)
 * @param marketplace - Marketplace ID
 * @returns Array of search schemas
 */
export async function listSearchSchemas(
  apiKey: string | undefined,
  marketplace: string
): Promise<SearchSchema[]> {
  const response = await apiGet<{
    data: Array<{
      'dataSchema/key': string;
      'dataSchema/scope': string;
      'dataSchema/valueType': string;
      'dataSchema/cardinality'?: string;
      'dataSchema/defaultValue'?: unknown;
      'dataSchema/doc'?: string;
      'dataSchema/of': string;
    }>;
  }>(
    apiKey,
    '/search-schemas/query',
    {
      marketplace,
      of: 'dataSchema.of/userProfile,dataSchema.of/listing,dataSchema.of/transaction',
    }
  );

  return response.data.map(s => ({
    schemaFor: extractName(s['dataSchema/of']),
    scope: extractName(s['dataSchema/scope']),
    key: extractName(s['dataSchema/key']),
    type: getTypeLabel(s['dataSchema/valueType'], s['dataSchema/cardinality']),
    defaultValue: formatDefaultValue(s['dataSchema/defaultValue']),
    doc: s['dataSchema/doc'],
  }));
}

/**
 * Sets a search schema field
 *
 * @param apiKey - Sharetribe API key (optional, reads from auth file if not provided)
 * @param marketplace - Marketplace ID
 * @param options - Schema configuration
 * @returns Success confirmation
 */
export async function setSearchSchema(
  apiKey: string | undefined,
  marketplace: string,
  options: SetSearchSchemaOptions
): Promise<{ success: true }> {
  validateSetParams(options);

  const schemaFor = options.schemaFor || 'listing';
  const isMultiEnum = options.type === 'multi-enum';

  const bodyObj: Record<string, unknown> = {
    key: keyword(options.key),
    scope: keyword(`dataSchema.scope/${options.scope}`),
    valueType: keyword(`dataSchema.type/${isMultiEnum ? 'enum' : options.type}`),
    cardinality: keyword(isMultiEnum ? 'dataSchema.cardinality/many' : 'dataSchema.cardinality/one'),
    of: keyword(`dataSchema.of/${schemaFor}`),
  };

  if (options.doc) {
    bodyObj.doc = options.doc;
  }

  if (options.defaultValue !== undefined) {
    bodyObj.defaultValue = coerceDefaultValue(options.defaultValue, options.type);
  }

  await apiPostTransit(apiKey, '/search-schemas/set', { marketplace }, keywordMap(bodyObj));

  return { success: true };
}

/**
 * Unsets a search schema field
 *
 * @param apiKey - Sharetribe API key (optional, reads from auth file if not provided)
 * @param marketplace - Marketplace ID
 * @param options - Schema identification
 * @returns Success confirmation
 */
export async function unsetSearchSchema(
  apiKey: string | undefined,
  marketplace: string,
  options: UnsetSearchSchemaOptions
): Promise<{ success: true }> {
  validateUnsetParams(options);

  const schemaFor = options.schemaFor || 'listing';

  const bodyObj = {
    key: keyword(options.key),
    scope: keyword(`dataSchema.scope/${options.scope}`),
    of: keyword(`dataSchema.of/${schemaFor}`),
  };

  await apiPostTransit(apiKey, '/search-schemas/unset', { marketplace }, keywordMap(bodyObj));

  return { success: true };
}
