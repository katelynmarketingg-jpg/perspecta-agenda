import { NextRequest, NextResponse } from "next/server";
import { criarAgendamento, getAgendamentosDoCliente } from "@/lib/data";
import type { NovoAgendamento } from "@/lib/types";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

// GET /api/agendamentos?tel=<telefone>  — lista os agendamentos por telefone.
// O telefone (só dígitos) é a identidade do cliente. Aceita ?cliente= como alias.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const bruto = q.get("tel") ?? q.get("cliente") ?? "";
  const clienteId = bruto.replace(/\D/g, "");
  const slug = q.get("slug") ?? TENANT;
  if (!clienteId) return NextResponse.json({ agendamentos: [] });
  return NextResponse.json({ agendamentos: getAgendamentosDoCliente(slug, clienteId) });
}

// POST /api/agendamentos  — cria um agendamento a partir do wizard.
export async function POST(req: NextRequest) {
  let body: NovoAgendamento;
  try {
    body = (await req.json()) as NovoAgendamento;
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const faltando =
    !body.slug ||
    !body.unidadeId ||
    !body.profissionalId ||
    !body.servicoIds?.length ||
    !body.dataISO ||
    !body.hora;
  if (faltando) {
    return NextResponse.json({ erro: "Dados incompletos" }, { status: 400 });
  }

  try {
    const agendamento = await criarAgendamento(body);
    // Aqui entrariam os disparos de lembrete (WhatsApp/e-mail) — ver README.
    return NextResponse.json({ agendamento }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { erro: e?.message ?? "Falha ao criar agendamento" },
      { status: 500 },
    );
  }
}
