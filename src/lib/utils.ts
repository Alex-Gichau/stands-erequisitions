import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { RequisitionStatus } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DEFAULT_IMAGE_PLACEHOLDER = "data:image/svg+xml;utf8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300" fill="none">
  <rect width="400" height="300" fill="#0F172A"/>
  <rect x="2" y="2" width="396" height="296" rx="8" stroke="#334155" stroke-width="2" stroke-dasharray="6 6"/>
  <circle cx="200" cy="115" r="32" fill="#1E293B"/>
  <path d="M188 125L196 107L204 120L212 112L220 125H188Z" fill="#64748B"/>
  <circle cx="212" cy="102" r="4.5" fill="#94A3B8"/>
  <text x="200" y="185" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#94A3B8" letter-spacing="0.05em">IMAGE UNAVAILABLE</text>
  <text x="200" y="208" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#64748B">Unable to load image from server</text>
</svg>
`);

export function handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>, fallbackUrl: string = DEFAULT_IMAGE_PLACEHOLDER) {
  const target = e.currentTarget;
  if (target && target.src !== fallbackUrl) {
    target.onerror = null;
    target.src = fallbackUrl;
  }
}

export function unwrapAttachmentTarget(val: any, depth = 0): { url?: string; name?: string; rawString?: string } {
  if (depth > 15 || val === null || val === undefined) {
    return {};
  }

  if (typeof val === "string") {
    let trimmed = val.trim();

    // Clean leading/trailing escaped quotes if wrapped
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 1) {
      try {
        const unquoted = JSON.parse(trimmed);
        if (typeof unquoted === "string") {
          return unwrapAttachmentTarget(unquoted, depth + 1);
        }
      } catch (e) {}
    }

    // Try parsing JSON if it starts with { or [
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const parsed = JSON.parse(trimmed);
        return unwrapAttachmentTarget(parsed, depth + 1);
      } catch (e) {}
    }

    // Clean up leftover stringified JSON syntax wrapping filename::url
    if (trimmed.includes("::")) {
      const cleanStr = trimmed
        .replace(/^(\{\s*"\d+"\s*:\s*)+/, "")
        .replace(/(\}\s*)+$/, "")
        .replace(/^"/, "")
        .replace(/"$/, "")
        .trim();
      return { rawString: cleanStr };
    }

    return { rawString: trimmed };
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return {};
    return unwrapAttachmentTarget(val[0], depth + 1);
  }

  if (typeof val === "object") {
    const name = val.name || val.fileName || val.title;
    const directUrl = val.url || val.dataUrl || val.link || val.path;

    if (typeof directUrl === "string") {
      return { url: directUrl, name: typeof name === "string" ? name : undefined };
    }

    const keys = Object.keys(val);
    if (keys.length > 0) {
      const firstVal = val[keys[0]];
      const res = unwrapAttachmentTarget(firstVal, depth + 1);
      if (name && !res.name && typeof name === "string") {
        res.name = name;
      }
      return res;
    }
  }

  return { rawString: String(val) };
}

export function normalizeAttachmentUrl(url: any): string {
  if (!url) return "";

  const unwrapped = unwrapAttachmentTarget(url);
  let target = unwrapped.url || unwrapped.rawString || "";

  if (typeof target !== "string") return "";
  let trimmed = target.trim();

  // Strip `filename::` prefix if present
  if (trimmed.includes("::")) {
    const parts = trimmed.split("::");
    trimmed = parts.slice(1).join("::").trim();
  }

  // Clean trailing escaped quotes or braces if any
  trimmed = trimmed.replace(/["}\s]+$/, "").replace(/^["{\s]+/, "").trim();

  // Normalize absolute HTTP/HTTPS URLs containing /uploads/ or /api/attachments/ to relative path
  if (trimmed.includes("/uploads/")) {
    const parts = trimmed.split("/uploads/");
    return "/uploads/" + parts[1];
  }
  if (trimmed.includes("/api/attachments/")) {
    const parts = trimmed.split("/api/attachments/");
    return "/api/attachments/" + parts[1];
  }

  // If starts with uploads/ without leading slash
  if (trimmed.startsWith("uploads/")) {
    return "/" + trimmed;
  }

  return trimmed;
}

export function getAbsoluteAttachmentUrl(url: any): string {
  if (!url) return "";
  const normalized = normalizeAttachmentUrl(url);
  if (!normalized) return "";

  if (normalized.startsWith("http://") || normalized.startsWith("https://") || normalized.startsWith("data:") || normalized.startsWith("blob:")) {
    return normalized;
  }

  if (normalized.startsWith("/")) {
    return normalized;
  }

  return `/${normalized}`;
}

export function getAttachmentFileName(doc: any): string {
  if (!doc) return "Attachment";

  const unwrapped = unwrapAttachmentTarget(doc);
  if (unwrapped.name) {
    return unwrapped.name.replace(/["}\s]+$/, "").replace(/^["{\s]+/, "").trim();
  }

  let raw = unwrapped.rawString || unwrapped.url || "";
  if (!raw) return "Attachment";

  // Check if formatted as `filename::url`
  if (raw.includes("::")) {
    const filename = raw.split("::")[0].trim().replace(/^(\{\s*"\d+"\s*:\s*)+/, "").replace(/^"/, "").trim();
    if (filename && !filename.startsWith("data:") && !filename.startsWith("http") && !filename.startsWith("{")) {
      return filename;
    }
  }

  // Extract from URL or data URL
  if (raw.startsWith("http") || raw.startsWith("/") || raw.startsWith("data:")) {
    const urlParts = raw.split("/");
    const lastPart = urlParts[urlParts.length - 1];
    if (lastPart && lastPart.includes(".") && !lastPart.includes(";")) {
      return lastPart.split("?")[0].split("#")[0].replace(/["}\s]+$/, "").trim();
    }
    if (raw.startsWith("data:image/jpeg")) return "image.jpeg";
    if (raw.startsWith("data:image/png")) return "image.png";
    if (raw.startsWith("data:image/webp")) return "image.webp";
    if (raw.startsWith("data:application/pdf")) return "document.pdf";
  }

  const cleaned = raw.replace(/^(\{\s*"\d+"\s*:\s*)+/, "").replace(/(\}\s*)+$/, "").replace(/^"/, "").replace(/"$/, "").trim();
  return cleaned || "Attachment";
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
  }).format(amount);
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi"
  });
}

export function isFinalStage(status?: RequisitionStatus | string): boolean {
  if (!status) return false;
  const s = String(status).toUpperCase();
  return (
    s === RequisitionStatus.DISBURSED ||
    s === RequisitionStatus.REJECTED ||
    s === RequisitionStatus.CANCELLED ||
    s === "DISBURSED" ||
    s === "REJECTED" ||
    s === "CANCELLED"
  );
}

export function formatRequisitionAge(
  submittedAt: string | undefined,
  status?: RequisitionStatus | string,
  options?: { compact?: boolean }
): string | null {
  if (isFinalStage(status)) {
    return null;
  }
  if (!submittedAt) return null;

  const dateMs = new Date(submittedAt).getTime();
  if (isNaN(dateMs)) return null;

  const diffMs = Math.abs(Date.now() - dateMs);
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days > 30) {
    const months = Math.max(1, Math.floor(days / 30));
    const label = months === 1 ? "1 month" : `${months} months`;
    return options?.compact ? `${label} old` : `${label} old`;
  } else {
    const label = `${days} ${days === 1 ? "day" : "days"}`;
    return options?.compact ? `${days}d old` : `${label} old`;
  }
}

export function getDaysSinceSubmission(submittedAt: string) {
  if (!submittedAt) return 0;
  const diffTime = Math.abs(new Date().getTime() - new Date(submittedAt).getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export async function sendSlackNotification(params: {
  action: string;
  details: string;
  performedBy: string;
  level?: "normal" | "critical";
  metadata?: Record<string, any>;
}) {
  try {
    const response = await fetch("/api/notify-slack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...params,
        timestamp: new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }),
      }),
    });
    
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    } else {
      const text = await response.text();
      console.warn("Slack API returned non-JSON response:", text.substring(0, 100));
      return { success: true, simulated: true, warning: "Non-JSON response from server" };
    }
  } catch (error) {
    console.error("Slack notification failed:", error);
    return { error: "Failed to send notification" };
  }
}

export async function uploadAttachmentToLocalServer(att: string): Promise<string> {
  if (typeof att !== "string") return att;
  // Use data URIs directly for uploading and fetching of images and documents
  return att;
}

export async function uploadAttachmentsToLocalServer(
  attachments: string[],
  onProgress?: (completed: number, total: number, lastFile: string) => void
): Promise<string[]> {
  if (!attachments || attachments.length === 0) {
    if (onProgress) onProgress(0, 0, "");
    return [];
  }
  let completed = 0;
  const total = attachments.length;
  if (onProgress) {
    onProgress(0, total, "Initializing...");
  }
  return Promise.all(
    attachments.map(async (att) => {
      let fileName = "attachment";
      if (typeof att === "string" && att.includes("::")) {
        fileName = att.split("::")[0];
      }
      const res = await uploadAttachmentToLocalServer(att);
      completed++;
      if (onProgress) {
        onProgress(completed, total, fileName);
      }
      return res;
    })
  );
}
