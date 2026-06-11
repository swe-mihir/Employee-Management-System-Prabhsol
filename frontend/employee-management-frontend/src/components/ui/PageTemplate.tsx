import styles from './PageTemplate.module.css';

interface PageTemplateProps {
  title: string;
  description: string;
  actionLabel?: string;
  children?: React.ReactNode;
}

export default function PageTemplate({ title, description, actionLabel, children }: PageTemplateProps) {
  return (
    <div className={styles.root}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <h2 className={styles.heading}>{title}</h2>
          <p className={styles.subheading}>{description}</p>
        </div>
        {actionLabel && <button className={styles.primaryBtn}>{actionLabel}</button>}
      </div>

      {children ?? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="6" width="24" height="20" rx="3" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10 13h12M10 18h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p className={styles.emptyTitle}>No data yet</p>
          <p className={styles.emptyBody}>
            Content for <strong>{title}</strong> will appear here once connected to the API.
          </p>
        </div>
      )}
    </div>
  );
}