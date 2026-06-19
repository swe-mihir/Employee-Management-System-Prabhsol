"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  fetchUsers, createUser, updateUser,
  SystemUser, UserCreate, UserUpdate,
} from "@/services/api/users";
import { fetchEmployees, Employee } from "@/services/api/employees";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import styles from "./users.module.css";

const ROLES = ["admin", "manager", "employee",  "hr", "assistant"] as const;
type Role = typeof ROLES[number];

function roleBadgeClass(role: string) {
  if (role === "admin")    return styles.roleBadgeAdmin;
  if (role === "manager")  return styles.roleBadgeManager;
  if (role === "hr") return styles.roleBadgeHR;
  if (role === "assistant") return styles.roleBadgeAssistant;
  return styles.roleBadgeEmployee;
}

function formatDate(val: string) {
  try { return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return val; }
}

const EMPTY_CREATE: UserCreate = { employee_id: "", email: "", password: "", role: "employee" };

export default function UsersPage() {
  useRoleGuard(["admin"], "/dashboard");

  const [users, setUsers]     = useState<SystemUser[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [sortBy, setSortBy]         = useState("id");
  const [sortDir, setSortDir]       = useState<"asc" | "desc">("asc");
  const [page, setPage]             = useState(1);
  const pageSize = 50;

  // Add modal
  const [addOpen, setAddOpen]     = useState(false);
  const [addForm, setAddForm]     = useState<UserCreate>(EMPTY_CREATE);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError]   = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [usedEmpIds, setUsedEmpIds] = useState<Set<string>>(new Set());

  // Edit modal
  const [editUser, setEditUser]   = useState<SystemUser | null>(null);
  const [editForm, setEditForm]   = useState<UserUpdate & { role: string }>({ role: "employee" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // View drawer
  const [viewUser, setViewUser]   = useState<SystemUser | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsers({ sort_by: sortBy, sort_dir: sortDir, page, page_size: pageSize });
      setUsers(data.items);
      setTotal(data.total);
      setUsedEmpIds(new Set(data.items.map(u => u.employee_id ?? "").filter(Boolean)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortDir, page]);

  useEffect(() => { load(); }, [load]);

  // Load employees when add modal opens
  useEffect(() => {
    if (!addOpen) return;
    fetchEmployees({ status: "all", page: 1, page_size: 200 })
      .then(d => setEmployees(d.items))
      .catch(() => {});
  }, [addOpen]);

  // ── Sort ───────────────────────────────────────────────────────────────

  function handleSort(col: string) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
    setPage(1);
  }

  // ── Filtered list (client-side role filter) ────────────────────────────

  const displayed = roleFilter === "all"
    ? users
    : users.filter(u => u.role === roleFilter);

  // ── Add ────────────────────────────────────────────────────────────────

  async function handleAdd() {
    if (!addForm.employee_id || !addForm.email || !addForm.password) {
      setAddError("Employee, email, and password are required.");
      return;
    }
    setAddSaving(true);
    setAddError(null);
    try {
      await createUser(addForm);
      setAddOpen(false);
      setAddForm(EMPTY_CREATE);
      load();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setAddSaving(false);
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────

  function openEdit(u: SystemUser) {
    setEditUser(u);
    setEditForm({ email: u.email, password: "", role: u.role });
    setEditError(null);
  }

  async function handleEdit() {
    if (!editUser) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const payload: UserUpdate = { role: editForm.role };
      if (editForm.email)    payload.email    = editForm.email;
      if (editForm.password) payload.password = editForm.password;
      await updateUser(editUser.id, payload);
      setEditUser(null);
      load();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Failed to update user");
    } finally {
      setEditSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const totalPages = Math.ceil(total / pageSize);
  const availableEmployees = employees.filter(e => !usedEmpIds.has(e.id));

  return (
    <AppShell>
      <div className={styles.page}>

        {/* Top bar */}
        <div className={styles.topBar}>
          <div className={styles.left}>
            <h1 className={styles.title}>Users</h1>
            <div className={styles.radioGroup}>
              {(["all", "admin", "manager", "employee", "hr", "assistant"] as const).map(opt => (
                <label key={opt} className={`${styles.radioLabel} ${roleFilter === opt ? styles.radioActive : ""}`}>
                  <input type="radio" name="roleFilter" value={opt}
                    checked={roleFilter === opt}
                    onChange={() => { setRoleFilter(opt); setPage(1); }}
                    className={styles.radioInput}
                  />
                  {opt === "all" ? "All" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                </label>
              ))}
            </div>
          </div>
          <div className={styles.right}>
            <button className={styles.btnPrimary} onClick={() => { setAddForm(EMPTY_CREATE); setAddError(null); setAddOpen(true); }}>
              + Add User
            </button>
          </div>
        </div>

        {/* Table */}
        <div className={styles.tableWrap}>
          {error && <div className={styles.errorBanner}>{error}</div>}
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Sr. No.</th>
                <th className={`${styles.th} ${styles.thSortable}`} onClick={() => handleSort("employee_name")}>
                  Employee Name
                  {sortBy === "employee_name"
                    ? <span className={styles.sortIcon}>{sortDir === "asc" ? " ↑" : " ↓"}</span>
                    : <span className={styles.sortIconInactive}> ↕</span>}
                </th>
                <th className={`${styles.th} ${styles.thSortable}`} onClick={() => handleSort("email")}>
                  Email
                  {sortBy === "email"
                    ? <span className={styles.sortIcon}>{sortDir === "asc" ? " ↑" : " ↓"}</span>
                    : <span className={styles.sortIconInactive}> ↕</span>}
                </th>
                <th className={styles.th}>Role</th>
                <th className={`${styles.th} ${styles.thSortable}`} onClick={() => handleSort("created_at")}>
                  Created At
                  {sortBy === "created_at"
                    ? <span className={styles.sortIcon}>{sortDir === "asc" ? " ↑" : " ↓"}</span>
                    : <span className={styles.sortIconInactive}> ↕</span>}
                </th>
                <th className={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className={styles.loadingCell}>Loading…</td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={6} className={styles.emptyCell}>No users found.</td></tr>
              ) : (
                displayed.map((u, i) => (
                  <tr key={u.id} className={styles.tr}>
                    <td className={styles.td}>{(page - 1) * pageSize + i + 1}</td>
                    <td className={styles.td}>{u.employee_name || "—"}</td>
                    <td className={styles.td}>{u.email}</td>
                    <td className={styles.td}>
                      <span className={`${styles.badge} ${roleBadgeClass(u.role)}`}>
                        {u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : "—"}
                      </span>
                    </td>
                    <td className={styles.td}>{formatDate(u.created_at)}</td>
                    <td className={styles.td}>
                      <div className={styles.actions}>
                        <button className={styles.actionBtnView} onClick={() => setViewUser(u)}>View</button>
                        <button className={styles.actionBtnEdit} onClick={() => openEdit(u)}>Edit</button>
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
            <span className={styles.pageInfo}>Page {page} of {totalPages} · {total} users</span>
            <button className={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {/* ── View Drawer ── */}
      {viewUser && (
        <>
          <div className={styles.drawerOverlay} onClick={() => setViewUser(null)} />
          <div className={styles.drawer}>
            <div className={styles.drawerHeader}>
              <div>
                <h2 className={styles.drawerName}>{viewUser.employee_name || "—"}</h2>
                <p className={styles.drawerSub}>{viewUser.email}</p>
              </div>
              <button className={styles.modalClose} onClick={() => setViewUser(null)}>✕</button>
            </div>
            <div className={styles.drawerBody}>
              <div className={styles.drawerSection}>
                <p className={styles.drawerSectionTitle}>Account</p>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerRowLabel}>Email</span>
                  <span className={styles.drawerRowValue}>{viewUser.email}</span>
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerRowLabel}>Role</span>
                  <span className={styles.drawerRowValue}>
                    <span className={`${styles.badge} ${roleBadgeClass(viewUser.role)}`}>
                      {viewUser.role ? viewUser.role.charAt(0).toUpperCase() + viewUser.role.slice(1) : "—"}
                    </span>
                  </span>
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerRowLabel}>Created At</span>
                  <span className={styles.drawerRowValue}>{formatDate(viewUser.created_at)}</span>
                </div>
              </div>
              <div className={styles.drawerSection}>
                <p className={styles.drawerSectionTitle}>Employee</p>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerRowLabel}>Employee ID</span>
                  <span className={styles.drawerRowValue} style={{ fontSize: 11, fontFamily: "monospace" }}>
                    {viewUser.employee_id || "—"}
                  </span>
                </div>
              </div>
            </div>
            <div className={styles.drawerFooter}>
              <button className={styles.btnPrimary} onClick={() => { setViewUser(null); openEdit(viewUser); }}>
                Edit User
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Add Modal ── */}
      {addOpen && (
        <div className={styles.modalOverlay} onClick={() => setAddOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add User</h2>
              <button className={styles.modalClose} onClick={() => setAddOpen(false)}>✕</button>
            </div>
            {addError && <div className={styles.errorBanner} style={{ margin: "0 24px" }}>{addError}</div>}
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Employee *</label>
                <select
                  className={styles.fieldSelect}
                  value={addForm.employee_id}
                  onChange={e => setAddForm(f => ({ ...f, employee_id: e.target.value }))}
                >
                  <option value="">— Select employee —</option>
                  {availableEmployees.length === 0
                    ? <option disabled>No available employees</option>
                    : availableEmployees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}{emp.designation ? ` (${emp.designation})` : ""}
                        </option>
                      ))
                  }
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Email *</label>
                <input type="email" className={styles.fieldInput}
                  value={addForm.email}
                  onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="user@example.com"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Password *</label>
                <input type="password" className={styles.fieldInput}
                  value={addForm.password}
                  onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 8 characters"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Role *</label>
                <select className={styles.fieldSelect}
                  value={addForm.role}
                  onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="employee">Employee</option>
                  <option value="hr">HR</option>
                  <option value="assistant">Assistant</option>
                </select>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setAddOpen(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleAdd} disabled={addSaving}>
                {addSaving ? "Saving…" : "Add User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editUser && (
        <div className={styles.modalOverlay} onClick={() => setEditUser(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Edit — {editUser.employee_name || editUser.email}</h2>
              <button className={styles.modalClose} onClick={() => setEditUser(null)}>✕</button>
            </div>
            {editError && <div className={styles.errorBanner} style={{ margin: "0 24px" }}>{editError}</div>}
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Employee</label>
                <input type="text" className={styles.fieldInput} value={editUser.employee_name || "—"} disabled />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Email</label>
                <input type="email" className={styles.fieldInput}
                  value={editForm.email ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>New Password</label>
                <input type="password" className={styles.fieldInput}
                  value={editForm.password ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Leave blank to keep current"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Role</label>
                <select className={styles.fieldSelect}
                  value={editForm.role}
                  onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="employee">Employee</option>
                  <option value="hr">HR</option>
                  <option value="assistant">Assistant</option>
                </select>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setEditUser(null)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleEdit} disabled={editSaving}>
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}