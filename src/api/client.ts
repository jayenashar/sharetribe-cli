/**
 * Sharetribe API client
 *
 * Handles authentication and API requests to Sharetribe backend
 */

import { get, post, del, request, postTransit, HttpResponse } from './http-client.js';
import { createMultipartBody, MultipartField } from './multipart.js';
import { encodeTransit, decodeTransit } from './transit.js';
import { readAuth } from '../auth/auth-storage.js';

// Re-export MultipartField for use in commands
export type { MultipartField };

// API base URL - must match flex-cli exactly
const API_BASE_URL = 'https://flex-build-api.sharetribe.com/v1/build-api';

export interface ApiError {
  code: string;
  message: string;
  status: number;
}

/**
 * Gets authentication headers
 */
function getAuthHeaders(): Record<string, string> {
  const auth = readAuth();
  if (!auth) {
    throw new Error('Not logged in. Please run: sharetribe-cli login');
  }

  return {
    Authorization: `Apikey ${auth.apiKey}`,
  };
}

/**
 * Handles API response and errors
 */
function handleResponse<T>(response: HttpResponse): T {
  if (response.statusCode >= 200 && response.statusCode < 300) {
    if (response.body) {
      return JSON.parse(response.body) as T;
    }
    return {} as T;
  }

  // Parse error response
  let errorData: { errors?: Array<{ code: string; message?: string }> } = {};
  try {
    errorData = JSON.parse(response.body);
  } catch {
    // Ignore parse errors
  }

  const firstError = errorData.errors?.[0];
  const error: ApiError = {
    code: firstError?.code || 'UNKNOWN_ERROR',
    message: firstError?.message || `HTTP ${response.statusCode}`,
    status: response.statusCode,
  };

  throw error;
}

/**
 * Makes a GET request to the API
 */
export async function apiGet<T>(endpoint: string, queryParams?: Record<string, string>): Promise<T> {
  const url = new URL(API_BASE_URL + endpoint);
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await get(url.toString(), getAuthHeaders());
  return handleResponse<T>(response);
}

/**
 * Makes a POST request to the API
 */
export async function apiPost<T>(
  endpoint: string,
  queryParams?: Record<string, string>,
  body?: unknown
): Promise<T> {
  const url = new URL(API_BASE_URL + endpoint);
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await post(url.toString(), body, getAuthHeaders());
  return handleResponse<T>(response);
}

/**
 * Makes a DELETE request to the API
 */
export async function apiDelete<T>(
  endpoint: string,
  queryParams?: Record<string, string>
): Promise<T> {
  const url = new URL(API_BASE_URL + endpoint);
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await del(url.toString(), getAuthHeaders());
  return handleResponse<T>(response);
}

/**
 * Makes a multipart form-data POST request to the API
 */
export async function apiPostMultipart<T>(
  endpoint: string,
  queryParams: Record<string, string>,
  fields: MultipartField[]
): Promise<T> {
  const url = new URL(API_BASE_URL + endpoint);
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const { body, contentType } = createMultipartBody(fields);

  const headers = {
    ...getAuthHeaders(),
    'Content-Type': contentType,
    'Content-Length': body.length.toString(),
  };

  const response = await request(url.toString(), {
    method: 'POST',
    headers,
    body,
  });
  return handleResponse<T>(response);
}

/**
 * Makes a POST request to the API with Transit-encoded body
 * Transit is a data format used by the Sharetribe API for certain endpoints
 */
export async function apiPostTransit<T>(
  endpoint: string,
  queryParams: Record<string, string>,
  body: unknown
): Promise<T> {
  const url = new URL(API_BASE_URL + endpoint);
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const transitBody = encodeTransit(body);
  const response = await postTransit(url.toString(), transitBody, getAuthHeaders());

  // Parse Transit response
  if (response.statusCode >= 400) {
    const errorData = decodeTransit(response.body) as any;
    const firstError = errorData.errors?.[0];
    const error: ApiError = {
      code: firstError?.code || 'UNKNOWN_ERROR',
      message: firstError?.title || `HTTP ${response.statusCode}`,
      status: response.statusCode,
    };
    throw error;
  }

  return decodeTransit(response.body) as T;
}
