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

export interface PayslipEmailPayload {
  employee_name: string;
  work_email: string;
  month: number;
  year: number;
  pdf_base64: string;
}

export interface SendPayslipsResponse {
  sent: string[];
  failed: { name: string; reason: string }[];
}

export async function sendPayslipEmails(
  payloads: PayslipEmailPayload[]
): Promise<SendPayslipsResponse> {
  const res = await fetch(`${API_BASE}/payroll/send-payslips`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ payslips: payloads }),
  });
  return handleResponse<SendPayslipsResponse>(res);
}