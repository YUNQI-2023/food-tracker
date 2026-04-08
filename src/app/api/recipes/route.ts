import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scoreRecipes } from "@/lib/recipe-scoring";

export async function GET() {
  const recipes = await prisma.recipe.findMany({
    include: { ingredients: true },
  });

  const batches = await prisma.inventoryBatch.findMany({
    where: { quantityCurrent: { gt: 0 }, status: { not: "consumed" } },
    include: { product: true },
  });

  // Only include food items for recipe scoring
  const inventory = batches
    .filter((b) => b.product.isFood)
    .map((b) => ({ batch: b, product: b.product }));
  const scored = scoreRecipes(recipes, inventory);

  return NextResponse.json(scored);
}
