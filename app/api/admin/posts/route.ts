import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { verifyAdminSessionToken } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";
import {
  normalizeAdminContentKind,
  normalizeAdminPostStatus,
  saveAdminPost,
  type AdminPostClient
} from "@/lib/admin-posts";
import { useFixtureData } from "@/lib/fixture-data";
import { parseTagInput } from "@/lib/tags";

async function requireAdmin(): Promise<boolean> {
  const env = getServerEnv();
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get("admin_session")?.value, env.authCookieSecret, env.adminPassword);
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const slug = String(form.get("slug") ?? "").trim();
  const contentHtml = String(form.get("content_html") ?? "");
  const status = normalizeAdminPostStatus(String(form.get("status") ?? "draft"));
  const contentKind = normalizeAdminContentKind(String(form.get("content_kind") ?? "post"));
  const tagNames = parseTagInput(String(form.get("tags") ?? ""));

  if (!title || !slug) {
    return NextResponse.json({ error: "title and slug are required" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  try {
    if (!useFixtureData()) {
      await saveAdminPost(
        { id: id || undefined, title, slug, contentHtml, status, contentKind, tagNames },
        supabase as unknown as AdminPostClient
      );
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Save failed" }, { status: 500 });
  }

  return NextResponse.redirect(new URL(`/posts/${slug}`, request.url), 303);
}
