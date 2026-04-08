import type { Recipe, RecipeIngredient, InventoryBatch, Product } from "@prisma/client";

interface InventoryItem {
  batch: InventoryBatch;
  product: Product;
}

export interface ScoredRecipe {
  recipe: Recipe & { ingredients: RecipeIngredient[] };
  score: number;
  matchedIngredients: string[];
  missingIngredients: string[];
  expiringMatchCount: number;
  coveragePercent: number;
}

/** Score recipes against current inventory */
export function scoreRecipes(
  recipes: (Recipe & { ingredients: RecipeIngredient[] })[],
  inventory: InventoryItem[]
): ScoredRecipe[] {
  // Build a map of available products (lowercase name -> items)
  const availableMap = new Map<string, InventoryItem[]>();
  for (const item of inventory) {
    if (item.batch.quantityCurrent <= 0) continue;
    if (item.batch.status === "consumed") continue;
    const key = item.product.name.toLowerCase();
    if (!availableMap.has(key)) availableMap.set(key, []);
    availableMap.get(key)!.push(item);
  }

  // Set of expiring-soon product names
  const expiringNames = new Set<string>();
  for (const item of inventory) {
    if (item.batch.status === "expiring_soon" && item.batch.quantityCurrent > 0) {
      expiringNames.add(item.product.name.toLowerCase());
    }
  }

  return recipes
    .map((recipe) => {
      const requiredIngredients = recipe.ingredients.filter((i) => !i.optional);
      const allIngredients = recipe.ingredients;

      const matched: string[] = [];
      const missing: string[] = [];
      let expiringMatchCount = 0;

      for (const ingredient of allIngredients) {
        const key = ingredient.ingredientName.toLowerCase();
        if (availableMap.has(key)) {
          matched.push(ingredient.ingredientName);
          if (expiringNames.has(key)) expiringMatchCount++;
        } else if (!ingredient.optional) {
          missing.push(ingredient.ingredientName);
        }
      }

      const requiredMatched = requiredIngredients.filter((i) =>
        availableMap.has(i.ingredientName.toLowerCase())
      ).length;
      const coveragePercent =
        requiredIngredients.length > 0
          ? Math.round((requiredMatched / requiredIngredients.length) * 100)
          : 100;

      // Scoring:
      // - Base: coverage percentage (0-100 -> 0-50 points)
      // - Expiring bonus: 15 points per expiring match
      // - Missing penalty: -20 points per missing required ingredient
      // - Full coverage bonus: +20 points if all required are available
      let score = coveragePercent * 0.5;
      score += expiringMatchCount * 15;
      score -= missing.length * 20;
      if (missing.length === 0) score += 20;

      return {
        recipe,
        score,
        matchedIngredients: matched,
        missingIngredients: missing,
        expiringMatchCount,
        coveragePercent,
      };
    })
    .sort((a, b) => b.score - a.score);
}
