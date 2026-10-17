export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export const NETWORK_ERROR = "Request failed. Try again.";

/** User-facing text for a failed request: the backend message, else the generic network copy. */
export const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : NETWORK_ERROR);

/** Fetch same-origin JSON. Backend error bodies are {"error": "..."}; anything else is status-only. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (response.ok) return response.json() as Promise<T>;
  const body = await response.json().catch(() => null);
  throw new ApiError(body?.error ?? `Request failed (${response.status})`, response.status);
}
