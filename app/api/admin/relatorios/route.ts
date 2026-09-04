import { NextRequest, NextResponse } from "next/server";
import { resumoFinanceiro, serieDiaria, getProfissionais } from "@/lib/data";
import { getSessao } from "@/lib/admin";
import { hojeBrasilISO } from "@/lib/tz";

const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Recortes de hoje, semana atual (segunda→hoje) e mês atual (dia 1→hoje), no BR.
function ranges() {
  const hoje = hojeBrasilISO();
  const d = new Date(hoje + "T12:00:00");
  const dow = (d.getDay() + 6) % 7; // 0 = segunda
  const seg = new Date(d); seg.setDate(d.getDate() - dow);
  return { hoje, semanaDe: iso(seg), mesDe: hoje.slice(0, 8) + "01" };
}

async function cut(slug: string, de: string, ate: string, profId?: string) {
  const r = await resumoFinanceiro(slug, { de, ate, profId });
  return { atendimentos: r.atendimentos, faturamento: r.faturamento, comissao: r.comissoesTotal, ticket: r.ticketMedio };
}

// GET /api/admin/relatorios?prof=&de=&ate=
// Dono: qualquer barbeiro (ou "todos"); barbeiro: forçado ao próprio.
export async function GET(req: NextRequest) {
  const sess = getSessao();
  if (!sess) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const { hoje, semanaDe, mesDe } = ranges();
  const de = q.get("de") || mesDe;
  const ate = q.get("ate") || hoje;

  // Escopo do profissional.
  let profId: string | undefined;
  if (sess.role === "prof") profId = sess.profId;
  else {
    const pParam = q.get("prof") || "";
    profId = pParam && pParam !== "todos" ? pParam : undefined;
  }

  try {
    const [diario, semanal, mensal] = await Promise.all([
      cut(TENANT, hoje, hoje, profId),
      cut(TENANT, semanaDe, hoje, profId),
      cut(TENANT, mesDe, hoje, profId),
    ]);
    const serie = await serieDiaria(TENANT, { de, ate, profId });

    const profs = getProfissionais(TENANT);
    const profNome = profId ? (profs.find((p) => p.id === profId)?.nome ?? "") : "";
    const barbeiros = profs.map((p) => ({ id: p.id, nome: p.nome }));

    return NextResponse.json({
      role: sess.role,
      profId: profId ?? "",
      profNome,
      cuts: { diario, semanal, mensal },
      periodo: { de, ate, serie },
      barbeiros,
    });
  } catch (e: any) {
    return NextResponse.json({ erro: e?.message ?? "Falha" }, { status: 500 });
  }
}
