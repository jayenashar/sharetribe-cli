/**
 * Listing approval management functions
 *
 * Programmatic API for managing listing approvals
 */

import { apiGet, apiPostTransit } from './api/client.js';

/**
 * Gets current listing approval status
 *
 * @param apiKey - Sharetribe API key (optional, reads from auth file if not provided)
 * @param marketplace - Marketplace ID
 * @returns Whether listing approvals are enabled
 */
export async function getListingApprovalStatus(
  apiKey: string | undefined,
  marketplace: string
): Promise<{ enabled: boolean }> {
  const response = await apiGet<{ data: { 'listing-approval-enabled': boolean } }>(
    apiKey,
    '/marketplace/show',
    { marketplace }
  );

  return {
    enabled: response.data['listing-approval-enabled'],
  };
}

/**
 * Enables listing approvals
 *
 * @param apiKey - Sharetribe API key (optional, reads from auth file if not provided)
 * @param marketplace - Marketplace ID
 * @returns Success confirmation
 */
export async function enableListingApproval(
  apiKey: string | undefined,
  marketplace: string
): Promise<{ success: true }> {
  await apiPostTransit(apiKey, '/listing-approval/enable', { marketplace }, {});
  return { success: true };
}

/**
 * Disables listing approvals
 *
 * @param apiKey - Sharetribe API key (optional, reads from auth file if not provided)
 * @param marketplace - Marketplace ID
 * @returns Success confirmation
 */
export async function disableListingApproval(
  apiKey: string | undefined,
  marketplace: string
): Promise<{ success: true }> {
  await apiPostTransit(apiKey, '/listing-approval/disable', { marketplace }, {});
  return { success: true };
}
