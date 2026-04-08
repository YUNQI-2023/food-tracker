import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enrichNutrition, applyEnrichment } from "@/lib/nutrition/enrichment";

/**
 * POST /api/nutrition/lookup
 * Look up nutrition for a product and optionally apply it.
 *
 * Body: { productId?: number, productName: string, brand?: string, autoApply?: boolean }
 *
 * If autoApply is true and a match is found above threshold, it updates the product.
 * Always returns the enrichment result with candidates.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { productId, productName, brand, autoApply } = body as {
    productId?: number;
    productName: string;
    brand?: string;
    autoApply?: boolean;
  };

  if (!productName) {
    return NextResponse.json({ error: "productName is required" }, { status: 400 });
  }

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

  // Auto-apply if requested and we have a good match
  if (autoApply && productId && result.matched) {
    const updates = applyEnrichment(result);
    if (updates) {
      await prisma.product.update({
        where: { id: productId },
        data: updates as Record<string, unknown>,
      });

      // Mark the log as accepted
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

  // Return serializable result
  return NextResponse.json({
    matched: result.matched,
    confidence: result.confidence,
    source: result.source,
    sourceType: result.sourceType,
    bestMatch: result.candidate
      ? {
          name: result.candidate.name,
          brand: result.candidate.brand,
          externalId: result.candidate.externalId,
          provider: result.candidate.provider,
          caloriesPer100g: result.candidate.caloriesPer100g,
          proteinPer100g: result.candidate.proteinPer100g,
          fatPer100g: result.candidate.fatPer100g,
          carbsPer100g: result.candidate.carbsPer100g,
          sugarPer100g: result.candidate.sugarPer100g,
          sodiumPer100g: result.candidate.sodiumPer100g,
          score: result.candidate.score,
        }
      : null,
    candidates: result.allCandidates.slice(0, 5).map((c) => ({
      name: c.name,
      brand: c.brand,
      externalId: c.externalId,
      provider: c.provider,
      caloriesPer100g: c.caloriesPer100g,
      proteinPer100g: c.proteinPer100g,
      fatPer100g: c.fatPer100g,
      carbsPer100g: c.carbsPer100g,
      score: c.score,
    })),
  });
}
