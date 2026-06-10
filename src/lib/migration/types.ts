export type LegacyNote = {
  id: number;
  title: string | null;
  content: string | null;
  created_on: string | null;
  changed_on: string | null;
};

export type LocalImage = {
  legacyPath: string;
  absolutePath: string;
  fileName: string;
  size: number;
  sha256: string;
  contentType: string;
  blobPathname: string;
};

export type AssetPlan = LocalImage & {
  sourceUrl: string | null;
  blobUrl?: string;
};

export type PostPlan = {
  legacyId: number;
  title: string;
  slug: string;
  contentHtml: string;
  excerpt: string | null;
  status: "published";
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  imageLegacyPaths: string[];
  missingImageRefs: string[];
  rewrittenImageCount: number;
};

export type SourceFingerprint = {
  dbSize: number;
  dbMtimeMs: number;
  imageCount: number;
  imageBytes: number;
};

export type MigrationState = {
  version: 1;
  sourceFingerprint: string;
  assets: Record<
    string,
    {
      status: "pending" | "uploaded" | "failed" | "skipped";
      sha256: string;
      size: number;
      contentType: string;
      blobPathname: string;
      blobUrl?: string;
      attempts: number;
      error?: string;
      updatedAt: string;
    }
  >;
  posts: Record<
    string,
    {
      status: "pending" | "imported" | "failed" | "skipped";
      slug: string;
      rewrittenImageCount: number;
      missingImageCount: number;
      attempts: number;
      error?: string;
      updatedAt: string;
    }
  >;
  postAssets: Record<
    string,
    {
      status: "pending" | "linked" | "failed" | "skipped";
      attempts: number;
      error?: string;
      updatedAt: string;
    }
  >;
};

export type MigrationSummary = {
  assetCount: number;
  postCount: number;
  missingImageRefCount: number;
  rewrittenImageRefCount: number;
};
