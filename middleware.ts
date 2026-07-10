import { NextResponse, type NextRequest } from "next/server";
import { getSiteAccessDecision } from "@/lib/site-access";

export async function middleware(request: NextRequest) {
  const decision = await getSiteAccessDecision({
    method: request.method,
    url: request.url,
    userAgent: request.headers.get("user-agent") ?? undefined,
    sessionToken: request.cookies.get("admin_session")?.value,
    env: {
      authCookieSecret: process.env.AUTH_COOKIE_SECRET ?? "",
      adminPassword: process.env.ADMIN_PASSWORD ?? ""
    }
  });

  if (decision.action === "allow") {
    return NextResponse.next();
  }
  if (decision.action === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (decision.action === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.redirect(decision.location, 303);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
