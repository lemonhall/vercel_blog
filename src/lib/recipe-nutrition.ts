import { createHash } from "node:crypto";
import { excerptFromHtml } from "@/lib/html";

export const RECIPE_CALORIE_MODEL = "openai/gpt-5.2";
export const RECIPE_CALORIE_PROMPT_VERSION = "recipe-calorie-v1";

export type IngredientCalorieEstimate = {
  name: string;
  amount?: string;
  caloriesKcal: number;
  note?: string;
};

export type RecipeNutritionEstimate = {
  servings: number;
  caloriesTotalKcal: number;
  caloriesPerServingKcal: number | null;
  ingredientEstimates: IngredientCalorieEstimate[];
  confidence: number;
  needsReview: boolean;
  summary: string;
  model: string;
  promptVersion: string;
  sourceHash: string;
  rawEstimateJson: unknown;
};

export type RecipeNutritionListEstimate = Omit<RecipeNutritionEstimate, "ingredientEstimates" | "rawEstimateJson">;

export type RecipeNutritionInput = {
  title: string;
  slug?: string;
  contentHtml: string;
  tagNames: string[];
  model?: string;
};

type RpcNutritionRow = {
  servings: number;
  calories_total_kcal: number;
  calories_per_serving_kcal: number | null;
  confidence: number | string;
  needs_review: boolean;
  summary: string | null;
  ingredient_estimates_json?: unknown;
  model?: string;
  prompt_version?: string;
  source_hash?: string;
  raw_estimate_json?: unknown;
};

export function normalizeIngredientEstimates(value: unknown): IngredientCalorieEstimate[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const estimates: IngredientCalorieEstimate[] = [];
  for (const item of value) {
      const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const calories = numberFromUnknown(record.caloriesKcal ?? record.calories_kcal ?? record.calories ?? record.kcal);
      const name = String(record.name ?? "").trim();
      if (!name || !Number.isFinite(calories) || calories <= 0) {
        continue;
      }
      estimates.push({
        name,
        amount: record.amount === undefined && record.quantity === undefined ? undefined : String(record.amount ?? record.quantity),
        caloriesKcal: Math.round(calories),
        note: record.note === undefined && record.notes === undefined ? undefined : String(record.note ?? record.notes)
      });
  }
  return estimates;
}

export function nutritionFromRpcRow(row: RpcNutritionRow | null | undefined, includeIngredients: true): RecipeNutritionEstimate | null;
export function nutritionFromRpcRow(
  row: RpcNutritionRow | null | undefined,
  includeIngredients?: false
): RecipeNutritionListEstimate | null;
export function nutritionFromRpcRow(
  row: RpcNutritionRow | null | undefined,
  includeIngredients = false
): RecipeNutritionEstimate | RecipeNutritionListEstimate | null {
  if (!row) {
    return null;
  }
  const base = {
    servings: row.servings,
    caloriesTotalKcal: row.calories_total_kcal,
    caloriesPerServingKcal: row.calories_per_serving_kcal,
    confidence: Number(row.confidence),
    needsReview: row.needs_review,
    summary: row.summary ?? "",
    model: row.model ?? "",
    promptVersion: row.prompt_version ?? "",
    sourceHash: row.source_hash ?? ""
  };
  if (!includeIngredients) {
    return base;
  }
  return {
    ...base,
    ingredientEstimates: normalizeIngredientEstimates(row.ingredient_estimates_json),
    rawEstimateJson: row.raw_estimate_json ?? {}
  };
}

export function sourceHashForRecipeNutrition(input: RecipeNutritionInput): string {
  return createHash("sha256")
    .update(JSON.stringify({ title: input.title, content: input.contentHtml, tags: input.tagNames }))
    .digest("hex");
}

function numberFromUnknown(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : Number.NaN;
  }
  return Number(value);
}

function confidenceFromUnknown(value: unknown): number {
  const confidence = numberFromUnknown(value);
  if (!Number.isFinite(confidence)) {
    return Number.NaN;
  }
  return confidence > 1 && confidence <= 100 ? confidence / 100 : confidence;
}

function normalizeServings(value: unknown): { value: number; inferred: boolean } {
  const servings = numberFromUnknown(value);
  if (Number.isFinite(servings) && servings > 0) {
    return { value: Math.round(servings), inferred: false };
  }
  return { value: 4, inferred: true };
}

function normalizeConfidence(value: unknown): { value: number; inferred: boolean } {
  const confidence = confidenceFromUnknown(value);
  if (Number.isFinite(confidence) && confidence >= 0 && confidence <= 1) {
    return { value: confidence, inferred: false };
  }
  return { value: 0.5, inferred: true };
}

function invalidNutritionJsonError(record: Record<string, unknown>): Error {
  const keys = Object.keys(record).slice(0, 20).join(",");
  const diagnostics = [
    `servings=${JSON.stringify(record.servings)}`,
    `calories_total_kcal=${JSON.stringify(record.calories_total_kcal ?? record.total_calories)}`,
    `confidence=${JSON.stringify(record.confidence)}`,
    `summary=${JSON.stringify(record.summary ?? record.explanation)}`
  ].join(" ");
  return new Error(`AI calorie estimate returned invalid JSON; keys=${keys || "<none>"} ${diagnostics}`);
}

export function buildRecipeNutritionPrompt(input: RecipeNutritionInput): string {
  const contentText = excerptFromHtml(input.contentHtml, 6000);
  return [
    "你是谨慎的菜谱卡路里估算助手。",
    "只输出 JSON，不要输出 Markdown。",
    "字段：servings, calories_total_kcal, calories_per_serving_kcal, ingredient_estimates, confidence, needs_review, summary。",
    "ingredient_estimates 每项包含 name, amount, calories_kcal, note。",
    "如果份数、克重或油脂用量不明确，给出合理估算并把 needs_review 设为 true。",
    `标题：${input.title}`,
    `Tags：${input.tagNames.join(", ")}`,
    `正文：${contentText}`
  ].join("\n");
}

export function validateRecipeNutritionJson(raw: unknown, meta: { model: string; sourceHash: string }): RecipeNutritionEstimate {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const servings = normalizeServings(record.servings);
  const caloriesTotalKcal = numberFromUnknown(
    record.calories_total_kcal ?? record.caloriesTotalKcal ?? record.total_calories ?? record.totalCalories
  );
  const rawCaloriesPerServingKcal = numberFromUnknown(
    record.calories_per_serving_kcal ??
      record.caloriesPerServingKcal ??
      record.per_serving_calories ??
      record.perServingCalories
  );
  const caloriesPerServingKcal =
    Number.isFinite(rawCaloriesPerServingKcal) && rawCaloriesPerServingKcal > 0
      ? rawCaloriesPerServingKcal
      : caloriesTotalKcal / servings.value;
  const confidence = normalizeConfidence(record.confidence);
  const ingredientEstimates = normalizeIngredientEstimates(
    record.ingredient_estimates ?? record.ingredientEstimates ?? record.ingredients
  );
  const roundedPerServing =
    Number.isFinite(caloriesPerServingKcal) && caloriesPerServingKcal > 0 ? Math.round(caloriesPerServingKcal) : null;
  const summary =
    String(record.summary ?? record.explanation ?? record.notes ?? "").trim() ||
    (Number.isFinite(caloriesTotalKcal) && caloriesTotalKcal > 0 && roundedPerServing
      ? `按模型返回的总热量估算，约 ${servings.value} 份，每份约 ${roundedPerServing} kcal。`
      : "");
  if (
    !Number.isFinite(caloriesTotalKcal) ||
    caloriesTotalKcal <= 0 ||
    !summary
  ) {
    throw invalidNutritionJsonError(record);
  }
  return {
    servings: servings.value,
    caloriesTotalKcal: Math.round(caloriesTotalKcal),
    caloriesPerServingKcal: roundedPerServing,
    ingredientEstimates,
    confidence: confidence.value,
    needsReview:
      Boolean(record.needs_review ?? record.needsReview) ||
      ingredientEstimates.length === 0 ||
      servings.inferred ||
      confidence.inferred ||
      !(Number.isFinite(rawCaloriesPerServingKcal) && rawCaloriesPerServingKcal > 0),
    summary,
    model: meta.model,
    promptVersion: RECIPE_CALORIE_PROMPT_VERSION,
    sourceHash: meta.sourceHash,
    rawEstimateJson: raw
  };
}

async function gatewayErrorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text.trim()) {
    return `AI Gateway calorie estimation failed: ${response.status}`;
  }
  try {
    const payload = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    const message =
      typeof payload.error === "string"
        ? payload.error
        : payload.error?.message ?? payload.message ?? text.slice(0, 500);
    return `AI Gateway calorie estimation failed: ${response.status}: ${message}`;
  } catch {
    return `AI Gateway calorie estimation failed: ${response.status}: ${text.slice(0, 500)}`;
  }
}

export async function estimateRecipeNutritionWithGateway(
  input: RecipeNutritionInput,
  options: { apiKey: string; fetchImpl?: typeof fetch }
): Promise<RecipeNutritionEstimate> {
  if (!options.apiKey.trim()) {
    throw new Error("AI_GATEWAY_API_KEY is required for recipe calorie estimation");
  }
  const model = input.model ?? RECIPE_CALORIE_MODEL;
  const sourceHash = sourceHashForRecipeNutrition(input);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: buildRecipeNutritionPrompt(input)
        }
      ],
      stream: false
    })
  });
  if (!response.ok) {
    throw new Error(await gatewayErrorMessage(response));
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI Gateway calorie estimation returned empty content");
  }
  return validateRecipeNutritionJson(JSON.parse(content) as unknown, { model, sourceHash });
}
