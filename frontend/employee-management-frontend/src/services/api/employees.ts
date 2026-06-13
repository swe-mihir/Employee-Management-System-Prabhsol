import { getAccessToken } from "@/lib/tokenStorage";
import { ApiError } from "@/services/api/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

// ── Types ──────────────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  name: string;
  department: string | null;
  designation: string | null;
  join_date: string;
  leaving_date: string | null;
  is_active: boolean;
  personal_phone: string | null;
  work_phone: string | null;
  personal_email: string | null;
  work_email: string | null;
  date_of_birth: string | null;
  aadhar_no: string | null;
  pan_no: string | null;
  pf_no: string | null;
  ip_no: string | null;
  status: string;
  approve_before: string | null;
}

export interface EmployeeListResponse {
  total: number;
  items: Employee[];
}

export interface EmployeeCreate {
  name: string;
  date_of_birth?: string;
  department?: string;
  designation?: string;
  join_date: string;
  personal_phone?: string;
  work_phone?: string;
  personal_email?: string;
  work_email?: string;
  aadhar_no?: string;
  pan_no?: string;
  pf_no?: string;
  ip_no?: string;
  status?: string;
  approve_before?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

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

// ── API calls ──────────────────────────────────────────────────────────────

export async function fetchEmployees(params: {
  status?: string;
  sort_by?: string;
  sort_dir?: string;
  page?: number;
  page_size?: number;
}): Promise<EmployeeListResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.sort_by) qs.set("sort_by", params.sort_by);
  if (params.sort_dir) qs.set("sort_dir", params.sort_dir);
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));

  const res = await fetch(`${API_BASE}/employees?${qs}`, {
    headers: authHeaders(),
  });
  return handleResponse<EmployeeListResponse>(res);
}

export async function createEmployee(
  payload: EmployeeCreate,
): Promise<Employee> {
  const res = await fetch(`${API_BASE}/employees`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Employee>(res);
}

export async function updateEmployee(
  id: string,
  payload: Partial<EmployeeCreate> & { leaving_date?: string; is_active?: boolean },
): Promise<Employee> {
  const res = await fetch(`${API_BASE}/employees/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Employee>(res);
}

export async function approveEmployee(id: string): Promise<Employee> {
  const res = await fetch(`${API_BASE}/employees/${id}/approve`, {
    method: "POST",
    headers: authHeaders(),
  });
  return handleResponse<Employee>(res);
}