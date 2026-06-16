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

export interface DailyAttendanceItem {
  id: string;
  employee_id: string;
  emp_code: string | null;
  name: string;
  status: string | null;
  clock_in: string | null;
  clock_out: string | null;
  required_hours: number | null;
  hours_worked: number | null;
}

export interface DailyAttendanceResponse {
  date: string;
  total: number;
  items: DailyAttendanceItem[];
}

export interface MonthAttendanceItem {
  employee_id: string;
  emp_code: string | null;
  name: string;
  days: Record<number, string | null>;
  total_paid: number;
}

export interface MonthAttendanceResponse {
  year: number;
  month: number;
  days_in_month: number;
  total: number;
  items: MonthAttendanceItem[];
}

export async function fetchDailyAttendance(date: string, employeeId?: string): Promise<DailyAttendanceResponse> {
  const params = new URLSearchParams({ date });
  if (employeeId) params.set("employee_id", employeeId);
  const res = await fetch(`${API_BASE}/attendance/daily?${params}`, {
     headers: authHeaders(),
   });
   return handleResponse<DailyAttendanceResponse>(res);
 }

export async function fetchMonthlyAttendance(year: number, month: number, employeeId?: string): Promise<MonthAttendanceResponse> {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  if (employeeId) params.set("employee_id", employeeId);
  const res = await fetch(`${API_BASE}/attendance/monthly?${params}`, {
     headers: authHeaders(),
   });
   return handleResponse<MonthAttendanceResponse>(res);
 }