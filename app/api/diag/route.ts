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

// "ausente" (variável não existe) e "vazia" (existe com valor em branco) pedem
// correções diferentes no painel da Vercel, então são reportadas separadamente.
type Estado = "ausente" | "vazia" | "definida";
function estado(v: string | undefined): Estado {
  if (v === undefined || v === null) return "ausente";
  if (v.trim() === "") return "vazia";
  return "definida";
}

// A chave vai em cabecalho HTTP, que so aceita bytes 0-255. Um caractere
// fora disso derruba a requisicao com "Cannot convert argument to a
// ByteString", erro que nao diz nada sobre a causa real. O caso comum: colar
// o valor MASCARADO exibido pelo painel (eyJhbGci••••) em vez da chave.
function validarChave(k: string): string | null {
  const fora = [...k].findIndex((c) => c.codePointAt(0)! > 255);
  if (fora >= 0) {
    const c = k[fora];
    return `A chave contem o caractere "${c}" (U+${k.codePointAt(fora)!.toString(16).toUpperCase().padStart(4, "0")}) na posicao ${fora}, que nao e valido em cabecalho HTTP. Quase sempre isso significa que foi colado o valor MASCARADO que o painel exibe, e nao a chave. Copie a chave pelo botao de copiar do Supabase (API Keys -> anon/public) e cole de novo.`;
  }
  if (/\s/.test(k)) return "A chave contem espaco ou quebra de linha. Remova.";
  if (k.split(".").length !== 3) return `A chave nao tem o formato de JWT (esperado 3 partes separadas por ponto, encontrado ${k.split(".").length}).`;
  return null;
}

// Identidade do deploy. Sem isto nao da para distinguir "a variavel esta
// vazia" de "voce esta lendo um build antigo, de antes de definir a variavel"
// — as duas coisas produzem exatamente a mesma resposta.
function identidadeDoDeploy() {
  return {
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    ambiente: process.env.VERCEL_ENV ?? "local",
    respostaGeradaEm: new Date().toISOString(),
  };
}

// Nunca cachear: a resposta so tem valor se refletir o estado deste instante.
const SEM_CACHE = { "Cache-Control": "no-store, max-age=0, must-revalidate" };

export async function GET() {
  const deploy = identidadeDoDeploy();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const config = {
    NEXT_PUBLIC_SUPABASE_URL: estado(url),
    url: url || null, // pública: já vai no bundle do cliente
    NEXT_PUBLIC_SUPABASE_ANON_KEY: estado(anon),
    anonKeyPrefixo: anon ? `${anon.slice(0, 12)}…(${anon.length} chars)` : null,
    NEXT_PUBLIC_SUPABASE_SCHEMA: estado(process.env.NEXT_PUBLIC_SUPABASE_SCHEMA),
    schemaEmUso,
    NEXT_PUBLIC_TENANT: estado(process.env.NEXT_PUBLIC_TENANT),
    tenantEmUso: process.env.NEXT_PUBLIC_TENANT || "navalha",
    ADMIN_PIN: estado(process.env.ADMIN_PIN),
  };

  // Chave malformada: reportar antes de tentar conectar, senao o erro real
  // fica escondido atras de um TypeError repetido em todas as tabelas.
  const problemaChave = anon ? validarChave(anon) : null;
  if (problemaChave) {
    return NextResponse.json(
      { modo: "live", ok: false, diagnostico: problemaChave, deploy, config, tabelas: [] },
      { status: 503, headers: SEM_CACHE },
    );
  }

  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({
      modo: "mock",
      ok: false,
      diagnostico:
        "Supabase não configurado — o app está usando dados de exemplo (lib/mock.ts) " +
        "e nada é gravado. Veja em `config` quais variáveis estão ausentes ou vazias. " +
        "Atenção: as NEXT_PUBLIC_* são embutidas no bundle durante o BUILD, então " +
        "definir a variável não basta — é preciso um build novo para ela valer.",
      deploy,
      config,
      tabelas: [],
    }, { headers: SEM_CACHE });
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

  return NextResponse.json(
    { modo: "live", ok, diagnostico, deploy, config, tabelas },
    { status: ok ? 200 : 503, headers: SEM_CACHE },
  );
}
