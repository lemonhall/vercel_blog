import { createSupabaseServiceClient } from "@/lib/supabase";
import { fixturePostTags, fixturePosts, useFixtureData } from "@/lib/fixture-data";
import { tagSlugFromName } from "@/lib/tags";

export type PostStatus = "draft" | "published";
export type ContentKind = "post" | "recipe";

export type Post = {
  id: string;
  legacy_id: number | null;
  title: string;
  slug: string;
  content_html: string;
  excerpt: string | null;
  status: PostStatus;
  content_kind: ContentKind;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type Tag = {
  id: string;
  name: string;
  slug: string;
};

export type RecipeTag = Tag & {
  post_count: number;
};

export type PostWithTags = Post & {
  tags: Tag[];
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

export type RecipePostPageResult = Omit<PostPageResult, "posts"> & {
  posts: PostWithTags[];
};

type QueryError = { message: string; code?: string };

type QueryResult<T> = PromiseLike<{ data: T | null; error: QueryError | null; count?: number | null }>;

type SupabaseOrderBuilder<T> = {
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): QueryResult<T>;
};

type SupabasePostSelectBuilder = {
  eq(column: string, value: unknown): SupabasePostSelectBuilder;
  or?(filter: string): SupabasePostSelectBuilder;
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
  rpc(name: string, args?: unknown): unknown;
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

function normalizeTagSlugs(values: string[]): string[] {
  const seen = new Set<string>();
  const slugs: string[] = [];
  for (const value of values) {
    const slug = normalizeRouteSlug(value).trim();
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      slugs.push(slug);
    }
  }
  return slugs;
}

function sortPosts(posts: Post[], sort: PostSort): Post[] {
  const direction = sort === "asc" ? 1 : -1;
  return [...posts].sort((left, right) => {
    const leftDate = left.published_at ?? left.created_at;
    const rightDate = right.published_at ?? right.created_at;
    return leftDate.localeCompare(rightDate) * direction;
  });
}

function recipePosts(): Post[] {
  return sortPosts(
    fixturePosts.filter((post) => post.status === "published" && post.content_kind === "recipe"),
    "desc"
  );
}

async function attachTagsToPosts(posts: Post[], client?: SupabaseLike): Promise<PostWithTags[]> {
  if (!client && useFixtureData()) {
    return posts.map((post) => ({
      ...post,
      tags: fixturePostTags
        .filter((link) => link.postId === post.id)
        .map((link) => ({ id: tagSlugFromName(link.name), name: link.name, slug: tagSlugFromName(link.name) }))
    }));
  }

  const entries = await Promise.all(
    posts.map(async (post) => ({
      ...post,
      tags: await listTagsForPost(post.id, client)
    }))
  );
  return entries;
}

function resolveClient(client?: SupabaseLike): SupabaseLike {
  return client ?? (createSupabaseServiceClient() as unknown as SupabaseLike);
}

export async function listPublishedPosts(client?: SupabaseLike): Promise<Post[]> {
  if (!client && useFixtureData()) {
    return sortPosts(
      fixturePosts.filter((post) => post.status === "published"),
      "desc"
    ).slice(0, 50);
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

export async function listDraftPosts(client?: SupabaseLike): Promise<Post[]> {
  if (!client && useFixtureData()) {
    return fixturePosts
      .filter((post) => post.status === "draft")
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
      .slice(0, 50);
  }

  const supabase = resolveClient(client);
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("status", "draft")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(50);

  throwIfError(error);
  return data ?? [];
}

export async function listRecipePosts(client?: SupabaseLike): Promise<Post[]> {
  if (!client && useFixtureData()) {
    return recipePosts().slice(0, 50);
  }

  const supabase = resolveClient(client);
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("status", "published")
    .eq("content_kind", "recipe")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(50);

  throwIfError(error);
  return data ?? [];
}

export async function listRecipePostsPage(
  options: PostPageOptions = {},
  client?: SupabaseLike
): Promise<RecipePostPageResult> {
  const page = normalizePositiveInteger(options.page, 1);
  const pageSize = normalizePositiveInteger(options.pageSize, 10);
  const sort = normalizeSort(options.sort);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (!client && useFixtureData()) {
    const recipes = sortPosts(
      fixturePosts.filter((post) => post.status === "published" && post.content_kind === "recipe"),
      sort
    );
    const pagePosts = recipes.slice(from, to + 1);
    return {
      posts: await attachTagsToPosts(pagePosts),
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(recipes.length / pageSize)),
      total: recipes.length,
      sort
    };
  }

  const supabase = resolveClient(client);
  const { data, error, count } = await supabase
    .from("posts")
    .select("*", { count: "exact" })
    .eq("status", "published")
    .eq("content_kind", "recipe")
    .order("published_at", { ascending: sort === "asc", nullsFirst: false })
    .range(from, to);

  throwIfError(error);
  const posts = data ?? [];
  const total = count ?? posts.length;
  return {
    posts: await attachTagsToPosts(posts, client),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
    sort
  };
}

export async function listRecipeTags(client?: SupabaseLike): Promise<RecipeTag[]> {
  if (!client && useFixtureData()) {
    const counts = new Map<string, RecipeTag>();
    const recipeIds = new Set(recipePosts().map((post) => post.id));
    for (const link of fixturePostTags) {
      if (!recipeIds.has(link.postId)) {
        continue;
      }
      const slug = tagSlugFromName(link.name);
      const current = counts.get(slug) ?? { id: slug, name: link.name, slug, post_count: 0 };
      current.post_count += 1;
      counts.set(slug, current);
    }
    return [...counts.values()].sort((left, right) => right.post_count - left.post_count || left.name.localeCompare(right.name));
  }

  const supabase = resolveClient(client);
  const result = (await supabase.rpc("list_recipe_tags")) as { data: RecipeTag[] | null; error: QueryError | null };
  const { data, error } = await result;
  throwIfError(error);
  return (data as RecipeTag[] | null) ?? [];
}

export async function listRecipePostsByTag(tagSlug: string, client?: SupabaseLike): Promise<Post[]> {
  const slug = normalizeRouteSlug(tagSlug);
  if (!client && useFixtureData()) {
    const taggedPostIds = new Set(
      fixturePostTags.filter((link) => tagSlugFromName(link.name) === slug).map((link) => link.postId)
    );
    return recipePosts().filter((post) => taggedPostIds.has(post.id));
  }

  const supabase = resolveClient(client);
  const result = (await supabase.rpc("list_recipe_posts_by_tag", { tag_slug: slug })) as {
    data: Post[] | null;
    error: QueryError | null;
  };
  const { data, error } = await result;
  throwIfError(error);
  return (data as Post[] | null) ?? [];
}

export async function listRecipePostsByTags(tagSlugs: string[], client?: SupabaseLike): Promise<Post[]> {
  const slugs = normalizeTagSlugs(tagSlugs);
  if (slugs.length === 0) {
    return listRecipePosts(client);
  }

  if (!client && useFixtureData()) {
    return recipePosts().filter((post) => {
      const postSlugs = new Set(
        fixturePostTags.filter((link) => link.postId === post.id).map((link) => tagSlugFromName(link.name))
      );
      return slugs.every((slug) => postSlugs.has(slug));
    });
  }

  const supabase = resolveClient(client);
  const result = (await supabase.rpc("list_recipe_posts_by_tags", { tag_slugs: slugs })) as {
    data: Post[] | null;
    error: QueryError | null;
  };
  const { data, error } = await result;
  throwIfError(error);
  return (data as Post[] | null) ?? [];
}

export async function listRecipePostsByTagPage(
  tagSlug: string,
  options: PostPageOptions = {},
  client?: SupabaseLike
): Promise<RecipePostPageResult> {
  const page = normalizePositiveInteger(options.page, 1);
  const pageSize = normalizePositiveInteger(options.pageSize, 10);
  const sort = normalizeSort(options.sort);
  const from = (page - 1) * pageSize;
  const taggedPosts = sortPosts(await listRecipePostsByTag(tagSlug, client), sort);
  const pagePosts = taggedPosts.slice(from, from + pageSize);

  return {
    posts: await attachTagsToPosts(pagePosts, client),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(taggedPosts.length / pageSize)),
    total: taggedPosts.length,
    sort
  };
}

export async function listRecipePostsByTagsPage(
  tagSlugs: string[],
  options: PostPageOptions = {},
  client?: SupabaseLike
): Promise<RecipePostPageResult> {
  const page = normalizePositiveInteger(options.page, 1);
  const pageSize = normalizePositiveInteger(options.pageSize, 10);
  const sort = normalizeSort(options.sort);
  const from = (page - 1) * pageSize;
  const taggedPosts = sortPosts(await listRecipePostsByTags(tagSlugs, client), sort);
  const pagePosts = taggedPosts.slice(from, from + pageSize);

  return {
    posts: await attachTagsToPosts(pagePosts, client),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(taggedPosts.length / pageSize)),
    total: taggedPosts.length,
    sort
  };
}

export async function searchRecipePostsPage(
  query: string,
  options: PostPageOptions = {},
  client?: SupabaseLike
): Promise<RecipePostPageResult> {
  const q = query.trim();
  if (!q) {
    return listRecipePostsPage(options, client);
  }

  const page = normalizePositiveInteger(options.page, 1);
  const pageSize = normalizePositiveInteger(options.pageSize, 10);
  const sort = normalizeSort(options.sort);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (!client && useFixtureData()) {
    const recipes = sortPosts(
      fixturePosts.filter(
        (post) =>
          post.status === "published" &&
          post.content_kind === "recipe" &&
          (post.title.includes(q) || post.content_html.includes(q) || (post.excerpt?.includes(q) ?? false))
      ),
      sort
    );
    const pagePosts = recipes.slice(from, to + 1);
    return {
      posts: await attachTagsToPosts(pagePosts),
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(recipes.length / pageSize)),
      total: recipes.length,
      sort
    };
  }

  const supabase = resolveClient(client);
  const builder = supabase
    .from("posts")
    .select("*", { count: "exact" })
    .eq("status", "published")
    .eq("content_kind", "recipe");

  if (!builder.or) {
    throw new Error("recipe search requires a PostgREST OR filter");
  }

  const { data, error, count } = await builder
    .or(`title.ilike.%${q}%,content_html.ilike.%${q}%`)
    .order("published_at", { ascending: sort === "asc", nullsFirst: false })
    .range(from, to);

  throwIfError(error);
  const posts = data ?? [];
  const total = count ?? posts.length;
  return {
    posts: await attachTagsToPosts(posts, client),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
    sort
  };
}

export async function searchRecipePostsByTagsPage(
  query: string,
  tagSlugs: string[],
  options: PostPageOptions = {},
  client?: SupabaseLike
): Promise<RecipePostPageResult> {
  const q = query.trim();
  const slugs = normalizeTagSlugs(tagSlugs);
  if (!q) {
    return listRecipePostsByTagsPage(slugs, options, client);
  }
  if (slugs.length === 0) {
    return searchRecipePostsPage(q, options, client);
  }

  const page = normalizePositiveInteger(options.page, 1);
  const pageSize = normalizePositiveInteger(options.pageSize, 10);
  const sort = normalizeSort(options.sort);
  const from = (page - 1) * pageSize;

  if (!client && useFixtureData()) {
    const matches = sortPosts(
      fixturePosts.filter((post) => {
        if (
          post.status !== "published" ||
          post.content_kind !== "recipe" ||
          !(post.title.includes(q) || post.content_html.includes(q) || (post.excerpt?.includes(q) ?? false))
        ) {
          return false;
        }
        const postSlugs = new Set(
          fixturePostTags.filter((link) => link.postId === post.id).map((link) => tagSlugFromName(link.name))
        );
        return slugs.every((slug) => postSlugs.has(slug));
      }),
      sort
    );
    const pagePosts = matches.slice(from, from + pageSize);
    return {
      posts: await attachTagsToPosts(pagePosts),
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(matches.length / pageSize)),
      total: matches.length,
      sort
    };
  }

  const supabase = resolveClient(client);
  const result = (await supabase.rpc("search_recipe_posts_by_tags", { q, tag_slugs: slugs })) as {
    data: Post[] | null;
    error: QueryError | null;
  };
  const { data, error } = await result;
  throwIfError(error);
  const posts = sortPosts(data ?? [], sort);
  const pagePosts = posts.slice(from, from + pageSize);
  return {
    posts: await attachTagsToPosts(pagePosts, client),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(posts.length / pageSize)),
    total: posts.length,
    sort
  };
}

export async function listTagsForPost(postId: string, client?: SupabaseLike): Promise<Tag[]> {
  if (!client && useFixtureData()) {
    return fixturePostTags
      .filter((link) => link.postId === postId)
      .map((link) => ({ id: tagSlugFromName(link.name), name: link.name, slug: tagSlugFromName(link.name) }));
  }

  const supabase = resolveClient(client);
  const result = (await supabase.rpc("list_tags_for_post", { target_post_id: postId })) as {
    data: Tag[] | null;
    error: QueryError | null;
  };
  const { data, error } = await result;
  throwIfError(error);
  return (data as Tag[] | null) ?? [];
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
    return fixturePosts.find((post) => post.slug === normalizedSlug && post.status === "published") ?? null;
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

  const result = client.rpc("search_posts", { q }) as SupabaseOrderBuilder<Post[]>;
  const { data, error } = await result.order("published_at", { ascending: false, nullsFirst: false });

  throwIfError(error);
  return data ?? [];
}

export async function searchPublishedPosts(query: string): Promise<Post[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }

  if (useFixtureData()) {
    return fixturePosts.filter(
      (post) => post.status === "published" && (post.title.includes(q) || post.content_html.includes(q))
    );
  }

  return searchPosts(createSupabaseServiceClient() as unknown as Pick<SupabaseLike, "rpc">, q);
}
