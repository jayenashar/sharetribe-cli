/**
 * Debug command - display config and auth info
 */

import edn from 'jsedn';
import { getConfigMap, readAuth } from 'sharetribe-flex-build-sdk';

function maskLast4(value: string): string {
  if (value.length <= 4) {
    return `...${value}`;
  }
  return `...${value.slice(-4)}`;
}

function toEdnMap(record: Record<string, string>): edn.Map {
  const entries: Array<unknown> = [];
  for (const [key, value] of Object.entries(record)) {
    entries.push(edn.kw(`:${key}`), value);
  }
  return new edn.Map(entries);
}

export function debug(): void {
  const auth = readAuth();
  const apiKey = auth?.apiKey ? maskLast4(auth.apiKey) : 'No API key set';
  const confMap = getConfigMap();

  const payload = new edn.Map([
    edn.kw(':api-key'),
    apiKey,
    edn.kw(':conf-map'),
    toEdnMap(confMap),
  ]);

  console.log(edn.encode(payload));
}
