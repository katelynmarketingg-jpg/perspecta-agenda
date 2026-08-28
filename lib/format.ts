// Formatação em pt-BR.

export function reais(v: number): string {
  return `R$ ${v.toFixed(0)}`;
}

const DOWS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// "2026-08-27" -> { dow:"Qui", dia:27, mes:"ago" }
export function partesData(dataISO: string) {
  const d = new Date(dataISO + "T00:00:00");
  return { dow: DOWS[d.getDay()], dia: d.getDate(), mes: MESES[d.getMonth()] };
}

// "2026-08-27" -> "Qui, 27 ago"
export function dataLonga(dataISO: string): string {
  const p = partesData(dataISO);
  return `${p.dow}, ${p.dia} ${p.mes}`;
}
