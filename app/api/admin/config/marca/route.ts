import { NextRequest, NextResponse } from "next/server";
import { atualizarBranding } from "@/lib/data";
import { getSessao } from "@/lib/admin";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

// PUT /api/admin/config/marca — atualiza nome/símbolo/cor/tagline (só dono).
export async function PUT(req: NextRequest) {
  const s = getSessao();
  if (!s || s.role !== "dono") return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }
  const patch: any = {};
  for (const k of ["nome", "simbolo", "cor", "tagline", "logoUrl"]) if (b?.[k] !== undefined) patch[k] = b[k];
  const branding = await atualizarBranding(TENANT, patch);
  return NextResponse.json({ branding });
}
