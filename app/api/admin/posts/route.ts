import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { verifyAdminSessionToken } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { excerptFromHtml } from "@/lib/html";

function normalizeStatus(value: string): "draft" | "published" {
  return value === "published" ? "published" : "draft";
}

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
  const title = String(form.get("title") ?? "").trim();
  const slug = String(form.get("slug") ?? "").trim();
  const contentHtml = String(form.get("content_html") ?? "");
  const status = normalizeStatus(String(form.get("status") ?? "draft"));

  if (!title || !slug) {
    return NextResponse.json({ error: "title and slug are required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("posts").insert({
    title,
    slug,
    content_html: contentHtml,
    excerpt: excerptFromHtml(contentHtml),
    status,
    published_at: status === "published" ? now : null
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL(`/posts/${slug}`, request.url), 303);
}

