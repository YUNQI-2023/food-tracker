import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enrichNutrition, applyEnrichment } from "@/lib/nutrition/enrichment";
import {
  normalizeCacheKey,
  readLookupCache,
  writeLookupCache,
  buildResultFromProduct,
  productHasAcceptedMatch,
  type CachedLookupResult,
  type CachedCandidate,
} from "@/lib/nutrition/cache";

/**
 * POST /api/nutrition/lookup
 * Look up nutrition for a product and optionally apply it.
 *
 * Body: {
 *   productId?: number,
 *   productName: string,
 *   brand?: string,
 *   autoApply?: boolean,
 *   forceRefresh?: boolean
 * }
 *
 * Lookup precedence (unless `forceRefresh` is true):
 *   1. existing accepted/manual stored match on the product
 *   2. a valid (non-expired) cache entry keyed by normalized name+brand
 *   3. a fresh external provider search, which is then written to cache
 *
 * `forceRefresh: true` bypasses steps 1 and 2 and always performs a
 * fresh external search. Even with `autoApply: true`, we refuse to
 * silently overwrite an accepted/manual match during a normal lookup.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { productId, productName, brand, autoApply, forceRefresh } = body as {
    productId?: number;
    productName: string;
    brand?: string;
    autoApply?: boolean;
    forceRefresh?: boolean;
  };

  if (!productName) {
    return NextResponse.json({ error: "productName is required" }, { status: 400 });
  }

  const cacheKey = normalizeCacheKey(productName, brand);

  // 1. Stored canonical match on the product
  if (!forceRefresh && productId) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (product && productHasAcceptedMatch(product)) {
      const stored = buildResultFromProduct(product);
      if (stored) return NextResponse.json(serialize(stored, "stored"));
    }
  }

  // 2. Cache hit
  if (!forceRefresh) {
    const cached = await readLookupCache(cacheKey);
    if (cached) return NextResponse.json(serialize(cached, "cache"));
  }

  // 3. Fresh external lookup
  const result = await enrichNutrition(productName, brand);

  // Log lookup attempts
  if (productId) {
    for (const log of result.logs) {
      await prisma.nutritionLookupLog.create({
        data: {
          productId,
          provider: log.provider,
          query: productName,
          resultCount: log.candidates.length,
          bestMatchName: log.candidates[0]?.name ?? null,
          bestMatchId: log.candidates[0]?.externalId ?? null,
          confidence: log.candidates[0]?.score ?? null,
          accepted: false,
          rawResponse: JSON.stringify(log.candidates.slice(0, 3)),
          error: log.error ?? null,
        },
      });
    }
  }

  const cacheable: CachedLookupResult = {
    matched: result.matched,
    confidence: result.confidence,
    source: result.source,
    sourceType: result.sourceType,
    bestMatch: result.candidate
      ? toCached(result.candidate)
      : null,
    candidates: result.allCandidates.slice(0, 5).map(toCached),
  };

  // Persist to cache so subsequent lookups are stable
  await writeLookupCache(cacheKey, productName, brand, cacheable);

  // Auto-apply if requested and we have a good match, but NEVER silently
  // overwrite an existing accepted/manual canonical match unless the
  // caller explicitly asked for a forced refresh.
  if (autoApply && productId && result.matched) {
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    const hasAccepted = existing ? productHasAcceptedMatch(existing) : false;
    if (!hasAccepted || forceRefresh) {
      const updates = applyEnrichment(result);
      if (updates) {
        await prisma.product.update({
          where: { id: productId },
          data: updates as Record<string, unknown>,
        });
        if (result.candidate) {
          await prisma.nutritionLookupLog.updateMany({
            where: {
              productId,
              bestMatchId: result.candidate.externalId,
              accepted: false,
            },
            data: { accepted: true },
          });
        }
      }
    }
  }

  return NextResponse.json(serialize(cacheable, "api"));
}

function toCached(c: {
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
}): CachedCandidate {
  return {
    name: c.name,
    brand: c.brand ?? null,
    externalId: c.externalId,
    provider: c.provider,
    caloriesPer100g: c.caloriesPer100g,
    proteinPer100g: c.proteinPer100g,
    fatPer100g: c.fatPer100g,
    carbsPer100g: c.carbsPer100g,
    sugarPer100g: c.sugarPer100g ?? null,
    sodiumPer100g: c.sodiumPer100g ?? null,
    score: c.score,
  };
}

function serialize(r: CachedLookupResult, origin: "stored" | "cache" | "api") {
  return {
    matched: r.matched,
    confidence: r.confidence,
    source: r.source,
    sourceType: r.sourceType,
    origin, // "stored" | "cache" | "api" — helps clients reason about freshness
    bestMatch: r.bestMatch,
    candidates: r.candidates,
  };
}
