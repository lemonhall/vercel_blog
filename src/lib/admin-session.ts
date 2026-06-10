import "server-only";

import { cookies } from "next/headers";
import { verifyAdminSessionToken } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";

export async function isAdminSessionValid(): Promise<boolean> {
  const env = getServerEnv();
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get("admin_session")?.value, env.authCookieSecret, env.adminPassword);
}
