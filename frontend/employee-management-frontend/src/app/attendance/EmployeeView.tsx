"use client";

import { useState, useEffect, useRef, useCallback} from "react";
import styles from "./attendance.module.css";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { fetchMonthlyAttendance, MonthAttendanceItem } from "@/services/api/attendance";

type AttendanceStatus = "P" | "A" | "SL" | "PL" | "WH";

type EmpMonthRecord = MonthAttendanceItem;

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function toMonthStr(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}


function Cell({ status, grayed }: { status: AttendanceStatus | null; grayed: boolean }) {
  if (grayed) return <div className={styles.cellGray}>—</div>;
  if (!status) return <div className={styles.cellEmpty} />;
  const map: Record<AttendanceStatus, string> = { P: styles.cellP, A: styles.cellA, SL: styles.cellSL, PL: styles.cellPL, WH: styles.cellWH };
  return <div className={map[status]}>{status}</div>;
}

export default function EmployeeView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<EmpMonthRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(daysInMonth(year, month));
  const monthStr = toMonthStr(year, month);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMonthlyAttendance(year, month);
      setCount(data.days_in_month);
      setRecords(data.items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function handleMonthChange(e: React.ChangeEvent<HTMLInputElement>) {
    const [y, m] = e.target.value.split("-").map(Number);
    setYear(y); setMonth(m);
  }

  async function handleExport(format: "excel" | "pdf") {
    setExportOpen(false);
    setExporting(true);
    const dayNums = Array.from({ length: 31 }, (_, i) => i + 1);
    const headers = ["Emp Code", "Name", ...dayNums.map(String), "Total Paid"];
    const rows = records.map(r => [
      r.emp_code ?? "", r.name,
      ...Array.from({ length: 31 }, (_, i) => i >= count ? "" : (r.days[i + 1] ?? "")),
      String(r.total_paid),
    ]);
    const monthLabel = new Date(year, month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

    if (format === "excel") {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Employee Attendance");
      XLSX.writeFile(wb, `attendance_employee_${monthStr}.xlsx`);
    } else {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFillColor(34, 93, 184);
      doc.rect(0, 0, 297, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Prabhsol EMS — Employee Attendance", 10, 11);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Month: ${monthLabel}  ·  ${records.length} employees`, 10, 17);
      autoTable(doc, {
        head: [headers], body: rows, startY: 22,
        styles: { fontSize: 7, cellPadding: 1.5, textColor: [26, 26, 46] },
        headStyles: { fillColor: [238, 243, 252], textColor: [34, 93, 184], fontStyle: "bold", fontSize: 7 },
        alternateRowStyles: { fillColor: [248, 249, 251] },
        columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 24 }, 33: { cellWidth: 16 } },
        margin: { top: 22, left: 5, right: 5, bottom: 10 },
      });
      doc.save(`attendance_employee_${monthStr}.pdf`);
    }
    setExporting(false);
  }

  return (
    <>
      <div className={styles.controls}>
        <input type="month" className={styles.monthPicker} value={monthStr} max={toMonthStr(now.getFullYear(), now.getMonth() + 1)} onChange={handleMonthChange} />

        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <div className={styles.filterWrap} ref={exportRef}>
            <button className={styles.btnSecondary} onClick={() => setExportOpen(o => !o)} disabled={exporting}>
              {exporting ? <span className={styles.exportSpinner} /> : (
                <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M7.5 1v8m0 0L5 6.5M7.5 9l2.5-2.5M2 13h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
              Export
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-muted)", transform: exportOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}><path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12 }}>
        {[["P","Present","#e6f7ee","#1a7c4a"],["A","Absent","#fef2f2","#b91c1c"],["SL","Sick Leave","#fff7e6","#b45309"],["PL","Paid Leave","#eef3fc","#225db8"],["WH","Weekly Holiday","#f5f5f5","#6b7280"]].map(([code, label, bg, color]) => (
          <div key={code} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 24, height: 20, borderRadius: 4, background: bg, color, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{code}</div>
            <span style={{ color: "var(--text-secondary)" }}>{label}</span>
          </div>
        ))}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table} style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th className={styles.th} style={{ width: 36, minWidth: 36 }}>Sr.</th>
              <th className={styles.th} style={{ width: 72, minWidth: 72 }}>Code</th>
              <th className={styles.th} style={{ width: 140, minWidth: 120 }}>Name</th>
              {Array.from({ length: 31 }, (_, i) => (
                <th key={i} className={styles.thDay} style={{ width: 36, opacity: i >= count ? 0.35 : 1 }}>{i + 1}</th>
              ))}
              <th className={styles.th} style={{ width: 70, minWidth: 70, textAlign: "center" }}>Paid</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={36} className={styles.loadingCell}>Loading…</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={36} className={styles.emptyCell}>No records for this month.</td></tr>
            ) : records.map((r, i) => (
              <tr key={r.emp_code} className={styles.tr}>
                <td className={styles.td} style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>{i + 1}</td>
                <td className={styles.td} style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.emp_code}</td>
                <td className={styles.td} style={{ fontSize: 13 }}>{r.name}</td>
                +{Array.from({ length: 31 }, (_, di) => (
                  <td key={di} className={styles.tdDay}>
                    <Cell status={(r.days[di + 1] ?? null) as AttendanceStatus | null} grayed={di >= count} />
                  </td>
                ))}
                <td className={styles.td} style={{ textAlign: "center", fontWeight: 600, fontSize: 13 }}>{r.total_paid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}