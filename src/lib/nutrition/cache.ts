/**
 * Persistent cache for nutrition lookups.
 *
 * Repeated external searches for the same product can return different
 * candidates or different ordering over time. To keep results stable, we
 * cache the best match and candidate list keyed by a normalized
 * `name|brand` string and reuse it within a TTL window.
 */

import { prisma } from "@/lib/db";

export const NUTRITION_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface CachedCandidate {
  name: string;
  brand?: string | null;
  externalId: string;
  provider: string;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
  sugarPer100g?: number | null;
  sodiumPer100g?: number | null;
  score: number;
}

export interface CachedLookupResult {
  matched: boolean;
  confidence: number;
  source: string;
  sourceType: string;
  bestMatch: CachedCandidate | null;
  candidates: CachedCandidate[];
}

/**
 * Build a deterministic cache key from a product name + brand.
 * Normalizes case, whitespace, and simple punctuation so trivial
 * differences collapse to the same entry.
 */
export function normalizeCacheKey(name: string, brand?: string | null): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  const n = norm(name || "");
  const b = brand ? norm(brand) : "";
  return `${n}|${b}`;
}

export async function readLookupCache(
  cacheKey: string
): Promise<CachedLookupResult | null> {
  // Defensive: if the cache table is missing or the generated client is
  // out of date, don't block lookups — fall through to a fresh search.
  let row: Awaited<ReturnType<typeof prisma.nutritionLookupCache.findUnique>> | null = null;
  try {
    row = await prisma.nutritionLookupCache.findUnique({ where: { cacheKey } });
  } catch (err) {
    console.warn("[nutrition-cache] read failed, bypassing cache:", err);
    return null;
  }
  if (!row) return null;
  const age = Date.now() - new Date(row.updatedAt).getTime();
  if (age > NUTRITION_CACHE_TTL_MS) return null;
  try {
    const candidates: CachedCandidate[] = JSON.parse(row.candidatesJson || "[]");
    const bestMatch: CachedCandidate | null = row.bestMatchJson
      ? JSON.parse(row.bestMatchJson)
      : null;
    return {
      matched: row.matched,
      confidence: row.confidence ?? 0,
      source: row.source ?? "none",
      sourceType: row.sourceType ?? "fallback",
      bestMatch,
      candidates,
    };
  } catch {
    return null;
  }
}

export async function writeLookupCache(
  cacheKey: string,
  productName: string,
  brand: string | null | undefined,
  result: CachedLookupResult
): Promise<void> {
  const data = {
    cacheKey,
    productName,
    brand: brand ?? null,
    matched: result.matched,
    confidence: result.confidence,
    source: result.source,
    sourceType: result.sourceType,
    bestMatchJson: result.bestMatch ? JSON.stringify(result.bestMatch) : null,
    candidatesJson: JSON.stringify(result.candidates),
  };
  try {
    await prisma.nutritionLookupCache.upsert({
      where: { cacheKey },
      create: data,
      update: data,
    });
  } catch (err) {
    // Cache writes are best-effort; never fail the lookup because of them.
    console.warn("[nutrition-cache] write failed:", err);
  }
}

/**
 * Build a lookup-result shape from a product that already has stored
 * canonical nutrition data (from a prior accepted/manual apply).
 * Returned as the single best match so repeated lookups are stable.
 */
export function buildResultFromProduct(product: {
  name: string;
  brand: string | null;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
  sugarPer100g: number | null;
  sodiumPer100g: number | null;
  nutritionSource: string | null;
  nutritionSourceType: string | null;
  nutritionConfidence: number | null;
  externalProductId: string | null;
  externalQuery: string | null;
}): CachedLookupResult | null {
  if (product.caloriesPer100g == null || !product.nutritionSource) return null;
  const candidate: CachedCandidate = {
    name: product.externalQuery || product.name,
    brand: product.brand,
    externalId: product.externalProductId || "",
    provider: product.nutritionSource,
    caloriesPer100g: product.caloriesPer100g,
    proteinPer100g: product.proteinPer100g,
    fatPer100g: product.fatPer100g,
    carbsPer100g: product.carbsPer100g,
    sugarPer100g: product.sugarPer100g,
    sodiumPer100g: product.sodiumPer100g,
    score: product.nutritionConfidence ?? 1,
  };
  return {
    matched: true,
    confidence: product.nutritionConfidence ?? 1,
    source: product.nutritionSource,
    sourceType: product.nutritionSourceType ?? "api",
    bestMatch: candidate,
    candidates: [candidate],
  };
}

/**
 * A product has an accepted/canonical nutrition match if a manual apply
 * or prior successful lookup has populated it. We treat these as the
 * source of truth during normal (non-forceRefresh) lookups.
 */
export function productHasAcceptedMatch(product: {
  caloriesPer100g: number | null;
  nutritionSource: string | null;
}): boolean {
  return product.caloriesPer100g != null && !!product.nutritionSource;
}
