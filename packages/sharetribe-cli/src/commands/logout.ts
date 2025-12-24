/**
 * Logout command - clears authentication
 *
 * Must match flex-cli behavior exactly
 */

import { clearAuth } from 'sharetribe-flex-build-sdk';

/**
 * Executes the logout command
 *
 * Clears auth.edn file
 */
export async function logout(): Promise<void> {
  await clearAuth();
  console.log('Successfully logged out.');
}
