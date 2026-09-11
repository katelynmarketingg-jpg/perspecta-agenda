import { NextResponse } from "next/server";

// TEMPORÁRIO — diagnóstico da conexão Supabase. Remover depois.
// Não revela a chave; só prefixo/tamanho e a resposta crua do PostgREST.
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "navalha";

  const info: any = {
    url_host: url.replace(/^https?:\/\//, "").slice(0, 40),
    key_present: !!key,
    key_prefix: key.slice(0, 6),
    key_len: key.length,
    schema,
  };

  if (url && key) {
    // 1) Consulta na tabela do schema navalha (via Accept-Profile)
    try {
      const r = await fetch(`${url}/rest/v1/agendamento?select=id&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Accept-Profile": schema },
        cache: "no-store",
      });
      info.navalha_status = r.status;
      info.navalha_body = (await r.text()).slice(0, 300);
    } catch (e: any) { info.navalha_error = String(e); }

    // 2) Consulta no schema public (controle — o key funciona?)
    try {
      const r2 = await fetch(`${url}/rest/v1/?`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      });
      info.public_root_status = r2.status;
    } catch (e: any) { info.public_root_error = String(e); }
  }

  return NextResponse.json(info);
}
