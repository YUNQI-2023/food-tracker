import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { formatLocalDate } from "@/lib/date-utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7");
  const now = new Date();

  const chartData = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = startOfDay(subDays(now, i));
    const dayEnd = endOfDay(subDays(now, i));

    // Get all consumption logs for the day (includes meal-linked and standalone)
    const logs = await prisma.consumptionLog.findMany({
      where: { consumedAt: { gte: dayStart, lte: dayEnd } },
      include: {
        inventoryBatch: { include: { product: true } },
        recipe: true,
        meal: true,
      },
    });

    // Only count logs from food items for nutrition
    const foodLogs = logs.filter((log) => log.inventoryBatch.product.isFood);

    const meals = foodLogs.map((log) => ({
      id: log.id,
      mealType: log.mealType,
      productName: log.inventoryBatch.product.name,
      recipeName: log.recipe?.name ?? null,
      quantityUsed: log.quantityUsed,
      unit: log.unit,
      calories: log.calories,
      protein: log.protein,
      fat: log.fat,
      carbs: log.carbs,
      consumedAt: log.consumedAt,
      mealId: log.mealId,
    }));

    const totals = foodLogs.reduce(
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
      ...totals,
      meals,
    });
  }

  return NextResponse.json(chartData);
}
