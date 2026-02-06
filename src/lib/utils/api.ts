/**
 * Fetch wrapper that automatically includes credentials for authenticated API calls
 */
export async function apiFetch(url: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}

/**
 * Type-safe API response wrapper
 */
export interface ApiResponse<T = any> {
  state?: T;
  error?: string;
  [key: string]: any;
}

/**
 * Reusable API call helper with consistent error handling
 * @param endpoint API endpoint path (e.g., "/api/equip-item")
 * @param body Request body (will be JSON stringified)
 * @param locale Optional locale for error messages
 * @returns Parsed JSON response
 * @throws Error with message from API or default error
 */
export async function apiCall<T = any>(
  endpoint: string,
  body?: any,
  locale?: "vi" | "en"
): Promise<ApiResponse<T>> {
  const response = await apiFetch(endpoint, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || (locale === "vi" ? "Lỗi xử lý yêu cầu" : "Request processing failed")
    );
  }

  return response.json();
}
