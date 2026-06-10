import { describe, expect, it } from "vitest";
import { sanitizePostHtml } from "@/lib/html";
import { searchPosts } from "@/lib/posts";

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

