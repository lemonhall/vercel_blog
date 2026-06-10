import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function verifyAdminPassword(input: string, configuredPassword: string): boolean {
  const left = digest(input);
  const right = digest(configuredPassword);
  return timingSafeEqual(left, right);
}

export function createAdminSessionToken(cookieSecret: string, adminPassword: string): string {
  return digest(`${cookieSecret}:${adminPassword}`).toString("hex");
}

export function verifyAdminSessionToken(token: string | undefined, cookieSecret: string, adminPassword: string): boolean {
  if (!token) {
    return false;
  }
  const expected = createAdminSessionToken(cookieSecret, adminPassword);
  const left = Buffer.from(token);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

