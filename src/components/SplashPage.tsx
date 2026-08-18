import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Landmark,
  Coins,
  Wallet,
  Receipt,
  CreditCard,
  TrendingUp,
  DollarSign,
  CircleDollarSign,
  PiggyBank,
  Scale,
  Building2,
  ShieldCheck,
  FileText,
  Calculator,
  Banknote,
  PieChart,
  BarChart3,
  Layers,
  Lock,
  Sparkles,
  Award,
  Zap,
  SlidersHorizontal,
  Target,
  Compass,
  LayoutGrid,
  FolderKanban,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Activity,
  Briefcase
} from "lucide-react";

interface SplashPageProps {
  darkMode?: boolean;
  onComplete?: () => void;
  isDataReady?: boolean;
  durationMs?: number;
}

const FINANCE_ICONS = [
  Landmark,
  Coins,
  Wallet,
  Receipt,
  CreditCard,
  TrendingUp,
  DollarSign,
  CircleDollarSign,
  PiggyBank,
  Scale,
  Building2,
  ShieldCheck,
  FileText,
  Calculator,
  Banknote,
  PieChart,
  BarChart3,
  Layers,
  Lock,
  Sparkles,
  Award,
  Zap,
  SlidersHorizontal,
  Target,
  Compass,
  LayoutGrid,
  FolderKanban,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Activity,
  Briefcase
];

export const SplashPage: React.FC<SplashPageProps> = ({
  darkMode = true,
  onComplete,
  isDataReady = true,
  durationMs = 2000,
}) => {
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const onCompleteCalledRef = useRef(false);

  useEffect(() => {
    let animationFrameId: number;

    const animateProgress = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      const targetPercent = Math.min(100, (elapsed / durationMs) * 100);

      if (!isDataReady && targetPercent >= 95) {
        setProgress(95);
      } else {
        setProgress(targetPercent);
      }

      if (elapsed < durationMs || (!isDataReady && elapsed >= durationMs)) {
        animationFrameId = requestAnimationFrame(animateProgress);
      } else {
        setProgress(100);
      }
    };

    animationFrameId = requestAnimationFrame(animateProgress);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [durationMs, isDataReady]);

  useEffect(() => {
    if (progress >= 100 && isDataReady && !onCompleteCalledRef.current) {
      onCompleteCalledRef.current = true;
      const timer = setTimeout(() => {
        onComplete?.();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [progress, isDataReady, onComplete]);

  // Generate a steady matrix of finance icons for the background grid
  const gridCells = Array.from({ length: 48 }, (_, i) => {
    const IconComponent = FINANCE_ICONS[i % FINANCE_ICONS.length];
    return {
      id: `splash-bg-cell-${i}`,
      Icon: IconComponent,
      delay: (i % 8) * 0.03 + Math.floor(i / 8) * 0.04
    };
  });

  return (
    <AnimatePresence>
      <motion.div
        id="stands-splash-screen"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-colors duration-300 select-none overflow-hidden ${
          darkMode ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"
        }`}
      >
        {/* Background Grid Patterns of Finance Icons */}
        <div 
          className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="w-[140vw] h-[140vh] grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-3 sm:gap-4 p-4 transform -rotate-6 scale-105 opacity-80">
            {gridCells.map(({ id, Icon, delay }, idx) => (
              <motion.div
                key={id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: delay * 0.4, duration: 0.6 }}
                className={`flex items-center justify-center p-3.5 sm:p-4 rounded-2xl border transition-colors ${
                  darkMode
                    ? "bg-slate-900/30 border-slate-800/40 text-slate-500/25"
                    : "bg-white/40 border-slate-200/60 text-slate-400/30 shadow-xs"
                }`}
              >
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.5]" />
              </motion.div>
            ))}
          </div>

          {/* Radial Gradient Vignette so the center branding remains crisp and high-contrast */}
          <div 
            className={`absolute inset-0 pointer-events-none ${
              darkMode
                ? "bg-[radial-gradient(ellipse_at_center,rgba(2,6,23,0.85)_0%,rgba(2,6,23,0.5)_45%,rgba(2,6,23,0.92)_100%)]"
                : "bg-[radial-gradient(ellipse_at_center,rgba(248,250,252,0.88)_0%,rgba(248,250,252,0.5)_45%,rgba(248,250,252,0.94)_100%)]"
            }`}
          />
        </div>

        {/* Foreground Content */}
        <div className="relative z-10 flex flex-col items-center justify-center max-w-sm w-full px-8 text-center">
          {/* Animated Logo Intro */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 220,
              damping: 20,
              duration: 0.7,
            }}
            className={`w-24 h-24 rounded-3xl p-3.5 mb-6 flex items-center justify-center shadow-2xl transition-all ${
              darkMode
                ? "bg-slate-900/90 border border-slate-800 shadow-sky-950/20"
                : "bg-white border border-slate-200 shadow-slate-300/40"
            }`}
          >
            <img
              src="/pcea.svg"
              alt="PCEA Logo"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </motion.div>

          {/* Text Branding */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="mb-8"
          >
            <h1
              className={`text-2xl sm:text-3xl font-black uppercase tracking-wider ${
                darkMode ? "text-white" : "text-slate-900"
              }`}
            >
              STANDS FINANCE
            </h1>
          </motion.div>

          {/* 2-Second Progress Bar */}
          <motion.div
            initial={{ opacity: 0, width: "80%" }}
            animate={{ opacity: 1, width: "100%" }}
            transition={{ delay: 0.25, duration: 0.3 }}
            className="w-full max-w-[240px]"
          >
            <div
              className={`w-full h-2 rounded-full overflow-hidden transition-colors ${
                darkMode ? "bg-slate-800" : "bg-slate-200"
              }`}
            >
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-75 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SplashPage;
