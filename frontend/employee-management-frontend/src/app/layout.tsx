import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Prabhsol — Employee Management',
  description: 'Internal HR and workforce management system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}