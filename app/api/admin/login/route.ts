import { NextResponse } from "next/server";
import { createAdminSessionToken, verifyAdminPassword } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";

export async function POST(request: Request) {
  const env = getServerEnv();
  const form = await request.formData();
  const password = String(form.get("password") ?? "");

  if (!verifyAdminPassword(password, env.adminPassword)) {
    return NextResponse.redirect(new URL("/admin?error=1", request.url), 303);
  }

  const response = NextResponse.redirect(new URL("/admin", request.url), 303);
  response.cookies.set("admin_session", createAdminSessionToken(env.authCookieSecret, env.adminPassword), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  return response;
}

