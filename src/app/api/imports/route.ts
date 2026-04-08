import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseCSV, parseText, parsePDFText } from "@/lib/import-parser";
import { extractPDFText } from "@/lib/pdf";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const sourceType = formData.get("sourceType") as string;
  const text = formData.get("text") as string | null;
  const file = formData.get("file") as File | null;

  let rawText = "";
  let parsedItems;

  if (sourceType === "csv" && file) {
    rawText = await file.text();
    parsedItems = parseCSV(rawText);
  } else if (sourceType === "text" && text) {
    rawText = text;
    parsedItems = parseText(rawText);
  } else if (sourceType === "pdf" && file) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await extractPDFText(buffer);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    rawText = result.text;
    parsedItems = parsePDFText(rawText);
  } else {
    return NextResponse.json({ error: "Invalid source type or missing data" }, { status: 400 });
  }

  if (!parsedItems || parsedItems.length === 0) {
    return NextResponse.json({ error: "No items could be parsed" }, { status: 400 });
  }

  // Try to match parsed items to existing products
  const products = await prisma.product.findMany();
  const productsByName = new Map(products.map((p) => [p.name.toLowerCase(), p]));

  for (const item of parsedItems) {
    const match = productsByName.get(item.parsedName.toLowerCase());
    if (match) {
      item.confidence = Math.min(item.confidence + 0.3, 1);
      item.needsReview = false;
    }
  }

  // Create import record
  const importRecord = await prisma.purchaseImport.create({
    data: {
      sourceType,
      rawText,
      parseStatus: "parsed",
      items: {
        create: parsedItems.map((item) => ({
          rawName: item.rawName,
          parsedName: item.parsedName,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          totalWeightGrams: item.totalWeightGrams,
          totalVolumeMl: item.totalVolumeMl ?? null,
          purchaseDate: item.purchaseDate ? new Date(item.purchaseDate) : null,
          matchedProductId: productsByName.get(item.parsedName.toLowerCase())?.id ?? null,
          confidence: item.confidence,
          needsReview: item.needsReview,
          isFood: item.isFood,
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json({
    importId: importRecord.id,
    items: parsedItems,
  });
}
