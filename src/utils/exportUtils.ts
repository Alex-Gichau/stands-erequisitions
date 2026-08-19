/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Requisition, SystemLog } from "../types";
import { formatCurrency, formatDate } from "../lib/utils";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Generates high-fidelity, printer-friendly HTML ledger for System Audit Logs.
 */
export function generatePrintableLogsHtml(
  logs: SystemLog[],
  reportTitle: string,
  currentUser: any
): string {
  const fileDate = new Date().toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const fileTime = new Date().toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const tableRowsHtml = logs.map((log, index) => {
    return `
      <tr>
        <td style="text-align: center; color: #64748b; font-weight: bold;">${index + 1}</td>
        <td style="font-family: monospace; font-size: 8.5px; color: #475569;">
          ${formatDate(log.timestamp)}
          <div style="font-size: 7px; color: #94a3b8; margin-top: 2px;">
            ${new Date(log.timestamp).toLocaleTimeString()}
          </div>
        </td>
        <td>
          <div style="font-weight: bold; color: #0f172a; font-size: 9.5px;">${log.action.replace(/_/g, " ")}</div>
          <div style="font-size: 8px; font-family: monospace; color: #64748b; margin-top: 2px;">
            ID: ${log.id.toUpperCase()}
          </div>
        </td>
        <td style="font-size: 9px; color: #334155;">
          ${log.details}
        </td>
        <td style="font-weight: 500; font-size: 9px; color: #475569;">
          ${log.performedBy}
        </td>
      </tr>
    `;
  }).join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>St. Andrews Church - System Audit Logs</title>
  <style>
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #1e293b;
      margin: 40px;
      line-height: 1.4;
      background: #ffffff;
    }
    .header {
      border-bottom: 3px double #334155;
      padding-bottom: 16px;
      margin-bottom: 25px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      width: 36px;
      height: 36px;
      background-color: #4f46e5;
      color: #ffffff;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 18px;
    }
    .title-area {
      flex: 1;
    }
    .title {
      font-weight: 800;
      font-size: 20px;
      text-transform: uppercase;
      letter-spacing: -0.5px;
      color: #0f172a;
      margin: 0;
    }
    .subtitle {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #64748b;
      font-weight: 700;
      margin: 3px 0 0 0;
    }
    .meta-file-id {
      text-align: right;
      font-family: monospace;
      font-size: 9px;
      color: #64748b;
    }
    .meta-file-title {
      font-weight: 800;
      font-size: 12px;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 25px;
    }
    .meta-item {
      background-color: #f8fafc;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    .meta-label {
      font-weight: 700;
      font-size: 8px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 3px;
    }
    .meta-value {
      font-weight: 700;
      font-size: 11px;
      color: #1e293b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 30px;
    }
    th {
      background-color: #f1f5f9;
      color: #475569;
      text-transform: uppercase;
      font-weight: 800;
      font-size: 8.5px;
      letter-spacing: 0.5px;
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
    }
    td {
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
      vertical-align: top;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .system-log {
      margin-top: 50px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 12px;
      font-size: 8px;
      color: #94a3b8;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="brand-logo"><img src="/pcea.svg" style="width:100%;height:100%;object-fit:contain;" /></div>
      <div class="title-area">
        <h1 class="title">St. Andrews Church</h1>
        <p class="subtitle">System Audit Management Ledger</p>
      </div>
    </div>
    <div class="meta-file-id">
      <div class="meta-file-title">AUDIT LOG EXPORT</div>
      <div>REF: LOG-${Date.now().toString(36).toUpperCase()}</div>
      <div>OFFICIAL SECURE SYSTEM RECORD</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <div class="meta-label">Report Title</div>
      <div class="meta-value">${reportTitle}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Exported By</div>
      <div class="meta-value">${currentUser?.name || "System Operator"}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Generated On</div>
      <div class="meta-value">${fileDate} at ${fileTime}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 4%; text-align: center;">#</th>
        <th style="width: 15%;">Timestamp</th>
        <th style="width: 20%;">Action Type</th>
        <th style="width: 46%;">Narrative Description</th>
        <th style="width: 15%;">Operator</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml || `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8; font-style: italic;">No audit records found in selected scope.</td></tr>`}
    </tbody>
  </table>

  <div class="system-log">
    ST. ANDREWS PARISH FISCAL v3 PROTOCOL • AUDITED SYSTEM LOG RECORD • PRINTED SECURELY ON ${fileDate} AT ${fileTime}
  </div>
</body>
</html>
  `;
}

/**
 * Prints system audit logs.
 */
export function printSystemLogs(
  logs: SystemLog[],
  reportTitle: string,
  currentUser: any
): void {
  const html = generatePrintableLogsHtml(logs, reportTitle, currentUser);
  const printWindow = window.open("", "_blank", "width=1000,height=800");
  
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };

    setTimeout(() => {
      if (printWindow.document.readyState === "complete") {
        printWindow.focus();
        printWindow.print();
      }
    }, 1000);
  } else {
    alert("Popup blocked! Please allow popups to print logs.");
  }
}

/**
 * Generates high-fidelity, standalone, printer-friendly HTML ledger for physical filing.
 */
export function generatePrintableHtml(
  requisitions: Requisition[],
  reportTitle: string,
  currentUser: any,
  filterSummary = "All Listed Transactions"
): string {
  const fileDate = new Date().toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const fileTime = new Date().toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalCount = requisitions.length;
  const totalValue = requisitions.reduce((acc, r) => acc + r.amount, 0);
  const totalDisbursed = requisitions
    .filter((r) => r.status === "DISBURSED")
    .reduce((acc, r) => acc + r.amount, 0);
  const totalPending = requisitions
    .filter((r) => r.status === "SUBMITTED" || r.status === "APPROVED_L1")
    .reduce((acc, r) => acc + r.amount, 0);

  const tableRowsHtml = requisitions.map((req, index) => {
    const isMissingReceipt =
      req.status === "DISBURSED" && (!req.receipts || req.receipts.length === 0);
    const approvalsList = Array.isArray(req.approvalHistory) && req.approvalHistory.length > 0
      ? req.approvalHistory
          .map((a) => `${a.approverName} [${a.role.replace("APPROVER_", "L")}]`)
          .join(", ")
      : "None";

    return `
      <tr>
        <td style="text-align: center; color: #64748b; font-weight: bold;">${index + 1}</td>
        <td>
          <div style="font-weight: bold; color: #0f172a;">${req.title}</div>
          <div style="font-size: 8px; font-family: monospace; color: #64748b; margin-top: 2px;">
            REF: ${req.id.toUpperCase()}
          </div>
          ${
            req.description
              ? `<div style="font-size: 8.5px; color: #475569; margin-top: 4px; font-style: italic;">"${req.description}"</div>`
              : ""
          }
        </td>
        <td>
          <div style="font-weight: 500;">${req.requesterName}</div>
          <div style="font-size: 9px; color: #64748b;">${req.groupName}</div>
        </td>
        <td style="color: #475569;">${formatDate(req.submittedAt)}</td>
        <td style="font-size: 9.5px; color: #334155;">
          <div>${approvalsList}</div>
          ${
            req.rejectionReason
              ? `<div style="font-size: 8px; color: #dc2626; margin-top: 2px;">REJECT REASON: ${req.rejectionReason}</div>`
              : ""
          }
        </td>
        <td style="text-align: center;">
          <span class="status status-${req.status}">
            ${req.status.replace("_", " ")}
          </span>
          ${
            isMissingReceipt
              ? `<div style="font-size: 7.5px; font-weight: 800; color: #dc2626; margin-top: 4px; letter-spacing: 0.5px;">⚠️ R_MISSING</div>`
              : ""
          }
        </td>
        <td class="amount" style="font-weight: bold; font-family: monospace; text-align: right; color: #0f172a;">
          ${formatCurrency(req.amount)}
        </td>
      </tr>
    `;
  }).join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>St. Andrews Church - Physical Requisitions Ledger</title>
  <style>
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #1e293b;
      margin: 40px;
      line-height: 1.4;
      background: #ffffff;
    }
    .header {
      border-bottom: 3px double #334155;
      padding-bottom: 16px;
      margin-bottom: 25px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      width: 36px;
      height: 36px;
      background-color: #4f46e5;
      color: #ffffff;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 18px;
    }
    .title-area {
      flex: 1;
    }
    .title {
      font-weight: 800;
      font-size: 20px;
      text-transform: uppercase;
      letter-spacing: -0.5px;
      color: #0f172a;
      margin: 0;
    }
    .subtitle {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #64748b;
      font-weight: 700;
      margin: 3px 0 0 0;
    }
    .meta-file-id {
      text-align: right;
      font-family: monospace;
      font-size: 9px;
      color: #64748b;
    }
    .meta-file-title {
      font-weight: 800;
      font-size: 12px;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 25px;
    }
    .meta-item {
      background-color: #f8fafc;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    .meta-label {
      font-weight: 700;
      font-size: 8px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 3px;
    }
    .meta-value {
      font-weight: 700;
      font-size: 12px;
      color: #1e293b;
    }
    .meta-mono {
      font-family: monospace;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 30px;
    }
    th {
      background-color: #f1f5f9;
      color: #475569;
      text-transform: uppercase;
      font-weight: 800;
      font-size: 8.5px;
      letter-spacing: 0.5px;
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
    }
    td {
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
      vertical-align: top;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .status {
      display: inline-block;
      font-weight: 800;
      font-size: 8px;
      text-transform: uppercase;
      padding: 2px 5px;
      border-radius: 3px;
      letter-spacing: 0.3px;
    }
    .status-SUBMITTED { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .status-APPROVED_L1 { background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; }
    .status-APPROVED_L2 { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    .status-DISBURSED { background: #d1fae5; color: #047857; border: 1px solid #a7f3d0; }
    .status-REJECTED { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    .status-DRAFT { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
    .status-CANCELLED { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

    .grand-total {
      text-align: right;
      padding: 12px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 800;
      color: #0d1527;
      margin-bottom: 50px;
    }
    .grand-total span {
      font-family: monospace;
      font-size: 14px;
      color: #059669;
    }
    .sign-section {
      margin-top: 60px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 30px;
      page-break-inside: avoid;
    }
    .sign-box {
      border-top: 1.5px solid #64748b;
      padding-top: 10px;
      text-align: center;
      font-size: 9.5px;
      color: #475569;
    }
    .sign-title {
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .system-log {
      margin-top: 50px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 12px;
      font-size: 8px;
      color: #94a3b8;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    @media print {
      body {
        margin: 15mm 10mm;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="brand-logo"><img src="/pcea.svg" style="width:100%;height:100%;object-fit:contain;" /></div>
      <div class="title-area">
        <h1 class="title">St. Andrews Church</h1>
        <p class="subtitle">Official Fiscal Requisitions Register</p>
      </div>
    </div>
    <div class="meta-file-id">
      <div class="meta-file-title">PHYSICAL LEDGER DEPOSIT</div>
      <div>REF: REG-${Date.now().toString(36).toUpperCase()}</div>
      <div>COMPILED APPROVED SYSTEM FILE</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <div class="meta-label">Ledger Target Title</div>
      <div class="meta-value">${reportTitle}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Operational Period / Query</div>
      <div class="meta-value" style="font-size: 11px;">${filterSummary}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Export Compiled By</div>
      <div class="meta-value">${currentUser?.name || "System Operator"}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Date Compiled</div>
      <div class="meta-value">${fileDate} <span style="font-size: 10px; opacity: 0.7;">${fileTime}</span></div>
    </div>
  </div>

  <div class="meta-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 25px;">
    <div class="meta-item" style="border-left: 3px solid #64748b;">
      <div class="meta-label">Total Transaction Count</div>
      <div class="meta-value meta-mono">${totalCount} entries</div>
    </div>
    <div class="meta-item" style="border-left: 3px solid #10b981;">
      <div class="meta-label">Disbursed Volume (KES)</div>
      <div class="meta-value meta-mono">${formatCurrency(totalDisbursed)}</div>
    </div>
    <div class="meta-item" style="border-left: 3px solid #f59e0b;">
      <div class="meta-label">Pending / Unreleased (KES)</div>
      <div class="meta-value meta-mono">${formatCurrency(totalPending)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 4%; text-align: center;">#</th>
        <th style="width: 38%;">Requisition Description & ID</th>
        <th style="width: 20%;">Requester & Group</th>
        <th style="width: 12%;">Submission Date</th>
        <th style="width: 16%;">Approval Ledger Checkpoints</th>
        <th style="width: 10%; text-align: center;">Filing Status</th>
        <th style="width: 12%; text-align: right;">Amount (KES)</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml || `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #94a3b8; font-style: italic;">No records found in selected scope view.</td></tr>`}
    </tbody>
  </table>

  <div class="grand-total">
    GRAND LEDGER VALUE IN QUERY: &nbsp;&nbsp;<span>${formatCurrency(totalValue)}</span>
  </div>

  <div class="sign-section">
    <div class="sign-box">
      <div class="sign-title">PREPARED & VERIFIED BY</div>
      <div style="font-size: 10px; font-weight: bold; margin-bottom: 15px; color: #0f172a;">
        ${currentUser?.name || "System Admin"}
      </div>
      <div style="height: 1.5cm;"></div>
      <div>Clerk Signature & Stamp / Date</div>
    </div>
    <div class="sign-box">
      <div class="sign-title">FINANCIAL CONTROLLER CHECK</div>
      <div style="font-size: 10px; font-weight: bold; margin-bottom: 15px; color: #0f172a; opacity: 0.3;">
        ___________________________
      </div>
      <div style="height: 1.5cm;"></div>
      <div>Finance Secretary / Controller / Date</div>
    </div>
    <div class="sign-box">
      <div class="sign-title">SENIOR MINISTER / VICAR ENDORSEMENT</div>
      <div style="font-size: 10px; font-weight: bold; margin-bottom: 15px; color: #0f172a; opacity: 0.3;">
        ___________________________
      </div>
      <div style="height: 1.5cm;"></div>
      <div>Authorized Signee & Stamp / Date</div>
    </div>
  </div>

  <div class="system-log">
    ST. ANDREWS PARISH FISCAL v3 PROTOCOL • COMPILED AUDITED RECORD UNDER SYSTEM REFERENCE #${Date.now().toString(36).toUpperCase()} • PRINTED SECURELY ON ${fileDate} AT ${fileTime}
  </div>
</body>
</html>
  `;
}

/**
 * Focuses/prints the compiled HTML inside a hidden iframe to prevent popup blocks.
 */
export function printRequisitions(
  requisitions: Requisition[],
  reportTitle: string,
  currentUser: any,
  filterSummary = "All Listed Transactions"
): void {
  const html = generatePrintableHtml(requisitions, reportTitle, currentUser, filterSummary);
  const printWindow = window.open("", "_blank", "width=1100,height=850");
  
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };

    setTimeout(() => {
      if (printWindow.document.readyState === "complete") {
        printWindow.focus();
        printWindow.print();
      }
    }, 1000);
  } else {
    alert("Popup blocked! Please allow popups to print requisitions.");
  }
}

/**
 * Saves and triggers a download of the compiled HTML.
 */
export function downloadRequisitionsHtml(
  requisitions: Requisition[],
  reportTitle: string,
  currentUser: any,
  filterSummary = "All Listed Transactions"
): void {
  const html = generatePrintableHtml(requisitions, reportTitle, currentUser, filterSummary);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = reportTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  link.download = `${safeName}_ledger_physical_filing_${Date.now()}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Saves and triggers a download of the compiled CSV.
 */
export function downloadRequisitionsCsv(
  requisitions: Requisition[],
  reportTitle: string
): void {
  const headers = ["ID", "Title", "RequesterName", "GroupName", "Amount", "Status", "SubmittedAt", "Description"];
  
  const csvRows = [
    headers.join(","),
    ...requisitions.map((req) => {
      const id = `"${(req.id || "").replace(/"/g, '""')}"`;
      const title = `"${(req.title || "").replace(/"/g, '""')}"`;
      const name = `"${(req.requesterName || "").replace(/"/g, '""')}"`;
      const groupName = `"${(req.groupName || "").replace(/"/g, '""')}"`;
      const amount = req.amount;
      const status = `"${(req.status || "").replace(/"/g, '""')}"`;
      const submitted = req.submittedAt ? `"${new Date(req.submittedAt).toLocaleDateString()}"` : `""`;
      const desc = `"${(req.description || "").replace(/\r?\n|\r/g, " ").replace(/"/g, '""')}"`;
      
      return [id, title, name, groupName, amount, status, submitted, desc].join(",");
    })
  ].join("\n");

  const blob = new Blob([csvRows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = reportTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  link.download = `${safeName}_ledger_${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Saves and triggers a download of the compiled PDF using jsPDF.
 */
export function downloadRequisitionsPdf(
  requisitions: Requisition[],
  reportTitle: string,
  currentUser: any,
  filterSummary = "All Listed Transactions"
): void {
  const doc = new jsPDF("landscape", "mm", "a4");

  // Document brand
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ST. ANDREWS PARISH NAIROBI", 14, 15);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`FINANCIAL EXPENDITURE STATEMENT: ${reportTitle.toUpperCase()}`, 14, 21);
  doc.text(`Filters applied: ${filterSummary}`, 14, 26);
  doc.text(`Generated by: ${currentUser?.name || "System"} (${currentUser?.role || "Clergy Admin"}) on ${new Date().toLocaleDateString()}`, 14, 31);

  // Totals calculations
  const totalCount = requisitions.length;
  const totalValue = requisitions.reduce((acc, r) => acc + r.amount, 0);
  const totalDisbursed = requisitions
    .filter(r => r.status === "DISBURSED")
    .reduce((acc, r) => acc + r.amount, 0);
  const totalPending = requisitions
    .filter(r => r.status !== "DISBURSED" && r.status !== "REJECTED")
    .reduce((acc, r) => acc + r.amount, 0);

  doc.setFont("helvetica", "bold");
  doc.text(`Records: ${totalCount}  |  Total Sum: KES ${totalValue.toLocaleString()}  |  Settled: KES ${totalDisbursed.toLocaleString()}  |  Pending: KES ${totalPending.toLocaleString()}`, 14, 37);

  // Table rows mapping
  const headers = [["#", "Voucher ID", "Title / Technical Narrative", "Ministry Group / User", "Submitted On", "Ledger Status", "Amount (KES)"]];
  const tableRows = requisitions.map((req, i) => [
    i + 1,
    req.id.toUpperCase().substr(0, 10),
    `${req.title}\n${req.description || ""}`,
    `${req.groupName}\nBy: ${req.requesterName}`,
    req.submittedAt ? new Date(req.submittedAt).toLocaleDateString() : "N/A",
    req.status,
    req.amount.toLocaleString()
  ]);

  autoTable(doc, {
    startY: 42,
    head: headers,
    body: tableRows,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42] }, // Slate 900
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 25 },
      2: { cellWidth: 80 },
      3: { cellWidth: 60 },
      4: { cellWidth: 30 },
      5: { cellWidth: 30 },
      6: { halign: "right", fontStyle: "bold", cellWidth: 35 }
    }
  });

  const safeName = reportTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  doc.save(`${safeName}_financial_ledger_${Date.now()}.pdf`);
}

/**
 * Generates a high-fidelity voucher for a single requisition including history and metadata.
 */
export function generateVoucherHtml(req: Requisition, currentUser: any): string {
  const fileDate = new Date().toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const fileTime = new Date().toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const historyArr = Array.isArray(req.approvalHistory) ? req.approvalHistory : [];
  const auditRowsHtml = historyArr.map((note, i) => {
    return `
      <tr>
        <td style="font-family: monospace; font-size: 8px; color: #64748b; padding: 8px;">${formatDate(note.timestamp)}</td>
        <td style="font-weight: 800; font-size: 9px; padding: 8px; color: #0f172a;">${note.decision}</td>
        <td style="font-size: 9px; padding: 8px; color: #334155;">
          <div style="font-weight: bold;">${note.approverName}</div>
          <div style="font-size: 8px; color: #64748b;">${note.role.replace(/_/g, " ")}</div>
        </td>
        <td style="font-size: 8.5px; padding: 8px; color: #475569; font-style: italic;">
          ${note.note || note.rejectionReason || "No comment provided."}
        </td>
      </tr>
    `;
  }).join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Payment Voucher - ${req.id}</title>
  <style>
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #1e293b;
      margin: 40px;
      line-height: 1.4;
      background: white;
    }
    .voucher-container {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #e2e8f0;
      padding: 40px;
      position: relative;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .brand h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: -0.5px; }
    .brand p { margin: 5px 0 0 0; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
    .voucher-id { text-align: right; }
    .voucher-id h2 { margin: 0; font-size: 18px; color: #0f172a; }
    .voucher-id p { margin: 2px 0 0 0; font-family: monospace; font-size: 10px; color: #64748b; }
    
    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      background: #f1f5f9;
      color: #475569;
      margin-top: 10px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 40px;
    }
    .section-title {
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      color: #94a3b8;
      letter-spacing: 1px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 5px;
      margin-bottom: 12px;
    }
    .info-item { margin-bottom: 15px; }
    .info-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 3px; }
    .info-value { font-size: 13px; font-weight: 700; color: #0f172a; }
    
    .amount-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 40px;
    }
    .amount-val { font-size: 28px; font-weight: 900; color: #0f172a; font-family: monospace; }
    .amount-words { font-size: 11px; font-style: italic; color: #64748b; margin-top: 5px; }
    
    .audit-trail { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .audit-trail th { text-align: left; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; font-size: 9px; text-transform: uppercase; }
    .audit-trail td { border: 1px solid #e2e8f0; vertical-align: top; }
    
    .signature-area { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; }
    .sig-box { border-top: 1px solid #475569; padding-top: 8px; text-align: center; font-size: 9px; }
    
    .footer { margin-top: 60px; text-align: center; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; border-top: 1px dashed #e2e8f0; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="voucher-container">
    <div class="header">
      <div class="brand">
        <h1>St. Andrews Parish Nairobi</h1>
        <p>Finance & Expenditure Department</p>
      </div>
      <div class="voucher-id">
        <h2>PAYMENT VOUCHER</h2>
        <p>REF: ${req.id.toUpperCase()}</p>
        <div class="status-badge">${req.status.replace(/_/g, " ")}</div>
      </div>
    </div>

    <div class="info-grid">
      <div>
        <div class="section-title">Recipient Information</div>
        <div class="info-item">
          <div class="info-label">Payee / Requester</div>
          <div class="info-value">${req.requesterName}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Ministry / Group</div>
          <div class="info-value">${req.groupName}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Submitted On</div>
          <div class="info-value">${formatDate(req.submittedAt)}</div>
        </div>
      </div>
      <div>
        <div class="section-title">Transaction Details</div>
        <div class="info-item">
          <div class="info-label">Purpose of Expenditure</div>
          <div class="info-value" style="font-size: 11px;">${req.title}</div>
        </div>
        ${req.description ? `
        <div class="info-item">
          <div class="info-label">Narrative / Notes</div>
          <div class="info-value" style="font-weight: normal; font-size: 10px; font-style: italic;">"${req.description}"</div>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="section-title">Financial Allotment</div>
    <div class="amount-box">
      <div class="amount-val">${formatCurrency(req.amount)}</div>
      <div class="amount-words">Sum of Kenyan Shillings: ${req.amountWords || 'As stated above'} only.</div>
      ${req.enableInstallments && Array.isArray(req.installments) && req.installments.length > 0 ? `
        <div style="margin-top: 15px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 11px;">
          <div style="font-weight: 800; text-transform: uppercase; margin-bottom: 6px; color: #475569; font-size: 9px; letter-spacing: 0.5px;">Phased Installment Schedule:</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
            <thead>
              <tr style="color: #64748b; font-size: 8px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; text-align: left;">
                <th style="padding: 4px;">#</th>
                <th style="padding: 4px;">Milestone</th>
                <th style="padding: 4px;">Due Date</th>
                <th style="padding: 4px; text-align: right;">Amount (%)</th>
                <th style="padding: 4px; text-center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${req.installments.map(inst => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 5px 4px; font-weight: bold; font-family: monospace;">#${inst.installmentNumber}</td>
                  <td style="padding: 5px 4px;">${inst.title}</td>
                  <td style="padding: 5px 4px; font-family: monospace; font-size: 9px; color: #64748b;">${inst.dueDate ? new Date(inst.dueDate).toLocaleDateString('en-GB') : 'On Demand'}</td>
                  <td style="padding: 5px 4px; text-align: right; font-weight: bold; font-family: monospace;">${formatCurrency(inst.amount)} (${inst.percentage}%)</td>
                  <td style="padding: 5px 4px; text-align: center;">
                    <span style="display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: bold; text-transform: uppercase; background: ${inst.status === 'DISBURSED' ? '#dcfce7; color: #166534;' : '#fef3c7; color: #92400e;'}">
                      ${inst.status === 'DISBURSED' ? `Paid (${inst.disbursementMethod || 'EFT'} #${inst.disbursementReference || 'OK'})` : 'Pending'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    </div>

    <div class="section-title">Digital Approval Audit Trail</div>
    <table class="audit-trail">
      <thead>
        <tr>
          <th style="width: 20%;">Date</th>
          <th style="width: 15%;">Action</th>
          <th style="width: 25%;">Processor</th>
          <th style="width: 40%;">Note / Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${auditRowsHtml || '<tr><td colspan="4" style="text-align: center; padding: 20px; font-style: italic; color: #94a3b8;">No audit history found for this transaction.</td></tr>'}
      </tbody>
    </table>

    <div class="signature-area">
      <div class="sig-box">
        <div style="font-weight: bold; margin-bottom: 20px;">${req.requesterName}</div>
        <div>SIGNATURE OF RECIPIENT</div>
      </div>
      <div class="sig-box">
        <div style="height: 35px;"></div>
        <div>TREASURER / CONTROLLER</div>
      </div>
      <div class="sig-box">
        <div style="height: 35px;"></div>
        <div>VICAR / SENIOR MINISTER</div>
      </div>
    </div>

    <div class="footer">
      OFFICIAL DOCUMENT GENERATED BY ${currentUser?.name || 'SYSTEM'} ON ${fileDate} AT ${fileTime} • ST. ANDREWS CATHEDRAL DIOCESAN RECORD
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generates a descriptive filename for receipt exports, including Group Name and Requisition Title.
 * e.g., "Receipt_Music_Ministry_June_2026_requisition_6CLNCRAQ.html"
 */
export function getReceiptFileName(req: Requisition, extension: string = "html"): string {
  const sanitize = (str: string) =>
    (str || "")
      .trim()
      .replace(/[^a-zA-Z0-9_\-\s]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_");

  const group = sanitize(req.groupName) || "Group";
  const title = sanitize(req.title) || "Requisition";
  const id = sanitize(req.id) || "Receipt";

  return `Receipt_${group}_${title}_${id}.${extension}`;
}

export function generateReceiptHtml(req: Requisition): string {
  const fileName = getReceiptFileName(req, "pdf");
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${fileName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 20px;
      background: #f8fafc;
      -webkit-font-smoothing: antialiased;
    }
    .receipt-container {
      position: relative;
      width: 100%;
      max-width: 680px;
      margin: 0 auto;
      padding: 40px;
      box-sizing: border-box;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      min-height: 800px;
    }
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 320px;
      height: 320px;
      opacity: 0.03;
      pointer-events: none;
      z-index: 0;
    }
    .content-wrapper {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      height: 100%;
      justify-content: space-between;
      gap: 32px;
    }
    .header {
      border-bottom: 3px solid #0f172a;
      padding-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brand-logo {
      width: 44px;
      height: 44px;
      background: #0f172a;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
    }
    .church-info h1 {
      font-size: 20px;
      font-weight: 900;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
    }
    .church-info p {
      font-size: 11px;
      font-weight: 800;
      color: #64748b;
      margin: 3px 0 0 0;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }
    .receipt-meta {
      text-align: right;
    }
    .meta-label {
      font-size: 10px;
      font-weight: 900;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
      display: block;
      margin-bottom: 4px;
    }
    .meta-value {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 800;
      font-size: 16px;
      color: #0f172a;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      padding: 16px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px solid #f1f5f9;
    }
    .info-item label {
      display: block;
      font-size: 10px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 4px;
    }
    .info-item .primary-val {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.3;
    }
    .info-item .secondary-val {
      color: #475569;
      font-size: 12px;
      margin-top: 2px;
      text-transform: uppercase;
      font-weight: 700;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
    }
    th {
      border-bottom: 2px solid #0f172a;
      padding: 10px 0;
      font-size: 11px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      text-align: left;
      letter-spacing: 1px;
    }
    td {
      padding: 16px 0;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .item-title {
      font-weight: 800;
      font-size: 15px;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .item-desc {
      font-size: 12px;
      color: #475569;
      font-style: italic;
      line-height: 1.5;
    }
    .item-status {
      margin-top: 8px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #059669;
      background: #ecfdf5;
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .item-amount {
      text-align: right;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 800;
      font-size: 16px;
      color: #0f172a;
    }
    .amount-words {
      background: #f8fafc;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }
    .amount-words label {
      display: block;
      font-size: 10px;
      font-weight: 900;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 6px;
    }
    .amount-words div {
      font-size: 13px;
      font-weight: 800;
      color: #1e293b;
      text-transform: uppercase;
      line-height: 1.4;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 24px;
      border-top: 2px dashed #cbd5e1;
      margin-top: auto;
      gap: 16px;
    }
    .signature-area {
      border-top: 1px solid #94a3b8;
      width: 130px;
      padding-top: 6px;
      margin-top: 20px;
      font-size: 9px;
      font-weight: 900;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .qr-block {
      display: flex;
      align-items: center;
      gap: 12px;
      border: 1px solid #cbd5e1;
      padding: 10px 14px;
      border-radius: 12px;
      background: #f8fafc;
    }
    .grand-total {
      text-align: right;
    }
    .grand-total .val {
      font-size: 22px;
      font-weight: 900;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .grand-total .lab {
      font-size: 10px;
      font-weight: 900;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    @media print {
      body {
        padding: 0;
        margin: 0;
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .receipt-container {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 auto !important;
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="watermark">
      <svg viewBox="0 0 100 100" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="50" cy="50" r="44" stroke-width="1.5" stroke-dasharray="3 3"></circle>
        <circle cx="50" cy="50" r="40" stroke-width="1"></circle>
        <line x1="22" y1="22" x2="78" y2="78" stroke-width="1" stroke-dasharray="2 2"></line>
        <line x1="78" y1="22" x2="22" y2="78" stroke-width="1" stroke-dasharray="2 2"></line>
        <line x1="50" y1="18" x2="50" y2="82" stroke-width="3.5"></line>
        <line x1="32" y1="38" x2="68" y2="38" stroke-width="3.5"></line>
        <circle cx="50" cy="38" r="8" stroke-width="1.5"></circle>
      </svg>
    </div>
    <div class="content-wrapper">
      <div>
        <div class="header">
          <div class="brand">
            <div class="brand-logo"><img src="/pcea.svg" style="width:100%;height:100%;object-fit:contain;" /></div>
            <div class="church-info">
              <h1>St. Andrews</h1>
              <p>Expenditure Receipt</p>
            </div>
          </div>
          <div class="receipt-meta">
            <label class="meta-label">Receipt #</label>
            <div class="meta-value">#${req.id.toUpperCase()}</div>
          </div>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <label>Issued To</label>
            <div class="primary-val">${req.requesterName}</div>
            <div class="secondary-val">${req.groupName}</div>
          </div>
          <div class="info-item" style="text-align: right;">
            <label>Transaction Date</label>
            <div class="primary-val">${formatDate(req.submittedAt)}</div>
            <div class="secondary-val">FY ${req.fiscalYear || '2026'}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Item Description</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div class="item-title">${req.title}</div>
                <div class="item-desc">"${req.description}"</div>
                <div class="item-status">Status: ${req.status}</div>
              </td>
              <td class="item-amount">
                ${formatCurrency(req.amount)}
              </td>
            </tr>
          </tbody>
        </table>
        <div class="amount-words">
          <label>Amount in Words</label>
          <div>${req.amountWords}</div>
        </div>
      </div>
      <div class="footer">
        <div>
          <div style="color: #059669; font-size: 10px; font-weight: 900; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">✓ AUTHORIZED DIGITALLY</div>
          <div class="signature-area">Ministry Stamp</div>
        </div>
        <div class="qr-block">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`VERIFY REQUISITION #${req.id} | ${req.title} | ${formatCurrency(req.amount)} | Status: ${req.status} | Group: ${req.groupName}`)}" alt="QR Code" style="width: 54px; height: 54px; border-radius: 6px;" />
          <div style="text-align: left;">
            <div style="font-size: 9px; font-weight: 900; color: #059669; text-transform: uppercase;">Scannable QR</div>
            <div style="font-size: 9px; font-weight: 700; color: #334155;">Mobile Verification</div>
            <div style="font-size: 9px; font-family: monospace; color: #64748b;">#${req.id}</div>
          </div>
        </div>
        <div class="grand-total">
          <div class="val">${formatCurrency(req.amount)}</div>
          <div class="lab">Total Value Paid</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Downloads a formal HTML receipt file with group name and requisition title in the filename.
 */
export function downloadReceiptHtml(req: Requisition): void {
  const html = generateReceiptHtml(req);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getReceiptFileName(req, "html");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Prints a formal receipt template for a requisition.
 */
export function printRequisitionReceipt(req: Requisition): void {
  const html = generateReceiptHtml(req);
  const printWindow = window.open("", "_blank", "width=800,height=900");
  
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };

    setTimeout(() => {
      if (printWindow.document.readyState === "complete") {
        printWindow.focus();
        printWindow.print();
      }
    }, 1000);
  } else {
    alert("Please allow popups to print the receipt.");
  }
}

/**
 * Prints a detailed voucher for a single requisition.
 */
export function printRequisitionVoucher(req: Requisition, currentUser: any): void {
  const html = generateVoucherHtml(req, currentUser);
  const printWindow = window.open("", "_blank", "width=900,height=800");
  
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Give it a moment to load styles and then print
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };

    // Fallback if onload doesn't fire
    setTimeout(() => {
      if (printWindow.document.readyState === "complete") {
        printWindow.focus();
        printWindow.print();
      }
    }, 1000);
  } else {
    alert("Please allow popups to print the voucher.");
  }
}

/**
 * Downloads a high-resolution 1-page PDF for the AI Executive Report Summary.
 */
export function downloadAiSummaryPdf(aiData: any, filtersInfo: string): void {
  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Dark Header Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 26, "F");

    // Gold/Primary Accent Line
    doc.setFillColor(79, 70, 229); // primary indigo
    doc.rect(0, 26, 210, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("ST. ANDREW'S PCEA CHURCH", 14, 12);

    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("AI EXECUTIVE FINANCIAL REPORT SUMMARY (1-PAGER)", 14, 19);

    doc.setFontSize(8);
    doc.setTextColor(226, 232, 240);
    doc.text(`Scope: ${filtersInfo || "Global Ledger"}`, 196, 12, { align: "right" });
    const genDate = aiData.generatedAt ? new Date(aiData.generatedAt).toLocaleDateString("en-KE") : new Date().toLocaleDateString("en-KE");
    doc.text(`Generated: ${genDate}`, 196, 19, { align: "right" });

    let y = 36;

    // Report Title & Period Label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(aiData.title || "Executive Financial Summary", 14, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(79, 70, 229);
    doc.text(`PERIOD: ${aiData.periodLabel || filtersInfo}`, 14, y);
    y += 9;

    // 1. Executive Narrative
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("1. EXECUTIVE SUMMARY NARRATIVE", 14, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const narrativeLines = doc.splitTextToSize(aiData.executiveNarrative || "No narrative content provided.", 182);
    doc.text(narrativeLines, 14, y);
    y += (narrativeLines.length * 4.2) + 7;

    // 2. Key Highlights
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("2. KEY FINANCIAL HIGHLIGHTS", 14, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    (aiData.keyHighlights || []).forEach((item: string) => {
      const lines = doc.splitTextToSize(`• ${item}`, 178);
      doc.text(lines, 16, y);
      y += (lines.length * 4) + 1.2;
    });
    y += 5;

    // 3. Audit & Governance Observations
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("3. AUDIT & GOVERNANCE OBSERVATIONS", 14, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    (aiData.auditObservations || []).forEach((item: string) => {
      const lines = doc.splitTextToSize(`• ${item}`, 178);
      doc.text(lines, 16, y);
      y += (lines.length * 4) + 1.2;
    });
    y += 5;

    // 4. Strategic Treasury Recommendations
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("4. STRATEGIC TREASURY RECOMMENDATIONS", 14, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    (aiData.treasuryRecommendations || []).forEach((item: string) => {
      const lines = doc.splitTextToSize(`• ${item}`, 178);
      doc.text(lines, 16, y);
      y += (lines.length * 4) + 1.2;
    });

    // Footer
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(0, 280, 210, 17, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("ST. ANDREW'S PCEA eREQUISITIONS PORTAL — OFFICIAL AI AUDIT SUMMARY 1-PAGER", 14, 289);
    doc.setFont("helvetica", "normal");
    doc.text("PAGE 1 OF 1", 196, 289, { align: "right" });

    const fileName = `St_Andrews_AI_Financial_Summary_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
  } catch (err) {
    console.error("Failed to generate AI summary PDF:", err);
  }
}

/**
 * Prints a formatted 1-page printable document for the AI Report Summary.
 */
export function printAiSummaryReport(aiData: any, filtersInfo: string): void {
  const fileDate = new Date().toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${aiData.title || "St. Andrew's PCEA AI Financial Report Summary"}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 20px;
      line-height: 1.5;
      font-size: 11px;
    }
    .page-card {
      border: 2px solid #0f172a;
      border-radius: 12px;
      padding: 24px;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      width: 40px;
      height: 40px;
      background-color: #0f172a;
      color: #ffffff;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 20px;
    }
    .title {
      font-size: 15px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
      margin: 0;
    }
    .subtitle {
      font-size: 9.5px;
      font-weight: 700;
      color: #4f46e5;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .badge {
      background: #4f46e5;
      color: #ffffff;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .section-title {
      font-size: 10.5px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #1e293b;
      border-left: 4px solid #4f46e5;
      padding-left: 8px;
      margin-top: 14px;
      margin-bottom: 6px;
    }
    .narrative {
      font-size: 10.5px;
      color: #334155;
      text-align: justify;
      margin-bottom: 14px;
      line-height: 1.6;
      background: #f8fafc;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    .box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
    }
    ul {
      margin: 0;
      padding-left: 16px;
    }
    li {
      margin-bottom: 4px;
      color: #334155;
      font-size: 10px;
    }
    .footer {
      margin-top: 20px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5px;
      color: #64748b;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="page-card">
    <div class="header">
      <div class="brand">
        <div class="brand-logo">✝</div>
        <div>
          <h1 class="title">St. Andrew's PCEA</h1>
          <p class="subtitle">AI Executive Financial Report Summary (1-Pager)</p>
        </div>
      </div>
      <div style="text-align: right;">
        <span class="badge">AI Certified</span>
        <div style="font-size: 9px; font-weight: 700; color: #64748b; margin-top: 4px;">DATE: ${fileDate}</div>
        <div style="font-size: 8px; font-family: monospace; color: #94a3b8;">SCOPE: ${filtersInfo}</div>
      </div>
    </div>

    <div class="section-title">${aiData.title || "Executive Financial Summary"}</div>
    <div style="font-size: 9px; font-weight: 800; color: #4f46e5; margin-bottom: 8px; text-transform: uppercase;">
      PERIOD: ${aiData.periodLabel || filtersInfo}
    </div>

    <div class="section-title">Executive Summary Narrative</div>
    <div class="narrative">
      ${aiData.executiveNarrative}
    </div>

    <div class="grid">
      <div class="box">
        <div class="section-title" style="margin-top:0;">Key Financial Highlights</div>
        <ul>
          ${(aiData.keyHighlights || []).map((h: string) => `<li>${h}</li>`).join("")}
        </ul>
      </div>
      <div class="box">
        <div class="section-title" style="margin-top:0;">Audit & Governance Observations</div>
        <ul>
          ${(aiData.auditObservations || []).map((o: string) => `<li>${o}</li>`).join("")}
        </ul>
      </div>
    </div>

    <div class="box">
      <div class="section-title" style="margin-top:0;">Strategic Treasury Recommendations</div>
      <ul>
        ${(aiData.treasuryRecommendations || []).map((r: string) => `<li>${r}</li>`).join("")}
      </ul>
    </div>

    <div class="footer">
      <div>ST. ANDREW'S PCEA eREQUISITIONS PORTAL — OFFICIAL AI FINANCIAL AUDIT SUMMARY</div>
      <div>GENERATED AT ${new Date(aiData.generatedAt || Date.now()).toLocaleString()}</div>
    </div>
  </div>
</body>
</html>
  `;

  const printWindow = window.open("", "_blank", "width=850,height=1000");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }
}
