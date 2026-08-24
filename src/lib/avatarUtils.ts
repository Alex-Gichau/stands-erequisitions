/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Palette definitions for deterministic avatar colors
 */
export const AVATAR_PALETTES = [
  { bg: "bg-indigo-600", from: "#4F46E5", to: "#7C3AED", text: "#FFFFFF", name: "Indigo Violet" },
  { bg: "bg-emerald-600", from: "#059669", to: "#0D9488", text: "#FFFFFF", name: "Emerald Teal" },
  { bg: "bg-rose-600", from: "#E11D48", to: "#DB2777", text: "#FFFFFF", name: "Rose Pink" },
  { bg: "bg-amber-600", from: "#D97706", to: "#EA580C", text: "#FFFFFF", name: "Amber Orange" },
  { bg: "bg-sky-600", from: "#0284C7", to: "#2563EB", text: "#FFFFFF", name: "Sky Blue" },
  { bg: "bg-purple-600", from: "#7E22CE", to: "#9333EA", text: "#FFFFFF", name: "Purple" },
  { bg: "bg-teal-600", from: "#0D9488", to: "#059669", text: "#FFFFFF", name: "Teal" },
  { bg: "bg-cyan-600", from: "#0891B2", to: "#0284C7", text: "#FFFFFF", name: "Cyan" },
  { bg: "bg-violet-600", from: "#6D28D9", to: "#4F46E5", text: "#FFFFFF", name: "Violet" },
  { bg: "bg-pink-600", from: "#DB2777", to: "#E11D48", text: "#FFFFFF", name: "Pink" },
  { bg: "bg-blue-600", from: "#2563EB", to: "#1D4ED8", text: "#FFFFFF", name: "Blue" },
  { bg: "bg-slate-700", from: "#334155", to: "#1E293B", text: "#FFFFFF", name: "Slate" },
];

/**
 * Curated preset avatars for quick selection
 */
export const PRESET_AVATARS = [
  // Colorful geometric & church themed avatars
  { id: "preset-church-1", name: "Cross Emblem Blue", url: "data:image/svg+xml;utf8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" fill="none">
      <circle cx="64" cy="64" r="64" fill="url(#grad1)"/>
      <path d="M64 24V104M40 48H88" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <defs>
        <linearGradient id="grad1" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop stop-color="#1E3A8A"/>
          <stop offset="1" stop-color="#3B82F6"/>
        </linearGradient>
      </defs>
    </svg>
  `) },
  { id: "preset-church-2", name: "Cross Emblem Gold", url: "data:image/svg+xml;utf8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" fill="none">
      <circle cx="64" cy="64" r="64" fill="url(#grad2)"/>
      <path d="M64 24V104M40 48H88" stroke="#FEF3C7" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <defs>
        <linearGradient id="grad2" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop stop-color="#B45309"/>
          <stop offset="1" stop-color="#F59E0B"/>
        </linearGradient>
      </defs>
    </svg>
  `) },
  { id: "preset-church-3", name: "Dove Peace Green", url: "data:image/svg+xml;utf8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" fill="none">
      <circle cx="64" cy="64" r="64" fill="url(#grad3)"/>
      <path d="M40 76C44 64 56 52 72 52C88 52 96 68 84 80C72 92 56 88 40 76Z" fill="white"/>
      <path d="M72 52C68 40 56 36 48 40C44 42 42 46 44 50C48 58 60 64 72 52Z" fill="#D1FAE5"/>
      <circle cx="80" cy="60" r="3" fill="#047857"/>
      <defs>
        <linearGradient id="grad3" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop stop-color="#065F46"/>
          <stop offset="1" stop-color="#10B981"/>
        </linearGradient>
      </defs>
    </svg>
  `) },
  { id: "preset-user-1", name: "Executive Navy", url: "data:image/svg+xml;utf8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" fill="none">
      <circle cx="64" cy="64" r="64" fill="#0F172A"/>
      <circle cx="64" cy="50" r="22" fill="#E2E8F0"/>
      <path d="M28 108C28 88 44 76 64 76C84 76 100 88 100 108" fill="#38BDF8"/>
    </svg>
  `) },
  { id: "preset-user-2", name: "Ministry Purple", url: "data:image/svg+xml;utf8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" fill="none">
      <circle cx="64" cy="64" r="64" fill="url(#grad4)"/>
      <circle cx="64" cy="50" r="22" fill="#FDF4FF"/>
      <path d="M28 108C28 88 44 76 64 76C84 76 100 88 100 108" fill="#F472B6"/>
      <defs>
        <linearGradient id="grad4" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop stop-color="#581C87"/>
          <stop offset="1" stop-color="#9333EA"/>
        </linearGradient>
      </defs>
    </svg>
  `) },
  { id: "preset-user-3", name: "Finance Crimson", url: "data:image/svg+xml;utf8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" fill="none">
      <circle cx="64" cy="64" r="64" fill="url(#grad5)"/>
      <circle cx="64" cy="50" r="22" fill="#FFF1F2"/>
      <path d="M28 108C28 88 44 76 64 76C84 76 100 88 100 108" fill="#FDA4AF"/>
      <defs>
        <linearGradient id="grad5" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop stop-color="#881337"/>
          <stop offset="1" stop-color="#E11D48"/>
        </linearGradient>
      </defs>
    </svg>
  `) }
];

/**
 * Hash string to pick a deterministic palette
 */
export function getAvatarPalette(identifier: string = ""): typeof AVATAR_PALETTES[0] {
  if (!identifier) return AVATAR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

/**
 * Extract clean 1-2 letter initials from a name or email
 */
export function getInitials(nameOrEmail: string = ""): string {
  if (!nameOrEmail) return "U";

  let clean = nameOrEmail.trim();

  // If email, grab the part before @
  if (clean.includes("@")) {
    const beforeAt = clean.split("@")[0];
    const parts = beforeAt.split(/[._-]/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (beforeAt[0] || "U").toUpperCase();
  }

  // Split name by spaces
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  if (words.length === 1 && words[0].length >= 2) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0]?.[0] || clean[0] || "U").toUpperCase();
}

/**
 * Generate a dynamic standalone SVG initial avatar as a Data URI
 */
export function generateInitialAvatarSvg(
  nameOrEmail: string = "User",
  size = 128
): string {
  const initials = getInitials(nameOrEmail);
  const palette = getAvatarPalette(nameOrEmail);
  const fontSize = initials.length === 1 ? Math.round(size * 0.48) : Math.round(size * 0.40);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
  <defs>
    <linearGradient id="avatarGrad_${encodeURIComponent(nameOrEmail.slice(0, 10))}" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop stop-color="${palette.from}"/>
      <stop offset="1" stop-color="${palette.to}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size / 2}" fill="url(#avatarGrad_${encodeURIComponent(nameOrEmail.slice(0, 10))} )"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="${fontSize}" font-weight="800" fill="${palette.text}" letter-spacing="0.02em">
    ${initials}
  </text>
</svg>`.trim();

  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

/**
 * Extract the best available photo URL from a user object or string,
 * or return an initial SVG if none is available.
 */
export function resolveUserAvatarUrl(
  userOrUrl: any,
  fallbackName?: string
): { url: string; hasCustomPhoto: boolean; initials: string; palette: typeof AVATAR_PALETTES[0] } {
  let photo = "";
  let name = fallbackName || "";

  let userEmail = "";
  if (typeof userOrUrl === "string") {
    photo = userOrUrl.trim();
    if (photo.includes("@")) userEmail = photo.toLowerCase();
  } else if (userOrUrl && typeof userOrUrl === "object") {
    photo = (
      userOrUrl.photoURL ||
      userOrUrl.profilePicUrl ||
      userOrUrl.avatarUrl ||
      userOrUrl.photo_url ||
      userOrUrl.userAvatar ||
      userOrUrl.avatar ||
      ""
    ).trim();

    userEmail = (userOrUrl.email || "").toLowerCase().trim();
    name = userOrUrl.name || userOrUrl.displayName || userOrUrl.email || fallbackName || "User";
  }

  if (!userEmail && fallbackName && fallbackName.includes("@")) {
    userEmail = fallbackName.toLowerCase().trim();
  }

  // If no custom photo URL is present, but we have a Google/Gmail login email, fetch Google avatar
  if (!photo && userEmail && (userEmail.endsWith("@gmail.com") || userEmail.includes("google"))) {
    photo = `https://unavatar.io/google/${userEmail}`;
  }

  const initials = getInitials(name || photo || "User");
  const palette = getAvatarPalette(name || photo || "User");

  // Validate photo URL
  if (
    photo &&
    (photo.startsWith("http://") ||
      photo.startsWith("https://") ||
      photo.startsWith("data:image/") ||
      photo.startsWith("blob:") ||
      photo.startsWith("/uploads/") ||
      photo.startsWith("uploads/"))
  ) {
    const cleanUrl = photo.startsWith("uploads/") ? `/${photo}` : photo;
    return {
      url: cleanUrl,
      hasCustomPhoto: true,
      initials,
      palette,
    };
  }

  return {
    url: generateInitialAvatarSvg(name || "User"),
    hasCustomPhoto: false,
    initials,
    palette,
  };
}
