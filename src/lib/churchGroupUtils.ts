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
 * Normalizes any legacy, casing, or informal church group name into its canonical PCEA ministry title.
 */
export function canonicalizeGroupName(name?: string | null): string {
  if (!name || typeof name !== "string") return "";
  const clean = name.trim();
  const lower = clean.toLowerCase();

  // Strip legacy unassigned indicators
  if (lower === "independent" || lower === "unallocated" || lower === "no group" || lower === "none") {
    return "";
  }

  // Exact canonical match check
  const exactMatch = CANONICAL_CHURCH_GROUPS.find(
    g => g.toLowerCase() === lower
  );
  if (exactMatch) return exactMatch;

  // Keyword-based canonical matching
  if (lower.includes("ict") || lower.includes("information tech") || lower.includes("media team")) {
    return "ICT Ministry";
  }
  if (lower.includes("security")) {
    return "Security Committee";
  }
  if (lower.includes("pcmf") || lower.includes("men's") || lower.includes("mens") || lower.includes("men fellowship")) {
    return "Men's Fellowship (PCMF)";
  }
  if (lower.includes("deacon")) {
    return "Deacons Board";
  }
  if (lower.includes("brigade")) {
    return "Boys & Girls Brigade";
  }
  if (lower.includes("admin")) {
    return "Administration";
  }
  if (lower.includes("pastor") || lower.includes("rev") || lower.includes("clergy") || lower.includes("ministerial")) {
    return "Pastoral Ministry";
  }
  if (lower.includes("finance") || lower.includes("treasur") || lower.includes("accounts") || lower.includes("audit")) {
    return "Finance Department";
  }
  if (
    lower.includes("church school") ||
    lower.includes("sunday school") ||
    lower.includes("children") ||
    lower.includes("kids") ||
    lower.includes("teens church")
  ) {
    return "Sunday School & Children";
  }
  if (
    lower.includes("outreach") ||
    lower.includes("mission") ||
    lower.includes("evangelism") ||
    lower.includes("kileleshwa") ||
    lower.includes("missions commitee")
  ) {
    return "Evangelism & Missions";
  }
  if (
    lower.includes("instrument") ||
    lower.includes("choir") ||
    lower.includes("singers") ||
    lower.includes("music")
  ) {
    return "Music Ministry";
  }
  if (lower.includes("youth") || lower.includes("teens") || lower.includes("young adults")) {
    return "Youth Ministry";
  }
  if (lower.includes("district") || lower.includes("zone") || lower.includes("cell")) {
    return "District Fellowships";
  }
  if (lower.includes("welfare") || lower.includes("health") || lower.includes("benevolent")) {
    return "Health & Welfare Board";
  }
  if (lower.includes("guild") || lower.includes("women") || lower.includes("mother")) {
    return "Women's Guild";
  }
  if (lower.includes("praise") || lower.includes("worship")) {
    return "Praise & Worship Team";
  }
  if (lower.includes("sanctuary") || lower.includes("renovation") || lower.includes("development") || lower.includes("building")) {
    return "Sanctuary Renovation";
  }
  if (lower.includes("french")) {
    return "French Congregation";
  }

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
 * 1. `group` is a non-empty canonical ministry name.
 * 2. `groups` is an array of non-empty strings with at least `[group]`.
 * 3. `group` is always present in `groups`.
 */
export function enforceUserGroupAllocation(user: any): { group: string; groups: string[] } {
  if (!user) {
    return { group: "Youth Ministry", groups: ["Youth Ministry"] };
  }

  // Parse raw groups input
  let parsedGroups: string[] = [];
  const rawGroups = user.groups;
  if (rawGroups) {
    if (Array.isArray(rawGroups)) {
      parsedGroups = rawGroups.map((g: any) => (typeof g === "string" ? g : String(g || "")));
    } else if (typeof rawGroups === "string" && rawGroups.trim() !== "") {
      try {
        const parsed = JSON.parse(rawGroups);
        if (Array.isArray(parsed)) {
          parsedGroups = parsed.map((g: any) => String(g || ""));
        } else {
          parsedGroups = [rawGroups];
        }
      } catch (e) {
        parsedGroups = rawGroups.split(",").map((s: string) => s.trim());
      }
    }
  }

  // Canonicalize all groups in array
  let cleanGroups = parsedGroups
    .map(g => canonicalizeGroupName(g))
    .filter(Boolean);

  // Canonicalize primary group
  let primaryGroup = canonicalizeGroupName(user.group);

  // If primary group is missing, select first from cleanGroups or determine smart default
  if (!primaryGroup) {
    primaryGroup = cleanGroups[0] || resolveDefaultChurchGroup(user);
  }

  // Ensure cleanGroups has primaryGroup
  if (!cleanGroups.includes(primaryGroup)) {
    cleanGroups = [primaryGroup, ...cleanGroups];
  }

  // Final sanity check: never empty
  if (cleanGroups.length === 0) {
    cleanGroups = [primaryGroup || "Youth Ministry"];
  }
  if (!primaryGroup) {
    primaryGroup = cleanGroups[0];
  }

  return {
    group: primaryGroup,
    groups: cleanGroups
  };
}
