import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateConsumptionNutrition } from "@/lib/nutrition";

export async function POST(request: NextRequest) {
  const { recipeId, mealType } = await request.json();

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: { ingredients: true },
  });

  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  // Find inventory batches for each ingredient (food items only)
  const batches = await prisma.inventoryBatch.findMany({
    where: { quantityCurrent: { gt: 0 }, status: { not: "consumed" } },
    include: { product: true },
    orderBy: { expiryDate: "asc" }, // Use expiring-first
  });

  const foodBatches = batches.filter((b) => b.product.isFood);

  const consumptions: Array<{
    batchId: number;
    quantity: number;
    unit: string;
    product: typeof foodBatches[0]["product"];
  }> = [];

  for (const ingredient of recipe.ingredients) {
    const match = foodBatches.find(
      (b) =>
        b.product.name.toLowerCase() === ingredient.ingredientName.toLowerCase() &&
        b.quantityCurrent >= ingredient.quantity
    );

    if (match) {
      consumptions.push({
        batchId: match.id,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        product: match.product,
      });
    }
  }

  // Create a Meal record and execute all consumptions
  const result = await prisma.$transaction(async (tx) => {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;

    const mealItemsData = consumptions.map((c) => {
      const nutrition = calculateConsumptionNutrition(
        c.quantity, c.product.gramsPerUnit, c.product
      );
      const weightUsed = c.product.gramsPerUnit ? c.quantity * c.product.gramsPerUnit : null;
      totalCalories += nutrition.calories ?? 0;
      totalProtein += nutrition.protein ?? 0;
      totalFat += nutrition.fat ?? 0;
      totalCarbs += nutrition.carbs ?? 0;
      return {
        inventoryBatchId: c.batchId,
        quantityUsed: c.quantity,
        unit: c.unit,
        weightUsedGrams: weightUsed,
        calories: nutrition.calories,
        protein: nutrition.protein,
        fat: nutrition.fat,
        carbs: nutrition.carbs,
      };
    });

    const meal = await tx.meal.create({
      data: {
        mealType: mealType || "dinner",
        recipeId: recipe.id,
        notes: `Cooked: ${recipe.name}`,
        calories: totalCalories || null,
        protein: totalProtein || null,
        fat: totalFat || null,
        carbs: totalCarbs || null,
        items: { create: mealItemsData },
      },
    });

    // Create consumption logs and decrement inventory
    for (const c of consumptions) {
      const nutrition = calculateConsumptionNutrition(
        c.quantity, c.product.gramsPerUnit, c.product
      );
      const weightUsed = c.product.gramsPerUnit ? c.quantity * c.product.gramsPerUnit : null;

      await tx.consumptionLog.create({
        data: {
          inventoryBatchId: c.batchId,
          mealType: mealType || "dinner",
          quantityUsed: c.quantity,
          unit: c.unit,
          weightUsedGrams: weightUsed,
          calories: nutrition.calories,
          protein: nutrition.protein,
          fat: nutrition.fat,
          carbs: nutrition.carbs,
          recipeId: recipe.id,
          notes: `Cooked: ${recipe.name}`,
          mealId: meal.id,
        },
      });

      const batch = await tx.inventoryBatch.findUnique({ where: { id: c.batchId } });
      if (batch) {
        const newQty = Math.max(0, batch.quantityCurrent - c.quantity);
        await tx.inventoryBatch.update({
          where: { id: c.batchId },
          data: {
            quantityCurrent: newQty,
            totalWeightGrams: weightUsed
              ? Math.max(0, (batch.totalWeightGrams ?? 0) - weightUsed)
              : batch.totalWeightGrams,
            status: newQty === 0 ? "consumed" : batch.status,
          },
        });
      }
    }

    return meal;
  });

  return NextResponse.json({
    cooked: recipe.name,
    mealId: result.id,
    consumedItems: consumptions.length,
    totalIngredients: recipe.ingredients.length,
  });
}
