import { createHash } from "node:crypto";
import {
  normalizeIngredientEstimates,
  type IngredientCalorieEstimate,
  type RecipeNutritionEstimate
} from "@/lib/recipe-nutrition";
import type { Post } from "@/lib/posts";

type CalorieClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

type ImportResult = {
  imported: number;
  skipped: number;
  needsReview: number;
};

type RecipeCalorieCandidate = Pick<
  Post,
  "id" | "legacy_id" | "title" | "slug" | "content_html" | "excerpt" | "created_at" | "updated_at"
> & {
  tags?: string[];
};

type CalorieLabel = {
  post_id?: unknown;
  servings?: unknown;
  calories_total_kcal?: unknown;
  calories_per_serving_kcal?: unknown;
  ingredient_estimates?: unknown;
  confidence?: unknown;
  needs_review?: unknown;
  summary?: unknown;
};

type ParsedCandidate = {
  post_id?: unknown;
  title?: unknown;
  slug?: unknown;
  tags?: unknown;
  content_text?: unknown;
};

type FoodProfile = {
  name: string;
  aliases: string[];
  kcalPer100g: number;
  defaultGram: number;
};

const FOOD_PROFILES: FoodProfile[] = [
  { name: "牛肉", aliases: ["牛肉", "牛腩", "牛排", "肥牛"], kcalPer100g: 250, defaultGram: 400 },
  { name: "猪肉", aliases: ["猪肉", "五花肉", "排骨", "里脊", "肉末", "猪排"], kcalPer100g: 290, defaultGram: 350 },
  { name: "鸡肉", aliases: ["鸡肉", "鸡腿", "鸡翅", "鸡胸", "整鸡"], kcalPer100g: 190, defaultGram: 400 },
  { name: "羊肉", aliases: ["羊肉", "羊排", "羊腿"], kcalPer100g: 220, defaultGram: 400 },
  { name: "鱼", aliases: ["鱼", "鳕鱼", "三文鱼", "鲈鱼", "带鱼", "黄鱼"], kcalPer100g: 150, defaultGram: 400 },
  { name: "虾", aliases: ["虾", "虾仁", "大虾"], kcalPer100g: 100, defaultGram: 250 },
  { name: "鸡蛋", aliases: ["鸡蛋", "蛋"], kcalPer100g: 144, defaultGram: 120 },
  { name: "豆腐", aliases: ["豆腐", "豆干", "豆皮"], kcalPer100g: 90, defaultGram: 300 },
  { name: "鹰嘴豆", aliases: ["鹰嘴豆"], kcalPer100g: 164, defaultGram: 250 },
  { name: "土豆", aliases: ["土豆", "马铃薯"], kcalPer100g: 77, defaultGram: 300 },
  { name: "番茄", aliases: ["番茄", "西红柿"], kcalPer100g: 18, defaultGram: 300 },
  { name: "洋葱", aliases: ["洋葱"], kcalPer100g: 40, defaultGram: 120 },
  { name: "胡萝卜", aliases: ["胡萝卜"], kcalPer100g: 41, defaultGram: 150 },
  { name: "蘑菇", aliases: ["蘑菇", "草菇", "香菇", "口蘑"], kcalPer100g: 25, defaultGram: 200 },
  { name: "青菜", aliases: ["青菜", "菠菜", "生菜", "白菜", "西兰花"], kcalPer100g: 25, defaultGram: 250 },
  { name: "米饭", aliases: ["米饭", "大米", "米"], kcalPer100g: 130, defaultGram: 300 },
  { name: "面粉", aliases: ["面粉", "低筋粉", "高筋粉", "中筋粉"], kcalPer100g: 364, defaultGram: 250 },
  { name: "面条", aliases: ["面条", "意面", "拉面", "乌冬"], kcalPer100g: 150, defaultGram: 300 },
  { name: "黄油", aliases: ["黄油", "牛油"], kcalPer100g: 717, defaultGram: 30 },
  { name: "奶酪", aliases: ["奶酪", "芝士", "起司"], kcalPer100g: 350, defaultGram: 80 },
  { name: "牛奶", aliases: ["牛奶", "奶"], kcalPer100g: 61, defaultGram: 250 },
  { name: "奶油", aliases: ["奶油", "淡奶油"], kcalPer100g: 340, defaultGram: 100 },
  { name: "糖", aliases: ["糖", "白糖", "砂糖", "红糖"], kcalPer100g: 400, defaultGram: 30 },
  { name: "食用油", aliases: ["食用油", "橄榄油", "植物油", "花生油", "油"], kcalPer100g: 884, defaultGram: 15 }
];

function throwIfError(error: { message: string } | null): void {
  if (error) {
    throw new Error(error.message);
  }
}

function parseJsonl(input: string): CalorieLabel[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CalorieLabel);
}

function parseCandidateJsonl(input: string): ParsedCandidate[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ParsedCandidate);
}

function htmlToText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function roundToNearest(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

function regexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsOtherFoodAlias(value: string, profile: FoodProfile): boolean {
  return FOOD_PROFILES.some(
    (other) => other.name !== profile.name && other.aliases.some((alias) => alias && value.includes(alias))
  );
}

function gramsFromQuantity(value: number, unit: string, profile: FoodProfile): number {
  if (unit === "kg" || unit === "公斤") return value * 1000;
  if (unit === "斤") return value * 500;
  if (unit === "g" || unit === "克") return value;
  if (unit === "升") return value * 1000;
  if (unit === "ml" || unit === "毫升") return value;
  if (unit === "汤匙" || unit === "大勺") return value * 15;
  if (unit === "小勺") return value * 5;
  if (unit === "勺") return value * 10;
  return value * profile.defaultGram;
}

function quantityForProfile(text: string, profile: FoodProfile): { grams: number; amount: string; inferred: boolean } | null {
  const aliasPattern = profile.aliases.map(regexEscape).join("|");
  const unitPattern = "kg|公斤|斤|g|克|ml|毫升|升|个|只|枚|颗|根|片|块|汤匙|大勺|小勺|勺";
  const afterPattern = new RegExp(`(${aliasPattern})([^\\d]{0,12})(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})`, "gi");
  const beforePattern = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})([^，。；、\\n]{0,12})(${aliasPattern})`, "gi");
  const afterMatches = [...text.matchAll(afterPattern)];
  const beforeMatches = [...text.matchAll(beforePattern)];
  const after = afterMatches.find((item) => !containsOtherFoodAlias(item[2], profile));
  const before = beforeMatches.find((item) => !containsOtherFoodAlias(item[3], profile));
  const match = after
    ? { value: Number(after[3]), unit: after[4] }
    : before
      ? { value: Number(before[1]), unit: before[2] }
      : null;
  if (match && Number.isFinite(match.value) && match.value > 0) {
    return {
      grams: gramsFromQuantity(match.value, match.unit, profile),
      amount: `${match.value}${match.unit}`,
      inferred: false
    };
  }
  if (profile.name === "食用油" && /少量油|少许油|一点油/.test(text)) {
    return {
      grams: profile.defaultGram,
      amount: `少量（约${profile.defaultGram}g）`,
      inferred: false
    };
  }
  if (profile.aliases.some((alias) => text.includes(alias))) {
    return {
      grams: profile.defaultGram,
      amount: `约${profile.defaultGram}g`,
      inferred: true
    };
  }
  return null;
}

function servingsFromText(text: string): number {
  const match = /(\d+)\s*(?:人份|人食|人|份)/.exec(text);
  if (!match) {
    return 4;
  }
  const servings = Number(match[1]);
  return Number.isFinite(servings) && servings > 0 ? Math.min(12, Math.round(servings)) : 4;
}

function localEstimateForCandidate(candidate: ParsedCandidate): CalorieLabel | null {
  const postId = String(candidate.post_id ?? "").trim();
  const title = String(candidate.title ?? "").trim();
  const contentText = String(candidate.content_text ?? "").trim();
  if (!postId || !title) {
    return null;
  }
  const text = `${title} ${contentText}`;
  const ingredientEstimates: IngredientCalorieEstimate[] = [];
  let inferredCount = 0;
  for (const profile of FOOD_PROFILES) {
    const quantity = quantityForProfile(text, profile);
    if (!quantity) {
      continue;
    }
    if (quantity.inferred) {
      inferredCount += 1;
    }
    ingredientEstimates.push({
      name: profile.name,
      amount: quantity.amount,
      caloriesKcal: Math.round((quantity.grams * profile.kcalPer100g) / 100),
      note: quantity.inferred
        ? `正文未给出明确克重，按常见用量 ${profile.defaultGram}g 和约 ${profile.kcalPer100g} kcal/100g 估算`
        : `按约 ${profile.kcalPer100g} kcal/100g 估算`
    });
  }
  if (ingredientEstimates.length === 0) {
    ingredientEstimates.push({
      name: "整道菜",
      amount: "约4人份",
      caloriesKcal: 1200,
      note: "正文缺少可解析主料，按普通家常菜总量粗估"
    });
    inferredCount = 1;
  }
  const caloriesTotalKcal = roundToNearest(
    ingredientEstimates.reduce((sum, item) => sum + item.caloriesKcal, 0),
    5
  );
  const servings = servingsFromText(text);
  const caloriesPerServingKcal = roundToNearest(caloriesTotalKcal / servings, 5);
  const needsReview = inferredCount > 0;
  return {
    post_id: postId,
    servings,
    calories_total_kcal: caloriesTotalKcal,
    calories_per_serving_kcal: caloriesPerServingKcal,
    ingredient_estimates: ingredientEstimates.map((item) => ({
      name: item.name,
      amount: item.amount,
      calories_kcal: item.caloriesKcal,
      note: item.note
    })),
    confidence: needsReview ? 0.58 : 0.72,
    needs_review: needsReview,
    summary: `本地按食材热量表估算，总计约 ${caloriesTotalKcal} kcal，${servings} 份时每份约 ${caloriesPerServingKcal} kcal。`
  };
}

export function exportRecipeCalorieCandidatesToJsonl(posts: RecipeCalorieCandidate[], maxContentLength = 6000): string {
  return posts
    .map((post) =>
      JSON.stringify({
        post_id: post.id,
        legacy_id: post.legacy_id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        tags: post.tags ?? [],
        created_at: post.created_at,
        updated_at: post.updated_at,
        content_text: htmlToText(post.content_html).slice(0, maxContentLength)
      })
    )
    .join("\n");
}

export function estimateRecipeCaloriesLocallyFromCandidatesJsonl(input: string): string {
  return parseCandidateJsonl(input)
    .map(localEstimateForCandidate)
    .filter((item): item is CalorieLabel => item !== null)
    .map((item) => JSON.stringify(item))
    .join("\n");
}

function normalizeCalorieLabel(label: CalorieLabel): (RecipeNutritionEstimate & { postId: string }) | null {
  const postId = String(label.post_id ?? "").trim();
  const servings = Number(label.servings);
  const caloriesTotalKcal = Number(label.calories_total_kcal);
  const caloriesPerServingKcal = Number(label.calories_per_serving_kcal);
  const confidence = Number(label.confidence);
  const ingredientEstimates: IngredientCalorieEstimate[] = normalizeIngredientEstimates(label.ingredient_estimates);
  const summary = String(label.summary ?? "").trim();
  if (
    !postId ||
    !Number.isFinite(servings) ||
    servings <= 0 ||
    !Number.isFinite(caloriesTotalKcal) ||
    caloriesTotalKcal <= 0 ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1 ||
    !summary ||
    ingredientEstimates.length === 0
  ) {
    return null;
  }
  return {
    postId,
    servings: Math.round(servings),
    caloriesTotalKcal: Math.round(caloriesTotalKcal),
    caloriesPerServingKcal:
      Number.isFinite(caloriesPerServingKcal) && caloriesPerServingKcal > 0 ? Math.round(caloriesPerServingKcal) : null,
    ingredientEstimates,
    confidence,
    needsReview: Boolean(label.needs_review),
    summary,
    model: "local-agent",
    promptVersion: "recipe-calorie-local-v1",
    sourceHash: sourceHash(label),
    rawEstimateJson: label
  };
}

export async function importRecipeCalorieEstimatesFromJsonl(input: string, client: CalorieClient): Promise<ImportResult> {
  let imported = 0;
  let skipped = 0;
  let needsReview = 0;

  for (const label of parseJsonl(input)) {
    const normalized = normalizeCalorieLabel(label);
    if (!normalized) {
      skipped += 1;
      continue;
    }
    if (normalized.needsReview) {
      needsReview += 1;
    }
    const result = await client.rpc("save_recipe_nutrition_estimate_for_post", {
      target_post_id: normalized.postId,
      servings: normalized.servings,
      calories_total_kcal: normalized.caloriesTotalKcal,
      calories_per_serving_kcal: normalized.caloriesPerServingKcal,
      ingredient_estimates_json: normalized.ingredientEstimates.map((item) => ({
        name: item.name,
        amount: item.amount,
        calories_kcal: item.caloriesKcal,
        note: item.note
      })),
      confidence: normalized.confidence,
      needs_review: normalized.needsReview,
      summary: normalized.summary,
      model: normalized.model,
      prompt_version: normalized.promptVersion,
      source_hash: normalized.sourceHash,
      raw_estimate_json: normalized.rawEstimateJson
    });
    throwIfError(result.error);
    imported += 1;
  }

  return { imported, skipped, needsReview };
}
