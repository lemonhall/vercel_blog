import { describe, expect, it } from "vitest";
import {
  buildAssetPlan,
  buildPostPlan,
  mapLegacyImageUrl,
  rewritePostHtml,
  summarizePlan
} from "@/lib/migration/planner";
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
