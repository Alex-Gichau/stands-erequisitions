/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { getAvatarPalette, getInitials, resolveUserAvatarUrl } from "../lib/avatarUtils";

export interface UserAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  user?: any;
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | number;
  showStatus?: boolean;
  isOnline?: boolean;
  ring?: boolean | string;
  rounded?: "full" | "xl" | "2xl" | "lg" | "md";
  alt?: string;
  imgClassName?: string;
}

const SIZE_MAP = {
  "2xs": { container: "w-4 h-4 min-w-[16px] min-h-[16px] text-[8px]", dot: "w-1.5 h-1.5 -bottom-0.5 -right-0.5" },
  xs: { container: "w-5 h-5 min-w-[20px] min-h-[20px] text-[9px]", dot: "w-1.5 h-1.5 -bottom-0.5 -right-0.5" },
  sm: { container: "w-7 h-7 min-w-[28px] min-h-[28px] text-[10px]", dot: "w-2 h-2 -bottom-0.5 -right-0.5" },
  md: { container: "w-8 h-8 min-w-[32px] min-h-[32px] text-xs", dot: "w-2.5 h-2.5 bottom-0 right-0" },
  lg: { container: "w-10 h-10 min-w-[40px] min-h-[40px] text-sm", dot: "w-2.5 h-2.5 bottom-0 right-0" },
  xl: { container: "w-12 h-12 min-w-[48px] min-h-[48px] text-base", dot: "w-3 h-3 bottom-0 right-0" },
  "2xl": { container: "w-16 h-16 min-w-[64px] min-h-[64px] text-xl", dot: "w-3.5 h-3.5 bottom-0.5 right-0.5" },
  "3xl": { container: "w-24 h-24 min-w-[96px] min-h-[96px] text-2xl", dot: "w-4 h-4 bottom-1 right-1" },
};

const ROUNDED_MAP = {
  full: "rounded-full",
  "2xl": "rounded-2xl",
  xl: "rounded-xl",
  lg: "rounded-lg",
  md: "rounded-md",
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  src,
  name,
  email,
  size = "md",
  showStatus = false,
  isOnline = false,
  ring = false,
  rounded = "full",
  alt,
  className = "",
  imgClassName = "",
  title,
  ...props
}) => {
  // Extract identifier and photo
  const resolvedName = name || user?.name || user?.displayName || "";
  const resolvedEmail = email || user?.email || "";
  const directSrc = src !== undefined ? src : (user?.photoURL || user?.profilePicUrl || user?.avatarUrl || user?.photo_url || user?.userAvatar || "");
  const identifier = resolvedName || resolvedEmail || "User";

  const { url, hasCustomPhoto, initials, palette } = resolveUserAvatarUrl(
    directSrc || user,
    resolvedName || resolvedEmail
  );

  const [imageError, setImageError] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState(directSrc || url);

  useEffect(() => {
    setImageError(false);
    setLoadedSrc(directSrc || url);
  }, [directSrc, url]);

  const sizeClass = typeof size === "string" ? SIZE_MAP[size]?.container || SIZE_MAP.md.container : "";
  const dotSizeClass = typeof size === "string" ? SIZE_MAP[size]?.dot || SIZE_MAP.md.dot : "w-2 h-2 bottom-0 right-0";
  const roundedClass = ROUNDED_MAP[rounded] || "rounded-full";

  const ringClass = ring === true
    ? "ring-2 ring-white dark:ring-slate-900 shadow-2xs"
    : typeof ring === "string"
    ? ring
    : "";

  const customStyle: React.CSSProperties = typeof size === "number" ? { width: size, height: size, minWidth: size, minHeight: size } : {};

  const displayInitials = initials || getInitials(identifier);
  const shouldRenderImage = hasCustomPhoto && !imageError && loadedSrc && loadedSrc.trim().length > 0;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center shrink-0 select-none overflow-visible",
        className
      )}
      style={customStyle}
      title={title || resolvedName || resolvedEmail || "User Profile"}
      {...props}
    >
      <div
        className={cn(
          "w-full h-full flex items-center justify-center font-black uppercase overflow-hidden transition-transform",
          sizeClass,
          roundedClass,
          ringClass
        )}
        style={{
          background: shouldRenderImage
            ? "transparent"
            : `linear-gradient(135deg, ${palette.from}, ${palette.to})`,
          color: palette.text,
        }}
      >
        {shouldRenderImage ? (
          <img
            src={loadedSrc}
            alt={alt || resolvedName || "Avatar"}
            className={cn("w-full h-full object-cover", roundedClass, imgClassName)}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => {
              // Gracefully fall back to vector gradient initials
              setImageError(true);
            }}
          />
        ) : (
          <span className="leading-none tracking-wider font-extrabold">
            {displayInitials}
          </span>
        )}
      </div>

      {/* Online / Active Status Badge */}
      {showStatus && (
        <span
          className={cn(
            "absolute rounded-full ring-2 ring-white dark:ring-slate-900",
            dotSizeClass,
            isOnline ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
          )}
        >
          {isOnline && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
        </span>
      )}
    </div>
  );
};
