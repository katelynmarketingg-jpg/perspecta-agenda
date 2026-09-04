import { NextRequest, NextResponse } from "next/server";
import { getUnidades, getOcupados } from "@/lib/data";
import { gerarSlots } from "@/lib/slots";

// GET /api/slots?slug=&unidade=&prof=&data=YYYY-MM-DD&dur=30
// Retorna a grade de horários do dia com cada slot marcado como disponível ou não.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const slug = q.get("slug") ?? "";
  const unidadeId = q.get("unidade") ?? "";
  const prof = q.get("prof") ?? "";
  const data = q.get("data") ?? "";
  const dur = Number(q.get("dur") ?? "30");

  const unidade = (await getUnidades(slug)).find((u) => u.id === unidadeId);
  if (!unidade || !data || !dur) {
    return NextResponse.json({ slots: [] });
  }

  const ocupados = await getOcupados(slug, unidadeId, prof, data);
  const slots = gerarSlots(unidade, data, dur, ocupados);
  return NextResponse.json({ slots });
}
