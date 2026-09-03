import { NextRequest, NextResponse } from "next/server";
import { listarAgendamentos, type FiltrosAdmin } from "@/lib/data";
import { getSessao } from "@/lib/admin";
import type { StatusAgendamento } from "@/lib/types";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

// GET /api/admin/agendamentos?data=&unidade=&prof=&status=  — lista (admin).
// Se a sessão for de um barbeiro, força o filtro para os agendamentos dele.
export async function GET(req: NextRequest) {
  const sess = getSessao();
  if (!sess) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const slug = q.get("slug") ?? TENANT;
  const filtros: FiltrosAdmin = {
    dataISO: q.get("data") || undefined,
    unidadeId: q.get("unidade") || undefined,
    profissionalId: q.get("prof") || undefined,
    status: (q.get("status") as StatusAgendamento) || undefined,
  };
  // Barbeiro só enxerga a própria agenda.
  if (sess.role === "prof") filtros.profissionalId = sess.profId;

  try {
    const agendamentos = await listarAgendamentos(slug, filtros);
    return NextResponse.json({ agendamentos });
  } catch (e: any) {
    return NextResponse.json({ erro: e?.message ?? "Falha" }, { status: 500 });
  }
}
