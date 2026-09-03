import { NextRequest, NextResponse } from "next/server";
import { getProfissionais, criarProfissional } from "@/lib/data";
import { getSessao } from "@/lib/admin";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

function dono() { const s = getSessao(); return s && s.role === "dono"; }

// GET — lista os profissionais do tenant.
export async function GET() {
  if (!dono()) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  return NextResponse.json({ profissionais: getProfissionais(TENANT) });
}

// POST — cadastra barbeiro. body { nome, especialidade?, unidades?, servicos?, comissao?, pin?, cor?, iniciais? }
export async function POST(req: NextRequest) {
  if (!dono()) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }
  if (!b?.nome) return NextResponse.json({ erro: "Nome obrigatório" }, { status: 400 });
  const profissional = await criarProfissional(TENANT, {
    nome: String(b.nome),
    especialidade: b.especialidade || "",
    unidades: Array.isArray(b.unidades) ? b.unidades : [],
    servicos: Array.isArray(b.servicos) ? b.servicos : [],
    comissao: b.comissao !== undefined ? Number(b.comissao) : 0,
    pin: b.pin || undefined,
    cor: b.cor || undefined,
    iniciais: b.iniciais || undefined,
    rating: 5, avaliacoes: 0,
  } as any);
  return NextResponse.json({ profissional }, { status: 201 });
}
