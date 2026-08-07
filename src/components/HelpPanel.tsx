import React, { useState, useMemo } from "react";
import { 
  BookOpen, 
  Search, 
  HelpCircle, 
  Info, 
  CheckCircle, 
  Key, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  FileText, 
  Activity, 
  Lock, 
  RotateCcw, 
  Check, 
  X,
  Sliders,
  ChevronRight
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { UserRole } from "../types";

interface HelpDocArticle {
  id: string;
  category: string;
  title: string;
  keywords: string[];
  summary: string;
  content: React.ReactNode;
}

interface HelpPanelProps {
  onPlayTour?: () => void;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({ onPlayTour }) => {
  const { currentUser } = useRequisitions();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentUser?.role || UserRole.CHURCH_GROUP);

  // Sandbox simulation states for checking out system step by step
  const [simStep, setSimStep] = useState(1);
  const [simTitle, setSimTitle] = useState("VBS Craft Materials Purchase");
  const [simAmount, setSimAmount] = useState(350);
  const [simL1Reason, setSimL1Reason] = useState("");
  const [simL2Status, setSimL2Status] = useState("pending"); // pending, approved, rejected
  const [simRefNumber, setSimRefNumber] = useState("");

  const resetSandbox = () => {
    setSimStep(1);
    setSimTitle("VBS Craft Materials Purchase");
    setSimAmount(350);
    setSimL1Reason("");
    setSimL2Status("pending");
    setSimRefNumber("");
  };

  // Guided Tour Steps Data
  const tourSteps = [
    {
      title: "Step 1: Submission (Ministry Rep)",
      role: "Ministry Representative",
      icon: Activity,
      desc: "Create a new expense request, select the church department or project, and upload a clear photo of the receipt or invoice.",
      elementName: "Requisition Entry Form Panel",
      tooltip: "The request starts in the 'SUBMITTED' state. The system automatically verifies that there are enough funds left in your department's budget."
    },
    {
      title: "Step 2: L1 Vetting (Approver L1)",
      role: "Level 1 Verifier",
      icon: FileText,
      desc: "The first verifier checks the receipt details and confirms the quantities and values are accurate and complete.",
      elementName: "Approvals Table Vetting Action",
      tooltip: "Once verified, the status is updated to 'APPROVED_L1' and the values are locked to prevent accidental changes."
    },
    {
      title: "Step 3: L2 Treasury Check (Approver L2)",
      role: "Level 2 Approver",
      icon: Key,
      desc: "The final approver reviews the request against overall church budgets and clears the funds for payment.",
      elementName: "Keymaster Security Checkpoint",
      tooltip: "This moves the request status to 'APPROVED_L2', highlighting it as ready for physical payout or cheque writing."
    },
    {
      title: "Step 4: Disbursement List (Finance Office)",
      role: "Finance Officer / Admin",
      icon: CheckCircle,
      desc: "The finance team issues the cheque or cash payment, records the payment reference code, and updates the system records.",
      elementName: "Ledger Settlement Core Panel",
      tooltip: "The request is marked as 'DISBURSED', and the paid amount is officially subtracted from the department's remaining budget."
    }
  ];

  // Documentation Articles
  const docArticles: HelpDocArticle[] = useMemo(() => [
    {
      id: "onboarding",
      category: "Onboarding & Access",
      title: "Creating Your Account & Getting Approved",
      keywords: ["signup", "onboarding", "waiting room", "registration", "access", "pending", "roles"],
      summary: "How to register a new account and have an administrator activate your access.",
      content: (
        <div className="space-y-3 leading-relaxed text-xs text-slate-600 dark:text-slate-300 font-medium">
          <p>
            To keep church budgets and personal records safe, all newly registered accounts must be approved by an administrator before viewing data or submitting requisitions.
          </p>
          <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-2">
            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Access Guidelines:</span>
            <ul className="list-disc pl-4 space-y-1 text-slate-500 dark:text-slate-400 text-[11.5px]">
              <li>Upon signing up, your account starts with a <strong>Pending</strong> status.</li>
              <li>You will see a friendly Waiting Room screen while you wait for activation.</li>
              <li>An Administrator will verify your registration, link your profile to your specific <strong>Ministry Group</strong>, and change your status to <strong>"Active"</strong>.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: "requisitions",
      category: "Requisitions Engine",
      title: "Submitting an Expense Request (Requisition)",
      keywords: ["create", "requisition", "receipts", "vendors", "budget", "draft", "files", "attachment"],
      summary: "Step-by-step guide on how to request funds, select suppliers, and attach receipts.",
      content: (
        <div className="space-y-3 leading-relaxed text-xs text-slate-600 dark:text-slate-300 font-medium">
          <p>
            When you create an expense request, it is linked to your assigned department budget line. Follow these simple tips to ensure quick approval:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-slate-200/50 dark:border-slate-800">
              <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1">Receipts & Invoices</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Always upload a clear and legible photo of your receipt or invoice. Make sure that the total amount, item descriptions, and vendor name are clearly visible.
              </p>
            </div>
            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-slate-200/50 dark:border-slate-800">
              <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-1">Selecting a Vendor</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Choose the correct supplier from our registered vendor list. If you are using a new supplier, you can easily suggest them by adding their details in the vendor input.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "approvals",
      category: "Verification Pipelines",
      title: "The Two Stages of Approval",
      keywords: ["approval", "l1", "l2", "verifier", "keymaster", "vetting", "signoff", "reject", "rejection"],
      summary: "Understanding why requests are reviewed by both Level 1 verifiers and Level 2 final approvers.",
      content: (
        <div className="space-y-3 leading-relaxed text-xs text-slate-600 dark:text-slate-300 font-medium">
          <p>
            To carefully safeguard and track church funds, every expense request moves through two clear verification checks:
          </p>
          <div className="space-y-2.5">
            <div className="p-3.5 border-l-4 border-indigo-500 bg-slate-50 dark:bg-slate-900/60 rounded-r-xl">
              <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">Stage 1: Level 1 Verification (L1)</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                A Level 1 verifier reviews your receipt, matches it against your request details, and checks tax percentages. They sign it off as <code>APPROVED_L1</code>, locking values to prevent accidental edits.
              </p>
            </div>
            <div className="p-3.5 border-l-4 border-purple-500 bg-slate-50 dark:bg-slate-900/60 rounded-r-xl">
              <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider block">Stage 2: Level 2 Final Approval (L2)</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                A Level 2 final approver checks the general church budget lines and account balances. Once they sign off, the request is marked <code>APPROVED_L2</code> and is ready for payment.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "budgets",
      category: "Budgets & Ledgers",
      title: "Requesting Extra Budget (Supplementary Budget)",
      keywords: ["supplementary", "budget", "override", "adjustments", "pool", "financial", "treasury"],
      summary: "What to do if your department's allocated budget runs low and you need additional funds.",
      content: (
        <div className="space-y-3 leading-relaxed text-xs text-slate-600 dark:text-slate-300 font-medium">
          <p>
            If your department's default budget allocation is low and you have a critical expense, you can request a <strong>Supplementary Budget</strong>.
          </p>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 rounded-xl">
            <p className="text-[11.5px] text-slate-700 dark:text-slate-300 leading-relaxed font-semibold">
              Fill out a supplementary request explaining the need and the amount required. Administrators will review and can approve or adjust the requested budget lines as needed.
            </p>
          </div>
        </div>
      )
    },
    {
      id: "disbursements",
      category: "Payout Release",
      title: "How Payment and Payout is Handled",
      keywords: ["disburse", "pay", "payout", "payment", "cheque", "check", "cash", "ledger", "settlement"],
      summary: "What happens once your request is fully approved and cash or a cheque is issued.",
      content: (
        <div className="space-y-3 leading-relaxed text-xs text-slate-600 dark:text-slate-300 font-medium">
          <p>
            Once your request reaches the final stage, the finance office prepares the disbursement:
          </p>
          <ul className="space-y-1.5 text-slate-500 dark:text-slate-400 text-[11px] list-disc pl-4">
            <li>The finance team prepares the cheque, cash, or bank transfer and records the transaction.</li>
            <li>They enter the cheque number or bank reference code into the system to keep our files clean and audit-ready.</li>
            <li>The request status updates to <strong>Disbursed</strong>, and you can instantly download or print an official payment receipt slip.</li>
          </ul>
        </div>
      )
    },
    {
      id: "auditing",
      category: "System Integrity",
      title: "Transparency & System Audit Logs",
      keywords: ["audit", "system log", "trail", "security", "slack", "notification", "ip address", "metadata"],
      summary: "How the portal logs actions to ensure complete financial accountability and clean records.",
      content: (
        <div className="space-y-3 leading-relaxed text-xs text-slate-600 dark:text-slate-300 font-medium">
          <p>
            To keep all church financial operations transparent, honest, and trustworthy, the system automatically logs critical milestones.
          </p>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl flex items-start gap-2.5">
            <Lock size={14} className="text-rose-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-normal font-semibold">
              <strong>Accountability:</strong> Basic logs (such as who submitted, verified, approved, or paid out an item) cannot be modified or deleted. This protects the church and guarantees clean records for church committee audits.
            </p>
          </div>
        </div>
      )
    }
  ], []);

  // Filter logic
  const filteredArticles = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return docArticles;
    return docArticles.filter(article => {
      return (
        article.title.toLowerCase().includes(query) ||
        article.category.toLowerCase().includes(query) ||
        article.summary.toLowerCase().includes(query) ||
        article.keywords.some(keyword => keyword.includes(query))
      );
    });
  }, [searchQuery, docArticles]);

  const handleScrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="bg-[#fcfdfd] dark:bg-slate-900 text-slate-800 dark:text-slate-100 min-h-screen p-4 md:p-8 font-sans antialiased transition-colors duration-200">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Sidebar table of contents and filter tool */}
        <aside className="lg:col-span-3 space-y-6 lg:sticky lg:top-8 h-fit lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto pr-2 no-scrollbar border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 pb-6 lg:pb-0 lg:pr-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
              <BookOpen size={16} />
              <span className="text-[10px] font-black tracking-widest uppercase">System Reference</span>
            </div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">
              How-To Guide
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
              St Andrews E-Requisition Helper
            </p>
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 dark:focus:border-indigo-400 rounded-xl py-2 pl-9 pr-8 text-xs font-semibold placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-slate-100 outline-none transition-all shadow-sm"
            />
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Section Quicklinks */}
          <nav className="space-y-1">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block px-2 mb-1.5">
              Guide Chapters
            </span>
            {[
              { id: "doc-intro", label: "1.0 INTRODUCTION", icon: HelpCircle },
              { id: "doc-progression", label: "2.0 LIFE OF A REQUEST", icon: Activity },
              { id: "doc-sandbox", label: "3.0 TRY THE SYSTEM", icon: Sliders },
              { id: "doc-roles", label: "4.0 USER ROLES & ACCESS", icon: ShieldCheck },
              { id: "doc-shortcuts", label: "5.0 KEYBOARD SHORTCUTS", icon: Key },
              { id: "doc-reference", label: "6.0 SUPPORT ARTICLES", icon: FileText }
            ].map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => handleScrollTo(section.id)}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-650 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Icon size={13} className="shrink-0 text-slate-400 dark:text-slate-550" />
                  <span className="truncate">{section.label}</span>
                </button>
              );
            })}
          </nav>

          {onPlayTour && (
            <div className="pt-2">
              <button
                onClick={onPlayTour}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles size={11} className="text-indigo-200 animate-pulse" />
                Launch Tour Overlay
              </button>
            </div>
          )}
        </aside>

        {/* Right Column: Flowing flat documentation (NO CARDS OR TABS, LIGHT THEME) */}
        <main className="lg:col-span-9 space-y-16 lg:pl-2">
          
          {/* 1.0 INTRODUCTION & ONBOARDING */}
          <section id="doc-intro" className="scroll-mt-6 space-y-4">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-wider uppercase flex items-center gap-2">
                <span className="text-indigo-600 dark:text-indigo-400 font-mono">1.0</span> Introduction & Account Approval
              </h2>
              <span className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                Overview
              </span>
            </div>
            
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-350 leading-relaxed font-medium">
              The St Andrews E-Requisition Portal is a secure, simple system designed to manage and track church expense requests. It guides your submissions from initial creation, through verification and final approval, to physical payout, keeping our processes transparent and fast.
            </p>

            <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 p-4 rounded-r-xl space-y-1">
              <span className="text-[9px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider block">Account Approval Guidelines</span>
              <p className="text-xs text-slate-650 dark:text-slate-300 font-medium leading-relaxed">
                For safety and data security, all newly registered accounts start in a "Pending" state in the Waiting Room. You will not see other pages until an Administrator activates your account and links it to your ministry department.
              </p>
            </div>
          </section>

          {/* 2.0 PROGRESSION STATES */}
          <section id="doc-progression" className="scroll-mt-6 space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-wider uppercase flex items-center gap-2">
                <span className="text-indigo-600 dark:text-indigo-400 font-mono">2.0</span> Steps to Approval
              </h2>
              <span className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                Request Lifecycle
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium font-semibold italic">
              Every expense request follows a clear path of checks and approvals. Here are the four steps to complete a request and receive funds:
            </p>

            {/* Vertical Flow Pipeline (No Cards) */}
            <div className="space-y-6 pl-2 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-200 dark:before:bg-slate-800">
              {tourSteps.map((step, idx) => {
                const StepIcon = step.icon;
                return (
                  <div key={idx} className="relative pl-8 space-y-1.5">
                    {/* Bullet marker */}
                    <div className="absolute left-0 top-0.5 w-[24px] h-[24px] rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 z-10 shadow-sm">
                      <StepIcon size={11} />
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                        {step.title}
                      </span>
                      <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded font-mono">
                        ROLE: {step.role.toUpperCase().replace(" ", "_")}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                      {step.desc}
                    </p>

                    <div className="text-[10px] text-indigo-650 dark:text-indigo-400 font-semibold bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/40 px-3 py-2 rounded-lg max-w-2xl">
                      <strong>How it works:</strong> {step.tooltip}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3.0 INTERACTIVE SANDBOX */}
          <section id="doc-sandbox" className="scroll-mt-6 space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-wider uppercase flex items-center gap-2">
                <span className="text-indigo-600 dark:text-indigo-400 font-mono">3.0</span> Try the System
              </h2>
              <span className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                Playground
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Try the interactive form below to see how the system handles different amounts, approval levels, and payment updates in real-time:
            </p>

            {/* Sandbox IDE Wrapper (No nested cards or tabs) */}
            <div className="grid grid-cols-1 md:grid-cols-12 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              
              {/* Sandbox Parameters Controls */}
              <div className="md:col-span-6 bg-slate-50/70 dark:bg-slate-900/40 p-4 md:p-6 border-r border-slate-200 dark:border-slate-800 space-y-4">
                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                  SAMPLE INPUT FIELDS
                </span>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Request Name</label>
                    <input 
                      type="text" 
                      value={simTitle}
                      onChange={(e) => setSimTitle(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Amount ($)</label>
                      <input 
                        type="number" 
                        value={simAmount}
                        onChange={(e) => setSimAmount(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Current Step</label>
                      <select 
                        value={simStep}
                        onChange={(e) => setSimStep(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
                      >
                        <option value={1}>1. Submission</option>
                        <option value={2}>2. Verification</option>
                        <option value={3}>3. Final Approval</option>
                        <option value={4}>4. Paid Out</option>
                      </select>
                    </div>
                  </div>

                  {simStep >= 2 && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Verification Notes</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Invoices matched perfectly"
                        value={simL1Reason}
                        onChange={(e) => setSimL1Reason(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
                      />
                    </div>
                  )}

                  {simStep >= 3 && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Final Signoff</label>
                        <select
                          value={simL2Status}
                          onChange={(e) => setSimL2Status(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
                        >
                          <option value="pending">PENDING</option>
                          <option value="approved">APPROVED</option>
                          <option value="rejected">REJECTED</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Cheque / Payment Code</label>
                        <input 
                          type="text" 
                          placeholder="e.g. CHQ-9012"
                          value={simRefNumber}
                          onChange={(e) => setSimRefNumber(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-800 dark:text-slate-100 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none text-ellipsis"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

                {/* Sandbox Mock Terminal Console */}
                <div className="md:col-span-6 bg-slate-900 text-slate-200 p-4 md:p-6 flex flex-col justify-between font-mono text-xs space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[9px] text-slate-400 border-b border-slate-800 pb-2">
                      <span>REAL-TIME STATUS PREVIEW</span>
                      <span className="text-emerald-400 font-bold">● ACTIVE</span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-slate-400 text-[11px]">
                        &gt; Live Status Feed
                      </p>
                      
                      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] leading-relaxed space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">{"{"}</span>
                        </div>
                        <div className="pl-4 space-y-0.5">
                          <p><span className="text-sky-400">"request_title"</span>: <span className="text-amber-300">"{simTitle}"</span>,</p>
                          <p><span className="text-sky-400">"amount_dollars"</span>: <span className="text-purple-400">{simAmount}</span>,</p>
                          <p><span className="text-sky-400">"current_stage"</span>: <span className="text-amber-300">"{simStep === 1 ? "1. Submission" : simStep === 2 ? "2. Verification" : simStep === 3 ? "3. Final Approval" : "4. Paid Out"}"</span>,</p>
                          <p><span className="text-sky-400">"within_base_limit"</span>: <span className="text-emerald-400">{simAmount < 1000 ? "true" : "false"}</span>,</p>
                          
                          {simStep >= 2 && (
                            <p><span className="text-sky-400">"verification_notes"</span>: <span className="text-amber-300">"{simL1Reason || "No warnings"}"</span>,</p>
                          )}
                          
                          {simStep >= 3 && (
                            <>
                              <p><span className="text-sky-400">"approval_status"</span>: <span className="text-amber-300">"{simL2Status.toUpperCase()}"</span>,</p>
                              <p><span className="text-sky-400">"cheque_reference"</span>: <span className="text-amber-300">"{simRefNumber || "None yet"}"</span>,</p>
                            </>
                          )}
                          
                          <p><span className="text-sky-400">"portal_status"</span>: <span className="text-emerald-400">
                            {simStep === 1 ? '"SUBMITTED"' : 
                             simStep === 2 ? '"APPROVED_L1 (Verified)"' : 
                             simStep === 3 && simL2Status === "approved" ? '"APPROVED_L2 (Approved)"' :
                             simStep === 3 && simL2Status === "rejected" ? '"REJECTED"' :
                             simStep === 4 ? '"DISBURSED (Paid)"' : '"PENDING"'}
                          </span></p>
                        </div>
                        <div>
                          <span className="text-slate-500">{"}"}</span>
                        </div>
                      </div>

                      <div className="space-y-1 pt-1 text-[11px]">
                        <p className="text-indigo-400">&gt; Checking limits...</p>
                        {simAmount >= 1000 ? (
                          <p className="text-rose-400">⚠️ Note: Larger requests may require higher approvals.</p>
                        ) : (
                          <p className="text-emerald-400">✓ Success: Request looks perfect and fits within department limits.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 text-right border-t border-slate-800 pt-2 flex justify-between items-center">
                    <span>Preview Mode</span>
                    <span>St Andrews Portal</span>
                  </div>
                </div>

              </div>
            </section>

          {/* 4.0 ROLE PRIVILEGES SCHEMA */}
          <section id="doc-roles" className="scroll-mt-6 space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-wider uppercase flex items-center gap-2">
                <span className="text-indigo-600 dark:text-indigo-400 font-mono">4.0</span> Roles & Access Permissions
              </h2>
              <span className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                Permissions & Roles
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              The actions you can perform depend on your user role. Use the buttons below to filter the permissions matrix and see what each user is allowed to do:
            </p>

            <div className="flex flex-wrap gap-2 pt-1 pb-1">
              {[
                { id: UserRole.CHURCH_GROUP, label: "Ministry Rep" },
                { id: UserRole.APPROVER_L1, label: "L1 Verifier" },
                { id: UserRole.APPROVER_L2, label: "L2 Keymaster" },
                { id: UserRole.SUPER_ADMIN, label: "Super Admin" }
              ].map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border cursor-pointer transition-colors ${
                    selectedRole === role.id
                      ? "bg-indigo-650 text-white border-indigo-600 dark:bg-indigo-600 dark:border-indigo-500 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"
                  }`}
                >
                  {role.label}
                </button>
              ))}
            </div>

            {/* Flat comparative matrix (No cards/tabs) */}
            <div className="border border-slate-200 dark:border-slate-850 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3 font-semibold">User Role</th>
                    <th className="px-4 py-3 font-semibold">Allowed Actions</th>
                    <th className="px-4 py-3 font-semibold">System Limits & Rules</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800 font-medium">
                  
                  {/* Row 1: CHURCH_GROUP */}
                  <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${selectedRole === UserRole.CHURCH_GROUP ? 'bg-indigo-50/20 dark:bg-indigo-950/20' : ''}`}>
                    <td className="px-4 py-3.5 space-y-1">
                      <span className="text-[11px] font-extrabold text-slate-900 dark:text-white uppercase block tracking-tight">
                        Ministry Representative
                      </span>
                      <code className="text-[9.5px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono font-bold">
                        UserRole.CHURCH_GROUP
                      </code>
                    </td>
                    <td className="px-4 py-3.5">
                      <ul className="list-disc pl-3.5 space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                        <li>Create and submit expense requests</li>
                        <li>Upload receipt photos or documents</li>
                        <li>View status of submitted requests</li>
                      </ul>
                    </td>
                    <td className="px-4 py-3.5 space-y-1">
                      <span className="text-[8px] font-extrabold text-rose-500 uppercase tracking-wider block">FORBIDDEN</span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                        Cannot approve requests; Cannot change payment status; Only allowed to see their own department's requests.
                      </p>
                    </td>
                  </tr>

                  {/* Row 2: APPROVER_L1 */}
                  <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${selectedRole === UserRole.APPROVER_L1 ? 'bg-indigo-50/20 dark:bg-indigo-950/20' : ''}`}>
                    <td className="px-4 py-3.5 space-y-1">
                      <span className="text-[11px] font-extrabold text-slate-900 dark:text-white uppercase block tracking-tight">
                        L1 Verifier
                      </span>
                      <code className="text-[9.5px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono font-bold">
                        UserRole.APPROVER_L1
                      </code>
                    </td>
                    <td className="px-4 py-3.5">
                      <ul className="list-disc pl-3.5 space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                        <li>Check and verify receipt details</li>
                        <li>Mark requests as Verified (Step 2)</li>
                        <li>Return requests for corrections with notes</li>
                      </ul>
                    </td>
                    <td className="px-4 py-3.5 space-y-1">
                      <span className="text-[8px] font-extrabold text-rose-500 uppercase tracking-wider block">FORBIDDEN</span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                        Cannot make final payments; Cannot change user settings; Cannot bypass approval limits.
                      </p>
                    </td>
                  </tr>

                  {/* Row 3: APPROVER_L2 */}
                  <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${selectedRole === UserRole.APPROVER_L2 ? 'bg-indigo-50/20 dark:bg-indigo-950/20' : ''}`}>
                    <td className="px-4 py-3.5 space-y-1">
                      <span className="text-[11px] font-extrabold text-slate-900 dark:text-white uppercase block tracking-tight">
                        L2 Keymaster
                      </span>
                      <code className="text-[9.5px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono font-bold">
                        UserRole.APPROVER_L2
                      </code>
                    </td>
                    <td className="px-4 py-3.5">
                      <ul className="list-disc pl-3.5 space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                        <li>Check budget balances</li>
                        <li>Approve requests for payment (Step 3)</li>
                        <li>Enter payment details or codes</li>
                      </ul>
                    </td>
                    <td className="px-4 py-3.5 space-y-1">
                      <span className="text-[8px] font-extrabold text-rose-500 uppercase tracking-wider block">FORBIDDEN</span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                        Cannot edit request names or amounts; Cannot change user account status.
                      </p>
                    </td>
                  </tr>

                  {/* Row 4: SUPER_ADMIN */}
                  <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${selectedRole === UserRole.SUPER_ADMIN ? 'bg-indigo-50/20 dark:bg-indigo-950/20' : ''}`}>
                    <td className="px-4 py-3.5 space-y-1">
                      <span className="text-[11px] font-extrabold text-slate-900 dark:text-white uppercase block tracking-tight">
                        Super Administrator
                      </span>
                      <code className="text-[9.5px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono font-bold">
                        UserRole.SUPER_ADMIN
                      </code>
                    </td>
                    <td className="px-4 py-3.5">
                      <ul className="list-disc pl-3.5 space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                        <li>Verify and activate new users</li>
                        <li>Assign departments and user roles</li>
                        <li>Adjust default budget limit parameters</li>
                      </ul>
                    </td>
                    <td className="px-4 py-3.5 space-y-1">
                      <span className="text-[8px] font-extrabold text-indigo-500 uppercase tracking-wider block">IMPERATIVE</span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                        All administrative updates leave a permanent record in the audit logs for transparency.
                      </p>
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </section>
          <section id="doc-shortcuts" className="scroll-mt-6 space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-wider uppercase flex items-center gap-2">
                <span className="text-indigo-600 dark:text-indigo-400 font-mono">5.0</span> Keyboard Shortcuts Reference
              </h2>
              <span className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                Shortcuts
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Use these handy keyboard shortcuts to get around the system quickly:
            </p>

            {/* Flat shortcuts table (No cards) */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3 font-semibold">Key Combination</th>
                    <th className="px-4 py-3 font-semibold">Action Performed</th>
                    <th className="px-4 py-3 font-semibold">Where it works</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  <tr>
                    <td className="px-4 py-3 flex items-center gap-1.5">
                      <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-sm text-[10px] font-black text-slate-800 dark:text-slate-200">Ctrl</kbd>
                      <span>+</span>
                      <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-sm text-[10px] font-black text-slate-800 dark:text-slate-200 font-mono">K</kbd>
                    </td>
                    <td className="px-4 py-3 font-sans font-medium text-slate-600 dark:text-slate-300">
                      Quickly focus the search bar
                    </td>
                    <td className="px-4 py-3 text-[10px] text-indigo-650 dark:text-indigo-400 font-mono">
                      Anywhere
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">
                      <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-sm text-[10px] font-black text-slate-800 dark:text-slate-200 font-mono">Esc</kbd>
                    </td>
                    <td className="px-4 py-3 font-sans font-medium text-slate-600 dark:text-slate-300">
                      Close menus, drawers, or popups
                    </td>
                    <td className="px-4 py-3 text-[10px] text-indigo-650 dark:text-indigo-400 font-mono">
                      Anywhere
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">
                      <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-sm text-[10px] font-black text-slate-800 dark:text-slate-200 font-mono">→</kbd>
                    </td>
                    <td className="px-4 py-3 font-sans font-medium text-slate-600 dark:text-slate-300">
                      Next page or attachment file
                    </td>
                    <td className="px-4 py-3 text-[10px] text-indigo-650 dark:text-indigo-400 font-mono">
                      Viewer Window
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">
                      <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-sm text-[10px] font-black text-slate-800 dark:text-slate-200 font-mono">←</kbd>
                    </td>
                    <td className="px-4 py-3 font-sans font-medium text-slate-600 dark:text-slate-300">
                      Previous page or attachment file
                    </td>
                    <td className="px-4 py-3 text-[10px] text-indigo-650 dark:text-indigo-400 font-mono">
                      Viewer Window
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 6.0 SUPPORT ARTICLES */}
          <section id="doc-reference" className="scroll-mt-6 space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-wider uppercase flex items-center gap-2">
                <span className="text-indigo-600 dark:text-indigo-400 font-mono">6.0</span> Helpful Reference Articles
              </h2>
              <span className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                Articles count: {filteredArticles.length}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Here are helpful articles explaining system details:
            </p>

            {/* Filtered Articles list (No cards/tabs, linear text-focused) */}
            <div className="space-y-12">
              {filteredArticles.length > 0 ? (
                filteredArticles.map((article) => (
                  <div key={article.id} className="space-y-3 pt-6 border-t border-dashed border-slate-200 dark:border-slate-800 first:border-0 first:pt-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] font-black uppercase text-indigo-650 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 px-2 py-0.5 rounded font-mono">
                        {article.category}
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">
                        {article.title}
                      </h3>
                    </div>

                    <p className="text-xs text-slate-550 dark:text-slate-400 font-bold leading-relaxed italic">
                      {article.summary}
                    </p>

                    <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium max-w-4xl">
                      {article.content}
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {article.keywords.map((kw, idx) => (
                        <span key={idx} className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
                  <HelpCircle size={32} className="text-slate-400 dark:text-slate-500 mx-auto" />
                  <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">No matching reference articles found</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-semibold">
                    We scanned titles, summaries, and keywords but found no articles matching "{searchQuery}". Try editing your search query.
                  </p>
                </div>
              )}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
};
