-- ============================================================
-- Payroll Schema
-- Run this in order — dependencies are respected top-to-bottom
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- 1. employees
-- ------------------------------------------------------------
CREATE TABLE employees (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(255)  NOT NULL,
    date_of_birth    DATE,
    department       VARCHAR(100),
    designation      VARCHAR(100),
    join_date        DATE          NOT NULL,
    leaving_date     DATE,
    is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
    personal_phone   VARCHAR(20),
    work_phone       VARCHAR(20),
    personal_email   VARCHAR(255),
    work_email       VARCHAR(255),
    aadhar_no        VARCHAR(12)   UNIQUE,
    pan_no           VARCHAR(10)   UNIQUE,
    pf_no            VARCHAR(12),
    ip_no            VARCHAR(12)
);

-- ------------------------------------------------------------
-- 2. attendance
-- ------------------------------------------------------------
CREATE TABLE attendance (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id  UUID        NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    date         DATE        NOT NULL,
    status       VARCHAR(50) NOT NULL,   -- 'present' | 'absent' | 'half-day' | 'leave'
    clock_in     TIME,
    clock_out    TIME,
    hours_worked FLOAT,
    UNIQUE (employee_id, date)
);

-- ------------------------------------------------------------
-- 3. employee_salary_structure
-- ------------------------------------------------------------
CREATE TABLE employee_salary_structure (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id         UUID          NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    base_salary         NUMERIC(12,2) NOT NULL,
    hra                 NUMERIC(12,2) NOT NULL DEFAULT 0,
    transport_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
    other_allowances    NUMERIC(12,2) NOT NULL DEFAULT 0,
    pay_cycle           VARCHAR(20)   NOT NULL DEFAULT 'monthly',  -- 'monthly' | 'weekly'
    effective_from      DATE          NOT NULL,
    effective_to        DATE
);

-- ------------------------------------------------------------
-- 4. salary_history
-- ------------------------------------------------------------
CREATE TABLE salary_history (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id      UUID          NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    month            SMALLINT      NOT NULL CHECK (month BETWEEN 1 AND 12),
    year             SMALLINT      NOT NULL CHECK (year >= 2000),
    days_present     SMALLINT      NOT NULL DEFAULT 0,
    days_absent      SMALLINT      NOT NULL DEFAULT 0,
    leaves_taken     SMALLINT      NOT NULL DEFAULT 0,
    gross_salary     NUMERIC(12,2) NOT NULL,
    total_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_salary       NUMERIC(12,2) NOT NULL,
    total_ctc        NUMERIC(12,2) NOT NULL,
    status           VARCHAR(30)   NOT NULL DEFAULT 'pending',   -- 'pending' | 'approved' | 'paid'
    calculated_at    TIMESTAMPTZ,
    paid_at          TIMESTAMPTZ,
    UNIQUE (employee_id, month, year)
);

-- ------------------------------------------------------------
-- 5. salary_components  (depends on salary_history)
-- ------------------------------------------------------------
CREATE TABLE salary_components (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salary_history_id UUID          NOT NULL REFERENCES salary_history(id) ON DELETE RESTRICT,
    component_name    VARCHAR(100)  NOT NULL,
    component_type    VARCHAR(30)   NOT NULL,   -- 'earning' | 'deduction'
    amount            NUMERIC(12,2) NOT NULL,
    note              TEXT
);

-- ------------------------------------------------------------
-- 6. users  (depends on employees)
-- ------------------------------------------------------------
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    employee_id   UUID         UNIQUE REFERENCES employees(id) ON DELETE RESTRICT,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 7. roles
-- ------------------------------------------------------------
CREATE TABLE roles (
    id        SERIAL PRIMARY KEY,
    role_name VARCHAR(100) NOT NULL UNIQUE
);

-- ------------------------------------------------------------
-- 8. permissions
-- ------------------------------------------------------------
CREATE TABLE permissions (
    id              SERIAL PRIMARY KEY,
    permission_name VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT
);

-- ------------------------------------------------------------
-- 9. user_roles  (junction: users ↔ roles)
-- ------------------------------------------------------------
CREATE TABLE user_roles (
    user_id     INT         NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
    role_id     INT         NOT NULL REFERENCES roles(id)  ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- ------------------------------------------------------------
-- 10. role_permissions  (junction: roles ↔ permissions)
-- ------------------------------------------------------------
CREATE TABLE role_permissions (
    role_id       INT NOT NULL REFERENCES roles(id)       ON DELETE RESTRICT,
    permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE RESTRICT,
    PRIMARY KEY (role_id, permission_id)
);

-- ------------------------------------------------------------
-- 11. deletion_audit_log
--     Immutable record of every hard delete in the system.
--     Rows are NEVER deleted from this table.
-- ------------------------------------------------------------
CREATE TABLE deletion_audit_log (
    id            BIGSERIAL    PRIMARY KEY,
    deleted_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_by    INT          REFERENCES users(id) ON DELETE RESTRICT,
    table_name    VARCHAR(100) NOT NULL,
    record_id     TEXT         NOT NULL,
    reason        TEXT         NOT NULL,
    snapshot      JSONB        NOT NULL
);

CREATE RULE no_delete_audit_log AS ON DELETE TO deletion_audit_log DO INSTEAD NOTHING;
CREATE RULE no_update_audit_log AS ON UPDATE TO deletion_audit_log DO INSTEAD NOTHING;

-- ------------------------------------------------------------
-- 12. activity_log
--     Automatic record of every INSERT, UPDATE, and DELETE
--     across all sensitive tables. Written by triggers —
--     never by the application directly.
--     Rows are NEVER deleted or updated from this table.
-- ------------------------------------------------------------
CREATE TABLE activity_log (
    id           BIGSERIAL    PRIMARY KEY,
    occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    -- app_user_id is set by the app via:
    --   SET LOCAL app.current_user_id = '<id>';
    -- inside the same transaction before the write.
    performed_by INT          REFERENCES users(id) ON DELETE RESTRICT,
    operation    VARCHAR(10)  NOT NULL,              -- 'INSERT' | 'UPDATE' | 'DELETE'
    table_name   VARCHAR(100) NOT NULL,
    record_id    TEXT         NOT NULL,              -- stringified PK of the affected row
    old_data     JSONB,                              -- NULL on INSERT
    new_data     JSONB,                              -- NULL on DELETE
    changed_fields TEXT[]                            -- column names that changed (UPDATE only)
);

CREATE RULE no_delete_activity_log AS ON DELETE TO activity_log DO INSTEAD NOTHING;
CREATE RULE no_update_activity_log AS ON UPDATE TO activity_log DO INSTEAD NOTHING;

-- ============================================================
-- Audit trigger function
-- Fires after every INSERT / UPDATE / DELETE on audited tables.
-- The application must run this before any write in its txn:
--   SET LOCAL app.current_user_id = '<users.id>';
-- ============================================================
CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record_id  TEXT;
    v_old        JSONB;
    v_new        JSONB;
    v_changed    TEXT[];
    v_user_id    INT;
BEGIN
    -- Resolve the acting user from the session variable (set by the app)
    BEGIN
        v_user_id := current_setting('app.current_user_id')::INT;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;  -- allow writes from migrations / seeds without crashing
    END;

    IF TG_OP = 'INSERT' THEN
        v_record_id := NEW.id::TEXT;
        v_new       := to_jsonb(NEW);
        v_old       := NULL;
        v_changed   := NULL;

    ELSIF TG_OP = 'UPDATE' THEN
        v_record_id := NEW.id::TEXT;
        v_old       := to_jsonb(OLD);
        v_new       := to_jsonb(NEW);
        -- Capture only the column names that actually changed
        SELECT array_agg(key)
        INTO   v_changed
        FROM   jsonb_each(v_old) AS o(key, val)
        WHERE  val IS DISTINCT FROM (v_new -> key);

    ELSIF TG_OP = 'DELETE' THEN
        v_record_id := OLD.id::TEXT;
        v_old       := to_jsonb(OLD);
        v_new       := NULL;
        v_changed   := NULL;
    END IF;

    INSERT INTO activity_log
        (performed_by, operation, table_name, record_id, old_data, new_data, changed_fields)
    VALUES
        (v_user_id, TG_OP, TG_TABLE_NAME, v_record_id, v_old, v_new, v_changed);

    RETURN NULL;  -- AFTER trigger; return value is ignored
END;
$$;

-- ============================================================
-- Attach the trigger to every audited table
-- ============================================================
CREATE TRIGGER audit_employees
    AFTER INSERT OR UPDATE OR DELETE ON employees
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER audit_attendance
    AFTER INSERT OR UPDATE OR DELETE ON attendance
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER audit_employee_salary_structure
    AFTER INSERT OR UPDATE OR DELETE ON employee_salary_structure
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER audit_salary_history
    AFTER INSERT OR UPDATE OR DELETE ON salary_history
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER audit_salary_components
    AFTER INSERT OR UPDATE OR DELETE ON salary_components
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER audit_user_roles
    AFTER INSERT OR UPDATE OR DELETE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER audit_role_permissions
    AFTER INSERT OR UPDATE OR DELETE ON role_permissions
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_attendance_employee_date  ON attendance(employee_id, date);
CREATE INDEX idx_salary_history_employee   ON salary_history(employee_id);
CREATE INDEX idx_salary_components_history ON salary_components(salary_history_id);
CREATE INDEX idx_emp_salary_structure_emp  ON employee_salary_structure(employee_id);
CREATE INDEX idx_users_employee            ON users(employee_id);

CREATE INDEX idx_audit_log_table_record    ON deletion_audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_deleted_by      ON deletion_audit_log(deleted_by);
CREATE INDEX idx_audit_log_deleted_at      ON deletion_audit_log(deleted_at);

CREATE INDEX idx_activity_log_table        ON activity_log(table_name, record_id);
CREATE INDEX idx_activity_log_performed_by ON activity_log(performed_by);
CREATE INDEX idx_activity_log_occurred_at  ON activity_log(occurred_at);
CREATE INDEX idx_activity_log_operation    ON activity_log(operation);
