/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const CANONICAL_CHURCH_GROUPS = [
  "Youth Ministry",
  "Women's Guild",
  "Men's Fellowship (PCMF)",
  "Sunday School & Children",
  "Praise & Worship Team",
  "Health & Welfare Board",
  "Evangelism & Missions",
  "French Congregation",
  "Music Ministry",
  "Sanctuary Renovation",
  "ICT Ministry",
  "Deacons Board",
  "Security Committee",
  "Administration",
  "Pastoral Ministry",
  "Boys & Girls Brigade",
  "Finance Department",
  "District Fellowships"
] as const;

export type CanonicalChurchGroupName = typeof CANONICAL_CHURCH_GROUPS[number];

/**
 * Normalizes church group names while strictly preserving custom and admin-allocated church groups.
 */
export function canonicalizeGroupName(name?: string | null): string {
  if (!name || typeof name !== "string") return "";
  const clean = name.trim();
  const lower = clean.toLowerCase();

  // Strip legacy unassigned indicators
  if (lower === "independent" || lower === "unallocated" || lower === "no group" || lower === "none") {
    return "";
  }

  // Exact canonical match check (case-insensitive) - normalize to canonical casing if matched
  const exactMatch = CANONICAL_CHURCH_GROUPS.find(
    g => g.toLowerCase() === lower
  );
  if (exactMatch) return exactMatch;

  // Preserve admin-allocated custom church groups exactly as specified
  return clean;
}

/**
 * Resolves a sensible, deterministic default church group based on the user's role and email attributes.
 */
export function resolveDefaultChurchGroup(user: { email?: string; role?: string; name?: string }): string {
  const normEmail = (user.email || "").toLowerCase();
  const role = (user.role || "").toUpperCase();

  if (normEmail.includes("ict") || normEmail.includes("tech") || normEmail.includes("web") || normEmail.includes("media") || normEmail.includes("system")) {
    return "ICT Ministry";
  }
  if (normEmail.includes("music") || normEmail.includes("choir") || normEmail.includes("sing") || normEmail.includes("worship") || normEmail.includes("sound")) {
    return "Music Ministry";
  }
  if (normEmail.includes("treasurer") || normEmail.includes("finance") || normEmail.includes("account") || role === "FINANCE") {
    return "Finance Department";
  }
  if (normEmail.includes("youth") || normEmail.includes("teen") || normEmail.includes("campus")) {
    return "Youth Ministry";
  }
  if (normEmail.includes("guild") || normEmail.includes("women")) {
    return "Women's Guild";
  }
  if (normEmail.includes("men") || normEmail.includes("pcmf")) {
    return "Men's Fellowship (PCMF)";
  }
  if (normEmail.includes("school") || normEmail.includes("children") || normEmail.includes("kids")) {
    return "Sunday School & Children";
  }
  if (normEmail.includes("security") || normEmail.includes("guard")) {
    return "Security Committee";
  }
  if (normEmail.includes("deacon")) {
    return "Deacons Board";
  }
  if (normEmail.includes("brigade")) {
    return "Boys & Girls Brigade";
  }
  if (normEmail.includes("minister") || normEmail.includes("pastor") || normEmail.includes("rev") || role === "APPROVER_L1") {
    return "Pastoral Ministry";
  }
  if (normEmail.includes("clerk") || normEmail.includes("session") || role === "APPROVER_L2") {
    return "Administration";
  }
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return "Administration";
  }

  return "Youth Ministry";
}

/**
 * Enforces strict, zero-unallocated group allocation for a given user profile or raw database document.
 * Guarantees that:
 * 1. Admin/Super-Admin allocations are strictly PRESERVED and never overwritten.
 * 2. `group` is a non-empty ministry name.
 * 3. `groups` contains the user's allocated groups, with `group` included.
 */
export function enforceUserGroupAllocation(user: any): { group: string; groups: string[] } {
  if (!user) {
    return { group: "Youth Ministry", groups: ["Youth Ministry"] };
  }

  // Parse raw groups input
  let parsedGroups: string[] = [];
  const rawGroups = user.groups || user.church_groups || user.churchGroups;
  if (rawGroups) {
    if (Array.isArray(rawGroups)) {
      parsedGroups = rawGroups.map((g: any) => (typeof g === "string" ? g.trim() : String(g || "").trim())).filter(Boolean);
    } else if (typeof rawGroups === "string" && rawGroups.trim() !== "") {
      try {
        const parsed = JSON.parse(rawGroups);
        if (Array.isArray(parsed)) {
          parsedGroups = parsed.map((g: any) => String(g || "").trim()).filter(Boolean);
        } else {
          parsedGroups = [rawGroups.trim()];
        }
      } catch (e) {
        parsedGroups = rawGroups.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
    }
  }

  // Clean and filter groups in array
  let cleanGroups = parsedGroups
    .map(g => canonicalizeGroupName(g))
    .filter(Boolean);

  // Clean primary group
  let primaryGroup = canonicalizeGroupName(user.group || user.church_group || user.churchGroup);

  // If user already has an allocated primary group or groups, STRICTLY PRESERVE THEM!
  if (primaryGroup || cleanGroups.length > 0) {
    if (!primaryGroup && cleanGroups.length > 0) {
      primaryGroup = cleanGroups[0];
    }
    if (primaryGroup && !cleanGroups.includes(primaryGroup)) {
      cleanGroups = [primaryGroup, ...cleanGroups];
    }
    return {
      group: primaryGroup || cleanGroups[0],
      groups: cleanGroups.length > 0 ? cleanGroups : [primaryGroup]
    };
  }

  // Only if completely missing: determine a smart default
  const defaultGroup = resolveDefaultChurchGroup(user);
  return {
    group: defaultGroup,
    groups: [defaultGroup]
  };
}
