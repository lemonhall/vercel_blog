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

export type PostSort = "asc" | "desc";

export type PostPageOptions = {
  page?: number;
  pageSize?: number;
  sort?: string;
};

export type PostPageResult = {
  posts: Post[];
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  sort: PostSort;
};

type QueryError = { message: string; code?: string };

type QueryResult<T> = PromiseLike<{ data: T | null; error: QueryError | null; count?: number | null }>;

type SupabaseOrderBuilder<T> = {
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): QueryResult<T>;
};

type SupabasePostSelectBuilder = {
  eq(column: string, value: unknown): SupabasePostSelectBuilder;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): SupabasePostSelectBuilder;
  limit(count: number): QueryResult<Post[]>;
  range(from: number, to: number): QueryResult<Post[]>;
  single(): QueryResult<Post>;
  maybeSingle(): QueryResult<Post>;
};

type SupabaseLike = {
  from(table: "posts"): {
    select(columns: string, options?: { count?: "exact" }): SupabasePostSelectBuilder;
  };
  rpc(name: "search_posts", args: { q: string }): SupabaseOrderBuilder<Post[]>;
};

function throwIfError(error: QueryError | null): void {
  if (error) {
    throw new Error(error.message);
  }
}

function normalizeRouteSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || !value || value < 1) {
    return fallback;
  }
  return Math.floor(value);
}

function normalizeSort(value: string | undefined): PostSort {
  return value === "asc" ? "asc" : "desc";
}

function sortPosts(posts: Post[], sort: PostSort): Post[] {
  const direction = sort === "asc" ? 1 : -1;
  return [...posts].sort((left, right) => {
    const leftDate = left.published_at ?? left.created_at;
    const rightDate = right.published_at ?? right.created_at;
    return leftDate.localeCompare(rightDate) * direction;
  });
}

function resolveClient(client?: SupabaseLike): SupabaseLike {
  return client ?? (createSupabaseServiceClient() as unknown as SupabaseLike);
}

export async function listPublishedPosts(client?: SupabaseLike): Promise<Post[]> {
  if (!client && useFixtureData()) {
    return sortPosts(fixturePosts, "desc").slice(0, 50);
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

export async function listPublishedPostsPage(
  options: PostPageOptions = {},
  client?: SupabaseLike
): Promise<PostPageResult> {
  const page = normalizePositiveInteger(options.page, 1);
  const pageSize = normalizePositiveInteger(options.pageSize, 10);
  const sort = normalizeSort(options.sort);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (!client && useFixtureData()) {
    const published = sortPosts(
      fixturePosts.filter((post) => post.status === "published"),
      sort
    );
    const pagePosts = published.slice(from, to + 1);
    return {
      posts: pagePosts,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(published.length / pageSize)),
      total: published.length,
      sort
    };
  }

  const supabase = resolveClient(client);
  const { data, error, count } = await supabase
    .from("posts")
    .select("*", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: sort === "asc", nullsFirst: false })
    .range(from, to);

  throwIfError(error);
  const total = count ?? data?.length ?? 0;
  return {
    posts: data ?? [],
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
    sort
  };
}

export async function getPostBySlug(slug: string, client?: SupabaseLike): Promise<Post | null> {
  const normalizedSlug = normalizeRouteSlug(slug);

  if (!client && useFixtureData()) {
    return fixturePosts.find((post) => post.slug === normalizedSlug) ?? null;
  }

  const supabase = resolveClient(client);
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", normalizedSlug)
    .eq("status", "published")
    .maybeSingle();

  throwIfError(error);
  return (data as Post | null) ?? null;
}

export async function getPostForAdminBySlug(slug: string, client?: SupabaseLike): Promise<Post | null> {
  const normalizedSlug = normalizeRouteSlug(slug);
  if (!client && useFixtureData()) {
    return fixturePosts.find((post) => post.slug === normalizedSlug) ?? null;
  }

  const supabase = resolveClient(client);
  const { data, error } = await supabase.from("posts").select("*").eq("slug", normalizedSlug).maybeSingle();

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
