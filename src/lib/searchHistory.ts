export interface RecentSearchItem {
  term: string;
  timestamp: string;
}

const STORAGE_KEY = "recent_searches";
const MAX_RECENT_SEARCHES = 10;

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    const terms: string[] = [];
    for (const item of parsed) {
      const termStr = typeof item === "string" ? item : item?.term;
      if (termStr && typeof termStr === "string" && termStr.trim()) {
        const clean = termStr.trim();
        if (!terms.some(t => t.toLowerCase() === clean.toLowerCase())) {
          terms.push(clean);
        }
      }
      if (terms.length >= MAX_RECENT_SEARCHES) break;
    }
    return terms;
  } catch (e) {
    console.error("Error reading recent searches from localStorage", e);
    return [];
  }
}

export function saveRecentSearchTerm(term: string): string[] {
  const clean = term.trim();
  if (!clean || typeof window === "undefined") return getRecentSearches();

  try {
    const current = getRecentSearches();
    const filtered = current.filter(t => t.toLowerCase() !== clean.toLowerCase());
    const updated = [clean, ...filtered].slice(0, MAX_RECENT_SEARCHES);

    const fullPayload = updated.map(t => ({
      term: t,
      timestamp: new Date().toISOString()
    }));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(fullPayload));
    return updated;
  } catch (e) {
    console.error("Error saving recent search to localStorage", e);
    return getRecentSearches();
  }
}

export function removeRecentSearchTerm(termToRemove: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const current = getRecentSearches();
    const updated = current.filter(t => t.toLowerCase() !== termToRemove.trim().toLowerCase());
    const fullPayload = updated.map(t => ({
      term: t,
      timestamp: new Date().toISOString()
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fullPayload));
    return updated;
  } catch (e) {
    return [];
  }
}

export function clearAllRecentSearchTerms(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Error clearing recent searches", e);
  }
}
