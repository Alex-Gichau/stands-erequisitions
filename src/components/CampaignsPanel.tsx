import React, { useState, useEffect, useMemo } from "react";
import { 
  Megaphone, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Image as ImageIcon, 
  Users, 
  Eye, 
  Plus, 
  X, 
  Trash2, 
  RefreshCw, 
  Sparkles, 
  Smartphone, 
  Monitor, 
  ExternalLink, 
  Search, 
  ShieldCheck, 
  Mail, 
  Upload, 
  Layers, 
  Check, 
  Copy,
  ChevronRight,
  ArrowRight,
  Radio,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { CampaignPromotion, CampaignCategory, CampaignAudienceType, UserRole } from "../types";
import { 
  buildCampaignEmailHtml, 
  PRESET_BANNERS, 
  PRESET_CAMPAIGN_TEMPLATES, 
  getCategoryBadgeColor 
} from "../lib/campaignEmailTemplate";
import { cn } from "../lib/utils";

interface CampaignsPanelProps {
  onNavigateToUsers?: () => void;
}

export const CampaignsPanel: React.FC<CampaignsPanelProps> = ({ onNavigateToUsers }) => {
  const { currentUser, users, churchGroups, getAuthHeaders, triggerToast } = useRequisitions();

  const [campaigns, setCampaigns] = useState<CampaignPromotion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"ALL" | "SCHEDULED" | "SENT" | "DRAFT">("SCHEDULED");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal states
  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false);
  const [previewCampaign, setPreviewCampaign] = useState<CampaignPromotion | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [composerStep, setComposerStep] = useState<"EDIT" | "PREVIEW">("EDIT");

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Composer Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CampaignCategory>("FUNDRAISING");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [badgeText, setBadgeText] = useState("");
  const [headline, setHeadline] = useState("");
  const [bodyContent, setBodyContent] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [bannerImageAlt, setBannerImageAlt] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventVenue, setEventVenue] = useState("");
  const [targetAmount, setTargetAmount] = useState<string>("");
  const [scriptureVerse, setScriptureVerse] = useState("");
  const [scriptureReference, setScriptureReference] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  
  // Audience Targeting State
  const [targetAudience, setTargetAudience] = useState<CampaignAudienceType>("ALL_MEMBERS");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState("");

  // Dispatch vs Schedule State
  const [sendOption, setSendOption] = useState<"IMMEDIATE" | "SCHEDULE">("SCHEDULE");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");

  // Fetch campaigns from server
  const fetchCampaigns = async () => {
    try {
      setIsLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch("/api/campaigns", { headers });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error("Failed to load campaigns:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Set default schedule date to tomorrow at 09:00 AM
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    setScheduledDate(`${yyyy}-${mm}-${dd}`);
    setScheduledTime("09:00");
  }, []);

  // Compute live recipient estimate
  const estimatedRecipients = useMemo(() => {
    if (targetAudience === "ALL_MEMBERS") {
      return users.filter(u => u.email && u.email.includes("@"));
    }
    if (targetAudience === "GROUPS") {
      if (selectedGroups.length === 0) return [];
      const groupsLower = selectedGroups.map(g => g.toLowerCase());
      return users.filter(u => {
        if (!u.email || !u.email.includes("@")) return false;
        const primaryGroup = (u.group || "").toLowerCase();
        let otherGroups: string[] = [];
        if (typeof u.groups === "string") {
          try { otherGroups = JSON.parse(u.groups); } catch (e) { otherGroups = [u.groups]; }
        } else if (Array.isArray(u.groups)) {
          otherGroups = u.groups;
        }
        return groupsLower.includes(primaryGroup) || otherGroups.some(g => groupsLower.includes(String(g).toLowerCase()));
      });
    }
    if (targetAudience === "ROLES") {
      if (selectedRoles.length === 0) return [];
      return users.filter(u => u.email && u.email.includes("@") && selectedRoles.includes(u.role));
    }
    if (targetAudience === "CUSTOM") {
      return users.filter(u => selectedUserIds.includes(u.id) && u.email && u.email.includes("@"));
    }
    return [];
  }, [users, targetAudience, selectedGroups, selectedRoles, selectedUserIds]);

  // Construct draft campaign object for live preview
  const currentDraftCampaign = useMemo<Partial<CampaignPromotion>>(() => {
    let finalScheduledFor: string | null = null;
    if (sendOption === "SCHEDULE" && scheduledDate && scheduledTime) {
      finalScheduledFor = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
    }

    return {
      id: "preview_draft",
      title: title || "Untitled Campaign",
      category,
      subject: subject || title || "PCEA St. Andrew's Church Announcement",
      preheader: preheader || "Official campaign broadcast from PCEA St. Andrew's Church",
      badgeText: badgeText || category.replace(/_/g, " "),
      headline: headline || title || "Special Church Announcement",
      bodyContent: bodyContent || "Enter your campaign promotional message here...",
      bannerImageUrl: bannerImageUrl || undefined,
      bannerImageAlt: bannerImageAlt || headline || title,
      eventDate: eventDate || undefined,
      eventTime: eventTime || undefined,
      eventVenue: eventVenue || undefined,
      targetAmount: targetAmount ? Number(targetAmount) : undefined,
      scriptureVerse: scriptureVerse || undefined,
      scriptureReference: scriptureReference || undefined,
      ctaText: ctaText || undefined,
      ctaUrl: ctaUrl || undefined,
      targetAudience,
      targetGroups: selectedGroups,
      targetRoles: selectedRoles,
      status: sendOption === "SCHEDULE" ? "SCHEDULED" : "SENDING",
      scheduledFor: finalScheduledFor,
      createdBy: currentUser?.id || "admin",
      creatorName: currentUser?.name || "Administrator"
    };
  }, [
    title, category, subject, preheader, badgeText, headline, bodyContent,
    bannerImageUrl, bannerImageAlt, eventDate, eventTime, eventVenue, targetAmount,
    scriptureVerse, scriptureReference, ctaText, ctaUrl, targetAudience,
    selectedGroups, selectedRoles, sendOption, scheduledDate, scheduledTime, currentUser
  ]);

  // Handle Preset Template Application
  const applyPresetTemplate = (tplId: string) => {
    const tpl = PRESET_CAMPAIGN_TEMPLATES.find(t => t.id === tplId);
    if (!tpl) return;

    setTitle(tpl.title);
    setCategory(tpl.category);
    setSubject(tpl.subject);
    setPreheader(tpl.preheader);
    setBadgeText(tpl.badgeText);
    setHeadline(tpl.headline);
    setBodyContent(tpl.bodyContent);
    setBannerImageUrl(tpl.bannerImageUrl);
    setBannerImageAlt(tpl.bannerImageAlt);
    setEventDate(tpl.eventDate || "");
    setEventTime(tpl.eventTime || "");
    setEventVenue(tpl.eventVenue || "");
    setTargetAmount(tpl.targetAmount ? String(tpl.targetAmount) : "");
    setScriptureVerse(tpl.scriptureVerse || "");
    setScriptureReference(tpl.scriptureReference || "");
    setCtaText(tpl.ctaText || "");
    setCtaUrl(tpl.ctaUrl || "");

    triggerToast({
      type: "SYSTEM_INFO",
      message: `Template loaded: "${tpl.title}"`,
      severity: "LOW",
      timestamp: new Date().toISOString()
    });
  };

  // Image file upload handler (converts to base64 Data URI)
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Image is larger than 5MB. Please choose a smaller image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setBannerImageUrl(reader.result);
        if (!bannerImageAlt) {
          setBannerImageAlt(file.name.replace(/\.[^/.]+$/, ""));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit Campaign (Schedule or Send)
  const handleSubmitCampaign = async (isDraftMode: boolean = false) => {
    if (!title.trim()) {
      alert("Please provide a campaign title.");
      return;
    }
    if (!headline.trim()) {
      alert("Please provide a main headline.");
      return;
    }
    if (!bodyContent.trim()) {
      alert("Please provide the email body content.");
      return;
    }

    let finalScheduledFor: string | null = null;
    if (!isDraftMode && sendOption === "SCHEDULE") {
      if (!scheduledDate || !scheduledTime) {
        alert("Please select both a scheduled date and time.");
        return;
      }
      const sched = new Date(`${scheduledDate}T${scheduledTime}:00`);
      if (sched.getTime() <= Date.now()) {
        alert("Scheduled time must be in the future. If you wish to broadcast now, select 'Send Immediately'.");
        return;
      }
      finalScheduledFor = sched.toISOString();
    }

    try {
      setIsSubmitting(true);
      const headers = await getAuthHeaders();

      const payload = {
        title,
        category,
        subject: subject.trim() || title.trim(),
        preheader,
        badgeText,
        headline,
        bodyContent,
        bannerImageUrl,
        bannerImageAlt,
        eventDate,
        eventTime,
        eventVenue,
        targetAmount: targetAmount ? Number(targetAmount) : undefined,
        scriptureVerse,
        scriptureReference,
        ctaText,
        ctaUrl,
        targetAudience,
        targetGroups: selectedGroups,
        targetRoles: selectedRoles,
        customRecipients: selectedUserIds.map(id => users.find(u => u.id === id)?.email).filter(Boolean),
        scheduledFor: finalScheduledFor,
        isDraft: isDraftMode
      };

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create campaign");
      }

      triggerToast({
        type: "SYSTEM_INFO",
        message: isDraftMode
          ? "Campaign saved as draft."
          : sendOption === "SCHEDULE"
          ? `Campaign scheduled for ${new Date(finalScheduledFor!).toLocaleString("en-GB")}.`
          : `Campaign dispatched to ${data.result?.total || 0} members!`,
        severity: "LOW",
        timestamp: new Date().toISOString()
      });

      setIsComposerOpen(false);
      fetchCampaigns();
    } catch (err: any) {
      alert(err.message || "Failed to save or broadcast campaign");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Immediate send action on existing scheduled or draft campaign
  const handleSendNow = async (campaign: CampaignPromotion) => {
    if (!confirm(`Are you sure you want to broadcast "${campaign.title}" immediately to all targeted members?`)) {
      return;
    }

    try {
      setActionLoadingId(campaign.id);
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/campaigns/${campaign.id}/send-now`, {
        method: "POST",
        headers
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to broadcast");

      triggerToast({
        type: "SYSTEM_INFO",
        message: `Campaign broadcast dispatched! Processed ${data.result?.total || 0} recipients.`,
        severity: "LOW",
        timestamp: new Date().toISOString()
      });
      fetchCampaigns();
    } catch (err: any) {
      alert(err.message || "Broadcast failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Cancel scheduled campaign
  const handleCancelCampaign = async (campaign: CampaignPromotion) => {
    if (!confirm(`Cancel the scheduled broadcast for "${campaign.title}"?`)) return;

    try {
      setActionLoadingId(campaign.id);
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/campaigns/${campaign.id}/cancel`, {
        method: "POST",
        headers
      });
      if (res.ok) {
        triggerToast({
          type: "SYSTEM_INFO",
          message: "Scheduled campaign was cancelled.",
          severity: "LOW",
          timestamp: new Date().toISOString()
        });
        fetchCampaigns();
      }
    } catch (err: any) {
      alert(err.message || "Failed to cancel");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete campaign
  const handleDeleteCampaign = async (campaign: CampaignPromotion) => {
    if (!confirm(`Delete campaign "${campaign.title}" permanently?`)) return;

    try {
      setActionLoadingId(campaign.id);
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "DELETE",
        headers
      });
      if (res.ok) {
        setCampaigns(prev => prev.filter(c => c.id !== campaign.id));
        triggerToast({
          type: "SYSTEM_INFO",
          message: "Campaign deleted.",
          severity: "LOW",
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Duplicate campaign into composer
  const handleDuplicateCampaign = (campaign: CampaignPromotion) => {
    setTitle(`${campaign.title} (Copy)`);
    setCategory(campaign.category);
    setSubject(campaign.subject);
    setPreheader(campaign.preheader || "");
    setBadgeText(campaign.badgeText || "");
    setHeadline(campaign.headline);
    setBodyContent(campaign.bodyContent);
    setBannerImageUrl(campaign.bannerImageUrl || "");
    setBannerImageAlt(campaign.bannerImageAlt || "");
    setEventDate(campaign.eventDate || "");
    setEventTime(campaign.eventTime || "");
    setEventVenue(campaign.eventVenue || "");
    setTargetAmount(campaign.targetAmount ? String(campaign.targetAmount) : "");
    setScriptureVerse(campaign.scriptureVerse || "");
    setScriptureReference(campaign.scriptureReference || "");
    setCtaText(campaign.ctaText || "");
    setCtaUrl(campaign.ctaUrl || "");
    setTargetAudience(campaign.targetAudience);
    setSelectedGroups(campaign.targetGroups || []);
    setSelectedRoles(campaign.targetRoles || []);
    setSendOption("SCHEDULE");
    setIsComposerOpen(true);
    setComposerStep("EDIT");
  };

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      if (activeTab === "SCHEDULED" && c.status !== "SCHEDULED") return false;
      if (activeTab === "SENT" && c.status !== "SENT") return false;
      if (activeTab === "DRAFT" && c.status !== "DRAFT" && c.status !== "CANCELLED") return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = c.title?.toLowerCase().includes(query);
        const matchesSubject = c.subject?.toLowerCase().includes(query);
        const matchesHeadline = c.headline?.toLowerCase().includes(query);
        return matchesTitle || matchesSubject || matchesHeadline;
      }
      return true;
    });
  }, [campaigns, activeTab, searchTerm]);

  // Statistics
  const scheduledCount = campaigns.filter(c => c.status === "SCHEDULED").length;
  const sentCount = campaigns.filter(c => c.status === "SENT").length;
  const totalAudienceCount = users.filter(u => u.email && u.email.includes("@")).length;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Main Call-to-action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full text-xs font-black uppercase tracking-wider">
            <Megaphone size={13} />
            <span>PCEA St. Andrew's Email Broadcasts</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Campaign Promotional Emails
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Design, schedule, and broadcast elegant promotional email newsletters with banners, event schedules, and donation goals to church members and ministry groups.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchCampaigns}
            title="Refresh campaigns"
            className="p-3 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl transition-all hover:scale-105 cursor-pointer"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={() => {
              applyPresetTemplate("harambee-2026");
              setIsComposerOpen(true);
              setComposerStep("EDIT");
            }}
            className="btn-primary py-3 px-6 rounded-2xl flex items-center gap-2.5 text-xs font-black uppercase tracking-wider shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus size={16} strokeWidth={3} />
            <span>New Promotional Campaign</span>
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Scheduled Queue</span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{scheduledCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Pending automated broadcast</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Completed Broadcasts</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{sentCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Dispatched to member inboxes</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Church Audience</span>
            <Users size={16} className="text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{totalAudienceCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Registered member emails</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Portal Mailer</span>
            <ShieldCheck size={16} className="text-indigo-500" />
          </div>
          <div className="text-sm font-black text-slate-900 dark:text-white font-mono truncate">
            ict.team@pceastandrews.org
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            SMTP Engine Active
          </p>
        </div>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("SCHEDULED")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2",
              activeTab === "SCHEDULED"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Clock size={14} className="text-amber-500" />
            <span>Scheduled Queue ({scheduledCount})</span>
          </button>

          <button
            onClick={() => setActiveTab("SENT")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2",
              activeTab === "SENT"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span>Sent History ({sentCount})</span>
          </button>

          <button
            onClick={() => setActiveTab("ALL")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
              activeTab === "ALL"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            All ({campaigns.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-primary/50"
          />
        </div>
      </div>

      {/* Campaigns Grid / List */}
      {filteredCampaigns.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <Megaphone size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {activeTab === "SCHEDULED" ? "No Scheduled Campaigns Pending" : "No Campaigns Found"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {activeTab === "SCHEDULED"
                ? "There are currently no promotional emails queued for future delivery. Create one now to schedule automatic broadcast."
                : "Try adjusting your search criteria or create a new campaign promotional email."}
            </p>
          </div>
          <button
            onClick={() => {
              applyPresetTemplate("harambee-2026");
              setIsComposerOpen(true);
            }}
            className="btn-primary py-2.5 px-5 rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus size={14} />
            <span>Create Campaign</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCampaigns.map((camp) => {
            const badgeColors = getCategoryBadgeColor(camp.category);
            const isScheduled = camp.status === "SCHEDULED";
            const isSent = camp.status === "SENT";
            const isLoadingAction = actionLoadingId === camp.id;

            return (
              <div 
                key={camp.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group"
              >
                {/* Banner Thumbnail */}
                <div className="h-44 bg-slate-950 relative overflow-hidden flex items-center justify-center">
                  {camp.bannerImageUrl ? (
                    <img 
                      src={camp.bannerImageUrl} 
                      alt={camp.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="text-slate-600 flex flex-col items-center gap-2">
                      <ImageIcon size={32} />
                      <span className="text-[10px] font-mono">No Banner Image</span>
                    </div>
                  )}

                  {/* Category Pill Over Image */}
                  <div className="absolute top-3 left-3">
                    <span 
                      style={{ backgroundColor: badgeColors.bg, color: badgeColors.text, borderColor: badgeColors.border }}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border shadow-sm"
                    >
                      {camp.badgeText || camp.category.replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* Status Indicator */}
                  <div className="absolute top-3 right-3">
                    {isScheduled ? (
                      <span className="px-2.5 py-1 bg-amber-500 text-slate-950 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md animate-pulse">
                        <Clock size={11} />
                        <span>Scheduled</span>
                      </span>
                    ) : isSent ? (
                      <span className="px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                        <CheckCircle2 size={11} />
                        <span>Sent</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-700 text-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        {camp.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Content Box */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-black text-slate-900 dark:text-white text-base leading-snug line-clamp-2">
                      {camp.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-2">
                      {camp.headline || camp.subject}
                    </p>

                    {/* Schedule / Sent Metadata Badge */}
                    {isScheduled && camp.scheduledFor && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                          <Clock size={13} />
                          <span>Broadcast Scheduled For:</span>
                        </div>
                        <div className="text-xs font-mono text-amber-900 dark:text-amber-200 font-semibold">
                          {new Date(camp.scheduledFor).toLocaleString("en-GB", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })} EAT
                        </div>
                      </div>
                    )}

                    {isSent && camp.sentAt && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                        <span>Delivered on:</span>
                        <span className="font-mono font-bold">
                          {new Date(camp.sentAt).toLocaleDateString("en-GB")}
                        </span>
                      </div>
                    )}

                    {/* Particulars preview pills */}
                    <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-slate-500">
                      {camp.eventDate && (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md font-medium">
                          📅 {camp.eventDate}
                        </span>
                      )}
                      {camp.targetAmount && (
                        <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-md font-bold">
                          🎯 KES {camp.targetAmount.toLocaleString()}
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded-md font-bold">
                        👥 {camp.targetAudience.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setPreviewCampaign(camp)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>Preview Email</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      {isScheduled && (
                        <>
                          <button
                            onClick={() => handleSendNow(camp)}
                            disabled={isLoadingAction}
                            title="Broadcast immediately without waiting"
                            className="px-3 py-1.5 bg-primary text-white hover:bg-primary/90 text-xs font-black uppercase rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-sm shadow-primary/20 disabled:opacity-50"
                          >
                            <Send size={12} />
                            <span>Send Now</span>
                          </button>
                          <button
                            onClick={() => handleCancelCampaign(camp)}
                            disabled={isLoadingAction}
                            title="Cancel schedule"
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                          >
                            <X size={15} />
                          </button>
                        </>
                      )}

                      {isSent && (
                        <button
                          onClick={() => handleDuplicateCampaign(camp)}
                          title="Duplicate as new campaign"
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Copy size={12} />
                          <span>Duplicate</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteCampaign(camp)}
                        disabled={isLoadingAction}
                        title="Delete campaign"
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* COMPOSER MODAL */}
      <AnimatePresence>
        {isComposerOpen && (
          <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Megaphone size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Campaign Promotional Email Composer
                    </h2>
                    <p className="text-xs text-slate-500">
                      Target Audience: <strong className="text-primary font-bold">{estimatedRecipients.length} members</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Step Switcher (Edit vs Live Preview) */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                    <button
                      onClick={() => setComposerStep("EDIT")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                        composerStep === "EDIT"
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      Editor
                    </button>
                    <button
                      onClick={() => setComposerStep("PREVIEW")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                        composerStep === "PREVIEW"
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      <Eye size={12} />
                      <span>Live HTML Preview</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setIsComposerOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                {composerStep === "EDIT" ? (
                  <>
                    {/* Preset Templates Selector Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Sparkles size={12} className="text-amber-500" />
                          <span>Quick Starter Templates</span>
                        </label>
                        <span className="text-[11px] text-slate-400">Click to autofill content</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {PRESET_CAMPAIGN_TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => applyPresetTemplate(tpl.id)}
                            className="p-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-left transition-all hover:scale-[1.01] cursor-pointer"
                          >
                            <span className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-400 block mb-1">
                              {tpl.category}
                            </span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1 block">
                              {tpl.title}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Section 1: Visual Hero Banner */}
                    <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <ImageIcon size={14} className="text-primary" />
                          <span>Promotional Hero Banner Image</span>
                        </label>
                        <span className="text-[11px] text-slate-400">Required for high-impact visual delivery</span>
                      </div>

                      {/* Preset Banner Selector */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {PRESET_BANNERS.map((banner) => (
                          <button
                            key={banner.id}
                            type="button"
                            onClick={() => {
                              setBannerImageUrl(banner.url);
                              setBannerImageAlt(banner.name);
                            }}
                            className={cn(
                              "relative rounded-xl overflow-hidden border-2 text-left transition-all cursor-pointer group",
                              bannerImageUrl === banner.url
                                ? "border-primary ring-2 ring-primary/20 shadow-md"
                                : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
                            )}
                          >
                            <img src={banner.url} alt={banner.name} className="w-full h-18 object-cover" />
                            <div className="p-1.5 bg-white dark:bg-slate-900">
                              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block truncate">
                                {banner.name}
                              </span>
                            </div>
                            {bannerImageUrl === banner.url && (
                              <div className="absolute top-1 right-1 bg-primary text-white rounded-full p-0.5">
                                <Check size={10} strokeWidth={3} />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Custom Upload or Image URL */}
                      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                        <label className="w-full sm:w-auto px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                          <Upload size={14} />
                          <span>Upload Image from Device</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleImageFileUpload} 
                            className="hidden" 
                          />
                        </label>

                        <div className="relative flex-1 w-full">
                          <input
                            type="text"
                            placeholder="Or paste external image URL (e.g. https://...)"
                            value={bannerImageUrl}
                            onChange={(e) => setBannerImageUrl(e.target.value)}
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-primary"
                          />
                        </div>

                        {bannerImageUrl && (
                          <button
                            type="button"
                            onClick={() => setBannerImageUrl("")}
                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
                            title="Remove image"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Section 2: Campaign Headings & Category */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Campaign Internal Title
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Phase II Sanctuary Expansion & Harambee 2026"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl text-sm font-semibold outline-none focus:border-primary"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Category
                        </label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value as CampaignCategory)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl text-sm font-bold outline-none focus:border-primary cursor-pointer"
                        >
                          <option value="FUNDRAISING">Fundraising / Harambee</option>
                          <option value="SPECIAL_SERVICE">Special Service / Liturgy</option>
                          <option value="EVENT">Church Event / Conference</option>
                          <option value="YOUTH">Youth & Missions</option>
                          <option value="STEWARDSHIP">Stewardship & Tithes</option>
                          <option value="FELLOWSHIP">Fellowship & Guild</option>
                          <option value="ANNOUNCEMENT">General Announcement</option>
                        </select>
                      </div>
                    </div>

                    {/* Section 3: Subject line & Headline */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Email Subject Header (Inbox Line)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 🏛️ Special Appeal: Annual Harvest & Building Harambee"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl text-sm outline-none focus:border-primary"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Main Headline (Displayed in HTML Page)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Annual Harvest & Building Development Fund Drive"
                          value={headline}
                          onChange={(e) => setHeadline(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl text-sm font-bold outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    {/* Scripture Quote Box */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-amber-500/5 p-4 rounded-2xl border border-amber-500/20">
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                          Theme Scripture Verse (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Let us rise up and build. So they strengthened their hands for this good work."
                          value={scriptureVerse}
                          onChange={(e) => setScriptureVerse(e.target.value)}
                          className="w-full px-4 py-2 bg-white dark:bg-slate-950 border border-amber-500/30 rounded-xl text-xs font-serif italic text-slate-900 dark:text-slate-100 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                          Reference
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Nehemiah 2:18"
                          value={scriptureReference}
                          onChange={(e) => setScriptureReference(e.target.value)}
                          className="w-full px-4 py-2 bg-white dark:bg-slate-950 border border-amber-500/30 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 outline-none"
                        />
                      </div>
                    </div>

                    {/* Email Body Rich Text */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Promotional Body Message (HTML / Formatted Paragraphs)
                      </label>
                      <textarea
                        rows={6}
                        placeholder="Write your official campaign letter or promotional text here. Double linebreaks create elegant paragraphs."
                        value={bodyContent}
                        onChange={(e) => setBodyContent(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl text-sm leading-relaxed outline-none focus:border-primary font-sans"
                      />
                    </div>

                    {/* Section 4: Particulars (Date, Venue, Goal, CTA) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Event Date
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Sunday, Oct 18, 2026"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Venue / Location
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Main Sanctuary"
                          value={eventVenue}
                          onChange={(e) => setEventVenue(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Target Budget / Goal (KES)
                        </label>
                        <input
                          type="number"
                          placeholder="e.g. 5000000"
                          value={targetAmount}
                          onChange={(e) => setTargetAmount(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-amber-600 outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          CTA Button Text
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Support Harambee Online"
                          value={ctaText}
                          onChange={(e) => setCtaText(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                        />
                      </div>
                    </div>

                    {/* Section 5: Target Audience Selection */}
                    <div className="space-y-3 bg-blue-50/50 dark:bg-blue-950/20 p-5 rounded-2xl border border-blue-200/60 dark:border-blue-900/30">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-2">
                          <Users size={14} className="text-blue-600" />
                          <span>Target Recipient Audience</span>
                        </label>
                        <span className="text-xs font-bold text-primary px-3 py-1 bg-white dark:bg-slate-900 rounded-full border border-primary/20 shadow-sm">
                          Reaches {estimatedRecipients.length} Church Members
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setTargetAudience("ALL_MEMBERS")}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                            targetAudience === "ALL_MEMBERS"
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          )}
                        >
                          All Church Members ({users.length})
                        </button>

                        <button
                          type="button"
                          onClick={() => setTargetAudience("GROUPS")}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                            targetAudience === "GROUPS"
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          )}
                        >
                          Filter by Ministry Groups
                        </button>

                        <button
                          type="button"
                          onClick={() => setTargetAudience("ROLES")}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                            targetAudience === "ROLES"
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          )}
                        >
                          Filter by Administrative Role
                        </button>
                      </div>

                      {/* Group Pills Selector */}
                      {targetAudience === "GROUPS" && (
                        <div className="pt-2 space-y-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Select one or more church groups:
                          </span>
                          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                            {churchGroups.map((cg) => {
                              const isSelected = selectedGroups.includes(cg.name);
                              return (
                                <button
                                  key={cg.id}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedGroups(selectedGroups.filter(g => g !== cg.name));
                                    } else {
                                      setSelectedGroups([...selectedGroups, cg.name]);
                                    }
                                  }}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border",
                                    isSelected
                                      ? "bg-primary text-white border-primary"
                                      : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                  )}
                                >
                                  {cg.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Role Selector */}
                      {targetAudience === "ROLES" && (
                        <div className="pt-2 flex flex-wrap gap-2">
                          {[
                            UserRole.CHURCH_GROUP,
                            UserRole.APPROVER_L1,
                            UserRole.APPROVER_L2,
                            UserRole.FINANCE,
                            UserRole.ADMIN,
                            UserRole.SUPER_ADMIN
                          ].map((role) => {
                            const isSelected = selectedRoles.includes(role);
                            return (
                              <button
                                key={role}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedRoles(selectedRoles.filter(r => r !== role));
                                  } else {
                                    setSelectedRoles([...selectedRoles, role]);
                                  }
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border",
                                  isSelected
                                    ? "bg-primary text-white border-primary"
                                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                )}
                              >
                                {role}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Section 6: Scheduling & Dispatch Control */}
                    <div className="space-y-3 bg-amber-500/10 dark:bg-amber-950/20 p-5 rounded-2xl border border-amber-500/30">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-2">
                          <Clock size={15} className="text-amber-500" />
                          <span>Delivery Dispatch Strategy</span>
                        </label>
                        <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400 font-bold">
                          EAT Timezone (UTC+3)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className={cn(
                          "p-4 rounded-2xl border-2 flex items-start gap-3 cursor-pointer transition-all",
                          sendOption === "SCHEDULE"
                            ? "bg-white dark:bg-slate-900 border-amber-500 shadow-md"
                            : "bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                        )}>
                          <input
                            type="radio"
                            name="sendOption"
                            checked={sendOption === "SCHEDULE"}
                            onChange={() => setSendOption("SCHEDULE")}
                            className="mt-1"
                          />
                          <div>
                            <div className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">
                              ⏰ Schedule for Future Broadcast
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Queues the campaign into the server scheduler. Automatically sent when the date &amp; time arrives.
                            </p>
                          </div>
                        </label>

                        <label className={cn(
                          "p-4 rounded-2xl border-2 flex items-start gap-3 cursor-pointer transition-all",
                          sendOption === "IMMEDIATE"
                            ? "bg-white dark:bg-slate-900 border-primary shadow-md"
                            : "bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                        )}>
                          <input
                            type="radio"
                            name="sendOption"
                            checked={sendOption === "IMMEDIATE"}
                            onChange={() => setSendOption("IMMEDIATE")}
                            className="mt-1"
                          />
                          <div>
                            <div className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">
                              🚀 Send Immediately
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Dispatches emails to all target recipients right after clicking submit.
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Date & Time Picker when Schedule is selected */}
                      {sendOption === "SCHEDULE" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Broadcast Date
                            </label>
                            <input
                              type="date"
                              value={scheduledDate}
                              onChange={(e) => setScheduledDate(e.target.value)}
                              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Broadcast Time (EAT)
                            </label>
                            <input
                              type="time"
                              value={scheduledTime}
                              onChange={(e) => setScheduledTime(e.target.value)}
                              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* LIVE PREVIEW TAB */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">Device Simulator:</span>
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setPreviewDevice("desktop")}
                            className={cn(
                              "px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer",
                              previewDevice === "desktop" ? "bg-white dark:bg-slate-900 text-primary shadow-sm" : "text-slate-500"
                            )}
                          >
                            <Monitor size={14} />
                            <span>Desktop (600px)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewDevice("mobile")}
                            className={cn(
                              "px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer",
                              previewDevice === "mobile" ? "bg-white dark:bg-slate-900 text-primary shadow-sm" : "text-slate-500"
                            )}
                          >
                            <Smartphone size={14} />
                            <span>Mobile (iPhone / Android)</span>
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-slate-400 font-mono">
                        Subject: <strong className="text-slate-700 dark:text-slate-200">{subject || title}</strong>
                      </div>
                    </div>

                    <div className="flex justify-center bg-slate-100 dark:bg-slate-950 p-4 md:p-8 rounded-2xl overflow-x-auto">
                      <div className={cn(
                        "transition-all duration-300 shadow-2xl rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-white",
                        previewDevice === "desktop" ? "w-[620px]" : "w-[375px]"
                      )}>
                        <iframe
                          title="Email Preview"
                          srcDoc={buildCampaignEmailHtml(currentDraftCampaign, {
                            recipientEmail: currentUser?.email || "member@pceastandrews.org",
                            recipientName: currentUser?.name || "Church Member",
                            previewMode: true
                          })}
                          className="w-full h-[650px] border-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => handleSubmitCampaign(true)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase transition-colors cursor-pointer disabled:opacity-50"
                >
                  Save as Draft
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsComposerOpen(false)}
                    className="px-4 py-2.5 text-slate-500 hover:text-slate-800 dark:hover:text-white text-xs font-bold uppercase cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSubmitCampaign(false)}
                    disabled={isSubmitting}
                    className="btn-primary py-2.5 px-6 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-lg shadow-primary/25 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span>Processing...</span>
                    ) : sendOption === "SCHEDULE" ? (
                      <>
                        <Clock size={15} />
                        <span>Schedule Broadcast</span>
                      </>
                    ) : (
                      <>
                        <Send size={15} />
                        <span>Broadcast Now</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RENDERED EMAIL PREVIEW MODAL */}
      <AnimatePresence>
        {previewCampaign && (
          <div className="fixed inset-0 z-[130] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Rendered Email Preview: {previewCampaign.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Subject: {previewCampaign.subject}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const newWin = window.open("", "_blank");
                      if (newWin) {
                        newWin.document.write(buildCampaignEmailHtml(previewCampaign));
                        newWin.document.close();
                      }
                    }}
                    className="p-2 text-slate-500 hover:text-primary rounded-xl cursor-pointer"
                    title="Open in new window"
                  >
                    <ExternalLink size={16} />
                  </button>
                  <button
                    onClick={() => setPreviewCampaign(null)}
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-6 flex justify-center overflow-y-auto">
                <div className="w-[620px] max-w-full bg-white rounded-xl shadow-xl overflow-hidden border border-slate-300">
                  <iframe
                    title="Rendered Email Viewer"
                    srcDoc={buildCampaignEmailHtml(previewCampaign, {
                      recipientEmail: currentUser?.email || "member@pceastandrews.org",
                      recipientName: currentUser?.name || "Church Member"
                    })}
                    className="w-full h-[650px] border-none"
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
