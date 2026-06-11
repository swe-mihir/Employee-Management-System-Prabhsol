import AppShell from '@/components/layout/AppShell';
import PageTemplate from '@/components/ui/PageTemplate';

export default function UsersPage() {
  return (
    <AppShell>
      <PageTemplate
        title="Users"
        description="Manage system access, roles, and permissions"
        actionLabel="+ Invite User"
      />
    </AppShell>
  );
}