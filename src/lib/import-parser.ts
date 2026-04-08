import Papa from "papaparse";
import { categorizeItem, isNonFood } from "./categories";

export interface ParsedItem {
  rawName: string;
  parsedName: string;
  category: string;
  quantity: number;
  unit: string;
  totalWeightGrams: number | null;
  totalVolumeMl: number | null;
  purchaseDate: string | null;
  confidence: number;
  needsReview: boolean;
  isFood: boolean;
}

// ----- Name normalization -----

/**
 * Clean up a product name for display:
 * - Strip packaging/size info ("18 oz. Container", "12 ct", "8/PK")
 * - Remove trailing commas/whitespace
 * - Preserve meaningful descriptors (Fresh, Organic, etc.)
 */
function cleanDisplayName(raw: string): string {
  let name = raw;

  // Remove size/weight/count suffixes: "18 oz. Container", "12 oz Cup", "70 Count", "8/PK"
  name = name.replace(/,?\s*\d+\.?\d*\s*(oz|fl\s*oz|lb|lbs|g|kg|ml|l|gal|ct|count|pk|pack|pcs|pieces|ea)\b\.?\s*(container|cup|bag|box|bottle|can|carton|pouch|tub|jar|package|bundle)?/gi, "");

  // Remove patterns like "8/PK", "6-pk"
  name = name.replace(/,?\s*\d+\s*[\/\-]\s*(pk|pack|ct|count)\b/gi, "");

  // Remove "Non-GMO, 12 oz, 4 Count" style trailing info
  name = name.replace(/,\s*Non-GMO\b/gi, "");
  name = name.replace(/,\s*\d+\s*(oz|count|ct|pk|g|ml)\b.*/gi, "");

  // Remove ", Each" suffix
  name = name.replace(/,?\s*Each$/i, "");

  // Remove trailing commas and whitespace
  name = name.replace(/[,\s]+$/, "").trim();

  // Remove extra spaces
  name = name.replace(/\s+/g, " ");

  return name || raw.trim();
}

/** Normalize an item name (basic cleanup, no display cleaning) */
function normalizeName(raw: string): string {
  return raw
    .replace(/[^\w\s\-().\/,&']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Full normalization: clean + normalize */
function normalizeDisplayName(raw: string): string {
  const cleaned = cleanDisplayName(raw);
  return normalizeName(cleaned);
}

// ----- Extraction helpers -----

/** Units that represent discrete counts (used for Qty) */
const COUNT_UNITS = /^(ct|count|pk|pack|pcs|pieces|bottles|cans|bars|bags)$/i;

/** Units that represent weight or volume (used for weight/volume fields) */
const WEIGHT_VOLUME_UNITS = /^(oz|floz|fl\s*oz|lb|lbs|g|kg|ml|l|gal|gallon|pt|qt)$/i;

interface SizeInfo {
  value: number;
  unit: string;
  rawUnit: string;
}

/**
 * Extract ALL quantity+unit pairs from a text string.
 * E.g. "12 oz, 4 Count" => [{value:12, unit:"oz"}, {value:4, unit:"count"}]
 */
function extractAllSizes(text: string): SizeInfo[] {
  const results: SizeInfo[] = [];
  const regex = /(\d+\.?\d*)\s*(fl\s*oz|oz|lb|lbs|gal|gallon|ct|count|pk|pack|pcs|pieces|bottles|cans|bars|bags|kg|g|ml|l|pt|qt)\b/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const rawUnit = match[2];
    const normalizedUnit = rawUnit.toLowerCase().replace(/\s+/g, "");
    results.push({
      value: parseFloat(match[1]),
      unit: normalizedUnit,
      rawUnit,
    });
  }
  return results;
}

/**
 * Given all extracted sizes, determine:
 *   - qty + unit (prefer count-like; fall back to orderQty)
 *   - totalWeightGrams (from weight units, per-unit × orderQty)
 *   - totalVolumeMl (from volume units, per-unit × orderQty)
 *
 * `orderQty` is the order-level quantity (e.g. Walmart "Qty 2" meaning
 * the customer ordered 2 of the same item).
 *
 * Design principle: think about daily-life usage. If you buy 2 cups of
 * yogurt (5.3 oz each), the natural inventory unit is "2 cups" not
 * "10.6 oz". You decrement by 1 cup at a time. The 5.3 oz is the
 * per-unit weight.
 *
 * Qty priority:
 *   1) count-like value (ct, count, pk, pack, etc.) × orderQty
 *   2) orderQty as-is (each item is one "unit"), with weight/volume
 *      stored as the total across all units
 */
interface ResolvedQty {
  quantity: number;
  unit: string;
  totalWeightGrams: number | null;
  totalVolumeMl: number | null;
}

function resolveQtyAndWeight(sizes: SizeInfo[], orderQty: number): ResolvedQty {
  const countLike = sizes.find((s) => COUNT_UNITS.test(s.unit));
  const weightLike = sizes.find((s) => /^(oz|lb|lbs|g|kg)$/.test(s.unit));
  const volumeLike = sizes.find((s) => /^(floz|ml|l|gal|gallon|pt|qt)$/.test(s.unit));

  let quantity = orderQty;
  let unit = "unit";
  let totalWeightGrams: number | null = null;
  let totalVolumeMl: number | null = null;

  // 1) If a count-like value exists (e.g. "4 Count"), use count × orderQty
  //    Example: "12 oz, 4 Count" Qty 1 → qty=4, weight=12oz per pack
  if (countLike) {
    quantity = countLike.value * orderQty;
    unit = countLike.unit;
  }
  // 2) No count found → use orderQty as-is (each ordered item = 1 unit)
  //    Example: "Chobani 5.3 oz Cup" Qty 2 → qty=2 unit, weight=5.3oz each
  //    The weight/volume describes each unit, not the quantity.

  // Parse weight: per-unit value × orderQty = total weight
  if (weightLike) {
    const perUnitGrams = estimateWeight(weightLike.value, weightLike.unit);
    if (perUnitGrams != null) {
      totalWeightGrams = perUnitGrams * orderQty;
    }
  }

  // Parse volume: per-unit value × orderQty = total volume
  if (volumeLike) {
    const perUnitMl = estimateVolume(volumeLike.value, volumeLike.unit);
    if (perUnitMl != null) {
      totalVolumeMl = perUnitMl * orderQty;
    }
  }

  return { quantity, unit, totalWeightGrams, totalVolumeMl };
}

/** Estimate weight in grams from value + unit */
function estimateWeight(value: number, unit: string): number | null {
  const factors: Record<string, number> = {
    oz: 28.35,
    lb: 453.6,
    lbs: 453.6,
    kg: 1000,
    g: 1,
  };
  const f = factors[unit.toLowerCase()];
  return f ? Math.round(value * f) : null;
}

/** Estimate volume in ml from value + unit */
function estimateVolume(value: number, unit: string): number | null {
  const factors: Record<string, number> = {
    floz: 29.57,
    ml: 1,
    l: 1000,
    gal: 3785,
    gallon: 3785,
    pt: 473,
    qt: 946,
  };
  const f = factors[unit.toLowerCase()];
  return f ? Math.round(value * f) : null;
}

/** Try to detect purchase date from text */
function extractDate(text: string): string | null {
  const match = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (match) {
    const year = match[3].length === 2 ? "20" + match[3] : match[3];
    return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  }
  return null;
}

/** Parse "Mar 14, 2026" or "March 14, 2026" style dates */
function extractWrittenDate(text: string): string | null {
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  // Match abbreviated or full month names: "Mar 14, 2026", "March 14, 2026"
  const match = text.match(/(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (match) {
    const month = months[match[1].toLowerCase().slice(0, 3)];
    if (month) return `${match[3]}-${month}-${match[2].padStart(2, "0")}`;
  }
  return null;
}

/**
 * Extract an order/purchase date from document text.
 * Searches the first ~30 lines for dates in various formats:
 *   - Written: "Mar 14, 2026", "March 14, 2026"
 *   - Numeric: "03/14/2026", "3-14-2026"
 * Looks for dates near order-related context words first, then falls
 * back to any written date found in the header area.
 *
 * Fallback if no date found: returns null (caller should use current date).
 */
function extractOrderDate(text: string): string | null {
  // Only search the header area (first ~2000 chars or 30 lines)
  const headerLines = text.split("\n").slice(0, 30);
  const header = headerLines.join("\n");

  // 1) Written date near order-related keywords (highest priority)
  //    Matches: "Mar 14, 2026 order", "Order placed March 14, 2026",
  //    "Delivered Mar 14, 2026", "Placed on Mar 14, 2026"
  const contextPatterns = [
    // Date followed by "order"
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}\s+order/i,
    // "order/placed/delivered/shipped" ... then date on same line
    /(?:order|placed|delivered|shipped|purchased|bought).*?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}/i,
    // "order date:" or "date:" followed by numeric date
    /(?:order\s*date|date)\s*:?\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
  ];

  for (const pattern of contextPatterns) {
    const match = header.match(pattern);
    if (match) {
      // Try written date first, then numeric
      const written = extractWrittenDate(match[0]);
      if (written) return written;
      const numeric = extractDate(match[0]);
      if (numeric) return numeric;
    }
  }

  // 2) Any written date in header area (e.g. standalone "Mar 14, 2026")
  const anyWritten = extractWrittenDate(header);
  if (anyWritten) return anyWritten;

  // 3) Numeric date near order keywords
  const numericContext = header.match(/(?:order|placed|delivered|shipped|purchased|bought).*?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i);
  if (numericContext) {
    return extractDate(numericContext[0]);
  }

  // 4) Any numeric date in the first few lines (likely an order date)
  for (const line of headerLines.slice(0, 10)) {
    const d = extractDate(line);
    if (d) return d;
  }

  return null;
}

// ----- Parsers -----

/** Parse CSV text into structured items */
export function parseCSV(csvText: string): ParsedItem[] {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const items: ParsedItem[] = [];

  for (const row of result.data as Record<string, string>[]) {
    const name =
      row["Product"] || row["product"] || row["Item"] || row["item"] ||
      row["Description"] || row["description"] || row["Name"] || row["name"] ||
      row["Item Description"] || row["Product Name"] || "";

    if (!name.trim()) continue;

    const parsedName = normalizeDisplayName(name);
    const quantityStr = row["Qty"] || row["qty"] || row["Quantity"] || row["quantity"] || row["Count"] || "1";
    const dateStr = row["Date"] || row["date"] || row["Purchase Date"] || row["Order Date"] || "";
    const sizeStr = row["Size"] || row["size"] || row["Weight"] || row["weight"] || row["Unit Size"] || "";

    const orderQty = parseFloat(quantityStr) || 1;

    // Extract sizes from the size column and the product name
    const sizesFromSize = extractAllSizes(sizeStr);
    const sizesFromName = extractAllSizes(name);
    // Prefer explicit size column; fall back to name-embedded sizes
    const sizes = sizesFromSize.length > 0 ? sizesFromSize : sizesFromName;

    const resolved = resolveQtyAndWeight(sizes, orderQty);

    const purchaseDate = extractDate(dateStr) || extractDate(name) || null;
    const category = categorizeItem(parsedName);
    const foodFlag = !isNonFood(name);

    let confidence = 0.5;
    if (resolved.totalWeightGrams || resolved.totalVolumeMl) confidence += 0.2;
    if (purchaseDate) confidence += 0.15;
    if (category !== "other") confidence += 0.15;

    items.push({
      rawName: name.trim(),
      parsedName,
      category,
      quantity: resolved.quantity,
      unit: resolved.unit,
      totalWeightGrams: resolved.totalWeightGrams,
      totalVolumeMl: resolved.totalVolumeMl,
      purchaseDate,
      confidence: Math.min(confidence, 1),
      needsReview: confidence < 0.7,
      isFood: foodFlag,
    });
  }

  return items;
}

/** Parse plain text (line by line) into items */
export function parseText(text: string): ParsedItem[] {
  // Try to extract a document-level date before line-by-line parsing
  const documentDate = extractOrderDate(text);

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.match(/^(order|date|total|subtotal|tax|shipping)/i));

  const items: ParsedItem[] = [];
  let currentDate: string | null = documentDate;

  for (const line of lines) {
    const dateCandidate = extractDate(line);
    if (dateCandidate && line.replace(/[\d\/\-\s]/g, "").length < 5) {
      currentDate = dateCandidate;
      continue;
    }

    if (line.match(/^\$?\d+\.\d{2}$/)) continue;

    const cleanLine = line.replace(/\s*\$?\d+\.\d{2}\s*$/, "").trim();
    if (!cleanLine) continue;

    const parsedName = normalizeDisplayName(cleanLine);
    if (parsedName.length < 2) continue;

    // Check for leading "3x" or "3 " multiplier
    let orderQty = 1;
    const leadingQty = cleanLine.match(/^(\d+)\s*[xX]?\s+/);
    if (leadingQty) {
      orderQty = parseInt(leadingQty[1]);
    }

    const sizes = extractAllSizes(cleanLine);
    const resolved = resolveQtyAndWeight(sizes, orderQty);

    const category = categorizeItem(parsedName);
    const foodFlag = !isNonFood(cleanLine);

    let confidence = 0.4;
    if (resolved.totalWeightGrams || resolved.totalVolumeMl) confidence += 0.2;
    if (currentDate) confidence += 0.1;
    if (category !== "other") confidence += 0.15;

    items.push({
      rawName: cleanLine,
      parsedName,
      category,
      quantity: resolved.quantity,
      unit: resolved.unit,
      totalWeightGrams: resolved.totalWeightGrams,
      totalVolumeMl: resolved.totalVolumeMl,
      purchaseDate: currentDate,
      confidence: Math.min(confidence, 1),
      needsReview: true,
      isFood: foodFlag,
    });
  }

  return items;
}

// Walmart order status keywords
const WALMART_STATUSES = ["Shopped", "Substitutions", "Unavailable", "Canceled", "Delivered", "Shipped"];

/**
 * Parse Walmart PDF text. The pdf-parse output concatenates fields, producing lines like:
 *   "Fresh Blueberries, 18 oz. ContainerShoppedQty 1$7.88"
 *   "Sola Bread Cinnamon & Raisin Soft Bagels, Non-GMO, 12 oz, 4 CountShoppedQty 1$6.98"
 */
export function parseWalmartPDF(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];

  // Extract order/purchase date from the PDF text.
  // Walmart PDFs contain dates in various formats:
  //   "Mar 14, 2026 order", "Order placed March 14, 2026",
  //   "Delivered Mar 14, 2026", "Order date: 03/14/2026",
  //   or standalone "Mar 14, 2026" near the top.
  const orderDate = extractOrderDate(text);

  // Match Walmart item lines: <product name><Status>Qty <n>$<price>
  const itemRegex = /^(.+?)(Shopped|Substitutions|Unavailable|Canceled|Delivered|Shipped)Qty\s*(\d+)\$[\d.]+$/;
  const tailRegex = /(?:Shopped|Substitutions|Unavailable|Canceled|Delivered|Shipped)Qty\s*\d+\$[\d.]+$/;

  const rawLines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Join multi-line product names
  const joined: string[] = [];
  let buffer = "";
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    if (itemRegex.test(line)) {
      if (buffer) { joined.push(buffer); buffer = ""; }
      joined.push(line);
      continue;
    }

    if (tailRegex.test(line) && buffer) {
      const candidate = buffer + " " + line;
      if (itemRegex.test(candidate)) {
        joined.push(candidate);
      } else {
        joined.push(buffer);
        joined.push(line);
      }
      buffer = "";
      continue;
    }

    const bufferLineCount = buffer ? buffer.split(" ").length : 0;
    if (bufferLineCount < 40) {
      buffer = buffer ? buffer + " " + line : line;
    } else {
      if (buffer) joined.push(buffer);
      buffer = line;
    }
  }
  if (buffer) joined.push(buffer);

  for (const line of joined) {
    const match = line.match(itemRegex);
    if (!match) continue;

    const rawProductName = match[1].trim();
    const status = match[2];
    const orderQty = parseInt(match[3]); // Walmart "Qty N" = order-level count

    // Skip canceled/unavailable items
    if (status === "Canceled" || status === "Unavailable") continue;

    // Extract ALL size values from the product name BEFORE cleaning
    const sizes = extractAllSizes(rawProductName);
    const resolved = resolveQtyAndWeight(sizes, orderQty);

    // Clean up name for display (strip sizes, etc.)
    const parsedName = normalizeDisplayName(rawProductName);
    if (parsedName.length < 2) continue;

    const category = categorizeItem(rawProductName); // use raw for better detection
    const foodFlag = !isNonFood(rawProductName);

    let confidence = 0.6;
    if (resolved.totalWeightGrams || resolved.totalVolumeMl) confidence += 0.15;
    if (orderDate) confidence += 0.1;
    if (category !== "other") confidence += 0.15;

    items.push({
      rawName: rawProductName,
      parsedName,
      category,
      quantity: resolved.quantity,
      unit: resolved.unit,
      totalWeightGrams: resolved.totalWeightGrams,
      totalVolumeMl: resolved.totalVolumeMl,
      purchaseDate: orderDate,
      confidence: Math.min(confidence, 1),
      needsReview: confidence < 0.7,
      isFood: foodFlag,
    });
  }

  return items;
}

/** Parse PDF text - detect Walmart format or fall back to generic */
export function parsePDFText(text: string): ParsedItem[] {
  if (text.includes("Walmart.com") || text.includes("walmart.com")) {
    const walmartItems = parseWalmartPDF(text);
    if (walmartItems.length > 0) return walmartItems;
  }
  // For non-Walmart PDFs, try to extract a document-level date first
  const items = parseText(text);
  // If text parser didn't find per-line dates, apply document-level date
  const docDate = extractOrderDate(text);
  if (docDate) {
    for (const item of items) {
      if (!item.purchaseDate) {
        item.purchaseDate = docDate;
      }
    }
  }
  return items;
}
