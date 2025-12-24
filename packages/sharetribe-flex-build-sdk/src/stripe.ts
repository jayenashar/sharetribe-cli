/**
 * Stripe integration management functions
 *
 * Programmatic API for managing Stripe integration
 */

import { apiPost } from './api/client.js';

/**
 * Supported Stripe API versions
 */
export const SUPPORTED_STRIPE_VERSIONS = ['2019-12-03', '2019-09-09', '2019-02-19'] as const;

export type StripeApiVersion = typeof SUPPORTED_STRIPE_VERSIONS[number];

/**
 * Updates Stripe API version
 *
 * @param apiKey - Sharetribe API key (optional, reads from auth file if not provided)
 * @param marketplace - Marketplace ID
 * @param version - Stripe API version
 * @returns Success confirmation
 */
export async function updateStripeVersion(
  apiKey: string | undefined,
  marketplace: string,
  version: string
): Promise<{ success: true }> {
  // Validate version
  if (!SUPPORTED_STRIPE_VERSIONS.includes(version as StripeApiVersion)) {
    throw new Error(
      `--version should be one of: ${SUPPORTED_STRIPE_VERSIONS.join(', ')}. Was ${version}.`
    );
  }

  await apiPost(apiKey, '/stripe/update-version', { marketplace }, { version });

  return { success: true };
}
