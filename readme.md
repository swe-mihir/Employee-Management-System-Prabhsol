# Payroll Database Schema Reference

---

## `employees`
Core employee master data. Every other table links back to this.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | STRING | Full name of the employee |
| `date_of_birth` | DATE | Date the employee was born |
| `department` | STRING | Department the employee belongs to |
| `designation` | STRING | Job title or role |
| `join_date` | DATE | Date the employee joined the organisation |
| `leaving_date` | DATE | Date the employee left the organisation |
| `is_active` | BOOLEAN | Whether the employee is currently active |
| `personal_phone` | STRING | Employee's personal mobile number |
| `work_phone` | STRING | Employee's work or office phone number |
| `personal_email` | STRING | Employee's personal email address |
| `work_email` | STRING | Employee's official work email address |
| `aadhar_no` | VARCHAR(12) | Aadhar card number of the employee |
| `pan_no` | VARCHAR(10) | PAN card number of the employee |
| `pf_no` | VARCHAR(12) | UAN of PF of the employee |
| `ip_no` | VARCHAR(10) | IP number of the employee |



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
| `total_deductions` | FLOAT | Total of all employee-side deductions applied |
| `net_salary` | FLOAT | Final take-home amount paid (gross − total deductions) |
| `total_ctc` | FLOAT | Total cost to company — net salary + all employer contributions |
| `employee_signature` | STRING | Acknowledgement reference or signature image path for the payslip |
| `status` | STRING | Payroll status — draft, approved, paid |
| `calculated_at` | TIMESTAMP | When the salary was computed |
| `paid_at` | TIMESTAMP | When the salary was disbursed (null if not yet paid) |
 
---

## `salary_components`
Line-item breakdown of every earning, deduction, and employer contribution for a given `salary_history` record. Multiple rows per `salary_history_id` — one per component. Acts as a frozen snapshot so the exact breakdown is preserved even if structures change in the future.
 
The `component_type` column classifies each row into one of four categories:
- **fix_rate** — fixed monthly rates defined in the salary structure
- **earning** — actual earned amounts calculated from attendance
- **deduction** — amounts deducted from the employee's gross
- **employer_contribution** — statutory contributions borne by the employer (not deducted from employee)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `salary_history_id` | UUID | Foreign key → `salary_history.id` |
| `component_name` | STRING | Name of the component (see Component Registry below) |
| `component_type` | STRING | Category — fix_rate, earning, deduction, employer_contribution |
| `amount` | FLOAT | The computed value of this component for that month |
| `note` | STRING | Optional explanation — e.g. "2 days LOP at ₹1,613/day" |
 
### Component Registry
All standard components stored as rows in `salary_components`, grouped by `component_type`.
 
#### fix_rate — Fixed Monthly Rates (from salary structure)
| Component Name | Description |
|---|---|
| `Basic Allowance` | Fixed basic pay rate as defined in salary structure |
| `HRA Allowance` | Fixed house rent allowance rate |
| `Conveyance Allowance` | Fixed conveyance/transport allowance rate |
| `Medical Allowance` | Fixed medical allowance rate |
 
#### earning — Actual Earned Amounts (calculated from attendance)
| Component Name | Description |
|---|---|
| `ERN Basic` | Earned basic pay after applying attendance ratio |
| `ERN HRA` | Earned HRA after applying attendance ratio |
| `ERN Conveyance` | Earned conveyance allowance after applying attendance ratio |
| `ERN Medical` | Earned medical allowance after applying attendance ratio |
| `OT Hours` | Number of overtime hours worked that month |
| `OT Amount` | Monetary value of overtime hours |
| `Other Earnings` | Any additional ad hoc earnings |
 
#### deduction — Employee-Side Deductions
| Component Name | Description |
|---|---|
| `Employee PF 12%` | Employee's provident fund contribution at 12% of basic |
| `Employee ESIC 0.75%` | Employee's ESIC contribution at 0.75% of gross |
| `Professional Tax` | State-levied professional tax (PT) |
| `Employee MLWF` | Employee's Maharashtra Labour Welfare Fund contribution (₹12) |
| `Advance` | Recovery of salary advance given to employee |
| `Loan` | Recovery of loan instalment |
| `TDS` | Tax deducted at source on salary |
 
#### employer_contribution — Employer-Side Statutory Costs
| Component Name | Description |
|---|---|
| `Employer PF 12%` | Employer's matching PF contribution at 12% of basic |
| `Employer PF Admin 1%` | Employer's PF administrative charge at 1% |
| `Employer Total PF` | Sum of employer PF 12% + admin 1% |
| `Employee + Employer PF 25%` | Combined employee and employer PF (used for CTC computation) |
| `Employer ESIC 3.25%` | Employer's ESIC contribution at 3.25% of gross |
| `Employee + Employer ESIC 4%` | Combined employee and employer ESIC (0.75% + 3.25%) |
| `Employer MLWF` | Employer's Maharashtra Labour Welfare Fund contribution (₹36) |
| `Employee + Employer MLWF` | Combined MLWF (₹12 + ₹36 = ₹48) |
