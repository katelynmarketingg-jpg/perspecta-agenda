import type { Branding } from "./types";

// Deriva uma variação mais clara da cor de destaque (para hover/gradientes),
// usando color-mix — suportado nos navegadores atuais.
export function corSoft(cor: string): string {
  return `color-mix(in srgb, ${cor} 72%, white)`;
}

// Converte o branding do tenant em variáveis CSS aplicáveis a um wrapper.
// Assim toda a UI (botões, seleções, detalhes) segue a cor da barbearia,
// em tema claro e escuro, sem recompilar nada.
export function brandingVars(b: Branding): Record<string, string> {
  return {
    "--brass": b.cor,
    "--brass-soft": corSoft(b.cor),
  };
}
