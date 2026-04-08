"use client";

import { useEffect, useState, useCallback } from "react";
import {
  UtensilsCrossed,
  Plus,
  X,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface MealItemData {
  id: number;
  quantityUsed: number;
  unit: string;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  inventoryBatch: {
    product: { name: string };
  };
}

interface MealData {
  id: number;
  mealType: string;
  consumedAt: string;
  notes: string | null;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  items: MealItemData[];
  recipe: { name: string } | null;
}

interface StandaloneLog {
  id: number;
  mealType: string;
  quantityUsed: number;
  unit: string;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  consumedAt: string;
  notes: string | null;
  inventoryBatch: {
    product: { name: string };
  };
  recipe: { name: string } | null;
}

interface InventoryOption {
  id: number;
  quantityCurrent: number;
  unit: string;
  product: { name: string; isFood: boolean };
}

interface MealFormItem {
  inventoryBatchId: number;
  quantityUsed: number;
  unit: string;
  productName: string;
  maxQty: number;
}

export default function MealsPage() {
  const [meals, setMeals] = useState<MealData[]>([]);
  const [standaloneLogs, setStandaloneLogs] = useState<StandaloneLog[]>([]);
  const [date, setDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [showForm, setShowForm] = useState(false);
  const [inventory, setInventory] = useState<InventoryOption[]>([]);
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null);
  const [editingMeal, setEditingMeal] = useState<MealData | null>(null);

  // Form state
  const [formMealType, setFormMealType] = useState("lunch");
  const [formNotes, setFormNotes] = useState("");
  const [formItems, setFormItems] = useState<MealFormItem[]>([]);

  const fetchMeals = useCallback(async () => {
    const res = await fetch(`/api/meals?date=${date}`);
    const data = await res.json();
    setMeals(data.meals || []);
    setStandaloneLogs(data.standaloneLogs || []);
  }, [date]);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  useEffect(() => {
    if (showForm) {
      fetch("/api/inventory?filter=all")
        .then((r) => r.json())
        .then((items: InventoryOption[]) => {
          const foodItems = items.filter((i) => i.quantityCurrent > 0 && i.product.isFood !== false);
          setInventory(foodItems);
          // Start with one empty row
          if (foodItems.length > 0 && formItems.length === 0) {
            setFormItems([{
              inventoryBatchId: foodItems[0].id,
              quantityUsed: 1,
              unit: foodItems[0].unit,
              productName: foodItems[0].product.name,
              maxQty: foodItems[0].quantityCurrent,
            }]);
          }
        });
    }
  }, [showForm]);

  function addFormItem() {
    if (inventory.length === 0) return;
    const first = inventory[0];
    setFormItems((prev) => [
      ...prev,
      {
        inventoryBatchId: first.id,
        quantityUsed: 1,
        unit: first.unit,
        productName: first.product.name,
        maxQty: first.quantityCurrent,
      },
    ]);
  }

  function updateFormItem(index: number, field: string, value: number | string) {
    setFormItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === "inventoryBatchId") {
          const batch = inventory.find((inv) => inv.id === Number(value));
          return {
            ...item,
            inventoryBatchId: Number(value),
            unit: batch?.unit || item.unit,
            productName: batch?.product.name || item.productName,
            maxQty: batch?.quantityCurrent || 0,
          };
        }
        return { ...item, [field]: value };
      })
    );
  }

  function removeFormItem(index: number) {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (formItems.length === 0) return;
    const res = await fetch("/api/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mealType: formMealType,
        notes: formNotes || undefined,
        items: formItems.map((fi) => ({
          inventoryBatchId: fi.inventoryBatchId,
          quantityUsed: fi.quantityUsed,
          unit: fi.unit,
        })),
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setFormItems([]);
      setFormNotes("");
      fetchMeals();
    }
  }

  async function handleDeleteMeal(mealId: number) {
    if (!confirm("Delete this meal? Inventory will be restored.")) return;
    const res = await fetch(`/api/meals?mealId=${mealId}`, { method: "DELETE" });
    if (res.ok) fetchMeals();
  }

  async function handleDeleteLog(logId: number) {
    if (!confirm("Delete this log? Inventory will be restored.")) return;
    const res = await fetch(`/api/meals?logId=${logId}`, { method: "DELETE" });
    if (res.ok) fetchMeals();
  }

  async function handleEditMeal() {
    if (!editingMeal) return;
    await fetch("/api/meals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mealId: editingMeal.id,
        mealType: editingMeal.mealType,
        notes: editingMeal.notes,
      }),
    });
    setEditingMeal(null);
    fetchMeals();
  }

  // Group all entries by meal type
  const allEntries: Array<{
    type: "meal" | "log";
    mealType: string;
    data: MealData | StandaloneLog;
  }> = [];
  meals.forEach((m) => allEntries.push({ type: "meal", mealType: m.mealType, data: m }));
  standaloneLogs.forEach((l) => allEntries.push({ type: "log", mealType: l.mealType, data: l }));

  const grouped = allEntries.reduce((acc, entry) => {
    if (!acc[entry.mealType]) acc[entry.mealType] = [];
    acc[entry.mealType].push(entry);
    return acc;
  }, {} as Record<string, typeof allEntries>);

  const totalNutrition = {
    calories: [...meals, ...standaloneLogs].reduce((s, l) => s + (l.calories ?? 0), 0),
    protein: [...meals, ...standaloneLogs].reduce((s, l) => s + (l.protein ?? 0), 0),
    fat: [...meals, ...standaloneLogs].reduce((s, l) => s + (l.fat ?? 0), 0),
    carbs: [...meals, ...standaloneLogs].reduce((s, l) => s + (l.carbs ?? 0), 0),
  };

  const mealOrder = ["breakfast", "lunch", "dinner", "snack"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meals</h1>
        <div className="flex gap-3 items-center">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-border rounded px-3 py-1.5 text-sm bg-background"
          />
          <button
            onClick={() => { setShowForm(true); setFormItems([]); }}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-sm hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Log Meal
          </button>
        </div>
      </div>

      {/* Day totals */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h2 className="font-semibold mb-2">Day Totals</h2>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Calories</div>
            <div className="text-lg font-bold text-orange-600">{Math.round(totalNutrition.calories)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Protein</div>
            <div className="text-lg font-bold text-blue-600">{Math.round(totalNutrition.protein * 10) / 10}g</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Fat</div>
            <div className="text-lg font-bold text-yellow-600">{Math.round(totalNutrition.fat * 10) / 10}g</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Carbs</div>
            <div className="text-lg font-bold text-green-600">{Math.round(totalNutrition.carbs * 10) / 10}g</div>
          </div>
        </div>
      </div>

      {/* Meals by type */}
      {allEntries.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          No meals logged for this day.
        </div>
      ) : (
        <div className="space-y-4">
          {mealOrder.map((type) => {
            const entries = grouped[type];
            if (!entries || entries.length === 0) return null;
            return (
              <div key={type} className="bg-card rounded-lg border border-border p-4">
                <h3 className="font-semibold capitalize mb-3 flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4" />
                  {type}
                </h3>
                <div className="space-y-2">
                  {entries.map((entry) => {
                    if (entry.type === "meal") {
                      const meal = entry.data as MealData;
                      const isExpanded = expandedMeal === meal.id;
                      return (
                        <div key={`meal-${meal.id}`} className="bg-secondary/50 rounded overflow-hidden">
                          <div className="flex items-center justify-between py-2 px-3">
                            <div
                              className="flex-1 cursor-pointer flex items-center gap-2"
                              onClick={() => setExpandedMeal(isExpanded ? null : meal.id)}
                            >
                              <span className="font-medium text-sm">
                                {meal.items.map((i) => i.inventoryBatch.product.name).join(", ")}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({meal.items.length} items)
                              </span>
                              {meal.recipe && (
                                <span className="text-xs text-primary">({meal.recipe.name})</span>
                              )}
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right text-xs text-muted-foreground">
                                {meal.calories != null && (
                                  <span className="text-orange-600 font-medium">
                                    {Math.round(meal.calories)} kcal
                                  </span>
                                )}
                                {meal.protein != null && (
                                  <span className="ml-2">P:{Math.round(meal.protein * 10) / 10}g</span>
                                )}
                              </div>
                              <button
                                onClick={() => setEditingMeal(meal)}
                                className="p-1 hover:bg-blue-100 rounded text-blue-600"
                                title="Edit meal"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteMeal(meal.id)}
                                className="p-1 hover:bg-red-100 rounded text-red-600"
                                title="Delete meal (restores inventory)"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="px-3 pb-2 space-y-1 border-t border-border/50 pt-2">
                              {meal.items.map((item) => (
                                <div key={item.id} className="flex justify-between text-xs text-muted-foreground">
                                  <span>{item.inventoryBatch.product.name} — {item.quantityUsed} {item.unit}</span>
                                  <span>
                                    {item.calories != null ? `${Math.round(item.calories)} kcal` : "—"}
                                    {item.protein != null ? ` | P:${Math.round(item.protein * 10) / 10}g` : ""}
                                    {item.fat != null ? ` F:${Math.round(item.fat * 10) / 10}g` : ""}
                                    {item.carbs != null ? ` C:${Math.round(item.carbs * 10) / 10}g` : ""}
                                  </span>
                                </div>
                              ))}
                              {meal.notes && (
                                <div className="text-xs text-muted-foreground italic pt-1">
                                  Note: {meal.notes}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      const log = entry.data as StandaloneLog;
                      return (
                        <div key={`log-${log.id}`} className="flex items-center justify-between py-2 px-3 bg-secondary/50 rounded">
                          <div>
                            <span className="font-medium text-sm">{log.inventoryBatch.product.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{log.quantityUsed} {log.unit}</span>
                            {log.recipe && <span className="text-xs text-primary ml-2">({log.recipe.name})</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right text-xs text-muted-foreground">
                              {log.calories != null && (
                                <span className="text-orange-600 font-medium">{Math.round(log.calories)} kcal</span>
                              )}
                              {log.protein != null && <span className="ml-2">P:{Math.round(log.protein * 10) / 10}g</span>}
                            </div>
                            <button
                              onClick={() => handleDeleteLog(log.id)}
                              className="p-1 hover:bg-red-100 rounded text-red-600"
                              title="Delete log (restores inventory)"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Log Meal Modal (Multi-item) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-[36rem] max-h-[80vh] overflow-y-auto border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Log Meal</h3>
              <button onClick={() => { setShowForm(false); setFormItems([]); }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Meal Type</label>
                <select
                  value={formMealType}
                  onChange={(e) => setFormMealType(e.target.value)}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background text-sm"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Items</label>
                  <button
                    onClick={addFormItem}
                    className="text-xs bg-secondary px-2 py-1 rounded hover:bg-secondary/80 flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add Item
                  </button>
                </div>
                {formItems.length === 0 && (
                  <p className="text-xs text-muted-foreground">Click &quot;Add Item&quot; to add food items to this meal.</p>
                )}
                <div className="space-y-2">
                  {formItems.map((fi, idx) => (
                    <div key={idx} className="flex gap-2 items-end bg-secondary/30 p-2 rounded">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">Food</label>
                        <select
                          value={fi.inventoryBatchId}
                          onChange={(e) => updateFormItem(idx, "inventoryBatchId", e.target.value)}
                          className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background"
                        >
                          {inventory.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.product.name} ({inv.quantityCurrent} {inv.unit})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-20">
                        <label className="text-xs text-muted-foreground">Qty</label>
                        <input
                          type="number"
                          value={fi.quantityUsed}
                          onChange={(e) => updateFormItem(idx, "quantityUsed", parseFloat(e.target.value) || 0)}
                          min={0}
                          max={fi.maxQty}
                          step={0.1}
                          className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background"
                        />
                      </div>
                      <button
                        onClick={() => removeFormItem(idx)}
                        className="p-1.5 text-red-500 hover:bg-red-100 rounded"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Notes (optional)</label>
                <input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background text-sm"
                  placeholder="e.g. with salad"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={formItems.length === 0}
                className="w-full bg-primary text-primary-foreground py-2 rounded hover:bg-primary/90 disabled:opacity-50"
              >
                Log Meal ({formItems.length} items)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Meal Modal */}
      {editingMeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-96 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Edit Meal</h3>
              <button onClick={() => setEditingMeal(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground">Meal Type</label>
                <select
                  value={editingMeal.mealType}
                  onChange={(e) => setEditingMeal({ ...editingMeal, mealType: e.target.value })}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background text-sm"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Notes</label>
                <input
                  value={editingMeal.notes || ""}
                  onChange={(e) => setEditingMeal({ ...editingMeal, notes: e.target.value })}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background text-sm"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Items: {editingMeal.items.map((i) => i.inventoryBatch.product.name).join(", ")}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleEditMeal}
                  className="flex-1 bg-primary text-primary-foreground py-2 rounded hover:bg-primary/90"
                >
                  Save
                </button>
                <button
                  onClick={() => { handleDeleteMeal(editingMeal.id); setEditingMeal(null); }}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
