import { getAccessToken } from "@/lib/tokenStorage";
import { ApiError } from "@/services/api/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export interface PayrollItem {
  id: string;
  employee_id: string;
  employee_name: string;
  designation: string | null;
  month: number;
  year: number;
  days_present: number;
  days_absent: number;
  leaves_taken: number;
  gross_salary: string;
  total_deductions: string;
  net_salary: string;
  total_ctc: string;
  status: string;
  calculated_at: string | null;
  paid_at: string | null;
}

export interface PayrollListResponse {
  total: number;
  items: PayrollItem[];
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

export async function fetchPayroll(params: {
  year: number;
  month?: number;
  status?: string;
  employee_id?: string[];
  sort_by?: string;
  sort_dir?: string;
  page?: number;
  page_size?: number;
}): Promise<PayrollListResponse> {
  const qs = new URLSearchParams();
  qs.set("year", String(params.year));
  if (params.month) qs.set("month", String(params.month));
  if (params.status) qs.set("status", params.status);
  if (params.employee_id?.length) params.employee_id.forEach(id => qs.append("employee_id", id));
  if (params.sort_by) qs.set("sort_by", params.sort_by);
  if (params.sort_dir) qs.set("sort_dir", params.sort_dir);
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  const res = await fetch(`${API_BASE}/payroll?${qs}`, { headers: authHeaders() });
  return handleResponse<PayrollListResponse>(res);
}

export async function markPaid(id: string): Promise<PayrollItem> {
  const res = await fetch(`${API_BASE}/payroll/${id}/mark-paid`, {
    method: "POST",
    headers: authHeaders(),
  });
  return handleResponse<PayrollItem>(res);
}