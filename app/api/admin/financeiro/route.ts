import { NextRequest, NextResponse } from "next/server";
import { resumoFinanceiro, listarDespesas } from "@/lib/data";
import { getSessao } from "@/lib/admin";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

// GET /api/admin/financeiro?de=&ate=&unidade=
// Dono: visão geral (com despesas e lucro). Barbeiro: só os próprios ganhos.
export async function GET(req: NextRequest) {
  const sess = getSessao();
  if (!sess) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const de = q.get("de") || "";
  const ate = q.get("ate") || "";
  const unidadeId = q.get("unidade") || undefined;
  if (!de || !ate) return NextResponse.json({ erro: "Período obrigatório" }, { status: 400 });

  const profId = sess.role === "prof" ? sess.profId : undefined;

  try {
    const resumo = await resumoFinanceiro(TENANT, { de, ate, unidadeId, profId });

    // Barbeiro não vê despesas nem lucro da casa.
    if (sess.role === "prof") {
      return NextResponse.json({ role: "prof", resumo });
    }

    const despesas = await listarDespesas(TENANT, { de, ate, unidadeId });
    const despesasTotal = despesas.reduce((s, d) => s + d.valor, 0);
    const lucro = resumo.faturamento - resumo.comissoesTotal - despesasTotal;
    return NextResponse.json({ role: "dono", resumo, despesas, despesasTotal, lucro });
  } catch (e: any) {
    return NextResponse.json({ erro: e?.message ?? "Falha" }, { status: 500 });
  }
}
