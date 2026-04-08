"use client";

import { useEffect, useState } from "react";
import {
  ChefHat,
  CheckCircle,
  AlertTriangle,
  XCircle,
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

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<ScoredRecipe[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [cooking, setCooking] = useState<number | null>(null);
  const [cookResult, setCookResult] = useState<string>("");

  useEffect(() => {
    fetch("/api/recipes").then((r) => r.json()).then(setRecipes);
  }, []);

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
