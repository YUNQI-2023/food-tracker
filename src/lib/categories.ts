/** Expanded keyword-based category mapping for imports */

// More specific keywords first to avoid false matches
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  non_food: [
    "battery", "batteries", "duracell", "energizer",
    "trash bag", "paper towel", "toilet paper", "napkin",
    "detergent", "bleach", "soap", "shampoo", "toothpaste",
    "light bulb", "aluminum foil", "plastic wrap", "sponge",
    "laundry", "fabric softener", "dryer sheet",
    "candle", "air freshener", "dish soap",
  ],
  supplement: [
    "supplement", "vitamin", "magnesium", "calcium", "zinc",
    "iron supplement", "fish oil", "omega", "probiotic",
    "multivitamin", "b12", "b-12", "vitamin d", "vitamin c",
    "glycinate", "glucosamine", "melatonin", "biotin",
    "collagen", "turmeric", "ashwagandha", "elderberry",
    "capsule", "dietary supplement",
  ],
  fruit: [
    "apple", "banana", "orange", "grape", "strawberry",
    "blueberry", "blueberries", "raspberry", "raspberries",
    "blackberry", "blackberries", "mango", "pineapple",
    "watermelon", "cantaloupe", "peach", "pear", "plum",
    "cherry", "cherries", "kiwi", "lemon", "lime",
    "avocado", "fruit",
  ],
  vegetable: [
    "broccoli", "carrot", "spinach", "kale", "lettuce",
    "tomato", "cucumber", "celery", "zucchini", "squash",
    "cauliflower", "asparagus", "cabbage", "corn",
    "mushroom", "sweet potato", "potato",
    "green bean", "peas", "artichoke", "radish",
    "vegetable", "salad mix", "arugula", "romaine",
  ],
  dairy: [
    "milk", "cheese", "yogurt", "chobani", "dannon", "fage",
    "butter", "cream", "egg", "eggs", "sour cream",
    "cottage cheese", "cream cheese", "whipped cream",
    "half and half", "half & half", "creamer",
    "mozzarella", "parmesan", "cheddar", "swiss",
    "provolone", "gouda", "brie", "ricotta",
  ],
  meat: [
    "chicken", "beef", "pork", "turkey", "steak",
    "ground beef", "ground turkey", "sausage", "bacon", "ham",
    "lamb", "veal", "bison", "salami", "pepperoni",
    "hot dog", "deli meat", "roast",
  ],
  seafood: [
    "salmon", "shrimp", "tuna", "cod", "tilapia",
    "crab", "lobster", "clam", "mussel", "oyster",
    "catfish", "trout", "halibut", "sardine", "anchovy",
    "fish fillet", "fish stick", "seafood",
  ],
  bakery: [
    "bread", "roll", "bun", "bagel", "muffin",
    "tortilla", "croissant", "pita", "naan",
    "cake", "donut", "doughnut", "pastry", "pie crust",
    "english muffin", "waffle", "pancake mix",
  ],
  pantry: [
    "rice", "pasta", "oatmeal", "oats", "cereal", "flour",
    "noodle", "quinoa", "couscous",
    "canned", "beans", "soup", "sauce", "tomato sauce",
    "peanut butter", "jelly", "jam", "honey",
    "sugar", "salt", "pepper", "spice", "seasoning",
    "broth", "stock", "olive oil", "vegetable oil",
    "canola oil", "coconut oil", "vinegar", "soy sauce",
    "ketchup", "mustard", "mayo", "mayonnaise",
    "salsa", "hot sauce", "syrup", "dressing",
  ],
  frozen: [
    "frozen", "ice cream", "frozen pizza", "frozen dinner",
    "popsicle", "frozen vegetable", "frozen fruit",
  ],
  beverage: [
    "water", "juice", "soda", "coffee", "tea",
    "kombucha", "energy drink", "gatorade", "milk alternative",
    "almond milk", "oat milk", "sparkling", "lemonade",
  ],
  snack: [
    "chips", "crackers", "cookies", "nuts", "popcorn",
    "candy", "chocolate", "granola bar", "protein bar",
    "pretzels", "trail mix", "jerky", "dried fruit",
  ],
  prepared_food: [
    "rotisserie", "deli", "prepared", "ready to eat",
    "meal kit", "pre-made", "salad kit",
  ],
};

/** Brand-to-category special mappings */
const BRAND_CATEGORY_MAP: Record<string, string> = {
  chobani: "dairy",
  dannon: "dairy",
  fage: "dairy",
  yoplait: "dairy",
  oikos: "dairy",
  siggi: "dairy",
  duracell: "non_food",
  energizer: "non_food",
  clorox: "non_food",
  "nature made": "supplement",
  "nature's bounty": "supplement",
  centrum: "supplement",
  "one a day": "supplement",
  olly: "supplement",
};

/** Detect if item is non-food based on name */
export function isNonFood(name: string): boolean {
  const lower = name.toLowerCase();
  const nonFoodCategories = ["non_food", "supplement"];
  for (const cat of nonFoodCategories) {
    if (CATEGORY_KEYWORDS[cat]?.some((kw) => lower.includes(kw))) {
      return true;
    }
  }
  // Also check brand map
  for (const [brand, category] of Object.entries(BRAND_CATEGORY_MAP)) {
    if (lower.includes(brand) && (category === "non_food" || category === "supplement")) {
      return true;
    }
  }
  return false;
}

export function categorizeItem(name: string): string {
  const lower = name.toLowerCase();

  // Check brand-specific mappings first
  for (const [brand, category] of Object.entries(BRAND_CATEGORY_MAP)) {
    if (lower.includes(brand)) return category;
  }

  // Check keyword categories (non_food and supplement first for priority)
  const priorityOrder = [
    "non_food", "supplement",
    "fruit", "vegetable", "dairy", "meat", "seafood",
    "bakery", "pantry", "frozen", "beverage", "snack", "prepared_food",
  ];

  for (const category of priorityOrder) {
    const keywords = CATEGORY_KEYWORDS[category];
    if (keywords?.some((kw) => lower.includes(kw))) {
      return category;
    }
  }

  return "other";
}

export const CATEGORIES = [
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
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Get human-readable label */
export function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    dairy: "Dairy",
    meat: "Meat",
    seafood: "Seafood",
    fruit: "Fruit",
    vegetable: "Vegetable",
    bakery: "Bakery",
    pantry: "Pantry",
    frozen: "Frozen",
    beverage: "Beverage",
    snack: "Snack",
    prepared_food: "Prepared Food",
    supplement: "Supplement",
    non_food: "Non-Food",
    other: "Other",
    // Legacy categories
    produce: "Produce",
    grains: "Grains",
    canned: "Canned",
    beverages: "Beverages",
    snacks: "Snacks",
    condiments: "Condiments",
  };
  return labels[cat] || cat;
}
