import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env";

describe("parseServerEnv", () => {
  it("returns required Supabase, Blob, and admin settings", () => {
    const env = parseServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
      SUPABASE_SECRET_KEY: "secret-key",
      BLOB_READ_WRITE_TOKEN: "blob",
      AI_GATEWAY_API_KEY: "ai-gateway",
      ADMIN_PASSWORD: "password",
      AUTH_COOKIE_SECRET: "secret"
    });

    expect(env.supabaseUrl).toBe("https://example.supabase.co");
    expect(env.supabasePublishableKey).toBe("publishable");
    expect(env.supabaseSecretKey).toBe("secret-key");
    expect(env.blobReadWriteToken).toBe("blob");
    expect(env.aiGatewayApiKey).toBe("ai-gateway");
    expect(env.adminPassword).toBe("password");
    expect(env.authCookieSecret).toBe("secret");
  });

  it("accepts hsk_shop style development scoped Supabase variables", () => {
    const env = parseServerEnv({
      APP_ENV: "development",
      SUPABASE_DEV_URL: "https://dev.supabase.co",
      SUPABASE_DEV_PUBLISHABLE_KEY: "dev-publishable",
      SUPABASE_DEV_SECRET_KEY: "dev-secret",
      BLOB_READ_WRITE_TOKEN: "blob",
      ADMIN_PASSWORD: "password",
      AUTH_COOKIE_SECRET: "secret"
    });

    expect(env.appEnv).toBe("development");
    expect(env.supabaseUrl).toBe("https://dev.supabase.co");
    expect(env.supabasePublishableKey).toBe("dev-publishable");
    expect(env.supabaseSecretKey).toBe("dev-secret");
  });

  it("uses production scoped Supabase variables when APP_ENV is production", () => {
    const env = parseServerEnv({
      APP_ENV: "production",
      SUPABASE_PROD_URL: "https://prod.supabase.co",
      SUPABASE_PROD_PUBLISHABLE_KEY: "prod-publishable",
      SUPABASE_PROD_SECRET_KEY: "prod-secret",
      BLOB_READ_WRITE_TOKEN: "blob",
      ADMIN_PASSWORD: "password",
      AUTH_COOKIE_SECRET: "secret"
    });

    expect(env.appEnv).toBe("production");
    expect(env.supabaseUrl).toBe("https://prod.supabase.co");
    expect(env.supabasePublishableKey).toBe("prod-publishable");
    expect(env.supabaseSecretKey).toBe("prod-secret");
  });

  it("reports every missing required variable", () => {
    expect(() => parseServerEnv({})).toThrow(
      /BLOB_READ_WRITE_TOKEN.*ADMIN_PASSWORD.*AUTH_COOKIE_SECRET.*SUPABASE_DEV_URL.*SUPABASE_DEV_PUBLISHABLE_KEY.*SUPABASE_DEV_SECRET_KEY/s
    );
  });

  it("accepts legacy anon and service_role names as fallbacks", () => {
    const env = parseServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      BLOB_READ_WRITE_TOKEN: "blob",
      ADMIN_PASSWORD: "password",
      AUTH_COOKIE_SECRET: "secret"
    });

    expect(env.supabasePublishableKey).toBe("anon");
    expect(env.supabaseSecretKey).toBe("service-role");
  });

  it("treats AI Gateway key as an optional server-only setting", () => {
    const env = parseServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
      SUPABASE_SECRET_KEY: "secret-key",
      BLOB_READ_WRITE_TOKEN: "blob",
      ADMIN_PASSWORD: "password",
      AUTH_COOKIE_SECRET: "secret"
    });

    expect(env.aiGatewayApiKey).toBeUndefined();
  });
});
