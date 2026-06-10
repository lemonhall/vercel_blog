import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

export function createSupabaseServiceClient() {
  const env = getServerEnv();
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
