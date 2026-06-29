"use client"; //salary/page.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import AppShell from "@/components/layout/AppShell";
import { useRoleGuard } from "@/hooks/useRoleGuard";
 import {
   fetchSalaryStructures, fetchMySalaryStructure, createSalaryStructure, updateSalaryStructure,
   SalaryStructure, SalaryStructureCreate,
 } from "@/services/api/salaryStructure";
import { fetchEmployees, Employee } from "@/services/api/employees";
import { useUser } from "@/hooks/useUser";
import styles from "./salary.module.css";
import { fetchMyPayroll, PayrollRecord } from "@/services/api/payroll";

const EMPTY: SalaryStructureCreate = {
  employee_id: "", basic_allowance: 0, hra_allowance: 0,
  conveyance_allowance: 0, medical_allowance: 0, effective_from: "",
  account_name: "", account_number: "", bank_ifsc_code: "", bank_name: "", bank_branch: "", 
  transaction_type: "",  bene_id: "", remarks: ""
};

//chatgpt
type ColKey =
  | "sr"
  | "employee"
  | "basic"
  | "hra"
  | "conveyance"
  | "medical"
  | "effective_from"
  | "effective_to"
  | "bank"
  | "bank_branch"
  | "bank_ifsc_code"
  | "account_name"
  | "account_number"
  | "transaction_type"
  | "bene_id"
  | "remarks";

const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "sr", label: "Sr." },
  { key: "employee", label: "Employee" },
  { key: "basic", label: "Basic" },
  { key: "hra", label: "HRA" },
  { key: "conveyance", label: "Conveyance" },
  { key: "medical", label: "Medical" },
  { key: "effective_from", label: "Effective From" },
  { key: "effective_to", label: "Effective To" },
  { key: "bank", label: "Bank" },
  { key: "bank_branch", label: "Branch" },
  { key: "bank_ifsc_code", label: "IFSC Code"},
  { key: "account_name", label: "Account Name" },
  { key: "account_number", label: "Account Number" },
  { key: "transaction_type", label: "Transaction Type" },
  { key: "bene_id", label: "Bene ID" },
  { key: "remarks", label: "Remarks" },
  
  
];

const DEFAULT_COLS: ColKey[] = [
  "sr",
  "employee",
  "basic",
  "hra",
  "effective_from",
  "bank",
];


const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt(v: number) { return Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function SalaryPage() {
  useRoleGuard(["admin", "manager", "employee", "hr", "assistant"], "/attendance");
  const user = useUser();
  const isEmployee = (user?.roles?.includes("employee") || user?.roles?.includes("assistant")) && !user.roles.includes("admin") && !user.roles.includes("manager");

  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [usedEmpIds, setUsedEmpIds] = useState<Set<string>>(new Set());

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<SalaryStructureCreate>(EMPTY);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editItem, setEditItem] = useState<SalaryStructure | null>(null);
  const [editForm, setEditForm] = useState<Partial<SalaryStructureCreate>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [payrollLoading, setPayrollLoading] = useState(false);

  //chatgpt
  const [visibleCols, setVisibleCols] =
  useState<ColKey[]>(DEFAULT_COLS);

  const [colDropOpen, setColDropOpen] = useState(false);

  const colRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = isEmployee ? await fetchMySalaryStructure() : await fetchSalaryStructures();
      setStructures(data.items);
      setUsedEmpIds(new Set(data.items.map(s => s.employee_id)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [isEmployee]);

  //chatgpt
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        colRef.current &&
        !colRef.current.contains(e.target as Node)
      ) {
        setColDropOpen(false);
      }
    }

    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);


  useEffect(() => {
    if (user !== null && user !== undefined) load();
  }, [load, user]);

  useEffect(() => {
    if (!isEmployee) return;
    setPayrollLoading(true);
    fetchMyPayroll({ page: 1, page_size: 100 })
      .then(d => setPayroll(d.items))
      .catch(() => {})
      .finally(() => setPayrollLoading(false));
  }, [isEmployee]);

  useEffect(() => {
    fetchEmployees({ status: "current", page: 1, page_size: 200 })
      .then(d => setEmployees(d.items))
      .catch(() => {});
  }, []);

  async function handleAdd() {
    if (!addForm.employee_id || !addForm.effective_from) { setAddError("Employee and effective date are required."); return; }
    setAddSaving(true); setAddError(null);

    if (!addForm.basic_allowance || !addForm.hra_allowance) { setAddError("Allowance values are required."); return; }
    setAddSaving(true); setAddError(null);

    try {
      await createSalaryStructure(addForm);
      setAddOpen(false); setAddForm(EMPTY); load();
    } catch (e: unknown) { setAddError(e instanceof Error ? e.message : "Failed"); }
    finally { setAddSaving(false); }
  }

  async function handleEdit() {
    if (!editItem) return;
    setEditSaving(true); setEditError(null);
    try {
      await updateSalaryStructure(editItem.id, editForm);
      setEditItem(null); load();
    } catch (e: unknown) { setEditError(e instanceof Error ? e.message : "Failed"); }
    finally { setEditSaving(false); }
  }

  function openEdit(s: SalaryStructure) {
    setEditItem(s);
    setEditForm({
      basic_allowance: s.basic_allowance, hra_allowance: s.hra_allowance,
      conveyance_allowance: s.conveyance_allowance, medical_allowance: s.medical_allowance,
      effective_from: s.effective_from, effective_to: s.effective_to ?? undefined,
      account_name: s.account_name ?? "", account_number: s.account_number ?? "",
      bank_ifsc_code: s.bank_ifsc_code ?? "", bank_name: s.bank_name ?? "", bank_branch: s.bank_branch ?? "",
    });
    setEditError(null);
  }

  //chatgpt
  function getCellValue(
    s: SalaryStructure,
    key: ColKey,
    index: number
  ) {
    switch (key) {
      case "sr":
        return index + 1;

      case "employee":
        return s.employee_name;

      case "basic":
        return `₹${fmt(s.basic_allowance)}`;

      case "hra":
        return `₹${fmt(s.hra_allowance)}`;

      case "conveyance":
        return `₹${fmt(s.conveyance_allowance)}`;

      case "medical":
        return `₹${fmt(s.medical_allowance)}`;

      case "effective_from":
        return s.effective_from;

      case "effective_to":
        return s.effective_to ?? "—";

      case "bank":
        return s.bank_name
          ? `${s.bank_name}`
          : "—";
      
      case "bank_branch":
        return s.bank_branch
          ? `${s.bank_branch}`
          : "—";
      
      case "bank_ifsc_code":
        return s.bank_ifsc_code
          ? `${s.bank_ifsc_code}`
          : "—";
      
      case "account_name":
        return s.account_name
          ? `${s.account_name}`
          : "—";

      case "account_number":
        return s.account_number
          ? `${s.account_number}`
          : "—";

      case "transaction_type":
        return s.transaction_type
          ? `${s.transaction_type}`
          : "—";
      case "bene_id":
        return s.bene_id
          ? `${s.bene_id}`
          : "—";
      case "remarks":
        return s.remarks
          ? `${s.remarks}`
          : "—";
      
      default:
        return "—";
    }
  }

  const availableEmps = employees.filter(e => !usedEmpIds.has(e.id));

  return (
    <AppShell>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <h1 className={styles.title}>Salary Structures</h1>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
              {isEmployee && (
            <div className={styles.filterWrap} ref={colRef}>
              <button
                className={styles.btnSecondary}
                onClick={() => setColDropOpen(o => !o)}
              >
                Columns
              </button>
            
              {colDropOpen && (
                <div className={styles.filterDropdown}>
                  <p className={styles.filterHeading}>
                    Toggle columns
                  </p>

                  {ALL_COLS
                    .filter(c => c.key !== "sr" && c.key != "basic" && c.key != "conveyance" && c.key != "hra" && c.key != "medical")
                    .map(col => (
                      <label
                        key={col.key}
                        className={styles.filterRow}
                      >
                        
                        <input
                          type="checkbox"
                          checked={visibleCols.includes(col.key)}
                          onChange={() =>
                            setVisibleCols(cols =>
                              cols.includes(col.key)
                                ? cols.filter(
                                    c => c !== col.key
                                  )
                                : [...cols, col.key]
                            )
                          }
                        />
                        {col.label}
                      </label>
                    ))}
                </div>
              )}
            </div>
              )}

              {!isEmployee && (
              <div className={styles.filterWrap} ref={colRef}>

              <button
                className={styles.btnSecondary}
                onClick={() => setColDropOpen(o => !o)}
              >
                Columns
              </button>
              
              {colDropOpen && (
                <div className={styles.filterDropdown}>
                  <p className={styles.filterHeading}>
                    Toggle columns
                  </p>

                  {ALL_COLS
                    .filter(c => c.key !== "sr")
                    .map(col => (
                      <label
                        key={col.key}
                        className={styles.filterRow}
                      >
                        <input
                          type="checkbox"
                          checked={visibleCols.includes(col.key)}
                          onChange={() =>
                            setVisibleCols(cols =>
                              cols.includes(col.key)
                                ? cols.filter(
                                    c => c !== col.key
                                  )
                                : [...cols, col.key]
                            )
                          }
                        />
                        {col.label}
                      </label>
                    ))}
                </div>
              )}
            </div>
            )}
            {!isEmployee && (
             <button
               className={styles.btnPrimary}
               onClick={() => { setAddError(null); setAddForm(EMPTY); setAddOpen(true); }}
             >
               + Add Structure
             </button>
           )}
          </div>
        </div>

        <div className={styles.tableWrap}>
          {error && <div className={styles.errorBanner}>{error}</div>}
          <table className={styles.table}>
            <thead>
              <tr>
                {ALL_COLS
                  .filter(col =>
                    visibleCols.includes(col.key)
                  )
                  .map(col => (
                    <th
                      key={col.key}
                      className={styles.th}
                    >
                      {col.label}
                    </th>
                  ))}

                {!isEmployee && <th className={styles.th}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className={styles.loadingCell}>Loading…</td></tr>
              ) : structures.length === 0 ? (
                <tr><td colSpan={10} className={styles.emptyCell}>No salary structures found.</td></tr>
              ) : structures.map((s, i) => (
                  <tr key={s.id} className={styles.tr}>
                    {ALL_COLS
                      .filter(col =>
                        visibleCols.includes(col.key)
                      )
                      .map(col => (
                        <td
                          key={col.key}
                          className={styles.td}
                        >
                          {getCellValue(s, col.key, i)}
                        </td>
                      ))}

                    <td className={styles.td}>
                      {!isEmployee && (
                       <button
                         className={styles.actionBtnEdit}
                         onClick={() => openEdit(s)}
                       >
                         Edit
                       </button>
                     )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {isEmployee && (
          <div style={{ marginTop: 32 }}>
            <h2 className={styles.title} style={{ fontSize: 18, marginBottom: 12 }}>
              Payment History
            </h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Sr.</th>
                    <th className={styles.th}>Month</th>
                    <th className={styles.th}>Year</th>
                    <th className={styles.th}>Days Present</th>
                    <th className={styles.th}>Gross</th>
                    <th className={styles.th}>Deductions</th>
                    <th className={styles.th}>Net Salary</th>
                    <th className={styles.th}>Status</th>
                    <th className={styles.th}>Paid On</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollLoading ? (
                    <tr><td colSpan={9} className={styles.loadingCell}>Loading…</td></tr>
                  ) : payroll.length === 0 ? (
                    <tr><td colSpan={9} className={styles.emptyCell}>No payment records found.</td></tr>
                  ) : payroll.map((p, i) => (
                    <tr key={p.id} className={styles.tr}>
                      <td className={styles.td}>{i + 1}</td>
                      <td className={styles.td}>{MONTH_NAMES[(p.month - 1)]}</td>
                      <td className={styles.td}>{p.year}</td>
                      <td className={styles.td}>{p.days_present}</td>
                      <td className={styles.td}>{p.gross_salary ? `₹${Number(p.gross_salary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}</td>
                      <td className={styles.td}>{p.total_deductions ? `₹${Number(p.total_deductions).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}</td>
                      <td className={styles.td}>{p.net_salary ? `₹${Number(p.net_salary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}</td>
                      <td className={styles.td}>{p.status}</td>
                      <td className={styles.td}>{p.paid_at ? new Date(p.paid_at).toLocaleDateString("en-IN") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
             </table>
            </div>
          </div>
        )}        
      </div>
        
      {/* Add Modal */}
      {addOpen && (
        <div className={styles.modalOverlay} onClick={() => setAddOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add Salary Structure</h2>
              <button className={styles.modalClose} onClick={() => setAddOpen(false)}>✕</button>
            </div>
            {addError && <div className={styles.errorBanner} style={{ margin: "0 24px" }}>{addError}</div>}
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Employee *</label>
                <select className={styles.fieldSelect} value={addForm.employee_id} onChange={e => setAddForm(f => ({ ...f, employee_id: e.target.value }))}>
                  <option value="">— Select employee —</option>
                  {availableEmps.map(e => <option key={e.id} value={e.id}>{e.name}{e.designation ? ` (${e.designation})` : ""}</option>)}
                </select>
              </div>
              <p className={styles.sectionLabel}>Allowances</p>
              <div className={styles.formGrid2}>
                {(["basic_allowance", "hra_allowance", "conveyance_allowance", "medical_allowance"] as const).map(k => (
                  <div key={k} className={styles.field}>
                    <label className={styles.fieldLabel}>{k.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase())}*</label>
                    <input type="number" className={styles.fieldInput} value={String(addForm[k] ?? 0)} onChange={e => setAddForm(f => ({ ...f, [k]: Number(e.target.value) }))} />
                  </div>
                ))}
              </div>
              <div className={styles.formGrid2}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Effective From *</label>
                  <input type="date" className={styles.fieldInput} value={addForm.effective_from} onChange={e => setAddForm(f => ({ ...f, effective_from: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Effective To</label>
                  <input type="date" className={styles.fieldInput} value={addForm.effective_to ?? ""} onChange={e => setAddForm(f => ({ ...f, effective_to: e.target.value || undefined }))} />
                </div>
              </div>
              <p className={styles.sectionLabel}>Bank Details</p>
              <div className={styles.formGrid2}>
                {(["account_name", "account_number", "bank_name", "bank_ifsc_code", "bank_branch"] as const).map(k => (
                  <div key={k} className={styles.field}>
                    <label className={styles.fieldLabel}>{k.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase())}</label>
                    <input type="text" className={styles.fieldInput} value={(addForm[k] as string) ?? ""} onChange={e => setAddForm(f => ({ ...f, [k]: e.target.value }))} />
                  </div>
                ))}
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Transaction Type</label>
                  <select
                    className={styles.fieldSelect}
                    value={(addForm.transaction_type as string) ?? ""}
                    onChange={e => setAddForm(f => ({ ...f, transaction_type: e.target.value }))}
                  >
                    <option value="">— Select type —</option>
                    <option value="WIB">Within Bank (WIB)</option>
                    <option value="NFT">NEFT (NFT)</option>
                    <option value="RTG">RTGS (RTG)</option>
                    <option value="IFC">IMPS (IFC)</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Bene Id</label>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    value={(addForm.bene_id as string) ?? ""}
                    maxLength={34}
                    onChange={e => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9]/g, "");
                      setAddForm(f => ({ ...f, bene_id: val }));
                    }}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Remarks</label>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    value={(addForm.remarks as string) ?? ""}
                    maxLength={30}
                    onChange={e => setAddForm(f => ({ ...f, remarks: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setAddOpen(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleAdd} disabled={addSaving}>{addSaving ? "Saving…" : "Add Structure"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className={styles.modalOverlay} onClick={() => setEditItem(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Edit — {editItem.employee_name}</h2>
              <button className={styles.modalClose} onClick={() => setEditItem(null)}>✕</button>
            </div>
            {editError && <div className={styles.errorBanner} style={{ margin: "0 24px" }}>{editError}</div>}
            <div className={styles.modalBody}>
              <p className={styles.sectionLabel}>Allowances</p>
              <div className={styles.formGrid2}>
                {(["basic_allowance", "hra_allowance", "conveyance_allowance", "medical_allowance"] as const).map(k => (
                  <div key={k} className={styles.field}>
                    <label className={styles.fieldLabel}>{k.replace(/_/g, " ")}</label>
                    <input type="number" className={styles.fieldInput} value={String(editForm[k] ?? 0)} onChange={e => setEditForm(f => ({ ...f, [k]: Number(e.target.value) }))} />
                  </div>
                ))}
              </div>
              <div className={styles.formGrid2}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Effective From</label>
                  <input type="date" className={styles.fieldInput} value={editForm.effective_from ?? ""} onChange={e => setEditForm(f => ({ ...f, effective_from: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Effective To</label>
                  <input type="date" className={styles.fieldInput} value={editForm.effective_to ?? ""} onChange={e => setEditForm(f => ({ ...f, effective_to: e.target.value || undefined }))} />
                </div>
              </div>
              <p className={styles.sectionLabel}>Bank Details</p>

              <div className={styles.formGrid2}>
                {(["account_name", "account_number", "bank_name", "bank_ifsc_code", "bank_branch"] as const).map(k => (
                  <div key={k} className={styles.field}>
                    <label className={styles.fieldLabel}>{k.replace(/_/g, " ")}</label>
                    <input type="text" className={styles.fieldInput} value={(editForm[k] as string) ?? ""} onChange={e => setEditForm(f => ({ ...f, [k]: e.target.value }))} />
                  </div>
                ))}
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Transaction Type</label>
                  <select
                    className={styles.fieldSelect}
                    value={(editForm.transaction_type as string) ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, transaction_type: e.target.value }))}
                  >
                    <option value="">— Select type —</option>
                    <option value="WIB">Within Bank (WIB)</option>
                    <option value="NFT">NEFT (NFT)</option>
                    <option value="RTG">RTGS (RTG)</option>
                    <option value="IFC">IMPS (IFC)</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Bene Id</label>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    value={(editForm.bene_id as string) ?? ""}
                    maxLength={34}
                    onChange={e => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9]/g, "");
                      setEditForm(f => ({ ...f, bene_id: val }));
                    }}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Remarks</label>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    value={(editForm.remarks as string) ?? ""}
                    maxLength={30}
                    onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setEditItem(null)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleEdit} disabled={editSaving}>{editSaving ? "Saving…" : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}