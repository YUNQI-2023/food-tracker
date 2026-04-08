import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  normalizeCacheKey,
  writeLookupCache,
  type CachedCandidate,
  type CachedLookupResult,
} from "@/lib/nutrition/cache";

/**
 * POST /api/nutrition/apply
 * Manually select and apply a nutrition candidate to a product.
 *
 * Body: {
 *   productId: number,
 *   candidate: { name, brand, externalId, provider, caloriesPer100g, ... }
 *   confidence: number
 * }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { productId, candidate, confidence } = body;

  if (!productId || !candidate) {
    return NextResponse.json({ error: "productId and candidate are required" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      caloriesPer100g: candidate.caloriesPer100g ?? null,
      proteinPer100g: candidate.proteinPer100g ?? null,
      fatPer100g: candidate.fatPer100g ?? null,
      carbsPer100g: candidate.carbsPer100g ?? null,
      sugarPer100g: candidate.sugarPer100g ?? null,
      sodiumPer100g: candidate.sodiumPer100g ?? null,
      nutritionSource: candidate.provider,
      nutritionSourceType: "api",
      nutritionConfidence: confidence ?? null,
      externalProductId: candidate.externalId ?? null,
      externalQuery: candidate.name ?? null,
      nutritionLastFetchedAt: new Date(),
      rawNutritionJson: JSON.stringify(candidate),
    },
  });

  // Mark log as accepted
  await prisma.nutritionLookupLog.updateMany({
    where: {
      productId,
      bestMatchId: candidate.externalId,
    },
    data: { accepted: true },
  });

  // Persist the user-applied candidate into the lookup cache so that
  // future lookups for the same normalized name+brand deterministically
  // return this canonical match (treated as the source of truth).
  const cached: CachedCandidate = {
    name: candidate.name,
    brand: candidate.brand ?? product.brand ?? null,
    externalId: candidate.externalId ?? "",
    provider: candidate.provider,
    caloriesPer100g: candidate.caloriesPer100g ?? null,
    proteinPer100g: candidate.proteinPer100g ?? null,
    fatPer100g: candidate.fatPer100g ?? null,
    carbsPer100g: candidate.carbsPer100g ?? null,
    sugarPer100g: candidate.sugarPer100g ?? null,
    sodiumPer100g: candidate.sodiumPer100g ?? null,
    score: confidence ?? 1,
  };
  const cacheResult: CachedLookupResult = {
    matched: true,
    confidence: confidence ?? 1,
    source: candidate.provider,
    sourceType: "manual", // user explicitly selected this candidate
    bestMatch: cached,
    candidates: [cached],
  };
  const cacheKey = normalizeCacheKey(product.name, product.brand);
  await writeLookupCache(cacheKey, product.name, product.brand, cacheResult);

  return NextResponse.json({ success: true });
}
