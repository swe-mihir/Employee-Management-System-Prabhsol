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

export interface SalaryStructure {
  id: string;
  employee_id: string;
  employee_name: string;
  basic_allowance: number;
  hra_allowance: number;
  conveyance_allowance: number;
  medical_allowance: number;
  effective_from: string;
  effective_to: string | null;
  account_name: string | null;
  account_number: string | null;
  bank_ifsc_code: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  transaction_type: String | null
  bene_id: String | null
  remarks: String | null
}

export interface SalaryStructureListResponse {
  total: number;
  items: SalaryStructure[];
}

export interface SalaryStructureCreate {
  employee_id: string;
  basic_allowance: number;
  hra_allowance: number;
  conveyance_allowance: number;
  medical_allowance: number;
  effective_from: string;
  effective_to?: string;
  account_name?: string;
  account_number?: string;
  bank_ifsc_code?: string;
  bank_name?: string;
  bank_branch?: string;
  transaction_type: String
  bene_id: String
  remarks: String
}

export async function fetchSalaryStructures(): Promise<SalaryStructureListResponse> {
  const res = await fetch(`${API_BASE}/salary-structure`, { headers: authHeaders() });
  return handleResponse<SalaryStructureListResponse>(res);
}

export async function getSalaryStructure(employee_id: string): Promise<SalaryStructure> {
  const res = await fetch(`${API_BASE}/salary-structure/${employee_id}`, { headers: authHeaders() });
  return handleResponse<SalaryStructure>(res);
}

export async function createSalaryStructure(payload: SalaryStructureCreate): Promise<SalaryStructure> {
  const res = await fetch(`${API_BASE}/salary-structure`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<SalaryStructure>(res);
}

export async function updateSalaryStructure(id: string, payload: Partial<SalaryStructureCreate>): Promise<SalaryStructure> {
  const res = await fetch(`${API_BASE}/salary-structure/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<SalaryStructure>(res);
}

export async function fetchMySalaryStructure(): Promise<SalaryStructureListResponse> {
  const res = await fetch(`${API_BASE}/salary-structure/me`, { headers: authHeaders() });
  return handleResponse<SalaryStructureListResponse>(res);
}