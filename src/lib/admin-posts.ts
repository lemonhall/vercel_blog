import { excerptFromHtml } from "@/lib/html";
import { RECIPE_CALORIE_MODEL, type RecipeNutritionEstimate, type RecipeNutritionInput } from "@/lib/recipe-nutrition";

export type AdminPostStatus = "draft" | "published";
export type AdminContentKind = "post" | "recipe";

export type AdminPostInput = {
  id?: string;
  title: string;
  slug: string;
  contentHtml: string;
  status: AdminPostStatus;
  contentKind?: AdminContentKind;
  tagNames?: string[];
  estimateCalories?: boolean;
};

type MutationResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;

type AdminPostMutationBuilder = {
  insert(payload: Record<string, unknown>): MutationResult;
  update(payload: Record<string, unknown>): AdminPostMutationBuilder;
  eq(column: string, value: unknown): MutationResult;
};

export type AdminPostClient = {
  from(table: "posts" | string): AdminPostMutationBuilder;
  rpc?(name: string, args: Record<string, unknown>): MutationResult;
};

export type RecipeNutritionEstimator = (
  input: RecipeNutritionInput & { model: string }
) => Promise<RecipeNutritionEstimate>;

export type AdminPostSaveHooks = {
  onPostPersisted?: () => void;
};

function throwIfError(error: { message: string } | null): void {
  if (error) {
    throw new Error(error.message);
  }
}

export function normalizeAdminPostStatus(value: string): AdminPostStatus {
  return value === "published" ? "published" : "draft";
}

export function normalizeAdminContentKind(value: string): AdminContentKind {
  return value === "recipe" ? "recipe" : "post";
}

export async function saveAdminPost(
  input: AdminPostInput,
  client: AdminPostClient,
  hooks: AdminPostSaveHooks = {}
): Promise<string> {
  const now = new Date().toISOString();
  const payload = {
    title: input.title,
    slug: input.slug,
    content_html: input.contentHtml,
    excerpt: excerptFromHtml(input.contentHtml),
    status: input.status,
    content_kind: input.contentKind ?? "post",
    published_at: input.status === "published" ? now : null,
    updated_at: now
  };

  const result = input.id
    ? await client.from("posts").update(payload).eq("id", input.id)
    : await client.from("posts").insert(payload);

  throwIfError(result.error);
  hooks.onPostPersisted?.();
  if (input.tagNames && client.rpc) {
    const tagResult = await client.rpc("save_post_tags", { post_slug: input.slug, tag_names: input.tagNames });
    throwIfError(tagResult.error);
  }
  return input.slug;
}

export async function maybeEstimateAndSaveRecipeNutrition(
  input: AdminPostInput,
  client: AdminPostClient,
  estimator: RecipeNutritionEstimator
): Promise<void> {
  if (input.contentKind !== "recipe" || !input.estimateCalories) {
    return;
  }
  if (!client.rpc) {
    throw new Error("recipe nutrition persistence requires RPC support");
  }

  const estimate = await estimator({
    title: input.title,
    slug: input.slug,
    contentHtml: input.contentHtml,
    tagNames: input.tagNames ?? [],
    model: RECIPE_CALORIE_MODEL
  });
  const result = await client.rpc("save_recipe_nutrition_estimate", {
    post_slug: input.slug,
    servings: estimate.servings,
    calories_total_kcal: estimate.caloriesTotalKcal,
    calories_per_serving_kcal: estimate.caloriesPerServingKcal,
    ingredient_estimates_json: estimate.ingredientEstimates,
    confidence: estimate.confidence,
    needs_review: estimate.needsReview,
    summary: estimate.summary,
    model: estimate.model,
    prompt_version: estimate.promptVersion,
    source_hash: estimate.sourceHash,
    raw_estimate_json: estimate.rawEstimateJson
  });
  throwIfError(result.error);
}

export async function deleteAdminPost(slug: string, client: AdminPostClient): Promise<void> {
  const result = await client.from("posts").update({ status: "draft" }).eq("slug", slug);
  throwIfError(result.error);
}
