import { describe, expect, it, vi } from "vitest";

const cacheRegistrations = vi.hoisted(() => [] as Array<{ keyParts: string[]; options: unknown }>);

vi.mock("next/cache", () => ({
  unstable_cache<T extends (...args: never[]) => unknown>(
    loader: T,
    keyParts: string[],
    options: unknown
  ): T {
    cacheRegistrations.push({ keyParts, options });
    return loader;
  },
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn()
}));

import {
  getPostWithNutritionBySlugCached,
  listPublishedPostsPageCached,
  listRecipePostsPageCached,
  listRecipeTagsCached
} from "@/lib/public-posts";
import {
  invalidatePostCaches,
  runWithPostCacheInvalidation,
  type CacheInvalidationAdapter
} from "@/lib/cache-invalidation";

describe("public read caches", () => {
  it("registers stable caches for home, recipe pages, recipe tags, and post details", () => {
    expect([
      listPublishedPostsPageCached,
      listRecipePostsPageCached,
      listRecipeTagsCached,
      getPostWithNutritionBySlugCached
    ]).toHaveLength(4);
    expect(cacheRegistrations).toEqual([
      { keyParts: ["public-posts-page-v1"], options: { revalidate: 3600, tags: ["posts"] } },
      { keyParts: ["public-recipe-posts-page-v1"], options: { revalidate: 3600, tags: ["posts", "recipes"] } },
      { keyParts: ["public-recipe-tags-v1"], options: { revalidate: 3600, tags: ["posts", "recipes"] } },
      { keyParts: ["public-post-detail-v1"], options: { revalidate: 3600, tags: ["posts", "recipes"] } }
    ]);
  });
});

describe("post cache invalidation", () => {
  function recordingAdapter(calls: string[]): CacheInvalidationAdapter {
    return {
      tag: (value) => calls.push(`tag:${value}`),
      path: (value) => calls.push(`path:${value}`)
    };
  }

  it("invalidates shared tags and affected paths in a stable order", () => {
    const calls: string[] = [];

    invalidatePostCaches("beef-and-chickpeas", recordingAdapter(calls));

    expect(calls).toEqual([
      "tag:posts",
      "tag:recipes",
      "path:/",
      "path:/recipes",
      "path:/posts/beef-and-chickpeas"
    ]);
  });

  it("invalidates only after a successful write and never after a failed write", async () => {
    const successCalls: string[] = [];
    await expect(
      runWithPostCacheInvalidation(
        "saved-post",
        async () => {
          successCalls.push("write");
          return "saved";
        },
        recordingAdapter(successCalls)
      )
    ).resolves.toBe("saved");
    expect(successCalls[0]).toBe("write");
    expect(successCalls.slice(1)).toContain("tag:posts");

    const failureCalls: string[] = [];
    await expect(
      runWithPostCacheInvalidation(
        "failed-post",
        async () => {
          failureCalls.push("write");
          throw new Error("database unavailable");
        },
        recordingAdapter(failureCalls)
      )
    ).rejects.toThrow("database unavailable");
    expect(failureCalls).toEqual(["write"]);
  });
});
