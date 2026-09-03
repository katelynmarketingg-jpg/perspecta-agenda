import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, getAdminPin } from "@/lib/admin";

// POST /api/admin/login  body { pin }  — valida o PIN e abre a sessão do admin.
export async function POST(req: NextRequest) {
  let pin = "";
  try {
    pin = ((await req.json())?.pin ?? "").toString();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  if (pin !== getAdminPin()) {
    return NextResponse.json({ erro: "PIN incorreto" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, pin, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 horas
  });
  return res;
}
