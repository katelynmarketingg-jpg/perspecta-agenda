import { NextResponse } from "next/server";
import { getSupabase, temSupabase, schemaEmUso } from "@/lib/supabaseClient";

// GET /api/diag — diagnóstico da conexão com o Supabase.
//
// Responde se o app está lendo do banco ("live") ou do mock, e, quando falha,
// devolve o erro exato do PostgREST por tabela. Existe porque uma falha de
// configuração (schema não exposto, RLS, chave errada) faz o app parecer
// funcionar enquanto na verdade não grava nada.
//
// Só devolve contagens e mensagens de erro — nunca o conteúdo das linhas nem
// a chave. Ainda assim é uma rota aberta: proteja ou remova antes de abrir a
// barbearia para o público de verdade.

export const dynamic = "force-dynamic";

const TABELAS = ["barbearia", "unidade", "servico", "profissional", "agendamento", "despesa"] as const;

// PGRST106 = schema fora da lista "Exposed schemas" do projeto. É o erro mais
// provável na primeira configuração, então merece uma dica explícita.
const DICA_SCHEMA_NAO_EXPOSTO =
  `O schema "${schemaEmUso}" existe no banco mas não está exposto na Data API. ` +
  `No painel do Supabase: Integrations → Data API → Exposed schemas → adicione ` +
  `"${schemaEmUso}" (mantendo os que já estão) → Save.`;

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;

  const config = {
    urlDefinida: Boolean(url),
    url, // pública: já vai no bundle do cliente
    anonKeyDefinida: Boolean(anon),
    anonKeyPrefixo: anon ? `${anon.slice(0, 12)}…(${anon.length} chars)` : null,
    schema: schemaEmUso,
    tenant: process.env.NEXT_PUBLIC_TENANT || "navalha",
    adminPinDefinido: Boolean(process.env.ADMIN_PIN),
  };

  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({
      modo: "mock",
      ok: false,
      diagnostico:
        "Supabase não configurado — o app está usando dados de exemplo (lib/mock.ts) " +
        "e nada é gravado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      config,
      tabelas: [],
    });
  }

  // Uma consulta de contagem por tabela (head: true não traz linhas).
  const tabelas = await Promise.all(
    TABELAS.map(async (tabela) => {
      const { count, error } = await sb.from(tabela).select("*", { count: "exact", head: true });
      if (error) {
        return {
          tabela,
          ok: false,
          linhas: null as number | null,
          erro: error.message,
          codigo: error.code ?? null,
        };
      }
      return { tabela, ok: true, linhas: count ?? 0, erro: null, codigo: null };
    }),
  );

  const falhas = tabelas.filter((t) => !t.ok);
  const ok = falhas.length === 0;
  const schemaNaoExposto = falhas.some((t) => t.codigo === "PGRST106");

  let diagnostico: string;
  if (ok) {
    const total = tabelas.reduce((s, t) => s + (t.linhas ?? 0), 0);
    diagnostico =
      `Conectado. As ${tabelas.length} tabelas do schema "${schemaEmUso}" respondem ` +
      `(${total} linhas no total). O app está lendo e gravando no banco.`;
  } else if (schemaNaoExposto) {
    diagnostico = DICA_SCHEMA_NAO_EXPOSTO;
  } else {
    diagnostico =
      `Conectou no Supabase, mas ${falhas.length} de ${tabelas.length} tabelas falharam. ` +
      `Veja o campo "erro" de cada uma abaixo.`;
  }

  return NextResponse.json({ modo: "live", ok, diagnostico, config, tabelas }, { status: ok ? 200 : 503 });
}
