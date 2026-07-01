"use client";

import { useEffect, useState } from "react";
import {
  fetchBankExportPreview,
  downloadBankExportFile,
  BankExportPreview,
} from "@/services/api/bankExport";

interface BankExportModalProps {
  month: number;
  year: number;
  onClose: () => void;
}

export default function BankExportModal({ month, year, onClose }: BankExportModalProps) {
  const [data, setData] = useState<BankExportPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBankExportPreview(month, year)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e) => { if (!cancelled) setError(e?.message ?? "Failed to load preview"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month, year]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadBankExportFile(month, year);
    } catch (e: any) {
      setError(e?.message ?? "Failed to download file");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            Bank Bulk Payment Export — {month}/{year}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1">
          {loading && <p className="text-sm text-gray-500">Loading preview…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {data && !loading && (
            <>
              <div className="mb-4">
                <h3 className="font-medium text-sm text-gray-700 mb-2">
                  Included ({data.included.length})
                </h3>
                <table className="w-full text-sm border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-2 py-1 border-b">Employee</th>
                      <th className="text-left px-2 py-1 border-b">Txn Type</th>
                      <th className="text-right px-2 py-1 border-b">Amount</th>
                      <th className="text-left px-2 py-1 border-b">Bene ID</th>
                      <th className="text-left px-2 py-1 border-b">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.included.map((row) => (
                      <tr key={row.employee_id}>
                        <td className="px-2 py-1 border-b">{row.employee_name}</td>
                        <td className="px-2 py-1 border-b">{row.transaction_type}</td>
                        <td className="px-2 py-1 border-b text-right">{row.amount}</td>
                        <td className="px-2 py-1 border-b">{row.bene_id}</td>
                        <td className="px-2 py-1 border-b">{row.remarks}</td>
                      </tr>
                    ))}
                    {data.included.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-2 py-3 text-center text-gray-400">
                          No records ready for payout
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {data.skipped.length > 0 && (
                <div>
                  <h3 className="font-medium text-sm text-amber-700 mb-2">
                    Skipped ({data.skipped.length})
                  </h3>
                  <table className="w-full text-sm border">
                    <thead className="bg-amber-50">
                      <tr>
                        <th className="text-left px-2 py-1 border-b">Employee</th>
                        <th className="text-left px-2 py-1 border-b">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.skipped.map((row) => (
                        <tr key={row.employee_id}>
                          <td className="px-2 py-1 border-b">{row.employee_name}</td>
                          <td className="px-2 py-1 border-b text-amber-700">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={loading || downloading || !data?.included.length}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {downloading ? "Downloading…" : "Download Bank File"}
          </button>
        </div>
      </div>
    </div>
  );
}