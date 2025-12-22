/**
 * HTTP client using Node.js built-in http/https modules
 *
 * No external dependencies - pure Node.js implementation
 */

import * as https from 'node:https';
import * as http from 'node:http';
import { URL } from 'node:url';

export interface HttpOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeout?: number;
}

export interface HttpResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

/**
 * Makes an HTTP/HTTPS request using Node.js built-in modules
 *
 * Returns a promise that resolves with the response
 */
export function request(url: string, options: HttpOptions = {}): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 30000,
    };

    const req = client.request(requestOptions, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

/**
 * Makes a GET request
 */
export function get(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
  return request(url, { method: 'GET', headers });
}

/**
 * Makes a POST request with JSON body
 */
export function post(
  url: string,
  data: unknown,
  headers?: Record<string, string>
): Promise<HttpResponse> {
  const body = JSON.stringify(data);
  const allHeaders = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body).toString(),
    ...headers,
  };

  return request(url, {
    method: 'POST',
    headers: allHeaders,
    body,
  });
}

/**
 * Makes a DELETE request
 */
export function del(url: string, headers?: Record<string, string>): Promise<HttpResponse> {
  return request(url, { method: 'DELETE', headers });
}
