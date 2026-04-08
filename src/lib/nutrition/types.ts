export interface NutritionData {
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
  sugarPer100g: number | null;
  sodiumPer100g: number | null;
}

export interface NutritionCandidate extends NutritionData {
  name: string;
  brand?: string;
  externalId: string;
  provider: string;
  score: number; // 0-1 match confidence
  rawData?: Record<string, unknown>;
}

export interface ProviderSearchResult {
  provider: string;
  candidates: NutritionCandidate[];
  error?: string;
}

export interface NutritionEnrichmentResult {
  matched: boolean;
  candidate?: NutritionCandidate;
  confidence: number;
  source: string;       // "usda", "openfoodfacts", "manual", "fallback"
  sourceType: string;   // "api", "manual", "ai_assisted", "fallback"
  allCandidates: NutritionCandidate[];
  logs: ProviderSearchResult[];
}

export interface NutritionProvider {
  name: string;
  search(query: string, brand?: string): Promise<ProviderSearchResult>;
}
