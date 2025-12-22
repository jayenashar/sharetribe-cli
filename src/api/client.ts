/**
 * Sharetribe API client
 *
 * Handles authentication and API requests to Sharetribe backend
 */

import { get, post, del, HttpResponse } from './http-client.js';
import { createMultipartBody, MultipartField } from './multipart.js';
import { readAuth } from '../auth/auth-storage.js';

// API base URL - will be determined from flex-cli source
const API_BASE_URL = 'https://flex-api.sharetribe.com/v1';

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
    Authorization: `Bearer ${auth.apiKey}`,
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
  const url = new URL(endpoint, API_BASE_URL);
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
  const url = new URL(endpoint, API_BASE_URL);
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
  const url = new URL(endpoint, API_BASE_URL);
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
  const url = new URL(endpoint, API_BASE_URL);
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const { body, contentType } = createMultipartBody(fields);

  const headers = {
    ...getAuthHeaders(),
    'Content-Type': contentType,
    'Content-Length': body.length.toString(),
  };

  const response = await post(url.toString(), body, headers);
  return handleResponse<T>(response);
}
