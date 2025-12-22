/**
 * Multipart form-data implementation using Node.js streams
 *
 * No external dependencies - implements multipart/form-data manually
 */

import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';

export interface MultipartField {
  name: string;
  value: string | Buffer;
  filename?: string;
  contentType?: string;
}

/**
 * Generates a random boundary for multipart form-data
 */
function generateBoundary(): string {
  return `----WebKitFormBoundary${randomBytes(16).toString('hex')}`;
}

/**
 * Creates multipart form-data body from fields
 */
export function createMultipartBody(fields: MultipartField[]): {
  body: Buffer;
  boundary: string;
  contentType: string;
} {
  const boundary = generateBoundary();
  const parts: Buffer[] = [];

  for (const field of fields) {
    // Add boundary
    parts.push(Buffer.from(`--${boundary}\r\n`));

    // Add Content-Disposition header
    if (field.filename) {
      parts.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${field.name}"; filename="${field.filename}"\r\n`
        )
      );

      // Add Content-Type if specified
      if (field.contentType) {
        parts.push(Buffer.from(`Content-Type: ${field.contentType}\r\n`));
      }
    } else {
      parts.push(Buffer.from(`Content-Disposition: form-data; name="${field.name}"\r\n`));
    }

    parts.push(Buffer.from('\r\n'));

    // Add value
    if (typeof field.value === 'string') {
      parts.push(Buffer.from(field.value));
    } else {
      parts.push(field.value);
    }

    parts.push(Buffer.from('\r\n'));
  }

  // Add final boundary
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  return {
    body,
    boundary,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}
