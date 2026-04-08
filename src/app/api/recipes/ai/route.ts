import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeExpiryStatus, daysUntilExpiry } from "@/lib/expiry";
import {
  generateAIRecipeRecommendations,
  AIUnavailableError,
  AIResponseParseError,
  type InventorySummaryItem,
} from "@/lib/ai/recipe-ai";

/**
 * POST /api/recipes/ai
 *
 * AI-powered recipe recommendations based on current inventory.
 * The rule-based recipe recommender at /api/recipes is unaffected.
 *
 * Body: { count?: number }  (1..5, default 3)
 *
 * Responses:
 *   200 { recommendations: AIRecipe[] }
 *   503 { error } — AI provider not configured / unavailable
 *   502 { error } — AI responded but output could not be parsed
 *   500 { error } — unexpected failure
 */
export async function POST(request: NextRequest) {
  let count = 3;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.count === "number") {
      count = Math.max(1, Math.min(5, Math.round(body.count)));
    }
  } catch {
    // ignore — body is optional
  }

  // Load current, non-consumed food inventory (same predicate the rule-based
  // recommender uses) and summarize with expiry context for the prompt.
  const batches = await prisma.inventoryBatch.findMany({
    where: { quantityCurrent: { gt: 0 }, status: { not: "consumed" } },
    include: { product: true },
    orderBy: { expiryDate: "asc" },
  });

  const summary: InventorySummaryItem[] = batches
    .filter((b) => b.product.isFood)
    .map((b) => {
      const expiryInput = {
        expiryDate: b.expiryDate,
        estimatedExpiryDate: b.estimatedExpiryDate,
        openedDate: b.openedDate,
        purchaseDate: b.purchaseDate,
        shelfLifeDays: b.product.shelfLifeDays,
        openedShelfLifeDays: b.product.openedShelfLifeDays,
      };
      return {
        name: b.product.name,
        brand: b.product.brand,
        category: b.product.category,
        quantity: b.quantityCurrent,
        unit: b.unit,
        weightGrams: b.totalWeightGrams,
        daysUntilExpiry: daysUntilExpiry(expiryInput),
        status: computeExpiryStatus(expiryInput),
        caloriesPer100g: b.product.caloriesPer100g,
        proteinPer100g: b.product.proteinPer100g,
      };
    });

  if (summary.length === 0) {
    return NextResponse.json(
      { error: "No food items in inventory to build recommendations from." },
      { status: 400 }
    );
  }

  try {
    const result = await generateAIRecipeRecommendations(summary, count);
    return NextResponse.json({
      recommendations: result.recommendations,
      inventoryItemCount: summary.length,
    });
  } catch (err) {
    if (err instanceof AIUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof AIResponseParseError) {
      return NextResponse.json(
        { error: err.message, raw: err.raw },
        { status: 502 }
      );
    }
    console.error("[recipes/ai] unexpected error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Unexpected error" },
      { status: 500 }
    );
  }
}
