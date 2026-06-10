import { parseTagInput } from "@/lib/tags";
import type { Post } from "@/lib/posts";

type RecipeLabel = {
  post_id?: string;
  content_kind?: string;
  tags?: unknown;
  confidence?: unknown;
  reason?: unknown;
};

type RecipeLabelClient = {
  from(table: "posts" | string): {
    update(payload: Record<string, unknown>): {
      eq(column: string, value: unknown): PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
  };
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

type ImportResult = {
  imported: number;
  skipped: number;
};

type RecipeCandidate = Pick<
  Post,
  "id" | "legacy_id" | "title" | "slug" | "content_html" | "excerpt" | "created_at" | "updated_at"
>;

function throwIfError(error: { message: string } | null): void {
  if (error) {
    throw new Error(error.message);
  }
}

function parseJsonl(input: string): RecipeLabel[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RecipeLabel);
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return parseTagInput(value.map((item) => String(item)).join(","));
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

export function exportRecipeCandidatesToJsonl(posts: RecipeCandidate[], maxContentLength = 4000): string {
  return posts
    .map((post) =>
      JSON.stringify({
        post_id: post.id,
        legacy_id: post.legacy_id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        created_at: post.created_at,
        updated_at: post.updated_at,
        content_text: htmlToText(post.content_html).slice(0, maxContentLength)
      })
    )
    .join("\n");
}

export async function importRecipeLabelsFromJsonl(input: string, client: RecipeLabelClient): Promise<ImportResult> {
  let imported = 0;
  let skipped = 0;

  for (const label of parseJsonl(input)) {
    const postId = String(label.post_id ?? "").trim();
    const confidence = typeof label.confidence === "number" ? label.confidence : 0;
    if (!postId || label.content_kind !== "recipe" || confidence < 0.5) {
      skipped += 1;
      continue;
    }

    const updateResult = await client.from("posts").update({ content_kind: "recipe" }).eq("id", postId);
    throwIfError(updateResult.error);

    const tagResult = await client.rpc("save_post_tags_for_post", {
      target_post_id: postId,
      tag_names: normalizeTags(label.tags)
    });
    throwIfError(tagResult.error);
    imported += 1;
  }

  return { imported, skipped };
}
