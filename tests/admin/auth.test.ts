import { describe, expect, it } from "vitest";
import { createAdminSessionToken, verifyAdminPassword, verifyAdminSessionToken } from "@/lib/auth";

describe("admin auth", () => {
  it("verifies the configured admin password", () => {
    expect(verifyAdminPassword("secret", "secret")).toBe(true);
    expect(verifyAdminPassword("wrong", "secret")).toBe(false);
  });

  it("creates deterministic session tokens bound to the cookie secret", () => {
    const token = createAdminSessionToken("cookie-secret", "admin-password");

    expect(verifyAdminSessionToken(token, "cookie-secret", "admin-password")).toBe(true);
    expect(verifyAdminSessionToken(token, "other-secret", "admin-password")).toBe(false);
    expect(verifyAdminSessionToken(token, "cookie-secret", "wrong-password")).toBe(false);
  });
});

