import React, { useState, useEffect } from "react";
import { Megaphone, Calendar, Users, Eye, ArrowRight, ExternalLink, Sparkles, Send, Clock, X, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CampaignPromotion } from "../types";
import { buildCampaignEmailHtml } from "../lib/campaignEmailTemplate";
import { formatCurrency } from "../lib/utils";
import { useRequisitions } from "../contexts/RequisitionContext";

interface ActiveCampaignsWidgetProps {
  onViewChange?: (view: string) => void;
  getAuthHeaders?: () => Promise<Record<string, string>>;
}

export const ActiveCampaignsWidget: React.FC<ActiveCampaignsWidgetProps> = ({
  onViewChange,
  getAuthHeaders
}) => {
  const { systemSettings } = useRequisitions();
  const [campaigns, setCampaigns] = useState<CampaignPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewCampaign, setPreviewCampaign] = useState<CampaignPromotion | null>(null);

  // If master toggle turns off campaigns, hide widget from dashboard
  if (systemSettings?.campaignsMasterEnabled === false) {
    return null;
  }

  useEffect(() => {
    let isMounted = true;
    const fetchCampaigns = async () => {
      try {
        setLoading(true);
        const headers = getAuthHeaders ? await getAuthHeaders() : {};
        const res = await fetch("/api/campaigns", { headers });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setCampaigns(data.campaigns || []);
          }
        }
      } catch (err) {
        console.error("Failed to load active campaigns on dashboard:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCampaigns();
    return () => { isMounted = false; };
  }, [getAuthHeaders]);

  // Filter to active promotional campaigns (SENT recently or SCHEDULED)
  const activeCampaigns = campaigns.filter(c => c.status === "SCHEDULED" || c.status === "SENT");

  if (!loading && activeCampaigns.length === 0) {
    return null; // Gracefully hide if no campaigns are present
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/50">
            <Megaphone size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Active Church Campaigns & Announcements
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Broadcast initiatives, special service drives, and member engagement campaigns
            </p>
          </div>
        </div>

        {onViewChange && (
          <button
            type="button"
            onClick={() => onViewChange("campaigns")}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-all cursor-pointer"
          >
            <span>Manage All Campaigns</span>
            <ArrowRight size={13} />
          </button>
        )}
      </div>

      {/* Campaigns Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800/40 animate-pulse border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeCampaigns.slice(0, 3).map(camp => {
            const isScheduled = camp.status === "SCHEDULED";
            const dateStr = isScheduled
              ? (camp.scheduledFor ? new Date(camp.scheduledFor).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Scheduled")
              : (camp.sentAt ? `Dispatched ${new Date(camp.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Active");

            return (
              <motion.div
                key={camp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group bg-slate-50/70 dark:bg-slate-950/50 hover:bg-white dark:hover:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800"
              >
                {/* Banner Graphic or Fallback Header */}
                <div className="relative h-28 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 overflow-hidden flex items-center justify-center">
                  {camp.bannerImageUrl ? (
                    <img
                      src={camp.bannerImageUrl}
                      alt={camp.bannerImageAlt || camp.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-white/80">
                      <Sparkles size={20} className="text-amber-400 mb-1" />
                      <span className="text-[10px] uppercase font-black tracking-widest text-white/90 truncate max-w-full">
                        {camp.category?.replace(/_/g, " ")}
                      </span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                  {/* Status Badge */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-md shadow-xs ${
                      isScheduled 
                        ? "bg-amber-500/90 text-white" 
                        : "bg-emerald-600/90 text-white"
                    }`}>
                      {isScheduled ? <Clock size={10} /> : <Send size={10} />}
                      {isScheduled ? "Scheduled Broadcast" : "Dispatched"}
                    </span>
                  </div>

                  {camp.badgeText && (
                    <div className="absolute bottom-2.5 left-2.5 right-2.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-amber-300 truncate block drop-shadow-sm">
                        {camp.badgeText}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {camp.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {camp.preheader || camp.subject || camp.headline}
                    </p>
                  </div>

                  {/* Metadata Chips */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    <div className="flex items-center gap-1 truncate">
                      <Calendar size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate">{dateStr}</span>
                    </div>

                    {camp.targetAmount && camp.targetAmount > 0 && (
                      <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(camp.targetAmount)} Goal
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewCampaign(camp)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Eye size={13} />
                      <span>Preview Email</span>
                    </button>

                    {onViewChange && (
                      <button
                        type="button"
                        onClick={() => onViewChange("campaigns")}
                        className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                        title="View details in Campaigns Hub"
                      >
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* RENDERED EMAIL PREVIEW MODAL */}
      <AnimatePresence>
        {previewCampaign && (
          <div className="fixed inset-0 z-[150] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden my-auto"
            >
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {previewCampaign.category?.replace(/_/g, " ")}
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-md">
                      {previewCampaign.title}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Subject: {previewCampaign.subject}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const newWin = window.open("", "_blank");
                      if (newWin) {
                        newWin.document.write(buildCampaignEmailHtml(previewCampaign));
                        newWin.document.close();
                      }
                    }}
                    className="p-2 text-slate-500 hover:text-indigo-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Open in new window"
                  >
                    <ExternalLink size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewCampaign(null)}
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Close preview"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-4 md:p-6 flex justify-center overflow-y-auto">
                <div className="w-[620px] max-w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-300">
                  <iframe
                    title="Rendered Campaign Email"
                    srcDoc={buildCampaignEmailHtml(previewCampaign, {
                      recipientEmail: "member@pceastandrews.org",
                      recipientName: "Parish Member"
                    })}
                    className="w-full h-[620px] border-none"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
