import AppShell from '@/components/layout/AppShell';
import PageTemplate from '@/components/ui/PageTemplate';

export default function AttendancePage() {
  return (
    <AppShell>
      <PageTemplate
        title="Attendance"
        description="Track daily check-ins, absences, and leave records"
        actionLabel="+ Mark Attendance"
      />
    </AppShell>
  );
}