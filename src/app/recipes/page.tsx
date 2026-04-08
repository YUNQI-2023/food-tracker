"use client";

import { useEffect, useState } from "react";
import {
  ChefHat,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Sparkles,
} from "lucide-react";

interface ScoredRecipe {
  recipe: {
    id: number;
    name: string;
    description: string;
    instructions: string;
    cuisineType: string | null;
    estimatedCalories: number | null;
    estimatedProtein: number | null;
    estimatedFat: number | null;
    estimatedCarbs: number | null;
  };
  score: number;
  matchedIngredients: string[];
  missingIngredients: string[];
  expiringMatchCount: number;
  coveragePercent: number;
}

interface AIRecipe {
  name: string;
  description: string;
  ingredientsUsed: Array<{ name: string; quantity?: string; fromInventory: boolean }>;
  missingIngredients: Array<{ name: string; quantity?: string; optional: boolean }>;
  steps: string[];
  estimatedNutrition?: {
    calories?: number | null;
    protein?: number | null;
    fat?: number | null;
    carbs?: number | null;
  };
  reason: string;
  cuisineType?: string | null;
  estimatedTimeMinutes?: number | null;
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<ScoredRecipe[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [cooking, setCooking] = useState<number | null>(null);
  const [cookResult, setCookResult] = useState<string>("");
  const [aiRecipes, setAiRecipes] = useState<AIRecipe[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/recipes").then((r) => r.json()).then(setRecipes);
  }, []);

  async function handleAIRecommend() {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/recipes/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 3 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || `Request failed (HTTP ${res.status})`);
        setAiRecipes([]);
      } else {
        setAiRecipes(data.recommendations || []);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Network error");
      setAiRecipes([]);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleCook(recipeId: number, mealType: string) {
    setCooking(recipeId);
    const res = await fetch("/api/recipes/cook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId, mealType }),
    });
    const data = await res.json();
    if (res.ok) {
      setCookResult(
        `Cooked ${data.cooked}! Used ${data.consumedItems}/${data.totalIngredients} ingredients from inventory.`
      );
      // Refresh recipe scores
      const updated = await fetch("/api/recipes");
      setRecipes(await updated.json());
    } else {
      setCookResult(`Error: ${data.error}`);
    }
    setCooking(null);
    setTimeout(() => setCookResult(""), 5000);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Recipe Recommendations</h1>
      <p className="text-sm text-muted-foreground">
        Recipes are ranked by ingredient availability, with priority for expiring items.
      </p>

      {cookResult && (
        <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">
          {cookResult}
        </div>
      )}

      {/* AI Recommendations */}
      <div className="bg-card rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              AI Recipe Recommendations
            </h2>
            <p className="text-xs text-muted-foreground">
              Uses your current inventory and prioritizes expiring items.
            </p>
          </div>
          <button
            onClick={handleAIRecommend}
            disabled={aiLoading}
            className="px-3 py-1.5 rounded text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
          >
            <Sparkles className="h-3 w-3" />
            {aiLoading ? "Thinking..." : "AI Recommend"}
          </button>
        </div>

        {aiError && (
          <div className="bg-red-50 text-red-700 p-3 rounded text-sm">
            <div className="font-medium">AI recommendation failed</div>
            <div className="text-xs mt-1">{aiError}</div>
          </div>
        )}

        {aiRecipes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {aiRecipes.map((r, idx) => (
              <div
                key={idx}
                className="border border-border rounded-lg p-3 space-y-2 bg-secondary/10"
              >
                <div>
                  <div className="font-semibold text-sm flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-indigo-500" />
                    {r.name}
                  </div>
                  {r.cuisineType && (
                    <span className="text-xs bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">
                      {r.cuisineType}
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
                </div>

                <div className="text-xs bg-indigo-50 text-indigo-700 rounded p-2">
                  <span className="font-medium">Why: </span>
                  {r.reason}
                </div>

                <div>
                  <div className="text-xs font-medium mb-1">Uses from inventory</div>
                  <div className="flex flex-wrap gap-1">
                    {r.ingredientsUsed.map((ing, i) => (
                      <span
                        key={i}
                        className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-1"
                      >
                        <CheckCircle className="h-3 w-3" />
                        {ing.name}
                        {ing.quantity ? ` (${ing.quantity})` : ""}
                      </span>
                    ))}
                  </div>
                </div>

                {r.missingIngredients.length > 0 && (
                  <div>
                    <div className="text-xs font-medium mb-1">Missing</div>
                    <div className="flex flex-wrap gap-1">
                      {r.missingIngredients.map((ing, i) => (
                        <span
                          key={i}
                          className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded flex items-center gap-1"
                        >
                          <XCircle className="h-3 w-3" />
                          {ing.name}
                          {ing.quantity ? ` (${ing.quantity})` : ""}
                          {ing.optional ? " · optional" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs font-medium mb-1">Steps</div>
                  <ol className="text-xs text-muted-foreground list-decimal ml-4 space-y-0.5">
                    {r.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>

                {r.estimatedNutrition && (
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                    {r.estimatedNutrition.calories != null && (
                      <span>{Math.round(r.estimatedNutrition.calories)} kcal</span>
                    )}
                    {r.estimatedNutrition.protein != null && (
                      <span>P {Math.round(r.estimatedNutrition.protein)}g</span>
                    )}
                    {r.estimatedNutrition.fat != null && (
                      <span>F {Math.round(r.estimatedNutrition.fat)}g</span>
                    )}
                    {r.estimatedNutrition.carbs != null && (
                      <span>C {Math.round(r.estimatedNutrition.carbs)}g</span>
                    )}
                    {r.estimatedTimeMinutes != null && (
                      <span>· ~{r.estimatedTimeMinutes} min</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {recipes.map((r) => {
          const isExpanded = expanded === r.recipe.id;
          return (
            <div
              key={r.recipe.id}
              className="bg-card rounded-lg border border-border overflow-hidden"
            >
              <div
                className="p-4 cursor-pointer hover:bg-secondary/30"
                onClick={() =>
                  setExpanded(isExpanded ? null : r.recipe.id)
                }
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{r.recipe.name}</h3>
                      {r.expiringMatchCount > 0 && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Uses {r.expiringMatchCount} expiring
                        </span>
                      )}
                      {r.recipe.cuisineType && (
                        <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded">
                          {r.recipe.cuisineType}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {r.recipe.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {r.matchedIngredients.map((name) => (
                        <span
                          key={name}
                          className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded flex items-center gap-1"
                        >
                          <CheckCircle className="h-3 w-3" />
                          {name}
                        </span>
                      ))}
                      {r.missingIngredients.map((name) => (
                        <span
                          key={name}
                          className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded flex items-center gap-1"
                        >
                          <XCircle className="h-3 w-3" />
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-lg font-bold text-primary">
                      {r.coveragePercent}%
                    </div>
                    <div className="text-xs text-muted-foreground">match</div>
                    {r.recipe.estimatedCalories && (
                      <div className="text-xs text-muted-foreground mt-1">
                        ~{r.recipe.estimatedCalories} kcal
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border p-4 bg-secondary/20">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Instructions</h4>
                      <div className="text-sm text-muted-foreground whitespace-pre-line">
                        {r.recipe.instructions}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm mb-2">
                        Estimated Nutrition
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-card rounded p-2">
                          <span className="text-muted-foreground">Calories:</span>{" "}
                          <span className="font-medium">
                            {r.recipe.estimatedCalories ?? "—"} kcal
                          </span>
                        </div>
                        <div className="bg-card rounded p-2">
                          <span className="text-muted-foreground">Protein:</span>{" "}
                          <span className="font-medium">
                            {r.recipe.estimatedProtein ?? "—"}g
                          </span>
                        </div>
                        <div className="bg-card rounded p-2">
                          <span className="text-muted-foreground">Fat:</span>{" "}
                          <span className="font-medium">
                            {r.recipe.estimatedFat ?? "—"}g
                          </span>
                        </div>
                        <div className="bg-card rounded p-2">
                          <span className="text-muted-foreground">Carbs:</span>{" "}
                          <span className="font-medium">
                            {r.recipe.estimatedCarbs ?? "—"}g
                          </span>
                        </div>
                      </div>

                      <div className="mt-4">
                        <h4 className="font-medium text-sm mb-2">
                          Cook this recipe
                        </h4>
                        <div className="flex gap-2">
                          {["breakfast", "lunch", "dinner", "snack"].map(
                            (meal) => (
                              <button
                                key={meal}
                                onClick={() => handleCook(r.recipe.id, meal)}
                                disabled={
                                  cooking === r.recipe.id ||
                                  r.coveragePercent === 0
                                }
                                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 capitalize"
                              >
                                <ChefHat className="h-3 w-3" />
                                {meal}
                              </button>
                            )
                          )}
                        </div>
                        {r.coveragePercent < 100 && (
                          <p className="text-xs text-amber-600 mt-2">
                            Some ingredients are missing. Available ingredients
                            will be deducted.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
