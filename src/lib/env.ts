export type ServerEnv = {
  appEnv: "development" | "production";
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseSecretKey: string;
  blobReadWriteToken: string;
  aiGatewayApiKey?: string;
  adminPassword: string;
  authCookieSecret: string;
};

const required = [
  "BLOB_READ_WRITE_TOKEN",
  "ADMIN_PASSWORD",
  "AUTH_COOKIE_SECRET"
] as const;

function getAppEnv(input: Record<string, string | undefined>): "development" | "production" {
  return input.APP_ENV === "production" ? "production" : "development";
}

export function parseServerEnv(input: Record<string, string | undefined>): ServerEnv {
  const missing: string[] = required.filter((key) => !input[key]?.trim());
  const appEnv = getAppEnv(input);
  const scopedPrefix = appEnv === "production" ? "SUPABASE_PROD" : "SUPABASE_DEV";
  const supabaseUrl = input.NEXT_PUBLIC_SUPABASE_URL ?? input[`${scopedPrefix}_URL`];
  const publishableKey =
    input.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    input.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    input[`${scopedPrefix}_PUBLISHABLE_KEY`];
  const secretKey =
    input.SUPABASE_SECRET_KEY ?? input.SUPABASE_SERVICE_ROLE_KEY ?? input[`${scopedPrefix}_SECRET_KEY`];
  if (!supabaseUrl?.trim()) {
    missing.push(`${scopedPrefix}_URL`);
  }
  if (!publishableKey?.trim()) {
    missing.push(`${scopedPrefix}_PUBLISHABLE_KEY`);
  }
  if (!secretKey?.trim()) {
    missing.push(`${scopedPrefix}_SECRET_KEY`);
  }
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    appEnv,
    supabaseUrl: supabaseUrl!,
    supabasePublishableKey: publishableKey!,
    supabaseSecretKey: secretKey!,
    blobReadWriteToken: input.BLOB_READ_WRITE_TOKEN!,
    aiGatewayApiKey: input.AI_GATEWAY_API_KEY?.trim() || undefined,
    adminPassword: input.ADMIN_PASSWORD!,
    authCookieSecret: input.AUTH_COOKIE_SECRET!
  };
}

export function getServerEnv(): ServerEnv {
  return parseServerEnv(process.env);
}
