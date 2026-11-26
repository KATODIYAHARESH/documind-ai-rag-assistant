const STORAGE_KEY = "documind_session_token";

/**
 * Session token kept client-side and sent as `Authorization: Bearer`.
 * It is the fallback for environments where the browser refuses the session cookie
 * (for example when the app is displayed inside a cross-site frame).
 */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(STORAGE_KEY, token);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the cookie still carries the session.
  }
}

export function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
