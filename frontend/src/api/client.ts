import { ApiError, SlotTakenError } from './types';

const TOKEN_KEY = 'slotlock_token';

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

type AuthCallback = () => void;
let onUnauthorizedCallback: AuthCallback | null = null;

export function setOnUnauthorized(cb: AuthCallback): void {
  onUnauthorizedCallback = cb;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearStoredToken();
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    } else {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    throw new ApiError(401, 'Unauthorized');
  }

  if (response.status === 409) {
    let errorJson: { error?: string } = {};
    try {
      errorJson = await response.json();
    } catch {
      // ignore
    }
    if (errorJson.error === 'SLOT_TAKEN') {
      throw new SlotTakenError();
    }
    throw new ApiError(409, errorJson.error || 'Conflict');
  }

  if (!response.ok) {
    let message = 'An error occurred';
    try {
      const errJson = await response.json();
      message = errJson.error || errJson.message || message;
    } catch {
      message = response.statusText || message;
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}
