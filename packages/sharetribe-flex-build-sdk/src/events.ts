/**
 * Events query functions
 *
 * Programmatic API for querying marketplace events
 */

import { apiGet } from './api/client.js';

export interface EventData {
  sequenceId: number;
  resourceId: string;
  eventType: string;
  createdAt: string;
  resourceType?: string;
  source?: string;
  id?: string;
  resource?: unknown;
  auditData?: {
    userId?: string | null;
    adminId?: string | null;
    clientId?: string | null;
    requestId?: string | null;
  };
  auditEmails?: {
    userEmail?: string | null;
    adminEmail?: string | null;
  };
  previousValues?: unknown;
  marketplaceId?: string;
}

export interface QueryEventsOptions {
  resourceId?: string;
  relatedResourceId?: string;
  eventTypes?: string;
  sequenceId?: number;
  afterSeqId?: number;
  beforeSeqId?: number;
  afterTs?: string;
  beforeTs?: string;
  limit?: number;
}

/**
 * Validates query parameters
 */
function validateParams(opts: QueryEventsOptions): void {
  const exclusiveParams = [
    opts.sequenceId !== undefined,
    opts.afterSeqId !== undefined,
    opts.beforeSeqId !== undefined,
    opts.afterTs !== undefined,
    opts.beforeTs !== undefined,
  ];

  if (exclusiveParams.filter(Boolean).length > 1) {
    throw new Error(
      'Only one of sequenceId, afterSeqId, beforeSeqId, afterTs, or beforeTs can be specified'
    );
  }

  if (opts.resourceId && opts.relatedResourceId) {
    throw new Error('Only one of resourceId or relatedResourceId can be specified');
  }
}

/**
 * Builds query parameters for API
 */
function buildQueryParams(
  marketplace: string,
  opts: QueryEventsOptions
): Record<string, string> {
  const params: Record<string, string> = {
    marketplace,
    latest: 'true'
  };

  if (opts.resourceId) params['resource-id'] = opts.resourceId;
  if (opts.relatedResourceId) params['related-resource-id'] = opts.relatedResourceId;
  if (opts.eventTypes) params['event-types'] = opts.eventTypes;
  if (opts.sequenceId !== undefined) params['sequence-id'] = opts.sequenceId.toString();
  if (opts.afterSeqId !== undefined) {
    params['start-after-sequence-id'] = opts.afterSeqId.toString();
    params.latest = 'false';
  }
  if (opts.beforeSeqId !== undefined) params['sequence-id-end'] = opts.beforeSeqId.toString();
  if (opts.afterTs) {
    params['start-after-created-at'] = opts.afterTs;
    params.latest = 'false';
  }
  if (opts.beforeTs) params['created-at-end'] = opts.beforeTs;
  if (opts.limit !== undefined) params.perPage = opts.limit.toString();

  return params;
}

/**
 * Transforms event from API format to standard format
 */
function transformEvent(event: any): EventData {
  const eventData = event['event/data'];
  const eventAudit = event['event/audit'];

  return {
    eventType: eventData.eventType,
    createdAt: eventData.createdAt,
    resourceType: eventData.resourceType,
    source: eventData.source,
    resourceId: eventData.resourceId,
    id: eventData.id,
    resource: eventData.resource || null,
    auditData: eventData.auditData || {
      userId: null,
      adminId: null,
      clientId: null,
      requestId: null,
    },
    auditEmails: eventAudit ? {
      userEmail: eventAudit['user/email'] || null,
      adminEmail: eventAudit['admin/email'] || null,
    } : undefined,
    sequenceId: eventData.sequenceId,
    previousValues: eventData.previousValues || null,
    marketplaceId: eventData.marketplaceId,
  };
}

/**
 * Queries marketplace events
 *
 * @param apiKey - Sharetribe API key (optional, reads from auth file if not provided)
 * @param marketplace - Marketplace ID
 * @param options - Query options
 * @returns Array of events
 */
export async function queryEvents(
  apiKey: string | undefined,
  marketplace: string,
  options: QueryEventsOptions = {}
): Promise<EventData[]> {
  validateParams(options);

  const queryParams = buildQueryParams(marketplace, options);
  const response = await apiGet<{ data: any[] }>(apiKey, '/events/query', queryParams);

  return response.data.map(transformEvent);
}

/**
 * Polls for new events and calls callback when new events are found
 *
 * @param apiKey - Sharetribe API key (optional, reads from auth file if not provided)
 * @param marketplace - Marketplace ID
 * @param options - Query options
 * @param callback - Function called with new events
 * @param pollInterval - Interval in milliseconds between polls (default: 5000)
 * @returns Function to stop polling
 */
export function pollEvents(
  apiKey: string | undefined,
  marketplace: string,
  options: QueryEventsOptions,
  callback: (events: EventData[]) => void,
  pollInterval: number = 5000
): () => void {
  let lastSeqId: number | undefined;
  let intervalId: NodeJS.Timeout;
  let isStopped = false;

  const poll = async () => {
    if (isStopped) return;

    try {
      const queryOpts = { ...options };
      if (lastSeqId !== undefined) {
        queryOpts.afterSeqId = lastSeqId;
      }

      const events = await queryEvents(apiKey, marketplace, queryOpts);

      if (events.length > 0) {
        callback(events);
        lastSeqId = Math.max(...events.map(e => e.sequenceId));
      }
    } catch (error) {
      // Silently continue polling on errors
      // Caller can handle errors in their callback if needed
    }
  };

  // Initial poll
  poll();

  // Set up interval
  intervalId = setInterval(poll, pollInterval);

  // Return stop function
  return () => {
    isStopped = true;
    clearInterval(intervalId);
  };
}
