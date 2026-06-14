'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './Sidebar.module.css';
import { useUser, useIsEmployee } from '@/hooks/useUser';

interface NavItem {
  label: string;
  href: string;
  roles: string[]; // empty = all
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard', href: '/dashboard', roles: ['admin', 'manager'],
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="10" y="1" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="10" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="10" y="10" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>,
  },
  {
    label: 'Employees', href: '/employees', roles: ['admin', 'manager'],
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5"/><path d="M2 15.5c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    label: 'Attendance', href: '/attendance', roles: [],
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1.5" y="3" width="15" height="13.5" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M1.5 7.5h15" stroke="currentColor" strokeWidth="1.5"/><path d="M5.5 1.5v3M12.5 1.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M5.5 11.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    label: 'Payroll', href: '/payroll', roles: ['admin', 'manager'],
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1.5" y="3.5" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1.5 6.5h2.5M14 6.5h2.5M1.5 11.5h2.5M14 11.5h2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    label: 'Salary', href: '/salary', roles: [],
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 5H18M6 9H18M6 5C8 5 10 5 12 5C14.5 5 16 6.5 16 9C16 11.5 14.5 13 12 13H6L16 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    label: 'Users', href: '/users', roles: ['admin'],
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="6.5" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M1 15c0-2.761 2.462-5 5.5-5S12 12.239 12 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M13 8l1.5 1.5L17 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    label: 'Settings', href: '/settings', roles: ['admin'],
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M9 1.5v1.75M9 14.75V16.5M16.5 9h-1.75M3.25 9H1.5M14.36 3.64l-1.237 1.237M4.877 13.123L3.64 14.36M14.36 14.36l-1.237-1.237M4.877 4.877L3.64 3.64" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
];

function getInitials(name: string, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function getRoleLabel(roles: string[]): string {
  if (roles.includes('admin')) return 'Admin';
  if (roles.includes('manager')) return 'Manager';
  if (roles.includes('employee')) return 'Employee';
  return '';
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUser();
  const isEmp = useIsEmployee();

  const userRoles = user?.roles ?? [];

  const visible = navItems
    .filter(item => item.roles.length === 0 || item.roles.some(r => userRoles.includes(r)))
    .map(item => ({
      ...item,
      label:
        isEmp && item.href === '/attendance' ? 'My Attendance'
        : isEmp && item.href === '/salary' ? 'My Payslips'
        : item.label,
    }));

  const initials = getInitials(user?.employee_name ?? '', user?.email ?? '');
  const roleLabel = getRoleLabel(userRoles);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoArea}>
        <div className={styles.logoMark}>PS</div>
        <div className={styles.logoText}>
          <span className={styles.logoName}>Prabhsol</span>
          <span className={styles.logoSub}>Delivering Solutions</span>
        </div>
      </div>

      <nav className={styles.nav}>
        <span className={styles.navLabel}>Main Menu</span>
        <ul className={styles.navList}>
          {visible.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link href={item.href} className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span className={styles.navItemLabel}>{item.label}</span>
                  {isActive && <span className={styles.activeIndicator} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.userRow}>
          <div className={styles.userAvatar}>{initials}</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.employee_name || user?.email || '—'}</span>
            <span className={styles.userRole}>{roleLabel}</span>
          </div>
        </div>
        <button className={styles.logoutBtn} onClick={() => router.push('/login')} title="Sign out">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 2H2.5A1.5 1.5 0 001 3.5v9A1.5 1.5 0 002.5 14H6M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}