interface NutritionPer100g {
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
}

export interface NutritionValues {
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
}

/** Calculate nutrition from weight in grams and per-100g values */
export function calculateNutritionFromGrams(
  weightGrams: number,
  product: NutritionPer100g
): NutritionValues {
  const factor = weightGrams / 100;
  return {
    calories: product.caloriesPer100g != null ? Math.round(product.caloriesPer100g * factor) : null,
    protein: product.proteinPer100g != null ? Math.round(product.proteinPer100g * factor * 10) / 10 : null,
    fat: product.fatPer100g != null ? Math.round(product.fatPer100g * factor * 10) / 10 : null,
    carbs: product.carbsPer100g != null ? Math.round(product.carbsPer100g * factor * 10) / 10 : null,
  };
}

/** Estimate weight from quantity and gramsPerUnit */
export function estimateWeightGrams(
  quantity: number,
  gramsPerUnit: number | null
): number | null {
  if (gramsPerUnit == null) return null;
  return quantity * gramsPerUnit;
}

/** Calculate nutrition for a consumption event.
 * Uses gramsPerUnit from product first; falls back to batch weight info
 * (totalWeightGrams / quantityInitial) to derive weight per unit.
 */
export function calculateConsumptionNutrition(
  quantityUsed: number,
  gramsPerUnit: number | null,
  product: NutritionPer100g,
  batchInfo?: { totalWeightGrams: number | null; quantityInitial: number } | null
): NutritionValues {
  let effectiveGramsPerUnit = gramsPerUnit;

  // Fall back to batch weight if product has no gramsPerUnit
  if (effectiveGramsPerUnit == null && batchInfo?.totalWeightGrams && batchInfo.quantityInitial > 0) {
    effectiveGramsPerUnit = batchInfo.totalWeightGrams / batchInfo.quantityInitial;
  }

  const weightGrams = estimateWeightGrams(quantityUsed, effectiveGramsPerUnit);
  if (weightGrams == null) {
    return { calories: null, protein: null, fat: null, carbs: null };
  }
  return calculateNutritionFromGrams(weightGrams, product);
}

/** Sum nutrition values across multiple items */
export function sumNutrition(items: NutritionValues[]): NutritionValues {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories != null || item.calories != null
        ? (acc.calories ?? 0) + (item.calories ?? 0)
        : null,
      protein: acc.protein != null || item.protein != null
        ? Math.round(((acc.protein ?? 0) + (item.protein ?? 0)) * 10) / 10
        : null,
      fat: acc.fat != null || item.fat != null
        ? Math.round(((acc.fat ?? 0) + (item.fat ?? 0)) * 10) / 10
        : null,
      carbs: acc.carbs != null || item.carbs != null
        ? Math.round(((acc.carbs ?? 0) + (item.carbs ?? 0)) * 10) / 10
        : null,
    }),
    { calories: null, protein: null, fat: null, carbs: null } as NutritionValues
  );
}
