export type SiteAccessEnv = {
  authCookieSecret: string;
  adminPassword: string;
};

export type SiteAccessDecision =
  | { action: "allow" }
  | { action: "redirect"; location: string }
  | { action: "unauthorized" }
  | { action: "forbidden" };

export type SiteAccessDecisionInput = {
  method: string;
  url: string;
  userAgent?: string;
  sessionToken: string | undefined;
  env: SiteAccessEnv;
};

const CRAWLER_USER_AGENT =
  /(?:GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-User|anthropic-ai|Google-Extended|Bytespider|PerplexityBot|Amazonbot)/i;

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(digest);
}

function timingSafeStringEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export async function verifySiteSessionToken(
  token: string | undefined,
  env: SiteAccessEnv
): Promise<boolean> {
  if (!token) {
    return false;
  }
  const expected = await sha256Hex(`${env.authCookieSecret}:${env.adminPassword}`);
  return timingSafeStringEqual(token, expected);
}

function isAlwaysAllowedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname === "/robots.txt"
  );
}

function redirectToLogin(url: URL): SiteAccessDecision {
  const next = `${url.pathname}${url.search}`;
  const loginUrl = new URL("/admin", url);
  loginUrl.searchParams.set("next", next);
  return { action: "redirect", location: loginUrl.toString() };
}

export function isKnownCrawler(userAgent: string | undefined): boolean {
  return CRAWLER_USER_AGENT.test(userAgent ?? "");
}

export async function getSiteAccessDecision(input: SiteAccessDecisionInput): Promise<SiteAccessDecision> {
  const url = new URL(input.url);
  if (isAlwaysAllowedPath(url.pathname)) {
    return { action: "allow" };
  }
  if (await verifySiteSessionToken(input.sessionToken, input.env)) {
    return { action: "allow" };
  }
  if (isKnownCrawler(input.userAgent)) {
    return { action: "forbidden" };
  }
  if (url.pathname === "/admin" || url.pathname === "/api/admin/login") {
    return { action: "allow" };
  }
  if (url.pathname.startsWith("/api/")) {
    return { action: "unauthorized" };
  }
  return redirectToLogin(url);
}
