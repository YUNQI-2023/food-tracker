/**
 * Shelf-life rule engine.
 * Deterministic, rule-based shelf-life estimation for food items.
 * NOT a legal expiration date — a practical estimated use-by for personal inventory.
 */

import { addDays } from "date-fns";
import { findCanonicalName, normalizeFoodName, inferStorageType, type StorageType } from "./food-normalization";

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────

export type ShelfLifeConfidence = "high" | "medium" | "low";

export interface ShelfLifeRule {
  canonicalName?: string;       // e.g. "blueberry", null for category-level rules
  category: string;             // e.g. "fruit", "dairy"
  storageType: StorageType;
  defaultShelfLifeDays: number;
  openedShelfLifeDays?: number;
  minShelfLifeDays?: number;
  maxShelfLifeDays?: number;
  confidence: ShelfLifeConfidence;
  sourceNote: string;
}

export interface ShelfLifeEstimate {
  estimatedExpiryDate: Date | null;
  shelfLifeDays: number | null;
  openedShelfLifeDays: number | null;
  shelfLifeSource: string;          // "explicit", "rule:blueberry", "rule:category:fruit", "none"
  shelfLifeConfidence: ShelfLifeConfidence;
  shelfLifeReason: string;
  matchedRule: ShelfLifeRule | null;
  storageType: StorageType;
}

export type ShelfLifeStatus = "fresh" | "expiring_soon" | "urgent" | "expired" | "unknown";

// ────────────────────────────────────────────────────────
// Knowledge Base - MVP shelf-life rules
// ────────────────────────────────────────────────────────

export const SHELF_LIFE_RULES: ShelfLifeRule[] = [
  // === Fresh Produce - Fruits ===
  { canonicalName: "blueberry", category: "fruit", storageType: "refrigerated", defaultShelfLifeDays: 10, minShelfLifeDays: 7, maxShelfLifeDays: 14, confidence: "medium", sourceNote: "Fresh berries refrigerated" },
  { canonicalName: "strawberry", category: "fruit", storageType: "refrigerated", defaultShelfLifeDays: 7, minShelfLifeDays: 5, maxShelfLifeDays: 10, confidence: "medium", sourceNote: "Fresh strawberries refrigerated" },
  { canonicalName: "raspberry", category: "fruit", storageType: "refrigerated", defaultShelfLifeDays: 5, minShelfLifeDays: 3, maxShelfLifeDays: 7, confidence: "medium", sourceNote: "Fresh raspberries refrigerated — more delicate than other berries" },
  { canonicalName: "banana", category: "fruit", storageType: "room_temp", defaultShelfLifeDays: 7, minShelfLifeDays: 5, maxShelfLifeDays: 10, confidence: "medium", sourceNote: "Bananas at room temperature" },
  { canonicalName: "apple", category: "fruit", storageType: "refrigerated", defaultShelfLifeDays: 28, minShelfLifeDays: 21, maxShelfLifeDays: 42, confidence: "medium", sourceNote: "Apples refrigerated" },
  { canonicalName: "avocado", category: "fruit", storageType: "room_temp", defaultShelfLifeDays: 5, openedShelfLifeDays: 2, minShelfLifeDays: 3, maxShelfLifeDays: 7, confidence: "medium", sourceNote: "Avocado ripening at room temp; cut avocado 1-2 days" },
  { canonicalName: "lemon", category: "fruit", storageType: "refrigerated", defaultShelfLifeDays: 21, minShelfLifeDays: 14, maxShelfLifeDays: 28, confidence: "medium", sourceNote: "Lemons refrigerated" },
  { canonicalName: "tomato", category: "vegetable", storageType: "room_temp", defaultShelfLifeDays: 7, minShelfLifeDays: 5, maxShelfLifeDays: 10, confidence: "medium", sourceNote: "Tomatoes at room temp for flavor; refrigerate only when very ripe" },

  // === Fresh Produce - Vegetables ===
  { canonicalName: "spinach", category: "vegetable", storageType: "refrigerated", defaultShelfLifeDays: 7, openedShelfLifeDays: 3, minShelfLifeDays: 5, maxShelfLifeDays: 10, confidence: "medium", sourceNote: "Fresh spinach, sealed bag" },
  { canonicalName: "lettuce", category: "vegetable", storageType: "refrigerated", defaultShelfLifeDays: 7, openedShelfLifeDays: 3, minShelfLifeDays: 5, maxShelfLifeDays: 10, confidence: "medium", sourceNote: "Lettuce refrigerated" },
  { canonicalName: "kale", category: "vegetable", storageType: "refrigerated", defaultShelfLifeDays: 7, openedShelfLifeDays: 5, minShelfLifeDays: 5, maxShelfLifeDays: 10, confidence: "medium", sourceNote: "Kale is hardier than lettuce" },
  { canonicalName: "broccoli", category: "vegetable", storageType: "refrigerated", defaultShelfLifeDays: 7, minShelfLifeDays: 5, maxShelfLifeDays: 10, confidence: "medium", sourceNote: "Fresh broccoli refrigerated" },
  { canonicalName: "cucumber", category: "vegetable", storageType: "refrigerated", defaultShelfLifeDays: 7, minShelfLifeDays: 5, maxShelfLifeDays: 10, confidence: "medium", sourceNote: "Cucumber refrigerated" },
  { canonicalName: "carrot", category: "vegetable", storageType: "refrigerated", defaultShelfLifeDays: 21, minShelfLifeDays: 14, maxShelfLifeDays: 28, confidence: "medium", sourceNote: "Carrots keep well refrigerated" },
  { canonicalName: "bell_pepper", category: "vegetable", storageType: "refrigerated", defaultShelfLifeDays: 10, minShelfLifeDays: 7, maxShelfLifeDays: 14, confidence: "medium", sourceNote: "Bell peppers refrigerated" },

  // === Dairy / Refrigerated ===
  { canonicalName: "milk", category: "dairy", storageType: "refrigerated", defaultShelfLifeDays: 14, openedShelfLifeDays: 7, minShelfLifeDays: 10, maxShelfLifeDays: 21, confidence: "medium", sourceNote: "Pasteurized milk refrigerated; opened lasts ~7 days" },
  { canonicalName: "yogurt", category: "dairy", storageType: "refrigerated", defaultShelfLifeDays: 21, openedShelfLifeDays: 7, minShelfLifeDays: 14, maxShelfLifeDays: 28, confidence: "medium", sourceNote: "Yogurt sealed refrigerated" },
  { canonicalName: "shredded_cheese", category: "dairy", storageType: "refrigerated", defaultShelfLifeDays: 30, openedShelfLifeDays: 7, minShelfLifeDays: 21, maxShelfLifeDays: 42, confidence: "medium", sourceNote: "Shredded cheese, opened dries out faster" },
  { canonicalName: "sliced_cheese", category: "dairy", storageType: "refrigerated", defaultShelfLifeDays: 21, openedShelfLifeDays: 14, minShelfLifeDays: 14, maxShelfLifeDays: 28, confidence: "medium", sourceNote: "Pre-sliced cheese refrigerated" },
  { canonicalName: "butter", category: "dairy", storageType: "refrigerated", defaultShelfLifeDays: 90, openedShelfLifeDays: 30, minShelfLifeDays: 60, maxShelfLifeDays: 120, confidence: "medium", sourceNote: "Butter refrigerated" },
  { canonicalName: "eggs", category: "dairy", storageType: "refrigerated", defaultShelfLifeDays: 28, minShelfLifeDays: 21, maxShelfLifeDays: 35, confidence: "medium", sourceNote: "Eggs refrigerated — typically 3-5 weeks from purchase" },

  // === Protein ===
  { canonicalName: "raw_chicken", category: "meat", storageType: "refrigerated", defaultShelfLifeDays: 3, minShelfLifeDays: 1, maxShelfLifeDays: 4, confidence: "medium", sourceNote: "Raw chicken refrigerated — use within 1-2 days for best safety" },
  { canonicalName: "raw_ground_beef", category: "meat", storageType: "refrigerated", defaultShelfLifeDays: 3, minShelfLifeDays: 1, maxShelfLifeDays: 4, confidence: "medium", sourceNote: "Raw ground beef refrigerated" },
  { canonicalName: "raw_salmon", category: "seafood", storageType: "refrigerated", defaultShelfLifeDays: 2, minShelfLifeDays: 1, maxShelfLifeDays: 3, confidence: "medium", sourceNote: "Raw salmon refrigerated — consume quickly" },
  { canonicalName: "tofu", category: "meat", storageType: "refrigerated", defaultShelfLifeDays: 7, openedShelfLifeDays: 3, minShelfLifeDays: 5, maxShelfLifeDays: 10, confidence: "medium", sourceNote: "Tofu sealed, refrigerated; opened: keep in water, change daily" },
  { canonicalName: "deli_meat", category: "meat", storageType: "refrigerated", defaultShelfLifeDays: 7, openedShelfLifeDays: 5, minShelfLifeDays: 5, maxShelfLifeDays: 10, confidence: "medium", sourceNote: "Deli meat pre-packaged, refrigerated" },

  // === Bakery / Pantry ===
  { canonicalName: "bread", category: "bakery", storageType: "room_temp", defaultShelfLifeDays: 7, openedShelfLifeDays: 5, minShelfLifeDays: 5, maxShelfLifeDays: 10, confidence: "medium", sourceNote: "Bread at room temp; refrigerate to extend" },
  { canonicalName: "tortillas", category: "bakery", storageType: "pantry", defaultShelfLifeDays: 14, openedShelfLifeDays: 7, minShelfLifeDays: 7, maxShelfLifeDays: 21, confidence: "medium", sourceNote: "Tortillas in pantry; refrigerate opened" },
  { canonicalName: "rice", category: "pantry", storageType: "pantry", defaultShelfLifeDays: 365, minShelfLifeDays: 180, maxShelfLifeDays: 730, confidence: "medium", sourceNote: "Dry rice in pantry — practically indefinite" },
  { canonicalName: "pasta", category: "pantry", storageType: "pantry", defaultShelfLifeDays: 730, minShelfLifeDays: 365, maxShelfLifeDays: 1095, confidence: "medium", sourceNote: "Dry pasta in pantry" },
  { canonicalName: "oats", category: "pantry", storageType: "pantry", defaultShelfLifeDays: 365, minShelfLifeDays: 180, maxShelfLifeDays: 730, confidence: "medium", sourceNote: "Oats/oatmeal in pantry sealed" },
  { canonicalName: "cereal", category: "pantry", storageType: "pantry", defaultShelfLifeDays: 180, openedShelfLifeDays: 60, minShelfLifeDays: 120, maxShelfLifeDays: 365, confidence: "low", sourceNote: "Cereal in pantry; opened goes stale faster" },
  { canonicalName: "peanut_butter", category: "pantry", storageType: "pantry", defaultShelfLifeDays: 180, openedShelfLifeDays: 90, minShelfLifeDays: 90, maxShelfLifeDays: 365, confidence: "medium", sourceNote: "Peanut butter pantry; natural PB shorter" },

  // === Frozen ===
  { canonicalName: "frozen_vegetables", category: "frozen", storageType: "frozen", defaultShelfLifeDays: 240, minShelfLifeDays: 180, maxShelfLifeDays: 365, confidence: "medium", sourceNote: "Frozen vegetables" },
  { canonicalName: "frozen_fruit", category: "frozen", storageType: "frozen", defaultShelfLifeDays: 240, minShelfLifeDays: 180, maxShelfLifeDays: 365, confidence: "medium", sourceNote: "Frozen fruit" },
  { canonicalName: "frozen_chicken_nuggets", category: "frozen", storageType: "frozen", defaultShelfLifeDays: 180, minShelfLifeDays: 90, maxShelfLifeDays: 365, confidence: "low", sourceNote: "Frozen pre-cooked chicken products" },

  // === Cooked / Leftovers ===
  { canonicalName: "cooked_rice", category: "prepared_food", storageType: "refrigerated", defaultShelfLifeDays: 4, minShelfLifeDays: 3, maxShelfLifeDays: 6, confidence: "medium", sourceNote: "Cooked rice refrigerated — watch for B. cereus" },
  { canonicalName: "cooked_chicken", category: "prepared_food", storageType: "refrigerated", defaultShelfLifeDays: 4, minShelfLifeDays: 3, maxShelfLifeDays: 5, confidence: "medium", sourceNote: "Cooked chicken refrigerated" },
  { canonicalName: "soup", category: "prepared_food", storageType: "refrigerated", defaultShelfLifeDays: 4, minShelfLifeDays: 3, maxShelfLifeDays: 5, confidence: "medium", sourceNote: "Homemade soup refrigerated" },
  { canonicalName: "pasta_leftovers", category: "prepared_food", storageType: "refrigerated", defaultShelfLifeDays: 4, minShelfLifeDays: 3, maxShelfLifeDays: 5, confidence: "medium", sourceNote: "Cooked pasta/leftovers refrigerated" },

  // === Category-level fallbacks (no canonicalName) ===
  { category: "fruit", storageType: "refrigerated", defaultShelfLifeDays: 7, confidence: "low", sourceNote: "Generic fresh fruit refrigerated fallback" },
  { category: "fruit", storageType: "room_temp", defaultShelfLifeDays: 5, confidence: "low", sourceNote: "Generic fresh fruit room temp fallback" },
  { category: "vegetable", storageType: "refrigerated", defaultShelfLifeDays: 7, confidence: "low", sourceNote: "Generic fresh vegetable refrigerated fallback" },
  { category: "dairy", storageType: "refrigerated", defaultShelfLifeDays: 14, openedShelfLifeDays: 7, confidence: "low", sourceNote: "Generic dairy refrigerated fallback" },
  { category: "meat", storageType: "refrigerated", defaultShelfLifeDays: 3, confidence: "low", sourceNote: "Generic raw meat refrigerated fallback — err on the cautious side" },
  { category: "seafood", storageType: "refrigerated", defaultShelfLifeDays: 2, confidence: "low", sourceNote: "Generic raw seafood refrigerated fallback" },
  { category: "bakery", storageType: "room_temp", defaultShelfLifeDays: 5, confidence: "low", sourceNote: "Generic bakery room temp fallback" },
  { category: "pantry", storageType: "pantry", defaultShelfLifeDays: 180, confidence: "low", sourceNote: "Generic pantry item fallback" },
  { category: "frozen", storageType: "frozen", defaultShelfLifeDays: 180, confidence: "low", sourceNote: "Generic frozen item fallback" },
  { category: "beverage", storageType: "pantry", defaultShelfLifeDays: 90, confidence: "low", sourceNote: "Generic beverage fallback" },
  { category: "snack", storageType: "pantry", defaultShelfLifeDays: 90, confidence: "low", sourceNote: "Generic snack fallback" },
  { category: "prepared_food", storageType: "refrigerated", defaultShelfLifeDays: 4, confidence: "low", sourceNote: "Generic prepared/cooked food refrigerated fallback" },
  // Legacy categories
  { category: "produce", storageType: "refrigerated", defaultShelfLifeDays: 7, confidence: "low", sourceNote: "Generic produce fallback" },
  { category: "grains", storageType: "pantry", defaultShelfLifeDays: 365, confidence: "low", sourceNote: "Generic grains fallback" },
  { category: "canned", storageType: "pantry", defaultShelfLifeDays: 730, confidence: "low", sourceNote: "Generic canned goods fallback" },
  { category: "condiments", storageType: "pantry", defaultShelfLifeDays: 180, openedShelfLifeDays: 90, confidence: "low", sourceNote: "Generic condiments fallback" },
];

// ────────────────────────────────────────────────────────
// Rule Matching
// ────────────────────────────────────────────────────────

/**
 * Find the best matching shelf-life rule for a food item.
 * Match priority:
 *   1. Exact canonical name + matching storage type
 *   2. Exact canonical name (any storage type)
 *   3. Category + matching storage type
 *   4. Category (any storage type)
 */
export function findShelfLifeRule(
  name: string,
  category: string,
  storageType?: StorageType | null
): ShelfLifeRule | null {
  const canonical = findCanonicalName(name);
  const effectiveStorage = storageType || inferStorageType(name, category);

  // 1. Exact canonical + storage match
  if (canonical) {
    const exactMatch = SHELF_LIFE_RULES.find(
      (r) => r.canonicalName === canonical && r.storageType === effectiveStorage
    );
    if (exactMatch) return exactMatch;
  }

  // 2. Canonical name, any storage
  if (canonical) {
    const canonicalMatch = SHELF_LIFE_RULES.find(
      (r) => r.canonicalName === canonical
    );
    if (canonicalMatch) return canonicalMatch;
  }

  // 3. Category + storage match
  const categoryStorageMatch = SHELF_LIFE_RULES.find(
    (r) => !r.canonicalName && r.category === category && r.storageType === effectiveStorage
  );
  if (categoryStorageMatch) return categoryStorageMatch;

  // 4. Category, any storage
  const categoryMatch = SHELF_LIFE_RULES.find(
    (r) => !r.canonicalName && r.category === category
  );
  if (categoryMatch) return categoryMatch;

  return null;
}

// ────────────────────────────────────────────────────────
// Estimation
// ────────────────────────────────────────────────────────

export interface EstimateExpiryInput {
  name: string;
  category: string;
  purchaseDate: Date;
  expiryDate?: Date | null;
  openedDate?: Date | null;
  storageType?: StorageType | null;
  /** Product-level overrides from the database */
  productShelfLifeDays?: number | null;
  productOpenedShelfLifeDays?: number | null;
}

/**
 * Estimate the expiry date for a food item.
 * Returns a full estimation result with date, source, confidence, and reason.
 */
export function estimateExpiry(input: EstimateExpiryInput): ShelfLifeEstimate {
  const effectiveStorage = input.storageType || inferStorageType(input.name, input.category);

  // Priority 1: Explicit package expiry date
  if (input.expiryDate) {
    // Even with explicit date, if opened and we have opened rules, check if opened expiry is sooner
    if (input.openedDate) {
      const openedDays = input.productOpenedShelfLifeDays;
      if (openedDays) {
        const openedExpiry = addDays(input.openedDate, openedDays);
        if (openedExpiry < input.expiryDate) {
          return {
            estimatedExpiryDate: openedExpiry,
            shelfLifeDays: null,
            openedShelfLifeDays: openedDays,
            shelfLifeSource: "opened_rule_override",
            shelfLifeConfidence: "high",
            shelfLifeReason: "Opened shelf-life rule is sooner than package date",
            matchedRule: null,
            storageType: effectiveStorage,
          };
        }
      }
    }

    return {
      estimatedExpiryDate: input.expiryDate,
      shelfLifeDays: null,
      openedShelfLifeDays: null,
      shelfLifeSource: "explicit",
      shelfLifeConfidence: "high",
      shelfLifeReason: "Using explicit package expiry date",
      matchedRule: null,
      storageType: effectiveStorage,
    };
  }

  // Find matching rule
  const rule = findShelfLifeRule(input.name, input.category, effectiveStorage);

  // Priority 2: Opened date + opened shelf life
  if (input.openedDate) {
    const openedDays = input.productOpenedShelfLifeDays
      ?? rule?.openedShelfLifeDays;
    if (openedDays) {
      const ruleLabel = rule?.canonicalName
        ? `opened ${rule.canonicalName} ${effectiveStorage}`
        : `opened ${input.category} ${effectiveStorage}`;
      return {
        estimatedExpiryDate: addDays(input.openedDate, openedDays),
        shelfLifeDays: rule?.defaultShelfLifeDays ?? null,
        openedShelfLifeDays: openedDays,
        shelfLifeSource: rule ? `rule:${rule.canonicalName || `category:${rule.category}`}` : "product",
        shelfLifeConfidence: rule?.confidence ?? "medium",
        shelfLifeReason: `Estimated from ${ruleLabel} rule`,
        matchedRule: rule,
        storageType: effectiveStorage,
      };
    }
  }

  // Priority 3: Purchase date + shelf life rule
  const shelfDays = input.productShelfLifeDays ?? rule?.defaultShelfLifeDays;
  if (shelfDays) {
    const ruleLabel = rule?.canonicalName
      ? `${rule.canonicalName} ${effectiveStorage}`
      : rule
      ? `${input.category} ${effectiveStorage}`
      : `product shelf life`;
    const source = rule
      ? `rule:${rule.canonicalName || `category:${rule.category}`}`
      : "product";
    return {
      estimatedExpiryDate: addDays(input.purchaseDate, shelfDays),
      shelfLifeDays: shelfDays,
      openedShelfLifeDays: input.productOpenedShelfLifeDays ?? rule?.openedShelfLifeDays ?? null,
      shelfLifeSource: source,
      shelfLifeConfidence: rule?.confidence ?? "low",
      shelfLifeReason: `Estimated from ${ruleLabel} rule`,
      matchedRule: rule,
      storageType: effectiveStorage,
    };
  }

  // Priority 4: No matching rule
  return {
    estimatedExpiryDate: null,
    shelfLifeDays: null,
    openedShelfLifeDays: null,
    shelfLifeSource: "none",
    shelfLifeConfidence: "low",
    shelfLifeReason: "No matching shelf-life rule found",
    matchedRule: null,
    storageType: effectiveStorage,
  };
}

// ────────────────────────────────────────────────────────
// Status Logic
// ────────────────────────────────────────────────────────

/**
 * Get the shelf-life status of an item based on days remaining.
 * Thresholds:
 *   expired:       daysLeft < 0
 *   urgent:        0 to 2 days
 *   expiring_soon: 3 to 7 days
 *   fresh:         > 7 days
 *   unknown:       no date available
 */
export function getShelfLifeStatus(daysLeft: number | null): ShelfLifeStatus {
  if (daysLeft == null) return "unknown";
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 2) return "urgent";
  if (daysLeft <= 7) return "expiring_soon";
  return "fresh";
}

/**
 * Human-readable label for shelf-life status.
 */
export function shelfLifeStatusLabel(status: ShelfLifeStatus): string {
  switch (status) {
    case "fresh": return "Fresh";
    case "expiring_soon": return "Expiring Soon";
    case "urgent": return "Use Soon!";
    case "expired": return "Expired";
    case "unknown": return "Unknown";
  }
}

/**
 * Tailwind color classes for status badges.
 */
export function shelfLifeStatusColor(status: ShelfLifeStatus): string {
  switch (status) {
    case "fresh": return "bg-green-100 text-green-800";
    case "expiring_soon": return "bg-amber-100 text-amber-800";
    case "urgent": return "bg-orange-100 text-orange-800";
    case "expired": return "bg-red-100 text-red-800";
    case "unknown": return "bg-gray-100 text-gray-600";
  }
}

/**
 * Badge label for confidence level.
 */
export function confidenceBadge(confidence: ShelfLifeConfidence): {
  label: string;
  color: string;
} {
  switch (confidence) {
    case "high":
      return { label: "High", color: "bg-green-100 text-green-700" };
    case "medium":
      return { label: "Medium", color: "bg-blue-100 text-blue-700" };
    case "low":
      return { label: "Low", color: "bg-gray-100 text-gray-500" };
  }
}
