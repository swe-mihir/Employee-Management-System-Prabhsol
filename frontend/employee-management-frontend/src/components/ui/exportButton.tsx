// src/components/ui/ExportButton.tsx
"use client";

import { useRef, useState, useEffect } from "react";
import styles from "./ExportButton.module.css";

interface ExportButtonProps {
  onExportExcel: () => void;
  onExportPDF: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function ExportButton({
  onExportExcel,
  onExportPDF,
  disabled = false,
  loading = false,
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled || loading}
        aria-haspopup="true"
        aria-expanded={open}
        title="Export table"
      >
        {loading ? (
          <span className={styles.spinner} aria-hidden />
        ) : (
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            aria-hidden
          >
            <path
              d="M7.5 1v9m0 0L4.5 7M7.5 10l3-3M2 13h11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        Export
        <svg
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
        >
          <path
            d="M2.5 4.5L6 8l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className={styles.dropdown} role="menu">
          <button
            className={styles.item}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onExportExcel();
            }}
          >
            {/* Excel icon */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect x="1" y="1" width="14" height="14" rx="2" fill="#1D6F42" />
              <path
                d="M4 5l2.5 3L4 11h1.5l1.75-2.2L9 11h1.5L8 8l2.5-3H9L7.25 7.2 5.5 5H4z"
                fill="white"
              />
            </svg>
            Excel (.xlsx)
          </button>
          <button
            className={styles.item}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onExportPDF();
            }}
          >
            {/* PDF icon */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect x="1" y="1" width="14" height="14" rx="2" fill="#E53935" />
              <text x="3" y="11" fontSize="7" fontWeight="bold" fill="white" fontFamily="helvetica">
                PDF
              </text>
            </svg>
            PDF (.pdf)
          </button>
        </div>
      )}
    </div>
  );
}