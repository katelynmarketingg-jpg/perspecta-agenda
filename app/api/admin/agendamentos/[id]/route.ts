import { NextRequest, NextResponse } from "next/server";
import {
  atualizarStatusAgendamento,
  atualizarServicosAgendamento,
  registrarPagamento,
} from "@/lib/data";
import { getSessao } from "@/lib/admin";
import type { MetodoPagamento, Pagamento, StatusAgendamento } from "@/lib/types";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";
const STATUS_VALIDOS: StatusAgendamento[] = ["confirmado", "cancelado", "concluido"];
const METODOS: MetodoPagamento[] = ["dinheiro", "cartao", "pix"];

// PATCH /api/admin/agendamentos/[id]
// body pode conter { status } | { servicoIds } | { pagamentos } (um por vez ou juntos).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sess = getSessao();
  if (!sess) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  try {
    let recalc: { duracaoMin: number; preco: number } | undefined;

    // Troca/acréscimo de serviços
    if (Array.isArray(body.servicoIds)) {
      if (body.servicoIds.length === 0) {
        return NextResponse.json({ erro: "Escolha ao menos um serviço" }, { status: 400 });
      }
      recalc = await atualizarServicosAgendamento(TENANT, params.id, body.servicoIds);
    }

    // Pagamento (uma ou duas formas) → também conclui
    if (Array.isArray(body.pagamentos)) {
      const pags: Pagamento[] = body.pagamentos
        .filter((p: any) => METODOS.includes(p?.metodo) && Number(p?.valor) > 0)
        .map((p: any) => ({ metodo: p.metodo, valor: Number(p.valor) }));
      if (pags.length === 0) {
        return NextResponse.json({ erro: "Pagamento inválido" }, { status: 400 });
      }
      await registrarPagamento(params.id, pags);
    }

    // Status direto (confirmar/cancelar/reabrir)
    if (body.status) {
      if (!STATUS_VALIDOS.includes(body.status)) {
        return NextResponse.json({ erro: "Status inválido" }, { status: 400 });
      }
      await atualizarStatusAgendamento(params.id, body.status);
    }

    return NextResponse.json({ ok: true, recalc });
  } catch (e: any) {
    return NextResponse.json({ erro: e?.message ?? "Falha" }, { status: 500 });
  }
}
