/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  Store, 
  Plus, 
  Search, 
  MapPin, 
  PhoneCall, 
  Package, 
  Calendar, 
  User, 
  X, 
  Loader2, 
  SlidersHorizontal,
  CornerDownRight, 
  Briefcase,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Check,
  Trash2,
  Download,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  BarChart3,
  TrendingUp,
  PiggyBank,
  AlertCircle,
  Pencil,
  Eye,
  Mail,
  Building2,
  CalendarDays
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { Vendor, UserRole, VENDOR_SERVICE_CATEGORIES, RequisitionStatus, Requisition } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatCurrency } from "../lib/utils";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";

const parseOfferings = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(item => String(item).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw.split(",").map(item => item.trim()).filter(Boolean);
  }
  return [String(raw).trim()].filter(Boolean);
};

const getOfferingsString = (raw: any): string => {
  if (!raw) return "";
  if (Array.isArray(raw)) return raw.join(", ");
  if (typeof raw === "string") return raw;
  return String(raw);
};

export const VendorsPanel: React.FC = () => {
  const { requisitions, vendors, addVendor, updateVendor, deleteVendor, canAccess, currentUser, triggerToast, addSystemLog, syncingTargets } = useRequisitions();
  
  const canEdit = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
  
  // Tab / Panel state
  const [activeTab, setActiveTab] = useState<"directory" | "analytics">("directory");
  const [trendVendor, setTrendVendor] = useState<string>("ALL");
  const [trendCategory, setTrendCategory] = useState<string>("ALL");

  // --- COMPUTE SPEND ANALYTICS DATA ---
  
  // 1. Total Spend breakdown per vendor
  const vendorSpendData = useMemo(() => {
    const spendMap: Record<string, { disbursed: number; pipeline: number; total: number; count: number; categories: Set<string> }> = {};

    // Initialize all registered vendors with 0
    vendors.forEach(v => {
      spendMap[v.name.trim().toLowerCase()] = {
        disbursed: 0,
        pipeline: 0,
        total: 0,
        count: 0,
        categories: new Set(parseOfferings(v.offerings))
      };
    });

    // Populate with actual requisitions
    requisitions.forEach(req => {
      if (!req.payableTo) return;
      const vendorName = req.payableTo.trim();
      const vendorKey = vendorName.toLowerCase();

      if (!spendMap[vendorKey]) {
        spendMap[vendorKey] = {
          disbursed: 0,
          pipeline: 0,
          total: 0,
          count: 0,
          categories: new Set()
        };
      }

      if (req.groupName) {
        spendMap[vendorKey].categories.add(req.groupName.trim());
      }

      const { status, amount } = req;
      if (status === RequisitionStatus.DISBURSED) {
        spendMap[vendorKey].disbursed += amount;
        spendMap[vendorKey].total += amount;
        spendMap[vendorKey].count += 1;
      } else if (
        status === RequisitionStatus.APPROVED_L1 ||
        status === RequisitionStatus.APPROVED_L2 ||
        status === RequisitionStatus.SUBMITTED ||
        status === RequisitionStatus.ESCALATED
      ) {
        spendMap[vendorKey].pipeline += amount;
        spendMap[vendorKey].total += amount;
        spendMap[vendorKey].count += 1;
      }
    });

    return Object.entries(spendMap).map(([key, data]) => {
      const foundVendor = vendors.find(v => v.name.trim().toLowerCase() === key);
      const displayName = foundVendor ? foundVendor.name : key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      
      return {
        name: displayName,
        isRegistered: !!foundVendor,
        disbursed: data.disbursed,
        pipeline: data.pipeline,
        total: data.total,
        count: data.count,
        categoryCount: data.categories.size,
        categories: Array.from(data.categories)
      };
    }).sort((a, b) => b.total - a.total);
  }, [vendors, requisitions]);

  // Total aggregate disbursed spend
  const totalDisbursedSpendSum = useMemo(() => {
    return vendorSpendData.reduce((sum, item) => sum + item.disbursed, 0);
  }, [vendorSpendData]);

  // 2. Historical Pricing / Spend Trend grouped by month
  const trendData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlySums = months.map(m => ({ month: m, amount: 0, count: 0, avgAmount: 0 }));

    requisitions.forEach(req => {
      if (!req.submittedAt) return;
      if (req.status === RequisitionStatus.DRAFT || req.status === RequisitionStatus.CANCELLED || req.status === RequisitionStatus.REJECTED) return;

      // Filter by trend window vendor
      if (trendVendor !== "ALL") {
        if (!req.payableTo || req.payableTo.trim().toLowerCase() !== trendVendor.toLowerCase()) {
          return;
        }
      }

      // Filter by trend window category
      if (trendCategory !== "ALL") {
        if (!req.groupName || req.groupName.trim().toLowerCase() !== trendCategory.toLowerCase()) {
          return;
        }
      }

      const date = new Date(req.submittedAt);
      const mIndex = date.getMonth();
      if (mIndex >= 0 && mIndex < 12) {
        monthlySums[mIndex].amount += req.amount;
        monthlySums[mIndex].count += 1;
      }
    });

    return monthlySums.map(m => ({
      ...m,
      avgAmount: m.count > 0 ? Math.round(m.amount / m.count) : 0
    }));
  }, [requisitions, trendVendor, trendCategory]);

  // 3. Unique requisition category options present in history
  const activeRequisitionCategories = useMemo(() => {
    const cats = new Set<string>();
    requisitions.forEach(req => {
      if (req.groupName) cats.add(req.groupName.trim());
    });
    return Array.from(cats);
  }, [requisitions]);

  // 4. Audit Savings Opportunity A: Consolidation Opportunities
  const consolidationOpportunities = useMemo(() => {
    const categoryVendors: Record<string, { vendors: Record<string, number>; totalSpend: number; reqCount: number }> = {};

    requisitions.forEach(req => {
      if (req.status === RequisitionStatus.DRAFT || req.status === RequisitionStatus.CANCELLED || req.status === RequisitionStatus.REJECTED) return;
      if (!req.payableTo || !req.groupName) return;

      const cat = req.groupName.trim();
      const vendor = req.payableTo.trim();

      if (!categoryVendors[cat]) {
        categoryVendors[cat] = { vendors: {}, totalSpend: 0, reqCount: 0 };
      }

      categoryVendors[cat].vendors[vendor] = (categoryVendors[cat].vendors[vendor] || 0) + req.amount;
      categoryVendors[cat].totalSpend += req.amount;
      categoryVendors[cat].reqCount += 1;
    });

    return Object.entries(categoryVendors)
      .filter(([_, data]) => Object.keys(data.vendors).length >= 2 && data.totalSpend > 0)
      .map(([catName, data]) => {
        const vendorCount = Object.keys(data.vendors).length;
        const potentialSaving = Math.round(data.totalSpend * 0.12); // estimated 12% pricing consolidation savings
        
        return {
          categoryName: catName,
          totalSpend: data.totalSpend,
          vendorCount,
          reqCount: data.reqCount,
          potentialSaving,
          vendorsBreakdown: Object.entries(data.vendors).map(([vName, vSpend]) => ({
            name: vName,
            spend: vSpend,
            percentage: Math.round((vSpend / data.totalSpend) * 100)
          })).sort((a, b) => b.spend - a.spend)
        };
      }).sort((a, b) => b.totalSpend - a.totalSpend);
  }, [requisitions]);

  // 5. Audit Savings Opportunity B: Unregistered Vendor Leakage
  const unregisteredLeakage = useMemo(() => {
    const leakageMap: Record<string, { total: number; count: number; category: string }> = {};
    const registeredLower = new Set(vendors.map(v => v.name.trim().toLowerCase()));

    requisitions.forEach(req => {
      if (req.status === RequisitionStatus.DRAFT || req.status === RequisitionStatus.CANCELLED || req.status === RequisitionStatus.REJECTED) return;
      if (!req.payableTo) return;

      const vendorName = req.payableTo.trim();
      const vKey = vendorName.toLowerCase();

      if (!registeredLower.has(vKey)) {
        if (!leakageMap[vKey]) {
          leakageMap[vKey] = { total: 0, count: 0, category: req.groupName || "Other" };
        }
        leakageMap[vKey].total += req.amount;
        leakageMap[vKey].count += 1;
      }
    });

    const totalLeakageAmount = Object.values(leakageMap).reduce((sum, current) => sum + current.total, 0);

    const leakList = Object.entries(leakageMap).map(([vKey, data]) => {
      const formattedName = vKey.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return {
        name: formattedName,
        totalSpend: data.total,
        count: data.count,
        category: data.category,
        potentialSaving: Math.round(data.total * 0.10) // 10% onboarding negotiation bonus
      };
    }).sort((a, b) => b.totalSpend - a.totalSpend);

    return { list: leakList, totalAmount: totalLeakageAmount };
  }, [vendors, requisitions]);

  // 6. Audit Savings Opportunity C: Pricing Volatility
  const pricingVolatility = useMemo(() => {
    const titleGroups: Record<string, { vendor: string; title: string; amounts: number[]; dates: string[] }> = {};

    requisitions.forEach(req => {
      if (req.status === RequisitionStatus.DRAFT || req.status === RequisitionStatus.CANCELLED || req.status === RequisitionStatus.REJECTED) return;
      if (!req.payableTo || !req.title) return;

      const vendor = req.payableTo.trim();
      const words = req.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const keyWord = words.slice(0, 2).join(" ");
      if (keyWord.length < 5) return;

      const groupKey = `${vendor.toLowerCase()}::${keyWord}`;

      if (!titleGroups[groupKey]) {
        titleGroups[groupKey] = { vendor, title: req.title, amounts: [], dates: [] };
      }
      titleGroups[groupKey].amounts.push(req.amount);
      titleGroups[groupKey].dates.push(req.submittedAt || "");
    });

    return Object.values(titleGroups)
      .filter(g => g.amounts.length >= 2)
      .map(g => {
        const min = Math.min(...g.amounts);
        const max = Math.max(...g.amounts);
        const sum = g.amounts.reduce((d, s) => d + s, 0);
        const mean = sum / g.amounts.length;
        
        const ratio = min > 0 ? (max - min) / min : 0;
        
        return {
          vendor: g.vendor,
          titleKeyword: g.title.substring(0, 30),
          avgSpend: Math.round(mean),
          minSpend: min,
          maxSpend: max,
          ratioPercent: Math.round(ratio * 100),
          count: g.amounts.length
        };
      })
      .filter(item => item.ratioPercent >= 30)
      .sort((a, b) => b.ratioPercent - a.ratioPercent)
      .slice(0, 5);
  }, [requisitions]);

  // Aggregate Savings Opportunities total
  const totalPotentialSavings = useMemo(() => {
    const leakSaving = unregisteredLeakage.list.reduce((sum, item) => sum + item.potentialSaving, 0);
    const consolSaving = consolidationOpportunities.reduce((sum, item) => sum + item.potentialSaving, 0);
    return leakSaving + consolSaving;
  }, [unregisteredLeakage, consolidationOpportunities]);

  // Herfindahl-Hirschman concentration (HHI) for spend risk
  const spendConcentrationInfo = useMemo(() => {
    if (totalDisbursedSpendSum === 0) return { percent: 0, label: "Low Dependency", color: "text-emerald-500 bg-emerald-50" };
    
    // Sort spend arrays
    const sortedSpendSqr = vendorSpendData.map(v => Math.pow((v.disbursed / totalDisbursedSpendSum) * 100, 2));
    const hhiValue = sortedSpendSqr.reduce((sum, val) => sum + val, 0);

    // HHI bounds: < 1500 (competitive/diversified), 1500-2500 (moderate), > 2500 (highly concentrated)
    let label = "Diversified Network";
    let color = "text-emerald-700 bg-emerald-50 border-emerald-100";
    if (hhiValue > 2500) {
      label = "High Vendor Dependency";
      color = "text-rose-700 bg-rose-50 border-rose-100";
    } else if (hhiValue > 1500) {
      label = "Moderate Concentration";
      color = "text-amber-700 bg-amber-50 border-amber-100";
    }

    const top1Spend = vendorSpendData[0]?.disbursed || 0;
    const top1Percent = totalDisbursedSpendSum > 0 ? Math.round((top1Spend / totalDisbursedSpendSum) * 100) : 0;

    return {
      hhi: Math.round(hhiValue),
      topVendorPercent: top1Percent,
      topVendorName: vendorSpendData[0]?.name || "N/A",
      label,
      color
    };
  }, [vendorSpendData, totalDisbursedSpendSum]);

  // --- END OF COMPUTE SPEND ANALYTICS DATA ---

  // Tab / Panel state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedOfferingsFilter, setSelectedOfferingsFilter] = useState<string>("ALL");
  const [viewingVendor, setViewingVendor] = useState<Vendor | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<"name" | "offerings" | "contact" | "location" | "createdAt">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Form fields state
  const [name, setName] = useState<string>("");
  const [contact, setContact] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [offerings, setOfferings] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState<boolean>(false);

  // Filter unique offerings for the dropdown filter
  const uniqueOfferings = useMemo(() => {
    const list = new Set<string>();
    
    // Add most common standard ones to the filter bar
    VENDOR_SERVICE_CATEGORIES.slice(0, 12).forEach(c => list.add(c));
    
    // Supplement with existing ones from database
    vendors.forEach(v => {
      parseOfferings(v.offerings).forEach(item => {
        const trimmed = item.trim();
        if (trimmed) {
          // Capitalize first letter for consistency
          const normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
          list.add(normalized);
        }
      });
    });
    return Array.from(list);
  }, [vendors]);

  // Client-side search, filters, and sorting
  const filteredVendors = useMemo(() => {
    const list = vendors.filter(v => {
      const offeringsStr = getOfferingsString(v.offerings).toLowerCase();

      // Search term filter
      const matchesSearch = 
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        offeringsStr.includes(searchTerm.toLowerCase()) ||
        (v.location || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.contact || "").toLowerCase().includes(searchTerm.toLowerCase());

      // Offerings Category filter
      let matchesOfferings = true;
      if (selectedOfferingsFilter !== "ALL") {
        matchesOfferings = offeringsStr.includes(selectedOfferingsFilter.toLowerCase());
      }

      return matchesSearch && matchesOfferings;
    });

    return list.sort((a, b) => {
      let valA = (a[sortField] || "").toString().trim().toLowerCase();
      let valB = (b[sortField] || "").toString().trim().toLowerCase();

      if (sortField === "createdAt") {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [vendors, searchTerm, selectedOfferingsFilter, sortField, sortDirection]);

  // Vendor Directory Pagination state (15 rows)
  const [vendorPage, setVendorPage] = useState<number>(1);
  const VENDORS_PER_PAGE = 15;
  const totalVendorPages = Math.ceil(filteredVendors.length / VENDORS_PER_PAGE) || 1;

  const paginatedFilteredVendors = useMemo(() => {
    const safePage = Math.min(Math.max(1, vendorPage), totalVendorPages);
    const start = (safePage - 1) * VENDORS_PER_PAGE;
    return filteredVendors.slice(start, start + VENDORS_PER_PAGE);
  }, [filteredVendors, vendorPage, totalVendorPages]);

  React.useEffect(() => {
    setVendorPage(1);
  }, [searchTerm, selectedOfferingsFilter, sortField, sortDirection]);

  // Vendor Expenditure Index Pagination state (15 rows)
  const [indexPage, setIndexPage] = useState<number>(1);
  const INDEX_PER_PAGE = 15;
  const totalIndexPages = Math.ceil(vendorSpendData.length / INDEX_PER_PAGE) || 1;

  const paginatedVendorSpendData = useMemo(() => {
    const safePage = Math.min(Math.max(1, indexPage), totalIndexPages);
    const start = (safePage - 1) * INDEX_PER_PAGE;
    return vendorSpendData.slice(start, start + INDEX_PER_PAGE);
  }, [vendorSpendData, indexPage, totalIndexPages]);

  // Statistics calculation for the filtered list
  const stats = useMemo(() => {
    const total = filteredVendors.length;
    
    // Recently added (e.g., within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentlyAdded = filteredVendors.filter(v => new Date(v.createdAt) >= thirtyDaysAgo).length;

    // Most offered service
    const serviceCounts: Record<string, number> = {};
    filteredVendors.forEach(v => {
      parseOfferings(v.offerings).forEach(item => {
        const trimmed = item.trim();
        if (trimmed) {
          const normalized = trimmed.toLowerCase();
          serviceCounts[normalized] = (serviceCounts[normalized] || 0) + 1;
        }
      });
    });

    let mostOffered = "N/A";
    let maxCount = 0;
    for (const service in serviceCounts) {
      if (serviceCounts[service] > maxCount) {
        maxCount = serviceCounts[service];
        mostOffered = service.charAt(0).toUpperCase() + service.slice(1);
      }
    }

    // Top 3 Frequent Vendors based on requisition count
    const vendorFrequency: Record<string, number> = {};
    requisitions.forEach(req => {
      if (req.payableTo) {
        const vendorKey = req.payableTo.trim();
        if (vendorKey) {
          vendorFrequency[vendorKey] = (vendorFrequency[vendorKey] || 0) + 1;
        }
      }
    });

    const topVendors = Object.entries(vendorFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));
    
    return { total, recentlyAdded, mostOffered, topVendors };
  }, [filteredVendors, requisitions]);

  // Submit Handler to create or update vendor
  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      triggerToast({
        type: "FINANCE_DISBURSEMENT",
        severity: "MEDIUM",
        message: "⚠️ Vendor name is required",
        timestamp: new Date().toISOString()
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingVendorId) {
        await updateVendor(editingVendorId, {
          name: name.trim(),
          contact: contact.trim() || undefined,
          location: location.trim() || undefined,
          offerings: offerings.trim() || undefined
        });
        triggerToast({
          type: "FINANCE_DISBURSEMENT",
          severity: "LOW",
          message: `✅ Vendor "${name.trim()}" successfully updated!`,
          timestamp: new Date().toISOString()
        });
      } else {
        await addVendor({
          name: name.trim(),
          contact: contact.trim() || undefined,
          location: location.trim() || undefined,
          offerings: offerings.trim() || undefined
        });

        triggerToast({
          type: "FINANCE_DISBURSEMENT",
          severity: "LOW",
          message: `✅ Vendor "${name.trim()}" successfully ${canEdit ? 'registered' : 'proposed'}!`,
          timestamp: new Date().toISOString()
        });
      }

      // Reset Form State
      handleCancelForm();
    } catch (err: any) {
      triggerToast({
        type: "FINANCE_DISBURSEMENT",
        severity: "HIGH",
        message: `❌ Failed to save vendor: ${err.message || err}`,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditVendorClick = (vendor: Vendor) => {
    setEditingVendorId(vendor.id);
    setName(vendor.name);
    setContact(vendor.contact || "");
    setLocation(vendor.location || "");
    setOfferings(getOfferingsString(vendor.offerings));
    setShowAddForm(true);
  };

  const handleCancelForm = () => {
    setName("");
    setContact("");
    setLocation("");
    setOfferings("");
    setEditingVendorId(null);
    setShowAddForm(false);
  };

  const handleStatusChange = async (vendorId: string, status: "APPROVED" | "REJECTED") => {
    try {
      await updateVendor(vendorId, { status });
      triggerToast({
        type: "FINANCE_DISBURSEMENT",
        severity: "LOW",
        message: `✅ Vendor status updated to ${status}!`,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      triggerToast({
        type: "FINANCE_DISBURSEMENT",
        severity: "HIGH",
        message: `❌ Failed to update vendor status: ${err.message || err}`,
        timestamp: new Date().toISOString()
      });
    }
  };

  const exportToCSV = () => {
    const headers = ["Name", "Offerings", "Contact", "Location", "Created At"];
    const csvContent = [
      headers.join(","),
      ...filteredVendors.map(v => [
        `"${v.name.replace(/"/g, '""')}"`,
        `"${getOfferingsString(v.offerings).replace(/"/g, '""')}"`,
        `"${(v.contact || "").replace(/"/g, '""')}"`,
        `"${(v.location || "").replace(/"/g, '""')}"`,
        `"${v.createdAt}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vendors_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="ml-1 opacity-20" />;
    return sortDirection === "asc" ? <ChevronUp size={12} className="ml-1 text-primary" /> : <ChevronDown size={12} className="ml-1 text-primary" />;
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700 header-panel-alignment relative">
      {/* Global Add / Edit Vendor Modal Dialog Overlay */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto"
            onClick={handleCancelForm}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white dark:bg-slate-900 border-2 border-slate-200/80 dark:border-slate-800 rounded-[2.5rem] shadow-2xl p-6 md:p-8 max-w-2xl w-full my-auto space-y-6 max-h-[90vh] overflow-y-auto text-slate-900 dark:text-slate-100 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Bar */}
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black">
                    <Store size={20} />
                  </div>
                  <div>
                    <h3 className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      {editingVendorId ? "Edit Supplier Partner Record" : "Register Vendor Partner"}
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      STANDS Supplier Registry • Verified Master Index
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                  title="Close Modal"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveVendor} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Vendor Name */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block">
                      🤝 Trade / Registered Vendor Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Acme Stationery Supply Ltd"
                      className="w-full h-12 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs md:text-sm font-semibold px-4 rounded-xl focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                  </div>

                  {/* Offerings Category Multi-Select Dropdown */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block">
                      🛍️ Select Products / Services Offered (Standardized Categories)
                    </label>
                    
                    <div className="relative">
                      {/* Dropdown Selector Header Trigger */}
                      <button
                        type="button"
                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                        className="w-full bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-left flex items-center justify-between hover:border-primary/50 transition-all shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 cursor-pointer"
                      >
                        <div className="flex flex-wrap gap-1.5 items-center flex-1 pr-2 min-h-[32px]">
                          {parseOfferings(offerings).length > 0 ? (
                            parseOfferings(offerings).map((cat, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider"
                              >
                                {cat}
                                <X
                                  size={12}
                                  className="cursor-pointer hover:text-rose-600 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const current = parseOfferings(offerings);
                                    setOfferings(current.filter(x => x.toLowerCase() !== cat.toLowerCase()).join(", "));
                                  }}
                                />
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-xs font-semibold">Click to open categories multiselect dropdown...</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 border-l border-slate-200 dark:border-slate-700 pl-3">
                          <span className="text-[9px] font-black uppercase text-primary tracking-wider bg-primary/10 px-2.5 py-1 rounded-lg">
                            {parseOfferings(offerings).length} Selected
                          </span>
                          <ChevronDown size={18} className={cn("text-slate-400 transition-transform duration-200", isCategoryDropdownOpen && "rotate-180")} />
                        </div>
                      </button>

                      {/* Dropdown Menu */}
                      {isCategoryDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-4 max-h-60 overflow-y-auto space-y-2">
                          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <span>Standardized Product & Service Categories</span>
                            <span className="text-primary font-mono">{VENDOR_SERVICE_CATEGORIES.length} Categories</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                            {VENDOR_SERVICE_CATEGORIES.map((category) => {
                              const currentCategories = parseOfferings(offerings);
                              const isSelected = currentCategories.some(c => c.toLowerCase() === category.toLowerCase());
                              return (
                                <button
                                  key={category}
                                  type="button"
                                  onClick={() => {
                                    const current = parseOfferings(offerings);
                                    if (isSelected) {
                                      setOfferings(current.filter(x => x.toLowerCase() !== category.toLowerCase()).join(", "));
                                    } else {
                                      setOfferings([...current, category].join(", "));
                                    }
                                  }}
                                  className={cn(
                                    "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left border cursor-pointer",
                                    isSelected
                                      ? "bg-primary text-white border-primary shadow-sm"
                                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-100 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700"
                                  )}
                                >
                                  <span className="truncate pr-1">{category}</span>
                                  {isSelected && <Check size={14} className="stroke-[3] shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 pt-1">
                      <input
                        type="text"
                        value={offerings}
                        onChange={(e) => setOfferings(e.target.value)}
                        placeholder="Or type custom products/services separated by commas..."
                        className="w-full h-11 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs font-semibold px-4 rounded-xl focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                      />
                    </div>
                  </div>

                  {/* Contact Reference */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block">
                      📞 Contact Reference (Phone/Email)
                    </label>
                    <input
                      type="text"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="e.g. +254 712 345678 or sales@firm.com"
                      className="w-full h-12 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs md:text-sm font-semibold px-4 rounded-xl focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                  </div>

                  {/* Physical Location */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block">
                      📍 Business Operations / Physical Location
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Bishop Road, Nairobi"
                      className="w-full h-12 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs md:text-sm font-semibold px-4 rounded-xl focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                  </div>
                </div>

                {/* Modal Footer Controls */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-8 py-3 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 hover:bg-primary/95 shadow-md shadow-primary/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Store size={16} />
                    )}
                    <span>{editingVendorId ? "Save Vendor Changes" : canEdit ? "Register Vendor Partner" : "Propose Vendor"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sub-Tabs Selector */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200/50">
        <button
          onClick={() => setActiveTab("directory")}
          className={cn(
            "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5",
            activeTab === "directory" ? "bg-white text-primary shadow-sm font-black border border-slate-200/20" : "text-slate-500 hover:text-slate-850"
          )}
        >
          <Store size={12} />
          <span>Vendors Directory</span>
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={cn(
            "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5",
            activeTab === "analytics" ? "bg-white text-primary shadow-sm font-black border border-slate-200/20" : "text-slate-500 hover:text-slate-850"
          )}
        >
          <BarChart3 size={12} />
          <span>Spend Analytics</span>
        </button>
      </div>

      {activeTab === "directory" && (
        <div className="space-y-8 animate-in fade-in-50 duration-500">
          {/* Header Panel */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <Store className="text-primary w-5 h-5" />
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase">Vendors Directory</h1>
              </div>
              <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest pl-7">Verified partners & supply chain network</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={exportToCSV}
                 className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
              >
                <Download size={14} />
                Export Data
              </button>
              <button
                onClick={() => {
                  handleCancelForm();
                  setShowAddForm(true);
                }}
                className="group flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary transition-all shadow-xl shadow-primary/20 cursor-pointer"
              >
                <PlusCircle size={14} className="group-hover:rotate-90 transition-transform duration-300" />
                <span>NEW VENDOR</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border-2 border-slate-50 rounded-3xl p-6 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Store size={20} />
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Vendors</div>
                <div className="text-2xl font-black text-slate-900 tabular-nums leading-none">{stats.total}</div>
              </div>
            </div>
            <div className="bg-white border-2 border-slate-50 rounded-3xl p-6 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Recently Added</div>
                <div className="text-2xl font-black text-slate-900 tabular-nums leading-none">{stats.recentlyAdded}</div>
              </div>
            </div>
            <div className="bg-white border-2 border-slate-50 rounded-3xl p-6 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Top Category</div>
                <div className="text-2xl font-black text-slate-900 leading-none">{stats.mostOffered}</div>
              </div>
            </div>
          </div>

          {/* Top 3 Vendors Summary Card */}
          {stats.topVendors.length > 0 && (
            <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl border border-slate-800 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 transition-transform group-hover:scale-125 duration-700">
                <Package size={100} className="text-white" />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="space-y-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                    <Briefcase size={18} className="text-primary" />
                    Approved Vendors
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-md font-medium">
                    Most utilized vendors across the financial ledger, prioritized by total requisition volume.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 max-w-3xl">
                  {stats.topVendors.map((vendor, idx) => (
                    <div key={vendor.name} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 group/item hover:bg-white/10 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-black text-xs">
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-black text-white uppercase tracking-tight truncate" title={vendor.name}>{vendor.name}</div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{vendor.count} Transactions</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Filters and Search */}
          <div className="bg-white/40 backdrop-blur-xl border-2 border-slate-100 rounded-[2.5rem] p-6 md:p-10 shadow-sm space-y-8">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="relative flex-1 group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Filter by name, offerings or contact details..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-[11px] md:text-xs font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 tracking-wider focus:outline-none focus:border-primary/30 focus:bg-white shadow-sm transition-all"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl overflow-x-auto no-scrollbar whitespace-nowrap">
                <button
                  onClick={() => setSelectedOfferingsFilter("ALL")}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                    selectedOfferingsFilter === "ALL" ? "bg-white text-primary shadow-md" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  All Partners
                </button>
                {uniqueOfferings.slice(0, 15).map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedOfferingsFilter(category)}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                      selectedOfferingsFilter.toLowerCase() === category.toLowerCase() ? "bg-white text-primary shadow-md" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                    <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort("name")}>
                      <div className="flex items-center">
                        Vendor Partner
                        <SortIcon field="name" />
                      </div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort("offerings")}>
                       <div className="flex items-center">
                        Core Offerings
                        <SortIcon field="offerings" />
                      </div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort("contact")}>
                      <div className="flex items-center">
                        Contact Details
                        <SortIcon field="contact" />
                      </div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort("location")}>
                      <div className="flex items-center">
                        Location
                        <SortIcon field="location" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedFilteredVendors.map((vendor) => {
                    const vendorStats = vendorSpendData.find(vd => vd.name.toLowerCase() === vendor.name.toLowerCase());
                    const disbursedCount = vendorStats?.count || 0;
                    
                    return (
                      <motion.tr
                        layout
                        key={vendor.id}
                        className="bg-white border-2 border-slate-50 rounded-2xl group transition-all hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 shadow-sm"
                      >
                        <td className="px-6 py-5 first:rounded-l-2xl">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-primary font-black border border-slate-100 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                              {vendor.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="text-[11px] font-black text-slate-900 uppercase tracking-wider">{vendor.name}</div>
                                {disbursedCount > 0 && (
                                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-md text-[8px] font-black" title="Number of disbursed transactions">
                                    {disbursedCount}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                              <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                vendor.status === "PENDING" ? "bg-amber-400" :
                                vendor.status === "REJECTED" ? "bg-rose-500" :
                                "bg-emerald-500"
                              )} />
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                {vendor.status === "PENDING" ? "PENDING APPROVAL" :
                                 vendor.status === "REJECTED" ? "REJECTED" :
                                 "ACTIVE VENDOR"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-1.5">
                          {parseOfferings(vendor.offerings).map((o, idx) => (
                            <span key={idx} className="px-3 py-1 bg-slate-50 border border-slate-100 text-slate-500 rounded-lg text-[8px] font-black uppercase tracking-widest group-hover:bg-primary/5 group-hover:border-primary/10 group-hover:text-primary transition-colors">
                              {o}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                         <div className="text-[10px] font-bold text-slate-600 tracking-wide">{vendor.contact}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                           <MapPin size={12} className="text-slate-400" />
                           <span className="text-[10px] font-bold text-slate-600 tracking-tight">{vendor.location}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 last:rounded-r-2xl text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewingVendor(vendor)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="View Vendor Details"
                          >
                            <Eye size={16} />
                          </button>
                          
                          {canEdit && vendor.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => handleStatusChange(vendor.id, "APPROVED")}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all font-black text-[9px] uppercase"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleStatusChange(vendor.id, "REJECTED")}
                                className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all font-black text-[9px] uppercase"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          
                          {canEdit && (
                             <button
                               onClick={() => handleEditVendorClick(vendor)}
                               className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                               title="Edit Vendor"
                             >
                               <Pencil size={16} />
                             </button>
                           )}
                          {canEdit && (
                            <button
                              onClick={() => deleteVendor(vendor.id)}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                              title="Delete Vendor"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  )})}
                </tbody>
              </table>
              
              {filteredVendors.length === 0 && syncingTargets.has('vendors') && (
                <div className="py-8 w-full flex flex-col gap-3 px-6">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="w-full h-16 bg-slate-100 rounded-2xl animate-pulse" />
                  ))}
                </div>
              )}

              {filteredVendors.length === 0 && !syncingTargets.has('vendors') && (
                <div className="py-20 flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Search size={32} className="text-slate-200" />
                  </div>
                  <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1 text-center">No vendors found</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">Refine your search and try again</p>
                </div>
              )}

              {filteredVendors.length > 0 && (
                <div className="mt-4 px-6 py-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-500">
                  <div className="text-[11px] font-bold text-slate-500">
                    Showing <span className="font-extrabold text-slate-800">{((vendorPage - 1) * VENDORS_PER_PAGE) + 1}</span> to <span className="font-extrabold text-slate-800">{Math.min(vendorPage * VENDORS_PER_PAGE, filteredVendors.length)}</span> of <span className="font-extrabold text-slate-800">{filteredVendors.length}</span> vendor partners
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setVendorPage(p => Math.max(1, p - 1))}
                      disabled={vendorPage === 1}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider"
                      title="Previous Page"
                    >
                      <ChevronLeft size={14} />
                      <span>Prev</span>
                    </button>

                    <div className="flex items-center gap-1 px-2 font-mono text-[11px] font-extrabold">
                      <span className="text-primary">{vendorPage}</span>
                      <span className="text-slate-300">/</span>
                      <span className="text-slate-500">{totalVendorPages}</span>
                    </div>

                    <button
                      onClick={() => setVendorPage(p => Math.min(totalVendorPages, p + 1))}
                      disabled={vendorPage >= totalVendorPages}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider"
                      title="Next Page"
                    >
                      <span>Next</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="space-y-8 animate-in fade-in-50 duration-500">
          {/* Executive Analytics Hero Summary Header */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-slate-900 text-white rounded-[2.5rem] p-8 md:p-10 border border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <BarChart3 size={150} />
            </div>
            <div className="space-y-2 relative z-10 font-sans">
              <span className="text-[9px] font-black bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-full uppercase tracking-wider">
                Corporate Governance & Audit
              </span>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Supplier Spend Analytics</h2>
              <p className="text-slate-400 text-xs max-w-xl font-medium leading-relaxed">
                Aggressive diagnostic oversight engine. Tracks historical billing anomalies, identifies off-contract leakages, and simulates category consolidation opportunities to expand profit margins.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-4 items-center">
              <div className="bg-white/5 border border-white/10 px-5 py-4 rounded-2xl flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <PiggyBank size={20} />
                </div>
                <div className="font-sans">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Identified Savings Channels</div>
                  <div className="text-md sm:text-lg font-black font-mono text-emerald-400 leading-none">Ksh {totalPotentialSavings.toLocaleString()}</div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 px-5 py-4 rounded-2xl flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <TrendingUp size={20} />
                </div>
                <div className="font-sans">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Identified Volatile Items</div>
                  <div className="text-md sm:text-lg font-black font-mono text-white leading-none">{pricingVolatility.length} Warnings</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border-2 border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between font-sans">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aggregate Ledger Spend</div>
                <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center text-xs">
                  KES
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 font-mono tracking-tight text-slate-850">Ksh {totalDisbursedSpendSum.toLocaleString()}</div>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-2">
                  Total actual paid/settled transactions to verified supplier base.
                </p>
              </div>
            </div>

            <div className="bg-white border-2 border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between font-sans">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Risk Profile (HHI)</div>
                <span className={cn("px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border", spendConcentrationInfo.color)}>
                  {spendConcentrationInfo.label}
                </span>
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">{spendConcentrationInfo.hhi} Index</div>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-2 leading-relaxed">
                  Top vendor <strong className="text-slate-750 font-black">{spendConcentrationInfo.topVendorName}</strong> represents <strong className="text-slate-800 font-black font-extrabold">{spendConcentrationInfo.topVendorPercent}%</strong> of total spend.
                </p>
              </div>
            </div>

            <div className="bg-white border-2 border-rose-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between font-sans">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Unregistered Leakage</div>
                <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest">
                  {unregisteredLeakage.list.length} Off-Contract
                </span>
              </div>
              <div>
                <div className="text-2xl font-black text-rose-600 font-mono tracking-tight">Ksh {unregisteredLeakage.totalAmount.toLocaleString()}</div>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-2 leading-relaxed">
                  Bypassing the registered trade list creates major legal compliance and billing variance.
                </p>
              </div>
            </div>
          </div>

          {/* Spend Charts Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border-2 border-slate-100 rounded-[2.5rem] p-6 md:p-8 shadow-sm space-y-4 font-sans">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Top Supplier Allocations</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Disbursed Outflow vs Pre-approved Pipeline</p>
                </div>
                <span className="text-[9px] text-slate-400 font-mono uppercase font-bold">Top 10 Providers</span>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={vendorSpendData.slice(0, 10).filter(item => item.total > 0)}
                    margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 10)}...` : value}
                    />
                    <YAxis 
                      tick={{ fontSize: 9, fontWeight: 700, strokeWidth: 0, fill: '#64748b' }}
                      tickFormatter={(value) => `Ksh ${value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value >= 1e3 ? `${(value / 1e3).toFixed(0)}k` : value}`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip 
                      cursor={{ fill: 'rgba(241, 245, 249, 0.4)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xl text-[11px] space-y-1.5 min-w-[200px] font-sans">
                              <p className="font-extrabold text-slate-850 border-b border-slate-100 pb-1 uppercase tracking-wide">{data.name}</p>
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Disbursed Paid:</span>
                                <span className="font-mono font-bold text-emerald-600">Ksh {data.disbursed.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-medium">Approved Pipeline:</span>
                                <span className="font-mono font-bold text-indigo-600">Ksh {data.pipeline.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between border-t border-dashed border-slate-100 pt-1.5 mt-1">
                                <span className="text-slate-800 font-bold uppercase tracking-wider text-[9px]">Total exposure:</span>
                                <span className="font-mono font-black text-slate-900">Ksh {data.total.toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right"
                      iconSize={8}
                      iconType="circle"
                      wrapperStyle={{ fontSize: 9, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    />
                    <Bar name="Disbursed" dataKey="disbursed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar name="Pipeline" dataKey="pipeline" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-6 md:p-8 shadow-sm flex flex-col justify-between font-sans">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Top Categories Breakdown</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Overall spend ratio by registry</p>
              </div>

              <div className="h-48 w-full relative flex items-center justify-center py-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={consolidationOpportunities.slice(0, 5)}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="totalSpend"
                    >
                      {consolidationOpportunities.slice(0, 5).map((entry, index) => {
                        const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
                        return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                      })}
                    </Pie>
                    <RechartsTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-md text-[10px] font-sans">
                              <p className="font-bold text-slate-700 uppercase tracking-wider mb-1">{data.categoryName}</p>
                              <span className="font-mono text-slate-900 font-extrabold">Ksh {data.totalSpend.toLocaleString()}</span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Total Audited</span>
                  <span className="text-xs font-bold font-mono text-slate-800 truncate block max-w-[85px]">
                    Ksh {(totalDisbursedSpendSum >= 1e6 ? `${(totalDisbursedSpendSum / 1e6).toFixed(1)}M` : `${Math.round(totalDisbursedSpendSum / 1e3)}k`)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-50 pt-4">
                {consolidationOpportunities.slice(0, 4).map((item, idx) => {
                  const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899"];
                  const percent = totalDisbursedSpendSum > 0 ? Math.round((item.totalSpend / totalDisbursedSpendSum) * 100) : 0;
                  return (
                    <div key={item.categoryName} className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span className="truncate uppercase font-bold text-slate-700 text-[10px]">{item.categoryName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-black text-slate-800">Ksh {item.totalSpend.toLocaleString()}</span>
                        <span className="text-[9px] text-slate-400 font-semibold">{percent}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recharts Historical Volume and unit Pricing Trend */}
          <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-6 md:p-8 shadow-sm space-y-6 font-sans">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                  <TrendingUp size={16} className="text-indigo-600" />
                  Historical Billing Trends & Pricing Elasticity
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Compare supplier rate expansion, billing cycles and inflation factors over time</p>
              </div>

              {/* Dynamic Drill Down Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-2.5 py-1.5 rounded-xl text-[10px]">
                  <span className="text-slate-400 font-black uppercase">Vendor:</span>
                  <select 
                    value={trendVendor}
                    onChange={(e) => setTrendVendor(e.target.value)}
                    className="bg-transparent font-extrabold text-slate-700 focus:outline-none cursor-pointer text-[10px] uppercase tracking-wider"
                  >
                    <option value="ALL">All Vendors (Aggregate)</option>
                    {vendorSpendData.map(v => (
                      <option key={v.name} value={v.name}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-2.5 py-1.5 rounded-xl text-[10px]">
                  <span className="text-slate-400 font-black uppercase">Service Category:</span>
                  <select 
                    value={trendCategory}
                    onChange={(e) => setTrendCategory(e.target.value)}
                    className="bg-transparent font-extrabold text-slate-700 focus:outline-none cursor-pointer text-[10px] uppercase tracking-wider"
                  >
                    <option value="ALL">All Categories</option>
                    {activeRequisitionCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    yAxisId="left"
                    tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }}
                    tickFormatter={(value) => `Ksh ${value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value >= 1e3 ? `${(value / 1e3).toFixed(0)}k` : value}`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 9, fontWeight: 700, fill: '#6366f1' }}
                    tickFormatter={(value) => `Ksh ${value >= 1e3 ? `${(value / 1e3).toFixed(0)}k` : value}`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xl text-[11px] space-y-2 min-w-[210px] font-sans">
                            <p className="font-extrabold text-slate-800 border-b border-slate-100 pb-1.5 uppercase tracking-wider">{label} Operations</p>
                            <div className="flex justify-between items-center text-slate-600">
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"/> Cumulative Spent:</span>
                              <span className="font-mono font-bold text-slate-950">Ksh {payload[0]?.value?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-600">
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block"/> Average Ticket Price:</span>
                              <span className="font-mono font-bold text-indigo-600">Ksh {payload[1]?.value?.toLocaleString()}</span>
                            </div>
                            <div className="bg-slate-50 rounded px-2.5 py-1 text-[9px] text-slate-400 font-bold border border-slate-100 uppercase tracking-widest text-center mt-1">
                              Volume: {payload[0]?.payload?.count} transactions
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="right"
                    iconSize={8}
                    iconType="circle"
                    wrapperStyle={{ fontSize: 9, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  />
                  <Line yAxisId="left" name="Cumulative Spend" type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" name="Avg Transaction Price" type="monotone" dataKey="avgAmount" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-sans">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="text-indigo-600 mt-0.5 shrink-0" size={16} />
                <p className="text-slate-600 font-semibold leading-relaxed">
                  <strong className="text-slate-800">Rate Volatility Diagnostic Warning:</strong> Upward spikes in Average Ticket Price (represented by the dashed blue line) signify price creeping or expanding vendor contracts. Managers can click on individual vendors or categories above to run custom rate card reviews.
                </p>
              </div>
            </div>
          </div>

          {/* Audit Savings & Procurement Optimization Hub */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Opportunities 1: Vendor Consolidation */}
            <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-6 shadow-sm flex flex-col justify-between font-sans">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    🤝
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase text-slate-800 tracking-wide">Supply Consolidation</h4>
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest">Aggregate vendor accounts</p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  The following service registries are being split across multiple separate trade suppliers. Buying in consolidated pools unlocks up to <strong className="text-emerald-600 font-bold">12% volume negotiation margins</strong>.
                </p>

                <div className="space-y-3.5 max-h-[250px] overflow-y-auto pr-1">
                  {consolidationOpportunities.length > 0 ? (
                    consolidationOpportunities.map((opp) => (
                      <div key={opp.categoryName} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-extrabold text-slate-800 uppercase text-[9px] tracking-wide truncate max-w-[125px]">{opp.categoryName}</span>
                          <span className="font-mono text-emerald-650 font-black">Save ~Ksh {opp.potentialSaving.toLocaleString()}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>Splits / Reqs:</span>
                            <span className="font-semibold text-slate-700">{opp.vendorCount} Vendors / {opp.reqCount} Orders</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>Registry Volume:</span>
                            <span className="font-mono font-semibold text-slate-700">Ksh {opp.totalSpend.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                      🌿 Vendor distribution is perfectly streamlined!
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Opportunities 2: Unverified Vendor Leakage */}
            <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-6 shadow-sm flex flex-col justify-between font-sans">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
                    🚨
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase text-slate-800 tracking-wide">Registry Leakages</h4>
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest">Off-Contract Spending</p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  Purchases made outside active registered trade partnerships bypass corporate volume discounts. Moving these onto contract saves around <strong className="text-emerald-600 font-bold">10% in billing leakage</strong>.
                </p>

                <div className="space-y-3.5 max-h-[250px] overflow-y-auto pr-1">
                  {unregisteredLeakage.list.length > 0 ? (
                    unregisteredLeakage.list.map((leak) => (
                      <div key={leak.name} className="p-3 bg-rose-50/15 border border-rose-100 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-extrabold text-slate-850 uppercase text-[9px] tracking-wide truncate max-w-[125px]">{leak.name}</span>
                          <span className="font-mono text-rose-600 font-bold">Incurred Ksh {leak.totalSpend.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Classification: {leak.category}</span>
                          <span className="font-mono text-emerald-650 font-black">Save ~Ksh {leak.potentialSaving.toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                      ✅ 100% compliance with verified partner registry!
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Opportunities 3: Pricing Volatility Alerts */}
            <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-6 shadow-sm flex flex-col justify-between font-sans">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                    ⚠️
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase text-slate-800 tracking-wide">Price Creep Warnings</h4>
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest">Billing Fluctuation triggers</p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  Repeat purchases from the same partner displaying high volatility (&gt;30% price gap). Recommends establishing <strong className="text-indigo-600 font-bold">Locked Rate-Cards</strong>.
                </p>

                <div className="space-y-3.5 max-h-[250px] overflow-y-auto pr-1">
                  {pricingVolatility.length > 0 ? (
                    pricingVolatility.map((pv, index) => (
                      <div key={index} className="p-3 bg-amber-50/25 border border-amber-100 rounded-xl space-y-1.5 font-sans">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-extrabold text-slate-850 uppercase text-[9px] tracking-wide truncate max-w-[125px]">{pv.titleKeyword}</span>
                          <span className="font-mono text-amber-700 font-semibold font-bold">+{pv.ratioPercent}% swing</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>Supplier: {pv.vendor}</span>
                          <span className="font-mono">Range: Ksh {pv.minSpend.toLocaleString()} - {pv.maxSpend.toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                      🛡️ All repeating unit costs are steady.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Vendor Spending Index Table */}
          <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-6 md:p-10 shadow-sm space-y-6 font-sans">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Vendor Expenditure Index</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Comprehensive audit index of paid outflows and recurring registry listings</p>
              </div>
              <button 
                onClick={() => {
                  handleCancelForm();
                  setShowAddForm(true);
                }}
                className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-black tracking-wider uppercase flex items-center gap-2 shadow-md shadow-primary/20 transition-all shrink-0 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <PlusCircle size={15} />
                <span>Add Vendor to List</span>
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                    <th className="px-6 py-4">Vendor Partner</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4 text-center">Requisitions</th>
                    <th className="px-6 py-4 text-right font-black">Settled/Disbursed</th>
                    <th className="px-6 py-4 text-right">Commitment Pipeline</th>
                    <th className="px-6 py-4 text-right">Total Exposure</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedVendorSpendData.map((v) => (
                    <tr key={v.name} className="bg-white border-2 border-slate-50 rounded-2xl group hover:border-primary/20 hover:shadow-lg transition-all shadow-sm">
                      <td className="px-6 py-4 first:rounded-l-2xl">
                        <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider block">{v.name}</span>
                        <div className="flex items-center gap-1 mt-1 font-mono text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                          {v.categories.slice(0, 2).join(" • ") || "No Specified Category"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          {v.isRegistered ? (
                            <span className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                              Verified Partner
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setName(v.name);
                                setEditingVendorId(null);
                                setContact("");
                                setLocation("");
                                setOfferings(v.categories.join(", "));
                                setShowAddForm(true);
                                triggerToast({
                                  type: "FINANCE_DISBURSEMENT",
                                  severity: "LOW",
                                  message: `✍️ Pre-filled details for "${v.name}". Complete registration in modal.`,
                                  timestamp: new Date().toISOString()
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 transition-all flex items-center gap-1 cursor-pointer group/badge"
                              title={`Click to register "${v.name}" in vendor directory`}
                            >
                              <span>Unlisted Payee</span>
                              <PlusCircle size={10} className="opacity-70 group-hover/badge:opacity-100 group-hover/badge:scale-110 transition-all text-rose-600" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-xs font-bold text-slate-700">{v.count} Reqs</td>
                      <td className="px-6 py-4 text-right font-mono font-black text-emerald-600 text-xs">Ksh {v.disbursed.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-mono text-slate-500 font-semibold text-xs">Ksh {v.pipeline.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-mono font-black text-slate-900 last:rounded-r-2xl text-xs">Ksh {v.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {vendorSpendData.length > 0 && (
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-500 border-t border-slate-100">
                <div className="text-[11px] font-bold text-slate-500">
                  Showing <span className="font-extrabold text-slate-800">{((indexPage - 1) * INDEX_PER_PAGE) + 1}</span> to <span className="font-extrabold text-slate-800">{Math.min(indexPage * INDEX_PER_PAGE, vendorSpendData.length)}</span> of <span className="font-extrabold text-slate-800">{vendorSpendData.length}</span> index entries
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIndexPage(p => Math.max(1, p - 1))}
                    disabled={indexPage === 1}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider"
                    title="Previous Page"
                  >
                    <ChevronLeft size={14} />
                    <span>Prev</span>
                  </button>

                  <div className="flex items-center gap-1 px-2 font-mono text-[11px] font-extrabold">
                    <span className="text-primary">{indexPage}</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-slate-500">{totalIndexPages}</span>
                  </div>

                  <button
                    onClick={() => setIndexPage(p => Math.min(totalIndexPages, p + 1))}
                    disabled={indexPage >= totalIndexPages}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider"
                    title="Next Page"
                  >
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Vendor Details Modal */}
      <AnimatePresence>
        {viewingVendor && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden border border-slate-200 flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center text-xl font-black shadow-lg shadow-primary/20">
                    {viewingVendor.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">{viewingVendor.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border",
                        viewingVendor.status === "APPROVED" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                      )}>
                        {viewingVendor.status || "PENDING"}
                      </span>
                      <span className="text-[8px] font-mono text-slate-400 tracking-tighter">ID: {viewingVendor.id}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setViewingVendor(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors group"
                >
                  <X size={20} className="text-slate-400 group-hover:text-slate-600" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-8 space-y-8 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Package size={14} className="text-primary" />
                        Core Offerings
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {parseOfferings(viewingVendor.offerings).length > 0 ? (
                          parseOfferings(viewingVendor.offerings).map((o, idx) => (
                            <span key={idx} className="px-3 py-1.5 bg-slate-50 border border-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest">
                              {o}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">No categories listed</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <MapPin size={14} className="text-primary" />
                        Operation Base
                      </h4>
                      <p className="text-xs font-bold text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        {viewingVendor.location || "No physical address provided."}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Mail size={14} className="text-primary" />
                        Contact Interface
                      </h4>
                      <p className="text-xs font-bold text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        {viewingVendor.contact || "No contact credentials on record."}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp size={14} className="text-emerald-400" />
                        Financial Footprint
                      </h4>
                      
                      {(() => {
                        const stats = vendorSpendData.find(vd => vd.name.toLowerCase() === viewingVendor.name.toLowerCase());
                        return (
                          <div className="space-y-4">
                            <div className="flex justify-between items-end border-b border-white/10 pb-3">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Settled</span>
                              <span className="text-xl font-black text-emerald-400 font-sans tracking-tight">
                                Ksh {stats?.disbursed.toLocaleString() || "0"}
                              </span>
                            </div>
                            <div className="flex justify-between items-end border-b border-white/10 pb-3">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">In Pipeline</span>
                              <span className="text-sm font-black text-slate-200 font-sans tracking-tight">
                                Ksh {stats?.pipeline.toLocaleString() || "0"}
                              </span>
                            </div>
                            <div className="flex justify-between items-end">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Transaction Count</span>
                              <span className="text-sm font-black text-slate-200 font-sans tracking-tight">
                                {stats?.count || 0} REQUISITIONS
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 space-y-3">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <CalendarDays size={14} className="text-primary" />
                        Ledger Onboarding
                      </h4>
                      <p className="text-[10px] font-bold text-slate-600">
                        Record created on: {new Date(viewingVendor.createdAt).toLocaleDateString(undefined, { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Notice */}
                <div className="bg-amber-50/50 border border-amber-100/50 rounded-2xl p-4 flex gap-3 items-start">
                   <ShieldCheck size={16} className="text-amber-500 shrink-0 mt-0.5" />
                   <p className="text-[9px] text-amber-700/80 leading-relaxed font-bold uppercase tracking-tight">
                     SECURE VENDOR PROFILE: ALL FINANCIAL TRANSACTIONS ARE CRYPTOGRAPHICALLY LINKED TO THIS VENDOR IDENTITY. MODIFICATIONS SHOULD BE CONDUCTED EXCLUSIVELY VIA THE ADMINISTRATION PANEL.
                   </p>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/30 flex justify-end">
                <button
                  onClick={() => setViewingVendor(null)}
                  className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-lg"
                >
                  CLOSE_PROFILE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
