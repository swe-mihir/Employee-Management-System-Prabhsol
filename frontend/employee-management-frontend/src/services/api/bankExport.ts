import { getAccessToken } from "@/lib/tokenStorage";
import { ApiError } from "@/services/api/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

function authHeaders(): HeadersInit {
  const token = getAccessToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface BankExportIncludedRow {
  employee_id: string;
  employee_name: string;
  transaction_type: string;
  amount: string;
  bene_id: string;
  remarks: string;
}

export interface BankExportSkippedRow {
  employee_id: string;
  employee_name: string;
  reason: string;
}

export interface BankExportPreview {
  included: BankExportIncludedRow[];
  skipped: BankExportSkippedRow[];
}

export async function fetchBankExportPreview(month: number, year: number): Promise<BankExportPreview> {
  const qs = new URLSearchParams({ month: String(month), year: String(year) });
  const res = await fetch(`${API_BASE}/payroll/bank-export/preview?${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err?.detail ?? "Failed to load preview");
  }
  return res.json();
}

export async function downloadBankExportFile(month: number, year: number): Promise<void> {
  const qs = new URLSearchParams({ month: String(month), year: String(year) });
  const res = await fetch(`${API_BASE}/payroll/bank-export?${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err?.detail ?? "Failed to download file");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : `bank_bulk_payment_${year}_${String(month).padStart(2, "0")}.txt`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}