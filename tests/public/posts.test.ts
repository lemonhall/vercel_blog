import { describe, expect, it } from "vitest";
import { sanitizePostHtml } from "@/lib/html";
import {
  getPostBySlug,
  listDraftPosts,
  listPublishedPostsPage,
  listRecipePosts,
  listRecipePostsPage,
  listRecipePostsByTag,
  listRecipeTags,
  searchPosts
} from "@/lib/posts";

describe("sanitizePostHtml", () => {
  it("removes script tags and event handlers while keeping article markup", () => {
    const html = sanitizePostHtml(
      '<h2>Hello</h2><p onclick="bad()">Body</p><img src="https://assets.example/a.jpg" onerror="bad()"><script>bad()</script><pre><code class="language-ts">x</code></pre>'
    );

    expect(html).toContain("<h2>Hello</h2>");
    expect(html).toContain("<p>Body</p>");
    expect(html).toContain('<img src="https://assets.example/a.jpg" />');
    expect(html).toContain('<code class="language-ts">x</code>');
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
  });

  it("keeps upgraded editor output for links tables code images and text alignment", () => {
    const html = sanitizePostHtml(
      '<h2 style="text-align:center">标题</h2><p style="text-align:right;color:red">正文</p><a href="https://example.com" onclick="bad()">链接</a><table><tbody><tr><th colspan="2">头</th></tr><tr><td rowspan="2">格</td><td>值</td></tr></tbody></table><pre><code class="language-js">console.log(1)</code></pre><img src="https://assets.example/a.jpg" alt="图">'
    );

    expect(html).toContain('<h2 style="text-align:center">标题</h2>');
    expect(html).toContain('<p style="text-align:right">正文</p>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("<table>");
    expect(html).toContain('colspan="2"');
    expect(html).toContain('rowspan="2"');
    expect(html).toContain('<code class="language-js">');
    expect(html).toContain('<img src="https://assets.example/a.jpg" alt="图" />');
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("color:red");
  });
});

describe("searchPosts", () => {
  it("uses the Supabase search_posts RPC for database LIKE search", async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const client = {
      rpc(name: string, args: unknown) {
        calls.push({ name, args });
        return {
          order() {
            return Promise.resolve({ data: [], error: null });
          }
        };
      }
    };

    await searchPosts(client, "牛肉");

    expect(calls).toEqual([{ name: "search_posts", args: { q: "牛肉" } }]);
  });

  it("does not query the database for an empty search term", async () => {
    const client = {
      rpc() {
        throw new Error("must not query");
      }
    };

    await expect(searchPosts(client, "   ")).resolves.toEqual([]);
  });
});

describe("listPublishedPostsPage", () => {
  it("uses page and ascending sort options for Supabase pagination", async () => {
    const calls: Array<{ name: string; args: unknown[] }> = [];
    const builder = {
      eq(column: string, value: unknown) {
        calls.push({ name: "eq", args: [column, value] });
        return builder;
      },
      order(column: string, options: unknown) {
        calls.push({ name: "order", args: [column, options] });
        return builder;
      },
      range(from: number, to: number) {
        calls.push({ name: "range", args: [from, to] });
        return Promise.resolve({ data: [], error: null, count: 42 });
      },
      limit() {
        throw new Error("must use range");
      },
      single() {
        throw new Error("must not fetch single");
      },
      maybeSingle() {
        throw new Error("must not fetch single");
      }
    };
    const client = {
      from(table: string) {
        calls.push({ name: "from", args: [table] });
        return {
          select(columns: string, options: unknown) {
            calls.push({ name: "select", args: [columns, options] });
            return builder;
          }
        };
      },
      rpc() {
        throw new Error("must not search");
      }
    };

    const result = await listPublishedPostsPage({ page: 2, pageSize: 10, sort: "asc" }, client);

    expect(result).toMatchObject({ page: 2, pageSize: 10, pageCount: 5, total: 42, sort: "asc" });
    expect(calls).toContainEqual({ name: "select", args: ["*", { count: "exact" }] });
    expect(calls).toContainEqual({ name: "order", args: ["published_at", { ascending: true, nullsFirst: false }] });
    expect(calls).toContainEqual({ name: "range", args: [10, 19] });
  });

  it("normalizes invalid page and sort options", async () => {
    const builder = {
      eq() {
        return builder;
      },
      order(_column: string, options: unknown) {
        expect(options).toEqual({ ascending: false, nullsFirst: false });
        return builder;
      },
      range(from: number, to: number) {
        expect([from, to]).toEqual([0, 9]);
        return Promise.resolve({ data: [], error: null, count: 0 });
      },
      limit() {
        throw new Error("must use range");
      },
      single() {
        throw new Error("must not fetch single");
      },
      maybeSingle() {
        throw new Error("must not fetch single");
      }
    };
    const client = {
      from() {
        return {
          select() {
            return builder;
          }
        };
      },
      rpc() {
        throw new Error("must not search");
      }
    };

    const result = await listPublishedPostsPage({ page: -10, pageSize: 10, sort: "oldest" }, client);

    expect(result).toMatchObject({ page: 1, pageCount: 1, sort: "desc" });
  });
});

describe("listDraftPosts", () => {
  it("loads drafts ordered by latest update for admin management", async () => {
    const calls: Array<{ name: string; args: unknown[] }> = [];
    const builder = {
      eq(column: string, value: unknown) {
        calls.push({ name: "eq", args: [column, value] });
        return builder;
      },
      order(column: string, options: unknown) {
        calls.push({ name: "order", args: [column, options] });
        return builder;
      },
      limit(count: number) {
        calls.push({ name: "limit", args: [count] });
        return Promise.resolve({ data: [], error: null });
      },
      range() {
        throw new Error("must not paginate drafts yet");
      },
      single() {
        throw new Error("must not fetch single");
      },
      maybeSingle() {
        throw new Error("must not fetch single");
      }
    };
    const client = {
      from(table: string) {
        calls.push({ name: "from", args: [table] });
        return {
          select(columns: string) {
            calls.push({ name: "select", args: [columns] });
            return builder;
          }
        };
      },
      rpc() {
        throw new Error("must not search");
      }
    };

    await listDraftPosts(client);

    expect(calls).toContainEqual({ name: "eq", args: ["status", "draft"] });
    expect(calls).toContainEqual({ name: "order", args: ["updated_at", { ascending: false, nullsFirst: false }] });
    expect(calls).toContainEqual({ name: "limit", args: [50] });
  });
});

describe("recipe queries", () => {
  it("uses published recipe filters for recipe lists", async () => {
    const calls: Array<{ name: string; args: unknown[] }> = [];
    const builder = {
      eq(column: string, value: unknown) {
        calls.push({ name: "eq", args: [column, value] });
        return builder;
      },
      order(column: string, options: unknown) {
        calls.push({ name: "order", args: [column, options] });
        return builder;
      },
      limit(count: number) {
        calls.push({ name: "limit", args: [count] });
        return Promise.resolve({ data: [], error: null });
      },
      range() {
        throw new Error("must not paginate recipes yet");
      },
      single() {
        throw new Error("must not fetch single");
      },
      maybeSingle() {
        throw new Error("must not fetch single");
      }
    };
    const client = {
      from(table: string) {
        calls.push({ name: "from", args: [table] });
        return {
          select(columns: string) {
            calls.push({ name: "select", args: [columns] });
            return builder;
          }
        };
      },
      rpc() {
        throw new Error("must not use rpc for base recipe list");
      }
    };

    await listRecipePosts(client);

    expect(calls).toContainEqual({ name: "eq", args: ["status", "published"] });
    expect(calls).toContainEqual({ name: "eq", args: ["content_kind", "recipe"] });
    expect(calls).toContainEqual({ name: "limit", args: [50] });
  });

  it("uses pagination and attaches tags for recipe pages", async () => {
    const calls: Array<{ name: string; args: unknown[] }> = [];
    const post = {
      id: "recipe-1",
      legacy_id: 6,
      title: "鹰嘴豆炖牛肉",
      slug: "beef-and-chickpeas",
      content_html: "<p>body</p>",
      excerpt: null,
      status: "published" as const,
      content_kind: "recipe" as const,
      created_at: "2022-05-23T21:09:02.478Z",
      updated_at: "2022-05-23T21:24:19.540Z",
      published_at: "2022-05-23T21:09:02.478Z"
    };
    const builder = {
      eq(column: string, value: unknown) {
        calls.push({ name: "eq", args: [column, value] });
        return builder;
      },
      order(column: string, options: unknown) {
        calls.push({ name: "order", args: [column, options] });
        return builder;
      },
      limit() {
        throw new Error("must use range for recipe pages");
      },
      range(from: number, to: number) {
        calls.push({ name: "range", args: [from, to] });
        return Promise.resolve({ data: [post], error: null, count: 21 });
      },
      single() {
        throw new Error("must not fetch single");
      },
      maybeSingle() {
        throw new Error("must not fetch single");
      }
    };
    const client = {
      from(table: string) {
        calls.push({ name: "from", args: [table] });
        return {
          select(columns: string, options: unknown) {
            calls.push({ name: "select", args: [columns, options] });
            return builder;
          }
        };
      },
      rpc(name: string, args?: unknown) {
        calls.push({ name: "rpc", args: [name, args] });
        if (name === "list_tags_for_post") {
          return Promise.resolve({
            data: [{ id: "beef", name: "牛肉", slug: "beef" }],
            error: null
          });
        }
        throw new Error("unexpected rpc");
      }
    };

    const result = await listRecipePostsPage({ page: 2, pageSize: 10 }, client);

    expect(result).toMatchObject({ page: 2, pageSize: 10, pageCount: 3, total: 21 });
    expect(result.posts[0].tags).toEqual([{ id: "beef", name: "牛肉", slug: "beef" }]);
    expect(calls).toContainEqual({ name: "select", args: ["*", { count: "exact" }] });
    expect(calls).toContainEqual({ name: "eq", args: ["status", "published"] });
    expect(calls).toContainEqual({ name: "eq", args: ["content_kind", "recipe"] });
    expect(calls).toContainEqual({ name: "range", args: [10, 19] });
    expect(calls).toContainEqual({ name: "rpc", args: ["list_tags_for_post", { target_post_id: "recipe-1" }] });
  });

  it("loads recipe tag cloud and tag-filtered recipes through stable RPC contracts", async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const client = {
      from() {
        throw new Error("must use rpc");
      },
      rpc(name: string, args?: unknown) {
        calls.push({ name, args });
        return Promise.resolve({ data: [], error: null });
      }
    };

    await listRecipeTags(client);
    await listRecipePostsByTag("beef", client);

    expect(calls).toEqual([
      { name: "list_recipe_tags", args: undefined },
      { name: "list_recipe_posts_by_tag", args: { tag_slug: "beef" } }
    ]);
  });
});

describe("getPostBySlug", () => {
  function createPostLookupClient() {
    const calls: Array<{ column: string; value: unknown }> = [];
    const post = {
      id: "post-1",
      legacy_id: 676,
      title: "vscode里的codex插件里跑第三方提供商",
      slug: "676-vscode里的codex插件里跑第三方提供商",
      content_html: "<p>body</p>",
      excerpt: null,
      status: "published" as const,
      content_kind: "post" as const,
      created_at: "2026-06-10T00:00:00.000Z",
      updated_at: "2026-06-10T00:00:00.000Z",
      published_at: "2026-06-10T00:00:00.000Z"
    };
    const builder = {
      eq(column: string, value: unknown) {
        calls.push({ column, value });
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return Promise.resolve({ data: [], error: null });
      },
      range() {
        return Promise.resolve({ data: [], error: null });
      },
      single() {
        return builder.maybeSingle();
      },
      maybeSingle() {
        const slug = calls.find((call) => call.column === "slug")?.value;
        return Promise.resolve({
          data: slug === post.slug ? post : null,
          error: null
        });
      }
    };

    return {
      calls,
      client: {
        from() {
          return {
            select() {
              return builder;
            }
          };
        },
        rpc() {
          throw new Error("must not search");
        }
      }
    };
  }

  it("decodes URL-encoded route slugs before querying Supabase", async () => {
    const { client, calls } = createPostLookupClient();

    const post = await getPostBySlug(
      "676-vscode%E9%87%8C%E7%9A%84codex%E6%8F%92%E4%BB%B6%E9%87%8C%E8%B7%91%E7%AC%AC%E4%B8%89%E6%96%B9%E6%8F%90%E4%BE%9B%E5%95%86",
      client
    );

    expect(post?.slug).toBe("676-vscode里的codex插件里跑第三方提供商");
    expect(calls).toContainEqual({ column: "slug", value: "676-vscode里的codex插件里跑第三方提供商" });
  });

  it("returns null when Supabase reports no single post for a slug", async () => {
    const { client } = createPostLookupClient();

    await expect(getPostBySlug("missing-post", client)).resolves.toBeNull();
  });
});
