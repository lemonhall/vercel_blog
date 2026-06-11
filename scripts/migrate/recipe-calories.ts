import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  estimateRecipeCaloriesLocallyFromCandidatesJsonl,
  exportRecipeCalorieCandidatesToJsonl,
  importRecipeCalorieEstimatesFromJsonl
} from "../../src/lib/migration/recipe-calories";

type Phase = "export" | "estimate-local" | "import" | "backfill-local";

type Options = {
  phase: Phase;
  candidatesPath: string;
  estimatesPath: string;
  limit: number | null;
};

type RecipePostRow = {
  id: string;
  legacy_id: number | null;
  title: string;
  slug: string;
  content_html: string;
  excerpt: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  post_tags?: Array<{ tags?: { name?: string | null } | null }>;
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    phase: "backfill-local",
    candidatesPath: ".tmp/recipe-calorie-candidates.jsonl",
    estimatesPath: ".tmp/recipe-calorie-estimates.jsonl",
    limit: null
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--phase") options.phase = argv[++i] as Phase;
    else if (arg === "--candidates") options.candidatesPath = argv[++i];
    else if (arg === "--estimates") options.estimatesPath = argv[++i];
    else if (arg === "--limit") options.limit = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function resolveSupabaseEnv(): { url: string; key: string } {
  const appEnv = process.env.APP_ENV === "production" ? "production" : "development";
  const prefix = appEnv === "production" ? "SUPABASE_PROD" : "SUPABASE_DEV";
  const url = process.env[`${prefix}_URL`] ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env[`${prefix}_SECRET_KEY`] ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) {
    throw new Error(`${prefix}_URL and ${prefix}_SECRET_KEY are required`);
  }
  return { url, key };
}

function writeUtf8(pathname: string, value: string): void {
  mkdirSync(dirname(pathname), { recursive: true });
  writeFileSync(pathname, `${value}${value.endsWith("\n") || value.length === 0 ? "" : "\n"}`, "utf8");
}

async function fetchRecipePosts(limit: number | null): Promise<RecipePostRow[]> {
  const { url, key } = resolveSupabaseEnv();
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const pageSize = 500;
  const rows: RecipePostRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const query = supabase
      .from("posts")
      .select("id,legacy_id,title,slug,content_html,excerpt,created_at,updated_at,published_at,post_tags(tags(name))")
      .eq("content_kind", "recipe")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .range(from, to);
    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    const batch = (data ?? []) as RecipePostRow[];
    rows.push(...batch);
    if (batch.length < pageSize || (limit !== null && rows.length >= limit)) {
      break;
    }
  }
  return limit === null ? rows : rows.slice(0, limit);
}

async function exportCandidates(options: Options): Promise<{ count: number }> {
  const rows = await fetchRecipePosts(options.limit);
  const jsonl = exportRecipeCalorieCandidatesToJsonl(
    rows.map((row) => ({
      id: row.id,
      legacy_id: row.legacy_id,
      title: row.title,
      slug: row.slug,
      content_html: row.content_html,
      excerpt: row.excerpt,
      created_at: row.created_at,
      updated_at: row.updated_at,
      published_at: row.published_at,
      status: "published",
      content_kind: "recipe",
      tags: (row.post_tags ?? []).map((link) => link.tags?.name).filter((name): name is string => Boolean(name))
    }))
  );
  writeUtf8(resolve(options.candidatesPath), jsonl);
  return { count: rows.length };
}

function estimateLocal(options: Options): { count: number } {
  const candidates = readFileSync(options.candidatesPath, "utf8");
  const estimates = estimateRecipeCaloriesLocallyFromCandidatesJsonl(candidates);
  writeUtf8(resolve(options.estimatesPath), estimates);
  return { count: estimates.split(/\r?\n/).filter(Boolean).length };
}

async function importEstimates(options: Options): Promise<{ imported: number; skipped: number; needsReview: number }> {
  const { url, key } = resolveSupabaseEnv();
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const input = readFileSync(options.estimatesPath, "utf8");
  return importRecipeCalorieEstimatesFromJsonl(input, supabase);
}

async function main(): Promise<void> {
  loadDotEnv();
  const options = parseArgs(process.argv.slice(2));
  requireEnv("APP_ENV");
  if (options.phase === "export") {
    console.log(JSON.stringify({ ok: true, phase: options.phase, ...(await exportCandidates(options)) }));
    return;
  }
  if (options.phase === "estimate-local") {
    console.log(JSON.stringify({ ok: true, phase: options.phase, ...estimateLocal(options) }));
    return;
  }
  if (options.phase === "import") {
    console.log(JSON.stringify({ ok: true, phase: options.phase, ...(await importEstimates(options)) }));
    return;
  }
  const exported = await exportCandidates(options);
  const estimated = estimateLocal(options);
  const imported = await importEstimates(options);
  console.log(JSON.stringify({ ok: true, phase: options.phase, exported, estimated, imported }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
