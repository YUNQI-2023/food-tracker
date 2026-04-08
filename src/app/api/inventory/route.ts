import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeExpiryStatus, daysUntilExpiry, getEffectiveExpiryDateWithSource } from "@/lib/expiry";
import { calculateConsumptionNutrition } from "@/lib/nutrition";
import { inventoryUpdateSchema } from "@/lib/schemas";
import { addDays } from "date-fns";
import { estimateExpiry } from "@/lib/shelf-life";
import { inferStorageType, type StorageType } from "@/lib/food-normalization";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") || "all";
  const category = searchParams.get("category") || "";

  const batches = await prisma.inventoryBatch.findMany({
    where: {
      ...(filter === "consumed" ? {} : { quantityCurrent: { gt: 0 } }),
    },
    include: { product: true },
    orderBy: { purchaseDate: "desc" },
  });

  const results = batches
    .map((b) => {
      const expiryInput = {
        expiryDate: b.expiryDate,
        estimatedExpiryDate: b.estimatedExpiryDate,
        openedDate: b.openedDate,
        purchaseDate: b.purchaseDate,
        shelfLifeDays: b.product.shelfLifeDays,
        openedShelfLifeDays: b.product.openedShelfLifeDays,
      };
      const status = computeExpiryStatus(expiryInput);
      const days = daysUntilExpiry(expiryInput);
      const { source: expirySource } = getEffectiveExpiryDateWithSource(expiryInput);

      return {
        ...b,
        computedStatus: status,
        daysUntilExpiry: days,
        expirySource,
        storageType: b.storageType || inferStorageType(b.product.name, b.product.category),
        shelfLifeSource: b.shelfLifeSource,
        shelfLifeConfidence: b.shelfLifeConfidence,
        shelfLifeReason: b.shelfLifeReason,
      };
    })
    .filter((b) => {
      if (filter === "expiring_soon") return b.computedStatus === "expiring_soon";
      if (filter === "expired") return b.computedStatus === "expired";
      if (filter === "all") return b.computedStatus !== "consumed";
      return true;
    })
    .filter((b) => {
      if (category) return b.product.category === category;
      return true;
    });

  return NextResponse.json(results);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = inventoryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { id, action, quantity, mealType, storageLocation, expiryDate, notes } = parsed.data;

  const batch = await prisma.inventoryBatch.findUnique({
    where: { id },
    include: { product: true },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  if (action === "delete") {
    // Check for linked consumption logs
    const logCount = await prisma.consumptionLog.count({
      where: { inventoryBatchId: id },
    });
    const mealItemCount = await prisma.mealItem.count({
      where: { inventoryBatchId: id },
    });

    if (logCount > 0 || mealItemCount > 0) {
      // Soft delete: mark as consumed with 0 quantity
      const updatedBatch = await prisma.inventoryBatch.update({
        where: { id },
        data: { quantityCurrent: 0, status: "consumed", notes: (batch.notes || "") + " [deleted]" },
      });
      return NextResponse.json(updatedBatch);
    }

    // Hard delete: no linked records
    await prisma.inventoryBatch.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  }

  if (action === "decrement") {
    const decrementQty = quantity ?? 1;
    const newQty = Math.max(0, batch.quantityCurrent - decrementQty);
    const actualDecrement = batch.quantityCurrent - newQty;

    if (actualDecrement <= 0) {
      return NextResponse.json({ error: "Nothing to decrement" }, { status: 400 });
    }

    const batchInfo = { totalWeightGrams: batch.totalWeightGrams, quantityInitial: batch.quantityInitial };
    const nutrition = calculateConsumptionNutrition(
      actualDecrement,
      batch.product.gramsPerUnit,
      batch.product,
      batchInfo
    );

    const effectiveGramsPerUnit = batch.product.gramsPerUnit
      ?? (batch.totalWeightGrams && batch.quantityInitial > 0 ? batch.totalWeightGrams / batch.quantityInitial : null);
    const weightUsed = effectiveGramsPerUnit
      ? actualDecrement * effectiveGramsPerUnit
      : null;

    const [updatedBatch] = await prisma.$transaction([
      prisma.inventoryBatch.update({
        where: { id },
        data: {
          quantityCurrent: newQty,
          totalWeightGrams: batch.totalWeightGrams && batch.product.gramsPerUnit
            ? Math.max(0, (batch.totalWeightGrams ?? 0) - (weightUsed ?? 0))
            : batch.totalWeightGrams,
          status: newQty === 0 ? "consumed" : batch.status,
        },
      }),
      prisma.consumptionLog.create({
        data: {
          inventoryBatchId: id,
          mealType: mealType || "snack",
          quantityUsed: actualDecrement,
          unit: batch.unit,
          weightUsedGrams: weightUsed,
          calories: nutrition.calories,
          protein: nutrition.protein,
          fat: nutrition.fat,
          carbs: nutrition.carbs,
          notes: notes || null,
        },
      }),
    ]);

    return NextResponse.json(updatedBatch);
  }

  if (action === "increment") {
    const incrementQty = quantity ?? 1;
    const updatedBatch = await prisma.inventoryBatch.update({
      where: { id },
      data: {
        quantityCurrent: batch.quantityCurrent + incrementQty,
        totalWeightGrams: batch.totalWeightGrams && batch.product.gramsPerUnit
          ? batch.totalWeightGrams + incrementQty * batch.product.gramsPerUnit
          : batch.totalWeightGrams,
        status: "fresh",
      },
    });
    return NextResponse.json(updatedBatch);
  }

  if (action === "markOpened") {
    const openedDate = new Date();
    const storageType = (batch.storageType as StorageType) || inferStorageType(batch.product.name, batch.product.category);

    // Re-estimate expiry using shelf-life engine with opened date
    const estimate = estimateExpiry({
      name: batch.product.name,
      category: batch.product.category,
      purchaseDate: batch.purchaseDate,
      expiryDate: batch.expiryDate,
      openedDate,
      storageType,
      productShelfLifeDays: batch.product.shelfLifeDays,
      productOpenedShelfLifeDays: batch.product.openedShelfLifeDays,
    });

    const updatedBatch = await prisma.inventoryBatch.update({
      where: { id },
      data: {
        openedDate,
        estimatedExpiryDate: estimate.estimatedExpiryDate,
        shelfLifeSource: estimate.shelfLifeSource,
        shelfLifeConfidence: estimate.shelfLifeConfidence,
        shelfLifeReason: estimate.shelfLifeReason,
      },
    });
    return NextResponse.json(updatedBatch);
  }

  if (action === "markFinished") {
    const [updatedBatch] = await prisma.$transaction([
      prisma.inventoryBatch.update({
        where: { id },
        data: { quantityCurrent: 0, status: "consumed" },
      }),
      prisma.consumptionLog.create({
        data: {
          inventoryBatchId: id,
          mealType: mealType || "snack",
          quantityUsed: batch.quantityCurrent,
          unit: batch.unit,
          weightUsedGrams: batch.totalWeightGrams,
          calories: batch.product.caloriesPer100g && batch.totalWeightGrams
            ? Math.round((batch.product.caloriesPer100g * batch.totalWeightGrams) / 100)
            : null,
          protein: batch.product.proteinPer100g && batch.totalWeightGrams
            ? Math.round((batch.product.proteinPer100g * batch.totalWeightGrams) / 100 * 10) / 10
            : null,
          fat: batch.product.fatPer100g && batch.totalWeightGrams
            ? Math.round((batch.product.fatPer100g * batch.totalWeightGrams) / 100 * 10) / 10
            : null,
          carbs: batch.product.carbsPer100g && batch.totalWeightGrams
            ? Math.round((batch.product.carbsPer100g * batch.totalWeightGrams) / 100 * 10) / 10
            : null,
        },
      }),
    ]);
    return NextResponse.json(updatedBatch);
  }

  if (action === "edit") {
    const updateData: Record<string, unknown> = {};
    if (storageLocation !== undefined) updateData.storageLocation = storageLocation;
    if (notes !== undefined) updateData.notes = notes;

    // If user explicitly sets an expiry date, that overrides any estimate
    if (expiryDate) {
      updateData.expiryDate = new Date(expiryDate);
      updateData.shelfLifeSource = "explicit";
      updateData.shelfLifeConfidence = "high";
      updateData.shelfLifeReason = "Using explicit package expiry date";
      // Clear the estimated date since explicit takes priority
      updateData.estimatedExpiryDate = null;
    }

    // If storageType is provided via storageLocation matching known types, update it
    if (storageLocation && ["refrigerated", "frozen", "pantry", "room_temp"].includes(storageLocation)) {
      updateData.storageType = storageLocation;
    }

    const updatedBatch = await prisma.inventoryBatch.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json(updatedBatch);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
