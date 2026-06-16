"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import AppShell from "@/components/layout/AppShell";
import { fetchPayroll, markPaid, PayrollItem } from "@/services/api/payroll";
import { fetchEmployees, Employee } from "@/services/api/employees";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import styles from "../payroll/payroll.module.css";

// ── Detail card field config ───────────────────────────────────────────────
const DETAIL_FIELDS: { key: keyof PayrollItem; label: string }[] = [
  { key: "employee_name", label: "Employee" },
  { key: "designation",   label: "Designation" },
  { key: "month",         label: "Month" },
  { key: "year",          label: "Year" },
  { key: "gross_salary",  label: "Gross Salary" },
  { key: "total_deductions", label: "Deductions" },
  { key: "net_salary",    label: "Net Salary" },
  { key: "total_ctc",     label: "Total CTC" },
  { key: "days_present",  label: "Days Present" },
  { key: "days_absent",   label: "Days Absent" },
  { key: "leaves_taken",  label: "Leaves Taken" },
  { key: "status",        label: "Status" },
  { key: "calculated_at", label: "Calculated At" },
  { key: "paid_at",       label: "Paid At" },
];

type ColKey = "employee_name" | "designation" | "month_year" | "gross_salary" | "total_deductions" | "net_salary" | "total_ctc" | "days_present" | "days_absent" | "leaves_taken" | "status" | "calculated_at" | "paid_at";

const ALL_COLS: { key: ColKey; label: string; sortKey?: string }[] = [
  { key: "employee_name",    label: "Name",            sortKey: "employee_name" },
  { key: "designation",      label: "Designation" },
  { key: "month_year",       label: "Month / Year" },
  { key: "gross_salary",     label: "Gross Salary",    sortKey: "gross_salary" },
  { key: "total_deductions", label: "Deductions" },
  { key: "net_salary",       label: "Net Salary",      sortKey: "net_salary" },
  { key: "total_ctc",        label: "Total CTC" },
  { key: "days_present",     label: "Days Present" },
  { key: "days_absent",      label: "Days Absent" },
  { key: "leaves_taken",     label: "Leaves Taken" },
  { key: "status",           label: "Status",          sortKey: "status" },
  { key: "calculated_at",    label: "Calculated At" },
  { key: "paid_at",          label: "Paid At" },
];

const DEFAULT_COLS: ColKey[] = ["employee_name", "designation", "net_salary", "status"];

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string }> = {
    pending:    { bg: "#fef9c3", color: "#854d0e" },
    calculated: { bg: "#eef3fc", color: "#225db8" },
    paid:       { bg: "#e6f7ee", color: "#1a7c4a" },
  };
  const s = map[status] ?? { bg: "#f5f5f5", color: "#6b7280" };
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 500, background: s.bg, color: s.color }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function fmt(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return String(val);
}

function fmtMoney(val: string | null | undefined): string {
  if (!val) return "—";
  return "₹" + Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function fmtDt(val: string | null | undefined): string {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return val; }
}

function getCellDisplay(item: PayrollItem, key: ColKey): React.ReactNode {
  if (key === "month_year") return `${MONTH_NAMES[item.month - 1]} ${item.year}`;
  if (key === "status") return statusBadge(item.status);
  if (key === "gross_salary" || key === "net_salary" || key === "total_ctc" || key === "total_deductions") return fmtMoney(item[key as keyof PayrollItem] as string);
  if (key === "calculated_at" || key === "paid_at") return fmtDt(item[key as keyof PayrollItem] as string);
  return fmt(item[key as keyof PayrollItem] as string | number | null);
}

function getCellText(item: PayrollItem, key: ColKey): string {
  if (key === "month_year") return `${MONTH_NAMES[item.month - 1]} ${item.year}`;
  if (key === "status") return item.status;
  if (key === "gross_salary" || key === "net_salary" || key === "total_ctc" || key === "total_deductions") return fmtMoney(item[key as keyof PayrollItem] as string);
  if (key === "calculated_at" || key === "paid_at") return fmtDt(item[key as keyof PayrollItem] as string);
  return fmt(item[key as keyof PayrollItem] as string | number | null);
}

export default function PayrollPage() {
  useRoleGuard(["admin", "manager"], "/attendance");

  const now = new Date();
  const [view, setView] = useState<"current" | "historical">("current");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [histYear, setHistYear] = useState(now.getFullYear());
  const [histMonth, setHistMonth] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [empFilter, setEmpFilter] = useState<string[]>([]);
  const [empList, setEmpList] = useState<Employee[]>([]);
  const [empPickerOpen, setEmpPickerOpen] = useState(false);
  const empPickerRef = useRef<HTMLDivElement>(null);

  const [items, setItems] = useState<PayrollItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [visibleCols, setVisibleCols] = useState<ColKey[]>(DEFAULT_COLS);
  const [colsOpen, setColsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);

  const [sortBy, setSortBy] = useState("employee_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [selectedItem, setSelectedItem] = useState<PayrollItem | null>(null);
  const [confirmItem, setConfirmItem] = useState<PayrollItem | null>(null);
  const [marking, setMarking] = useState(false);

  // Load employees for filter
  useEffect(() => {
    fetchEmployees({ status: "current", page: 1, page_size: 200 })
      .then(d => setEmpList(d.items))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = view === "current"
        ? { year, month, status: statusFilter, employee_id: empFilter, sort_by: sortBy, sort_dir: sortDir, page, page_size: pageSize }
        : { year: histYear, month: histMonth || undefined, status: statusFilter, employee_id: empFilter, sort_by: sortBy, sort_dir: sortDir, page, page_size: pageSize };
      const data = await fetchPayroll(params);
      setItems(data.items);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load payroll");
    } finally {
      setLoading(false);
    }
  }, [view, year, month, histYear, histMonth, statusFilter, empFilter, sortBy, sortDir, page]);

  useEffect(() => { load(); }, [load]);

  // Outside click handlers
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
      if (colsRef.current && !colsRef.current.contains(e.target as Node)) setColsOpen(false);
      if (empPickerRef.current && !empPickerRef.current.contains(e.target as Node)) setEmpPickerOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function handleSort(key: ColKey) {
    const col = ALL_COLS.find(c => c.key === key);
    if (!col?.sortKey) return;
    if (sortBy === col.sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col.sortKey); setSortDir("asc"); }
    setPage(1);
  }

  function toggleCol(key: ColKey) {
    if (key === "employee_name") return;
    setVisibleCols(c => c.includes(key) ? c.filter(x => x !== key) : [...c, key]);
  }

  async function handleMarkPaid(item: PayrollItem) {
    setMarking(true);
    try {
      const updated = await markPaid(item.id);
      setConfirmItem(null);
      if (selectedItem?.id === item.id) setSelectedItem(updated);
      load();
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setMarking(false);
    }
  }

  async function handleExport(format: "excel" | "pdf") {
    setExportOpen(false);
    setExporting(true);
    try {
      const params = view === "current"
        ? { year, month, status: statusFilter, employee_id: empFilter, sort_by: sortBy, sort_dir: sortDir, page: 1, page_size: 200 }
        : { year: histYear, month: histMonth || undefined, status: statusFilter, employee_id: empFilter, sort_by: sortBy, sort_dir: sortDir, page: 1, page_size: 200 };
      const all = await fetchPayroll(params);
      const colDefs = ALL_COLS.filter(c => visibleCols.includes(c.key));
      const headers = colDefs.map(c => c.label);
      const rows = all.items.map(item => colDefs.map(col => getCellText(item, col.key)));
      const dateSuffix = new Date().toISOString().slice(0, 10);
      if (format === "excel") {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        ws["!cols"] = headers.map((h, ci) => ({ wch: Math.min(Math.max(h.length, ...rows.map(r => (r[ci] ?? "").length)) + 2, 40) }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Payroll");
        XLSX.writeFile(wb, `payroll_${dateSuffix}.xlsx`);
      } else {
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const exportDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        doc.setFillColor(34, 93, 184);
        doc.rect(0, 0, 297, 18, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Prabhsol Employee Management System — Payroll", 10, 11);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Exported ${exportDate}  ·  ${all.items.length} record(s)`, 10, 17);
        autoTable(doc, {
          head: [headers], body: rows, startY: 22,
          styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak", textColor: [26, 26, 46] },
          headStyles: { fillColor: [238, 243, 252], textColor: [34, 93, 184], fontStyle: "bold", fontSize: 8 },
          alternateRowStyles: { fillColor: [248, 249, 251] },
          didDrawPage: (data) => {
            const pageCount = (doc as any).internal.getNumberOfPages();
            doc.setFontSize(7); doc.setTextColor(142, 151, 168);
            doc.text(`Page ${data.pageNumber} of ${pageCount}`, 287, doc.internal.pageSize.height - 5, { align: "right" });
          },
          margin: { top: 22, left: 10, right: 10, bottom: 10 },
        });
        doc.save(`payroll_${dateSuffix}.pdf`);
      }
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
  }

  const activeCols = ALL_COLS.filter(c => visibleCols.includes(c.key));
  const totalPages = Math.ceil(total / pageSize);
  const selectedEmpNames = empFilter.map(id => empList.find(e => e.id === id)?.name ?? id);

  return (
    <AppShell>
      <div className={styles.page}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <div className={styles.left} style={{ flexWrap: "wrap", gap: 10 }}>
            <h1 className={styles.title}>Payroll</h1>
            {/* View toggle */}
            <div className={styles.radioGroup}>
              {(["current", "historical"] as const).map(v => (
                <label key={v} className={`${styles.radioLabel} ${view === v ? styles.radioActive : ""}`}>
                  <input type="radio" name="view" value={v} checked={view === v}
                    onChange={() => { setView(v); setPage(1); }} className={styles.radioInput} />
                  {v === "current" ? "Current Month" : "Historical"}
                </label>
              ))}
            </div>
            {/* Date pickers */}
            {view === "current" ? (
              <input type="month" style={{ height: 36, width: 100, padding: "0 10px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", fontSize: 13, fontFamily: "inherit", color: "var(--text-primary)", background: "var(--bg-card)", outline: "none" }}
                value={`${year}-${String(month).padStart(2, "0")}`}
                max={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`}
                onChange={e => { const [y, m] = e.target.value.split("-").map(Number); setYear(y); setMonth(m); setPage(1); }}
              />
            ) : (
              <>
                <select style={{ height: 36, padding: "0 10px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", fontSize: 13, fontFamily: "inherit", color: "var(--text-primary)", background: "var(--bg-card)" }}
                  value={histYear} onChange={e => { setHistYear(Number(e.target.value)); setPage(1); }}>
                  {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select style={{ height: 36, padding: "0 10px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", fontSize: 13, fontFamily: "inherit", color: "var(--text-primary)", background: "var(--bg-card)" }}
                  value={histMonth} onChange={e => { setHistMonth(e.target.value === "" ? "" : Number(e.target.value)); setPage(1); }}>
                  <option value="">All months</option>
                  {MONTH_NAMES.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
                </select>
              </>
            )}
            {/* Status filter */}
            <div className={styles.radioGroup}>
              {(["all", "pending", "calculated", "paid"] as const).map(s => (
                <label key={s} className={`${styles.radioLabel} ${statusFilter === s ? styles.radioActive : ""}`}>
                  <input type="radio" name="statusFilter" value={s} checked={statusFilter === s}
                    onChange={() => { setStatusFilter(s); setPage(1); }} className={styles.radioInput} />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </label>
              ))}
            </div>
          </div>
          <div className={styles.right}>
            {/* Employee filter */}
            <div className={styles.filterWrap} ref={empPickerRef}>
              <button className={styles.btnSecondary} onClick={() => setEmpPickerOpen(o => !o)}>
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5"/><path d="M2 15.5c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                {empFilter.length > 0 ? `${empFilter.length} selected` : "All employees"}
              </button>
              {empPickerOpen && (
                <div className={styles.filterDropdown} style={{ maxHeight: 280, overflowY: "auto" }}>
                  <p className={styles.filterHeading}>Filter by employee</p>
                  {empFilter.length > 0 && (
                    <button className={styles.filterRow} style={{ color: "var(--brand-blue)", fontWeight: 500, border: "none", background: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
                      onClick={() => { setEmpFilter([]); setPage(1); }}>Clear selection</button>
                  )}
                  {empList.map(emp => (
                    <label key={emp.id} className={styles.filterRow}>
                      <input type="checkbox" checked={empFilter.includes(emp.id)}
                        onChange={() => { setEmpFilter(f => f.includes(emp.id) ? f.filter(x => x !== emp.id) : [...f, emp.id]); setPage(1); }} />
                      {emp.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            {/* Export */}
            <div className={styles.filterWrap} ref={exportRef}>
              <button className={styles.btnSecondary} onClick={() => setExportOpen(o => !o)} disabled={exporting}>
                {exporting ? <span className={styles.exportSpinner} /> : (
                  <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M7.5 1v8m0 0L5 6.5M7.5 9l2.5-2.5M2 13h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
                Export
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-muted)", transition: "transform 0.15s", transform: exportOpen ? "rotate(180deg)" : "none" }}>
                  <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
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
            {/* Columns */}
            <div className={styles.filterWrap} ref={colsRef}>
              <button className={styles.btnSecondary} onClick={() => setColsOpen(o => !o)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
                Columns
              </button>
              {colsOpen && (
                <div className={styles.filterDropdown}>
                  <p className={styles.filterHeading}>Toggle columns</p>
                  {ALL_COLS.filter(c => c.key !== "employee_name").map(col => (
                    <label key={col.key} className={styles.filterRow}>
                      <input type="checkbox" checked={visibleCols.includes(col.key)} onChange={() => toggleCol(col.key)} />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main area: table + detail card */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {/* Table */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.tableWrap}>
              {error && <div className={styles.errorBanner}>{error}</div>}
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th} style={{ width: 36 }}>Sr.</th>
                    {activeCols.map(col => {
                      const sortable = !!col.sortKey;
                      const active = sortable && sortBy === col.sortKey;
                      return (
                        <th key={col.key} className={`${styles.th} ${sortable ? styles.thSortable : ""}`} onClick={() => handleSort(col.key)}>
                          {col.label}
                          {active && <span className={styles.sortIcon}>{sortDir === "asc" ? " ↑" : " ↓"}</span>}
                          {sortable && !active && <span className={styles.sortIconInactive}> ↕</span>}
                        </th>
                      );
                    })}
                    <th className={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={activeCols.length + 2} className={styles.loadingCell}>Loading…</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={activeCols.length + 2} className={styles.emptyCell}>No payroll records found.</td></tr>
                  ) : items.map((item, i) => (
                    <tr key={item.id} className={styles.tr}
                      style={{ cursor: "pointer", background: selectedItem?.id === item.id ? "var(--brand-blue-light)" : undefined }}
                      onClick={() => setSelectedItem(s => s?.id === item.id ? null : item)}>
                      <td className={styles.td} style={{ color: "var(--text-muted)", fontSize: 12 }}>{(page - 1) * pageSize + i + 1}</td>
                      {activeCols.map(col => (
                        <td key={col.key} className={styles.td}>{getCellDisplay(item, col.key)}</td>
                      ))}
                      <td className={styles.td} onClick={e => e.stopPropagation()}>
                        {(item.status === "pending" || item.status === "calculated") && (
                          <button className={styles.actionBtnApprove} onClick={() => setConfirmItem(item)}>
                            Mark Paid
                          </button>
                        )}
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
          {selectedItem && (
            <div style={{ width: 300, flexShrink: 0, background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
              <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{selectedItem.employee_name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{selectedItem.designation ?? "—"}</div>
                </div>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 15, padding: "2px 6px" }} onClick={() => setSelectedItem(null)}>✕</button>
              </div>
              <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 300px)" }}>
                {DETAIL_FIELDS.map(f => {
                  let val: React.ReactNode = "—";
                  const raw = selectedItem[f.key];
                  if (f.key === "status") val = statusBadge(selectedItem.status);
                  else if (f.key === "gross_salary" || f.key === "net_salary" || f.key === "total_ctc" || f.key === "total_deductions") val = fmtMoney(raw as string);
                  else if (f.key === "calculated_at" || f.key === "paid_at") val = fmtDt(raw as string);
                  else if (raw !== null && raw !== undefined) val = String(raw);
                  return (
                    <div key={f.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 18px", borderBottom: "1px solid var(--border-default)" }}>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{f.label}</span>
                      <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, textAlign: "right" }}>{val}</span>
                    </div>
                  );
                })}
              </div>
              {(selectedItem.status === "pending" || selectedItem.status === "calculated") && (
                <div style={{ padding: 16, borderTop: "1px solid var(--border-default)" }}>
                  <button className={styles.btnPrimary} style={{ width: "100%", background: "#1a7c4a" }} onClick={() => setConfirmItem(selectedItem)}>
                    Mark as Paid
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirm modal */}
      {confirmItem && (
        <div className={styles.modalOverlay} onClick={() => setConfirmItem(null)}>
          <div className={styles.modal} style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Confirm Payment</h2>
              <button className={styles.modalClose} onClick={() => setConfirmItem(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Mark salary for <strong style={{ color: "var(--text-primary)" }}>{confirmItem.employee_name}</strong> ({MONTH_NAMES[confirmItem.month - 1]} {confirmItem.year}) as <strong style={{ color: "#1a7c4a" }}>paid</strong>?
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setConfirmItem(null)}>Cancel</button>
              <button className={styles.btnPrimary} style={{ background: "#1a7c4a" }} onClick={() => handleMarkPaid(confirmItem)} disabled={marking}>
                {marking ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}