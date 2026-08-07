/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Play, 
  HelpCircle, 
  Sparkles,
  Award,
  Zap
} from "lucide-react";

export interface TourStep {
  title: string;
  content: string;
  placement: "top" | "bottom" | "left" | "right" | "center";
  targetId: string;
  targetView: string;
}

interface ProductTourProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: string;
  onViewChange: (view: string) => void;
}

export const ProductTour: React.FC<ProductTourProps> = ({
  isOpen,
  onClose,
  currentView,
  onViewChange
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const steps: TourStep[] = [
    {
      title: "Welcome to the STANDS Portal! 🚀",
      content: "This interactive tour will guide you through the key features of the St Andrews Requisition and Budget Management System step by step. Let's get started!",
      placement: "center",
      targetId: "",
      targetView: "dashboard"
    },
    {
      title: "Operations Navigation Sidebar",
      content: "The left panel lets you switch views easily. The available menu items adapt dynamically based on your verified access role (General Rep, Compliance verifier L1, Keymaster L2, or Finance auditor).",
      placement: "right",
      targetId: "sidebar-nav-container",
      targetView: "dashboard"
    },
    {
      title: "Global Search Engine",
      content: "Instantly search all requisitions, departments, or vendors. Use keywords or press Ctrl+K from anywhere to focus search. You can filter search results by Title, Group, or Requester.",
      placement: "bottom",
      targetId: "global-search-container",
      targetView: "dashboard"
    },
    {
      title: "Real-time Verification Alerts",
      content: "This notification center instantly alerts you of budget compliance warnings, duplicate invoice checks, and pending approvals awaiting your signature.",
      placement: "bottom",
      targetId: "notification-bell-trigger",
      targetView: "dashboard"
    },
    {
      title: "User Profile & Settings",
      content: "Manage your account theme, update profile configurations, or customize your idle warning timeout duration (5, 15, or 30 mins) under this menu.",
      placement: "left",
      targetId: "profile-dropdown-trigger",
      targetView: "dashboard"
    },
    {
      title: "Interactive Documentation Hub",
      content: "We've replaced outdated PDF compliance guides with a searchable digital manual covering every operational scenario, role privilege, and security control.",
      placement: "bottom",
      targetId: "help-page-header",
      targetView: "help"
    },
    {
      title: "Validation Stage Simulator",
      content: "Experience the direct journey of a requisition! Use this live sandbox simulator to dry-run validations under all security clearance levels step-by-step.",
      placement: "top",
      targetId: "help-sandbox-simulator",
      targetView: "help"
    }
  ];

  const activeStep = steps[currentStep];

  // Logic to handle auto positioning & viewport alignment
  useEffect(() => {
    if (!isOpen) return;

    const findAndMeasureTarget = () => {
      if (!activeStep.targetId) {
        setCoords(null);
        return;
      }

      const element = document.getElementById(activeStep.targetId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        
        // Wait a small moment for scrolling to finish to calculate coordinates accurately
        setTimeout(() => {
          const rect = element.getBoundingClientRect();
          setCoords({
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height
          });
        }, 150);
      } else {
        setCoords(null);
      }
    };

    // Run measurement
    findAndMeasureTarget();

    // Trigger on resize/scroll
    window.addEventListener("resize", findAndMeasureTarget);
    window.addEventListener("scroll", findAndMeasureTarget);

    return () => {
      window.removeEventListener("resize", findAndMeasureTarget);
      window.removeEventListener("scroll", findAndMeasureTarget);
    };
  }, [currentStep, isOpen, activeStep.targetId, currentView]);

  if (!isOpen) return null;

  const handleNext = () => {
    const nextIdx = currentStep + 1;
    if (nextIdx >= steps.length) {
      localStorage.setItem("stands_has_seen_tour", "true");
      onClose();
      return;
    }

    const nextStep = steps[nextIdx];
    if (nextStep.targetView && nextStep.targetView !== currentView) {
      onViewChange(nextStep.targetView);
      // Brief delay for router change to mount elements safely
      setTimeout(() => {
        setCurrentStep(nextIdx);
      }, 300);
    } else {
      setCurrentStep(nextIdx);
    }
  };

  const handlePrev = () => {
    if (currentStep === 0) return;
    const prevIdx = currentStep - 1;
    const prevStep = steps[prevIdx];
    if (prevStep.targetView && prevStep.targetView !== currentView) {
      onViewChange(prevStep.targetView);
      setTimeout(() => {
        setCurrentStep(prevIdx);
      }, 300);
    } else {
      setCurrentStep(prevIdx);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("stands_has_seen_tour", "true");
    onClose();
  };

  // Tooltip coordinates placement positioning calculations
  const getTooltipStyle = (): React.CSSProperties => {
    if (!coords || activeStep.placement === "center") {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(400px, 90vw)"
      };
    }

    const offsetThreshold = 14;
    const style: React.CSSProperties = {
      position: "absolute",
      width: "min(320px, 90vw)",
      zIndex: 150
    };

    switch (activeStep.placement) {
      case "top":
        style.top = coords.top - 200 - offsetThreshold;
        style.left = coords.left + coords.width / 2 - 160;
        break;
      case "bottom":
        style.top = coords.top + coords.height + offsetThreshold;
        style.left = coords.left + coords.width / 2 - 160;
        break;
      case "left":
        style.top = coords.top + coords.height / 2 - 100;
        style.left = coords.left - 320 - offsetThreshold;
        break;
      case "right":
        style.top = coords.top + coords.height / 2 - 100;
        style.left = coords.left + coords.width + offsetThreshold;
        break;
    }

    // Keep tooltips bounded inside the visible layout safely
    if (typeof window !== "undefined") {
      const parsedLeft = typeof style.left === "number" ? style.left : 0;
      if (parsedLeft < 10) style.left = 10;
      if (parsedLeft + 330 > window.innerWidth) {
        style.left = window.innerWidth - 330;
      }
      
      const parsedTop = typeof style.top === "number" ? style.top : 0;
      if (parsedTop < 10) style.top = 10;
    }

    return style;
  };

  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="stands-tour-overlay">
      {/* 1. Backdrop highlight masking spot (Spotlight effect) */}
      <AnimatePresence>
        {coords && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-[140]"
          >
            <div
              className="absolute border-[3px] border-primary rounded-2xl shadow-[0_0_0_9999px_rgba(2,6,23,0.7)] transition-all duration-300 pointer-events-none"
              style={{
                top: coords.top - 8,
                left: coords.left - 8,
                width: coords.width + 16,
                height: coords.height + 16
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Full screen block backdrop for welcoming steps or center placement (helps prevent arbitrary click misfires) */}
      {!coords && (
        <div className="fixed inset-0 bg-slate-950/70 z-[140] pointer-events-auto" onClick={handleSkip} />
      )}

      {/* 3. Floating Tooltip Context Box */}
      <div 
        style={getTooltipStyle()} 
        ref={tooltipRef} 
        className="z-[155] select-none"
      >
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 15, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="bg-card dark:bg-slate-900 border border-primary/20 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden"
        >
          {/* Neon Banner Line */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary to-blue-400" />

          {/* Sparkle graphics in welcome step */}
          {currentStep === 0 && (
            <div className="absolute -top-12 -right-12 p-8 opacity-5">
              <Zap size={100} className="text-primary animate-bounce animate-pulse" />
            </div>
          )}

          {/* Close Trigger Button */}
          <button
            onClick={handleSkip}
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-100 p-1 hover:bg-slate-800/40 rounded-full transition-colors"
            title="Exit Tour"
          >
            <X size={14} />
          </button>

          {/* Header Progress Counter */}
          <div className="flex items-center gap-2 mb-3.5">
            <span className="text-[8px] font-black tracking-widest text-[#4f46e5] uppercase px-2 py-0.5 bg-primary/10 rounded border border-primary/20">
              Onboarding
            </span>
            <span className="text-[10px] font-mono text-muted font-bold font-black uppercase">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>

          {/* Title & Body Description */}
          <h3 className="text-sm font-black text-foreground uppercase tracking-tight mb-2 flex items-center gap-2">
            {activeStep.title}
          </h3>
          <p className="text-[11px] md:text-xs text-muted leading-relaxed font-semibold mb-6">
            {activeStep.content}
          </p>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-4">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:pointer-events-none text-[9px] font-black uppercase tracking-widest cursor-pointer transition-colors"
            >
              <ChevronLeft size={14} />
              Prev
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSkip}
                className="text-xs text-muted hover:text-rose-500 transition-colors uppercase tracking-widest font-black text-[9px] cursor-pointer"
              >
                Skip
              </button>
              
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer shadow-lg shadow-indigo-600/15 transition-all active:scale-95 hover:gap-2"
              >
                {isLastStep ? "Finish" : "Next"}
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
