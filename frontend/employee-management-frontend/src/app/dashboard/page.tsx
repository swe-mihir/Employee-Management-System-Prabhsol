import AppShell from '@/components/layout/AppShell';
import PageTemplate from '@/components/ui/PageTemplate';

export default function DashboradPage() {
  return (
    <AppShell>
      <PageTemplate
        title="Dashboard"
        description="Configure dashboard"
        actionLabel="+ Add Structure"
      />
    </AppShell>
  );
}