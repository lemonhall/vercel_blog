import { describe, expect, it } from "vitest";
import {
  buildAssetPlan,
  buildPostPlan,
  mapLegacyImageUrl,
  rewritePostHtml,
  summarizePlan
} from "@/lib/migration/planner";
import { exportRecipeCandidatesToJsonl, importRecipeLabelsFromJsonl } from "@/lib/migration/recipe-labels";
import { createInitialState, markAssetUploaded, pendingAssets } from "@/lib/migration/state";
import type { LegacyNote, LocalImage } from "@/lib/migration/types";

const images: LocalImage[] = [
  {
    legacyPath: "/static/uploads/p1.jpg",
    absolutePath: "fixtures/p1.jpg",
    fileName: "p1.jpg",
    size: 100,
    sha256: "sha-p1",
    contentType: "image/jpeg",
    blobPathname: "legacy/uploads/p1-sha-p1.jpg"
  },
  {
    legacyPath: "/static/uploads/p2.png",
    absolutePath: "fixtures/p2.png",
    fileName: "p2.png",
    size: 200,
    sha256: "sha-p2",
    contentType: "image/png",
    blobPathname: "legacy/uploads/p2-sha-p2.png"
  }
];

const notes: LegacyNote[] = [
  {
    id: 7,
    title: "草菇炒牛肉",
    content: '<p><img src="/static/uploads/p1.jpg"></p>',
    created_on: "2022-05-23 21:05:52.755106",
    changed_on: "2022-05-23 21:05:52.755198"
  },
  {
    id: 8,
    title: "AnytingLLM 配图",
    content: '<p><img src="https://blog.lemonhall.me/static/uploads/p2.png"></p>',
    created_on: "2024-01-01 00:00:00",
    changed_on: "2024-01-02 00:00:00"
  }
];

describe("migration planner", () => {
  it("maps local and blog-hosted upload URLs to local assets", () => {
    const assets = buildAssetPlan(images);

    expect(mapLegacyImageUrl("/static/uploads/p1.jpg", assets)?.legacyPath).toBe("/static/uploads/p1.jpg");
    expect(mapLegacyImageUrl("https://blog.lemonhall.me/static/uploads/p2.png", assets)?.legacyPath).toBe(
      "/static/uploads/p2.png"
    );
    expect(mapLegacyImageUrl("https://img3.doubanio.com/view/note/l/public/p1.jpg", assets)?.legacyPath).toBe(
      "/static/uploads/p1.jpg"
    );
  });

  it("rewrites HTML image URLs through the asset mapping", () => {
    const assets = buildAssetPlan(images).map((asset) => ({
      ...asset,
      blobUrl: `https://blob.example/${asset.blobPathname}`
    }));

    const result = rewritePostHtml(notes[1].content ?? "", assets);

    expect(result.html).toContain('src="https://blob.example/legacy/uploads/p2-sha-p2.png"');
    expect(result.rewritten).toHaveLength(1);
    expect(result.missing).toHaveLength(0);
  });

  it("builds post plan with stable slug and legacy id", () => {
    const assets = buildAssetPlan(images).map((asset) => ({
      ...asset,
      blobUrl: `https://blob.example/${asset.blobPathname}`
    }));

    const posts = buildPostPlan(notes, assets);

    expect(posts[0]).toMatchObject({
      legacyId: 7,
      slug: "7-草菇炒牛肉",
      status: "published",
      imageLegacyPaths: ["/static/uploads/p1.jpg"]
    });
  });

  it("keeps resume state and returns only pending assets", () => {
    const assets = buildAssetPlan(images);
    const state = createInitialState({ fingerprint: "fp", assets, posts: [] });
    markAssetUploaded(state, assets[0], "https://blob.example/p1.jpg");

    const pending = pendingAssets(state, assets);

    expect(pending.map((asset) => asset.legacyPath)).toEqual(["/static/uploads/p2.png"]);
  });

  it("summarizes plan for dry-run reports", () => {
    const assets = buildAssetPlan(images);
    const posts = buildPostPlan(notes, assets);

    expect(summarizePlan({ assets, posts })).toMatchObject({
      assetCount: 2,
      postCount: 2,
      missingImageRefCount: 0,
      rewrittenImageRefCount: 2
    });
  });
});

describe("recipe label import", () => {
  it("exports human-readable JSONL candidates for AI reading without classifying by keywords", () => {
    const jsonl = exportRecipeCandidatesToJsonl([
      {
        id: "post-1",
        legacy_id: 7,
        title: "草菇炒牛肉",
        slug: "7-草菇炒牛肉",
        content_html: "<p>草菇和牛肉切片后快炒。</p>",
        excerpt: "草菇和牛肉切片后快炒。",
        created_at: "2022-05-23T00:00:00.000Z",
        updated_at: "2022-05-23T00:00:00.000Z"
      }
    ]);

    const candidate = JSON.parse(jsonl) as Record<string, unknown>;

    expect(candidate).toMatchObject({
      post_id: "post-1",
      legacy_id: 7,
      title: "草菇炒牛肉",
      slug: "7-草菇炒牛肉"
    });
    expect(candidate.content_text).toBe("草菇和牛肉切片后快炒。");
    expect(candidate).not.toHaveProperty("content_kind");
    expect(candidate).not.toHaveProperty("tags");
  });

  it("imports AI recipe labels idempotently through explicit post update and tag RPC calls", async () => {
    const calls: Array<{ name: string; args: unknown[] }> = [];
    const builder = {
      update(payload: unknown) {
        calls.push({ name: "update", args: [payload] });
        return builder;
      },
      eq(column: string, value: unknown) {
        calls.push({ name: "eq", args: [column, value] });
        return Promise.resolve({ data: null, error: null });
      }
    };
    const client = {
      from(table: string) {
        calls.push({ name: "from", args: [table] });
        return builder;
      },
      rpc(name: string, args: unknown) {
        calls.push({ name: "rpc", args: [name, args] });
        return Promise.resolve({ data: null, error: null });
      }
    };
    const jsonl = [
      JSON.stringify({
        post_id: "post-1",
        content_kind: "recipe",
        tags: ["牛肉", "炖菜", "牛肉"],
        confidence: 0.92,
        reason: "正文包含食材和烹饪步骤"
      }),
      JSON.stringify({
        post_id: "post-2",
        content_kind: "post",
        tags: [],
        confidence: 0.4,
        reason: "只是餐厅记录"
      })
    ].join("\n");

    const result = await importRecipeLabelsFromJsonl(jsonl, client);

    expect(result).toEqual({ imported: 1, skipped: 1 });
    expect(calls).toContainEqual({ name: "update", args: [{ content_kind: "recipe" }] });
    expect(calls).toContainEqual({ name: "eq", args: ["id", "post-1"] });
    expect(calls).toContainEqual({
      name: "rpc",
      args: ["save_post_tags_for_post", { target_post_id: "post-1", tag_names: ["牛肉", "炖菜"] }]
    });
  });
});
