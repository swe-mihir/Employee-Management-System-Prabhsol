import AppShell from '@/components/layout/AppShell';
import PageTemplate from '@/components/ui/PageTemplate';

export default function SettingsPage() {
  return (
    <AppShell>
      <PageTemplate
        title="Settings"
        description="Configure system preferences, integrations, and notifications"
      />
    </AppShell>
  );
}