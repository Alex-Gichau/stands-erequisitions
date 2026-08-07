/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { X, Maximize2, ExternalLink, Download, ZoomIn, ZoomOut, RotateCw, RotateCcw, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, normalizeAttachmentUrl, getAttachmentFileName, handleImageError } from "../lib/utils";
import { CachedImage } from "./CachedImage";
import { preloadMediaBatch } from "../lib/mediaCache";

interface ReceiptGalleryProps {
  receipts: string[];
  requisitionTitle?: string;
  groupName?: string;
}

export const ReceiptGallery: React.FC<ReceiptGalleryProps> = ({ receipts, requisitionTitle, groupName }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (receipts && receipts.length > 0) {
      preloadMediaBatch(receipts);
    }
  }, [receipts]);

  if (!receipts || receipts.length === 0) return null;

  const getDownloadName = (index: number) => {
    const sanitize = (str: string) =>
      (str || "")
        .trim()
        .replace(/[^a-zA-Z0-9_\-\s]/g, "")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_");

    if (groupName || requisitionTitle) {
      const group = sanitize(groupName || "") || "Group";
      const title = sanitize(requisitionTitle || "") || "Requisition";
      return `Receipt_${group}_${title}_${index + 1}.png`;
    }
    return `Receipt_${index + 1}.png`;
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openImage = (url: string) => {
    setSelectedImage(url);
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || zoom <= 1) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (zoom <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || zoom <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setOffset({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
          Attached Receipts ({receipts.length})
        </label>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
        {receipts.map((receipt, index) => {
          const normalizedReceipt = normalizeAttachmentUrl(receipt);
          const fileName = getAttachmentFileName(receipt);
          return (
            <motion.div
              key={`receipt-item-${index}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => openImage(normalizedReceipt)}
              className="relative aspect-[4/3] sm:aspect-square w-full bg-slate-100 dark:bg-slate-800/80 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-700/80 cursor-pointer group shadow-sm hover:shadow-md hover:border-primary/50 transition-all flex flex-col justify-between"
            >
              <CachedImage 
                src={normalizedReceipt} 
                alt={fileName || `Receipt ${index + 1}`} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              
              {/* Type Badge */}
              <div className="absolute top-2 left-2 z-10">
                <span className="px-2 py-0.5 bg-slate-900/80 backdrop-blur-md text-white text-[8px] font-black uppercase tracking-wider rounded-lg border border-white/10 shadow-sm">
                  RECEIPT #{index + 1}
                </span>
              </div>

              {/* Action Buttons Overlay */}
              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    openImage(normalizedReceipt);
                  }}
                  className="p-2.5 bg-white text-slate-900 rounded-xl shadow-lg hover:bg-slate-100 transition-transform active:scale-95 flex items-center gap-1 text-[10px] font-bold"
                  title="Expand & Inspect"
                >
                  <Maximize2 size={14} />
                  <span>View</span>
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadImage(normalizedReceipt, getDownloadName(index));
                  }}
                  className="p-2.5 bg-slate-900/90 text-white border border-white/20 rounded-xl shadow-lg hover:bg-slate-800 transition-transform active:scale-95 flex items-center gap-1 text-[10px] font-bold"
                  title="Download File"
                >
                  <Download size={14} />
                </button>
              </div>

              {/* Bottom Title Bar */}
              <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent">
                <div className="text-[9px] font-bold text-white truncate drop-shadow-sm">
                  {fileName || `Receipt_${index + 1}.png`}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-10 p-0 bg-slate-900/95 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-5xl w-full h-[85vh] sm:h-full flex flex-col items-center justify-center p-4 sm:p-10"
            >
              <div className="absolute top-4 right-4 z-30 flex gap-2">
                <button 
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = selectedImage;
                    link.download = getDownloadName(0);
                    link.click();
                  }}
                  className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all border border-white/10"
                  title="Download Receipt"
                >
                  <Download size={20} />
                </button>
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all border border-white/10"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div 
                className={cn(
                  "w-full h-full flex items-center justify-center overflow-hidden md:rounded-3xl border border-white/10 bg-slate-950 shadow-2xl relative select-none",
                  zoom > 1 ? "cursor-grab" : "cursor-default",
                  isDragging && "cursor-grabbing"
                )}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleMouseUp}
              >
                <CachedImage 
                  src={selectedImage} 
                  alt="Full Receipt" 
                  className="max-w-[90%] max-h-[90%] object-contain shadow-2xl pointer-events-none transition-transform duration-100 ease-out"
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  }}
                />

                {/* Controls overlay */}
                <div 
                  className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md rounded-2xl px-4 py-2 flex items-center gap-3 sm:gap-4 border border-white/10 shadow-lg z-20"
                  onMouseDown={(e) => e.stopPropagation()} // Prevent dragging behavior on clicking controls
                >
                  <button
                    onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                    className="p-1.5 hover:bg-white/10 text-white rounded-lg transition-colors cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <span className="text-[10px] sm:text-xs font-mono text-white/90 font-bold min-w-[36px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom(prev => Math.min(4, prev + 0.25))}
                    className="p-1.5 hover:bg-white/10 text-white rounded-lg transition-colors cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn size={16} />
                  </button>
                  
                  <div className="w-px h-4 bg-white/10" />

                  <button
                    onClick={() => setRotation(prev => (prev - 90) % 360)}
                    className="p-1.5 hover:bg-white/10 text-white rounded-lg transition-colors cursor-pointer"
                    title="Rotate Counter-Clockwise"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    onClick={() => setRotation(prev => (prev + 90) % 360)}
                    className="p-1.5 hover:bg-white/10 text-white rounded-lg transition-colors cursor-pointer"
                    title="Rotate Clockwise"
                  >
                    <RotateCw size={16} />
                  </button>

                  <div className="w-px h-4 bg-white/10" />

                  <button
                    onClick={() => {
                      setZoom(1);
                      setRotation(0);
                      setOffset({ x: 0, y: 0 });
                    }}
                    className="p-1.5 hover:bg-white/10 text-white rounded-lg transition-colors cursor-pointer"
                    title="Reset View"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-4 text-white/50 text-[10px] font-black uppercase tracking-[0.2em]">
                <span>St Andrews Ledger System</span>
                <span className="w-1.5 h-1.5 bg-white/20 rounded-full" />
                <span>Encrypted Asset Viewer</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
