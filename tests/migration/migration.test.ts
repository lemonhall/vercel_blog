import { describe, expect, it } from "vitest";
import {
  buildAssetPlan,
  buildPostPlan,
  mapLegacyImageUrl,
  rewritePostHtml,
  summarizePlan
} from "@/lib/migration/planner";
import { exportRecipeCandidatesToJsonl, importRecipeLabelsFromJsonl } from "@/lib/migration/recipe-labels";
import {
  estimateRecipeCaloriesLocallyFromCandidatesJsonl,
  exportRecipeCalorieCandidatesToJsonl,
  importRecipeCalorieEstimatesFromJsonl
} from "@/lib/migration/recipe-calories";
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

describe("recipe calorie estimate import", () => {
  it("exports recipe calorie candidates with tags and readable content", () => {
    const jsonl = exportRecipeCalorieCandidatesToJsonl([
      {
        id: "post-1",
        legacy_id: 7,
        title: "番茄牛肉汤",
        slug: "tomato-beef-soup",
        content_html: "<p>牛肉 500g，番茄 300g，加少量油炖煮。</p>",
        excerpt: null,
        created_at: "2022-05-23T00:00:00.000Z",
        updated_at: "2022-05-23T00:00:00.000Z",
        tags: ["牛肉", "炖菜"]
      }
    ]);

    const candidate = JSON.parse(jsonl) as Record<string, unknown>;

    expect(candidate).toMatchObject({
      post_id: "post-1",
      title: "番茄牛肉汤",
      slug: "tomato-beef-soup",
      tags: ["牛肉", "炖菜"]
    });
    expect(candidate.content_text).toBe("牛肉 500g，番茄 300g，加少量油炖煮。");
  });

  it("locally estimates ingredient calories from candidates without using AI Gateway", () => {
    const candidates = [
      JSON.stringify({
        post_id: "post-1",
        title: "番茄牛肉汤",
        slug: "tomato-beef-soup",
        tags: ["牛肉", "炖菜"],
        content_text: "牛肉 500g，番茄 300g，加少量油炖煮。"
      })
    ].join("\n");

    const estimates = estimateRecipeCaloriesLocallyFromCandidatesJsonl(candidates);
    const estimate = JSON.parse(estimates) as Record<string, unknown>;

    expect(estimate).toMatchObject({
      post_id: "post-1",
      servings: 4,
      calories_total_kcal: expect.any(Number),
      calories_per_serving_kcal: expect.any(Number),
      needs_review: false
    });
    expect(estimate.calories_total_kcal).toBeGreaterThanOrEqual(1300);
    expect(estimate.ingredient_estimates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "牛肉", amount: "500g", calories_kcal: 1250 }),
        expect.objectContaining({ name: "番茄", amount: "300g", calories_kcal: 54 })
      ])
    );
  });

  it("imports local JSONL calorie estimates idempotently through the nutrition RPC", async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const client = {
      from() {
        throw new Error("must use rpc");
      },
      rpc(name: string, args: unknown) {
        calls.push({ name, args });
        return Promise.resolve({ data: null, error: null });
      }
    };
    const jsonl = [
      JSON.stringify({
        post_id: "post-1",
        servings: 4,
        calories_total_kcal: 1800,
        calories_per_serving_kcal: 450,
        ingredient_estimates: [{ name: "牛肉", amount: "500g", calories_kcal: 1250, note: "按 250 kcal/100g 估算" }],
        confidence: 0.72,
        needs_review: false,
        summary: "每份约 450 kcal。"
      }),
      JSON.stringify({
        post_id: "post-2",
        servings: 0,
        calories_total_kcal: -1,
        ingredient_estimates: [],
        confidence: 0.4,
        summary: "非法"
      })
    ].join("\n");

    const result = await importRecipeCalorieEstimatesFromJsonl(jsonl, client);

    expect(result).toEqual({ imported: 1, skipped: 1, needsReview: 0 });
    expect(calls).toEqual([
      {
        name: "save_recipe_nutrition_estimate_for_post",
        args: {
          target_post_id: "post-1",
          servings: 4,
          calories_total_kcal: 1800,
          calories_per_serving_kcal: 450,
          ingredient_estimates_json: [{ name: "牛肉", amount: "500g", calories_kcal: 1250, note: "按 250 kcal/100g 估算" }],
          confidence: 0.72,
          needs_review: false,
          summary: "每份约 450 kcal。",
          model: "local-agent",
          prompt_version: "recipe-calorie-local-v1",
          source_hash: expect.any(String),
          raw_estimate_json: expect.any(Object)
        }
      }
    ]);
  });
});
