import jsPDF from "jspdf";
import autoTable, { RowInput, Styles } from "jspdf-autotable";
import { PayrollRecord } from "@/services/api/payroll";
import { Employee } from "@/services/api/employees";

// ── Constants ────────────────────────────────────────────────────────────────
const CIN                  = "U32204MH2013PTC250593";
const GSTIN                = "27AAHCP4747K1ZX";
const PF_ESTABLISHMENT     = "KDMAL2281251000";
const ESIC_EMPLOYER        = "35000528850001099";
const COMPANY_NAME         = "Prabh Solutions Pvt. Ltd.";
const FOOTER               = "This is computer printed statement and doesn't need signature";

const MONTH_NAMES = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"];

// ── Shared geometry ───────────────────────────────────────────────────────────
const ML = 10;           // left margin
const MR = 10;           // right margin
const IW = 190;          // inner width  (210 - 10 - 10)

// 4-column info tables: label | value | label | value
const C4: number[] = [42, 53, 42, 53];   // sum = 190

// 6-column earnings/deductions table
const C6: number[] = [52, 12, 31, 52, 12, 31];  // sum = 190

// Shared table options
const BASE_STYLES: Partial<Styles> = {
  fontSize: 9,
  cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
  textColor: [20, 20, 20] as [number,number,number],
  lineColor: [180, 180, 180] as [number,number,number],
  lineWidth: 0.25,
  overflow: "linebreak",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtAmt(v: number | null | undefined): string {
  if (v == null || v === 0) return "-";
  return Number(v).toLocaleString("en-IN");
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "-";
  try {
    const d = new Date(s);
    return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
  } catch { return "-"; }
}

// Indian number-to-words
const ONES = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
              "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
              "Seventeen","Eighteen","Nineteen"];
const TENS = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

function _w(n: number): string {
  if (n === 0) return "";
  if (n < 20)  return ONES[n] + " ";
  if (n < 100) return TENS[Math.floor(n/10)] + (n%10 ? " "+ONES[n%10] : "") + " ";
  if (n < 1000)    return ONES[Math.floor(n/100)] + " Hundred " + _w(n%100);
  if (n < 100000)  return _w(Math.floor(n/1000)) + "Thousand " + _w(n%1000);
  if (n < 10000000)return _w(Math.floor(n/100000)) + "Lakh " + _w(n%100000);
  return _w(Math.floor(n/10000000)) + "Crore " + _w(n%10000000);
}
function numToWords(n: number): string {
  if (n <= 0) return "Zero Only";
  return "Rupees " + _w(Math.round(n)).trim().replace(/\s+/g," ") + " Only";
}

// Shorthand to get the Y position after the last autoTable call
function lastY(doc: jsPDF): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable.finalY as number;
}

// Draw a single autoTable section and return the new Y
function drawTable(
  doc: jsPDF,
  body: RowInput[],
  startY: number,
  colWidths: number[],
  head?: RowInput[],
): number {
  autoTable(doc, {
    startY,
    head,
    body,
    theme: "grid",
    styles: BASE_STYLES,
    columnStyles: Object.fromEntries(colWidths.map((w, i) => [i, { cellWidth: w }])),
    margin: { left: ML, right: MR },
    tableWidth: IW,
    headStyles: {
      fillColor: [255,255,255] as [number,number,number],
      textColor: [20,20,20] as [number,number,number],
      fontStyle: "bold",
      lineColor: [180,180,180] as [number,number,number],
      lineWidth: 0.25,
    },
    showHead: head ? "firstPage" : "never",
  });
  return lastY(doc);
}

// ── Main export ───────────────────────────────────────────────────────────────
export function generatePayslip(record: PayrollRecord, employee: Employee): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const monthLabel = `${MONTH_NAMES[record.month - 1]}-${String(record.year).slice(2)}`;

  // ── 1. HEADER ─────────────────────────────────────────────────────────────
  // Outer border drawn last so we know total height; draw it at the end.
  // For now: company name left, logo right — rendered as a single-row table
  // with no grid lines, just the bottom divider.
  autoTable(doc, {
    startY: 10,
    body: [[
      { content: COMPANY_NAME, styles: { fontStyle: "bold", fontSize: 15, textColor: [20,20,20] as [number,number,number] } },
      { content: "Prabh", styles: { fontStyle: "bold", fontSize: 15, textColor: [30,80,180] as [number,number,number], halign: "right" } },
      { content: "sol",   styles: { fontStyle: "bold", fontSize: 15, textColor: [230,100,20] as [number,number,number], halign: "left" } },
    ]],
    theme: "plain",
    styles: { cellPadding: { top: 2, bottom: 2, left: 3, right: 1 }, lineWidth: 0 },
    columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 35 }, 2: { cellWidth: 25 } },
    margin: { left: ML, right: MR },
    tableWidth: IW,
    // bottom border
    didDrawPage: () => {
      doc.setDrawColor(30, 80, 180);
      doc.setLineWidth(0.5);
    },
  });

  let y = lastY(doc);

  // Blue divider under header
  doc.setDrawColor(30, 80, 180);
  doc.setLineWidth(0.5);
  doc.line(ML, y, ML + IW, y);

  // ── 2. "Payslip for the Month of …" ──────────────────────────────────────
  autoTable(doc, {
    startY: y,
    body: [[{
      content: `Payslip for the Month of  ${monthLabel}`,
      styles: { halign: "center", fontStyle: "bold", fontSize: 11,
                textColor: [20,20,20] as [number,number,number] },
      colSpan: 4,
    }]],
    theme: "grid",
    styles: { ...BASE_STYLES, lineColor: [200,200,200] as [number,number,number] },
    columnStyles: { 0: { cellWidth: C4[0] }, 1: { cellWidth: C4[1] },
                    2: { cellWidth: C4[2] }, 3: { cellWidth: C4[3] } },
    margin: { left: ML, right: MR },
    tableWidth: IW,
  });
  y = lastY(doc);

  // ── 3. COMPANY INFO (CIN / GSTIN / PF / ESIC / UAN / IP) ─────────────────
  const companyRows: RowInput[] = [
    ["CIN :-",                CIN,                "GSTIN :-",           GSTIN],
    ["PF Establishment Code", PF_ESTABLISHMENT,   "ESIC Employer Code", ESIC_EMPLOYER],
    ["UAN OF PF",             employee.pf_no ?? "-", "Employee IP Number", employee.ip_no ?? "-"],
  ];
  y = drawTable(doc, companyRows, y, C4);

  // ── 4. EMPLOYEE INFO ──────────────────────────────────────────────────────
  const empRows: RowInput[] = [
    ["EmpCode",    employee.emp_code ?? "-",   "Joining Date",  fmtDate(employee.join_date)],
    ["Name",       record.employee_name,       "Designation",   record.designation ?? "-"],
    ["Aadhar No.", employee.aadhar_no ?? "-",  "PAN No.",       employee.pan_no ?? "-"],
    ["",           "",                         "Paid Days",     String(record.days_present)],
  ];
  y = drawTable(doc, empRows, y, C4);

  // ── 5. EARNINGS / DEDUCTIONS TABLE ───────────────────────────────────────
  // Header row
  const earnDedHead: RowInput[] = [[
    { content: "Earning",   styles: { fontStyle: "bold" } },
    { content: "Amount",    styles: { fontStyle: "bold", halign: "center" }, colSpan: 2 },
    { content: "Deduction", styles: { fontStyle: "bold" } },
    { content: "Amount",    styles: { fontStyle: "bold", halign: "center" }, colSpan: 2 },
  ]];

  // Build earnings rows (exactly as in image)
  const earnItems: [string, string][] = [
    ["Basic Allowance",      fmtAmt(record.ern_basic)],
    ["HRA Allowance",        fmtAmt(record.ern_hra)],
    ["Conveyance Allowance", fmtAmt(record.ern_conveyance)],
    ["Medical Allowance",    fmtAmt(record.ern_medical)],
  ];

  // Build deduction rows (exactly as in image: PF, ESIC, PT, Loan)
  const dedItems: [string, string][] = [
    ["PF",   fmtAmt(record.emp_pf)],
    ["ESIC", fmtAmt(record.emp_esic)],
    ["PT",   fmtAmt(record.pt)],
    ["Loan", fmtAmt(record.loan)],
  ];

  // Pad to equal length
  const maxR = Math.max(earnItems.length, dedItems.length);
  while (earnItems.length < maxR) earnItems.push(["",""]);
  while (dedItems.length  < maxR) dedItems.push(["",""]);

  const edBody: RowInput[] = earnItems.map(([el, ea], i) => [
    el, "INR", { content: ea, styles: { halign: "right" as const } },
    dedItems[i][0], "INR", { content: dedItems[i][1], styles: { halign: "right" as const } },
  ]);

  y = drawTable(doc, edBody, y, C6, earnDedHead);

  // ── 6. GROSS ROW ──────────────────────────────────────────────────────────
  const grossBody: RowInput[] = [[
    { content: "Gross Earning",   styles: { fontStyle: "bold" } },
    "INR",
    { content: fmtAmt(record.gross_salary), styles: { halign: "right" as const, fontStyle: "bold" } },
    { content: "Gross Deduction", styles: { fontStyle: "bold" } },
    "",
    { content: fmtAmt(record.total_deductions), styles: { halign: "right" as const, fontStyle: "bold" } },
  ]];
  y = drawTable(doc, grossBody, y, C6);

  // ── 7. NET EARNING + IN WORDS ─────────────────────────────────────────────
  const netBody: RowInput[] = [[
    { content: "Net Earning", styles: { fontStyle: "bold" } },
    "INR",
    { content: fmtAmt(record.net_salary), styles: { halign: "right" as const, fontStyle: "bold" } },
    "In words",
    { content: numToWords(record.net_salary ?? 0),
      colSpan: 2,
      styles: { fontStyle: "normal", halign: "left" as const } },
  ]];
  y = drawTable(doc, netBody, y, C6);

  // ── 8. FOOTER ─────────────────────────────────────────────────────────────
  // Blank spacer row then footer text
  const footerBody: RowInput[] = [
    [{ content: "", colSpan: 4, styles: { lineWidth: 0, cellPadding: 1 } }],
    [{ content: FOOTER, colSpan: 4,
       styles: { fontStyle: "italic", fontSize: 8,
                 textColor: [80,80,80] as [number,number,number],
                 lineColor: [200,200,200] as [number,number,number] } }],
  ];
  y = drawTable(doc, footerBody, y, C4);

  // ── 9. OUTER BORDER ──────────────────────────────────────────────────────
  // Draw over everything once all Y positions are known
  doc.setDrawColor(30, 80, 180);
  doc.setLineWidth(0.8);
  doc.rect(ML - 2, 8, IW + 4, y - 8 + 2);

  return doc;
}