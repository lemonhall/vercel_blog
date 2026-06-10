import { createSupabaseServiceClient } from "@/lib/supabase";
import { fixturePosts, useFixtureData } from "@/lib/fixture-data";

export type PostStatus = "draft" | "published";

export type Post = {
  id: string;
  legacy_id: number | null;
  title: string;
  slug: string;
  content_html: string;
  excerpt: string | null;
  status: PostStatus;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

type QueryResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

type SupabaseOrderBuilder<T> = {
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): QueryResult<T>;
};

type SupabaseSelectBuilder<T> = {
  eq(column: string, value: unknown): SupabaseSelectBuilder<T>;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): SupabaseSelectBuilder<T>;
  limit(count: number): QueryResult<T>;
  single(): QueryResult<T>;
};

type SupabaseLike = {
  from(table: "posts"): {
    select(columns: string): SupabaseSelectBuilder<Post[]>;
  };
  rpc(name: "search_posts", args: { q: string }): SupabaseOrderBuilder<Post[]>;
};

function throwIfError(error: { message: string } | null): void {
  if (error) {
    throw new Error(error.message);
  }
}

function resolveClient(client?: SupabaseLike): SupabaseLike {
  return client ?? (createSupabaseServiceClient() as unknown as SupabaseLike);
}

export async function listPublishedPosts(client?: SupabaseLike): Promise<Post[]> {
  if (!client && useFixtureData()) {
    return fixturePosts;
  }

  const supabase = resolveClient(client);
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(50);

  throwIfError(error);
  return data ?? [];
}

export async function getPostBySlug(slug: string, client?: SupabaseLike): Promise<Post | null> {
  if (!client && useFixtureData()) {
    return fixturePosts.find((post) => post.slug === slug) ?? null;
  }

  const supabase = resolveClient(client);
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error?.message.includes("0 rows")) {
    return null;
  }
  throwIfError(error);
  return (data as Post | null) ?? null;
}

export async function searchPosts(client: Pick<SupabaseLike, "rpc">, query: string): Promise<Post[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }

  const { data, error } = await client
    .rpc("search_posts", { q })
    .order("published_at", { ascending: false, nullsFirst: false });

  throwIfError(error);
  return data ?? [];
}

export async function searchPublishedPosts(query: string): Promise<Post[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }

  if (useFixtureData()) {
    return fixturePosts.filter((post) => post.title.includes(q) || post.content_html.includes(q));
  }

  return searchPosts(createSupabaseServiceClient() as unknown as Pick<SupabaseLike, "rpc">, q);
}
