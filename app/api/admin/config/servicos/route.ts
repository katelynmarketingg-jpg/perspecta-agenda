import { NextRequest, NextResponse } from "next/server";
import { getServicosAdmin, criarServico } from "@/lib/data";
import { ehDono } from "@/lib/admin";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

// GET — lista todos os serviços (inclui inativos e combos).
export async function GET() {
  if (!(await ehDono())) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  return NextResponse.json({ servicos: await getServicosAdmin(TENANT) });
}

// POST — cria serviço ou combo. body { nome, duracaoMin, preco, descricao?, combo?, itens?, ativo? }
export async function POST(req: NextRequest) {
  if (!(await ehDono())) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }
  const duracaoMin = Number(b?.duracaoMin);
  const preco = Number(b?.preco);
  if (!b?.nome || !(duracaoMin > 0) || !(preco >= 0)) {
    return NextResponse.json({ erro: "Dados incompletos" }, { status: 400 });
  }
  const servico = await criarServico(TENANT, {
    nome: String(b.nome), duracaoMin, preco,
    descricao: b.descricao || undefined,
    ativo: b.ativo !== false,
    combo: Boolean(b.combo),
    itens: Array.isArray(b.itens) ? b.itens : undefined,
  });
  return NextResponse.json({ servico }, { status: 201 });
}
