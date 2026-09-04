"use client";

import { useCallback, useEffect, useState } from "react";
import { reais } from "@/lib/format";

type Cut = { atendimentos: number; faturamento: number; comissao: number; ticket: number };
type Ponto = { data: string; atendimentos: number; faturamento: number; comissao: number };
type Resp = {
  role: "dono" | "prof";
  profId: string;
  profNome: string;
  cuts: { diario: Cut; semanal: Cut; mensal: Cut };
  periodo: { de: string; ate: string; serie: Ponto[] };
  barbeiros: { id: string; nome: string }[];
};

function iso(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function ddmm(isoStr: string) { const [, m, d] = isoStr.split("-"); return `${d}/${m}`; }

export default function RelatorioBarbeiro({ role, brandNome }: { role: "dono" | "prof"; brandNome: string }) {
  const hoje = iso(new Date());
  const [prof, setProf] = useState(""); // dono: "" = todos
  const [preset, setPreset] = useState<"semana" | "mes" | "custom">("mes");
  const [de, setDe] = useState(hoje.slice(0, 8) + "01");
  const [ate, setAte] = useState(hoje);
  const [d, setD] = useState<Resp | null>(null);

  // preset → intervalo da SÉRIE (os recortes hoje/semana/mês vêm prontos do servidor)
  useEffect(() => {
    if (preset === "custom") return;
    const now = new Date();
    if (preset === "mes") { setDe(iso(new Date(now.getFullYear(), now.getMonth(), 1))); setAte(iso(now)); }
    else if (preset === "semana") { const dow = (now.getDay() + 6) % 7; const seg = new Date(now); seg.setDate(now.getDate() - dow); setDe(iso(seg)); setAte(iso(now)); }
  }, [preset]);

  const carregar = useCallback(() => {
    setD(null);
    const p = new URLSearchParams({ de, ate });
    if (role === "dono" && prof) p.set("prof", prof);
    fetch(`/api/admin/relatorios?${p}`).then((r) => r.json()).then(setD).catch(() => setD(null));
  }, [de, ate, prof, role]);
  useEffect(() => { carregar(); }, [carregar]);

  const especifico = !!d?.profId; // um barbeiro específico (ou barbeiro logado)
  const nome = role === "prof" ? "você" : d?.profNome || "";
  const labelFat = especifico ? "Você gerou" : "Faturamento";
  const labelCom = especifico ? "Comissão" : "Comissões";

  const card = (titulo: string, c: Cut) => (
    <div className="relcard">
      <div className="relhead">{titulo}</div>
      <div className="relhero">
        <div className="rv">{reais(c.comissao)}</div>
        <div className="rl">{especifico ? "sua comissão" : "comissões"}</div>
      </div>
      <div className="relmini">
        <div><div className="mv">{c.atendimentos}</div><div className="ml">atend.</div></div>
        <div><div className="mv">{reais(c.faturamento)}</div><div className="ml">{especifico ? "gerou" : "faturou"}</div></div>
        <div><div className="mv">{reais(c.ticket)}</div><div className="ml">ticket</div></div>
      </div>
    </div>
  );

  const m = d?.cuts.mensal;
  const frase = !m ? "" :
    role === "prof"
      ? `No mês você atendeu ${m.atendimentos} clientes, gerou ${reais(m.faturamento)} e sua comissão é ${reais(m.comissao)}.`
      : especifico
        ? `No mês, ${nome} atendeu ${m.atendimentos} clientes, gerou ${reais(m.faturamento)} — comissão de ${reais(m.comissao)}.`
        : `No mês foram ${m.atendimentos} atendimentos, ${reais(m.faturamento)} de faturamento e ${reais(m.comissao)} em comissões.`;

  const serie = d?.periodo.serie ?? [];
  const maxFat = Math.max(1, ...serie.map((s) => s.faturamento));

  return (
    <>
      {/* Cabeçalho de impressão */}
      <div className="print-only">
        <div style={{ fontSize: 20, fontWeight: 700 }}>{brandNome} — Relatório</div>
        <div style={{ fontSize: 13 }}>{especifico ? nome : "Todos os profissionais"} · {ddmm(de)} a {ddmm(ate)}</div>
      </div>

      {/* Controles (não vão para a impressão) */}
      <div className="no-print">
        {role === "dono" && (
          <div className="field">
            <label>Barbeiro</label>
            <select value={prof} onChange={(e) => setProf(e.target.value)}>
              <option value="">Todos</option>
              {(d?.barbeiros ?? []).map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </div>
        )}
      </div>

      {!d ? (
        <div className="empty">Carregando…</div>
      ) : (
        <>
          <div className="adm-sec no-print">Resumo por período</div>
          <div className="relcards">
            {card("Diário", d.cuts.diario)}
            {card("Semanal", d.cuts.semanal)}
            {card("Mensal", d.cuts.mensal)}
          </div>

          {frase && <div className="frase" dangerouslySetInnerHTML={{ __html: fraseHtml(frase) }} />}

          {/* Série dia a dia */}
          <div className="adm-sec">Dia a dia</div>
          <div className="viewseg no-print">
            <button className={preset === "semana" ? "on" : ""} onClick={() => setPreset("semana")}>Semana</button>
            <button className={preset === "mes" ? "on" : ""} onClick={() => setPreset("mes")}>Mês</button>
            <button className={preset === "custom" ? "on" : ""} onClick={() => setPreset("custom")}>Período</button>
          </div>
          {preset === "custom" && (
            <div className="adm-controls no-print">
              <div className="field"><label>De</label><input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
              <div className="field"><label>Até</label><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
            </div>
          )}

          {serie.length === 0 ? (
            <div className="empty">Sem atendimentos concluídos no período.</div>
          ) : (
            serie.map((s) => (
              <div key={s.data} className="serie-row">
                <div className="sd">{ddmm(s.data)}</div>
                <div className="sbar">
                  <div className="scap">
                    <span>{s.atendimentos} atend. · {labelFat} {reais(s.faturamento)}</span>
                    <b>{reais(s.comissao)}</b>
                  </div>
                  <div className="bar"><i style={{ width: `${Math.round((s.faturamento / maxFat) * 100)}%` }} /></div>
                </div>
              </div>
            ))
          )}

          <div style={{ height: 16 }} />
          <button className="cta ghost no-print" onClick={() => window.print()}>Imprimir / salvar PDF</button>
        </>
      )}
    </>
  );
}

// Realça os valores em R$ e números na frase (sem depender de libs).
function fraseHtml(frase: string) {
  return frase
    .replace(/(R\$\s?[\d.,]+)/g, "<b>$1</b>")
    .replace(/(\b\d+\b)(?=\s+(clientes|atendimentos))/g, "<b>$1</b>");
}
