/**
 * Events command - query marketplace events
 */

import { Command } from 'commander';
import { apiGet } from '../../api/client.js';
import { printTable, printError } from '../../util/output.js';

interface EventData {
  sequenceId: number;
  resourceId: string;
  eventType: string;
  createdAt: string;
  source?: string;
  auditData?: {
    userId?: string;
    adminId?: string;
  };
}

interface EventAudit {
  'user/email'?: string;
  'admin/email'?: string;
}

interface Event {
  'event/data': EventData;
  'event/audit': EventAudit;
}

interface EventsQueryOptions {
  resourceId?: string;
  relatedResourceId?: string;
  eventTypes?: string;
  sequenceId?: number;
  afterSeqId?: number;
  beforeSeqId?: number;
  afterTs?: string;
  beforeTs?: string;
  limit?: number;
  json?: boolean;
  jsonPretty?: boolean;
}

/**
 * Validates query parameters
 */
function validateParams(opts: EventsQueryOptions): void {
  const exclusiveParams = [
    opts.sequenceId !== undefined,
    opts.afterSeqId !== undefined,
    opts.beforeSeqId !== undefined,
    opts.afterTs !== undefined,
    opts.beforeTs !== undefined,
  ];

  if (exclusiveParams.filter(Boolean).length > 1) {
    throw new Error(
      'Only one of --seqid, --after-seqid, --before-seqid, --after-ts, or --before-ts can be specified'
    );
  }

  if (opts.resourceId && opts.relatedResourceId) {
    throw new Error('Only one of --resource or --related-resource can be specified');
  }
}

/**
 * Builds query parameters for API
 */
function buildQueryParams(
  marketplace: string,
  opts: EventsQueryOptions
): Record<string, string> {
  const params: Record<string, string> = {
    marketplace,
    latest: 'true'  // Default to latest (descending order)
  };

  if (opts.resourceId) params['resource-id'] = opts.resourceId;
  if (opts.relatedResourceId) params['related-resource-id'] = opts.relatedResourceId;
  if (opts.eventTypes) params['event-types'] = opts.eventTypes;
  if (opts.sequenceId !== undefined) params['sequence-id'] = opts.sequenceId.toString();
  if (opts.afterSeqId !== undefined) {
    params['start-after-sequence-id'] = opts.afterSeqId.toString();
    params.latest = 'false';  // When using after-seqid, don't use latest
  }
  if (opts.beforeSeqId !== undefined) params['sequence-id-end'] = opts.beforeSeqId.toString();
  if (opts.afterTs) {
    params['start-after-created-at'] = opts.afterTs;
    params.latest = 'false';  // When using after-ts, don't use latest
  }
  if (opts.beforeTs) params['created-at-end'] = opts.beforeTs;
  if (opts.limit !== undefined) params.perPage = opts.limit.toString();

  return params;
}

/**
 * Formats timestamp to match flex-cli format: YYYY-MM-DD H:MM:SS AM/PM
 */
function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const timeString = date.toLocaleTimeString('en-US');

    return `${year}-${month}-${day} ${timeString}`;
  } catch {
    return timestamp;
  }
}

/**
 * Transforms event from API format to flex-cli JSON format
 * API returns: { "event/data": {...}, "event/audit": {...} }
 * flex-cli outputs: flattened structure with top-level fields
 */
function transformEventForJson(event: any): any {
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
    sequenceId: eventData.sequenceId,
    previousValues: eventData.previousValues || null,
    marketplaceId: eventData.marketplaceId,
  };
}

/**
 * Queries events from API
 */
async function queryEvents(
  marketplace: string,
  opts: EventsQueryOptions
): Promise<void> {
  try {
    validateParams(opts);

    const params = buildQueryParams(marketplace, opts);
    const response = await apiGet<{ data: Event[] }>('/events/query', params);

    if (response.data.length === 0) {
      console.log('No events found.');
      return;
    }

    // Output format
    if (opts.json) {
      for (const event of response.data) {
        console.log(JSON.stringify(transformEventForJson(event)));
      }
    } else if (opts.jsonPretty) {
      for (const event of response.data) {
        console.log(JSON.stringify(transformEventForJson(event), null, 2));
      }
    } else {
      printTable(
        ['Seq ID', 'Resource ID', 'Event type', 'Created at local time', 'Source', 'Actor'],
        response.data.map((e) => {
          const eventData = e['event/data'];
          const eventAudit = e['event/audit'];
          const actor = eventAudit['user/email'] || eventAudit['admin/email'] || '';
          const source = eventData.source?.replace('source/', '') || '';

          return {
            'Seq ID': eventData.sequenceId.toString(),
            'Resource ID': eventData.resourceId,
            'Event type': eventData.eventType,
            'Created at local time': formatTimestamp(eventData.createdAt),
            'Source': source,
            'Actor': actor,
          };
        })
      );
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to query events');
    }
    process.exit(1);
  }
}

/**
 * Tails events (live streaming)
 */
async function tailEvents(
  marketplace: string,
  opts: EventsQueryOptions
): Promise<void> {
  try {
    validateParams(opts);

    let lastSeqId: number | undefined;
    const pollInterval = 5000; // 5 seconds
    const limit = opts.limit || 10;

    console.log('Tailing events... Press Ctrl+C to stop');
    console.log('');

    const poll = async () => {
      const queryOpts = { ...opts, limit };
      if (lastSeqId !== undefined) {
        queryOpts.afterSeqId = lastSeqId;
      }

      const params = buildQueryParams(marketplace, queryOpts);
      const response = await apiGet<{ data: Event[] }>('/events/query', params);

      if (response.data.length > 0) {
        // Output events
        if (opts.json) {
          for (const event of response.data) {
            console.log(JSON.stringify(transformEventForJson(event)));
          }
        } else if (opts.jsonPretty) {
          for (const event of response.data) {
            console.log(JSON.stringify(transformEventForJson(event), null, 2));
          }
        } else {
          printTable(
            ['Seq ID', 'Resource ID', 'Event type', 'Created at local time', 'Source', 'Actor'],
            response.data.map((e) => {
              const eventData = e['event/data'];
              const eventAudit = e['event/audit'];
              const actor = eventAudit['user/email'] || eventAudit['admin/email'] || '';
              const source = eventData.source?.replace('source/', '') || '';

              return {
                'Seq ID': eventData.sequenceId.toString(),
                'Resource ID': eventData.resourceId,
                'Event type': eventData.eventType,
                'Created at local time': formatTimestamp(eventData.createdAt),
                'Source': source,
                'Actor': actor,
              };
            })
          );
        }

        // Update last sequence ID
        lastSeqId = Math.max(...response.data.map(e => e['event/data'].sequenceId));
      }
    };

    // Initial poll
    await poll();

    // Set up interval
    const interval = setInterval(async () => {
      try {
        await poll();
      } catch (error) {
        if (error && typeof error === 'object' && 'message' in error) {
          printError(error.message as string);
        }
      }
    }, pollInterval);

    // Handle graceful shutdown
    const shutdown = () => {
      console.log('\nStopping tail...');
      clearInterval(interval);
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      printError(error.message as string);
    } else {
      printError('Failed to tail events');
    }
    process.exit(1);
  }
}

/**
 * Registers events command
 */
export function registerEventsCommand(program: Command): void {
  const cmd = program
    .command('events')
    .description('Get a list of events.')
    .option('--resource <RESOURCE_ID>', 'show events for specific resource ID')
    .option('--related-resource <RELATED_RESOURCE_ID>', 'show events related to specific resource ID')
    .option('--filter <EVENT_TYPES>', 'filter by event types (comma-separated)')
    .option('--seqid <SEQUENCE_ID>', 'get event with specific sequence ID', parseInt)
    .option('--after-seqid <SEQUENCE_ID>', 'show events after sequence ID (exclusive)', parseInt)
    .option('--before-seqid <SEQUENCE_ID>', 'show events before sequence ID (exclusive)', parseInt)
    .option('--after-ts <TIMESTAMP>', 'show events after timestamp')
    .option('--before-ts <TIMESTAMP>', 'show events before timestamp')
    .option('-l, --limit <NUMBER>', 'limit results (default: 100, max: 100)', parseInt)
    .option('--json', 'output as single-line JSON strings')
    .option('--json-pretty', 'output as indented multi-line JSON')
    .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier');

  // Default action - query
  cmd.action(async (opts) => {
    const marketplace = opts.marketplace || program.opts().marketplace;
    if (!marketplace) {
      console.error('Could not parse arguments:');
      console.error('--marketplace is required');
      process.exit(1);
    }

    await queryEvents(marketplace, {
      resourceId: opts.resource,
      relatedResourceId: opts.relatedResource,
      eventTypes: opts.filter,
      sequenceId: opts.seqid,
      afterSeqId: opts.afterSeqid,
      beforeSeqId: opts.beforeSeqid,
      afterTs: opts.afterTs,
      beforeTs: opts.beforeTs,
      limit: opts.limit || 100,
      json: opts.json,
      jsonPretty: opts.jsonPretty,
    });
  });

  // tail subcommand
  cmd
    .command('tail')
    .description('Tail events live as they happen')
    .option('--resource <RESOURCE_ID>', 'show events for specific resource ID')
    .option('--related-resource <RELATED_RESOURCE_ID>', 'show events related to specific resource ID')
    .option('--filter <EVENT_TYPES>', 'filter by event types (comma-separated)')
    .option('-l, --limit <NUMBER>', 'limit results per poll (default: 10, max: 100)', parseInt)
    .option('--json', 'output as single-line JSON strings')
    .option('--json-pretty', 'output as indented multi-line JSON')
    .option('-m, --marketplace <MARKETPLACE_ID>', 'marketplace identifier')
    .action(async (opts) => {
      const marketplace = opts.marketplace || program.opts().marketplace;
      if (!marketplace) {
        console.error('Could not parse arguments:');
        console.error('--marketplace is required');
        process.exit(1);
      }

      await tailEvents(marketplace, {
        resourceId: opts.resource,
        relatedResourceId: opts.relatedResource,
        eventTypes: opts.filter,
        limit: opts.limit || 10,
        json: opts.json,
        jsonPretty: opts.jsonPretty,
      });
    });
}
