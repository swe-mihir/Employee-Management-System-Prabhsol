# Payroll Database Schema Reference

---

## `employees`
Core employee master data. Every other table links back to this.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | STRING | Full name of the employee |
| `department` | STRING | Department the employee belongs to |
| `designation` | STRING | Job title or role |
| `join_date` | DATE | Date the employee joined the organisation |
| `is_active` | BOOLEAN | Whether the employee is currently active |

---

## `attendance`
Daily attendance record for each employee. One row per employee per day.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `employee_id` | UUID | Foreign key → `employees.id` |
| `date` | DATE | The calendar date of the record |
| `status` | STRING | Attendance status — present, absent, half-day, leave, holiday |
| `clock_in` | TIME | Time the employee clocked in |
| `clock_out` | TIME | Time the employee clocked out |
| `hours_worked` | FLOAT | Total hours worked that day |

---

## `employee_salary_structure`
Defines the salary components and amounts applicable to each employee. Supports versioning via effective dates so historical structures are preserved when changes are made.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `employee_id` | UUID | Foreign key → `employees.id` |
| `base_salary` | FLOAT | Fixed base/basic pay |
| `hra` | FLOAT | House rent allowance |
| `transport_allowance` | FLOAT | Transport or conveyance allowance |
| `other_allowances` | FLOAT | Any additional fixed allowances |
| `pay_cycle` | STRING | Frequency of pay — monthly, bi-weekly, etc. |
| `effective_from` | DATE | Date from which this structure is applicable |
| `effective_to` | DATE | Date until which this structure is applicable (null = currently active) |

---

## `salary_history`
Monthly payroll summary for each employee. One row per employee per month. This is the top-level historical record — once saved, it is never recalculated.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `employee_id` | UUID | Foreign key → `employees.id` |
| `month` | INT | Payroll month (1–12) |
| `year` | INT | Payroll year |
| `days_present` | INT | Number of days the employee was present that month |
| `days_absent` | INT | Number of days absent |
| `leaves_taken` | INT | Number of leave days consumed |
| `gross_salary` | FLOAT | Total earnings before deductions |
| `total_deductions` | FLOAT | Total of all deductions applied |
| `net_salary` | FLOAT | Final amount paid (gross − deductions) |
| `status` | STRING | Payroll status — draft, approved, paid |
| `calculated_at` | TIMESTAMP | When the salary was computed |
| `paid_at` | TIMESTAMP | When the salary was disbursed (null if not yet paid) |

---

## `salary_components`
Line-item breakdown of every earning and deduction for a given `salary_history` record. Multiple rows per `salary_history_id` — one per component. Acts as a frozen snapshot so the exact breakdown is preserved even if structures change in the future.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `salary_history_id` | UUID | Foreign key → `salary_history.id` |
| `component_name` | STRING | Name of the component — e.g. Basic Salary, HRA, Loss of Pay |
| `component_type` | STRING | Whether it is an earning or a deduction |
| `amount` | FLOAT | The computed value of this component for that month |
| `note` | STRING | Optional explanation — e.g. "2 days LOP at ₹1,613/day" |
