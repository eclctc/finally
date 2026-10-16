/** Skeleton so the RED run fails on assertions, not on a missing module. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function request<T>(_path: string, _init?: RequestInit): Promise<T> {
  return undefined as T;
}
