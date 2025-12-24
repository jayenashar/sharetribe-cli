/**
 * Sharetribe Flex Build SDK
 *
 * Programmatic API matching all CLI capabilities
 */

// Export process management functions
export {
  listProcesses,
  listProcessVersions,
  getProcess,
  createProcess,
  pushProcess,
  createAlias,
  updateAlias,
  deleteAlias,
  type ProcessListItem,
  type ProcessVersion,
  type ProcessDetails,
  type CreateProcessResult,
  type PushProcessResult,
  type AliasResult,
} from './processes.js';

// Export process deployment functions
export {
  deployProcess,
  type DeployProcessOptions,
  type DeployProcessResult,
} from './deploy.js';

// Export search schema management functions
export {
  listSearchSchemas,
  setSearchSchema,
  unsetSearchSchema,
  type SearchSchema,
  type SetSearchSchemaOptions,
  type UnsetSearchSchemaOptions,
} from './search.js';

// Export events query functions
export {
  queryEvents,
  pollEvents,
  type EventData,
  type QueryEventsOptions,
} from './events.js';

// Export types
export type {
  ProcessState,
  ProcessTransition,
  ProcessNotification,
  ProcessAction,
  ProcessDefinition,
} from './types.js';

// Export EDN process utilities
export {
  parseProcessFile,
  serializeProcess,
} from './edn-process.js';

// Export authentication functions
export {
  writeAuth,
  clearAuth,
  type AuthData,
} from './auth-storage.js';

// Export asset management functions
export {
  pullAssets,
  pushAssets,
  type Asset,
  type PullAssetsResult,
  type PushAssetsResult,
} from './assets.js';

// Export notification management functions
export {
  sendNotification,
  previewNotification,
  type EmailTemplate,
  type NotificationOptions,
} from './notifications.js';

// Export listing approval functions
export {
  getListingApprovalStatus,
  enableListingApproval,
  disableListingApproval,
} from './listing-approval.js';

// Export Stripe integration functions
export {
  updateStripeVersion,
  SUPPORTED_STRIPE_VERSIONS,
  type StripeApiVersion,
} from './stripe.js';
