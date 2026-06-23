import { getAccessToken } from "@/lib/tokenStorage";
import { ApiError } from "@/services/api/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export const DOCUMENT_CATEGORIES = [
  "ID Proof",
  "Qualification Certificate",
  "Experience Letter",
  "Offer Letter",
  "Medical Certificate",
  "Other",
] as const;

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  category: string;
  label: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  uploaded_at: string;
}

export interface DocumentListResponse {
  total: number;
  items: EmployeeDocument[];
}

function authHeaders(): HeadersInit {
  const token = getAccessToken();
  return {
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

export async function fetchDocuments(employeeId: string): Promise<DocumentListResponse> {
  const res = await fetch(`${API_BASE}/employees/${employeeId}/documents`, {
    headers: authHeaders(),
  });
  return handleResponse<DocumentListResponse>(res);
}

export async function uploadDocument(
  employeeId: string,
  category: string,
  label: string,
  file: File
): Promise<EmployeeDocument> {
  const form = new FormData();
  form.append("category", category);
  form.append("label", label);
  form.append("file", file);
  const res = await fetch(`${API_BASE}/employees/${employeeId}/documents`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  return handleResponse<EmployeeDocument>(res);
}

export async function deleteDocument(employeeId: string, docId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/employees/${employeeId}/documents/${docId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err?.detail ?? "Delete failed");
  }
}

export function getViewUrl(employeeId: string, docId: string): string {
  return `${API_BASE}/employees/${employeeId}/documents/${docId}/view`;
}

export function getDownloadUrl(employeeId: string, docId: string): string {
  return `${API_BASE}/employees/${employeeId}/documents/${docId}/download`;
}