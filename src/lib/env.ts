export type ServerEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  blobReadWriteToken: string;
  adminPassword: string;
  authCookieSecret: string;
};

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "BLOB_READ_WRITE_TOKEN",
  "ADMIN_PASSWORD",
  "AUTH_COOKIE_SECRET"
] as const;

export function parseServerEnv(input: Record<string, string | undefined>): ServerEnv {
  const missing = required.filter((key) => !input[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    supabaseUrl: input.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: input.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    supabaseServiceRoleKey: input.SUPABASE_SERVICE_ROLE_KEY!,
    blobReadWriteToken: input.BLOB_READ_WRITE_TOKEN!,
    adminPassword: input.ADMIN_PASSWORD!,
    authCookieSecret: input.AUTH_COOKIE_SECRET!
  };
}

export function getServerEnv(): ServerEnv {
  return parseServerEnv(process.env);
}

