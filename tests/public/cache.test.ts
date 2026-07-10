import { describe, expect, it, vi } from "vitest";

const cacheState = vi.hoisted(() => ({
  registrations: [] as Array<{ keyParts: string[]; options: unknown }>,
  values: new Map<string, unknown>(),
  revision: "1",
  getPublicContentVersion: vi.fn(),
  listPublishedPostsPage: vi.fn(),
  listRecipeTags: vi.fn(),
  searchRecipePostsByTagsPage: vi.fn(),
  getPostWithNutritionBySlug: vi.fn()
}));

vi.mock("next/cache", () => ({
  unstable_cache(
    loader: (...args: unknown[]) => Promise<unknown>,
    keyParts: string[],
    options: unknown
  ) {
    cacheState.registrations.push({ keyParts, options });
    return async (...args: unknown[]) => {
      const key = JSON.stringify([keyParts, args]);
      if (cacheState.values.has(key)) {
        return cacheState.values.get(key);
      }
      const result = await loader(...args);
      cacheState.values.set(key, result);
      return result;
    };
  },
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn()
}));

vi.mock("@/lib/posts", () => ({
  getPublicContentVersion: () => cacheState.getPublicContentVersion(),
  listPublishedPostsPage: (...args: unknown[]) => cacheState.listPublishedPostsPage(...args),
  listRecipeTags: (...args: unknown[]) => cacheState.listRecipeTags(...args),
  searchRecipePostsByTagsPage: (...args: unknown[]) => cacheState.searchRecipePostsByTagsPage(...args),
  getPostWithNutritionBySlug: (...args: unknown[]) => cacheState.getPostWithNutritionBySlug(...args)
}));

import {
  getPostWithNutritionBySlugCached,
  listPublishedPostsPageCached,
  listRecipePageDataCached
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
      listRecipePageDataCached,
      getPostWithNutritionBySlugCached
    ]).toHaveLength(3);
    expect(cacheState.registrations).toEqual([
      { keyParts: ["public-posts-page-v2"], options: { revalidate: 3600, tags: ["posts"] } },
      { keyParts: ["public-recipe-posts-page-v2"], options: { revalidate: 3600, tags: ["posts", "recipes"] } },
      { keyParts: ["public-recipe-tags-v2"], options: { revalidate: 3600, tags: ["posts", "recipes"] } },
      { keyParts: ["public-post-detail-v2"], options: { revalidate: 3600, tags: ["posts", "recipes"] } }
    ]);
  });

  it("reads one shared version before loading the recipe page and tag cloud caches", async () => {
    cacheState.values.clear();
    cacheState.revision = "7";
    cacheState.getPublicContentVersion.mockReset();
    cacheState.getPublicContentVersion.mockImplementation(() => Promise.resolve(cacheState.revision));
    cacheState.searchRecipePostsByTagsPage.mockReset();
    cacheState.searchRecipePostsByTagsPage.mockResolvedValue({ marker: "page" });
    cacheState.listRecipeTags.mockReset();
    cacheState.listRecipeTags.mockResolvedValue([{ marker: "tags" }]);

    await expect(listRecipePageDataCached("", [], { page: 1, pageSize: 10 })).resolves.toEqual([
      { marker: "page" },
      [{ marker: "tags" }]
    ]);
    expect(cacheState.getPublicContentVersion).toHaveBeenCalledTimes(1);
    expect(cacheState.searchRecipePostsByTagsPage).toHaveBeenCalledTimes(1);
    expect(cacheState.listRecipeTags).toHaveBeenCalledTimes(1);

    await listRecipePageDataCached("", [], { page: 1, pageSize: 10 });
    expect(cacheState.getPublicContentVersion).toHaveBeenCalledTimes(2);
    expect(cacheState.searchRecipePostsByTagsPage).toHaveBeenCalledTimes(1);
    expect(cacheState.listRecipeTags).toHaveBeenCalledTimes(1);
  });

  it("keeps an old in-flight read isolated from the cache key used after a write", async () => {
    cacheState.values.clear();
    cacheState.revision = "1";
    cacheState.getPublicContentVersion.mockReset();
    cacheState.getPublicContentVersion.mockImplementation(() => Promise.resolve(cacheState.revision));
    cacheState.listPublishedPostsPage.mockReset();

    let releaseOldRead: ((value: unknown) => void) | undefined;
    cacheState.listPublishedPostsPage
      .mockImplementationOnce(() => new Promise((resolve) => { releaseOldRead = resolve; }))
      .mockResolvedValueOnce({ marker: "fresh" });

    const oldRead = listPublishedPostsPageCached({ page: 1, pageSize: 10 });
    await vi.waitFor(() => expect(cacheState.listPublishedPostsPage).toHaveBeenCalledTimes(1));

    cacheState.revision = "2";
    await expect(listPublishedPostsPageCached({ page: 1, pageSize: 10 })).resolves.toEqual({ marker: "fresh" });

    releaseOldRead?.({ marker: "old" });
    await expect(oldRead).resolves.toEqual({ marker: "old" });
    await expect(listPublishedPostsPageCached({ page: 1, pageSize: 10 })).resolves.toEqual({ marker: "fresh" });
    expect(cacheState.listPublishedPostsPage).toHaveBeenCalledTimes(2);
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
