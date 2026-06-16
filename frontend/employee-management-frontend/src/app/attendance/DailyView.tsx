"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./attendance.module.css";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchDailyAttendance, DailyAttendanceItem } from "@/services/api/attendance";
import { getStoredUser } from "@/lib/tokenStorage";

type AttendanceStatus = "P" | "A" | "SL" | "PL" | "WH";
type DailyRecord = DailyAttendanceItem;

type ColKey = "sr" | "name" | "status" | "clock_in" | "clock_out" | "required_hours" | "hours_worked";

const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "sr",             label: "Sr. No." },
  { key: "name",           label: "Name" },
  { key: "status",         label: "Status" },
  { key: "clock_in",       label: "Clock In" },
  { key: "clock_out",      label: "Clock Out" },
  { key: "required_hours", label: "Required Time" },
  { key: "hours_worked",   label: "Actual Time" },
];

const DEFAULT_COLS: ColKey[] = ["sr", "name", "status", "clock_in", "clock_out", "required_hours", "hours_worked"];

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function statusBadge(status: string | null) {
  if (!status) return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>;
  const map: Record<string, string> = {
    P: styles.badgeP, A: styles.badgeA,
    SL: styles.badgeSL, PL: styles.badgePL, WH: styles.badgeWH,
  };
  const labels: Record<string, string> = {
    P: "Present", A: "Absent",
    SL: "Sick Leave", PL: "Paid Leave", WH: "Weekly Holiday",
  };
  return <span className={map[status] ?? styles.badgeP}>{labels[status] ?? status}</span>;
}

function getCellValue(r: DailyRecord, key: ColKey, i: number): string {
  if (key === "sr") return String(i + 1);
  if (key === "name") return r.name;
  if (key === "status") {
    const labels: Record<string, string> = {
      P: "Present", A: "Absent",
      SL: "Sick Leave", PL: "Paid Leave", WH: "Weekly Holiday",
    };
    return r.status ? (labels[r.status] ?? r.status) : "—";
  }
  if (key === "clock_in") return r.clock_in ?? "—";
  if (key === "clock_out") return r.clock_out ?? "—";
  if (key === "required_hours") return r.required_hours != null ? `${r.required_hours}h` : "—";
  if (key === "hours_worked") return r.hours_worked != null ? `${r.hours_worked}h` : "—";
  return "—";
}

export default function DailyView() {
  const today = toDateStr(new Date());
  const [date, setDate] = useState(today);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(DEFAULT_COLS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const storedUser = getStoredUser();
  const isEmployee = (storedUser?.roles ?? []).includes("employee") &&
    !(storedUser?.roles ?? []).includes("admin") &&
    !(storedUser?.roles ?? []).includes("manager");
  const selfEmployeeId = isEmployee ? storedUser?.employee_id : undefined;

  const load = useCallback(async () => {
     setLoading(true);
     setError(null);
     try {
      const data = await fetchDailyAttendance(date, selfEmployeeId);
       setRecords(data.items);
     } catch (e: unknown) {
       setError(e instanceof Error ? e.message : "Failed to load attendance");
     } finally {
       setLoading(false);
     }
  }, [date, selfEmployeeId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function toggleCol(key: ColKey) {
    if (key === "sr" || key === "name") return;
    setVisibleCols(c => c.includes(key) ? c.filter(x => x !== key) : [...c, key]);
  }

  async function handleExport(format: "excel" | "pdf") {
    setExportOpen(false);
    setExporting(true);
    const colDefs = ALL_COLS.filter(c => visibleCols.includes(c.key));
    const headers = colDefs.map(c => c.label);
    const rows = records.map((r, i) => colDefs.map(c => getCellValue(r, c.key, i)));
    const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });

    if (format === "excel") {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = headers.map((h, ci) => ({
        wch: Math.min(Math.max(h.length, ...rows.map(r => (r[ci] ?? "").length)) + 2, 35),
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Daily Attendance");
      XLSX.writeFile(wb, `attendance_daily_${date}.xlsx`);
    } else {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFillColor(34, 93, 184);
      doc.rect(0, 0, 297, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Prabhsol EMS — Daily Attendance", 10, 11);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${dateLabel}  ·  ${records.length} records`, 10, 17);
      autoTable(doc, {
        head: [headers], body: rows, startY: 22,
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [26, 26, 46] },
        headStyles: { fillColor: [238, 243, 252], textColor: [34, 93, 184], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 249, 251] },
        margin: { top: 22, left: 10, right: 10, bottom: 10 },
      });
      doc.save(`attendance_daily_${date}.pdf`);
    }
    setExporting(false);
  }

  const activeCols = ALL_COLS.filter(c => visibleCols.includes(c.key));

  return (
    <>
      <div className={styles.controls}>
        <input
          type="date"
          className={styles.datePicker}
          value={date}
          max={today}
          onChange={e => setDate(e.target.value)}
        />
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <div className={styles.filterWrap} ref={exportRef}>
            <button className={styles.btnSecondary} onClick={() => setExportOpen(o => !o)} disabled={exporting}>
              {exporting ? <span className={styles.exportSpinner} /> : (
                <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
                  <path d="M7.5 1v8m0 0L5 6.5M7.5 9l2.5-2.5M2 13h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              Export
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-muted)", transform: exportOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {exportOpen && (
              <div className={styles.filterDropdown} style={{ minWidth: 160 }}>
                <p className={styles.filterHeading}>Download as</p>
                <button className={styles.exportItem} onClick={() => handleExport("excel")}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="1" width="14" height="14" rx="2" fill="#1D6F42"/>
                    <path d="M4 5l2.5 3L4 11h1.5l1.75-2.2L9 11h1.5L8 8l2.5-3H9L7.25 7.2 5.5 5H4z" fill="white"/>
                  </svg>
                  Excel (.xlsx)
                </button>
                <button className={styles.exportItem} onClick={() => handleExport("pdf")}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="1" width="14" height="14" rx="2" fill="#E53935"/>
                    <text x="2.5" y="11" fontSize="6.5" fontWeight="bold" fill="white" fontFamily="helvetica">PDF</text>
                  </svg>
                  PDF (.pdf)
                </button>
              </div>
            )}
          </div>

          <div className={styles.filterWrap} ref={filterRef}>
            <button className={styles.btnSecondary} onClick={() => setFilterOpen(o => !o)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              Columns
            </button>
            {filterOpen && (
              <div className={styles.filterDropdown}>
                <p className={styles.filterHeading}>Toggle columns</p>
                {ALL_COLS.filter(c => c.key !== "sr" && c.key !== "name").map(col => (
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

      <div className={styles.tableWrap}>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <table className={styles.table}>
          <thead>
            <tr>
              {activeCols.map(col => (
                <th key={col.key} className={styles.th}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={activeCols.length} className={styles.loadingCell}>Loading…</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={activeCols.length} className={styles.emptyCell}>No records for this date.</td></tr>
            ) : records.map((r, i) => (
              <tr key={r.id} className={styles.tr}>
                {activeCols.map(col => (
                  <td key={col.key} className={styles.td}>
                    {col.key === "status" ? statusBadge(r.status) : getCellValue(r, col.key, i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}