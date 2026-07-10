import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidatePostCaches: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "valid-session" }) })
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    authCookieSecret: "cookie-secret",
    adminPassword: "admin-password",
    aiGatewayApiKey: undefined
  })
}));
vi.mock("@/lib/auth", () => ({ verifyAdminSessionToken: () => true }));
vi.mock("@/lib/fixture-data", () => ({ useFixtureData: () => false }));
vi.mock("@/lib/cache-invalidation", () => ({
  invalidatePostCaches: mocks.invalidatePostCaches
}));
vi.mock("@/lib/supabase", () => ({
  createSupabaseServiceClient: () => {
    const builder = {
      update: () => builder,
      insert: () => Promise.resolve({ data: null, error: null }),
      eq: () => Promise.resolve({ data: null, error: null })
    };
    return {
      from: () => builder,
      rpc: (name: string) =>
        Promise.resolve({
          data: null,
          error: name === "save_post_tags" ? { message: "tag write failed" } : null
        })
    };
  }
}));

import { POST } from "@/../app/api/admin/posts/route";

describe("admin post route cache invalidation", () => {
  beforeEach(() => {
    mocks.invalidatePostCaches.mockClear();
  });

  it("invalidates public caches when tags fail after the post row is persisted", async () => {
    const form = new FormData();
    form.set("id", "post-1");
    form.set("title", "Recipe");
    form.set("slug", "recipe");
    form.set("content_html", "<p>body</p>");
    form.set("status", "published");
    form.set("content_kind", "recipe");
    form.set("tags", "beef");

    const response = await POST(new Request("https://lemonhall.me/api/admin/posts", { method: "POST", body: form }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "tag write failed" });
    expect(mocks.invalidatePostCaches).toHaveBeenCalledWith("recipe");
  });
});
