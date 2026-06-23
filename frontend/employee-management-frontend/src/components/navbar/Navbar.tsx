'use client';
 
import { useState } from "react";
import { usePathname } from 'next/navigation';
import styles from './Navbar.module.css';
import { useUser, useIsEmployee } from '@/hooks/useUser';
import { getAccessToken } from "@/lib/tokenStorage";
import { ApiError } from "@/services/api/auth";

export default function Navbar() {
  const pathname = usePathname();
  const user = useUser();
  const isEmp = useIsEmployee();
  const base = '/' + (pathname.split('/')[1] || '');
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ password: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
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
        <div className={styles.ChangePassword} onClick={() => setPwOpen(true)} title="Change password" style={{cursor:"pointer"}}>
          <div className={styles.avatar}>Change Password</div>
        </div>

        {pwOpen && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:24}}>
            <div style={{background:"var(--bg-card)",borderRadius:"var(--radius-lg)",width:"100%",maxWidth:380,display:"flex",flexDirection:"column",boxShadow:"0 8px 40px rgba(0,0,0,0.18)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px 16px",borderBottom:"1px solid var(--border-default)"}}>
                <h2 style={{fontSize:17,fontWeight:700,color:"var(--text-primary)",margin:0}}>Change Password</h2>
                <button style={{background:"none",border:"none",fontSize:16,color:"var(--text-muted)",cursor:"pointer"}} onClick={()=>{setPwOpen(false);setPwError(null);setPwSuccess(false);setPwForm({password:"",confirm:""})}}>✕</button>
              </div>
              <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:14}}>
                {pwError && <div style={{padding:"8px 12px",background:"#fff5f5",border:"1px solid #fecaca",borderRadius:"var(--radius-md)",fontSize:13,color:"#c0392b"}}>{pwError}</div>}
                {pwSuccess && <div style={{padding:"8px 12px",background:"#e6f7ee",border:"1px solid #a7f3d0",borderRadius:"var(--radius-md)",fontSize:13,color:"#1a7c4a"}}>Password updated successfully.</div>}
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  <label style={{fontSize:12.5,fontWeight:500}}>New Password</label>
                  <input type="password" value={pwForm.password} onChange={e=>setPwForm(f=>({...f,password:e.target.value}))} style={{height:36,border:"1px solid var(--border-default)",borderRadius:"var(--radius-md)",padding:"0 10px",fontSize:13.5,outline:"none",fontFamily:"inherit"}} placeholder="Min. 8 characters"/>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  <label style={{fontSize:12.5,fontWeight:500}}>Confirm Password</label>
                  <input type="password" value={pwForm.confirm} onChange={e=>setPwForm(f=>({...f,confirm:e.target.value}))} style={{height:36,border:"1px solid var(--border-default)",borderRadius:"var(--radius-md)",padding:"0 10px",fontSize:13.5,outline:"none",fontFamily:"inherit"}} placeholder="Repeat password"/>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"flex-end",gap:10,padding:"16px 24px",borderTop:"1px solid var(--border-default)"}}>
                <button style={{height:36,padding:"0 14px",background:"var(--bg-card)",border:"1px solid var(--border-default)",borderRadius:"var(--radius-md)",fontSize:13,cursor:"pointer"}} onClick={()=>{setPwOpen(false);setPwError(null);setPwSuccess(false);setPwForm({password:"",confirm:""})}}>Cancel</button>
                <button disabled={pwSaving} style={{height:36,padding:"0 16px",background:"var(--brand-orange)",color:"#fff",border:"none",borderRadius:"var(--radius-md)",fontSize:13,fontWeight:600,cursor:pwSaving?"not-allowed":"pointer",opacity:pwSaving?0.55:1}} onClick={async()=>{
                  setPwError(null);setPwSuccess(false);
                  if(pwForm.password.length<8){setPwError("Password must be at least 8 characters.");return;}
                  if(pwForm.password!==pwForm.confirm){setPwError("Passwords do not match.");return;}
                  setPwSaving(true);
                  try{
                    const token=getAccessToken();
                    const res=await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/password`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({password:pwForm.password})});
                    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.detail??"Failed");}
                    setPwSuccess(true);setPwForm({password:"",confirm:""});
                  }catch(e:unknown){setPwError(e instanceof Error?e.message:"Failed to update password.");}
                  finally{setPwSaving(false);}
                }}>{pwSaving?"Saving…":"Update Password"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}