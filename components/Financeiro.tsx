"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CategoriaDespesa, Despesa, Unidade } from "@/lib/types";
import { reais } from "@/lib/format";

type Preset = "hoje" | "semana" | "mes" | "custom";
type Resumo = {
  faturamento: number; atendimentos: number; ticketMedio: number;
  porForma: { dinheiro: number; cartao: number; pix: number; semRegistro: number };
  comissoesTotal: number;
  porProfissional: { profId: string; nome: string; atendimentos: number; faturamento: number; comissao: number }[];
  porServico: { servicoId: string; nome: string; qtd: number; total: number }[];
};
type Resp = { role: "dono" | "prof"; resumo: Resumo; despesas?: Despesa[]; despesasTotal?: number; lucro?: number };

const CATS: { v: CategoriaDespesa; l: string }[] = [
  { v: "aluguel", l: "Aluguel" }, { v: "produtos", l: "Produtos" },
  { v: "salario", l: "Salário" }, { v: "marketing", l: "Marketing" }, { v: "outro", l: "Outro" },
];

function iso(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export default function Financeiro({ role, unidades }: { role: "dono" | "prof"; unidades: Unidade[] }) {
  const [preset, setPreset] = useState<Preset>("hoje");
  const hoje = iso(new Date());
  const [de, setDe] = useState(hoje);
  const [ate, setAte] = useState(hoje);
  const [unidadeId, setUnidadeId] = useState("");
  const [dados, setDados] = useState<Resp | null>(null);

  // Novo lançamento de despesa (dono)
  const [dData, setDData] = useState(hoje);
  const [dCat, setDCat] = useState<CategoriaDespesa>("produtos");
  const [dDesc, setDDesc] = useState("");
  const [dValor, setDValor] = useState("");

  // Ajusta de/ate conforme o preset.
  useEffect(() => {
    if (preset === "custom") return;
    const now = new Date();
    if (preset === "hoje") { setDe(iso(now)); setAte(iso(now)); }
    else if (preset === "semana") { const d = new Date(now); d.setDate(now.getDate() - 6); setDe(iso(d)); setAte(iso(now)); }
    else if (preset === "mes") { setDe(iso(new Date(now.getFullYear(), now.getMonth(), 1))); setAte(iso(now)); }
  }, [preset]);

  const carregar = useCallback(() => {
    if (!de || !ate) return;
    setDados(null);
    const p = new URLSearchParams({ de, ate });
    if (unidadeId) p.set("unidade", unidadeId);
    fetch(`/api/admin/financeiro?${p}`).then((r) => r.json()).then(setDados).catch(() => setDados(null));
  }, [de, ate, unidadeId]);

  useEffect(() => { carregar(); }, [carregar]);

  const r = dados?.resumo;
  const fat = r?.faturamento ?? 0;
  const pct = (v: number) => (fat > 0 ? Math.round((v / fat) * 100) : 0);

  async function addDespesa() {
    const valor = Number(dValor);
    if (!dDesc || !(valor > 0)) return;
    await fetch("/api/admin/despesas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: dData, categoria: dCat, descricao: dDesc, valor, unidadeId: unidadeId || undefined }),
    });
    setDDesc(""); setDValor("");
    carregar();
  }
  async function delDespesa(id: string) {
    await fetch(`/api/admin/despesas?id=${id}`, { method: "DELETE" });
    carregar();
  }

  const formas = useMemo(() => {
    if (!r) return [];
    return [
      { l: "Dinheiro", v: r.porForma.dinheiro },
      { l: "Cartão", v: r.porForma.cartao },
      { l: "Pix", v: r.porForma.pix },
      ...(r.porForma.semRegistro > 0 ? [{ l: "Sem registro", v: r.porForma.semRegistro }] : []),
    ];
  }, [r]);

  return (
    <>
      {/* Período */}
      <div className="viewseg">
        <button className={preset === "hoje" ? "on" : ""} onClick={() => setPreset("hoje")}>Hoje</button>
        <button className={preset === "semana" ? "on" : ""} onClick={() => setPreset("semana")}>Semana</button>
        <button className={preset === "mes" ? "on" : ""} onClick={() => setPreset("mes")}>Mês</button>
        <button className={preset === "custom" ? "on" : ""} onClick={() => setPreset("custom")}>Período</button>
      </div>
      {preset === "custom" && (
        <div className="adm-controls">
          <div className="field"><label>De</label><input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
          <div className="field"><label>Até</label><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        </div>
      )}
      {unidades.length > 1 && (
        <div className="field">
          <label>Unidade</label>
          <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
            <option value="">Todas</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
      )}

      {!dados ? (
        <div className="empty">Carregando…</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="tiles">
            <div className="tile brass"><div className="tv">{reais(fat)}</div><div className="tl">Faturamento</div></div>
            <div className="tile"><div className="tv">{r!.atendimentos}</div><div className="tl">Atendimentos</div></div>
            <div className="tile"><div className="tv">{reais(r!.ticketMedio)}</div><div className="tl">Ticket médio</div></div>
            <div className="tile"><div className="tv">{reais(r!.comissoesTotal)}</div><div className="tl">{role === "prof" ? "Minha comissão" : "Comissões"}</div></div>
            {role === "dono" && (
              <>
                <div className="tile"><div className="tv">{reais(dados.despesasTotal ?? 0)}</div><div className="tl">Despesas</div></div>
                <div className={"tile lucro " + ((dados.lucro ?? 0) < 0 ? "neg" : "brass")}>
                  <div className="tv">{reais(dados.lucro ?? 0)}</div><div className="tl">Lucro do período</div>
                </div>
              </>
            )}
          </div>

          {/* Recebido por forma */}
          <div className="adm-sec">{preset === "hoje" ? "Caixa do dia · por forma" : "Recebido por forma"}</div>
          {fat === 0 ? (
            <div className="empty">Sem recebimentos no período.</div>
          ) : (
            formas.map((f) => (
              <div key={f.l} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <div className="fin-row" style={{ padding: 0, border: "none" }}>
                  <span className="fl">{f.l}</span>
                  <span className="fv">{reais(f.v)}<small>{pct(f.v)}%</small></span>
                </div>
                <div className="bar"><i style={{ width: `${pct(f.v)}%` }} /></div>
              </div>
            ))
          )}

          {/* Por profissional (dono) */}
          {role === "dono" && r!.porProfissional.length > 0 && (
            <>
              <div className="adm-sec">Por profissional</div>
              {r!.porProfissional.map((p) => (
                <div key={p.profId} className="fin-row">
                  <span><span className="fl">{p.nome}</span><span className="fsub">{p.atendimentos} atend. · comissão {reais(p.comissao)}</span></span>
                  <span className="fv">{reais(p.faturamento)}</span>
                </div>
              ))}
            </>
          )}

          {/* Por serviço */}
          {r!.porServico.length > 0 && (
            <>
              <div className="adm-sec">Por serviço</div>
              {r!.porServico.map((s) => (
                <div key={s.servicoId} className="fin-row">
                  <span><span className="fl">{s.nome}</span><span className="fsub">{s.qtd}×</span></span>
                  <span className="fv">{reais(s.total)}</span>
                </div>
              ))}
            </>
          )}

          {/* Despesas (dono) */}
          {role === "dono" && (
            <>
              <div className="adm-sec">Despesas</div>
              <div className="despesa-form">
                <div className="field"><label>Data</label><input type="date" value={dData} onChange={(e) => setDData(e.target.value)} /></div>
                <div className="field"><label>Categoria</label>
                  <select value={dCat} onChange={(e) => setDCat(e.target.value as CategoriaDespesa)}>
                    {CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                  </select>
                </div>
                <div className="field full"><label>Descrição</label><input value={dDesc} onChange={(e) => setDDesc(e.target.value)} placeholder="Ex.: produtos de barbearia" /></div>
                <div className="field"><label>Valor (R$)</label><input inputMode="decimal" value={dValor} onChange={(e) => setDValor(e.target.value.replace(/[^\d.]/g, ""))} /></div>
                <div className="field full"><button className="cta" onClick={addDespesa} disabled={!dDesc || !(Number(dValor) > 0)}>Lançar despesa</button></div>
              </div>

              <div style={{ height: 12 }} />
              {(dados.despesas ?? []).length === 0 ? (
                <div className="empty">Nenhuma despesa no período.</div>
              ) : (
                (dados.despesas ?? []).map((d) => (
                  <div key={d.id} className="fin-row">
                    <span><span className="fl">{d.descricao}</span><span className="fsub">{d.data} · {d.categoria}</span></span>
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="fv">{reais(d.valor)}</span>
                      <button className="minibtn danger" onClick={() => delDespesa(d.id)}>Excluir</button>
                    </span>
                  </div>
                ))
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
