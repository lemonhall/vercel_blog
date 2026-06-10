import { put } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildAssetPlan, buildPostPlan, summarizePlan } from "../../src/lib/migration/planner";
import { createInitialState, markAssetFailed, markAssetUploaded, mergeState, pendingAssets } from "../../src/lib/migration/state";
import type { AssetPlan, LegacyNote, LocalImage, MigrationState, SourceFingerprint } from "../../src/lib/migration/types";

type Phase = "inventory" | "upload-assets" | "import-posts" | "verify";

type CliOptions = {
  source: string;
  statePath: string;
  phase: Phase;
  dryRun: boolean;
  force: boolean;
  maxAttempts: number;
  limit: number | null;
  concurrency: number;
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    source: "refs/lemon_blog_sync_latest",
    statePath: "migration_state/v2-state.json",
    phase: "inventory",
    dryRun: false,
    force: false,
    maxAttempts: 3,
    limit: null,
    concurrency: 4
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--source") options.source = argv[++i];
    else if (arg === "--state") options.statePath = argv[++i];
    else if (arg === "--phase") options.phase = argv[++i] as Phase;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--report-only") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--max-attempts") options.maxAttempts = Number(argv[++i]);
    else if (arg === "--limit") options.limit = Number(argv[++i]);
    else if (arg === "--concurrency") options.concurrency = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.dryRun) options.phase = "inventory";
  return options;
}

function loadDotEnv(pathname = ".env"): void {
  if (!existsSync(pathname)) return;
  const text = readFileSync(pathname, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index);
    const value = line.slice(index + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function jsonHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sha256File(pathname: string): Promise<string> {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(pathname);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function contentTypeFor(pathname: string): string {
  const ext = extname(pathname).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

function safeStem(filename: string): string {
  const ext = extname(filename);
  const stem = filename.slice(0, filename.length - ext.length);
  return (
    stem
      .normalize("NFKC")
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "asset"
  );
}

function blobPathnameFor(filename: string, sha256: string): string {
  const ext = extname(filename).toLowerCase() || ".bin";
  return `legacy/uploads/${safeStem(filename)}-${sha256.slice(0, 12)}${ext}`;
}

function listFilesRecursive(root: string): string[] {
  const output: string[] = [];
  for (const item of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, item.name);
    if (item.isDirectory()) output.push(...listFilesRecursive(full));
    else if (item.isFile()) output.push(full);
  }
  return output;
}

async function scanImages(sourceRoot: string): Promise<LocalImage[]> {
  const uploadsRoot = join(sourceRoot, "app/static/uploads");
  const files = listFilesRecursive(uploadsRoot);
  const images: LocalImage[] = [];
  for (const absolutePath of files) {
    const fileName = absolutePath.slice(uploadsRoot.length + 1).replace(/\\/g, "/");
    const stats = statSync(absolutePath);
    const sha256 = await sha256File(absolutePath);
    images.push({
      legacyPath: `/static/uploads/${fileName}`,
      absolutePath,
      fileName,
      size: stats.size,
      sha256,
      contentType: contentTypeFor(fileName),
      blobPathname: blobPathnameFor(fileName, sha256)
    });
  }
  return images.sort((a, b) => a.legacyPath.localeCompare(b.legacyPath));
}

function exportNotes(sourceRoot: string): LegacyNote[] {
  const dbPath = join(sourceRoot, "app.db");
  const scriptPath = join(ROOT, "scripts/migrate/export_sqlite.py");
  const result = spawnSync("python", [scriptPath, dbPath], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "SQLite export failed");
  }
  return JSON.parse(result.stdout) as LegacyNote[];
}

function sourceFingerprint(sourceRoot: string, images: LocalImage[]): { raw: SourceFingerprint; hash: string } {
  const dbStats = statSync(join(sourceRoot, "app.db"));
  const raw = {
    dbSize: dbStats.size,
    dbMtimeMs: Math.trunc(dbStats.mtimeMs),
    imageCount: images.length,
    imageBytes: images.reduce((sum, image) => sum + image.size, 0)
  };
  return { raw, hash: jsonHash(raw) };
}

function readState(pathname: string): MigrationState | null {
  if (!existsSync(pathname)) return null;
  return JSON.parse(readFileSync(pathname, "utf8")) as MigrationState;
}

function writeJson(pathname: string, value: unknown): void {
  mkdirSync(dirname(pathname), { recursive: true });
  writeFileSync(pathname, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function reportPath(name: string): string {
  return join("migration_state/reports", `${name}.json`);
}

function stateAssetsWithBlobUrls(state: MigrationState, assets: AssetPlan[]): AssetPlan[] {
  return assets.map((asset) => ({
    ...asset,
    blobUrl: state.assets[asset.legacyPath]?.blobUrl
  }));
}

async function uploadAssets(input: {
  state: MigrationState;
  assets: AssetPlan[];
  statePath: string;
  maxAttempts: number;
  limit: number | null;
  concurrency: number;
}): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is required");
  const queue = pendingAssets(input.state, input.assets, input.maxAttempts).slice(0, input.limit ?? undefined);
  const total = queue.length;
  let completed = 0;
  async function uploadOne(asset: AssetPlan): Promise<void> {
    try {
      const blob = await put(asset.blobPathname, createReadStream(asset.absolutePath), {
        access: "public",
        addRandomSuffix: false,
        contentType: asset.contentType,
        multipart: asset.size > 8 * 1024 * 1024,
        token
      });
      markAssetUploaded(input.state, asset, blob.url);
    } catch (error) {
      markAssetFailed(input.state, asset, error);
    }
    completed += 1;
    writeJson(input.statePath, input.state);
    if (completed % 25 === 0 || completed === total) {
      console.error(`upload-assets progress ${completed}/${total}`);
    }
  }

  const workers = Array.from({ length: Math.max(1, input.concurrency) }, async () => {
    while (queue.length > 0) {
      const asset = queue.shift();
      if (asset) await uploadOne(asset);
    }
  });
  await Promise.all(workers);
}

async function upsertAssetRecords(supabase: any, state: MigrationState, assets: AssetPlan[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const asset of assets) {
    const stateEntry = state.assets[asset.legacyPath];
    if (stateEntry?.status !== "uploaded" || !stateEntry.blobUrl) continue;

    const payload = {
      legacy_path: asset.legacyPath,
      source_url: null,
      blob_url: stateEntry.blobUrl,
      blob_pathname: stateEntry.blobPathname,
      sha256: stateEntry.sha256,
      size: stateEntry.size,
      content_type: stateEntry.contentType,
      status: "uploaded",
      migrated_at: new Date().toISOString()
    };
    const existing = await supabase.from("assets").select("id").eq("legacy_path", asset.legacyPath).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data?.id) {
      const updated = await supabase.from("assets").update(payload).eq("id", existing.data.id).select("id").single();
      if (updated.error) throw new Error(updated.error.message);
      ids.set(asset.legacyPath, updated.data.id);
    } else {
      const inserted = await supabase.from("assets").insert(payload).select("id").single();
      if (inserted.error) throw new Error(inserted.error.message);
      ids.set(asset.legacyPath, inserted.data.id);
    }
  }
  return ids;
}

async function importPosts(input: { state: MigrationState; assets: AssetPlan[]; notes: LegacyNote[]; statePath: string }): Promise<void> {
  const url = process.env.SUPABASE_DEV_URL;
  const key = process.env.SUPABASE_DEV_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_DEV_URL and SUPABASE_DEV_SECRET_KEY are required");
  const supabase = createClient<any>(url, key);
  const posts = buildPostPlan(input.notes, stateAssetsWithBlobUrls(input.state, input.assets));
  const assetIds = await upsertAssetRecords(supabase, input.state, input.assets);

  for (const post of posts) {
    const missingUploadedAssets = post.imageLegacyPaths.filter((legacyPath) => !assetIds.has(legacyPath));
    if (missingUploadedAssets.length > 0) {
      throw new Error(`Post ${post.legacyId} still references non-uploaded assets: ${missingUploadedAssets.slice(0, 5).join(", ")}`);
    }

    const payload = {
      legacy_id: post.legacyId,
      title: post.title,
      slug: post.slug,
      content_html: post.contentHtml,
      excerpt: post.excerpt,
      status: post.status,
      created_at: post.createdAt,
      updated_at: post.updatedAt,
      published_at: post.publishedAt
    };
    const upserted = await supabase.from("posts").upsert(payload, { onConflict: "legacy_id" }).select("id").single();
    const entry = input.state.posts[String(post.legacyId)];
    if (upserted.error) {
      entry.status = "failed";
      entry.error = upserted.error.message;
      entry.attempts += 1;
    } else {
      for (const legacyPath of post.imageLegacyPaths) {
        const assetId = assetIds.get(legacyPath);
        if (!assetId) continue;
        const linkKey = `${post.legacyId}|${legacyPath}`;
        const link = await supabase
          .from("post_assets")
          .upsert({ post_id: upserted.data.id, asset_id: assetId }, { onConflict: "post_id,asset_id" });
        const linkEntry = input.state.postAssets[linkKey];
        if (link.error) {
          linkEntry.status = "failed";
          linkEntry.error = link.error.message;
          linkEntry.attempts += 1;
        } else {
          linkEntry.status = "linked";
          linkEntry.error = undefined;
          linkEntry.attempts += 1;
        }
        linkEntry.updatedAt = new Date().toISOString();
      }
      entry.status = "imported";
      entry.error = undefined;
      entry.attempts += 1;
    }
    entry.updatedAt = new Date().toISOString();
    writeJson(input.statePath, input.state);
  }
}

async function main(): Promise<void> {
  loadDotEnv();
  const options = parseArgs(process.argv.slice(2));
  const sourceRoot = resolve(options.source);
  const statePath = resolve(options.statePath);
  const images = await scanImages(sourceRoot);
  const notes = exportNotes(sourceRoot);
  const assets = buildAssetPlan(images);
  const fingerprint = sourceFingerprint(sourceRoot, images);
  const initialPosts = buildPostPlan(notes, assets);
  const initialState = createInitialState({ fingerprint: fingerprint.hash, assets, posts: initialPosts });
  const existingState = options.force ? null : readState(statePath);
  const state = mergeState(existingState, initialState);
  const reportAssets = stateAssetsWithBlobUrls(state, assets);
  const reportPosts = buildPostPlan(notes, reportAssets);
  const summary = summarizePlan({ assets: reportAssets, posts: reportPosts });

  writeJson(statePath, state);
  writeJson(reportPath(options.dryRun ? "dry-run" : options.phase), {
    phase: options.dryRun ? "dry-run" : options.phase,
    source: options.source,
    fingerprint,
    summary,
    pendingAssetCount: pendingAssets(state, assets, options.maxAttempts).length,
    missingImageRefs: reportPosts.flatMap((post) =>
      post.missingImageRefs.map((ref) => ({ legacyId: post.legacyId, title: post.title, ref }))
    ),
    orphanAssets: reportAssets
      .filter((asset) => !reportPosts.some((post) => post.imageLegacyPaths.includes(asset.legacyPath)))
      .map((asset) => asset.legacyPath)
  });

  if (options.dryRun || options.phase === "inventory") {
    console.log(JSON.stringify({ ok: true, dryRun: options.dryRun, summary, pendingAssetCount: pendingAssets(state, assets).length }));
    return;
  }

  if (options.phase === "upload-assets") {
    await uploadAssets({
      state,
      assets,
      statePath,
      maxAttempts: options.maxAttempts,
      limit: options.limit,
      concurrency: options.concurrency
    });
  } else if (options.phase === "import-posts") {
    await importPosts({ state, assets, notes, statePath });
  } else if (options.phase === "verify") {
    console.log(JSON.stringify({ ok: true, summary }));
    return;
  }

  console.log(JSON.stringify({ ok: true, phase: options.phase }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
