/**
 * Food name normalization for shelf-life rule matching.
 * Maps variations like "fresh blueberries", "organic blueberry 1 pint"
 * to canonical concepts like "blueberry".
 */

// Canonical food name mappings - maps common variations to a canonical key
const CANONICAL_NAMES: Record<string, string[]> = {
  // Fresh produce - fruits
  blueberry: ["blueberry", "blueberries", "fresh blueberry", "fresh blueberries"],
  strawberry: ["strawberry", "strawberries", "fresh strawberry", "fresh strawberries"],
  raspberry: ["raspberry", "raspberries", "fresh raspberry", "fresh raspberries"],
  banana: ["banana", "bananas"],
  apple: ["apple", "apples", "gala apple", "fuji apple", "honeycrisp apple", "granny smith"],
  avocado: ["avocado", "avocados", "hass avocado"],
  lemon: ["lemon", "lemons"],
  tomato: ["tomato", "tomatoes", "roma tomato", "cherry tomato", "grape tomato"],

  // Fresh produce - vegetables
  spinach: ["spinach", "baby spinach", "fresh spinach"],
  lettuce: ["lettuce", "romaine", "romaine lettuce", "iceberg lettuce", "mixed greens", "spring mix", "salad mix"],
  kale: ["kale", "baby kale", "fresh kale"],
  broccoli: ["broccoli", "broccoli florets", "fresh broccoli"],
  cucumber: ["cucumber", "cucumbers", "english cucumber"],
  carrot: ["carrot", "carrots", "baby carrots", "baby carrot"],
  bell_pepper: ["bell pepper", "bell peppers", "green pepper", "red pepper", "yellow pepper"],

  // Dairy
  milk: ["milk", "whole milk", "2% milk", "skim milk", "1% milk", "reduced fat milk", "fat free milk"],
  yogurt: ["yogurt", "greek yogurt", "plain yogurt", "vanilla yogurt"],
  shredded_cheese: ["shredded cheese", "shredded cheddar", "shredded mozzarella", "mexican blend cheese"],
  sliced_cheese: ["sliced cheese", "american cheese", "swiss cheese slices"],
  butter: ["butter", "salted butter", "unsalted butter"],
  eggs: ["egg", "eggs", "large eggs", "white eggs", "brown eggs"],

  // Protein
  raw_chicken: ["chicken", "chicken breast", "chicken thigh", "boneless chicken", "skinless chicken", "raw chicken"],
  raw_ground_beef: ["ground beef", "ground chuck", "lean ground beef", "80/20 ground beef"],
  raw_salmon: ["salmon", "salmon fillet", "atlantic salmon", "fresh salmon"],
  tofu: ["tofu", "firm tofu", "extra firm tofu", "silken tofu"],
  deli_meat: ["deli meat", "turkey breast deli", "ham deli", "salami", "lunch meat", "sliced turkey", "sliced ham"],

  // Bakery / Pantry
  bread: ["bread", "white bread", "wheat bread", "whole wheat bread", "sandwich bread", "sourdough"],
  tortillas: ["tortilla", "tortillas", "flour tortilla", "corn tortilla", "wrap"],
  rice: ["rice", "white rice", "brown rice", "jasmine rice", "basmati rice", "long grain rice"],
  pasta: ["pasta", "spaghetti", "penne", "macaroni", "noodle", "noodles", "fettuccine", "linguine"],
  oats: ["oats", "oatmeal", "rolled oats", "quick oats", "old fashioned oats", "instant oatmeal"],
  cereal: ["cereal", "cheerios", "corn flakes"],
  peanut_butter: ["peanut butter", "pb", "almond butter", "nut butter"],

  // Frozen
  frozen_vegetables: ["frozen vegetable", "frozen vegetables", "frozen broccoli", "frozen peas", "frozen corn", "frozen mixed vegetables"],
  frozen_fruit: ["frozen fruit", "frozen berries", "frozen strawberries", "frozen blueberries", "frozen mango", "mixed berries frozen"],
  frozen_chicken_nuggets: ["chicken nuggets", "frozen chicken nuggets", "chicken tenders", "frozen chicken tenders"],

  // Cooked / leftovers
  cooked_rice: ["cooked rice", "leftover rice", "rice leftovers"],
  cooked_chicken: ["cooked chicken", "rotisserie chicken", "leftover chicken", "grilled chicken"],
  soup: ["soup", "chicken soup", "tomato soup", "vegetable soup"],
  pasta_leftovers: ["pasta leftovers", "leftover pasta", "cooked pasta"],
};

// Build reverse lookup: normalized word → canonical name
// This is done at module load time
const REVERSE_LOOKUP = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(CANONICAL_NAMES)) {
  for (const alias of aliases) {
    REVERSE_LOOKUP.set(alias.toLowerCase(), canonical);
  }
}

// Size/packaging words to strip
const STRIP_PATTERNS = [
  /\b\d+(\.\d+)?\s*(oz|lb|lbs|g|kg|ml|l|fl\s*oz|ct|count|pk|pack|ea|each|pt|pint|qt|quart|gal|gallon)\b\.?/gi,
  /\b(container|package|bag|box|can|bottle|jar|tub|carton|pouch|sleeve|bunch|head|stalk)\b/gi,
  /\b(organic|natural|all natural|non-gmo|gluten free|sugar free|fat free|low fat)\b/gi,
  /\b(premium|select|choice|classic|original|traditional|homestyle)\b/gi,
  /\b(family size|value pack|bonus pack|club pack)\b/gi,
  /\([^)]*\)/g, // parenthetical content
  /,\s*[\w\s]+$/, // trailing descriptors after comma
];

/**
 * Normalize a food name for shelf-life rule matching.
 * Strips sizes, packaging, descriptors; lowercases; trims.
 */
export function normalizeFoodName(rawName: string): string {
  let name = rawName.trim().toLowerCase();
  for (const pattern of STRIP_PATTERNS) {
    name = name.replace(pattern, " ");
  }
  // Collapse whitespace and trim
  name = name.replace(/\s+/g, " ").trim();
  // Remove trailing/leading punctuation
  name = name.replace(/^[\s,\-–—.]+|[\s,\-–—.]+$/g, "").trim();
  return name || rawName.trim().toLowerCase();
}

/**
 * Find the canonical food concept for a given food name.
 * Returns the canonical key (e.g. "blueberry") or null if no match.
 */
export function findCanonicalName(rawName: string): string | null {
  const normalized = normalizeFoodName(rawName);

  // 1. Direct exact match
  if (REVERSE_LOOKUP.has(normalized)) {
    return REVERSE_LOOKUP.get(normalized)!;
  }

  // 2. Check if any alias is contained in the normalized name (longest first for specificity)
  const allAliases = Array.from(REVERSE_LOOKUP.keys()).sort((a, b) => b.length - a.length);
  for (const alias of allAliases) {
    if (normalized.includes(alias)) {
      return REVERSE_LOOKUP.get(alias)!;
    }
  }

  // 3. Check if the normalized name starts with any alias
  for (const alias of allAliases) {
    if (normalized.startsWith(alias)) {
      return REVERSE_LOOKUP.get(alias)!;
    }
  }

  return null;
}

/**
 * Infer a storage type from food name/category.
 * Returns a default storage type suggestion.
 */
export type StorageType = "refrigerated" | "frozen" | "pantry" | "room_temp";

const STORAGE_BY_CATEGORY: Record<string, StorageType> = {
  dairy: "refrigerated",
  meat: "refrigerated",
  seafood: "refrigerated",
  fruit: "refrigerated",
  vegetable: "refrigerated",
  bakery: "room_temp",
  pantry: "pantry",
  frozen: "frozen",
  beverage: "pantry",
  snack: "pantry",
  prepared_food: "refrigerated",
  // legacy
  produce: "refrigerated",
  grains: "pantry",
  canned: "pantry",
  condiments: "pantry",
};

const STORAGE_BY_KEYWORD: Array<{ keywords: string[]; storage: StorageType }> = [
  { keywords: ["frozen", "ice cream"], storage: "frozen" },
  { keywords: ["canned", "can of"], storage: "pantry" },
  { keywords: ["refrigerate", "keep cold", "cold"], storage: "refrigerated" },
];

export function inferStorageType(name: string, category: string): StorageType {
  const lower = name.toLowerCase();

  // Check keyword overrides first
  for (const { keywords, storage } of STORAGE_BY_KEYWORD) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return storage;
    }
  }

  // Check category mapping
  if (STORAGE_BY_CATEGORY[category]) {
    return STORAGE_BY_CATEGORY[category];
  }

  return "pantry"; // default fallback
}
