// Hora "de agora" no fuso do Brasil (America/Sao_Paulo), independentemente do
// fuso do servidor. Na Vercel o runtime roda em UTC, então usar new Date()
// direto deslocaria em 3h a regra de "horário já passou" e a detecção de "hoje".

export function agoraBrasil(): { dataISO: string; minutos: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const dataISO = `${get("year")}-${get("month")}-${get("day")}`;
  let hh = get("hour");
  if (hh === "24") hh = "00"; // alguns ambientes retornam 24 à meia-noite
  const minutos = Number(hh) * 60 + Number(get("minute"));
  return { dataISO, minutos };
}

// Só a data de hoje (YYYY-MM-DD) no Brasil.
export function hojeBrasilISO(): string {
  return agoraBrasil().dataISO;
}
