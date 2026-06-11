// src/services/export/exportEmployees.ts
// Pure client-side export — no backend required.
// Excel via SheetJS (xlsx), PDF via jsPDF + jspdf-autotable.
//
// Install once:
//   npm install xlsx jspdf jspdf-autotable

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Employee } from "@/services/api/employees";

// ─── Column label map ────────────────────────────────────────────────────────
// Keys must match the column keys used in employees/page.tsx
export const COLUMN_LABELS: Record<string, string> = {
  sr_no: "Sr. No",
  full_name: "Name",
  designation: "Designation",
  department: "Department",
  join_date: "Join Date",
  employee_code: "Employee Code",
  email: "Email",
  phone: "Phone",
  status: "Status",
  location: "Location",
  employment_type: "Employment Type",
  gender: "Gender",
  date_of_birth: "Date of Birth",
  leaving_date: "Leaving Date",
  pan_number: "PAN Number",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(val: string | null | undefined): string {
  if (!val) return "";
  try {
    return new Date(val).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return val;
  }
}

/**
 * Serialise one employee row into plain strings, respecting visible columns.
 * `index` is the 1-based serial number for the row.
 */
function buildRow(
  emp: Employee,
  visibleColumns: string[],
  index: number
): Record<string, string> {
  const columnMap: Record<string, string> = {
    sr_no: String(index),
    full_name: emp.name ?? "",
    designation: emp.designation ?? "",
    department: emp.department ?? "",
    join_date: formatDate(emp.join_date),
    leaving_date: formatDate(emp.leaving_date),

    personal_phone: emp.personal_phone ?? "",
    work_phone: emp.work_phone ?? "",

    personal_email: emp.personal_email ?? "",
    work_email: emp.work_email ?? "",

    date_of_birth: formatDate(emp.date_of_birth),

    aadhar_number: emp.aadhar_no ?? "",
    pan_number: emp.pan_no ?? "",
    pf_number: emp.pf_no ?? "",
    ip_number: emp.ip_no ?? "",

    status: emp.is_active ? "Active" : "Inactive",
  };

  return visibleColumns.reduce<Record<string, string>>((row, col) => {
    row[col] = columnMap[col] ?? "";
    return row;
  }, {});
}

// ─── Excel export ─────────────────────────────────────────────────────────────

export function exportToExcel(
  employees: Employee[],
  visibleColumns: string[],
  filename = "employees"
): void {
  const headers = visibleColumns.map((c) => COLUMN_LABELS[c] ?? c);

  const rows = employees.map((emp, i) => {
    const rowObj = buildRow(emp, visibleColumns, i + 1);
    return visibleColumns.map((c) => rowObj[c]);
  });

  const worksheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Auto-width: measure longest value per column
  const colWidths = headers.map((h, colIdx) => {
    const values = [h, ...rows.map((r) => r[colIdx] ?? "")];
    const max = Math.max(...values.map((v) => String(v).length));
    return { wch: Math.min(Math.max(max + 2, 10), 40) };
  });
  worksheet["!cols"] = colWidths;

  // Style header row bold (requires xlsx-style or just leave plain for xlsx)
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filename}_${dateStr}.xlsx`);
}

// ─── PDF export ──────────────────────────────────────────────────────────────

export function exportToPDF(
  employees: Employee[],
  visibleColumns: string[],
  filterLabel = "All Employees",
  filename = "employees"
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // ── Header bar ──
  doc.setFillColor(34, 93, 184); // --brand-blue
  doc.rect(0, 0, 297, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Prabhsol Employee Management System", 10, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Exported on ${dateStr}  ·  Filter: ${filterLabel}  ·  ${employees.length} record(s)`, 10, 17.5);

  // ── Table ──
  const headers = visibleColumns.map((c) => COLUMN_LABELS[c] ?? c);
  const rows = employees.map((emp, i) => {
    const rowObj = buildRow(emp, visibleColumns, i + 1);
    return visibleColumns.map((c) => rowObj[c]);
  });

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 22,
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
      textColor: [26, 26, 46], // --text-primary
    },
    headStyles: {
      fillColor: [238, 243, 252], // --brand-blue-light
      textColor: [34, 93, 184],   // --brand-blue
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 249, 251], // --bg-base
    },
    columnStyles: {
      // Sr. No column always narrow
      0: { cellWidth: visibleColumns[0] === "sr_no" ? 12 : "auto" },
    },
    didDrawPage: (data) => {
      // Footer with page number
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(142, 151, 168); // --text-muted
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        297 - 10,
        doc.internal.pageSize.height - 5,
        { align: "right" }
      );
    },
    margin: { top: 22, left: 10, right: 10, bottom: 10 },
  });

  const dateSuffix = new Date().toISOString().slice(0, 10);
  doc.save(`${filename}_${dateSuffix}.pdf`);
}