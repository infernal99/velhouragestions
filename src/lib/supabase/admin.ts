import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

// Service-role client. Bypasses RLS, so it is only ever used for the few
// operations Supabase Auth reserves for it (sending invite emails), always
// after the caller's own permissions were checked with their RLS client.
// Never import this from a client component.
export function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) return null;
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
