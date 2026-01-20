/**
 * Fetch wrapper that automatically includes credentials for authenticated API calls
 */
export async function apiFetch(url: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
}
