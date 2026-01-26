/**
 * Debug command - display config and auth info
 */

import { getConfigMap, readAuth } from 'sharetribe-flex-build-sdk';

function maskLast4(value: string): string {
  if (value.length <= 4) {
    return `...${value}`;
  }
  return `...${value.slice(-4)}`;
}

export function debug(): void {
  const auth = readAuth();
  const apiKey = auth?.apiKey ? maskLast4(auth.apiKey) : 'No API key set';
  const confMap = getConfigMap();

  const confMapEntries = Object.keys(confMap)
    .sort()
    .map((key) => `:${key} ${confMap[key]}`)
    .join(' ');
  const confMapFormatted = confMapEntries ? `{${confMapEntries}}` : '{}';

  console.log(`{:api-key ${apiKey}, :conf-map ${confMapFormatted}}`);
}
