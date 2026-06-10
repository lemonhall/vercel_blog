import { describe, expect, it } from "vitest";
import { sanitizePostHtml } from "@/lib/html";
import { getPostBySlug, searchPosts } from "@/lib/posts";

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
