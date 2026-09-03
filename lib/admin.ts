import { cookies } from "next/headers";
import { profissionais as profsMock } from "./mock";

// Acesso ao painel — MVP por PIN. O dono usa ADMIN_PIN e vê todos; cada barbeiro
// usa o próprio PIN (lib/mock.ts / tabela profissional) e vê só a agenda dele.
// NÃO é autenticação forte: trocar por Supabase Auth + RLS depois.

export const ADMIN_COOKIE = "navalha_admin";
const TENANT = process.env.NEXT_PUBLIC_TENANT || "navalha";

export function getAdminPin(): string {
  return process.env.ADMIN_PIN || "1234"; // default só para o MVP
}

export type Sessao =
  | { role: "dono" }
  | { role: "prof"; profId: string; profNome: string }
  | null;

// Resolve um PIN em sessão (dono, barbeiro ou inválido).
export function resolverPin(pin: string): Sessao {
  if (pin && pin === getAdminPin()) return { role: "dono" };
  const p = profsMock.find((x) => x.slug === TENANT && x.pin && x.pin === pin);
  if (p) return { role: "prof", profId: p.id, profNome: p.nome };
  return null;
}

// Lê o cookie (httpOnly = o próprio PIN) e devolve a sessão atual.
export function getSessao(): Sessao {
  try {
    const pin = cookies().get(ADMIN_COOKIE)?.value ?? "";
    return resolverPin(pin);
  } catch {
    return null;
  }
}
