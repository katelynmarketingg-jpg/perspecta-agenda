import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Cliente Supabase criado sob demanda. Se as variáveis de ambiente não
// estiverem definidas, retorna null — e a camada lib/data.ts cai no mock.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const temSupabase = Boolean(url && anon);

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!temSupabase) return null;
  if (!_client) _client = createClient(url as string, anon as string);
  return _client;
}
