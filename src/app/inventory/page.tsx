"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Minus,
  Plus,
  PackageOpen,
  CheckCircle,
  X,
  Trash2,
  Search,
} from "lucide-react";

interface InventoryItem {
  id: number;
  productId: number;
  quantityInitial: number;
  quantityCurrent: number;
  unit: string;
  totalWeightGrams: number | null;
  totalVolumeMl: number | null;
  purchaseDate: string;
  expiryDate: string | null;
  estimatedExpiryDate: string | null;
  openedDate: string | null;
  storageLocation: string | null;
  storageType: string | null;
  status: string;
  notes: string | null;
  computedStatus: string;
  daysUntilExpiry: number | null;
  expirySource: string;
  shelfLifeSource: string | null;
  shelfLifeConfidence: string | null;
  shelfLifeReason: string | null;
  product: {
    id: number;
    name: string;
    brand: string | null;
    category: string;
    defaultUnit: string;
    isFood: boolean;
    caloriesPer100g: number | null;
    nutritionSource: string | null;
    nutritionConfidence: number | null;
    nutritionSourceType: string | null;
  };
}

interface NutritionCandidate {
  name: string;
  brand?: string;
  externalId: string;
  provider: string;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
  score: number;
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "expiring_soon", label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
];

const CATEGORIES = [
  "",
  "dairy",
  "meat",
  "seafood",
  "fruit",
  "vegetable",
  "bakery",
  "pantry",
  "frozen",
  "beverage",
  "snack",
  "prepared_food",
  "supplement",
  "non_food",
  "other",
  // Legacy
  "produce",
  "grains",
  "canned",
  "beverages",
  "snacks",
  "condiments",
];

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading...</div>}>
      <InventoryContent />
    </Suspense>
  );
}

function InventoryContent() {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("filter") || "all";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filter, setFilter] = useState(initialFilter);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState<{
    item: InventoryItem;
    action: string;
  } | null>(null);
  const [actionQty, setActionQty] = useState(1);
  const [actionMealType, setActionMealType] = useState("snack");
  const [nutritionModal, setNutritionModal] = useState<{
    item: InventoryItem;
    candidates: NutritionCandidate[];
    loading: boolean;
    bestMatch: NutritionCandidate | null;
    confidence: number;
    error: string | null;
  } | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("filter", filter);
    if (category) params.set("category", category);
    const res = await fetch(`/api/inventory?${params}`);
    setItems(await res.json());
    setLoading(false);
  }, [filter, category]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleAction(
    id: number,
    action: string,
    extra?: Record<string, unknown>
  ) {
    await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, ...extra }),
    });
    fetchItems();
    setActionModal(null);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this inventory item? If it has meal history, it will be soft-deleted.")) return;
    await handleAction(id, "delete");
  }

  async function handleNutritionLookup(item: InventoryItem, forceRefresh = false) {
    setNutritionModal({
      item,
      candidates: [],
      loading: true,
      bestMatch: null,
      confidence: 0,
      error: null,
    });

    try {
      const res = await fetch("/api/nutrition/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: item.product.id,
          productName: item.product.name,
          brand: item.product.brand || undefined,
          forceRefresh,
        }),
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) detail = body.error;
        } catch {
          // ignore — response body was not JSON
        }
        setNutritionModal((prev) =>
          prev ? { ...prev, loading: false, error: `Lookup failed: ${detail}` } : null
        );
        return;
      }
      const data = await res.json();
      setNutritionModal((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              candidates: data.candidates || [],
              bestMatch: data.bestMatch || null,
              confidence: data.confidence || 0,
              error: null,
            }
          : null
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network error";
      setNutritionModal((prev) =>
        prev ? { ...prev, loading: false, error: `Lookup failed: ${msg}` } : null
      );
    }
  }

  async function handleApplyNutrition(
    productId: number,
    candidate: NutritionCandidate,
    confidence: number
  ) {
    try {
      await fetch("/api/nutrition/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, candidate, confidence }),
      });
      setNutritionModal(null);
      fetchItems();
    } catch {
      // silently fail
    }
  }

  function nutritionSourceBadge(product: InventoryItem["product"]) {
    if (!product.nutritionSource) return null;
    const sourceLabels: Record<string, string> = {
      usda: "USDA",
      openfoodfacts: "OFF",
      manual: "Manual",
      fallback: "Fallback",
    };
    const typeColors: Record<string, string> = {
      api: "bg-blue-100 text-blue-700",
      manual: "bg-purple-100 text-purple-700",
      ai_assisted: "bg-indigo-100 text-indigo-700",
      fallback: "bg-gray-100 text-gray-500",
    };
    const label = sourceLabels[product.nutritionSource] || product.nutritionSource;
    const colorClass =
      typeColors[product.nutritionSourceType || ""] || "bg-gray-100 text-gray-600";
    const conf = product.nutritionConfidence
      ? `${Math.round(product.nutritionConfidence * 100)}%`
      : "";

    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${colorClass}`}>
        {label} {conf}
      </span>
    );
  }

  function statusBadge(status: string) {
    const colors: Record<string, string> = {
      fresh: "bg-green-100 text-green-800",
      expiring_soon: "bg-amber-100 text-amber-800",
      urgent: "bg-orange-100 text-orange-800",
      expired: "bg-red-100 text-red-800",
      consumed: "bg-gray-100 text-gray-600",
      unknown: "bg-gray-100 text-gray-600",
    };
    const labels: Record<string, string> = {
      fresh: "Fresh",
      expiring_soon: "Expiring Soon",
      urgent: "Use Soon!",
      expired: "Expired",
      consumed: "Consumed",
      unknown: "Unknown",
    };
    return (
      <span className={`text-xs px-2 py-1 rounded font-medium ${colors[status] || colors.unknown}`}>
        {labels[status] || status}
      </span>
    );
  }

  function expiryDisplay(item: InventoryItem) {
    const isEstimated = !item.expiryDate && item.estimatedExpiryDate;
    const isExplicit = !!item.expiryDate;

    if (item.daysUntilExpiry == null) {
      return <span className="text-muted-foreground text-xs">—</span>;
    }

    const confidenceColors: Record<string, string> = {
      high: "text-green-600",
      medium: "text-blue-600",
      low: "text-gray-400",
    };

    return (
      <Tooltip label={item.shelfLifeReason || expirySourceTooltip(item.expirySource)}>
        <div>
          <span
            className={`text-xs font-medium ${
              item.daysUntilExpiry <= 0
                ? "text-red-600"
                : item.daysUntilExpiry <= 2
                ? "text-orange-600"
                : item.daysUntilExpiry <= 7
                ? "text-amber-600"
                : "text-muted-foreground"
            }`}
          >
            {item.daysUntilExpiry <= 0
              ? `${Math.abs(item.daysUntilExpiry)}d ago`
              : `${item.daysUntilExpiry}d`}
          </span>
          {isExplicit && (
            <span className="text-xs ml-1 px-1 py-0.5 rounded bg-green-100 text-green-700">
              📦 Package
            </span>
          )}
          {isEstimated && (
            <span className={`text-xs ml-1 px-1 py-0.5 rounded bg-blue-50 ${confidenceColors[item.shelfLifeConfidence || "low"]}`}>
              📊 Estimated
            </span>
          )}
        </div>
      </Tooltip>
    );
  }

  function expirySourceTooltip(source: string): string {
    const tips: Record<string, string> = {
      explicit: "Package date",
      opened_rule: "Opened shelf life",
      estimated_unopened: "Estimated (shelf life)",
      shelf_life: "Estimated (shelf life)",
      none: "No expiry data",
    };
    return tips[source] || "";
  }

  function storageTypeBadge(type: string | null) {
    if (!type) return null;
    const labels: Record<string, string> = {
      refrigerated: "🧊 Fridge",
      frozen: "❄️ Frozen",
      pantry: "🏠 Pantry",
      room_temp: "🌡️ Room",
    };
    return (
      <span className="text-xs text-muted-foreground">
        {labels[type] || type}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inventory</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-border rounded px-3 py-1.5 text-sm bg-background"
        >
          <option value="">All Categories</option>
          {CATEGORIES.filter(Boolean).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">
          {items.length} items
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-muted-foreground text-center py-8">
          No items found with current filters.
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Category</th>
                <th className="text-left p-3">Qty</th>
                <th className="text-left p-3">Weight</th>
                <th className="text-left p-3">Storage</th>
                <th className="text-left p-3">Purchased</th>
                <th className="text-left p-3">Expiry</th>
                <th className="text-left p-3">Nutrition</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border hover:bg-secondary/30">
                  <td className="p-3">
                    <div className="font-medium">{item.product.name}</div>
                    {item.product.brand && (
                      <div className="text-xs text-muted-foreground">{item.product.brand}</div>
                    )}
                    {item.openedDate && (
                      <div className="text-xs text-blue-600">📭 Opened {new Date(item.openedDate).toLocaleDateString()}</div>
                    )}
                    {!item.product.isFood && (
                      <span className="text-xs bg-gray-200 text-gray-600 px-1 rounded">Non-food</span>
                    )}
                  </td>
                  <td className="p-3 capitalize">{item.product.category}</td>
                  <td className="p-3">
                    {item.quantityCurrent}
                    <span className="text-muted-foreground"> / {item.quantityInitial}</span>
                    <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {item.totalWeightGrams
                      ? `${Math.round(item.totalWeightGrams)}g`
                      : item.totalVolumeMl
                      ? `${Math.round(item.totalVolumeMl)}ml`
                      : "—"}
                  </td>
                  <td className="p-3">
                    {storageTypeBadge(item.storageType)}
                    {item.storageLocation && item.storageLocation !== item.storageType && (
                      <div className="text-xs text-muted-foreground">{item.storageLocation}</div>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(item.purchaseDate).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    {expiryDisplay(item)}
                  </td>
                  <td className="p-3">
                    {item.product.caloriesPer100g != null ? (
                      <div>
                        <div className="text-xs">{Math.round(item.product.caloriesPer100g)} kcal/100g</div>
                        {nutritionSourceBadge(item.product)}
                      </div>
                    ) : item.product.isFood ? (
                      <button
                        onClick={() => handleNutritionLookup(item)}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Search className="h-3 w-3" />
                        Lookup
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                  </td>
                  <td className="p-3">{statusBadge(item.computedStatus)}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Tooltip label="Use / Consume">
                        <button
                          onClick={() => {
                            setActionModal({ item, action: "decrement" });
                            setActionQty(1);
                          }}
                          className="p-1.5 rounded hover:bg-red-100 text-red-600"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                      <Tooltip label="Restock">
                        <button
                          onClick={() => handleAction(item.id, "increment", { quantity: 1 })}
                          className="p-1.5 rounded hover:bg-green-100 text-green-600"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                      <Tooltip label="Mark Opened">
                        <button
                          onClick={() => handleAction(item.id, "markOpened")}
                          className="p-1.5 rounded hover:bg-blue-100 text-blue-600"
                        >
                          <PackageOpen className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                      <Tooltip label="Mark Finished">
                        <button
                          onClick={() =>
                            handleAction(item.id, "markFinished", { mealType: "snack" })
                          }
                          className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                      <Tooltip label="Delete">
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded hover:bg-red-100 text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                      {item.product.isFood && (
                        <Tooltip label="Nutrition Lookup">
                          <button
                            onClick={() => handleNutritionLookup(item)}
                            className="p-1.5 rounded hover:bg-blue-100 text-blue-600"
                          >
                            <Search className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Decrement Modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-96 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">
                Use: {actionModal.item.product.name}
              </h3>
              <button onClick={() => setActionModal(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground">
                  Quantity ({actionModal.item.unit})
                </label>
                <input
                  type="number"
                  value={actionQty}
                  onChange={(e) => setActionQty(parseFloat(e.target.value) || 0)}
                  min={0}
                  max={actionModal.item.quantityCurrent}
                  step={0.1}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background"
                />
                <span className="text-xs text-muted-foreground">
                  Available: {actionModal.item.quantityCurrent} {actionModal.item.unit}
                </span>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Meal Type</label>
                <select
                  value={actionMealType}
                  onChange={(e) => setActionMealType(e.target.value)}
                  className="w-full border border-border rounded px-3 py-2 mt-1 bg-background"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                {[1, 0.5, 0.25].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setActionQty(preset)}
                    className="px-3 py-1 rounded bg-secondary text-sm hover:bg-secondary/80"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <button
                onClick={() =>
                  handleAction(actionModal.item.id, "decrement", {
                    quantity: actionQty,
                    mealType: actionMealType,
                  })
                }
                disabled={actionQty <= 0}
                className="w-full bg-primary text-primary-foreground py-2 rounded hover:bg-primary/90 disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nutrition Lookup Modal */}
      {nutritionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-[32rem] max-h-[80vh] overflow-y-auto border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">
                Nutrition Lookup: {nutritionModal.item.product.name}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleNutritionLookup(nutritionModal.item, true)}
                  disabled={nutritionModal.loading}
                  className="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50"
                  title="Bypass cache and re-query providers"
                >
                  Refresh search
                </button>
                <button onClick={() => setNutritionModal(null)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {nutritionModal.loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Searching nutrition databases...
              </div>
            ) : nutritionModal.error ? (
              <div className="text-center py-8 space-y-2">
                <div className="text-sm text-red-600">{nutritionModal.error}</div>
                <div className="text-xs text-muted-foreground">
                  The server couldn&apos;t complete the lookup. Check the server logs and try again.
                </div>
                <button
                  onClick={() => handleNutritionLookup(nutritionModal.item, true)}
                  className="text-xs px-3 py-1 rounded bg-secondary hover:bg-secondary/80"
                >
                  Retry
                </button>
              </div>
            ) : nutritionModal.candidates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No nutrition data found. Try editing the product name and searching again.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Found {nutritionModal.candidates.length} candidates. Select one to apply:
                </p>
                {nutritionModal.candidates.map((candidate, idx) => (
                  <div
                    key={idx}
                    className={`border rounded-lg p-3 space-y-1 cursor-pointer hover:border-blue-400 transition-colors ${
                      idx === 0 ? "border-blue-300 bg-blue-50/50" : "border-border"
                    }`}
                    onClick={() =>
                      handleApplyNutrition(
                        nutritionModal.item.product.id,
                        candidate,
                        candidate.score
                      )
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm">{candidate.name}</span>
                        {candidate.brand && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({candidate.brand})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            candidate.provider === "usda"
                              ? "bg-green-100 text-green-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {candidate.provider === "usda" ? "USDA" : "OFF"}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            candidate.score >= 0.6
                              ? "bg-green-100 text-green-700"
                              : candidate.score >= 0.35
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {Math.round(candidate.score * 100)}% match
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium">Cal:</span>{" "}
                        {candidate.caloriesPer100g != null
                          ? `${Math.round(candidate.caloriesPer100g)}`
                          : "—"}
                      </div>
                      <div>
                        <span className="font-medium">Protein:</span>{" "}
                        {candidate.proteinPer100g != null
                          ? `${Math.round(candidate.proteinPer100g)}g`
                          : "—"}
                      </div>
                      <div>
                        <span className="font-medium">Fat:</span>{" "}
                        {candidate.fatPer100g != null
                          ? `${Math.round(candidate.fatPer100g)}g`
                          : "—"}
                      </div>
                      <div>
                        <span className="font-medium">Carbs:</span>{" "}
                        {candidate.carbsPer100g != null
                          ? `${Math.round(candidate.carbsPer100g)}g`
                          : "—"}
                      </div>
                    </div>
                    {idx === 0 && (
                      <div className="text-xs text-blue-600 font-medium pt-1">
                        Best match - click to apply
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {label}
      </span>
    </div>
  );
}
