/**
 * Open Food Facts API provider.
 * No API key required.
 * API docs: https://wiki.openfoodfacts.org/API
 */

import type { NutritionProvider, NutritionCandidate, ProviderSearchResult } from "../types";

const OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";

interface OFFProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: {
    "energy-kcal_100g"?: number;
    "proteins_100g"?: number;
    "fat_100g"?: number;
    "carbohydrates_100g"?: number;
    "sugars_100g"?: number;
    "sodium_100g"?: number;
  };
}

export class OpenFoodFactsProvider implements NutritionProvider {
  name = "openfoodfacts";

  async search(query: string, brand?: string): Promise<ProviderSearchResult> {
    try {
      const searchTerms = brand ? `${brand} ${query}` : query;
      const params = new URLSearchParams({
        search_terms: searchTerms,
        search_simple: "1",
        action: "process",
        json: "1",
        page_size: "5",
        fields: "code,product_name,brands,nutriments",
      });

      const response = await fetch(`${OFF_SEARCH_URL}?${params}`, {
        headers: {
          "User-Agent": "FoodTracker/1.0 (personal-project)",
        },
      });

      if (!response.ok) {
        return {
          provider: this.name,
          candidates: [],
          error: `OFF API error: ${response.status}`,
        };
      }

      const data = await response.json();
      const products: OFFProduct[] = data.products || [];

      const candidates: NutritionCandidate[] = products
        .filter((p) => p.product_name && p.nutriments)
        .map((product, index) => {
          const n = product.nutriments!;
          const positionScore = 1 - index * 0.15;

          return {
            name: product.product_name!,
            brand: product.brands || undefined,
            externalId: product.code || "",
            provider: this.name,
            score: Math.max(0, Math.min(1, positionScore)),
            caloriesPer100g: n["energy-kcal_100g"] ?? null,
            proteinPer100g: n["proteins_100g"] ?? null,
            fatPer100g: n["fat_100g"] ?? null,
            carbsPer100g: n["carbohydrates_100g"] ?? null,
            sugarPer100g: n["sugars_100g"] ?? null,
            sodiumPer100g: n["sodium_100g"] ?? null,
            rawData: product as unknown as Record<string, unknown>,
          };
        });

      return { provider: this.name, candidates };
    } catch (error) {
      return {
        provider: this.name,
        candidates: [],
        error: `OFF fetch error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
