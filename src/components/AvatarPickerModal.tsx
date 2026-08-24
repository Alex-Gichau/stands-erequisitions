/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Upload, 
  Sparkles, 
  Check, 
  Trash2, 
  Camera, 
  Palette,
  Image as ImageIcon,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { PRESET_AVATARS, AVATAR_PALETTES, generateInitialAvatarSvg, getInitials } from "../lib/avatarUtils";
import { UserAvatar } from "./UserAvatar";
import { cn } from "../lib/utils";

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhotoURL?: string | null;
  userName?: string;
  userEmail?: string;
  onSave: (newPhotoURL: string) => Promise<void> | void;
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  isOpen,
  onClose,
  currentPhotoURL,
  userName = "User",
  userEmail = "",
  onSave,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string>(currentPhotoURL || "");
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"upload" | "presets" | "initials">("upload");
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setUploadError(null);
    if (!file) return;

    // Check size limit (max 4MB)
    if (file.size > 4 * 1024 * 1024) {
      setUploadError("Image size exceeds 4MB. Please choose a smaller image.");
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload a valid image file (PNG, JPG, WEBP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setSelectedPhoto(result);
      }
    };
    reader.onerror = () => {
      setUploadError("Failed to read file.");
    };
    reader.readAsDataURL(file);
  };

  const handleCustomInitialSelect = (paletteIndex: number) => {
    setSelectedPaletteIndex(paletteIndex);
    const pal = AVATAR_PALETTES[paletteIndex];
    const initials = getInitials(userName || userEmail || "User");
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" fill="none">
  <defs>
    <linearGradient id="palGrad" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
      <stop stop-color="${pal.from}"/>
      <stop offset="1" stop-color="${pal.to}"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="64" fill="url(#palGrad)"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="48" font-weight="800" fill="${pal.text}">
    ${initials}
  </text>
</svg>`.trim();
    setSelectedPhoto("data:image/svg+xml;utf8," + encodeURIComponent(svg));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(selectedPhoto);
      onClose();
    } catch (err: any) {
      setUploadError(err.message || "Failed to update profile picture.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    setSelectedPhoto("");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Camera size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Update Profile Picture
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  {userName} ({userEmail || "User Account"})
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Live Preview Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <UserAvatar
                  src={selectedPhoto}
                  name={userName}
                  email={userEmail}
                  size="2xl"
                  ring="ring-4 ring-indigo-500/20"
                />
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wide">
                    Live Preview
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedPhoto
                      ? selectedPhoto.startsWith("data:image/svg")
                        ? "Generated Vector Avatar"
                        : "Custom Uploaded Photo"
                      : "Default Initial Avatar"}
                  </p>
                </div>
              </div>

              {selectedPhoto && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-3 py-1.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/40 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={12} />
                  Reset to Default
                </button>
              )}
            </div>

            {uploadError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-medium border border-rose-200 dark:border-rose-900/50">
                {uploadError}
              </div>
            )}

            {/* Selection Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className={cn(
                  "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
                  activeTab === "upload"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <Upload size={12} />
                Upload Photo
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("presets")}
                className={cn(
                  "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
                  activeTab === "presets"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <Sparkles size={12} />
                Preset Emblems
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("initials")}
                className={cn(
                  "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
                  activeTab === "initials"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                <Palette size={12} />
                Gradient Colors
              </button>
            </div>

            {/* Tab 1: Upload Photo */}
            {activeTab === "upload" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 p-8 rounded-2xl flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all bg-slate-50/50 dark:bg-slate-950/20 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload size={22} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-800 dark:text-slate-200">
                      Click to choose image file
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Supports JPG, PNG, WEBP (Max 4MB)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Preset Emblems */}
            {activeTab === "presets" && (
              <div className="grid grid-cols-3 gap-3 animate-in fade-in duration-200">
                {PRESET_AVATARS.map((preset) => {
                  const isSelected = selectedPhoto === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPhoto(preset.url)}
                      className={cn(
                        "p-3 rounded-2xl border text-center flex flex-col items-center gap-2 transition-all relative group",
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-xs"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                      )}
                    >
                      <img
                        src={preset.url}
                        alt={preset.name}
                        className="w-12 h-12 rounded-full object-cover shadow-2xs group-hover:scale-105 transition-transform"
                      />
                      <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-full">
                        {preset.name}
                      </span>
                      {isSelected && (
                        <div className="absolute top-2 right-2 p-0.5 bg-indigo-600 text-white rounded-full">
                          <Check size={10} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tab 3: Custom Gradient Color Initial Avatars */}
            {activeTab === "initials" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Select a color theme for your initials
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {AVATAR_PALETTES.map((pal, idx) => {
                    const initials = getInitials(userName || userEmail || "User");
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleCustomInitialSelect(idx)}
                        className={cn(
                          "aspect-square rounded-2xl flex items-center justify-center font-black text-sm uppercase text-white shadow-2xs transition-all hover:scale-105 relative",
                          pal.bg
                        )}
                        style={{
                          background: `linear-gradient(135deg, ${pal.from}, ${pal.to})`,
                        }}
                        title={pal.name}
                      >
                        {initials}
                        {selectedPaletteIndex === idx && selectedPhoto.startsWith("data:image/svg") && (
                          <div className="absolute top-1 right-1 p-0.5 bg-white text-slate-900 rounded-full shadow-xs">
                            <Check size={8} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary px-5 py-2 text-xs font-black uppercase tracking-wider rounded-xl shadow-md flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Apply Profile Picture</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
