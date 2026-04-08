/**
 * Query builder for nutrition API searches.
 * Normalizes product names into effective search queries.
 * No AI dependency - pure string manipulation.
 */

// Common brand names to extract
const KNOWN_BRANDS = [
  "chobani", "fage", "dannon", "yoplait", "oikos",
  "great value", "marketside", "sam's choice", "equate",
  "kirkland", "kraft", "heinz", "del monte", "dole",
  "tyson", "perdue", "oscar mayer", "hillshire",
  "nestle", "kellogg", "general mills", "quaker",
  "coca-cola", "pepsi", "gatorade",
  "nature made", "centrum", "one a day",
  "fresh from the start",
];

// Words to strip from search queries (not useful for nutrition lookup)
const NOISE_WORDS = [
  "fresh", "organic", "natural", "all natural", "non-gmo",
  "gluten free", "sugar free", "fat free", "low fat",
  "premium", "select", "choice", "classic", "original",
  "family size", "value pack", "bonus pack", "club pack",
  "container", "package", "bag", "box", "can", "bottle", "jar", "tub",
];

// Size pattern to remove
const SIZE_PATTERN = /\b\d+(\.\d+)?\s*(oz|lb|lbs|g|kg|ml|l|fl\s*oz|ct|count|pk|pack|ea|each)\b\.?/gi;

// Parenthetical content
const PAREN_PATTERN = /\([^)]*\)/g;

// Comma-separated descriptors at end
const TRAILING_DESCRIPTORS = /,\s*([\w\s]+)$/;

export interface QueryInfo {
  cleanName: string;
  brand: string | null;
  searchQueries: string[];
}

export function buildSearchQueries(rawName: string): QueryInfo {
  let name = rawName.trim();

  // Extract brand
  let brand: string | null = null;
  const nameLower = name.toLowerCase();
  for (const b of KNOWN_BRANDS) {
    if (nameLower.startsWith(b)) {
      brand = name.slice(0, b.length);
      name = name.slice(b.length).trim();
      // Remove leading dash/comma
      name = name.replace(/^[\s,\-–—]+/, "").trim();
      break;
    }
  }

  // Remove sizes
  let cleanName = name.replace(SIZE_PATTERN, "").trim();

  // Remove parentheticals
  cleanName = cleanName.replace(PAREN_PATTERN, "").trim();

  // Remove noise words (case-insensitive)
  for (const word of NOISE_WORDS) {
    const re = new RegExp(`\\b${word}\\b`, "gi");
    cleanName = cleanName.replace(re, "").trim();
  }

  // Remove trailing descriptors after comma
  cleanName = cleanName.replace(TRAILING_DESCRIPTORS, "").trim();

  // Collapse multiple spaces and trailing punctuation
  cleanName = cleanName.replace(/\s+/g, " ").replace(/[,\-–—]+$/, "").trim();

  // If cleaning removed everything, fall back to original
  if (!cleanName) cleanName = rawName.trim();

  // Build search queries in priority order
  const searchQueries: string[] = [];

  // Query 1: brand + clean name (most specific)
  if (brand) {
    searchQueries.push(`${brand} ${cleanName}`);
  }

  // Query 2: clean name only
  searchQueries.push(cleanName);

  // Query 3: first two significant words (generic fallback)
  const words = cleanName.split(/\s+/).filter((w) => w.length > 2);
  if (words.length > 2) {
    searchQueries.push(words.slice(0, 2).join(" "));
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = searchQueries.filter((q) => {
    const key = q.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { cleanName, brand, searchQueries: unique };
}
