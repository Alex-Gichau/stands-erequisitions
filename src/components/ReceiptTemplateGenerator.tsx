/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useMemo } from "react";
import { Requisition, RequisitionStatus } from "../types";
import { formatCurrency, formatDate, cn } from "../lib/utils";
import { Printer, Download, X, FileText, CheckCircle, Paperclip, Loader2, Image as ImageIcon, Lock } from "lucide-react";
import { motion } from "motion/react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { printRequisitionReceipt, downloadReceiptHtml, getReceiptFileName } from "../utils/exportUtils";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";

interface ReceiptTemplateGeneratorProps {
  req: Requisition;
  onClose: () => void;
}

export const ReceiptTemplateGenerator: React.FC<ReceiptTemplateGeneratorProps> = ({ req, onClose }) => {
  const { uploadReceipts, addSystemLog } = useRequisitions();
  const [isAttaching, setIsAttaching] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [attached, setAttached] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const qrPayload = useMemo(() => {
    return JSON.stringify({
      protocol: "ST_ANDREWS_REQUISITION_RECEIPT",
      requisitionId: req.id,
      title: req.title,
      amount: req.amount,
      status: req.status,
      requester: req.requesterName,
      group: req.groupName,
      date: req.submittedAt,
      disbursedAt: req.disbursedAt || "N/A",
      verifyUrl: `${window.location.origin}?requisitionId=${req.id}`
    }, null, 2);
  }, [req]);

  const printReceipt = () => {
    printRequisitionReceipt(req);
  };

  const downloadHtml = () => {
    downloadReceiptHtml(req);
  };

  const downloadImage = async () => {
    if (!receiptRef.current) return;
    setIsDownloadingImage(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false
      });
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = getReceiptFileName(req, "png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to download receipt image:", error);
      alert("Could not download receipt image.");
    } finally {
      setIsDownloadingImage(false);
    }
  };

  const attachToRequisition = async () => {
    if (!receiptRef.current) return;

    if (req.status !== RequisitionStatus.DISBURSED) {
      alert("Receipts can only be attached after all approvals are confirmed and disbursement is completed.");
      return;
    }
    
    setIsAttaching(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false
      });

      const imageData = canvas.toDataURL("image/png");
      
      // Attach to requisition
      await uploadReceipts(req.id, [imageData]);
      await addSystemLog("RECEIPT_ATTACHED", `Self-generated template receipt attached to Requisition ID: ${req.id}`, { requisitionId: req.id });
      
      setAttached(true);
      setTimeout(() => setAttached(false), 3000);
    } catch (error) {
      console.error("Failed to attach receipt:", error);
      alert("Failed to attach receipt to ledger.");
    } finally {
      setIsAttaching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2rem] w-full max-w-3xl my-auto shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 sm:px-8 sm:py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80 sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 dark:bg-slate-800 rounded-xl flex items-center justify-center text-white shadow-md">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Expenditure Receipt Preview</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">{req.groupName} • {req.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-full transition-all text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Modal Content / Preview Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/60 dark:bg-slate-950/60 flex justify-center">
          <div 
            ref={receiptRef}
            className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 w-full max-w-[650px] shadow-sm relative overflow-hidden select-none text-slate-900 flex flex-col justify-between gap-8 min-h-[680px]"
            style={{ backgroundColor: "#ffffff" }}
          >
            {/* Very Subtle Vector Background Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.025] select-none z-0">
              <svg viewBox="0 0 100 100" className="w-[400px] h-[400px] text-slate-900" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="50" cy="50" r="44" strokeWidth="1.5" strokeDasharray="3 3" />
                <circle cx="50" cy="50" r="40" strokeWidth="1" />
                <line x1="22" y1="22" x2="78" y2="78" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="78" y1="22" x2="22" y2="78" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="50" y1="18" x2="50" y2="82" strokeWidth="3.5" />
                <line x1="32" y1="38" x2="68" y2="38" strokeWidth="3.5" />
                <circle cx="50" cy="38" r="8" strokeWidth="1.5" />
              </svg>
            </div>

            {/* Receipt Main Section */}
            <div className="relative z-10 flex flex-col gap-6">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-2xl shadow-sm">
                    ✝
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-xl font-black uppercase text-slate-900 leading-none tracking-tight">St. Andrews</h1>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Expenditure Receipt</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Receipt #</div>
                  <div className="font-mono text-sm sm:text-base font-extrabold text-slate-900">#{req.id.toUpperCase()}</div>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Issued To</span>
                  <div className="text-sm font-extrabold text-slate-900">{req.requesterName}</div>
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-tight mt-0.5">{req.groupName}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Transaction Date</span>
                  <div className="text-sm font-extrabold text-slate-900">{formatDate(req.submittedAt)}</div>
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-tight mt-0.5">FY {req.fiscalYear || "2026"}</div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border-b border-slate-200 pb-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-900">
                      <th className="pb-2 text-xs font-black text-slate-900 uppercase tracking-widest">Item Description</th>
                      <th className="pb-2 text-xs font-black text-slate-900 uppercase tracking-widest text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-4 align-top pr-4">
                        <div className="text-base font-bold text-slate-900 mb-1">{req.title}</div>
                        <div className="text-xs text-slate-600 leading-relaxed italic">"{req.description}"</div>
                        <div className="mt-3">
                          <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            Status: {req.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 text-right align-top font-mono font-extrabold text-slate-900 text-base">
                        {formatCurrency(req.amount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Amount in Words */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Amount in Words</span>
                <div className="text-sm font-bold text-slate-800 uppercase font-serif tracking-tight leading-snug">{req.amountWords}</div>
              </div>
            </div>

            {/* Receipt Footer */}
            <div className="relative z-10 pt-5 border-t-2 border-dashed border-slate-300 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mt-auto">
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle size={15} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Authorized Digitally</span>
                </div>
                <div className="border-t border-slate-400 pt-1.5 w-36">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ministry Stamp</p>
                </div>
              </div>

              {/* QR Verification */}
              <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 p-2 rounded-xl">
                <div className="bg-white p-1 rounded-lg border border-slate-200 shrink-0">
                  <QRCodeSVG 
                    value={qrPayload}
                    size={56}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                  />
                </div>
                <div className="text-left space-y-0.5">
                  <span className="inline-block text-[8px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    Verified
                  </span>
                  <p className="text-[9px] font-bold text-slate-900 uppercase tracking-tight">Mobile Scan</p>
                  <p className="text-[8px] font-mono text-slate-500">#{req.id.toUpperCase()}</p>
                </div>
              </div>

              {/* Grand Total */}
              <div className="text-right">
                <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono leading-none mb-1">{formatCurrency(req.amount)}</div>
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Value Paid</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 sm:px-8 sm:py-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:block">
            Download or print receipt with ministry and title in filename.
          </div>
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            <button 
              onClick={downloadHtml}
              className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Download clean HTML receipt"
            >
              <Download size={14} />
              <span>HTML</span>
            </button>

            <button 
              onClick={downloadImage}
              disabled={isDownloadingImage}
              className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Download PNG image of receipt"
            >
              {isDownloadingImage ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
              <span>Image</span>
            </button>

            <button 
              onClick={attachToRequisition}
              disabled={isAttaching || attached || req.status !== RequisitionStatus.DISBURSED}
              className={cn(
                "px-4 py-2.5 border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                req.status !== RequisitionStatus.DISBURSED
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-70"
                  : attached 
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400" 
                    : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
              )}
              title={
                req.status !== RequisitionStatus.DISBURSED
                  ? "Receipts can only be attached after all approvals are confirmed and disbursement is completed"
                  : "Attach receipt image directly to requisition record"
              }
            >
              {req.status !== RequisitionStatus.DISBURSED ? (
                <>
                  <Lock size={14} className="text-slate-400 dark:text-slate-500" />
                  <span>Attach (Disbursement Required)</span>
                </>
              ) : isAttaching ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Attaching...</span>
                </>
              ) : attached ? (
                <>
                  <CheckCircle size={14} />
                  <span>Attached</span>
                </>
              ) : (
                <>
                  <Paperclip size={14} />
                  <span>Attach to Requisition</span>
                </>
              )}
            </button>

            <button 
              onClick={printReceipt}
              className="px-5 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Printer size={14} />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
