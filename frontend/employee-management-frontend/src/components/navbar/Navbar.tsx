'use client';

import { usePathname } from 'next/navigation';
import styles from './Navbar.module.css';
import { useUser, useIsEmployee } from '@/hooks/useUser';

export default function Navbar() {
  const pathname = usePathname();
  const user = useUser();
  const isEmp = useIsEmployee();
  const base = '/' + (pathname.split('/')[1] || '');

  const pageTitles: Record<string, { title: string; description: string }> = {
    '/dashboard':  { title: 'Dashboard',  description: 'Overview of workforce activity' },
    '/employees':  { title: 'Employees',  description: 'Manage employee records' },
    '/attendance': isEmp
      ? { title: 'My Attendance', description: 'Your attendance records' }
      : { title: 'Attendance',    description: 'Track and review attendance' },
    '/payroll':    { title: 'Payroll',    description: 'Process and manage payroll runs' },
    '/salary': isEmp
      ? { title: 'My Payslips', description: 'Your salary and payslip history' }
      : { title: 'Salary',      description: 'Salary structures and revisions' },
    '/users':      { title: 'Users',      description: 'System user access and roles' },
    '/settings':   { title: 'Settings',   description: 'System configuration' },
  };

  const page = pageTitles[base] ?? { title: 'Prabhsol', description: '' };

  function getInitials(name: string, email: string) {
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (email || 'U').slice(0, 2).toUpperCase();
  }

  const initials = getInitials(user?.employee_name ?? '', user?.email ?? '');

  return (
    <header className={styles.navbar}>
      <div className={styles.left}>
        <h1 className={styles.pageTitle}>{page.title}</h1>
        {page.description && <span className={styles.pageDesc}>{page.description}</span>}
      </div>
      <div className={styles.right}>
        <div className={styles.searchBox}>
          <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input className={styles.searchInput} type="text" placeholder="Search…" />
        </div>
        <button className={styles.iconBtn} title="Notifications">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2C9 2 5 4 5 9v4H4v1.5h10V13h-1V9c0-5-4-7-4-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M7.5 14.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span className={styles.badge}>3</span>
        </button>
        <div className={styles.avatarBtn}>
          <div className={styles.avatar}>{initials}</div>
        </div>
      </div>
    </header>
  );
}