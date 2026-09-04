import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Cliente Supabase criado sob demanda. Se as variáveis de ambiente não
// estiverem definidas, retorna null — e a camada lib/data.ts cai no mock.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Schema próprio dentro do projeto compartilhado (Commerce=commerce, Juris=public).
const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "navalha";

// O schema vem de env (string), então o genérico não pode ser o "public" padrão.
type Cliente = SupabaseClient<any, any, any>;

export const temSupabase = Boolean(url && anon);

// Nome do schema em uso — exibido pelo diagnóstico (/api/diag).
export const schemaEmUso = schema;

let _client: Cliente | null = null;

export function getSupabase(): Cliente | null {
  if (!temSupabase) return null;
  if (!_client) _client = createClient(url as string, anon as string, { db: { schema } });
  return _client;
}
