/**
 * Tests for HTTP client
 */

import { describe, it, expect } from 'vitest';
import { request } from '../src/api/http-client.js';

describe('http-client', () => {
  it('should make a GET request', async () => {
    // Test with a public API
    const response = await request('https://httpbin.org/get', {
      method: 'GET',
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('httpbin.org');
  });

  it('should handle errors', async () => {
    const response = await request('https://httpbin.org/status/404', {
      method: 'GET',
    });
    // Just check that we get a response, status code may vary
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });
});
