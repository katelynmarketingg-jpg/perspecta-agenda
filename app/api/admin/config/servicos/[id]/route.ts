import { NextRequest, NextResponse } from "next/server";
import { atualizarServico, excluirServico } from "@/lib/data";
import { getSessao } from "@/lib/admin";

function dono() { const s = getSessao(); return s && s.role === "dono"; }

// PATCH — edita serviço/combo (nome, duracaoMin, preco, ativo, itens…).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!dono()) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }
  const patch: any = {};
  if (b.nome !== undefined) patch.nome = String(b.nome);
  if (b.descricao !== undefined) patch.descricao = b.descricao;
  if (b.duracaoMin !== undefined) patch.duracaoMin = Number(b.duracaoMin);
  if (b.preco !== undefined) patch.preco = Number(b.preco);
  if (b.ativo !== undefined) patch.ativo = Boolean(b.ativo);
  if (b.itens !== undefined) patch.itens = b.itens;
  await atualizarServico(params.id, patch);
  return NextResponse.json({ ok: true });
}

// DELETE — remove serviço/combo.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!dono()) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  await excluirServico(params.id);
  return NextResponse.json({ ok: true });
}
