/**
 * Transit format encoding/decoding for Sharetribe API
 *
 * The Build API expects Transit format (application/transit+json) for certain endpoints.
 * Transit is a data format that extends JSON with support for additional data types.
 */

import transit from 'transit-js';

/**
 * Encodes data to Transit JSON format
 *
 * @param data - The data to encode (can include keywords, dates, etc.)
 * @returns Transit-encoded string
 */
export function encodeTransit(data: unknown): string {
  const writer = transit.writer('json', {
    handlers: transit.map([
      // Add any custom handlers here if needed
    ])
  });
  return writer.write(data);
}

/**
 * Converts Transit values (maps, keywords, etc.) to plain JavaScript objects
 *
 * @param val - Transit value
 * @returns Plain JavaScript value
 */
function transitToJS(val: any): any {
  // Handle Transit maps
  if (val && typeof val.get === 'function' && val._entries) {
    const obj: Record<string, any> = {};
    for (let i = 0; i < val._entries.length; i += 2) {
      const key = val._entries[i];
      const value = val._entries[i + 1];
      // Convert keyword keys to strings (e.g., :data -> "data")
      const keyStr = key._name || String(key);
      obj[keyStr] = transitToJS(value);
    }
    return obj;
  }

  // Handle Transit keywords
  if (val && val._name !== undefined) {
    return val._name;
  }

  // Handle arrays
  if (Array.isArray(val)) {
    return val.map(transitToJS);
  }

  // Return primitives as-is
  return val;
}

/**
 * Decodes Transit JSON format to JavaScript objects
 *
 * @param transitString - Transit-encoded string
 * @returns Decoded JavaScript object
 */
export function decodeTransit(transitString: string): unknown {
  const reader = transit.reader('json');
  const transitValue = reader.read(transitString);
  return transitToJS(transitValue);
}

/**
 * Creates a Transit keyword (used for Clojure-style keywords in the API)
 *
 * @param name - The keyword name (e.g., "default-booking")
 * @returns Transit keyword object
 */
export function keyword(name: string): unknown {
  return transit.keyword(name);
}

/**
 * Creates a Transit map with keyword keys
 *
 * This is needed because the Sharetribe API expects Transit maps with keyword keys,
 * not string keys. In Clojure/Transit: {:name :value} not {"name" :value}
 *
 * @param obj - Plain JavaScript object with string keys
 * @returns Transit map with keyword keys
 */
export function keywordMap(obj: Record<string, unknown>): unknown {
  const entries: unknown[] = [];
  for (const [key, value] of Object.entries(obj)) {
    entries.push(transit.keyword(key), value);
  }
  return transit.map(entries);
}
