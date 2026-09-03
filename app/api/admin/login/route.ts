import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, resolverPin } from "@/lib/admin";

// POST /api/admin/login  body { pin }  — valida o PIN (dono ou barbeiro) e
// abre a sessão. O cookie httpOnly guarda o próprio PIN.
export async function POST(req: NextRequest) {
  let pin = "";
  try {
    pin = ((await req.json())?.pin ?? "").toString();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const sess = resolverPin(pin);
  if (!sess) {
    return NextResponse.json({ erro: "PIN incorreto" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, sessao: sess });
  res.cookies.set(ADMIN_COOKIE, pin, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 horas
  });
  return res;
}
