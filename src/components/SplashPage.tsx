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
  durationMs = 3500,
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

      if (!isDataReady && targetPercent >= 96) {
        setProgress(96);
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
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [progress, isDataReady, onComplete]);

  // Generate a distinct, visible matrix of finance icon tiles
  const gridCells = Array.from({ length: 64 }, (_, i) => {
    const IconComponent = FINANCE_ICONS[i % FINANCE_ICONS.length];
    return {
      id: `splash-icon-cell-${i}`,
      Icon: IconComponent,
      delay: (i % 8) * 0.02 + Math.floor(i / 8) * 0.025
    };
  });

  return (
    <AnimatePresence>
      <motion.div
        id="stands-splash-screen"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 1.02 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none overflow-hidden ${
          darkMode ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"
        }`}
      >
        {/* High-Visibility Finance Icon Background Grid */}
        <div 
          className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="w-[150vw] h-[150vh] grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-3.5 sm:gap-4.5 p-6 transform -rotate-6 scale-105">
            {gridCells.map(({ id, Icon, delay }) => (
              <motion.div
                key={id}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: delay * 0.3, duration: 0.5, ease: "easeOut" }}
                className={`flex items-center justify-center p-3.5 sm:p-4 rounded-xl border transition-colors ${
                  darkMode
                    ? "bg-slate-900/60 border-slate-800/80 text-slate-400/50 shadow-xs"
                    : "bg-white/80 border-slate-200/90 text-slate-500/60 shadow-xs"
                }`}
              >
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.75]" />
              </motion.div>
            ))}
          </div>

          {/* Balanced Radial Vignette ensuring rich grid visibility while keeping center brand legible */}
          <div 
            className={`absolute inset-0 pointer-events-none ${
              darkMode
                ? "bg-[radial-gradient(ellipse_at_center,rgba(2,6,23,0.65)_0%,rgba(2,6,23,0.4)_40%,rgba(2,6,23,0.85)_100%)]"
                : "bg-[radial-gradient(ellipse_at_center,rgba(248,250,252,0.72)_0%,rgba(248,250,252,0.45)_40%,rgba(248,250,252,0.9)_100%)]"
            }`}
          />
        </div>

        {/* Foreground Content */}
        <div className="relative z-10 flex flex-col items-center justify-center max-w-sm w-full px-8 text-center">
          {/* Smooth Logo Entrance */}
          <motion.div
            initial={{ scale: 0.75, opacity: 0, y: 18 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{
              duration: 1.25,
              ease: [0.16, 1, 0.3, 1],
            }}
            className={`w-24 h-24 rounded-3xl p-3.5 mb-6 flex items-center justify-center shadow-2xl transition-all ${
              darkMode
                ? "bg-slate-900/95 border border-slate-800 shadow-black/50"
                : "bg-white border border-slate-200 shadow-slate-300/60"
            }`}
          >
            <img
              src="/pcea.svg"
              alt="PCEA Logo"
              className="w-full h-full object-contain drop-shadow-sm"
              referrerPolicy="no-referrer"
            />
          </motion.div>

          {/* Text Branding */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8"
          >
            <h1
              className={`text-2xl sm:text-3xl font-black uppercase tracking-wider ${
                darkMode ? "text-white" : "text-slate-900"
              }`}
            >
              STANDS FINANCE
            </h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1.5">
              E-REQUISITIONS
            </p>
          </motion.div>

          {/* Elegant Rounded Progress Bar */}
          <motion.div
            initial={{ opacity: 0, width: "80%" }}
            animate={{ opacity: 1, width: "100%" }}
            transition={{ delay: 0.25, duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-[240px]"
          >
            <div
              className={`w-full h-2 rounded-full overflow-hidden transition-colors border ${
                darkMode
                  ? "bg-slate-900 border-slate-800"
                  : "bg-slate-200 border-slate-300"
              }`}
            >
              <div
                className="h-full bg-blue-600 rounded-full transition-[width] duration-100 ease-linear"
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
