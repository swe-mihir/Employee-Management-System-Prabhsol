"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  fetchEmployees,
  createEmployee,
  updateEmployee,
  approveEmployee,   
  Employee,
  EmployeeCreate,
} from "@/services/api/employees";
import styles from "./employees.module.css";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Column definitions ─────────────────────────────────────────────────────

type ColKey =
  | "sr" | "name" | "designation" | "department"
  | "join_date" | "leaving_date" | "date_of_birth"
  | "personal_phone" | "work_phone" | "personal_email" | "work_email"
  | "aadhar_no" | "pan_no" | "pf_no" | "ip_no" | "is_active"
  | "approve_before";

const ALL_COLUMNS: { key: ColKey; label: string; sortable?: boolean }[] = [
  { key: "sr",             label: "Sr. No." },
  { key: "name",           label: "Name",          sortable: true },
  { key: "designation",    label: "Designation",   sortable: true },
  { key: "department",     label: "Department",    sortable: true },
  { key: "join_date",      label: "Join Date",     sortable: true },
  { key: "leaving_date",   label: "Leaving Date",  sortable: true },
  { key: "date_of_birth",  label: "Date of Birth" },
  { key: "personal_phone", label: "Personal Phone" },
  { key: "work_phone",     label: "Work Phone" },
  { key: "personal_email", label: "Personal Email" },
  { key: "work_email",     label: "Work Email" },
  { key: "aadhar_no",      label: "Aadhar No" },
  { key: "pan_no",         label: "PAN No" },
  { key: "pf_no",          label: "PF No" },
  { key: "ip_no",          label: "IP No" },
  { key: "is_active",      label: "Status" },
  { key: "approve_before", label: "Approve Before" }, 
];

const DEFAULT_COLS: ColKey[] = ["sr", "name", "designation", "department", "join_date"];

// ── Types ──────────────────────────────────────────────────────────────────

type EditForm = {
  name: string;
  date_of_birth: string;
  department: string;
  designation: string;
  join_date: string;
  leaving_date: string;
  is_active: boolean;
  personal_phone: string;
  work_phone: string;
  personal_email: string;
  work_email: string;
  aadhar_no: string;
  pan_no: string;
  pf_no: string;
  ip_no: string;
  status: string;
  approve_before: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function d(val: string | null | undefined) {
  return val ?? "—";
}

function getCellValue(emp: Employee, key: ColKey, index: number, page: number, pageSize: number): string {
  if (key === "sr") return String((page - 1) * pageSize + index + 1);
  if (key === "is_active") return emp.is_active ? "Active" : "Left";
  const val = emp[key as keyof Employee];
  if (key === "approve_before") return emp.approve_before ?? "—";
  if (val === null || val === undefined) return "—";
  return String(val);
}

function empToEditForm(emp: Employee): EditForm {
  return {
    name:           emp.name ?? "",
    date_of_birth:  emp.date_of_birth ?? "",
    department:     emp.department ?? "",
    designation:    emp.designation ?? "",
    join_date:      emp.join_date ?? "",
    leaving_date:   emp.leaving_date ?? "",
    is_active:      emp.is_active,
    personal_phone: emp.personal_phone ?? "",
    work_phone:     emp.work_phone ?? "",
    personal_email: emp.personal_email ?? "",
    work_email:     emp.work_email ?? "",
    aadhar_no:      emp.aadhar_no ?? "",
    pan_no:         emp.pan_no ?? "",
    pf_no:          emp.pf_no ?? "",
    ip_no:          emp.ip_no ?? "",
    status:         emp.status ?? "active",
    approve_before: emp.approve_before ?? "",
  };
}

const EMPTY_CREATE: EmployeeCreate = {
  name: "", join_date: "", date_of_birth: "", department: "",
  designation: "", personal_phone: "", work_phone: "",
  personal_email: "", work_email: "", aadhar_no: "", pan_no: "",
  pf_no: "", ip_no: "", status: "active", approve_before: "", emp_code: "", required_hours: ""
};

// ── Component ──────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const [employees, setEmployees]     = useState<Employee[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"current" | "left" | "pending" | "all">("current");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [sortBy, setSortBy]           = useState("name");
  const [sortDir, setSortDir]         = useState<"asc" | "desc">("asc");
  const [page, setPage]               = useState(1);
  const pageSize = 50;

  const [visibleCols, setVisibleCols] = useState<ColKey[]>(DEFAULT_COLS);
  const [filterOpen, setFilterOpen]   = useState(false);
  const [exportOpen, setExportOpen]   = useState(false);
  const [exporting, setExporting]     = useState(false);
  const exportRef                     = useRef<HTMLDivElement>(null);

  // Add modal
  const [addOpen, setAddOpen]         = useState(false);
  const [addForm, setAddForm]         = useState<EmployeeCreate>(EMPTY_CREATE);
  const [addSaving, setAddSaving]     = useState(false);
  const [addError, setAddError]       = useState<string | null>(null);

  // View drawer
  const [viewEmp, setViewEmp]         = useState<Employee | null>(null);

  // Edit modal
  const [editEmp, setEditEmp]         = useState<Employee | null>(null);
  const [editForm, setEditForm]       = useState<EditForm | null>(null);
  const [editSaving, setEditSaving]   = useState(false);
  const [editError, setEditError]     = useState<string | null>(null);

  // Password confirmation for deactivation
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState("");
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [deactivateVerifying, setDeactivateVerifying] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEmployees({
        status: statusFilter, sort_by: sortBy,
        sort_dir: sortDir, page, page_size: pageSize,
      });
      setEmployees(data.items);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sortBy, sortDir, page]);

  useEffect(() => { load(); }, [load]);

  // ── Sort ───────────────────────────────────────────────────────────────

  function handleSort(col: ColKey) {
    const colDef = ALL_COLUMNS.find(c => c.key === col);
    if (!colDef?.sortable) return;
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
    setPage(1);
  }

  // ── Column toggle ──────────────────────────────────────────────────────

  function toggleCol(key: ColKey) {
    if (key === "sr" || key === "name") return;
    setVisibleCols(cols =>
      cols.includes(key) ? cols.filter(c => c !== key) : [...cols, key]
    );
  }

  // ── Add ────────────────────────────────────────────────────────────────

  async function handleAdd() {
    if (!addForm.name || !addForm.join_date) {
      setAddError("Name and join date are required.");
      return;
    }
    setAddSaving(true);
    setAddError(null);
    try {
      const clean = Object.fromEntries(
        Object.entries(addForm).filter(([, v]) => v !== "")
      ) as EmployeeCreate;
      await createEmployee(clean);
      setAddOpen(false);
      setAddForm(EMPTY_CREATE);
      load();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Failed to create employee");
    } finally {
      setAddSaving(false);
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────

  function openEdit(emp: Employee) {
    setEditEmp(emp);
    setEditForm(empToEditForm(emp));
    setEditError(null);
  }

  // Called when the status select changes to "left"
  function handleStatusChangeToLeft() {
    // Only prompt if the employee is currently active
    setDeactivatePassword("");
    setDeactivateError(null);
    setDeactivateConfirm(true);
  }

  // Called after password is confirmed — applies the deactivation to the form
  async function handleDeactivateConfirm() {
    if (!deactivatePassword.trim()) {
      setDeactivateError("Please enter your password.");
      return;
    }
    setDeactivateVerifying(true);
    setDeactivateError(null);
    try {
      // Verify password via the login endpoint (re-use existing auth service)
      const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      // Extract email from the stored access token's JWT payload (middle segment)
      const email = (() => {
        try {
          const token = localStorage.getItem("ems_access_token") ?? "";
          const payload = JSON.parse(atob(token.split(".")[1]));
          return payload.email ?? "";
        } catch { return ""; }
      })();
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: deactivatePassword }),
      });
      if (!res.ok) {
        setDeactivateError("Incorrect password. Please try again.");
        return;
      }
      // Password correct — apply deactivation to the form
      setEditForm(f => f ? { ...f, is_active: false } : f);
      setDeactivateConfirm(false);
      setDeactivatePassword("");
    } catch {
      setDeactivateError("Unable to verify password. Please try again.");
    } finally {
      setDeactivateVerifying(false);
    }
  }

  async function handleEdit() {
    if (!editEmp || !editForm) return;
    if (!editForm.name || !editForm.join_date) {
      setEditError("Name and join date are required.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(editForm).map(([k, v]) => [k, v === "" ? null : v])
      );
      await updateEmployee(editEmp.id, payload);
      setEditEmp(null);
      setEditForm(null);
      load();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Failed to update employee");
    } finally {
      setEditSaving(false);
    }
  }

 async function handleApprove(emp: Employee) {
    setApprovingId(emp.id);
    try {
      await approveEmployee(emp.id);
      load();
    } catch (e: unknown) {
      console.error("Approve failed:", e);
    } finally {
      setApprovingId(null);
    }
  }

  // ── Export ─────────────────────────────────────────────────────────────

  // Close export dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function handleExport(format: "excel" | "pdf") {
    setExportOpen(false);
    setExporting(true);
    try {
      // Fetch all matching rows regardless of current pagination
      const all = await fetchEmployees({
        status: statusFilter,
        sort_by: sortBy,
        sort_dir: sortDir,
        page: 1,
        page_size: 200,
      });

      const colDefs = ALL_COLUMNS.filter(c => visibleCols.includes(c.key));
      const headers = colDefs.map(c => c.label);

      const rows = all.items.map((emp, i) =>
        colDefs.map(col => {
          if (col.key === "sr") return String(i + 1);
          if (col.key === "is_active") return emp.is_active ? "Active" : "Left";
          const val = emp[col.key as keyof Employee];
          return val === null || val === undefined ? "" : String(val);
        })
      );

      const filterLabel =
        statusFilter === "current" ? "Current Employees"
        : statusFilter === "left"  ? "Ex-Employees"
        : "All Employees";

      const dateSuffix = new Date().toISOString().slice(0, 10);

      if (format === "excel") {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        // Auto column widths
        ws["!cols"] = headers.map((h, ci) => {
          const max = Math.max(h.length, ...rows.map(r => (r[ci] ?? "").length));
          return { wch: Math.min(Math.max(max + 2, 10), 40) };
        });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Employees");
        XLSX.writeFile(wb, `employees_${dateSuffix}.xlsx`);

      } else {
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const exportDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

        // Branded header bar
        doc.setFillColor(34, 93, 184);
        doc.rect(0, 0, 297, 18, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Prabhsol Employee Management System", 10, 11);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Exported ${exportDate}  ·  ${filterLabel}  ·  ${all.items.length} record(s)`, 10, 17);

        autoTable(doc, {
          head: [headers],
          body: rows,
          startY: 22,
          styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak", textColor: [26, 26, 46] },
          headStyles: { fillColor: [238, 243, 252], textColor: [34, 93, 184], fontStyle: "bold", fontSize: 8 },
          alternateRowStyles: { fillColor: [248, 249, 251] },
          columnStyles: colDefs[0]?.key === "sr" ? { 0: { cellWidth: 12 } } : {},
          didDrawPage: (data) => {
            const pageCount = (doc as any).internal.getNumberOfPages();
            doc.setFontSize(7);
            doc.setTextColor(142, 151, 168);
            doc.text(`Page ${data.pageNumber} of ${pageCount}`, 287, doc.internal.pageSize.height - 5, { align: "right" });
          },
          margin: { top: 22, left: 10, right: 10, bottom: 10 },
        });

        doc.save(`employees_${dateSuffix}.pdf`);
      }
    } catch (e: unknown) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const activeCols = ALL_COLUMNS.filter(c => visibleCols.includes(c.key));
  const totalPages = Math.ceil(total / pageSize);

  return (
    <AppShell>
      <div className={styles.page}>

        {/* Top bar */}
        <div className={styles.topBar}>
          <div className={styles.left}>
            <h1 className={styles.title}>Employees</h1>
            <div className={styles.radioGroup}>
              {(["current", "left", "pending", "all"] as const).map(opt => (
                <label key={opt} className={`${styles.radioLabel} ${statusFilter === opt ? styles.radioActive : ""}`}>
                  <input type="radio" name="status" value={opt}
                    checked={statusFilter === opt}
                    onChange={() => { setStatusFilter(opt); setPage(1); }}
                    className={styles.radioInput}
                  />
                  {opt === "pending" ? "Pending" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                </label>
              ))}
            </div>
          </div>
          <div className={styles.right}>
            <button className={styles.btnPrimary} onClick={() => setAddOpen(true)}>+ Add Employee</button>
            <div className={styles.filterWrap} ref={exportRef}>
              <button
                className={styles.btnSecondary}
                onClick={() => setExportOpen(o => !o)}
                disabled={exporting}
                title="Export table"
              >
                {exporting ? (
                  <span className={styles.exportSpinner} />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden>
                    <path d="M7.5 1v8m0 0L5 6.5M7.5 9l2.5-2.5M2 13h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                Export
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden style={{ color: "var(--text-muted)", transition: "transform 0.15s", transform: exportOpen ? "rotate(180deg)" : "none" }}>
                  <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {exportOpen && (
                <div className={styles.filterDropdown} style={{ minWidth: 160 }}>
                  <p className={styles.filterHeading}>Download as</p>
                  <button className={styles.exportItem} onClick={() => handleExport("excel")}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <rect x="1" y="1" width="14" height="14" rx="2" fill="#1D6F42"/>
                      <path d="M4 5l2.5 3L4 11h1.5l1.75-2.2L9 11h1.5L8 8l2.5-3H9L7.25 7.2 5.5 5H4z" fill="white"/>
                    </svg>
                    Excel (.xlsx)
                  </button>
                  <button className={styles.exportItem} onClick={() => handleExport("pdf")}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <rect x="1" y="1" width="14" height="14" rx="2" fill="#E53935"/>
                      <text x="2.5" y="11" fontSize="6.5" fontWeight="bold" fill="white" fontFamily="helvetica">PDF</text>
                    </svg>
                    PDF (.pdf)
                  </button>
                </div>
              )}
            </div>
            <div className={styles.filterWrap}>
              <button className={styles.btnSecondary} onClick={() => setFilterOpen(o => !o)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
                </svg>
                Columns
              </button>
              {filterOpen && (
                <div className={styles.filterDropdown}>
                  <p className={styles.filterHeading}>Toggle columns</p>
                  {ALL_COLUMNS.filter(c => c.key !== "sr" && c.key !== "name").map(col => (
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

        {/* Table */}
        <div className={styles.tableWrap}>
          {error && <div className={styles.errorBanner}>{error}</div>}
          <table className={styles.table}>
            <thead>
              <tr>
                {activeCols.map(col => (
                  <th key={col.key}
                    className={`${styles.th} ${col.sortable ? styles.thSortable : ""}`}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    {col.sortable && sortBy === col.key && <span className={styles.sortIcon}>{sortDir === "asc" ? " ↑" : " ↓"}</span>}
                    {col.sortable && sortBy !== col.key && <span className={styles.sortIconInactive}> ↕</span>}
                  </th>
                ))}
                <th className={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={activeCols.length + 1} className={styles.loadingCell}>Loading…</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={activeCols.length + 1} className={styles.emptyCell}>No employees found.</td></tr>
              ) : (
                employees.map((emp, i) => (
                  <tr key={emp.id} className={styles.tr}>
                    {activeCols.map(col => (
                      <td key={col.key} className={styles.td}>
                        {col.key === "is_active" ? (
                          <span className={`${styles.badge} ${emp.is_active ? styles.badgeActive : styles.badgeLeft}`}>
                            {emp.is_active ? "Active" : "Left"}
                          </span>
                        ) : col.key === "approve_before" ? (
                          <span>{emp.approve_before ?? "—"}</span>
                        ) : col.key === "name" && (emp.status === "pending" || emp.status === "flagged") ? (
                          <>
                            {getCellValue(emp, col.key, i, page, pageSize)}
                            <span className={`${styles.badge} ${emp.status === "pending" ? styles.badgePending : styles.badgeFlagged}`} style={{marginLeft: 6}}>
                              {emp.status === "pending" ? "Pending" : "Flagged"}
                            </span>
                          </>
                        ) : getCellValue(emp, col.key, i, page, pageSize)}
                      </td>
                    ))}
                    <td className={styles.td}>
                       <div className={styles.actions}>
                          {(emp.status === "pending" || emp.status === "flagged") && (
                            <button
                              className={styles.actionBtnApprove}
                              onClick={() => handleApprove(emp)}
                              disabled={approvingId === emp.id}
                            >
                              {approvingId === emp.id ? "…" : "Approve"}
                            </button>
                          )}
                          <button className={styles.actionBtnView} onClick={() => setViewEmp(emp)}>View</button>
                          <button className={styles.actionBtnEdit} onClick={() => openEdit(emp)}>Edit</button>
                        </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button className={styles.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span className={styles.pageInfo}>Page {page} of {totalPages} · {total} employees</span>
            <button className={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {/* ── View Drawer ── */}
      {viewEmp && (
        <>
          <div className={styles.drawerOverlay} onClick={() => setViewEmp(null)} />
          <div className={styles.drawer}>
            <div className={styles.drawerHeader}>
              <div>
                <h2 className={styles.drawerName}>{viewEmp.name}</h2>
                <p className={styles.drawerSub}>{d(viewEmp.designation)}{viewEmp.department ? ` · ${viewEmp.department}` : ""}</p>
              </div>
              <button className={styles.modalClose} onClick={() => setViewEmp(null)}>✕</button>
            </div>
            <div className={styles.drawerBody}>
              <DrawerSection title="Employment">
                <DrawerRow label="Join Date"    value={d(viewEmp.join_date)} />
                <DrawerRow label="Leaving Date" value={d(viewEmp.leaving_date)} />
                <DrawerRow label="Status"       value={viewEmp.is_active ? "Active" : "Left"} highlight={viewEmp.is_active} />
              </DrawerSection>
              <DrawerSection title="Personal">
                <DrawerRow label="Date of Birth"   value={d(viewEmp.date_of_birth)} />
                <DrawerRow label="Personal Phone"  value={d(viewEmp.personal_phone)} />
                <DrawerRow label="Personal Email"  value={d(viewEmp.personal_email)} />
              </DrawerSection>
              <DrawerSection title="Work Contact">
                <DrawerRow label="Work Phone" value={d(viewEmp.work_phone)} />
                <DrawerRow label="Work Email" value={d(viewEmp.work_email)} />
              </DrawerSection>
              <DrawerSection title="ID & Compliance">
                <DrawerRow label="Aadhar No" value={d(viewEmp.aadhar_no)} />
                <DrawerRow label="PAN No"    value={d(viewEmp.pan_no)} />
                <DrawerRow label="PF No"     value={d(viewEmp.pf_no)} />
                <DrawerRow label="IP No"     value={d(viewEmp.ip_no)} />
              </DrawerSection>
            </div>
            <div className={styles.drawerFooter}>
              <button className={styles.btnPrimary} onClick={() => { setViewEmp(null); openEdit(viewEmp); }}>Edit Employee</button>
            </div>
          </div>
        </>
      )}

      {/* ── Add Modal ── */}
      {addOpen && (
        <div className={styles.modalOverlay} onClick={() => setAddOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add Employee</h2>
              <button className={styles.modalClose} onClick={() => setAddOpen(false)}>✕</button>
            </div>
            {addError && <div className={styles.errorBanner} style={{margin: "0 24px 0"}}>{addError}</div>}
            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.formSection}>
                  <p className={styles.sectionLabel}>Basic Info</p>
                  <Field label="Full Name *"   value={addForm.name}            onChange={v => setAddForm(f => ({ ...f, name: v }))} />
                  <Field label="Date of Birth" type="date" value={addForm.date_of_birth ?? ""} onChange={v => setAddForm(f => ({ ...f, date_of_birth: v }))} />
                  <Field label="Department"    value={addForm.department ?? ""} onChange={v => setAddForm(f => ({ ...f, department: v }))} />
                  <Field label="Designation"   value={addForm.designation ?? ""} onChange={v => setAddForm(f => ({ ...f, designation: v }))} />
                  <Field label="Join Date *"   type="date" value={addForm.join_date} onChange={v => setAddForm(f => ({ ...f, join_date: v }))} />
                  <Field label="Employee Code" value={addForm.emp_code ?? ""} onChange={v => setAddForm(f => ({ ...f, emp_code: v }))} />
                  <Field label="Required Hours" type="number" value={String(addForm.required_hours ?? "")} onChange={v => setAddForm(f => ({ ...f, required_hours: v }))} />
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Initial Status</label>
                  <select className={styles.fieldInput}
                    value={addForm.status ?? "active"}
                    onChange={e => setAddForm(f => ({ ...f, status: e.target.value, approve_before: e.target.value !== "pending" ? "" : f.approve_before }))}
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending Approval</option>
                  </select>
                </div>
                {addForm.status === "pending" && (
                  <Field label="Approve Before *" type="date" value={addForm.approve_before ?? ""} onChange={v => setAddForm(f => ({ ...f, approve_before: v }))} />
                )}                
                </div>
                
                <div className={styles.formSection}>
                  <p className={styles.sectionLabel}>Contact</p>
                  <Field label="Personal Phone" value={addForm.personal_phone ?? ""} onChange={v => setAddForm(f => ({ ...f, personal_phone: v }))} />
                  <Field label="Work Phone"     value={addForm.work_phone ?? ""}     onChange={v => setAddForm(f => ({ ...f, work_phone: v }))} />
                  <Field label="Personal Email" type="email" value={addForm.personal_email ?? ""} onChange={v => setAddForm(f => ({ ...f, personal_email: v }))} />
                  <Field label="Work Email"     type="email" value={addForm.work_email ?? ""}     onChange={v => setAddForm(f => ({ ...f, work_email: v }))} />
                </div>
                <div className={styles.formSection}>
                  <p className={styles.sectionLabel}>ID & Compliance</p>
                  <Field label="Aadhar No" value={addForm.aadhar_no ?? ""} onChange={v => setAddForm(f => ({ ...f, aadhar_no: v }))} />
                  <Field label="PAN No"    value={addForm.pan_no ?? ""}    onChange={v => setAddForm(f => ({ ...f, pan_no: v }))} />
                  <Field label="PF No"     value={addForm.pf_no ?? ""}     onChange={v => setAddForm(f => ({ ...f, pf_no: v }))} />
                  <Field label="IP No"     value={addForm.ip_no ?? ""}     onChange={v => setAddForm(f => ({ ...f, ip_no: v }))} />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setAddOpen(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleAdd} disabled={addSaving}>
                {addSaving ? "Saving…" : "Add Employee"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editEmp && editForm && (
        <div className={styles.modalOverlay} onClick={() => setEditEmp(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Edit — {editEmp.name}</h2>
              <button className={styles.modalClose} onClick={() => setEditEmp(null)}>✕</button>
            </div>
            {editError && <div className={styles.errorBanner} style={{margin: "0 24px 0"}}>{editError}</div>}
            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.formSection}>
                  <p className={styles.sectionLabel}>Basic Info</p>
                  <Field label="Full Name *"   value={editForm.name}           onChange={v => setEditForm(f => f && ({ ...f, name: v }))} />
                  <Field label="Date of Birth" type="date" value={editForm.date_of_birth} onChange={v => setEditForm(f => f && ({ ...f, date_of_birth: v }))} />
                  <Field label="Department"    value={editForm.department}      onChange={v => setEditForm(f => f && ({ ...f, department: v }))} />
                  <Field label="Designation"   value={editForm.designation}     onChange={v => setEditForm(f => f && ({ ...f, designation: v }))} />
                  <Field label="Join Date *"   type="date" value={editForm.join_date}  onChange={v => setEditForm(f => f && ({ ...f, join_date: v }))} />
                  <Field label="Leaving Date"  type="date" value={editForm.leaving_date} onChange={v => setEditForm(f => f && ({ ...f, leaving_date: v }))} />
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>
                      Status
                      {/* Once inactive, show a lock hint */}
                      {!editEmp.is_active && (
                        <span style={{
                          marginLeft: 8,
                          fontSize: 11,
                          fontWeight: 400,
                          color: "var(--text-muted)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}>
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
                            <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M5 7V5a3 3 0 1 1 6 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          Locked
                        </span>
                      )}
                    </label>
                    {editEmp.is_active ? (
                      // Employee is currently active — show a live select that intercepts "left"
                      <select
                        className={styles.fieldInput}
                        value={editForm.is_active ? "active" : "left"}
                        onChange={e => {
                          if (e.target.value === "left") {
                            handleStatusChangeToLeft();
                          }
                          // "active" → "active" is a no-op (already active)
                        }}
                      >
                        <option value="active">Active</option>
                        <option value="left">Left</option>
                      </select>
                    ) : (
                      // Employee is already inactive — field is locked, show read-only badge
                      <div className={styles.fieldInput} style={{
                        display: "flex",
                        alignItems: "center",
                        background: "var(--bg-base)",
                        color: "var(--text-muted)",
                        cursor: "not-allowed",
                        userSelect: "none",
                      }}>
                        <span className={`${styles.badge} ${styles.badgeLeft}`} style={{ fontSize: 12 }}>Left</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.formSection}>
                  <p className={styles.sectionLabel}>Contact</p>
                  <Field label="Personal Phone" value={editForm.personal_phone} onChange={v => setEditForm(f => f && ({ ...f, personal_phone: v }))} />
                  <Field label="Work Phone"     value={editForm.work_phone}     onChange={v => setEditForm(f => f && ({ ...f, work_phone: v }))} />
                  <Field label="Personal Email" type="email" value={editForm.personal_email} onChange={v => setEditForm(f => f && ({ ...f, personal_email: v }))} />
                  <Field label="Work Email"     type="email" value={editForm.work_email}     onChange={v => setEditForm(f => f && ({ ...f, work_email: v }))} />
                </div>
                <div className={styles.formSection}>
                  <p className={styles.sectionLabel}>ID & Compliance</p>
                  <Field label="Aadhar No" value={editForm.aadhar_no} onChange={v => setEditForm(f => f && ({ ...f, aadhar_no: v }))} />
                  <Field label="PAN No"    value={editForm.pan_no}    onChange={v => setEditForm(f => f && ({ ...f, pan_no: v }))} />
                  <Field label="PF No"     value={editForm.pf_no}     onChange={v => setEditForm(f => f && ({ ...f, pf_no: v }))} />
                  <Field label="IP No"     value={editForm.ip_no}     onChange={v => setEditForm(f => f && ({ ...f, ip_no: v }))} />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setEditEmp(null)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleEdit} disabled={editSaving}>
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Deactivate Password Confirmation Modal ── */}
      {deactivateConfirm && (
        <div className={styles.modalOverlay} style={{ zIndex: 300 }} onClick={() => {
          setDeactivateConfirm(false);
          setDeactivatePassword("");
          setDeactivateError(null);
        }}>
          <div className={styles.modal} style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Confirm Deactivation</h2>
              <button className={styles.modalClose} onClick={() => {
                setDeactivateConfirm(false);
                setDeactivatePassword("");
                setDeactivateError(null);
              }}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: 13.5, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.55 }}>
                Marking an employee as <strong style={{ color: "var(--text-primary)" }}>Left</strong> is permanent and cannot be undone from this interface. Enter your password to confirm.
              </p>
              {deactivateError && (
                <div className={styles.errorBanner} style={{ marginBottom: 14 }}>{deactivateError}</div>
              )}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Your password</label>
                <input
                  type="password"
                  className={styles.fieldInput}
                  placeholder="Enter your password"
                  value={deactivatePassword}
                  onChange={e => setDeactivatePassword(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleDeactivateConfirm(); }}
                  autoFocus
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.btnSecondary}
                onClick={() => {
                  setDeactivateConfirm(false);
                  setDeactivatePassword("");
                  setDeactivateError(null);
                }}
              >
                Cancel
              </button>
              <button
                className={styles.btnPrimary}
                style={{ background: "#b91c1c" }}
                onClick={handleDeactivateConfirm}
                disabled={deactivateVerifying || !deactivatePassword.trim()}
              >
                {deactivateVerifying ? "Verifying…" : "Confirm & Mark as Left"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ── Shared field component ─────────────────────────────────────────────────

function Field({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      <input type={type} className={styles.fieldInput} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

// ── Drawer sub-components ──────────────────────────────────────────────────

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.drawerSection}>
      <p className={styles.drawerSectionTitle}>{title}</p>
      {children}
    </div>
  );
}

function DrawerRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={styles.drawerRow}>
      <span className={styles.drawerRowLabel}>{label}</span>
      <span className={`${styles.drawerRowValue} ${highlight === true ? styles.drawerValueGreen : highlight === false && value === "Left" ? styles.drawerValueRed : ""}`}>
        {value}
      </span>
    </div>
  );
}