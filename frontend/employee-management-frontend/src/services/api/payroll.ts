import { getAccessToken } from "@/lib/tokenStorage";
import { ApiError } from "@/services/api/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

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

export interface PayrollRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  designation: string;
  month: number;
  year: number;
  days_present: number;
  days_absent: number;
  leaves_taken: number;
  ot_hours: number;
  advance: number;
  loan: number;
  tds: number;
  employee_mlwf: number;
  employer_mlwf: number;
  incentive: number;
  ern_basic: number | null;
  ern_hra: number | null;
  ern_conveyance: number | null;
  ern_medical: number | null;
  ot_amount: number | null;
  gross_salary: number | null;
  emp_pf: number | null;
  emp_esic: number | null;
  pt: number | null;
  total_deductions: number | null;
  net_salary: number | null;
  employer_pf: number | null;
  employer_admin: number | null;
  employer_total_pf: number | null;
  emp_employer_pf: number | null;
  employer_esic: number | null;
  emp_employer_esic: number | null;
  emp_employer_mlwf: number | null;
  total_ctc: number | null;
  status: string;
  calculated_at: string | null;
  paid_at: string | null;
}

export interface PayrollListResponse {
  total: number;
  items: PayrollRecord[];
}

export interface PayrollCreate {
  employee_id: string;
  month: number;
  year: number;
  ot_hours?: number;
  advance?: number;
  loan?: number;
  tds?: number;
  employee_mlwf?: number;
  employer_mlwf?: number;
  incentive?: number;
}

export interface PayrollUpdate {
  ot_hours?: number;
  advance?: number;
  loan?: number;
  tds?: number;
  employee_mlwf?: number;
  employer_mlwf?: number;
  incentive?: number;
}

export async function fetchPayroll(params: {
  month?: number;
  year?: number;
  status?: string;
  employee_ids?: string[];
  historical?: boolean;
  sort_by?: string;
  sort_dir?: string;
  page?: number;
  page_size?: number;
}): Promise<PayrollListResponse> {
  const qs = new URLSearchParams();
  if (params.month) qs.set("month", String(params.month));
  if (params.year) qs.set("year", String(params.year));
  if (params.status) qs.set("status", params.status);
  if (params.historical) qs.set("historical", "true");
  if (params.sort_by) qs.set("sort_by", params.sort_by);
  if (params.sort_dir) qs.set("sort_dir", params.sort_dir);
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  if (params.employee_ids?.length) {
    params.employee_ids.forEach(id => qs.append("employee_ids", id));
  }
  const res = await fetch(`${API_BASE}/payroll?${qs}`, { headers: authHeaders() });
  return handleResponse<PayrollListResponse>(res);
}

export async function createPayrollRecord(payload: PayrollCreate): Promise<PayrollRecord> {
  const res = await fetch(`${API_BASE}/payroll`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<PayrollRecord>(res);
}

export async function updatePayrollRecord(id: string, payload: PayrollUpdate): Promise<PayrollRecord> {
  const res = await fetch(`${API_BASE}/payroll/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<PayrollRecord>(res);
}

export async function calculatePayroll(id: string): Promise<PayrollRecord> {
  const res = await fetch(`${API_BASE}/payroll/${id}/calculate`, {
    method: "POST",
    headers: authHeaders(),
  });
  return handleResponse<PayrollRecord>(res);
}

export async function markPayrollPaid(id: string): Promise<PayrollRecord> {
  const res = await fetch(`${API_BASE}/payroll/${id}/mark-paid`, {
    method: "POST",
    headers: authHeaders(),
  });
  return handleResponse<PayrollRecord>(res);
}

export async function fetchMyPayroll(params: {
  month?: number;
  year?: number;
  page?: number;
  page_size?: number;
} = {}): Promise<PayrollListResponse> {
  const qs = new URLSearchParams();
  if (params.month) qs.set("month", String(params.month));
  if (params.year) qs.set("year", String(params.year));
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  const res = await fetch(`${API_BASE}/payroll/me?${qs}`, { headers: authHeaders() });
  return handleResponse<PayrollListResponse>(res);
}