import AppShell from '@/components/layout/AppShell';
import PageTemplate from '@/components/ui/PageTemplate';

export default function EmployeesPage() {
  return (
    <AppShell>
      <PageTemplate
        title="Employees"
        description="Configure Employees"
        actionLabel="+ Add Structure"
      />
    </AppShell>
  );
}