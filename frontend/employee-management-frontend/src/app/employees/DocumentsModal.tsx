"use client";
import { useState, useEffect, useRef } from "react";
import {
  fetchDocuments, uploadDocument, deleteDocument,
  getViewUrl, getDownloadUrl,
  EmployeeDocument, DOCUMENT_CATEGORIES,
} from "@/services/api/documents";
import { getAccessToken } from "@/lib/tokenStorage";
import styles from "./documents.module.css";

interface Props {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(s: string) {
  try { return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return s; }
}

export default function DocumentsModal({ employeeId, employeeName, onClose }: Props) {
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [category, setCategory] = useState(DOCUMENT_CATEGORIES[0]);
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<EmployeeDocument | null>(null);

  const token = getAccessToken();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDocuments(employeeId);
      setDocs(data.items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleUpload() {
    if (!file || !label.trim()) { setUploadError("Label and file are required."); return; }
    setUploading(true);
    setUploadError(null);
    try {
      await uploadDocument(employeeId, category, label.trim(), file);
      setUploadOpen(false);
      setLabel("");
      setFile(null);
      setCategory(DOCUMENT_CATEGORIES[0]);
      load();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: EmployeeDocument) {
    if (!confirm(`Delete "${doc.label}" (${doc.filename})?`)) return;
    setDeletingId(doc.id);
    try {
      await deleteDocument(employeeId, doc.id);
      setDocs(d => d.filter(x => x.id !== doc.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const grouped = DOCUMENT_CATEGORIES.reduce<Record<string, EmployeeDocument[]>>((acc, cat) => {
    acc[cat] = docs.filter(d => d.category === cat);
    return acc;
  }, {} as Record<string, EmployeeDocument[]>);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Documents</h2>
            <p className={styles.sub}>{employeeName}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className={styles.btnPrimary} onClick={() => { setUploadError(null); setUploadOpen(true); }}>+ Upload</button>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        <div className={styles.body}>
          {error && <div className={styles.errorBanner}>{error}</div>}
          {loading ? (
            <p className={styles.empty}>Loading…</p>
          ) : docs.length === 0 ? (
            <p className={styles.empty}>No documents uploaded yet.</p>
          ) : (
            DOCUMENT_CATEGORIES.map(cat => {
              const items = grouped[cat];
              if (!items.length) return null;
              return (
                <div key={cat} className={styles.group}>
                  <p className={styles.groupLabel}>{cat}</p>
                  {items.map(doc => (
                    <div key={doc.id} className={styles.docRow}>
                      <div className={styles.docIcon}>
                        {doc.mime_type === "application/pdf" ? "📄" : "🖼️"}
                      </div>
                      <div className={styles.docInfo}>
                        <span className={styles.docLabel}>{doc.label}</span>
                        <span className={styles.docMeta}>{doc.filename} · {formatBytes(doc.size_bytes)} · {formatDate(doc.uploaded_at)}</span>
                      </div>
                      <div className={styles.docActions}>
                        <button className={styles.actionBtn} onClick={() => setPreviewDoc(doc)}>View</button>
                        <a
                          className={styles.actionBtn}
                          href={`${getDownloadUrl(employeeId, doc.id)}?token=${token}`}
                          download={doc.filename}>
                            Download
                        </a>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(doc)}
                          disabled={deletingId === doc.id}
                        >
                          {deletingId === doc.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* Upload sub-modal */}
        {uploadOpen && (
          <div className={styles.subOverlay} onClick={() => setUploadOpen(false)}>
            <div className={styles.subModal} onClick={e => e.stopPropagation()}>
              <div className={styles.header}>
                <h3 className={styles.title}>Upload Document</h3>
                <button className={styles.closeBtn} onClick={() => setUploadOpen(false)}>✕</button>
              </div>
              <div className={styles.subBody}>
                {uploadError && <div className={styles.errorBanner}>{uploadError}</div>}
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Category *</label>
                  <select className={styles.fieldInput} value={category} onChange={e => setCategory(e.target.value as typeof category)}>
                    {DOCUMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Label *</label>
                  <input className={styles.fieldInput} value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Aadhaar Card" />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>File *</label>
                  <input ref={fileRef} type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  {file && <span style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{file.name} ({formatBytes(file.size)})</span>}
                </div>
              </div>
              <div className={styles.subFooter}>
                <button className={styles.btnSecondary} onClick={() => setUploadOpen(false)}>Cancel</button>
                <button className={styles.btnPrimary} onClick={handleUpload} disabled={uploading}>
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Preview modal */}
        {previewDoc && (
          <div className={styles.subOverlay} onClick={() => setPreviewDoc(null)}>
            <div className={styles.previewModal} onClick={e => e.stopPropagation()}>
              <div className={styles.header}>
                <div>
                  <h3 className={styles.title}>{previewDoc.label}</h3>
                  <p className={styles.sub}>{previewDoc.filename}</p>
                </div>
                <button className={styles.closeBtn} onClick={() => setPreviewDoc(null)}>✕</button>
              </div>
              <div className={styles.previewBody}>
                <embed
                  src={`${getViewUrl(employeeId, previewDoc.id)}?token=${token}`}
                  type="application/pdf"
                  className={styles.previewFrame}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}