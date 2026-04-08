import { z } from "zod";

export const consumptionSchema = z.object({
  inventoryBatchId: z.number(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  quantityUsed: z.number().positive(),
  unit: z.string(),
  notes: z.string().optional(),
  recipeId: z.number().optional(),
});

export const importItemSchema = z.object({
  rawName: z.string(),
  parsedName: z.string(),
  category: z.string(),
  quantity: z.number(),
  unit: z.string(),
  totalWeightGrams: z.number().nullable(),
  totalVolumeMl: z.number().nullable().optional(),
  purchaseDate: z.string().nullable(),
  expiryDate: z.string().nullable().optional(),
  confidence: z.number(),
  needsReview: z.boolean(),
  isFood: z.boolean().optional().default(true),
});

export const confirmImportSchema = z.object({
  importId: z.number(),
  items: z.array(importItemSchema),
});

export const inventoryUpdateSchema = z.object({
  id: z.number(),
  action: z.enum(["decrement", "increment", "markOpened", "markFinished", "edit", "delete"]),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  storageLocation: z.string().optional(),
  storageType: z.enum(["refrigerated", "frozen", "pantry", "room_temp"]).optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

// Multi-item meal logging
export const mealItemSchema = z.object({
  inventoryBatchId: z.number(),
  quantityUsed: z.number().positive(),
  unit: z.string(),
});

export const logMealSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  items: z.array(mealItemSchema).min(1),
  notes: z.string().optional(),
  recipeId: z.number().optional(),
});

// Manual inventory entry
export const manualEntrySchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  category: z.string().default("other"),
  quantity: z.number().positive(),
  unit: z.string().default("unit"),
  totalWeightGrams: z.number().nullable().optional(),
  totalVolumeMl: z.number().nullable().optional(),
  purchaseDate: z.string().optional(),
  expiryDate: z.string().nullable().optional(),
  storageLocation: z.string().optional(),
  storageType: z.enum(["refrigerated", "frozen", "pantry", "room_temp"]).optional(),
  notes: z.string().optional(),
  isFood: z.boolean().optional().default(true),
});
