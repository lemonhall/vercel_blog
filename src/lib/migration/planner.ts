import { excerptFromHtml } from "@/lib/html";
import { slugifyTitle } from "@/lib/migration/slug";
import type { AssetPlan, LegacyNote, LocalImage, MigrationSummary, PostPlan } from "@/lib/migration/types";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

function extensionOf(value: string): string {
  const pathname = value.split("?")[0].split("#")[0];
  const index = pathname.lastIndexOf(".");
  return index >= 0 ? pathname.slice(index).toLowerCase() : "";
}

function basenameOf(value: string): string {
  const pathname = value.split("?")[0].split("#")[0];
  const slash = pathname.lastIndexOf("/");
  return slash >= 0 ? pathname.slice(slash + 1) : pathname;
}

function isImageLikeUrl(value: string): boolean {
  return value.includes("/static/uploads/") || IMAGE_EXTENSIONS.has(extensionOf(value));
}

export function buildAssetPlan(images: LocalImage[]): AssetPlan[] {
  return images.map((image) => ({
    ...image,
    sourceUrl: null
  }));
}

export function mapLegacyImageUrl(value: string, assets: AssetPlan[]): AssetPlan | null {
  const byLegacyPath = new Map(assets.map((asset) => [asset.legacyPath, asset]));
  const byFileName = new Map(assets.map((asset) => [asset.fileName, asset]));

  if (value.startsWith("/static/uploads/")) {
    return byLegacyPath.get(value.split("?")[0].split("#")[0]) ?? null;
  }

  if (value.includes("/static/uploads/")) {
    const filename = basenameOf(value);
    return byFileName.get(filename) ?? null;
  }

  if (value.startsWith("http")) {
    const filename = basenameOf(value);
    return byFileName.get(filename) ?? null;
  }

  return null;
}

export function extractImageRefs(html: string): string[] {
  const refs: string[] = [];
  const attrPattern = /\b(?:src|href)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(attrPattern)) {
    const value = match[1];
    if (value && isImageLikeUrl(value)) {
      refs.push(value);
    }
  }
  return refs;
}

export function rewritePostHtml(html: string, assets: AssetPlan[]): {
  html: string;
  rewritten: string[];
  missing: string[];
} {
  const rewritten: string[] = [];
  const missing: string[] = [];
  const output = html.replace(/\b(src|href)=(["'])([^"']+)\2/gi, (full, attr: string, quote: string, value: string) => {
    if (!isImageLikeUrl(value)) {
      return full;
    }

    const asset = mapLegacyImageUrl(value, assets);
    if (!asset) {
      missing.push(value);
      return full;
    }

    rewritten.push(asset.legacyPath);
    const target = asset.blobUrl ?? `blob://${asset.blobPathname}`;
    return `${attr}=${quote}${target}${quote}`;
  });

  return { html: output, rewritten, missing };
}

function sqliteDateToIso(value: string | null): string {
  if (!value) {
    return new Date(0).toISOString();
  }
  return new Date(`${value.replace(" ", "T")}Z`).toISOString();
}

export function buildPostPlan(notes: LegacyNote[], assets: AssetPlan[]): PostPlan[] {
  return notes.map((note) => {
    const title = (note.title || `Post ${note.id}`).trim();
    const rewritten = rewritePostHtml(note.content ?? "", assets);
    const imageLegacyPaths = Array.from(new Set(rewritten.rewritten));
    const createdAt = sqliteDateToIso(note.created_on);
    const updatedAt = sqliteDateToIso(note.changed_on ?? note.created_on);

    return {
      legacyId: note.id,
      title,
      slug: slugifyTitle(note.id, title),
      contentHtml: rewritten.html,
      excerpt: excerptFromHtml(rewritten.html),
      status: "published",
      createdAt,
      updatedAt,
      publishedAt: createdAt,
      imageLegacyPaths,
      missingImageRefs: rewritten.missing,
      rewrittenImageCount: rewritten.rewritten.length
    };
  });
}

export function summarizePlan(input: { assets: AssetPlan[]; posts: PostPlan[] }): MigrationSummary {
  return {
    assetCount: input.assets.length,
    postCount: input.posts.length,
    missingImageRefCount: input.posts.reduce((sum, post) => sum + post.missingImageRefs.length, 0),
    rewrittenImageRefCount: input.posts.reduce((sum, post) => sum + post.rewrittenImageCount, 0)
  };
}
