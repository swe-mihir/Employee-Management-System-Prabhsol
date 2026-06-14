import { getAccessToken } from "@/lib/tokenStorage";
import { ApiError } from "@/services/api/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export interface SystemUser {
  id: number;
  employee_id: string | null;
  employee_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface UserListResponse {
  total: number;
  items: SystemUser[];
}

export interface UserCreate {
  employee_id: string;
  email: string;
  password: string;
  role: string;
}

export interface UserUpdate {
  email?: string;
  password?: string;
  role?: string;
}

function authHeaders(): HeadersInit {
  const token = getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err?.detail ?? "Request failed");
  }
  return res.json();
}

export async function fetchUsers(params: {
  sort_by?: string;
  sort_dir?: string;
  page?: number;
  page_size?: number;
}): Promise<UserListResponse> {
  const qs = new URLSearchParams();
  if (params.sort_by) qs.set("sort_by", params.sort_by);
  if (params.sort_dir) qs.set("sort_dir", params.sort_dir);
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  const res = await fetch(`${API_BASE}/users?${qs}`, { headers: authHeaders() });
  return handleResponse<UserListResponse>(res);
}

export async function fetchUser(id: number): Promise<SystemUser> {
  const res = await fetch(`${API_BASE}/users/${id}`, { headers: authHeaders() });
  return handleResponse<SystemUser>(res);
}

export async function createUser(payload: UserCreate): Promise<SystemUser> {
  const res = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<SystemUser>(res);
}

export async function updateUser(id: number, payload: UserUpdate): Promise<SystemUser> {
  const res = await fetch(`${API_BASE}/users/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<SystemUser>(res);
}