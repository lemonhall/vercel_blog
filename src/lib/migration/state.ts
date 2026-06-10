import type { AssetPlan, MigrationState, PostPlan } from "@/lib/migration/types";

function now(): string {
  return new Date().toISOString();
}

export function createInitialState(input: {
  fingerprint: string;
  assets: AssetPlan[];
  posts: PostPlan[];
}): MigrationState {
  const state: MigrationState = {
    version: 1,
    sourceFingerprint: input.fingerprint,
    assets: {},
    posts: {},
    postAssets: {}
  };

  for (const asset of input.assets) {
    state.assets[asset.legacyPath] = {
      status: "pending",
      sha256: asset.sha256,
      size: asset.size,
      contentType: asset.contentType,
      blobPathname: asset.blobPathname,
      attempts: 0,
      updatedAt: now()
    };
  }

  for (const post of input.posts) {
    state.posts[String(post.legacyId)] = {
      status: "pending",
      slug: post.slug,
      rewrittenImageCount: post.rewrittenImageCount,
      missingImageCount: post.missingImageRefs.length,
      attempts: 0,
      updatedAt: now()
    };

    for (const legacyPath of post.imageLegacyPaths) {
      state.postAssets[`${post.legacyId}|${legacyPath}`] = {
        status: "pending",
        attempts: 0,
        updatedAt: now()
      };
    }
  }

  return state;
}

export function mergeState(existing: MigrationState | null, next: MigrationState): MigrationState {
  if (!existing) {
    return next;
  }
  if (existing.sourceFingerprint !== next.sourceFingerprint) {
    throw new Error("Migration source fingerprint changed. Use a fresh state file or --force.");
  }
  return {
    ...next,
    assets: { ...next.assets, ...existing.assets },
    posts: { ...next.posts, ...existing.posts },
    postAssets: { ...next.postAssets, ...existing.postAssets }
  };
}

export function pendingAssets(state: MigrationState, assets: AssetPlan[], maxAttempts = 3): AssetPlan[] {
  return assets.filter((asset) => {
    const entry = state.assets[asset.legacyPath];
    return !entry || (entry.status !== "uploaded" && entry.attempts < maxAttempts);
  });
}

export function markAssetUploaded(state: MigrationState, asset: AssetPlan, blobUrl: string): void {
  state.assets[asset.legacyPath] = {
    status: "uploaded",
    sha256: asset.sha256,
    size: asset.size,
    contentType: asset.contentType,
    blobPathname: asset.blobPathname,
    blobUrl,
    attempts: (state.assets[asset.legacyPath]?.attempts ?? 0) + 1,
    updatedAt: now()
  };
}

export function markAssetFailed(state: MigrationState, asset: AssetPlan, error: unknown): void {
  const existing = state.assets[asset.legacyPath];
  state.assets[asset.legacyPath] = {
    status: "failed",
    sha256: asset.sha256,
    size: asset.size,
    contentType: asset.contentType,
    blobPathname: asset.blobPathname,
    attempts: (existing?.attempts ?? 0) + 1,
    error: error instanceof Error ? error.message : String(error),
    updatedAt: now()
  };
}
