import AppShell from '@/components/layout/AppShell';
import PageTemplate from '@/components/ui/PageTemplate';

export default function PayrollPage() {
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