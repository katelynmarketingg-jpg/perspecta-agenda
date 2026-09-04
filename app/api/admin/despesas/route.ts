import { NextRequest, NextResponse } from "next/server";
import { listarDespesas, criarDespesa, excluirDespesa } from "@/lib/data";
import { ehDono } from "@/lib/admin";
import type { CategoriaDespesa } from "@/lib/types";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";
const CATEGORIAS: CategoriaDespesa[] = ["aluguel", "produtos", "salario", "marketing", "outro"];

// GET /api/admin/despesas?de=&ate=&unidade=
export async function GET(req: NextRequest) {
  if (!(await ehDono())) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  const q = req.nextUrl.searchParams;
  const de = q.get("de") || "";
  const ate = q.get("ate") || "";
  const unidadeId = q.get("unidade") || undefined;
  const despesas = await listarDespesas(TENANT, { de, ate, unidadeId });
  return NextResponse.json({ despesas });
}

// POST /api/admin/despesas  body { data, categoria, descricao, valor, unidadeId? }
export async function POST(req: NextRequest) {
  if (!(await ehDono())) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }

  const valor = Number(b?.valor);
  const categoria: CategoriaDespesa = CATEGORIAS.includes(b?.categoria) ? b.categoria : "outro";
  if (!b?.data || !(valor > 0) || !b?.descricao) {
    return NextResponse.json({ erro: "Dados incompletos" }, { status: 400 });
  }
  const despesa = await criarDespesa({
    slug: TENANT, unidadeId: b.unidadeId || undefined, data: b.data, categoria, descricao: String(b.descricao), valor,
  });
  return NextResponse.json({ despesa }, { status: 201 });
}

// DELETE /api/admin/despesas?id=
export async function DELETE(req: NextRequest) {
  if (!(await ehDono())) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ erro: "id obrigatório" }, { status: 400 });
  await excluirDespesa(id);
  return NextResponse.json({ ok: true });
}
