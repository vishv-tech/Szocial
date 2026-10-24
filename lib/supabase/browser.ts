import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";
let client: ReturnType<typeof createBrowserClient> | undefined;
export function browserSupabase() {
  const { url, key } = supabaseConfig();
  return client ??= createBrowserClient(url, key);
}
