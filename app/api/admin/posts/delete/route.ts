import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { verifyAdminSessionToken } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { deleteAdminPost, type AdminPostClient } from "@/lib/admin-posts";

async function requireAdmin(): Promise<boolean> {
  const env = getServerEnv();
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get("admin_session")?.value, env.authCookieSecret, env.adminPassword);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const slug = String(form.get("slug") ?? "").trim();
  const returnTo = String(form.get("return_to") ?? "/").trim() || "/";

  if (!(await requireAdmin())) {
    const loginUrl = new URL("/admin", request.url);
    loginUrl.searchParams.set("next", returnTo);
    return NextResponse.redirect(loginUrl, 303);
  }

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  try {
    await deleteAdminPost(slug, createSupabaseServiceClient() as unknown as AdminPostClient);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 500 });
  }

  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}
