import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/config";

export function createServerSupabaseClient() {
  const { url, serviceRoleKey } = getSupabaseEnv();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
