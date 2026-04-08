import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { computeExpiryStatus, daysUntilExpiry } from "@/lib/expiry";
import { formatLocalDate } from "@/lib/date-utils";

export async function GET() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  // Get all active batches for food items only
  const batches = await prisma.inventoryBatch.findMany({
    where: { status: { not: "consumed" }, quantityCurrent: { gt: 0 } },
    include: { product: true },
  });

  // Filter to food items
  const foodBatches = batches.filter((b) => b.product.isFood);

  let activeCount = 0;
  let expiringSoonCount = 0;
  let expiredCount = 0;
  const expiringSoonItems: Array<{
    id: number;
    name: string;
    daysLeft: number | null;
    quantity: number;
    unit: string;
  }> = [];

  for (const b of foodBatches) {
    const status = computeExpiryStatus({
      expiryDate: b.expiryDate,
      estimatedExpiryDate: b.estimatedExpiryDate,
      openedDate: b.openedDate,
      purchaseDate: b.purchaseDate,
      shelfLifeDays: b.product.shelfLifeDays,
      openedShelfLifeDays: b.product.openedShelfLifeDays,
    });

    activeCount++;
    if (status === "expired") {
      expiredCount++;
    } else if (status === "expiring_soon") {
      expiringSoonCount++;
      expiringSoonItems.push({
        id: b.id,
        name: b.product.name,
        daysLeft: daysUntilExpiry({
          expiryDate: b.expiryDate,
          estimatedExpiryDate: b.estimatedExpiryDate,
          openedDate: b.openedDate,
          purchaseDate: b.purchaseDate,
          shelfLifeDays: b.product.shelfLifeDays,
          openedShelfLifeDays: b.product.openedShelfLifeDays,
        }),
        quantity: b.quantityCurrent,
        unit: b.unit,
      });
    }
  }

  // Today's consumption (food only)
  const todayLogs = await prisma.consumptionLog.findMany({
    where: { consumedAt: { gte: todayStart, lte: todayEnd } },
    include: { inventoryBatch: { include: { product: true } } },
  });

  const foodLogs = todayLogs.filter((log) => log.inventoryBatch.product.isFood);
  const todayNutrition = foodLogs.reduce(
    (acc, log) => ({
      calories: acc.calories + (log.calories ?? 0),
      protein: acc.protein + (log.protein ?? 0),
      fat: acc.fat + (log.fat ?? 0),
      carbs: acc.carbs + (log.carbs ?? 0),
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  // Recent 7 days chart data
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = startOfDay(subDays(now, i));
    const dayEnd = endOfDay(subDays(now, i));
    const logs = await prisma.consumptionLog.findMany({
      where: { consumedAt: { gte: dayStart, lte: dayEnd } },
      include: { inventoryBatch: { include: { product: true } } },
    });
    const dayFoodLogs = logs.filter((log) => log.inventoryBatch.product.isFood);
    const daySums = dayFoodLogs.reduce(
      (acc, log) => ({
        calories: acc.calories + (log.calories ?? 0),
        protein: acc.protein + (log.protein ?? 0),
        fat: acc.fat + (log.fat ?? 0),
        carbs: acc.carbs + (log.carbs ?? 0),
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );
    chartData.push({
      date: formatLocalDate(dayStart),
      ...daySums,
    });
  }

  return NextResponse.json({
    activeCount,
    expiringSoonCount,
    expiredCount,
    expiringSoonItems: expiringSoonItems.sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999)),
    todayNutrition,
    chartData,
  });
}
