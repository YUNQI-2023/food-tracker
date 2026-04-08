import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

  return NextResponse.json({ success: true });
}
