import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.shelfLifeRule.deleteMany();
  await prisma.mealItem.deleteMany();
  await prisma.consumptionLog.deleteMany();
  await prisma.meal.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.purchaseImportItem.deleteMany();
  await prisma.purchaseImport.deleteMany();
  await prisma.inventoryBatch.deleteMany();
  await prisma.product.deleteMany();

  // --- PRODUCTS ---
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Eggs",
        category: "dairy",
        defaultUnit: "unit",
        gramsPerUnit: 50,
        caloriesPer100g: 155,
        proteinPer100g: 13,
        fatPer100g: 11,
        carbsPer100g: 1.1,
        shelfLifeDays: 28,
        openedShelfLifeDays: 28,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Milk",
        category: "dairy",
        defaultUnit: "gallon",
        mlPerUnit: 3785,
        gramsPerUnit: 3900,
        caloriesPer100g: 42,
        proteinPer100g: 3.4,
        fatPer100g: 1,
        carbsPer100g: 5,
        shelfLifeDays: 14,
        openedShelfLifeDays: 7,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Chicken Breast",
        category: "meat",
        defaultUnit: "lb",
        gramsPerUnit: 454,
        caloriesPer100g: 165,
        proteinPer100g: 31,
        fatPer100g: 3.6,
        carbsPer100g: 0,
        shelfLifeDays: 5,
        openedShelfLifeDays: 3,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "White Rice",
        category: "grains",
        defaultUnit: "lb",
        gramsPerUnit: 454,
        caloriesPer100g: 130,
        proteinPer100g: 2.7,
        fatPer100g: 0.3,
        carbsPer100g: 28,
        shelfLifeDays: 365,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Bread",
        brand: "Great Value",
        category: "bakery",
        defaultUnit: "loaf",
        gramsPerUnit: 567,
        caloriesPer100g: 265,
        proteinPer100g: 9,
        fatPer100g: 3.2,
        carbsPer100g: 49,
        shelfLifeDays: 7,
        openedShelfLifeDays: 5,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Spinach",
        category: "vegetable",
        defaultUnit: "bag",
        gramsPerUnit: 284,
        caloriesPer100g: 23,
        proteinPer100g: 2.9,
        fatPer100g: 0.4,
        carbsPer100g: 3.6,
        shelfLifeDays: 7,
        openedShelfLifeDays: 3,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Banana",
        category: "fruit",
        defaultUnit: "unit",
        gramsPerUnit: 120,
        caloriesPer100g: 89,
        proteinPer100g: 1.1,
        fatPer100g: 0.3,
        carbsPer100g: 23,
        shelfLifeDays: 7,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Greek Yogurt",
        brand: "Great Value",
        category: "dairy",
        defaultUnit: "container",
        gramsPerUnit: 907,
        caloriesPer100g: 59,
        proteinPer100g: 10,
        fatPer100g: 0.7,
        carbsPer100g: 3.6,
        shelfLifeDays: 21,
        openedShelfLifeDays: 7,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Cheddar Cheese",
        category: "dairy",
        defaultUnit: "block",
        gramsPerUnit: 227,
        caloriesPer100g: 403,
        proteinPer100g: 25,
        fatPer100g: 33,
        carbsPer100g: 1.3,
        shelfLifeDays: 60,
        openedShelfLifeDays: 21,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Pasta",
        brand: "Great Value",
        category: "grains",
        defaultUnit: "box",
        gramsPerUnit: 454,
        caloriesPer100g: 131,
        proteinPer100g: 5,
        fatPer100g: 1.1,
        carbsPer100g: 25,
        shelfLifeDays: 730,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Tomato Sauce",
        category: "canned",
        defaultUnit: "can",
        gramsPerUnit: 425,
        caloriesPer100g: 29,
        proteinPer100g: 1.3,
        fatPer100g: 0.1,
        carbsPer100g: 6,
        shelfLifeDays: 365,
        openedShelfLifeDays: 5,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Oatmeal",
        category: "grains",
        defaultUnit: "container",
        gramsPerUnit: 510,
        caloriesPer100g: 389,
        proteinPer100g: 17,
        fatPer100g: 7,
        carbsPer100g: 66,
        shelfLifeDays: 365,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Butter",
        category: "dairy",
        defaultUnit: "stick",
        gramsPerUnit: 113,
        caloriesPer100g: 717,
        proteinPer100g: 0.9,
        fatPer100g: 81,
        carbsPer100g: 0.1,
        shelfLifeDays: 90,
        openedShelfLifeDays: 30,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Tuna (Canned)",
        category: "canned",
        defaultUnit: "can",
        gramsPerUnit: 142,
        caloriesPer100g: 116,
        proteinPer100g: 26,
        fatPer100g: 0.8,
        carbsPer100g: 0,
        shelfLifeDays: 730,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Mixed Berries (Frozen)",
        category: "frozen",
        defaultUnit: "bag",
        gramsPerUnit: 340,
        caloriesPer100g: 57,
        proteinPer100g: 0.7,
        fatPer100g: 0.3,
        carbsPer100g: 14,
        shelfLifeDays: 180,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Onion",
        category: "vegetable",
        defaultUnit: "unit",
        gramsPerUnit: 150,
        caloriesPer100g: 40,
        proteinPer100g: 1.1,
        fatPer100g: 0.1,
        carbsPer100g: 9.3,
        shelfLifeDays: 30,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Garlic",
        category: "vegetable",
        defaultUnit: "head",
        gramsPerUnit: 40,
        caloriesPer100g: 149,
        proteinPer100g: 6.4,
        fatPer100g: 0.5,
        carbsPer100g: 33,
        shelfLifeDays: 60,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Olive Oil",
        category: "condiments",
        defaultUnit: "bottle",
        mlPerUnit: 500,
        gramsPerUnit: 460,
        caloriesPer100g: 884,
        proteinPer100g: 0,
        fatPer100g: 100,
        carbsPer100g: 0,
        shelfLifeDays: 365,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Bell Pepper",
        category: "vegetable",
        defaultUnit: "unit",
        gramsPerUnit: 150,
        caloriesPer100g: 31,
        proteinPer100g: 1,
        fatPer100g: 0.3,
        carbsPer100g: 6,
        shelfLifeDays: 10,
        isFood: true,
      },
    }),
    prisma.product.create({
      data: {
        name: "Carrot",
        category: "vegetable",
        defaultUnit: "unit",
        gramsPerUnit: 72,
        caloriesPer100g: 41,
        proteinPer100g: 0.9,
        fatPer100g: 0.2,
        carbsPer100g: 10,
        shelfLifeDays: 21,
        isFood: true,
      },
    }),
  ]);

  const productMap = Object.fromEntries(products.map((p) => [p.name, p]));

  // --- INVENTORY BATCHES ---
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400000);

  const batches = await Promise.all([
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["Eggs"].id, purchaseDate: daysAgo(5),
        quantityInitial: 12, quantityCurrent: 8, unit: "unit", totalWeightGrams: 600,
        expiryDate: daysFromNow(23), storageLocation: "fridge", storageType: "refrigerated",
        shelfLifeSource: "explicit", shelfLifeConfidence: "high", shelfLifeReason: "Using explicit package expiry date",
        status: "fresh",
      },
    }),
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["Milk"].id, purchaseDate: daysAgo(8),
        quantityInitial: 1, quantityCurrent: 0.6, unit: "gallon", totalVolumeMl: 2271,
        expiryDate: daysFromNow(4), openedDate: daysAgo(6),
        storageLocation: "fridge", storageType: "refrigerated",
        shelfLifeSource: "explicit", shelfLifeConfidence: "high", shelfLifeReason: "Using explicit package expiry date",
        status: "expiring_soon",
      },
    }),
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["Chicken Breast"].id, purchaseDate: daysAgo(3),
        quantityInitial: 2, quantityCurrent: 2, unit: "lb", totalWeightGrams: 908,
        expiryDate: daysFromNow(2), storageLocation: "fridge", storageType: "refrigerated",
        shelfLifeSource: "explicit", shelfLifeConfidence: "high", shelfLifeReason: "Using explicit package expiry date",
        status: "expiring_soon",
      },
    }),
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["White Rice"].id, purchaseDate: daysAgo(30),
        quantityInitial: 5, quantityCurrent: 4, unit: "lb", totalWeightGrams: 1816,
        storageLocation: "pantry", storageType: "pantry",
        shelfLifeSource: "rule:rice", shelfLifeConfidence: "high", shelfLifeReason: "Rice (pantry): ~365 days",
        estimatedExpiryDate: daysFromNow(335), status: "fresh",
      },
    }),
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["Bread"].id, purchaseDate: daysAgo(5),
        quantityInitial: 1, quantityCurrent: 0.7, unit: "loaf", totalWeightGrams: 397,
        expiryDate: daysFromNow(2), openedDate: daysAgo(4),
        storageLocation: "counter", storageType: "room_temp",
        shelfLifeSource: "explicit", shelfLifeConfidence: "high", shelfLifeReason: "Using explicit package expiry date",
        status: "expiring_soon",
      },
    }),
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["Spinach"].id, purchaseDate: daysAgo(5),
        quantityInitial: 1, quantityCurrent: 0.5, unit: "bag", totalWeightGrams: 142,
        expiryDate: daysFromNow(1), openedDate: daysAgo(3),
        storageLocation: "fridge", storageType: "refrigerated",
        shelfLifeSource: "explicit", shelfLifeConfidence: "high", shelfLifeReason: "Using explicit package expiry date",
        status: "expiring_soon",
      },
    }),
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["Banana"].id, purchaseDate: daysAgo(4),
        quantityInitial: 6, quantityCurrent: 3, unit: "unit", totalWeightGrams: 360,
        storageLocation: "counter", storageType: "room_temp",
        shelfLifeSource: "rule:banana", shelfLifeConfidence: "high", shelfLifeReason: "Banana (room temp): ~7 days",
        status: "fresh", estimatedExpiryDate: daysFromNow(3),
      },
    }),
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["Greek Yogurt"].id, purchaseDate: daysAgo(10),
        quantityInitial: 1, quantityCurrent: 0.5, unit: "container", totalWeightGrams: 454,
        expiryDate: daysFromNow(6), openedDate: daysAgo(5),
        storageLocation: "fridge", storageType: "refrigerated",
        shelfLifeSource: "explicit", shelfLifeConfidence: "high", shelfLifeReason: "Using explicit package expiry date",
        status: "expiring_soon",
      },
    }),
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["Cheddar Cheese"].id, purchaseDate: daysAgo(14),
        quantityInitial: 1, quantityCurrent: 0.6, unit: "block", totalWeightGrams: 136,
        expiryDate: daysFromNow(46), storageLocation: "fridge", storageType: "refrigerated",
        shelfLifeSource: "explicit", shelfLifeConfidence: "high", shelfLifeReason: "Using explicit package expiry date",
        status: "fresh",
      },
    }),
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["Pasta"].id, purchaseDate: daysAgo(60),
        quantityInitial: 2, quantityCurrent: 1, unit: "box", totalWeightGrams: 454,
        storageLocation: "pantry", storageType: "pantry",
        shelfLifeSource: "rule:pasta", shelfLifeConfidence: "high", shelfLifeReason: "Pasta (pantry): ~730 days",
        estimatedExpiryDate: daysFromNow(670), status: "fresh",
      },
    }),
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["Tomato Sauce"].id, purchaseDate: daysAgo(30),
        quantityInitial: 3, quantityCurrent: 2, unit: "can", totalWeightGrams: 850,
        storageLocation: "pantry", storageType: "pantry",
        shelfLifeSource: "rule:category:canned", shelfLifeConfidence: "medium", shelfLifeReason: "Canned goods (pantry): ~365 days",
        estimatedExpiryDate: daysFromNow(335), status: "fresh",
      },
    }),
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["Oatmeal"].id, purchaseDate: daysAgo(20),
        quantityInitial: 1, quantityCurrent: 0.7, unit: "container", totalWeightGrams: 357,
        storageLocation: "pantry", storageType: "pantry",
        shelfLifeSource: "rule:oats", shelfLifeConfidence: "high", shelfLifeReason: "Oats (pantry): ~365 days",
        estimatedExpiryDate: daysFromNow(345), status: "fresh",
      },
    }),
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["Butter"].id, purchaseDate: daysAgo(15),
        quantityInitial: 4, quantityCurrent: 3, unit: "stick", totalWeightGrams: 339,
        expiryDate: daysFromNow(75), storageLocation: "fridge", storageType: "refrigerated",
        shelfLifeSource: "explicit", shelfLifeConfidence: "high", shelfLifeReason: "Using explicit package expiry date",
        status: "fresh",
      },
    }),
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["Tuna (Canned)"].id, purchaseDate: daysAgo(60),
        quantityInitial: 4, quantityCurrent: 3, unit: "can", totalWeightGrams: 426,
        storageLocation: "pantry", storageType: "pantry",
        shelfLifeSource: "rule:category:canned", shelfLifeConfidence: "medium", shelfLifeReason: "Canned goods (pantry): ~730 days",
        estimatedExpiryDate: daysFromNow(670), status: "fresh",
      },
    }),
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["Mixed Berries (Frozen)"].id, purchaseDate: daysAgo(14),
        quantityInitial: 1, quantityCurrent: 0.7, unit: "bag", totalWeightGrams: 238,
        storageLocation: "freezer", storageType: "frozen",
        shelfLifeSource: "rule:category:frozen", shelfLifeConfidence: "medium", shelfLifeReason: "Frozen goods: ~180 days",
        estimatedExpiryDate: daysFromNow(166), status: "fresh",
      },
    }),
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["Onion"].id, purchaseDate: daysAgo(10),
        quantityInitial: 3, quantityCurrent: 2, unit: "unit", totalWeightGrams: 300,
        storageLocation: "pantry", storageType: "pantry",
        shelfLifeSource: "rule:onion", shelfLifeConfidence: "high", shelfLifeReason: "Onion (pantry): ~30 days",
        estimatedExpiryDate: daysFromNow(20), status: "fresh",
      },
    }),
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["Olive Oil"].id, purchaseDate: daysAgo(60),
        quantityInitial: 1, quantityCurrent: 0.8, unit: "bottle", totalVolumeMl: 400,
        storageLocation: "pantry", storageType: "pantry",
        shelfLifeSource: "rule:olive oil", shelfLifeConfidence: "high", shelfLifeReason: "Olive Oil (pantry): ~365 days",
        estimatedExpiryDate: daysFromNow(305), status: "fresh",
      },
    }),
    prisma.inventoryBatch.create({
      data: {
        productId: productMap["Bell Pepper"].id, purchaseDate: daysAgo(6),
        quantityInitial: 3, quantityCurrent: 2, unit: "unit", totalWeightGrams: 300,
        expiryDate: daysFromNow(4), storageLocation: "fridge", storageType: "refrigerated",
        shelfLifeSource: "explicit", shelfLifeConfidence: "high", shelfLifeReason: "Using explicit package expiry date",
        status: "expiring_soon",
      },
    }),
  ]);

  // --- CONSUMPTION LOGS (standalone, backward compat) ---
  await Promise.all([
    prisma.consumptionLog.create({
      data: {
        inventoryBatchId: batches[0].id,
        mealType: "breakfast", consumedAt: daysAgo(1),
        quantityUsed: 2, unit: "unit", weightUsedGrams: 100,
        calories: 155, protein: 13, fat: 11, carbs: 1.1,
      },
    }),
    prisma.consumptionLog.create({
      data: {
        inventoryBatchId: batches[4].id,
        mealType: "breakfast", consumedAt: daysAgo(1),
        quantityUsed: 0.1, unit: "loaf", weightUsedGrams: 57,
        calories: 151, protein: 5.1, fat: 1.8, carbs: 27.9,
      },
    }),
    prisma.consumptionLog.create({
      data: {
        inventoryBatchId: batches[6].id,
        mealType: "snack", consumedAt: daysAgo(1),
        quantityUsed: 1, unit: "unit", weightUsedGrams: 120,
        calories: 107, protein: 1.3, fat: 0.4, carbs: 27.6,
      },
    }),
    prisma.consumptionLog.create({
      data: {
        inventoryBatchId: batches[0].id,
        mealType: "breakfast", consumedAt: daysAgo(2),
        quantityUsed: 2, unit: "unit", weightUsedGrams: 100,
        calories: 155, protein: 13, fat: 11, carbs: 1.1,
      },
    }),
  ]);

  // --- RECIPES --- (same as before)
  const recipes = await Promise.all([
    prisma.recipe.create({
      data: {
        name: "Scrambled Eggs",
        description: "Simple fluffy scrambled eggs with butter",
        instructions: "1. Crack eggs into bowl and whisk with salt and pepper.\n2. Melt butter in pan over medium-low heat.\n3. Pour in eggs and stir gently with spatula.\n4. Cook until just set, about 3 minutes.\n5. Serve immediately.",
        cuisineType: "American", estimatedCalories: 220, estimatedProtein: 14, estimatedFat: 17, estimatedCarbs: 1,
        ingredients: { create: [
          { ingredientName: "Eggs", category: "dairy", quantity: 3, unit: "unit", grams: 150 },
          { ingredientName: "Butter", category: "dairy", quantity: 1, unit: "tbsp", grams: 14 },
        ] },
      },
    }),
    prisma.recipe.create({
      data: {
        name: "Spinach Omelet",
        description: "Protein-rich omelet with fresh spinach and cheese",
        instructions: "1. Whisk eggs with salt and pepper.\n2. Heat butter in non-stick pan over medium heat.\n3. Pour eggs, swirl to coat pan.\n4. When edges set, add spinach and cheese.\n5. Fold and cook 1 more minute.\n6. Serve.",
        cuisineType: "American", estimatedCalories: 350, estimatedProtein: 25, estimatedFat: 26, estimatedCarbs: 3,
        ingredients: { create: [
          { ingredientName: "Eggs", category: "dairy", quantity: 3, unit: "unit", grams: 150 },
          { ingredientName: "Spinach", category: "vegetable", quantity: 0.25, unit: "bag", grams: 71 },
          { ingredientName: "Cheddar Cheese", category: "dairy", quantity: 0.15, unit: "block", grams: 34 },
          { ingredientName: "Butter", category: "dairy", quantity: 1, unit: "tbsp", grams: 14 },
        ] },
      },
    }),
    prisma.recipe.create({
      data: {
        name: "Yogurt Berry Bowl",
        description: "Greek yogurt with mixed berries and oatmeal topping",
        instructions: "1. Scoop yogurt into a bowl.\n2. Top with mixed berries.\n3. Sprinkle with oatmeal for crunch.\n4. Optional: drizzle with honey.",
        cuisineType: "American", estimatedCalories: 250, estimatedProtein: 15, estimatedFat: 2, estimatedCarbs: 40,
        ingredients: { create: [
          { ingredientName: "Greek Yogurt", category: "dairy", quantity: 0.25, unit: "container", grams: 227 },
          { ingredientName: "Mixed Berries (Frozen)", category: "frozen", quantity: 0.25, unit: "bag", grams: 85 },
          { ingredientName: "Oatmeal", category: "grains", quantity: 0.05, unit: "container", grams: 25, optional: true },
        ] },
      },
    }),
    prisma.recipe.create({
      data: {
        name: "Chicken Rice Bowl",
        description: "Simple grilled chicken served over steamed rice",
        instructions: "1. Season chicken with salt, pepper, and olive oil.\n2. Cook chicken in pan over medium-high heat, 6-7 min per side.\n3. Cook rice according to package.\n4. Slice chicken and serve over rice.",
        cuisineType: "Asian", estimatedCalories: 450, estimatedProtein: 38, estimatedFat: 8, estimatedCarbs: 55,
        ingredients: { create: [
          { ingredientName: "Chicken Breast", category: "meat", quantity: 0.5, unit: "lb", grams: 227 },
          { ingredientName: "White Rice", category: "grains", quantity: 0.5, unit: "lb", grams: 227 },
          { ingredientName: "Olive Oil", category: "condiments", quantity: 0.02, unit: "bottle", grams: 9 },
        ] },
      },
    }),
    prisma.recipe.create({
      data: {
        name: "Oatmeal with Milk and Banana",
        description: "Warm oatmeal cooked with milk and topped with sliced banana",
        instructions: "1. Combine oatmeal and milk in pot.\n2. Cook over medium heat, stirring, 5 minutes.\n3. Slice banana on top.\n4. Serve warm.",
        cuisineType: "American", estimatedCalories: 320, estimatedProtein: 12, estimatedFat: 5, estimatedCarbs: 58,
        ingredients: { create: [
          { ingredientName: "Oatmeal", category: "grains", quantity: 0.1, unit: "container", grams: 51 },
          { ingredientName: "Milk", category: "dairy", quantity: 0.1, unit: "gallon", grams: 390 },
          { ingredientName: "Banana", category: "fruit", quantity: 1, unit: "unit", grams: 120 },
        ] },
      },
    }),
    prisma.recipe.create({
      data: {
        name: "Grilled Cheese Sandwich",
        description: "Classic grilled cheese with cheddar on toasted bread",
        instructions: "1. Butter one side of each bread slice.\n2. Place cheese between unbuttered sides.\n3. Cook in pan over medium heat until golden, about 3 min per side.\n4. Serve hot.",
        cuisineType: "American", estimatedCalories: 440, estimatedProtein: 18, estimatedFat: 28, estimatedCarbs: 32,
        ingredients: { create: [
          { ingredientName: "Bread", category: "bakery", quantity: 0.15, unit: "loaf", grams: 85 },
          { ingredientName: "Cheddar Cheese", category: "dairy", quantity: 0.2, unit: "block", grams: 45 },
          { ingredientName: "Butter", category: "dairy", quantity: 1, unit: "tbsp", grams: 14 },
        ] },
      },
    }),
    prisma.recipe.create({
      data: {
        name: "Pasta with Tomato Sauce",
        description: "Simple pasta with tomato sauce, garlic, and olive oil",
        instructions: "1. Cook pasta according to package directions.\n2. In another pan, heat olive oil and sauté garlic 1 min.\n3. Add tomato sauce and simmer 10 min.\n4. Toss pasta with sauce.\n5. Serve.",
        cuisineType: "Italian", estimatedCalories: 380, estimatedProtein: 12, estimatedFat: 8, estimatedCarbs: 65,
        ingredients: { create: [
          { ingredientName: "Pasta", category: "grains", quantity: 0.5, unit: "box", grams: 227 },
          { ingredientName: "Tomato Sauce", category: "canned", quantity: 0.5, unit: "can", grams: 213 },
          { ingredientName: "Garlic", category: "vegetable", quantity: 0.25, unit: "head", grams: 10, optional: true },
          { ingredientName: "Olive Oil", category: "condiments", quantity: 0.02, unit: "bottle", grams: 9 },
        ] },
      },
    }),
    prisma.recipe.create({
      data: {
        name: "Vegetable Stir Fry",
        description: "Quick stir fry with bell peppers, onions, and rice",
        instructions: "1. Cook rice according to package.\n2. Heat oil in wok or large pan over high heat.\n3. Add sliced onion and bell pepper, stir fry 3-4 min.\n4. Add spinach, cook 1 min.\n5. Season with soy sauce, salt, pepper.\n6. Serve over rice.",
        cuisineType: "Asian", estimatedCalories: 310, estimatedProtein: 8, estimatedFat: 6, estimatedCarbs: 55,
        ingredients: { create: [
          { ingredientName: "Bell Pepper", category: "vegetable", quantity: 1, unit: "unit", grams: 150 },
          { ingredientName: "Onion", category: "vegetable", quantity: 0.5, unit: "unit", grams: 75 },
          { ingredientName: "Spinach", category: "vegetable", quantity: 0.25, unit: "bag", grams: 71 },
          { ingredientName: "White Rice", category: "grains", quantity: 0.25, unit: "lb", grams: 114 },
          { ingredientName: "Olive Oil", category: "condiments", quantity: 0.02, unit: "bottle", grams: 9 },
        ] },
      },
    }),
    prisma.recipe.create({
      data: {
        name: "Tuna Sandwich",
        description: "Classic tuna sandwich with simple seasoning",
        instructions: "1. Drain tuna and place in bowl.\n2. Mix with a little olive oil, salt, pepper.\n3. Toast bread slices.\n4. Spread tuna on bread.\n5. Serve.",
        cuisineType: "American", estimatedCalories: 350, estimatedProtein: 32, estimatedFat: 10, estimatedCarbs: 30,
        ingredients: { create: [
          { ingredientName: "Tuna (Canned)", category: "canned", quantity: 1, unit: "can", grams: 142 },
          { ingredientName: "Bread", category: "bakery", quantity: 0.15, unit: "loaf", grams: 85 },
          { ingredientName: "Olive Oil", category: "condiments", quantity: 0.01, unit: "bottle", grams: 5, optional: true },
        ] },
      },
    }),
    prisma.recipe.create({
      data: {
        name: "Berry Smoothie",
        description: "Quick smoothie with frozen berries, yogurt, and banana",
        instructions: "1. Add berries, yogurt, banana, and milk to blender.\n2. Blend until smooth.\n3. Pour and serve immediately.",
        cuisineType: "American", estimatedCalories: 280, estimatedProtein: 14, estimatedFat: 2, estimatedCarbs: 52,
        ingredients: { create: [
          { ingredientName: "Mixed Berries (Frozen)", category: "frozen", quantity: 0.3, unit: "bag", grams: 102 },
          { ingredientName: "Greek Yogurt", category: "dairy", quantity: 0.15, unit: "container", grams: 136 },
          { ingredientName: "Banana", category: "fruit", quantity: 1, unit: "unit", grams: 120 },
          { ingredientName: "Milk", category: "dairy", quantity: 0.05, unit: "gallon", grams: 195 },
        ] },
      },
    }),
    prisma.recipe.create({
      data: {
        name: "Fried Rice",
        description: "Simple fried rice with eggs, veggies, and soy sauce",
        instructions: "1. Cook rice and let cool (or use leftover rice).\n2. Heat oil in wok, scramble eggs, set aside.\n3. Stir fry diced onion and bell pepper 3 min.\n4. Add rice, stir fry 3 min.\n5. Add eggs back, season with soy sauce.\n6. Serve.",
        cuisineType: "Asian", estimatedCalories: 420, estimatedProtein: 16, estimatedFat: 14, estimatedCarbs: 58,
        ingredients: { create: [
          { ingredientName: "White Rice", category: "grains", quantity: 0.5, unit: "lb", grams: 227 },
          { ingredientName: "Eggs", category: "dairy", quantity: 2, unit: "unit", grams: 100 },
          { ingredientName: "Onion", category: "vegetable", quantity: 0.5, unit: "unit", grams: 75 },
          { ingredientName: "Bell Pepper", category: "vegetable", quantity: 0.5, unit: "unit", grams: 75 },
          { ingredientName: "Olive Oil", category: "condiments", quantity: 0.02, unit: "bottle", grams: 9 },
        ] },
      },
    }),
    prisma.recipe.create({
      data: {
        name: "Chicken Soup",
        description: "Comforting chicken soup with carrots and onion",
        instructions: "1. Dice chicken, carrots, and onion.\n2. Heat oil in pot, brown chicken 5 min.\n3. Add onion and carrot, cook 3 min.\n4. Add water or broth, bring to boil.\n5. Simmer 20 min.\n6. Season and serve.",
        cuisineType: "American", estimatedCalories: 300, estimatedProtein: 30, estimatedFat: 8, estimatedCarbs: 22,
        ingredients: { create: [
          { ingredientName: "Chicken Breast", category: "meat", quantity: 0.5, unit: "lb", grams: 227 },
          { ingredientName: "Carrot", category: "vegetable", quantity: 2, unit: "unit", grams: 144 },
          { ingredientName: "Onion", category: "vegetable", quantity: 1, unit: "unit", grams: 150 },
          { ingredientName: "Olive Oil", category: "condiments", quantity: 0.01, unit: "bottle", grams: 5, optional: true },
        ] },
      },
    }),
  ]);

  // --- SHELF LIFE RULES ---
  const shelfLifeRules = await prisma.shelfLifeRule.createMany({
    data: [
      // Item-specific rules
      { canonicalName: "milk", category: "dairy", storageType: "refrigerated", defaultShelfLifeDays: 14, openedShelfLifeDays: 7, confidence: "high", sourceNote: "Standard pasteurized milk" },
      { canonicalName: "eggs", category: "dairy", storageType: "refrigerated", defaultShelfLifeDays: 28, openedShelfLifeDays: 28, confidence: "high", sourceNote: "USDA recommendation" },
      { canonicalName: "yogurt", category: "dairy", storageType: "refrigerated", defaultShelfLifeDays: 21, openedShelfLifeDays: 7, confidence: "high", sourceNote: "Standard yogurt" },
      { canonicalName: "cheese", category: "dairy", storageType: "refrigerated", defaultShelfLifeDays: 60, openedShelfLifeDays: 21, confidence: "high", sourceNote: "Hard cheese" },
      { canonicalName: "butter", category: "dairy", storageType: "refrigerated", defaultShelfLifeDays: 90, openedShelfLifeDays: 30, confidence: "high", sourceNote: "Salted butter" },
      { canonicalName: "chicken", category: "meat", storageType: "refrigerated", defaultShelfLifeDays: 5, openedShelfLifeDays: 3, confidence: "high", sourceNote: "Raw chicken" },
      { canonicalName: "ground beef", category: "meat", storageType: "refrigerated", defaultShelfLifeDays: 3, openedShelfLifeDays: 2, confidence: "high", sourceNote: "Raw ground beef" },
      { canonicalName: "bread", category: "bakery", storageType: "room_temp", defaultShelfLifeDays: 7, openedShelfLifeDays: 5, confidence: "high", sourceNote: "Store-bought bread" },
      { canonicalName: "banana", category: "fruit", storageType: "room_temp", defaultShelfLifeDays: 7, confidence: "high", sourceNote: "Room temp ripening" },
      { canonicalName: "apple", category: "fruit", storageType: "refrigerated", defaultShelfLifeDays: 28, confidence: "high", sourceNote: "Refrigerated apples" },
      { canonicalName: "blueberry", category: "fruit", storageType: "refrigerated", defaultShelfLifeDays: 10, confidence: "high", sourceNote: "Fresh berries" },
      { canonicalName: "strawberry", category: "fruit", storageType: "refrigerated", defaultShelfLifeDays: 7, confidence: "high", sourceNote: "Fresh berries" },
      { canonicalName: "spinach", category: "vegetable", storageType: "refrigerated", defaultShelfLifeDays: 7, openedShelfLifeDays: 3, confidence: "high", sourceNote: "Bagged spinach" },
      { canonicalName: "lettuce", category: "vegetable", storageType: "refrigerated", defaultShelfLifeDays: 7, openedShelfLifeDays: 3, confidence: "high", sourceNote: "Leafy greens" },
      { canonicalName: "carrot", category: "vegetable", storageType: "refrigerated", defaultShelfLifeDays: 21, confidence: "high", sourceNote: "Whole carrots" },
      { canonicalName: "onion", category: "vegetable", storageType: "pantry", defaultShelfLifeDays: 30, confidence: "high", sourceNote: "Whole onions, dry storage" },
      { canonicalName: "garlic", category: "vegetable", storageType: "pantry", defaultShelfLifeDays: 60, confidence: "high", sourceNote: "Whole garlic heads" },
      { canonicalName: "potato", category: "vegetable", storageType: "pantry", defaultShelfLifeDays: 30, confidence: "high", sourceNote: "Cool dry storage" },
      { canonicalName: "bell pepper", category: "vegetable", storageType: "refrigerated", defaultShelfLifeDays: 10, confidence: "high", sourceNote: "Fresh peppers" },
      { canonicalName: "rice", category: "grains", storageType: "pantry", defaultShelfLifeDays: 365, confidence: "high", sourceNote: "Dry white/brown rice" },
      { canonicalName: "pasta", category: "grains", storageType: "pantry", defaultShelfLifeDays: 730, confidence: "high", sourceNote: "Dry pasta" },
      { canonicalName: "oats", category: "grains", storageType: "pantry", defaultShelfLifeDays: 365, confidence: "high", sourceNote: "Dry oats" },
      { canonicalName: "olive oil", category: "condiments", storageType: "pantry", defaultShelfLifeDays: 365, confidence: "high", sourceNote: "Sealed olive oil" },
      // Category-level fallback rules
      { canonicalName: null, category: "dairy", storageType: "refrigerated", defaultShelfLifeDays: 14, openedShelfLifeDays: 7, confidence: "medium", sourceNote: "Category default" },
      { canonicalName: null, category: "meat", storageType: "refrigerated", defaultShelfLifeDays: 5, openedShelfLifeDays: 3, confidence: "medium", sourceNote: "Category default" },
      { canonicalName: null, category: "fruit", storageType: "refrigerated", defaultShelfLifeDays: 7, confidence: "medium", sourceNote: "Category default" },
      { canonicalName: null, category: "vegetable", storageType: "refrigerated", defaultShelfLifeDays: 7, confidence: "medium", sourceNote: "Category default" },
      { canonicalName: null, category: "bakery", storageType: "room_temp", defaultShelfLifeDays: 5, confidence: "medium", sourceNote: "Category default" },
      { canonicalName: null, category: "grains", storageType: "pantry", defaultShelfLifeDays: 365, confidence: "medium", sourceNote: "Category default" },
      { canonicalName: null, category: "canned", storageType: "pantry", defaultShelfLifeDays: 365, confidence: "medium", sourceNote: "Category default" },
      { canonicalName: null, category: "frozen", storageType: "frozen", defaultShelfLifeDays: 180, confidence: "medium", sourceNote: "Category default" },
      { canonicalName: null, category: "condiments", storageType: "pantry", defaultShelfLifeDays: 180, confidence: "low", sourceNote: "Category default" },
      { canonicalName: null, category: "snacks", storageType: "pantry", defaultShelfLifeDays: 90, confidence: "low", sourceNote: "Category default" },
      { canonicalName: null, category: "beverages", storageType: "pantry", defaultShelfLifeDays: 180, confidence: "low", sourceNote: "Category default" },
    ],
  });

  console.log(`Seeded ${products.length} products`);
  console.log(`Seeded ${batches.length} inventory batches`);
  console.log(`Seeded ${recipes.length} recipes`);
  console.log(`Seeded ${shelfLifeRules.count} shelf life rules`);
  console.log("Seed complete!");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
