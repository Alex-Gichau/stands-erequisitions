/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  LayoutDashboard, 
  FileText, 
  CheckCircle, 
  Banknote, 
  BarChart3, 
  Settings, 
  UserCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Bell,
  Store,
  MoreHorizontal,
  Activity
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { UserRole } from "../types";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  notificationsCount?: number;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onViewChange, 
  notificationsCount = 0,
  onLogout
}) => {
  const { currentUser, logout, canAccess, users } = useRequisitions();
  
  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      logout();
    }
  };
  
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [hasActiveModal, setHasActiveModal] = useState<boolean>(false);

  React.useEffect(() => {
    const checkModal = () => {
      const modalOverlays = document.querySelectorAll(".fixed.inset-0");
      let active = false;
      modalOverlays.forEach((el) => {
        const className = el.className || "";
        // Exclude sidebar navigation dropdown overlays
        const isSelfBackdrop = className.includes("z-[-1]") || className.includes("z-30");
        if (!isSelfBackdrop) {
          if (
            className.includes("z-50") ||
            className.includes("z-[120]") ||
            className.includes("z-[100]") ||
            className.includes("z-[200]") ||
            className.includes("z-[60]") ||
            className.includes("backdrop-blur-sm") ||
            className.includes("backdrop-blur-md")
          ) {
            active = true;
          }
        }
      });
      setHasActiveModal(active);
    };

    checkModal();

    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, { 
      childList: true, 
      subtree: true, 
      attributes: true, 
      attributeFilter: ["class", "style"] 
    });

    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved === "false") {
        setIsCollapsed(false);
      } else if (saved === "true") {
        setIsCollapsed(true);
      }
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      if (typeof window !== "undefined") {
        localStorage.setItem("sidebar_collapsed", String(!prev));
      }
      return !prev;
    });
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "notifications", label: "Notification", icon: Bell },
    { id: "requisitions", label: "Requisitions", icon: FileText },
    { id: "transactions", label: "Transactions", icon: Activity },
    { id: "vendors", label: "STANDS Vendors", icon: Store },
    { id: "approvals", label: "Approvals", icon: CheckCircle },
    { id: "finance", label: "Budgets", icon: Banknote },
    { id: "reports", label: "Financial Reports", icon: BarChart3 },
    { id: "users", label: "Users", icon: UserCircle },
    { id: "auditTrail", label: "Audit Trail", icon: ShieldAlert, desktopOnly: true },
    { id: "accessControl", label: "Permissions", icon: ShieldCheck, desktopOnly: true },
    { id: "settings", label: "Settings", icon: Settings, desktopOnly: true },
  ];

  const filteredItems = menuItems.filter(item => canAccess(item.id));

  return (
    <>
      <div id="sidebar-nav-container" className={cn(
        "hidden md:flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-500 relative z-30 shrink-0",
        isCollapsed ? "w-20" : "w-64"
      )}>
      {/* Brand Header */}
      <div className="h-20 flex items-center px-6 border-b border-slate-100 dark:border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Zap size={60} className="text-primary" />
        </div>
        
        <div className="flex items-center gap-3 relative z-10 w-full">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-10 h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center shrink-0 shadow-lg p-1.5 overflow-hidden"
          >
            <img src="/pcea.svg" alt="PCEA Logo" className="w-full h-full object-contain" />
          </motion.div>
          
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="overflow-hidden"
              >
                <h1 className="font-black text-slate-900 dark:text-white text-md tracking-tighter uppercase whitespace-nowrap">
                  St Andrews
                </h1>
                <p className="text-[9px] text-primary font-black uppercase tracking-[0.2em] leading-tight">
                  E-REQUISITION
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Collapse Toggle */}
      <button 
        onClick={toggleCollapse}
        title={isCollapsed ? "Expand Navigation" : "Collapse Navigation"}
        className="absolute -right-3 top-24 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all shadow-md dark:shadow-xl hover:scale-110 z-50 cursor-pointer"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto no-scrollbar">
        {!isCollapsed && (
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 ml-2">
            NAVIGATION
          </div>
        )}
        
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              data-sidebar-item={item.label}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "w-full flex items-center rounded-2xl transition-all duration-300 group text-[11px] font-black uppercase tracking-widest focus:outline-none relative",
                isCollapsed ? "justify-center p-3" : "gap-4 px-4 py-3.5",
                isActive 
                  ? "bg-primary text-white shadow-lg shadow-primary/20" 
                  : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100",
                item.desktopOnly ? "hidden lg:flex" : ""
              )}
            >
              <Icon size={18} className={cn("shrink-0", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300")} />
              {!isCollapsed && <span>{item.label}</span>}
              {!isCollapsed && item.id === "notifications" && notificationsCount > 0 && (
                <span className="ml-auto bg-rose-500 text-white font-black text-[9px] px-2 py-0.5 rounded-full ring-2 ring-white dark:ring-slate-900 leading-none">
                  {notificationsCount}
                </span>
              )}
              {isCollapsed && item.id === "notifications" && notificationsCount > 0 && (
                <span className="absolute top-1 right-1 bg-rose-500 text-white font-black text-[8px] w-4.5 h-4.5 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                  {notificationsCount}
                </span>
              )}
              
              {isActive && !isCollapsed && (
                <motion.div 
                  layoutId="active-nav"
                  className="absolute left-0 w-1 h-6 bg-white rounded-r-full"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Profile */}
      <div className="p-4 border-t border-slate-100 dark:border-white/5">
        <div className={cn(
          "bg-slate-50 dark:bg-white/5 rounded-2xl p-3 transition-all",
          isCollapsed ? "flex flex-col items-center gap-4" : "flex items-center gap-4 px-4"
        )}>
           <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 overflow-hidden flex items-center justify-center text-primary font-bold shadow-inner">
              {currentUser?.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt={currentUser.name} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                currentUser?.name?.charAt(0) || "U"
              )}
            </div>
            
          </div>

          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-slate-950 dark:text-white truncate uppercase tracking-tight">{currentUser?.name}</p>
              <p className="text-[9px] text-primary font-bold truncate uppercase tracking-widest mt-0.5">
                {currentUser?.role?.replace("_", " ") || "USER"}
              </p>
            </div>
          )}

          {!isCollapsed && (
            <button 
              onClick={handleLogoutClick}
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-550 dark:hover:text-rose-400 transition-colors hover:bg-rose-500/10 rounded-lg cursor-pointer"
              title="Terminate Session"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
        
        {isCollapsed && (
           <button 
            onClick={handleLogoutClick}
            title="Terminate Session"
            className="w-full mt-4 flex justify-center py-2 text-slate-400 dark:text-slate-500 hover:text-rose-550 dark:hover:text-rose-400 transition-colors cursor-pointer"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </div>

    {/* Sticky Mobile Navbar with More Dropdown */}
    {!hasActiveModal && (
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-white/10 md:hidden z-[60] backdrop-blur-md shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-around h-16 relative px-2">
        {(() => {
          // Identify primary items for the bar
          const mobileDisplayItems = filteredItems.filter(item => !item.desktopOnly);
          const primaries = mobileDisplayItems.slice(0, 4);
          const additionals = mobileDisplayItems.slice(4);
          
          return (
            <>
              {primaries.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onViewChange(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-300 relative",
                      isActive ? "text-primary scale-110" : "text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200"
                    )}
                  >
                    {isActive && (
                      <motion.div 
                        layoutId="nav-dot"
                        className="absolute -top-1 w-1 h-1 bg-primary rounded-full shadow-[0_0_10px_rgba(99,102,241,0.8)]"
                      />
                    )}
                    <div className="relative">
                      <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                      {item.id === "notifications" && notificationsCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[8px] h-4 w-4 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 group-hover:scale-110 transition-transform">
                          {notificationsCount}
                        </span>
                      )}
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-tighter">{item.label.split(" ")[0]}</span>
                  </button>
                );
              })}

              {/* More Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-300",
                  isMobileMenuOpen ? "text-primary scale-110" : "text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200"
                )}
              >
                <MoreHorizontal size={20} strokeWidth={isMobileMenuOpen ? 2.5 : 2} />
                <span className="text-[8px] font-black uppercase tracking-tighter">More</span>
              </button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {isMobileMenuOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[-1]"
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 100, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 100, scale: 0.95 }}
                      className="absolute bottom-[4.5rem] right-4 bg-white dark:bg-slate-850 border border-slate-200 dark:border-white/10 rounded-3xl p-4 shadow-2xl w-[280px] grid grid-cols-2 gap-2 z-50 overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-400 opacity-50" />
                      
                      {additionals.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentView === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              onViewChange(item.id);
                              setIsMobileMenuOpen(false);
                            }}
                            className={cn(
                              "flex flex-col items-center p-3 rounded-2xl gap-2 transition-all",
                              isActive
                                ? "bg-primary text-white shadow-lg shadow-primary/20"
                                : "bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
                            )}
                          >
                            <Icon size={18} />
                            <span className="text-[9px] font-black uppercase tracking-widest text-center leading-tight">
                              {item.label}
                            </span>
                          </button>
                        );
                      })}

                      {/* Explicitly add some usually desktop-only items if they are important or just filtered ones */}
                      {filteredItems.filter(i => i.desktopOnly).map((item) => {
                         const Icon = item.icon;
                        const isActive = currentView === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              onViewChange(item.id);
                              setIsMobileMenuOpen(false);
                            }}
                            className={cn(
                              "flex flex-col items-center p-3 rounded-2xl gap-2 transition-all",
                              isActive
                                ? "bg-primary text-white shadow-lg shadow-primary/20"
                                : "bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
                            )}
                          >
                            <Icon size={18} />
                            <span className="text-[9px] font-black uppercase tracking-widest text-center leading-tight">
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => {
                          handleLogoutClick();
                          setIsMobileMenuOpen(false);
                        }}
                        className="col-span-2 mt-2 flex items-center justify-center gap-2 p-3 bg-rose-500/10 text-rose-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-rose-500/20 transition-all border border-rose-500/20"
                      >
                        <LogOut size={14} />
                        End Session
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </>
          );
        })()}
      </div>
    </div>
    )}
  </>
  );
};

