'use client';
import AppShell from '@/components/layout/AppShell';
import PageTemplate from '@/components/ui/PageTemplate';
import { useRoleGuard } from '@/hooks/useRoleGuard';

export default function PayrollPage() {
  useRoleGuard(['admin', 'manager'], '/attendance');
  return (
    <AppShell>
      <PageTemplate
        title="Payroll"
        description="Manage payroll runs, deductions, and disbursements"
        actionLabel="Run Payroll"
      />
    </AppShell>
  );
}