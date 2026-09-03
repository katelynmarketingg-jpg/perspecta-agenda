import { NextRequest, NextResponse } from "next/server";
import { atualizarStatusAgendamento } from "@/lib/data";
import { isAdminAutenticado } from "@/lib/admin";
import type { StatusAgendamento } from "@/lib/types";

const VALIDOS: StatusAgendamento[] = ["confirmado", "cancelado", "concluido"];

// PATCH /api/admin/agendamentos/[id]  body { status }  — muda o status (admin).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAutenticado()) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  let status: StatusAgendamento;
  try {
    status = (await req.json())?.status;
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }
  if (!VALIDOS.includes(status)) {
    return NextResponse.json({ erro: "Status inválido" }, { status: 400 });
  }

  try {
    await atualizarStatusAgendamento(params.id, status);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ erro: e?.message ?? "Falha" }, { status: 500 });
  }
}
