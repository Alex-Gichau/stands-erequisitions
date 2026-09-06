import React, { useState, useEffect } from "react";
import { 
  Download, 
  X, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Calendar, 
  Building2, 
  Filter, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle,
  Hash,
  Coins,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatCurrency, cn } from "../lib/utils";

export type ExportFormat = "pdf" | "csv" | "html" | "print";

export interface ExportConfirmationParams {
  title?: string;
  reportType?: string;
  fiscalYear?: string | number;
  dateRange?: { start?: string; end?: string };
  groupName?: string;
  statusFilter?: string;
  recordCount?: number;
  totalAmount?: number;
  defaultFormat?: ExportFormat;
  onConfirm: (selectedFormat: ExportFormat) => void;
  onCancel: () => void;
}

export interface ExportConfirmationModalProps {
  isOpen: boolean;
  params: ExportConfirmationParams | null;
  onClose: () => void;
}

export const ExportConfirmationModal: React.FC<ExportConfirmationModalProps> = ({
  isOpen,
  params,
  onClose
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("csv");

  useEffect(() => {
    if (params?.defaultFormat) {
      setSelectedFormat(params.defaultFormat);
    } else {
      setSelectedFormat("csv");
    }
  }, [params]);

  if (!isOpen || !params) return null;

  const {
    title = "Confirm Data Export & Download",
    reportType = "Financial Requisitions Summary",
    fiscalYear = "Current FY",
    dateRange,
    groupName = "All Church Groups",
    statusFilter = "All Statuses",
    recordCount = 0,
    totalAmount = 0,
    onConfirm
  } = params;

  const formatOptions: { id: ExportFormat; label: string; ext: string; icon: any; color: string; bg: string; desc: string }[] = [
    {
      id: "csv",
      label: "CSV Spreadsheet",
      ext: ".CSV",
      icon: FileSpreadsheet,
      color: "text-emerald-600 dark:text-emerald-400 border-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      desc: "Raw structured dataset ideal for Excel, Google Sheets, or audit calculations."
    },
    {
      id: "pdf",
      label: "PDF Document",
      ext: ".PDF",
      icon: FileText,
      color: "text-rose-600 dark:text-rose-400 border-rose-500",
      bg: "bg-rose-50 dark:bg-rose-950/40",
      desc: "Formatted document with official St. Andrew's headers, signatures, and timestamps."
    },
    {
      id: "html",
      label: "Interactive HTML / Print",
      ext: ".HTML",
      icon: Printer,
      color: "text-blue-600 dark:text-blue-400 border-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      desc: "Standalone interactive web summary suitable for browser printing or archival."
    }
  ];

  const handleExecute = () => {
    onConfirm(selectedFormat);
    onClose();
  };

  const formattedDatePeriod = () => {
    if (dateRange?.start || dateRange?.end) {
      const start = dateRange.start || "Beginning";
      const end = dateRange.end || "Present";
      return `${start} to ${end}`;
    }
    return `Fiscal Year: ${fiscalYear}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-start justify-between gap-4 relative overflow-hidden">
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
              
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
                  <Download className="text-blue-300" size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                      Export Safeguard Verification
                    </span>
                  </div>
                  <h3 className="text-lg font-black tracking-tight mt-0.5 leading-snug">{title}</h3>
                  <p className="text-xs text-blue-200/80 font-medium">{reportType}</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer shrink-0 relative z-10"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              
              {/* Fiscal Parameters Summary Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700 pb-2.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                    <Filter size={14} className="text-blue-600 dark:text-blue-400" />
                    Verified Fiscal Parameters
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Filter Validated
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-start gap-2">
                    <Calendar size={15} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 font-medium block text-[10px] uppercase">Period / Timeline</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{formattedDatePeriod()}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Building2 size={15} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 font-medium block text-[10px] uppercase">Ministry / Group</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate block max-w-[180px]" title={groupName}>
                        {groupName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={15} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 font-medium block text-[10px] uppercase">Approval Stage</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{statusFilter}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Hash size={15} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 font-medium block text-[10px] uppercase">Record Volume</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">{recordCount} lines / items</span>
                    </div>
                  </div>
                </div>

                {/* Total Financial Summary Banner */}
                {totalAmount > 0 && (
                  <div className="mt-2 pt-2.5 border-t border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                      <Coins size={14} className="text-amber-500" />
                      Aggregated Financial Value:
                    </span>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                )}
              </div>

              {/* Target Format Selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                  Select Output File Format
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {formatOptions.map((fmt) => {
                    const IconComponent = fmt.icon;
                    const isSelected = selectedFormat === fmt.id;
                    return (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setSelectedFormat(fmt.id)}
                        className={cn(
                          "p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer",
                          isSelected
                            ? `${fmt.bg} ${fmt.color} border-2 shadow-xs font-bold`
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <IconComponent size={18} />
                            <span className="text-xs font-extrabold">{fmt.ext}</span>
                          </div>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                              <Check size={11} strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="text-[11px] font-bold leading-tight">{fmt.label}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Format Details */}
                <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/80 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2">
                  <AlertCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
                  <span>
                    {formatOptions.find(f => f.id === selectedFormat)?.desc}
                  </span>
                </div>
              </div>

              {/* Audit Security Notice */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                <span>Bulk data downloads are logged in the St. Andrew's security audit trail.</span>
              </div>

            </div>

            {/* Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
              >
                Cancel &amp; Adjust Filters
              </button>
              <button
                type="button"
                onClick={handleExecute}
                className="px-6 py-2.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-2xl transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-2"
              >
                <Download size={15} />
                <span>Confirm &amp; Download Export</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
