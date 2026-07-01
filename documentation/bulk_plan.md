Here's a detailed task brief you can hand to another Claude session.

---

## Task: Bank Bulk-Payment Export Endpoint

### Background

This is a payroll system (FastAPI + SQLAlchemy backend, Next.js frontend) for managing employees, attendance, and salary. We need a new feature: generate a bank bulk-payment file so salaries can be uploaded to the company's bank portal in one batch, instead of paying each employee manually.

The bank (looks like a Co-operative bank's CIB corporate portal) requires a `.txt` file where each line represents one payment instruction, in this exact pipe-delimited format:

```
PRB|<TransactionType>|<Amount>|INR|<BeneID>|<DebitAccountNumber>|0011|<Remarks>|N|PRBNBB^
```

Example line:
```
PRB|NFT|9000|INR|117915555|121212121212|0011|SachinSalaviSal|N|PRBNBB^
```

Field meanings:
- `PRB` — fixed literal prefix
- `TransactionType` — one of `WIB` (within bank), `NFT` (NEFT), `RTG` (RTGS), `IFC` (IMPS)
- `Amount` — payment amount, max 15 digits total including decimals (e.g. `9000` or `9000.50`)
- `INR` — fixed literal currency
- `BeneID` — the employee's pre-registered beneficiary ID with the bank
- `DebitAccountNumber` — company's own bank account being debited; exactly 12 digits; same for every row in a batch
- `0011` — fixed literal (likely a bank product/scheme code)
- `Remarks` — free text, max 30 characters, shows on the employee's bank statement
- `N` — fixed literal
- `PRBNBB^` — fixed literal suffix (looks like bank's SWIFT/branch code + line terminator)

This format came from a manually-maintained Excel sheet that HR currently fills in by hand. We want to replace that manual process with an API endpoint that generates this file automatically from payroll data already in the database.

### Database schema (relevant tables)

**`employees`** — id (uuid, PK), name, etc.

**`employee_salary_structure`** — one row per employee per effective period (has `effective_from` / `effective_to` date range, so an employee can have multiple structures over time as salary changes). Relevant columns:
- `employee_id` (uuid, FK → employees.id)
- `effective_from`, `effective_to` (date, `effective_to` can be NULL meaning "currently active")
- `transaction_type` (varchar(3)) — WIB/NFT/RTG/IFC
- `bene_id` (varchar(34)) — the bank's registered beneficiary ID
- `remarks` (varchar(30)) — text for the bank statement remark field
- (also has account_name, account_number, bank_name, etc. — not used in this export, that data is informational/legacy)

**`salary_history`** — one row per employee per month/year (payroll run). Relevant columns:
- `employee_id` (uuid, FK → employees.id)
- `month` (smallint), `year` (smallint)
- `net_salary` (numeric(12,2)) — the actual amount to be paid out, this is the `Amount` field in the bank file
- `status` (varchar(30), default `'pending'`) — payroll workflow status (need to confirm what status means "ready/approved to be paid out", e.g. could be `'approved'` or `'paid'`)
- `paid_at` (timestamp, nullable)

### The core logic needed

1. **Input**: month + year (e.g. month=6, year=2026), provided as query params to the new endpoint.

2. **Query**: For every employee, join `salary_history` (filtered to that month/year, and to whatever status means "approved/ready for disbursal") with the **currently-active row** of `employee_salary_structure` for that employee — i.e. the structure row where `effective_from <= <some reference date for that payroll month> ` and (`effective_to IS NULL` OR `effective_to >= <reference date>`). The reference date should probably be the first or last day of the payroll month — need to confirm with the team or just use last day of month as a sane default.

3. **Validation per row** before including it in the output:
   - `transaction_type` must be one of WIB/NFT/RTG/IFC
   - `bene_id` must not be null/empty
   - `remarks` must be ≤ 30 characters
   - `net_salary` (amount) must be a positive number, and the rounded value must not exceed 15 digits total
   - If any employee fails validation, they should be **skipped and reported back** (not silently dropped) — e.g. return a list of "skipped employees with reasons" alongside the file, or as a separate `/preview` endpoint that shows what would be included/excluded before actually downloading.

4. **Format each valid row** as:
   ```
   PRB|{transaction_type}|{round(net_salary, 2)}|INR|{bene_id}|{DEBIT_ACCOUNT}|0011|{remarks}|N|PRBNBB^
   ```
   Where `DEBIT_ACCOUNT` is a **fixed constant** (the company's own account number, 12 digits) — this is NOT per-employee, it's the same on every line. This should probably live in environment variables/config, not hardcoded, since it's sensitive financial data.

5. **Output**: Return the assembled text (one instruction per line, newline-separated) as a downloadable `.txt` file via FastAPI's `Response` or `StreamingResponse` with `Content-Disposition: attachment; filename=...`, content-type `text/plain`.

### Suggested endpoints

- `GET /api/payroll/bank-export/preview?month=6&year=2026` — returns JSON: `{ included: [...], skipped: [{employee_id, employee_name, reason}] }` so HR can review before downloading.
- `GET /api/payroll/bank-export?month=6&year=2026` — returns the actual `.txt` file download, presumably only allowing this after preview/confirmation, or just generating directly (decide based on existing UX patterns in the app).

Should probably be restricted to an admin/HR role only (check how other sensitive endpoints in this app handle role-based auth, e.g. via a dependency like `require_role("admin")`).

### What the other Claude session will need from you to do this properly

Before writing code, it should ask you for:
1. The existing SQLAlchemy models for `Employee`, `EmployeeSalaryStructure`, `SalaryHistory`.
2. An example of an existing router file in this codebase (to match style/conventions, dependency injection for DB session and auth).
3. How role-based auth is implemented (decorator/dependency name).
4. What `salary_history.status` value indicates "approved for payout" (e.g. `'approved'` vs `'paid'`).
5. Where config/env vars are loaded from (e.g. `settings.py`, `.env` keys) — to add `BANK_DEBIT_ACCOUNT`, `BANK_TRACE_ACCOUNT`, `BANK_FILE_REMARK` constants there rather than hardcoding.
6. Confirmation on the reference date logic for "which salary structure was active for this payroll month" (start of month vs end of month).

That last section is basically the checklist — have it ask those before writing any code, same as I did here.