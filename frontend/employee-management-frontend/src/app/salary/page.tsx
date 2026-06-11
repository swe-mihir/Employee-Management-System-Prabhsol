import AppShell from '@/components/layout/AppShell';
import PageTemplate from '@/components/ui/PageTemplate';

export default function SalaryPage() {
  return (
    <AppShell>
      <PageTemplate
        title="Salary"
        description="Configure salary structures, grades, and revision history"
        actionLabel="+ Add Structure"
      />
    </AppShell>
  );
}