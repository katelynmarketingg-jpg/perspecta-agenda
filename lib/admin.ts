import { cookies } from "next/headers";

// Acesso do admin — MVP simples por PIN (variável de ambiente ADMIN_PIN).
// NÃO é autenticação forte: serve para proteger a área enquanto o app não tem
// Supabase Auth. Trocar por Auth + RLS depois (o PIN vira login por usuário).

export const ADMIN_COOKIE = "navalha_admin";

export function getAdminPin(): string {
  // Default só para o MVP funcionar sem configurar nada; defina ADMIN_PIN na Vercel.
  return process.env.ADMIN_PIN || "1234";
}

// Lê o cookie (httpOnly) e confere contra o PIN. Válido em server components
// e route handlers (next/headers).
export function isAdminAutenticado(): boolean {
  try {
    const c = cookies().get(ADMIN_COOKIE)?.value;
    return !!c && c === getAdminPin();
  } catch {
    return false;
  }
}
