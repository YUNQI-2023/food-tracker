"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  AlertTriangle,
  XCircle,
  Flame,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardData {
  activeCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  expiringSoonItems: Array<{
    id: number;
    name: string;
    daysLeft: number | null;
    quantity: number;
    unit: string;
  }>;
  todayNutrition: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  };
  chartData: Array<{
    date: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  }>;
}

interface ScoredRecipe {
  recipe: { id: number; name: string; description: string; estimatedCalories: number | null };
  score: number;
  matchedIngredients: string[];
  missingIngredients: string[];
  coveragePercent: number;
  expiringMatchCount: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [recipes, setRecipes] = useState<ScoredRecipe[]>([]);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then(setData);
    fetch("/api/recipes").then((r) => r.json()).then((r) => setRecipes(r.slice(0, 4)));
  }, []);

  if (!data) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Package className="h-5 w-5 text-blue-600" />}
          label="Active Items"
          value={data.activeCount}
          color="bg-blue-50"
          href="/inventory"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
          label="Expiring Soon"
          value={data.expiringSoonCount}
          color="bg-amber-50"
          href="/inventory?filter=expiring_soon"
        />
        <StatCard
          icon={<XCircle className="h-5 w-5 text-red-600" />}
          label="Expired"
          value={data.expiredCount}
          color="bg-red-50"
          href="/inventory?filter=expired"
        />
        <StatCard
          icon={<Flame className="h-5 w-5 text-orange-600" />}
          label="Today's Calories"
          value={Math.round(data.todayNutrition.calories)}
          color="bg-orange-50"
          href="/nutrition"
        />
      </div>

      {/* Today's Macros */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Today&apos;s Nutrition
        </h2>
        <div className="grid grid-cols-4 gap-4 text-center">
          <MacroBox label="Calories" value={Math.round(data.todayNutrition.calories)} unit="kcal" color="text-orange-600" />
          <MacroBox label="Protein" value={Math.round(data.todayNutrition.protein * 10) / 10} unit="g" color="text-blue-600" />
          <MacroBox label="Fat" value={Math.round(data.todayNutrition.fat * 10) / 10} unit="g" color="text-yellow-600" />
          <MacroBox label="Carbs" value={Math.round(data.todayNutrition.carbs * 10) / 10} unit="g" color="text-green-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiring Soon List */}
        <div className="bg-card rounded-lg border border-border p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Expiring Soon
          </h2>
          {data.expiringSoonItems.length === 0 ? (
            <p className="text-muted-foreground text-sm">No items expiring soon</p>
          ) : (
            <div className="space-y-2">
              {data.expiringSoonItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 px-3 rounded bg-amber-50"
                >
                  <div>
                    <span className="font-medium text-sm">{item.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-amber-700">
                    {item.daysLeft != null
                      ? item.daysLeft <= 0
                        ? "Expired!"
                        : `${item.daysLeft}d left`
                      : "Unknown"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recipe Recommendations */}
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recipe Ideas</h2>
            <Link href="/recipes" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {recipes.map((r) => (
              <div
                key={r.recipe.id}
                className="py-2 px-3 rounded bg-secondary/50 flex items-center justify-between"
              >
                <div>
                  <span className="font-medium text-sm">{r.recipe.name}</span>
                  {r.expiringMatchCount > 0 && (
                    <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                      Uses expiring items
                    </span>
                  )}
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {r.matchedIngredients.length} of{" "}
                    {r.matchedIngredients.length + r.missingIngredients.length} ingredients available
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {r.coveragePercent}% match
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly Chart */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h2 className="font-semibold mb-3">7-Day Calorie Intake</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="calories" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  href?: string;
}) {
  const content = (
    <div className={`${color} rounded-lg p-4 border border-border`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function MacroBox({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${color}`}>
        {value}
        <span className="text-xs font-normal ml-0.5">{unit}</span>
      </div>
    </div>
  );
}
