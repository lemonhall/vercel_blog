import { excerptFromHtml } from "@/lib/html";

export type AdminPostStatus = "draft" | "published";

export type AdminPostInput = {
  id?: string;
  title: string;
  slug: string;
  contentHtml: string;
  status: AdminPostStatus;
};

type MutationResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;

type AdminPostMutationBuilder = {
  insert(payload: Record<string, unknown>): MutationResult;
  update(payload: Record<string, unknown>): AdminPostMutationBuilder;
  eq(column: string, value: unknown): MutationResult;
};

export type AdminPostClient = {
  from(table: "posts" | string): AdminPostMutationBuilder;
};

function throwIfError(error: { message: string } | null): void {
  if (error) {
    throw new Error(error.message);
  }
}

export function normalizeAdminPostStatus(value: string): AdminPostStatus {
  return value === "published" ? "published" : "draft";
}

export async function saveAdminPost(input: AdminPostInput, client: AdminPostClient): Promise<string> {
  const now = new Date().toISOString();
  const payload = {
    title: input.title,
    slug: input.slug,
    content_html: input.contentHtml,
    excerpt: excerptFromHtml(input.contentHtml),
    status: input.status,
    published_at: input.status === "published" ? now : null,
    updated_at: now
  };

  const result = input.id
    ? await client.from("posts").update(payload).eq("id", input.id)
    : await client.from("posts").insert(payload);

  throwIfError(result.error);
  return input.slug;
}

export async function deleteAdminPost(slug: string, client: AdminPostClient): Promise<void> {
  const result = await client.from("posts").update({ status: "draft" }).eq("slug", slug);
  throwIfError(result.error);
}
