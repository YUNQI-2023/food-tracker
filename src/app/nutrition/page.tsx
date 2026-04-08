"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DayData {
  date: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  meals: Array<{
    id: number;
    mealType: string;
    productName: string;
    recipeName: string | null;
    quantityUsed: number;
    unit: string;
    calories: number | null;
    protein: number | null;
    fat: number | null;
    carbs: number | null;
    consumedAt: string;
  }>;
}

export default function NutritionPage() {
  const [data, setData] = useState<DayData[]>([]);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetch(`/api/nutrition?days=${days}`)
      .then((r) => r.json())
      .then(setData);
  }, [days]);

  const today = data.length > 0 ? data[data.length - 1] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nutrition</h1>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="border border-border rounded px-3 py-1.5 text-sm bg-background"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      {/* Today's Summary */}
      {today && (
        <div className="bg-card rounded-lg border border-border p-4">
          <h2 className="font-semibold mb-3">Today&apos;s Summary</h2>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Calories</div>
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(today.calories)}
              </div>
              <div className="text-xs text-muted-foreground">kcal</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Protein</div>
              <div className="text-2xl font-bold text-blue-600">
                {Math.round(today.protein * 10) / 10}
              </div>
              <div className="text-xs text-muted-foreground">grams</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Fat</div>
              <div className="text-2xl font-bold text-yellow-600">
                {Math.round(today.fat * 10) / 10}
              </div>
              <div className="text-xs text-muted-foreground">grams</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Carbs</div>
              <div className="text-2xl font-bold text-green-600">
                {Math.round(today.carbs * 10) / 10}
              </div>
              <div className="text-xs text-muted-foreground">grams</div>
            </div>
          </div>
        </div>
      )}

      {/* Calories Chart */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h2 className="font-semibold mb-3">Daily Calories</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="calories" fill="#f97316" radius={[4, 4, 0, 0]} name="Calories" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Macros Chart */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h2 className="font-semibold mb-3">Daily Macros</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="protein" fill="#2563eb" radius={[2, 2, 0, 0]} name="Protein (g)" />
              <Bar dataKey="fat" fill="#eab308" radius={[2, 2, 0, 0]} name="Fat (g)" />
              <Bar dataKey="carbs" fill="#22c55e" radius={[2, 2, 0, 0]} name="Carbs (g)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Today's Meals */}
      {today && today.meals.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-4">
          <h2 className="font-semibold mb-3">Today&apos;s Meals</h2>
          <div className="space-y-2">
            {today.meals.map((meal) => (
              <div
                key={meal.id}
                className="flex items-center justify-between py-2 px-3 bg-secondary/50 rounded"
              >
                <div>
                  <span className="text-xs font-medium uppercase text-muted-foreground mr-2">
                    {meal.mealType}
                  </span>
                  <span className="text-sm font-medium">{meal.productName}</span>
                  {meal.recipeName && (
                    <span className="text-xs text-primary ml-1">({meal.recipeName})</span>
                  )}
                  <span className="text-xs text-muted-foreground ml-2">
                    {meal.quantityUsed} {meal.unit}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {meal.calories != null && (
                    <span className="text-orange-600 font-medium mr-2">
                      {Math.round(meal.calories)} kcal
                    </span>
                  )}
                  {meal.protein != null && <span>P:{Math.round(meal.protein)}g </span>}
                  {meal.fat != null && <span>F:{Math.round(meal.fat)}g </span>}
                  {meal.carbs != null && <span>C:{Math.round(meal.carbs)}g</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
