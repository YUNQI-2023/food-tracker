import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logMealSchema } from "@/lib/schemas";
import { calculateConsumptionNutrition } from "@/lib/nutrition";
import { startOfDay, endOfDay } from "date-fns";
import { parseLocalDate } from "@/lib/date-utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");

  let start: Date, end: Date;
  if (dateStr) {
    // Parse YYYY-MM-DD as local midnight (not UTC)
    const localDate = parseLocalDate(dateStr);
    start = startOfDay(localDate);
    end = endOfDay(localDate);
  } else {
    start = startOfDay(new Date());
    end = endOfDay(new Date());
  }

  // Return meals (new model) with their items
  const meals = await prisma.meal.findMany({
    where: { consumedAt: { gte: start, lte: end } },
    include: {
      items: {
        include: {
          inventoryBatch: { include: { product: true } },
        },
      },
      recipe: true,
    },
    orderBy: { consumedAt: "desc" },
  });

  // Also fetch standalone consumption logs (not linked to a meal) for backward compat
  const standaloneLogs = await prisma.consumptionLog.findMany({
    where: {
      consumedAt: { gte: start, lte: end },
      mealId: null,
    },
    include: {
      inventoryBatch: { include: { product: true } },
      recipe: true,
    },
    orderBy: { consumedAt: "desc" },
  });

  return NextResponse.json({ meals, standaloneLogs });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = logMealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { mealType, items, notes, recipeId } = parsed.data;

  // Validate all batches first
  const batchIds = items.map((i) => i.inventoryBatchId);
  const batches = await prisma.inventoryBatch.findMany({
    where: { id: { in: batchIds } },
    include: { product: true },
  });
  const batchMap = new Map(batches.map((b) => [b.id, b]));

  for (const item of items) {
    const batch = batchMap.get(item.inventoryBatchId);
    if (!batch) {
      return NextResponse.json({ error: `Batch ${item.inventoryBatchId} not found` }, { status: 404 });
    }
    if (batch.quantityCurrent < item.quantityUsed) {
      return NextResponse.json({
        error: `Not enough ${batch.product.name}: have ${batch.quantityCurrent}, need ${item.quantityUsed}`,
      }, { status: 400 });
    }
  }

  // Build meal items with nutrition
  let totalCalories = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;

  const mealItemsData = items.map((item) => {
    const batch = batchMap.get(item.inventoryBatchId)!;
    const batchInfo = { totalWeightGrams: batch.totalWeightGrams, quantityInitial: batch.quantityInitial };
    const nutrition = calculateConsumptionNutrition(
      item.quantityUsed,
      batch.product.gramsPerUnit,
      batch.product,
      batchInfo
    );
    const effectiveGramsPerUnit = batch.product.gramsPerUnit
      ?? (batch.totalWeightGrams && batch.quantityInitial > 0 ? batch.totalWeightGrams / batch.quantityInitial : null);
    const weightUsed = effectiveGramsPerUnit
      ? item.quantityUsed * effectiveGramsPerUnit
      : null;

    totalCalories += nutrition.calories ?? 0;
    totalProtein += nutrition.protein ?? 0;
    totalFat += nutrition.fat ?? 0;
    totalCarbs += nutrition.carbs ?? 0;

    return {
      inventoryBatchId: item.inventoryBatchId,
      quantityUsed: item.quantityUsed,
      unit: item.unit,
      weightUsedGrams: weightUsed,
      calories: nutrition.calories,
      protein: nutrition.protein,
      fat: nutrition.fat,
      carbs: nutrition.carbs,
    };
  });

  // Create meal with items in a transaction
  const meal = await prisma.$transaction(async (tx) => {
    const createdMeal = await tx.meal.create({
      data: {
        mealType,
        notes: notes || null,
        recipeId: recipeId || null,
        calories: totalCalories || null,
        protein: totalProtein || null,
        fat: totalFat || null,
        carbs: totalCarbs || null,
        items: {
          create: mealItemsData,
        },
      },
      include: {
        items: { include: { inventoryBatch: { include: { product: true } } } },
      },
    });

    // Create consumption logs for each item (linked to meal)
    for (const item of items) {
      const batch = batchMap.get(item.inventoryBatchId)!;
      const batchInfoLog = { totalWeightGrams: batch.totalWeightGrams, quantityInitial: batch.quantityInitial };
      const nutrition = calculateConsumptionNutrition(
        item.quantityUsed,
        batch.product.gramsPerUnit,
        batch.product,
        batchInfoLog
      );
      const effectiveGpu = batch.product.gramsPerUnit
        ?? (batch.totalWeightGrams && batch.quantityInitial > 0 ? batch.totalWeightGrams / batch.quantityInitial : null);
      const weightUsed = effectiveGpu
        ? item.quantityUsed * effectiveGpu
        : null;

      await tx.consumptionLog.create({
        data: {
          inventoryBatchId: item.inventoryBatchId,
          mealType,
          quantityUsed: item.quantityUsed,
          unit: item.unit,
          weightUsedGrams: weightUsed,
          calories: nutrition.calories,
          protein: nutrition.protein,
          fat: nutrition.fat,
          carbs: nutrition.carbs,
          notes: notes || null,
          recipeId: recipeId || null,
          mealId: createdMeal.id,
        },
      });

      // Decrement inventory
      const newQty = Math.max(0, batch.quantityCurrent - item.quantityUsed);
      await tx.inventoryBatch.update({
        where: { id: item.inventoryBatchId },
        data: {
          quantityCurrent: newQty,
          totalWeightGrams: batch.totalWeightGrams && weightUsed
            ? Math.max(0, batch.totalWeightGrams - weightUsed)
            : batch.totalWeightGrams,
          status: newQty === 0 ? "consumed" : batch.status,
        },
      });
    }

    return createdMeal;
  });

  return NextResponse.json(meal);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mealId = parseInt(searchParams.get("mealId") || "");
  const logId = parseInt(searchParams.get("logId") || "");

  if (mealId) {
    // Delete a meal and restore inventory
    const meal = await prisma.meal.findUnique({
      where: { id: mealId },
      include: { items: true, consumptionLogs: true },
    });

    if (!meal) {
      return NextResponse.json({ error: "Meal not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Restore inventory for each item
      for (const item of meal.items) {
        const batch = await tx.inventoryBatch.findUnique({
          where: { id: item.inventoryBatchId },
        });
        if (batch) {
          await tx.inventoryBatch.update({
            where: { id: item.inventoryBatchId },
            data: {
              quantityCurrent: batch.quantityCurrent + item.quantityUsed,
              totalWeightGrams: batch.totalWeightGrams != null && item.weightUsedGrams
                ? batch.totalWeightGrams + item.weightUsedGrams
                : batch.totalWeightGrams,
              status: batch.status === "consumed" ? "fresh" : batch.status,
            },
          });
        }
      }

      // Delete consumption logs linked to this meal
      await tx.consumptionLog.deleteMany({ where: { mealId } });

      // Delete meal (cascades to MealItems)
      await tx.meal.delete({ where: { id: mealId } });
    });

    return NextResponse.json({ deleted: true, restored: meal.items.length });
  }

  if (logId) {
    // Delete a standalone consumption log and restore inventory
    const log = await prisma.consumptionLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      const batch = await tx.inventoryBatch.findUnique({
        where: { id: log.inventoryBatchId },
      });
      if (batch) {
        await tx.inventoryBatch.update({
          where: { id: log.inventoryBatchId },
          data: {
            quantityCurrent: batch.quantityCurrent + log.quantityUsed,
            totalWeightGrams: batch.totalWeightGrams != null && log.weightUsedGrams
              ? batch.totalWeightGrams + log.weightUsedGrams
              : batch.totalWeightGrams,
            status: batch.status === "consumed" ? "fresh" : batch.status,
          },
        });
      }

      await tx.consumptionLog.delete({ where: { id: logId } });
    });

    return NextResponse.json({ deleted: true });
  }

  return NextResponse.json({ error: "Provide mealId or logId" }, { status: 400 });
}

export async function PUT(request: NextRequest) {
  // Edit a meal: update mealType, notes
  const body = await request.json();
  const { mealId, mealType, notes } = body;

  if (!mealId) {
    return NextResponse.json({ error: "mealId required" }, { status: 400 });
  }

  const meal = await prisma.meal.findUnique({ where: { id: mealId } });
  if (!meal) {
    return NextResponse.json({ error: "Meal not found" }, { status: 404 });
  }

  const updated = await prisma.meal.update({
    where: { id: mealId },
    data: {
      ...(mealType ? { mealType } : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
    },
    include: {
      items: { include: { inventoryBatch: { include: { product: true } } } },
    },
  });

  // Also update the linked consumption logs' mealType if changed
  if (mealType) {
    await prisma.consumptionLog.updateMany({
      where: { mealId },
      data: { mealType },
    });
  }

  return NextResponse.json(updated);
}
