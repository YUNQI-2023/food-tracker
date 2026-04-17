/**
 * AI recipe recommendation helper.
 *
 * Given a summary of the user's current inventory, ask an LLM to suggest
 * practical recipes that prefer expiring-soon ingredients and minimize
 * missing ones. The response is constrained to a strict JSON schema and
 * validated with zod so downstream code can treat it as typed data.
 *
 * We intentionally call the Gemini GenerateContent API via `fetch` to avoid
 * adding a new SDK dependency. The API key is read from the environment.
 */

import { z } from "zod";

// ---- Public schema for AI output ----

export const aiRecipeSchema = z.object({
  name: z.string(),
  description: z.string(),
  ingredientsUsed: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.string().optional(), // free-form, e.g. "1 cup", "200g"
        fromInventory: z.boolean().default(true),
      })
    )
    .default([]),
  missingIngredients: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.string().optional(),
        optional: z.boolean().default(false),
      })
    )
    .default([]),
  steps: z.array(z.string()).min(1),
  estimatedNutrition: z
    .object({
      calories: z.number().nullable().optional(),
      protein: z.number().nullable().optional(),
      fat: z.number().nullable().optional(),
      carbs: z.number().nullable().optional(),
    })
    .optional(),
  reason: z.string(), // why this recipe was suggested (e.g. "uses expiring spinach and chicken")
  cuisineType: z.string().nullable().optional(),
  estimatedTimeMinutes: z.number().nullable().optional(),
});

export const aiRecipeResponseSchema = z.object({
  recommendations: z.array(aiRecipeSchema).min(1).max(5),
});

export type AIRecipe = z.infer<typeof aiRecipeSchema>;
export type AIRecipeResponse = z.infer<typeof aiRecipeResponseSchema>;

// ---- Inventory summary type passed in by the API route ----

export interface InventorySummaryItem {
  name: string;
  brand?: string | null;
  category: string;
  quantity: number;
  unit: string;
  weightGrams?: number | null;
  daysUntilExpiry?: number | null;
  status: string; // "fresh" | "expiring_soon" | "expired" | ...
  caloriesPer100g?: number | null;
  proteinPer100g?: number | null;
}

// ---- Errors ----

export class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIUnavailableError";
  }
}

export class AIResponseParseError extends Error {
  public readonly raw: string;
  constructor(message: string, raw: string) {
    super(message);
    this.name = "AIResponseParseError";
    this.raw = raw;
  }
}

// ---- Prompt construction ----

const SYSTEM_PROMPT = `You are a helpful culinary assistant that recommends practical home recipes based on what is currently in the user's kitchen inventory.

Rules:
- Strongly prefer ingredients that are expiring soon.
- Prefer ingredients that the user already has in sufficient quantity.
- Minimize missing ingredients. If missing ingredients are needed, keep them common pantry staples and clearly mark them.
- Suggestions must be realistic, cookable meals (not ingredient lists).
- Include short, numbered step-by-step instructions.
- When possible, estimate nutrition per serving using the nutrition data provided for inventory items; otherwise omit.
- Always explain briefly WHY each recipe was suggested, referencing specific inventory items (especially expiring ones).

You MUST respond with ONLY a single JSON object matching this TypeScript type, with no prose, no markdown fences, no commentary:

type Response = {
  recommendations: Array<{
    name: string;
    description: string;
    ingredientsUsed: Array<{ name: string; quantity?: string; fromInventory: boolean }>;
    missingIngredients: Array<{ name: string; quantity?: string; optional: boolean }>;
    steps: string[];
    estimatedNutrition?: { calories?: number|null; protein?: number|null; fat?: number|null; carbs?: number|null };
    reason: string;
    cuisineType?: string|null;
    estimatedTimeMinutes?: number|null;
  }>;
};`;

function formatInventoryForPrompt(items: InventorySummaryItem[]): string {
  if (items.length === 0) return "(inventory is empty)";
  // Sort: expiring first, then by soonest expiry
  const sorted = [...items].sort((a, b) => {
    const aExp = a.status === "expiring_soon" || a.status === "urgent" ? 0 : 1;
    const bExp = b.status === "expiring_soon" || b.status === "urgent" ? 0 : 1;
    if (aExp !== bExp) return aExp - bExp;
    const ad = a.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
    const bd = b.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
    return ad - bd;
  });
  return sorted
    .map((i) => {
      const parts: string[] = [];
      parts.push(`- ${i.name}${i.brand ? ` (${i.brand})` : ""}`);
      parts.push(`category=${i.category}`);
      parts.push(`qty=${i.quantity}${i.unit}`);
      if (i.weightGrams != null) parts.push(`${Math.round(i.weightGrams)}g`);
      if (i.daysUntilExpiry != null) {
        parts.push(
          i.daysUntilExpiry <= 0
            ? `EXPIRED ${Math.abs(i.daysUntilExpiry)}d ago`
            : `expires in ${i.daysUntilExpiry}d`
        );
      }
      if (i.status === "expiring_soon" || i.status === "urgent") {
        parts.push("**EXPIRING SOON**");
      }
      if (i.caloriesPer100g != null) parts.push(`${Math.round(i.caloriesPer100g)}kcal/100g`);
      if (i.proteinPer100g != null) parts.push(`${Math.round(i.proteinPer100g)}g protein/100g`);
      return parts.join(" | ");
    })
    .join("\n");
}

function buildUserPrompt(items: InventorySummaryItem[], count: number): string {
  return `Please suggest ${count} practical recipes I can cook tonight using my current inventory below. Prioritize recipes that use items marked **EXPIRING SOON**. It's fine if some ingredients must be bought, but prefer recipes that minimize missing ingredients.

CURRENT INVENTORY:
${formatInventoryForPrompt(items)}

Keep each description and reason concise. Keep each step short. Limit missing ingredients to the essentials. Respond with ONLY the JSON object — no markdown, no commentary.`;
}

// ---- Response parsing ----

function extractJsonPayload(text: string): string {
  const trimmed = text.trim();
  // Strip ```json ... ``` or ``` ... ``` fences if the model ignored instructions
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Otherwise try to locate the first { and last }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

// ---- Main entrypoint ----

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";

export async function generateAIRecipeRecommendations(
  inventory: InventorySummaryItem[],
  count = 3
): Promise<AIRecipeResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AIUnavailableError(
      "GEMINI_API_KEY is not set. AI recipe recommendations are disabled."
    );
  }
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const res = await fetch(
    `${GEMINI_API_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: buildUserPrompt(inventory, count) }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AIUnavailableError(
      `Gemini API error: HTTP ${res.status}${detail ? ` — ${detail.slice(0, 300)}` : ""}`
    );
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
      finishReason?: string;
    }>;
    promptFeedback?: {
      blockReason?: string;
    };
  };
  const firstCandidate = data.candidates?.[0];
  const raw = firstCandidate?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim() ?? "";
  if (!raw) {
    const reason = data.promptFeedback?.blockReason
      ? `Blocked by Gemini: ${data.promptFeedback.blockReason}`
      : "Empty response from model";
    throw new AIResponseParseError(reason, JSON.stringify(data).slice(0, 500));
  }

  if (firstCandidate?.finishReason === "MAX_TOKENS") {
    throw new AIResponseParseError(
      "Gemini response was truncated before the JSON completed. Try again or request fewer/shorter recommendations.",
      raw.slice(0, 500)
    );
  }

  const payload = extractJsonPayload(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch (err) {
    throw new AIResponseParseError(
      `Failed to parse JSON: ${(err as Error).message}. The model may have returned incomplete or malformed JSON.`,
      raw.slice(0, 500)
    );
  }

  const validated = aiRecipeResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new AIResponseParseError(
      `Response did not match schema: ${validated.error.message}`,
      raw.slice(0, 500)
    );
  }
  return validated.data;
}
