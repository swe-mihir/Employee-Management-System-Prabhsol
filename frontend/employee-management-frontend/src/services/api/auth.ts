const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number; // seconds
}

export interface UserInfo {
  user_id: number;
  employee_name: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface MeResponse {
  user: UserInfo;
  access_token: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Backend sends { detail: "..." } on errors
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err?.detail ?? "Request failed");
  }

  return res.json();
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err?.detail ?? "Request failed");
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Auth calls ─────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string,
): Promise<TokenResponse> {
  return post<TokenResponse>("/auth/login", { email, password });
}

export async function refreshTokens(
  refresh_token: string,
): Promise<TokenResponse> {
  return post<TokenResponse>("/auth/refresh", { refresh_token });
}

export async function getMe(access_token: string): Promise<MeResponse> {
  return get<MeResponse>("/auth/me", access_token);
}