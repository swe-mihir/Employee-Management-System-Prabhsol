"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import AppShell from "@/components/layout/AppShell";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import {
  fetchPayroll, createPayrollRecord, updatePayrollRecord,
  calculatePayroll, markPayrollPaid,
  PayrollRecord, PayrollCreate, PayrollUpdate,
} from "@/services/api/payroll";
import { fetchEmployees, Employee } from "@/services/api/employees";
import { getSalaryStructure } from "@/services/api/salaryStructure";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import styles from "./payroll.module.css";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Detail card field config ──────────────────────────────────────────────

type CardSection = { title: string; fields: { key: keyof PayrollRecord; label: string; editable?: boolean }[] };

const CARD_SECTIONS: CardSection[] = [
  { title: "Employee", fields: [
    { key: "employee_name", label: "Name" },
    { key: "designation", label: "Designation" },
    { key: "month", label: "Month" },
    { key: "year", label: "Year" },
  ]},
  { title: "Allowances (Structure)", fields: [] }, // rendered separately from salary structure
  { title: "Attendance", fields: [
    { key: "days_present", label: "Days Present" },
    { key: "days_absent", label: "Days Absent" },
    { key: "leaves_taken", label: "Leaves Taken" },
  ]},
  { title: "Variable Inputs", fields: [
    { key: "ot_hours", label: "OT Hours", editable: true },
    { key: "advance", label: "Advance", editable: true },
    { key: "loan", label: "Loan", editable: true },
    { key: "tds", label: "TDS", editable: true },
    { key: "employee_mlwf", label: "Employee MLWF", editable: true },
    { key: "employer_mlwf", label: "Employer MLWF", editable: true },
    { key: "incentive", label: "Incentive", editable: true },
  ]},
  { title: "Earnings", fields: [
    { key: "ern_basic", label: "ERN Basic" },
    { key: "ern_hra", label: "ERN HRA" },
    { key: "ern_conveyance", label: "ERN Conveyance" },
    { key: "ern_medical", label: "ERN Medical" },
    { key: "ot_amount", label: "OT Amount" },
    { key: "gross_salary", label: "Gross Salary" },
  ]},
  { title: "Deductions", fields: [
    { key: "emp_pf", label: "Employee PF" },
    { key: "emp_esic", label: "Employee ESIC" },
    { key: "pt", label: "PT" },
    { key: "total_deductions", label: "Total Deductions" },
    { key: "net_salary", label: "Net Salary" },
  ]},
  { title: "Employer Contributions", fields: [
    { key: "employer_pf", label: "Employer PF" },
    { key: "employer_admin", label: "Employer Admin" },
    { key: "employer_total_pf", label: "Employer Total PF" },
    { key: "emp_employer_pf", label: "Emp+Employer PF" },
    { key: "employer_esic", label: "Employer ESIC" },
    { key: "emp_employer_esic", label: "Emp+Employer ESIC" },
    { key: "emp_employer_mlwf", label: "Emp+Employer MLWF" },
    { key: "total_ctc", label: "Total CTC" },
  ]},
  { title: "Status", fields: [
    { key: "status", label: "Status" },
    { key: "calculated_at", label: "Calculated At" },
    { key: "paid_at", label: "Paid At" },
  ]},
];

// ── Column definitions ────────────────────────────────────────────────────

type ColKey = "sr" | "employee_name" | "designation" | "month" | "year" | "net_salary" | "gross_salary" | "total_ctc" | "status" | "days_present" | "days_absent";

const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "sr", label: "Sr." },
  { key: "employee_name", label: "Name" },
  { key: "designation", label: "Designation" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "net_salary", label: "Net Salary" },
  { key: "gross_salary", label: "Gross Salary" },
  { key: "total_ctc", label: "Total CTC" },
  { key: "days_present", label: "Days Present" },
  { key: "days_absent", label: "Days Absent" },
  { key: "status", label: "Status" },
];

const DEFAULT_COLS_CURRENT: ColKey[] = ["sr", "employee_name", "designation", "net_salary", "status"];
const DEFAULT_COLS_HISTORICAL: ColKey[] = ["sr", "employee_name", "designation", "month", "year", "net_salary", "status"];

// ── Helpers ───────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return Number(v).toFixed(2);
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return s; }
}

function getCellValue(r: PayrollRecord, key: ColKey, i: number, page: number, pageSize: number): string {
  if (key === "sr") return String((page - 1) * pageSize + i + 1);
  if (key === "employee_name") return r.employee_name;
  if (key === "designation") return r.designation || "—";
  if (key === "month") return MONTH_NAMES[(r.month - 1)] || String(r.month);
  if (key === "year") return String(r.year);
  if (key === "net_salary") return r.net_salary != null ? fmt(r.net_salary) : "—";
  if (key === "gross_salary") return r.gross_salary != null ? fmt(r.gross_salary) : "—";
  if (key === "total_ctc") return r.total_ctc != null ? fmt(r.total_ctc) : "—";
  if (key === "days_present") return String(r.days_present);
  if (key === "days_absent") return String(r.days_absent);
  if (key === "status") return r.status;
  return "—";
}

function statusBadgeClass(s: string) {
  if (s === "paid") return styles.badgePaid;
  if (s === "calculated") return styles.badgeCalculated;
  return styles.badgePending;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function PayrollPage() {
  useRoleGuard(["admin", "manager"], "/attendance");

  const now = new Date();
  const [viewMode, setViewMode] = useState<"current" | "historical">("current");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [histYear, setHistYear] = useState(now.getFullYear());
  const [histMonth, setHistMonth] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [empDropOpen, setEmpDropOpen] = useState(false);
  const [activeEmployees, setActiveEmployees] = useState<Employee[]>([]);

  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [visibleCols, setVisibleCols] = useState<ColKey[]>(DEFAULT_COLS_CURRENT);
  const [colDropOpen, setColDropOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
  const [editedInputs, setEditedInputs] = useState<PayrollUpdate>({});
  const [savingInputs, setSavingInputs] = useState(false);

  // Modals
  const [confirmCalc, setConfirmCalc] = useState<PayrollRecord | null>(null);
  const [confirmPay, setConfirmPay] = useState<PayrollRecord | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<PayrollCreate & { basic_allowance?: string; hra_allowance?: string; conveyance_allowance?: string; medical_allowance?: string }>({
    employee_id: "", month: now.getMonth() + 1, year: now.getFullYear(),
    ot_hours: 0, advance: 0, loan: 0, tds: 0, employee_mlwf: 0, employer_mlwf: 0, incentive: 0,
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const exportRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const empDropRef = useRef<HTMLDivElement>(null);

  // Load active employees for filters/add modal
  useEffect(() => {
    fetchEmployees({ status: "current", page: 1, page_size: 200 })
      .then(d => setActiveEmployees(d.items))
      .catch(() => {});
  }, []);

  // Load salary structure when employee selected in add modal
  useEffect(() => {
    if (!addForm.employee_id) return;
    getSalaryStructure(addForm.employee_id).then(s => {
      setAddForm(f => ({
        ...f,
        basic_allowance: String(s.basic_allowance),
        hra_allowance: String(s.hra_allowance),
        conveyance_allowance: String(s.conveyance_allowance),
        medical_allowance: String(s.medical_allowance),
      }));
    }).catch(() => {
      setAddForm(f => ({ ...f, basic_allowance: "", hra_allowance: "", conveyance_allowance: "", medical_allowance: "" }));
    });
  }, [addForm.employee_id]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
      if (colRef.current && !colRef.current.contains(e.target as Node)) setColDropOpen(false);
      if (empDropRef.current && !empDropRef.current.contains(e.target as Node)) setEmpDropOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Update visible cols when view mode changes
  useEffect(() => {
    setVisibleCols(viewMode === "current" ? DEFAULT_COLS_CURRENT : DEFAULT_COLS_HISTORICAL);
  }, [viewMode]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof fetchPayroll>[0] = {
        status: statusFilter,
        employee_ids: selectedEmpIds.length ? selectedEmpIds : undefined,
        sort_by: "year",
        sort_dir: "desc",
        page,
        page_size: pageSize,
      };
      if (viewMode === "current") {
        params.month = month;
        params.year = year;
        params.historical = false;
      } else {
        params.historical = true;
        params.year = histYear;
        if (histMonth) params.month = histMonth;
      }
      const data = await fetchPayroll(params);
      setRecords(data.items);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load payroll");
    } finally {
      setLoading(false);
    }
  }, [viewMode, month, year, histYear, histMonth, statusFilter, selectedEmpIds, page]);

  useEffect(() => { load(); }, [load]);

  // When a record is selected, sync editable inputs
  useEffect(() => {
    if (!selectedRecord) return;
    setEditedInputs({
      ot_hours: selectedRecord.ot_hours,
      advance: selectedRecord.advance,
      loan: selectedRecord.loan,
      tds: selectedRecord.tds,
      employee_mlwf: selectedRecord.employee_mlwf,
      employer_mlwf: selectedRecord.employer_mlwf,
      incentive: selectedRecord.incentive,
    });
  }, [selectedRecord?.id]);

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleSaveInputs() {
    if (!selectedRecord) return;
    setSavingInputs(true);
    try {
      const updated = await updatePayrollRecord(selectedRecord.id, editedInputs);
      setSelectedRecord(updated);
      setRecords(rs => rs.map(r => r.id === updated.id ? updated : r));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingInputs(false);
    }
  }

  async function handleCalculate() {
    if (!confirmCalc) return;
    setCalcLoading(true);
    try {
      const updated = await calculatePayroll(confirmCalc.id);
      setRecords(rs => rs.map(r => r.id === updated.id ? updated : r));
      if (selectedRecord?.id === updated.id) setSelectedRecord(updated);
      setConfirmCalc(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Calculate failed");
      setConfirmCalc(null);
    } finally {
      setCalcLoading(false);
    }
  }

  async function handleMarkPaid() {
    if (!confirmPay) return;
    setPayLoading(true);
    try {
      const updated = await markPayrollPaid(confirmPay.id);
      setRecords(rs => rs.map(r => r.id === updated.id ? updated : r));
      if (selectedRecord?.id === updated.id) setSelectedRecord(updated);
      setConfirmPay(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Mark paid failed");
      setConfirmPay(null);
    } finally {
      setPayLoading(false);
    }
  }

  async function handleAdd() {
    if (!addForm.employee_id) { setAddError("Select an employee."); return; }
    setAddSaving(true);
    setAddError(null);
    try {
      const payload: PayrollCreate = {
        employee_id: addForm.employee_id,
        month: addForm.month,
        year: addForm.year,
        ot_hours: Number(addForm.ot_hours) || 0,
        advance: Number(addForm.advance) || 0,
        loan: Number(addForm.loan) || 0,
        tds: Number(addForm.tds) || 0,
        employee_mlwf: Number(addForm.employee_mlwf) || 0,
        employer_mlwf: Number(addForm.employer_mlwf) || 0,
        incentive: Number(addForm.incentive) || 0,
      };
      await createPayrollRecord(payload);
      setAddOpen(false);
      load();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAddSaving(false);
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async function handleExport(format: "excel" | "pdf") {
    setExportOpen(false);
    setExporting(true);
    try {
      const all = await fetchPayroll({
        month: viewMode === "current" ? month : histMonth,
        year: viewMode === "current" ? year : histYear,
        historical: viewMode === "historical",
        status: statusFilter,
        page: 1, page_size: 200,
      });
      const colDefs = ALL_COLS.filter(c => visibleCols.includes(c.key));
      const headers = colDefs.map(c => c.label);
      const rows = all.items.map((r, i) => colDefs.map(c => getCellValue(r, c.key, i, 1, 200)));
      const dateSuffix = new Date().toISOString().slice(0, 10);

      if (format === "excel") {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        ws["!cols"] = headers.map((h, ci) => ({ wch: Math.min(Math.max(h.length, ...rows.map(r => (r[ci] ?? "").length)) + 2, 35) }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Payroll");
        XLSX.writeFile(wb, `payroll_${dateSuffix}.xlsx`);
      } else {
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        doc.setFillColor(34, 93, 184);
        doc.rect(0, 0, 297, 18, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.text("Prabhsol EMS — Payroll", 10, 11);
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        doc.text(`Exported ${dateSuffix}  ·  ${all.items.length} record(s)`, 10, 17);
        autoTable(doc, {
          head: [headers], body: rows, startY: 22,
          styles: { fontSize: 8, cellPadding: 2.5, textColor: [26, 26, 46] },
          headStyles: { fillColor: [238, 243, 252], textColor: [34, 93, 184], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [248, 249, 251] },
          margin: { top: 22, left: 10, right: 10, bottom: 10 },
        });
        doc.save(`payroll_${dateSuffix}.pdf`);
      }
    } finally {
      setExporting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const activeCols = ALL_COLS.filter(c => visibleCols.includes(c.key));
  const totalPages = Math.ceil(total / pageSize);
  const canEdit = selectedRecord && (selectedRecord.status === "pending" || selectedRecord.status === "calculated");
  const alreadyAdded = new Set(records.map(r => `${r.employee_id}-${month}-${year}`));

  return (
    <AppShell>
      <div className={styles.page}>

        {/* Top bar */}
        <div className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <h1 className={styles.title}>Payroll</h1>

            <div className={styles.tabs}>
              <button className={`${styles.tab} ${viewMode === "current" ? styles.tabActive : ""}`} onClick={() => { setViewMode("current"); setPage(1); }}>Current Month</button>
              <button className={`${styles.tab} ${viewMode === "historical" ? styles.tabActive : ""}`} onClick={() => { setViewMode("historical"); setPage(1); }}>Historical</button>
            </div>

            {viewMode === "current" ? (
              <input type="month" className={styles.datePicker}
                value={`${year}-${String(month).padStart(2, "0")}`}
                onChange={e => { const [y, m] = e.target.value.split("-").map(Number); setYear(y); setMonth(m); setPage(1); }}
              />
            ) : (
              <>
                <input type="number" className={styles.yearPicker} style={{ width: 80 }}
                  value={histYear} min={2020} max={now.getFullYear()}
                  onChange={e => { setHistYear(Number(e.target.value)); setPage(1); }}
                />
                <select className={styles.monthFilterPicker}
                  value={histMonth ?? ""}
                  onChange={e => { setHistMonth(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
                >
                  <option value="">All months</option>
                  {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </>
            )}

            <div className={styles.radioGroup}>
              {["all", "pending", "calculated", "paid"].map(opt => (
                <label key={opt} className={`${styles.radioLabel} ${statusFilter === opt ? styles.radioActive : ""}`}>
                  <input type="radio" name="statusFilter" value={opt} checked={statusFilter === opt} onChange={() => { setStatusFilter(opt); setPage(1); }} className={styles.radioInput} />
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </label>
              ))}
            </div>

            {/* Employee multi-select */}
            <div className={styles.empMultiSelect} ref={empDropRef}>
              <button className={styles.empMultiBtn} onClick={() => setEmpDropOpen(o => !o)}>
                {selectedEmpIds.length ? `${selectedEmpIds.length} emp.` : "All employees"}
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-muted)" }}>
                  <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {empDropOpen && (
                <div className={styles.empMultiDropdown}>
                  <label className={styles.filterRow}>
                    <input type="checkbox" checked={selectedEmpIds.length === 0} onChange={() => setSelectedEmpIds([])} /> All employees
                  </label>
                  {activeEmployees.map(e => (
                    <label key={e.id} className={styles.filterRow}>
                      <input type="checkbox" checked={selectedEmpIds.includes(e.id)}
                        onChange={() => setSelectedEmpIds(ids => ids.includes(e.id) ? ids.filter(x => x !== e.id) : [...ids, e.id])}
                      />
                      {e.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={styles.topBarRight}>
            <button className={styles.btnPrimary} onClick={() => { setAddError(null); setAddForm({ employee_id: "", month, year, ot_hours: 0, advance: 0, loan: 0, tds: 0, employee_mlwf: 0, employer_mlwf: 0, incentive: 0 }); setAddOpen(true); }}>
              + Add to Payroll
            </button>

            {/* Export */}
            <div className={styles.filterWrap} ref={exportRef}>
              <button className={styles.btnSecondary} onClick={() => setExportOpen(o => !o)} disabled={exporting}>
                {exporting ? <span className={styles.exportSpinner} /> : (
                  <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M7.5 1v8m0 0L5 6.5M7.5 9l2.5-2.5M2 13h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
                Export
              </button>
              {exportOpen && (
                <div className={styles.filterDropdown} style={{ minWidth: 160 }}>
                  <p className={styles.filterHeading}>Download as</p>
                  <button className={styles.exportItem} onClick={() => handleExport("excel")}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="2" fill="#1D6F42"/><path d="M4 5l2.5 3L4 11h1.5l1.75-2.2L9 11h1.5L8 8l2.5-3H9L7.25 7.2 5.5 5H4z" fill="white"/></svg>
                    Excel (.xlsx)
                  </button>
                  <button className={styles.exportItem} onClick={() => handleExport("pdf")}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="2" fill="#E53935"/><text x="2.5" y="11" fontSize="6.5" fontWeight="bold" fill="white" fontFamily="helvetica">PDF</text></svg>
                    PDF (.pdf)
                  </button>
                </div>
              )}
            </div>

            {/* Columns toggle */}
            <div className={styles.filterWrap} ref={colRef}>
              <button className={styles.btnSecondary} onClick={() => setColDropOpen(o => !o)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
                </svg>
                Columns
              </button>
              {colDropOpen && (
                <div className={styles.filterDropdown}>
                  <p className={styles.filterHeading}>Toggle columns</p>
                  {ALL_COLS.filter(c => c.key !== "sr" && c.key !== "employee_name").map(col => (
                    <label key={col.key} className={styles.filterRow}>
                      <input type="checkbox" checked={visibleCols.includes(col.key)}
                        onChange={() => setVisibleCols(cols => cols.includes(col.key) ? cols.filter(c => c !== col.key) : [...cols, col.key])}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* Main area: table + detail card */}
        <div className={styles.mainArea}>
          <div className={styles.tableArea}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {activeCols.map(col => <th key={col.key} className={styles.th}>{col.label}</th>)}
                    <th className={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={activeCols.length + 1} className={styles.loadingCell}>Loading…</td></tr>
                  ) : records.length === 0 ? (
                    <tr><td colSpan={activeCols.length + 1} className={styles.emptyCell}>No records found.</td></tr>
                  ) : records.map((r, i) => (
                    <tr key={r.id}
                      className={`${styles.tr} ${selectedRecord?.id === r.id ? styles.trSelected : ""}`}
                      onClick={() => setSelectedRecord(prev => prev?.id === r.id ? null : r)}
                    >
                      {activeCols.map(col => (
                        <td key={col.key} className={styles.td}>
                          {col.key === "status" ? (
                            <span className={`${styles.badge} ${statusBadgeClass(r.status)}`}>{r.status}</span>
                          ) : getCellValue(r, col.key, i, page, pageSize)}
                        </td>
                      ))}
                      <td className={styles.td} onClick={e => e.stopPropagation()}>
                        <div className={styles.actions}>
                          {r.status === "pending" && (
                            <button className={styles.actionBtnCalc} onClick={() => setConfirmCalc(r)}>Calculate</button>
                          )}
                          {(r.status === "pending" || r.status === "calculated") && (
                            <button className={styles.actionBtnPay} onClick={() => setConfirmPay(r)}>Mark Paid</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button className={styles.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span className={styles.pageInfo}>Page {page} of {totalPages} · {total} records</span>
                <button className={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </div>

          {/* Detail card */}
          {selectedRecord && (
            <div className={styles.detailCard}>
              <div className={styles.detailCardHeader}>
                <p className={styles.detailCardName}>{selectedRecord.employee_name}</p>
                <p className={styles.detailCardSub}>{selectedRecord.designation || "—"} · {MONTH_NAMES[selectedRecord.month - 1]} {selectedRecord.year}</p>
              </div>
              <div className={styles.detailCardBody}>
                {CARD_SECTIONS.map(section => (
                  <div key={section.title} className={styles.detailSection}>
                    <p className={styles.detailSectionTitle}>{section.title}</p>
                    {section.fields.map(f => {
                      const isEditable = f.editable && canEdit;
                      const rawVal = selectedRecord[f.key];
                      const displayVal = typeof rawVal === "number" ? fmt(rawVal) : rawVal != null ? String(rawVal) : "—";
                      return (
                        <div key={String(f.key)} className={styles.detailRow}>
                          <span className={styles.detailLabel}>{f.label}</span>
                          {isEditable ? (
                            <input
                              type="number"
                              className={styles.detailInput}
                              value={String(editedInputs[f.key as keyof PayrollUpdate] ?? 0)}
                              onChange={e => setEditedInputs(ei => ({ ...ei, [f.key]: Number(e.target.value) }))}
                            />
                          ) : (
                            <span className={styles.detailValue}>
                              {f.key === "status" ? <span className={`${styles.badge} ${statusBadgeClass(String(rawVal))}`}>{rawVal}</span>
                               : f.key === "calculated_at" || f.key === "paid_at" ? fmtDate(String(rawVal ?? ""))
                               : displayVal}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className={styles.detailCardFooter}>
                {canEdit && (
                  <button className={styles.btnSecondary} onClick={handleSaveInputs} disabled={savingInputs} style={{ flex: 1 }}>
                    {savingInputs ? "Saving…" : "Save Inputs"}
                  </button>
                )}
                {selectedRecord.status === "pending" && (
                  <button className={styles.actionBtnCalc} style={{ height: 36, padding: "0 14px" }} onClick={() => setConfirmCalc(selectedRecord)}>Calculate</button>
                )}
                {(selectedRecord.status === "pending" || selectedRecord.status === "calculated") && (
                  <button className={styles.actionBtnPay} style={{ height: 36, padding: "0 14px" }} onClick={() => setConfirmPay(selectedRecord)}>Mark Paid</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Calculate Confirm Modal ── */}
      {confirmCalc && (
        <div className={styles.modalOverlay} onClick={() => setConfirmCalc(null)}>
          <div className={`${styles.modal} ${styles.modalSm}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Calculate Payroll</h2>
              <button className={styles.modalClose} onClick={() => setConfirmCalc(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                Calculate payroll for <strong style={{ color: "var(--text-primary)" }}>{confirmCalc.employee_name}</strong> for {MONTH_NAMES[confirmCalc.month - 1]} {confirmCalc.year}?
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setConfirmCalc(null)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleCalculate} disabled={calcLoading}>
                {calcLoading ? "Calculating…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mark Paid Confirm Modal ── */}
      {confirmPay && (
        <div className={styles.modalOverlay} onClick={() => setConfirmPay(null)}>
          <div className={`${styles.modal} ${styles.modalSm}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Mark as Paid</h2>
              <button className={styles.modalClose} onClick={() => setConfirmPay(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                Mark salary for <strong style={{ color: "var(--text-primary)" }}>{confirmPay.employee_name}</strong> ({MONTH_NAMES[confirmPay.month - 1]} {confirmPay.year}) as paid?
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setConfirmPay(null)}>Cancel</button>
              <button className={styles.btnPrimary} style={{ background: "#1a7c4a" }} onClick={handleMarkPaid} disabled={payLoading}>
                {payLoading ? "Marking…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add to Payroll Modal ── */}
      {addOpen && (
        <div className={styles.modalOverlay} onClick={() => setAddOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add to Payroll</h2>
              <button className={styles.modalClose} onClick={() => setAddOpen(false)}>✕</button>
            </div>
            {addError && <div className={styles.errorBanner} style={{ margin: "0 24px" }}>{addError}</div>}
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Employee *</label>
                <select className={styles.fieldSelect} value={addForm.employee_id}
                  onChange={e => setAddForm(f => ({ ...f, employee_id: e.target.value }))}>
                  <option value="">— Select employee —</option>
                  {activeEmployees
                    .filter(e => !alreadyAdded.has(`${e.id}-${addForm.month}-${addForm.year}`))
                    .map(e => <option key={e.id} value={e.id}>{e.name}{e.designation ? ` (${e.designation})` : ""}</option>)
                  }
                </select>
              </div>
              <div className={styles.formGrid2}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Month</label>
                  <select className={styles.fieldSelect} value={addForm.month} onChange={e => setAddForm(f => ({ ...f, month: Number(e.target.value) }))}>
                    {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Year</label>
                  <input type="number" className={styles.fieldInput} value={addForm.year} onChange={e => setAddForm(f => ({ ...f, year: Number(e.target.value) }))} />
                </div>
              </div>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", margin: "4px 0 -4px" }}>Allowances (pre-filled from structure if available)</p>
              <div className={styles.formGrid2}>
                {["basic_allowance", "hra_allowance", "conveyance_allowance", "medical_allowance"].map(k => (
                  <div key={k} className={styles.field}>
                    <label className={styles.fieldLabel}>{k.replace("_", " ").replace("allowance", "").trim().charAt(0).toUpperCase() + k.replace("_allowance", "").replace(k.charAt(0), "")}</label>
                    <input type="number" className={styles.fieldInput}
                      value={(addForm as unknown as Record<string, unknown>)[k] as string ?? ""}
                      onChange={e => setAddForm(f => ({ ...f, [k]: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", margin: "4px 0 -4px" }}>Variable Inputs</p>
              <div className={styles.formGrid2}>
                {(["ot_hours", "advance", "loan", "tds", "employee_mlwf", "employer_mlwf", "incentive"] as const).map(k => (
                  <div key={k} className={styles.field}>
                    <label className={styles.fieldLabel}>{k.replace(/_/g, " ")}</label>
                    <input type="number" className={styles.fieldInput}
                      value={(addForm as unknown as Record<string, unknown>)[k] as string ?? ""}
                      onChange={e => setAddForm(f => ({ ...f, [k]: Number(e.target.value) }))}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setAddOpen(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleAdd} disabled={addSaving}>
                {addSaving ? "Saving…" : "Add to Payroll"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}