/**
 * Nutrition enrichment pipeline.
 * Orchestrates providers, query building, matching, and scoring.
 */

import type { NutritionCandidate, NutritionEnrichmentResult, NutritionProvider, ProviderSearchResult } from "./types";
import { USDAProvider } from "./providers/usda";
import { OpenFoodFactsProvider } from "./providers/openfoodfacts";
import { buildSearchQueries } from "./query-builder";
import { rankCandidates, AUTO_ACCEPT_THRESHOLD } from "./matcher";

// Initialize providers
function getProviders(): NutritionProvider[] {
  const providers: NutritionProvider[] = [];

  // USDA is preferred if API key is available
  if (process.env.USDA_API_KEY) {
    providers.push(new USDAProvider());
  }

  // Open Food Facts is always available (no key needed)
  providers.push(new OpenFoodFactsProvider());

  return providers;
}

/**
 * Look up nutrition data for a product name.
 * Tries multiple providers and queries, returns best match.
 */
export async function enrichNutrition(
  productName: string,
  productBrand?: string | null
): Promise<NutritionEnrichmentResult> {
  const providers = getProviders();
  const queryInfo = buildSearchQueries(productName);
  const brand = productBrand || queryInfo.brand;

  const allCandidates: NutritionCandidate[] = [];
  const allLogs: ProviderSearchResult[] = [];

  // Try each provider with each query
  for (const provider of providers) {
    for (const query of queryInfo.searchQueries) {
      const result = await provider.search(query, brand ?? undefined);
      allLogs.push(result);

      if (result.candidates.length > 0) {
        allCandidates.push(...result.candidates);
        // If we got good results from first query, skip fallback queries for this provider
        break;
      }
    }
  }

  if (allCandidates.length === 0) {
    return {
      matched: false,
      confidence: 0,
      source: "none",
      sourceType: "fallback",
      allCandidates: [],
      logs: allLogs,
    };
  }

  // Rank all candidates
  const ranked = rankCandidates(
    queryInfo.cleanName,
    brand,
    allCandidates
  );

  // Update each candidate's score to reflect the final ranked score
  // so consumers see consistent confidence values everywhere
  const rankedCandidates = ranked.map((r) => ({
    ...r.candidate,
    score: r.finalScore,
  }));

  const best = ranked[0];

  if (!best || best.finalScore < 0.1) {
    return {
      matched: false,
      confidence: 0,
      source: "none",
      sourceType: "fallback",
      allCandidates: rankedCandidates,
      logs: allLogs,
    };
  }

  return {
    matched: best.finalScore >= AUTO_ACCEPT_THRESHOLD,
    candidate: rankedCandidates[0],
    confidence: best.finalScore,
    source: best.candidate.provider,
    sourceType: "api",
    allCandidates: rankedCandidates,
    logs: allLogs,
  };
}

/**
 * Apply enrichment result to a product data object.
 * Returns the fields to update.
 */
export function applyEnrichment(result: NutritionEnrichmentResult): Record<string, unknown> | null {
  if (!result.matched || !result.candidate) return null;

  const c = result.candidate;
  return {
    caloriesPer100g: c.caloriesPer100g,
    proteinPer100g: c.proteinPer100g,
    fatPer100g: c.fatPer100g,
    carbsPer100g: c.carbsPer100g,
    sugarPer100g: c.sugarPer100g,
    sodiumPer100g: c.sodiumPer100g,
    nutritionSource: c.provider,
    nutritionSourceType: "api",
    nutritionConfidence: result.confidence,
    externalProductId: c.externalId,
    externalQuery: result.allCandidates.length > 0 ? c.name : null,
    nutritionLastFetchedAt: new Date(),
    rawNutritionJson: c.rawData ? JSON.stringify(c.rawData) : null,
  };
}
