import Sidebar from '@/components/sidebar/Sidebar';
import Navbar from '@/components/navbar/Navbar';
import styles from './AppShell.module.css';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>
        <Navbar />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}