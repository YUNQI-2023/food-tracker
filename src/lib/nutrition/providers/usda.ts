/**
 * USDA FoodData Central API provider.
 * API docs: https://fdc.nal.usda.gov/api-guide
 * Free API key from https://api.data.gov/signup/
 */

import type { NutritionProvider, NutritionCandidate, ProviderSearchResult } from "../types";

const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";

// USDA nutrient IDs
const NUTRIENT_MAP: Record<number, string> = {
  1008: "calories",   // Energy (kcal)
  1003: "protein",    // Protein
  1004: "fat",        // Total lipid (fat)
  1005: "carbs",      // Carbohydrate
  2000: "sugar",      // Total Sugars
  1093: "sodium",     // Sodium (mg)
};

interface USDAFood {
  fdcId: number;
  description: string;
  brandName?: string;
  brandOwner?: string;
  dataType?: string;
  foodNutrients: Array<{
    nutrientId?: number;
    nutrientNumber?: string;
    nutrientName?: string;
    value?: number;
  }>;
  score?: number;
}

function extractNutrition(food: USDAFood): Partial<Record<string, number | null>> {
  const result: Partial<Record<string, number | null>> = {};

  for (const fn of food.foodNutrients) {
    const id = fn.nutrientId ?? parseInt(fn.nutrientNumber ?? "0");
    const key = NUTRIENT_MAP[id];
    if (key && fn.value != null) {
      result[key] = fn.value;
    }
  }

  return result;
}

export class USDAProvider implements NutritionProvider {
  name = "usda";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.USDA_API_KEY || "";
  }

  async search(query: string, brand?: string): Promise<ProviderSearchResult> {
    if (!this.apiKey) {
      return {
        provider: this.name,
        candidates: [],
        error: "USDA API key not configured",
      };
    }

    try {
      const searchQuery = brand ? `${brand} ${query}` : query;
      const url = `${USDA_BASE_URL}/foods/search?api_key=${this.apiKey}&query=${encodeURIComponent(searchQuery)}&pageSize=5&dataType=Branded,Survey (FNDDS),SR Legacy`;

      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const text = await response.text();
        return {
          provider: this.name,
          candidates: [],
          error: `USDA API error: ${response.status} ${text.slice(0, 200)}`,
        };
      }

      const data = await response.json();
      const foods: USDAFood[] = data.foods || [];

      const candidates: NutritionCandidate[] = foods.map((food, index) => {
        const nutrients = extractNutrition(food);
        // Score based on position and data type preference
        const positionScore = 1 - index * 0.15;
        const typeBonus = food.dataType === "Branded" ? 0.1 : 0;
        const score = Math.max(0, Math.min(1, positionScore + typeBonus));

        return {
          name: food.description,
          brand: food.brandName || food.brandOwner || undefined,
          externalId: String(food.fdcId),
          provider: this.name,
          score,
          caloriesPer100g: nutrients.calories ?? null,
          proteinPer100g: nutrients.protein ?? null,
          fatPer100g: nutrients.fat ?? null,
          carbsPer100g: nutrients.carbs ?? null,
          sugarPer100g: nutrients.sugar ?? null,
          sodiumPer100g: nutrients.sodium ?? null,
          rawData: food as unknown as Record<string, unknown>,
        };
      });

      return { provider: this.name, candidates };
    } catch (error) {
      return {
        provider: this.name,
        candidates: [],
        error: `USDA fetch error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
