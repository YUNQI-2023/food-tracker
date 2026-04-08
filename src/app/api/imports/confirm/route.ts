import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { confirmImportSchema } from "@/lib/schemas";
import { enrichNutrition, applyEnrichment } from "@/lib/nutrition/enrichment";
import { estimateExpiry } from "@/lib/shelf-life";
import { inferStorageType } from "@/lib/food-normalization";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = confirmImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { importId, items } = parsed.data;
  const createdBatches = [];

  for (const item of items) {
    const isFood = item.isFood ?? true;

    // Find matching product
    let product = await prisma.product.findFirst({
      where: { name: { equals: item.parsedName } },
    });

    if (!product) {
      const allProducts = await prisma.product.findMany();
      product = allProducts.find(
        (p) => p.name.toLowerCase() === item.parsedName.toLowerCase()
      ) ?? null;
    }

    // Create product if not found
    if (!product) {
      product = await prisma.product.create({
        data: {
          name: item.parsedName,
          category: item.category || "other",
          defaultUnit: item.unit || "unit",
          isFood,
        },
      });
    }

    // Auto-enrich nutrition in background after import completes
    // We don't await this — nutrition can be looked up later from the Nutrition page
    if (isFood && product.caloriesPer100g == null) {
      const productId = product.id;
      const parsedName = item.parsedName;
      Promise.race([
        enrichNutrition(parsedName),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
      ]).then(async (enrichResult) => {
        const updates = applyEnrichment(enrichResult);
        if (updates) {
          await prisma.product.update({
            where: { id: productId },
            data: updates as Record<string, unknown>,
          });
        }
      }).catch(() => {
        // Nutrition enrichment is best-effort
      });
    }

    const purchaseDate = item.purchaseDate ? new Date(item.purchaseDate) : new Date();
    const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
    const category = item.category || product.category || "other";

    // Infer storage type from name/category
    const storageType = inferStorageType(item.parsedName, category);

    // Estimate shelf life using rule engine
    const estimate = isFood
      ? estimateExpiry({
          name: item.parsedName,
          category,
          purchaseDate,
          expiryDate,
          storageType,
          productShelfLifeDays: product.shelfLifeDays,
          productOpenedShelfLifeDays: product.openedShelfLifeDays,
        })
      : null;

    // Use shelf-life estimate for estimated expiry if no explicit date
    const estimatedExpiryDate = estimate?.estimatedExpiryDate ?? null;

    // If shelf-life engine found a rule and product doesn't have shelf-life set, update product
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
        sourceType: "pdf",
        sourceImportId: importId,
        purchaseDate,
        quantityInitial: item.quantity,
        quantityCurrent: item.quantity,
        unit: item.unit || product.defaultUnit,
        totalWeightGrams: item.totalWeightGrams,
        totalVolumeMl: item.totalVolumeMl ?? null,
        expiryDate,
        estimatedExpiryDate: expiryDate ? null : estimatedExpiryDate,
        storageType,
        shelfLifeSource: estimate?.shelfLifeSource ?? null,
        shelfLifeConfidence: estimate?.shelfLifeConfidence ?? null,
        shelfLifeReason: estimate?.shelfLifeReason ?? null,
        status: "fresh",
      },
    });

    createdBatches.push(batch);
  }

  await prisma.purchaseImport.update({
    where: { id: importId },
    data: { parseStatus: "imported" },
  });

  return NextResponse.json({ created: createdBatches.length });
}
