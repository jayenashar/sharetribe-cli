/**
 * Notification management functions
 *
 * Programmatic API for managing email notifications
 */

import { apiPost } from './api/client.js';

export interface EmailTemplate {
  html: string;
  subject: string;
}

export interface NotificationOptions {
  template: EmailTemplate;
  context?: unknown;
}

/**
 * Sends a preview email to the marketplace admin
 *
 * @param apiKey - Sharetribe API key (optional, reads from auth file if not provided)
 * @param marketplace - Marketplace ID
 * @param options - Email template and context
 * @returns Admin email that received the preview
 */
export async function sendNotification(
  apiKey: string | undefined,
  marketplace: string,
  options: NotificationOptions
): Promise<{ adminEmail: string }> {
  const body: Record<string, unknown> = {
    template: {
      'template-html': options.template.html,
      'template-subject': options.template.subject,
    },
  };

  if (options.context !== undefined) {
    body['template-context'] = options.context;
  }

  const response = await apiPost<{ data: { 'admin-email': string } }>(
    apiKey,
    '/notifications/send',
    { marketplace },
    body
  );

  return {
    adminEmail: response.data['admin-email'],
  };
}

/**
 * Previews a notification (renders HTML)
 *
 * @param apiKey - Sharetribe API key (optional, reads from auth file if not provided)
 * @param marketplace - Marketplace ID
 * @param options - Email template and context
 * @returns Rendered HTML
 */
export async function previewNotification(
  apiKey: string | undefined,
  marketplace: string,
  options: NotificationOptions
): Promise<{ html: string }> {
  const body: Record<string, unknown> = {
    template: {
      'template-html': options.template.html,
      'template-subject': options.template.subject,
    },
  };

  if (options.context !== undefined) {
    body['template-context'] = options.context;
  }

  const response = await apiPost<{ data: { html: string } }>(
    apiKey,
    '/notifications/preview',
    { marketplace },
    body
  );

  return {
    html: response.data.html,
  };
}
