/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Camera, X, RefreshCw, Check, RotateCcw, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [isFlashActive, setIsFlashActive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Start the video stream with a given or default device
  const startStream = async (deviceId?: string) => {
    setLoading(true);
    setError("");
    try {
      // Stop existing tracks first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId } } 
          : { facingMode: "environment" }, // Default to back camera for scanning docs
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Query devices to find alternatives
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoDevices);

      // Save selected device ID
      if (stream) {
        const activeVideoTrack = stream.getVideoTracks()[0];
        if (activeVideoTrack) {
          const settings = activeVideoTrack.getSettings();
          if (settings.deviceId) {
            setSelectedDeviceId(settings.deviceId);
          }
        }
      }
    } catch (err: any) {
      console.error("Camera capture error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Camera access was denied. Please check site permissions in your browser.");
      } else {
        setError("Could not access camera. Ensure it is connected and not in use by another application.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial stream start
  useEffect(() => {
    startStream();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Cycle/toggle cameras if more than one exists
  const handleToggleCamera = () => {
    if (devices.length <= 1) return;
    const currentIndex = devices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextDevice = devices[nextIndex];
    if (nextDevice) {
      setSelectedDeviceId(nextDevice.deviceId);
      startStream(nextDevice.deviceId);
    }
  };

  // Capture the current stream frame into a image state
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    // Play flash sound simulation effect
    setIsFlashActive(true);
    setTimeout(() => setIsFlashActive(false), 200);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match actual video track resolution
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Mirror if it is a user/front facing camera
      const tracks = streamRef.current?.getVideoTracks();
      const isFrontCamera = tracks && tracks[0] && tracks[0].getSettings().facingMode === "user";
      
      if (isFrontCamera) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get data URL representing PNG
      const dataUrl = canvas.toDataURL("image/png");
      setCapturedImage(dataUrl);
    }
  };

  // Confirm/Save the picture
  const handleConfirm = () => {
    if (!capturedImage) return;

    // Convert data URL base64 representation into a standard File
    fetch(capturedImage)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File(
          [blob], 
          `doc_scan_${Math.random().toString(36).substr(2, 5)}_${Date.now()}.png`, 
          { type: "image/png" }
        );
        onCapture(file);
        onClose();
      })
      .catch((err) => {
        console.error("Failed to generate file from image data:", err);
        setError("Error finalizing document representation.");
      });
  };

  // Retake photo/reset image state
  const handleRetake = () => {
    setCapturedImage(null);
    setError("");
    // Re-ensure stream is open
    if (!streamRef.current) {
      startStream(selectedDeviceId);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="text-primary w-5 h-5 animate-pulse" />
            <span className="text-xs font-black text-white uppercase tracking-[0.2em]">In-App Document Capture</span>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative bg-black aspect-[4/3] w-full flex items-center justify-center overflow-hidden group">
          {/* Live Video Feed */}
          {!capturedImage && !error && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover scale-x-100" // Normal facing orientation
            />
          )}

          {/* Captured Image Preview */}
          {capturedImage && (
            <img 
              src={capturedImage} 
              alt="Scan capture representation" 
              className="absolute inset-0 w-full h-full object-contain"
            />
          )}

          {/* Hidden Canvas used to generate image blob */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Camera Loading Overlay */}
          {loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <p className="text-[10px] font-black uppercase tracking-widest">Initializing camera sensor...</p>
            </div>
          )}

          {/* Camera Error Display Option */}
          {error && (
            <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center gap-3 bg-slate-950/90 text-slate-300">
              <AlertCircle className="w-10 h-10 text-rose-500 shrink-0" />
              <div>
                <p className="text-xs font-black text-white uppercase tracking-wider mb-2">Device Stream Failure</p>
                <p className="text-[11px] text-slate-400 max-w-sm leading-relaxed">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => startStream(selectedDeviceId)}
                className="mt-2 text-[10px] font-black uppercase tracking-widest text-primary hover:underline bg-primary/10 px-4 py-2 rounded-xl transition-all"
              >
                Retry Authorization
              </button>
            </div>
          )}

          {/* Flash Frame Feedback Overlay */}
          <AnimatePresence>
            {isFlashActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white z-20 pointer-events-none"
              />
            )}
          </AnimatePresence>

          {/* Camera Scanning Reticle Visual Overlay */}
          {!capturedImage && !error && !loading && (
            <div className="absolute inset-6 border border-white/20 rounded-2xl pointer-events-none flex flex-col justify-between p-4">
              <div className="flex justify-between">
                <div className="w-4 h-4 border-t-2 border-l-2 border-primary rounded-tl-md" />
                <div className="w-4 h-4 border-t-2 border-r-2 border-primary rounded-tr-md" />
              </div>
              <p className="text-center text-[8px] font-black tracking-widest uppercase text-white/40 select-none">
                Align Quotation or Document Frame
              </p>
              <div className="flex justify-between">
                <div className="w-4 h-4 border-b-2 border-l-2 border-primary rounded-bl-md" />
                <div className="w-4 h-4 border-b-2 border-r-2 border-primary rounded-br-md" />
              </div>
            </div>
          )}
        </div>

        {/* Footer / Controls Panel */}
        <div className="px-6 py-6 bg-slate-950 border-t border-slate-800 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            {/* Camera Selection Switch */}
            {devices.length > 1 && !capturedImage && !error && (
              <button
                type="button"
                onClick={handleToggleCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-black text-slate-300 hover:text-white hover:bg-slate-800 transition-colors uppercase tracking-wider"
              >
                <RefreshCw size={12} className="shrink-0" />
                <span>Switch Lens ({devices.length})</span>
              </button>
            )}
            <div className="grow" />
          </div>

          <div className="flex items-center justify-center gap-4">
            {!capturedImage ? (
              <button
                type="button"
                onClick={handleCapture}
                disabled={loading || !!error}
                className={cn(
                  "p-5 bg-primary hover:bg-primary/95 text-white rounded-full transition-all duration-300 shadow-xl shadow-primary/20 cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                )}
                title="Capture Document Photo"
              >
                <Camera size={26} />
              </button>
            ) : (
              <div className="flex items-center justify-center gap-4 w-full">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 border border-slate-800 bg-slate-900 text-slate-300 hover:text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer hover:bg-slate-800"
                >
                  <RotateCcw size={14} />
                  <span>Retake</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-emerald-950/20"
                >
                  <Check size={14} />
                  <span>Use Document</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
