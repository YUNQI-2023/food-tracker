import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { manualEntrySchema } from "@/lib/schemas";
import { enrichNutrition, applyEnrichment } from "@/lib/nutrition/enrichment";
import { estimateExpiry } from "@/lib/shelf-life";
import { inferStorageType, type StorageType } from "@/lib/food-normalization";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = manualEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const data = parsed.data;
  const purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : new Date();

  // Find or create product
  let product = await prisma.product.findFirst({
    where: { name: { equals: data.name } },
  });

  if (!product) {
    const allProducts = await prisma.product.findMany();
    product = allProducts.find(
      (p) => p.name.toLowerCase() === data.name.toLowerCase()
    ) ?? null;
  }

  if (!product) {
    product = await prisma.product.create({
      data: {
        name: data.name,
        brand: data.brand || null,
        category: data.category || "other",
        defaultUnit: data.unit || "unit",
        isFood: data.isFood ?? true,
      },
    });
  }

  // Auto-enrich nutrition if food and no nutrition data
  // Use a 5s timeout so slow API calls don't block the entry
  if ((data.isFood ?? true) && product.caloriesPer100g == null) {
    try {
      const enrichResult = await Promise.race([
        enrichNutrition(data.name, data.brand),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
      ]);
      const updates = applyEnrichment(enrichResult);
      if (updates) {
        product = await prisma.product.update({
          where: { id: product.id },
          data: updates as Record<string, unknown>,
        });
      }
    } catch {
      // Best-effort
    }
  }

  const expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
  const category = data.category || product.category || "other";

  // Determine storage type: explicit storageType > storageLocation match > inferred
  const storageType: StorageType = data.storageType
    ? data.storageType as StorageType
    : (data.storageLocation && ["refrigerated", "frozen", "pantry", "room_temp"].includes(data.storageLocation))
      ? data.storageLocation as StorageType
      : inferStorageType(data.name, category);

  // Estimate shelf life
  const isFood = data.isFood ?? true;
  const estimate = isFood
    ? estimateExpiry({
        name: data.name,
        category,
        purchaseDate,
        expiryDate,
        storageType,
        productShelfLifeDays: product.shelfLifeDays,
        productOpenedShelfLifeDays: product.openedShelfLifeDays,
      })
    : null;

  const estimatedExpiryDate = estimate?.estimatedExpiryDate ?? null;

  // Update product with shelf-life from rule if not already set
  if (estimate?.matchedRule && !product.shelfLifeDays) {
    await prisma.product.update({
      where: { id: product.id },
      data: {
        shelfLifeDays: estimate.matchedRule.defaultShelfLifeDays,
        openedShelfLifeDays: estimate.matchedRule.openedShelfLifeDays ?? product.openedShelfLifeDays,
      },
    });
  }

  const batch = await prisma.inventoryBatch.create({
    data: {
      productId: product.id,
      sourceType: "manual",
      purchaseDate,
      quantityInitial: data.quantity,
      quantityCurrent: data.quantity,
      unit: data.unit || product.defaultUnit,
      totalWeightGrams: data.totalWeightGrams ?? null,
      totalVolumeMl: data.totalVolumeMl ?? null,
      expiryDate,
      estimatedExpiryDate: expiryDate ? null : estimatedExpiryDate,
      storageType,
      storageLocation: data.storageLocation || null,
      shelfLifeSource: estimate?.shelfLifeSource ?? null,
      shelfLifeConfidence: estimate?.shelfLifeConfidence ?? null,
      shelfLifeReason: estimate?.shelfLifeReason ?? null,
      notes: data.notes || null,
      status: "fresh",
    },
    include: { product: true },
  });

  return NextResponse.json(batch);
}
