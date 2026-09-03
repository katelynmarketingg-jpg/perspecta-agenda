import { NextRequest, NextResponse } from "next/server";
import { atualizarProfissional, excluirProfissional } from "@/lib/data";
import { getSessao } from "@/lib/admin";

function dono() { const s = getSessao(); return s && s.role === "dono"; }

// PATCH — edita barbeiro (nome, especialidade, unidades, servicos, comissao, pin…).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!dono()) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }
  const patch: any = {};
  if (b.nome !== undefined) patch.nome = String(b.nome);
  if (b.especialidade !== undefined) patch.especialidade = b.especialidade;
  if (b.unidades !== undefined) patch.unidades = b.unidades;
  if (b.servicos !== undefined) patch.servicos = b.servicos;
  if (b.comissao !== undefined) patch.comissao = Number(b.comissao);
  if (b.pin !== undefined) patch.pin = b.pin || undefined;
  await atualizarProfissional(params.id, patch);
  return NextResponse.json({ ok: true });
}

// DELETE — remove barbeiro.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!dono()) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  await excluirProfissional(params.id);
  return NextResponse.json({ ok: true });
}
