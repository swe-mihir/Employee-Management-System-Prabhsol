'use client';

import AppShell from '@/components/layout/AppShell';
import PageTemplate from '@/components/ui/PageTemplate';

import { useRoleGuard } from '@/hooks/useRoleGuard';

export default function DashboradPage() {
  useRoleGuard(['admin', 'manager'], '/attendance');
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