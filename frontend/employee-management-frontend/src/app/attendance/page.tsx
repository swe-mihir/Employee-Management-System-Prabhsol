"use client";
import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import DailyView from "./DailyView";
import EmployeeView from "./EmployeeView";
import styles from "./attendance.module.css";

export default function AttendancePage() {
  const [tab, setTab] = useState<"daily" | "employee">("daily");

  return (
    <AppShell>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <h1 className={styles.title}>Attendance</h1>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${tab === "daily" ? styles.tabActive : ""}`} onClick={() => setTab("daily")}>Daily View</button>
            <button className={`${styles.tab} ${tab === "employee" ? styles.tabActive : ""}`} onClick={() => setTab("employee")}>Employee View</button>
          </div>
        </div>
        {tab === "daily" ? <DailyView /> : <EmployeeView />}
      </div>
    </AppShell>
  );
}