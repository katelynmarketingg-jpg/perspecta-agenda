import type { Slot, Unidade } from "./types";

// Geração da grade de horários — o coração da regra de disponibilidade.
//
// Dado o expediente da unidade, a duração do serviço e os intervalos já
// ocupados, produz TODOS os slots do dia. Ocupados e horários que não cabem
// no expediente (ou já passaram, se for hoje) vêm com `disponivel: false` —
// eles aparecem na tela, porém desabilitados, para o cliente enxergar a
// disponibilidade real.

const PASSO_MIN = 30; // granularidade da grade (30 em 30 min)

type Intervalo = { inicioMin: number; fimMin: number };

function hhmm(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function sobrepoe(a: Intervalo, b: Intervalo): boolean {
  return a.inicioMin < b.fimMin && b.inicioMin < a.fimMin;
}

export function gerarSlots(
  unidade: Pick<Unidade, "abreHora" | "fechaHora">,
  dataISO: string, // "YYYY-MM-DD"
  duracaoMin: number,
  ocupados: Intervalo[], // em minutos desde 00:00, no dia escolhido
  agora: Date = new Date(),
): Slot[] {
  const abre = unidade.abreHora * 60;
  const fecha = unidade.fechaHora * 60;
  const slots: Slot[] = [];

  // Se a data escolhida for hoje, bloquear horários que já passaram.
  const hojeISO = agora.toISOString().slice(0, 10);
  const ehHoje = dataISO === hojeISO;
  const minutoAtual = agora.getHours() * 60 + agora.getMinutes();

  for (let t = abre; t + duracaoMin <= fecha; t += PASSO_MIN) {
    const slot: Intervalo = { inicioMin: t, fimMin: t + duracaoMin };

    const conflita = ocupados.some((o) => sobrepoe(slot, o));
    const jaPassou = ehHoje && t <= minutoAtual;

    slots.push({ hora: hhmm(t), disponivel: !conflita && !jaPassou });
  }

  return slots;
}

// Converte "HH:MM" para minutos desde 00:00.
export function horaParaMin(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}
