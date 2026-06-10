import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env";

describe("parseServerEnv", () => {
  it("returns required Supabase, Blob, and admin settings", () => {
    const env = parseServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      BLOB_READ_WRITE_TOKEN: "blob",
      ADMIN_PASSWORD: "password",
      AUTH_COOKIE_SECRET: "secret"
    });

    expect(env.supabaseUrl).toBe("https://example.supabase.co");
    expect(env.supabaseAnonKey).toBe("anon");
    expect(env.supabaseServiceRoleKey).toBe("service");
    expect(env.blobReadWriteToken).toBe("blob");
    expect(env.adminPassword).toBe("password");
    expect(env.authCookieSecret).toBe("secret");
  });

  it("reports every missing required variable", () => {
    expect(() => parseServerEnv({})).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL.*NEXT_PUBLIC_SUPABASE_ANON_KEY.*SUPABASE_SERVICE_ROLE_KEY.*BLOB_READ_WRITE_TOKEN.*ADMIN_PASSWORD.*AUTH_COOKIE_SECRET/s
    );
  });
});

