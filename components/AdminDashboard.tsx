"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Agendamento, Branding, Profissional, Servico, StatusAgendamento, Unidade } from "@/lib/types";
import { reais, dataLonga } from "@/lib/format";
import AgendamentoModal from "./AgendamentoModal";
import Financeiro from "./Financeiro";

type Modo = "lista" | "agenda" | "cards";

type Props = {
  slug: string;
  branding: Branding;
  unidades: Unidade[];
  profissionais: Profissional[];
  servicos: Servico[];
  role: "dono" | "prof";
  profId: string;
  profNome: string;
};

function hojeLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function maskTel(digs: string): string {
  const d = (digs || "").replace(/\D/g, "").slice(0, 11);
  if (d.length < 10) return "";
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
const LABEL_STATUS: Record<StatusAgendamento, string> = {
  confirmado: "Confirmado", cancelado: "Cancelado", concluido: "Concluído",
};

export default function AdminDashboard({ slug, branding, unidades, profissionais, servicos, role, profId, profNome }: Props) {
  const router = useRouter();
  const [unidadeId, setUnidadeId] = useState(unidades[0]?.id ?? "");
  const [dataISO, setDataISO] = useState(hojeLocalISO());
  const [prof, setProf] = useState("");
  const [status, setStatus] = useState<"" | StatusAgendamento>("");
  const [ags, setAgs] = useState<Agendamento[] | null>(null);
  const [modo, setModo] = useState<Modo>("lista");
  const [sel, setSel] = useState<Agendamento | null>(null); // agendamento aberto no modal
  const [aba, setAba] = useState<"agenda" | "financeiro">("agenda");

  useEffect(() => {
    try { const m = localStorage.getItem("admin_modo") as Modo | null; if (m) setModo(m); } catch { /* ignore */ }
  }, []);
  function trocarModo(m: Modo) { setModo(m); try { localStorage.setItem("admin_modo", m); } catch { /* ignore */ } }

  const carregar = useCallback(() => {
    setAgs(null);
    const p = new URLSearchParams({ slug, data: dataISO });
    if (unidadeId) p.set("unidade", unidadeId);
    if (role === "dono" && prof) p.set("prof", prof); // barbeiro é forçado no servidor
    if (status) p.set("status", status);
    fetch(`/api/admin/agendamentos?${p}`)
      .then((r) => { if (r.status === 401) { router.refresh(); return { agendamentos: [] }; } return r.json(); })
      .then((d) => setAgs(d.agendamentos ?? []))
      .catch(() => setAgs([]));
  }, [slug, dataISO, unidadeId, prof, status, role, router]);

  useEffect(() => { carregar(); }, [carregar]);

  async function sair() { await fetch("/api/admin/logout", { method: "POST" }); router.refresh(); }

  const nomeProf = (id: string) => (id === "p-any" ? "Primeiro disponível" : profissionais.find((p) => p.id === id)?.nome ?? "—");
  const nomesServ = (ids: string[]) => servicos.filter((s) => ids.includes(s.id)).map((s) => s.nome).join(" + ");

  const resumo = useMemo(() => {
    const lista = ags ?? [];
    const conf = lista.filter((a) => a.status === "confirmado");
    return {
      confirmados: conf.length,
      concluidos: lista.filter((a) => a.status === "concluido").length,
      cancelados: lista.filter((a) => a.status === "cancelado").length,
      faturamento: conf.reduce((s, a) => s + a.preco, 0),
    };
  }, [ags]);

  function statusTag(a: Agendamento) {
    return <span className={"tag " + a.status}>● {LABEL_STATUS[a.status]}{a.pago ? " · pago" : ""}</span>;
  }

  return (
    <div className="app" style={{ ["--brass" as any]: branding.cor, ["--brass-soft" as any]: `color-mix(in srgb, ${branding.cor} 72%, white)` }}>
      <div className="topbar">
        <div className="row">
          <button className="iconbtn" onClick={() => router.push("/")} aria-label="Voltar">‹</button>
          <div className="grow">
            <div className="crumb">{branding.nome} · {role === "prof" ? profNome : "admin"}</div>
            <div className="steptitle">{role === "prof" ? "Minha agenda" : "Agenda"}</div>
          </div>
          <button className="theme-toggle" onClick={sair}>Sair</button>
        </div>
      </div>

      <div className="body">
        {/* Alternador Agenda | Financeiro */}
        <div className="viewseg" style={{ marginBottom: 10 }}>
          <button className={aba === "agenda" ? "on" : ""} onClick={() => setAba("agenda")}>Agenda</button>
          <button className={aba === "financeiro" ? "on" : ""} onClick={() => setAba("financeiro")}>
            {role === "prof" ? "Meus ganhos" : "Financeiro"}
          </button>
        </div>

        {aba === "financeiro" ? (
          <Financeiro role={role} unidades={unidades} />
        ) : (
        <>
        {/* Filtros */}
        <div className="adm-controls">
          <div className="field">
            <label>Unidade</label>
            <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Data</label>
            <input type="date" value={dataISO} onChange={(e) => setDataISO(e.target.value)} />
          </div>
        </div>
        <div className="adm-controls">
          {role === "dono" && (
            <div className="field">
              <label>Profissional</label>
              <select value={prof} onChange={(e) => setProf(e.target.value)}>
                <option value="">Todos</option>
                {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="">Todos</option>
              <option value="confirmado">Confirmados</option>
              <option value="concluido">Concluídos</option>
              <option value="cancelado">Cancelados</option>
            </select>
          </div>
        </div>

        {/* Resumo */}
        <div className="tiles">
          <div className="tile brass"><div className="tv">{resumo.confirmados}</div><div className="tl">Confirmados</div></div>
          <div className="tile"><div className="tv">{resumo.concluidos}</div><div className="tl">Concluídos</div></div>
          <div className="tile"><div className="tv">{resumo.cancelados}</div><div className="tl">Cancelados</div></div>
          <div className="tile brass"><div className="tv">{reais(resumo.faturamento)}</div><div className="tl">Previsto</div></div>
        </div>

        {/* Seletor de visualização */}
        <div className="viewseg">
          <button className={modo === "lista" ? "on" : ""} onClick={() => trocarModo("lista")}>Lista</button>
          <button className={modo === "agenda" ? "on" : ""} onClick={() => trocarModo("agenda")}>Agenda</button>
          <button className={modo === "cards" ? "on" : ""} onClick={() => trocarModo("cards")}>Cards</button>
        </div>

        <div className="adm-sec">{dataLonga(dataISO)}</div>

        {ags === null ? (
          <div className="empty">Carregando…</div>
        ) : ags.length === 0 ? (
          <div className="empty">Nenhum agendamento com esses filtros.</div>
        ) : modo === "agenda" ? (
          ags.map((a) => (
            <div key={a.id} className="sched" onClick={() => setSel(a)}>
              <div className="st">{a.inicio.slice(11, 16)}</div>
              <div className="sinfo">
                <b>{a.clienteNome}</b>
                <span>{nomesServ(a.servicoIds)} · {nomeProf(a.profissionalId)}</span>
              </div>
              {statusTag(a)}
            </div>
          ))
        ) : modo === "cards" ? (
          <div className="cardgrid">
            {ags.map((a) => (
              <div key={a.id} className="card ag-item" style={{ display: "block" }} onClick={() => setSel(a)}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 15 }}>{a.inicio.slice(11, 16)} · {a.duracaoMin}min</div>
                <h3 style={{ marginTop: 6 }}>{a.clienteNome}</h3>
                <div className="sub">{nomesServ(a.servicoIds)}<br />{nomeProf(a.profissionalId)}</div>
                <div style={{ marginTop: 8 }}>{statusTag(a)}</div>
              </div>
            ))}
          </div>
        ) : (
          ags.map((a) => (
            <div key={a.id} className="booking ag-item" onClick={() => setSel(a)}>
              <div className="when">
                <div className="wt" style={{ marginTop: 0, fontSize: 15 }}>{a.inicio.slice(11, 16)}</div>
                <div className="wm">{a.duracaoMin}min</div>
              </div>
              <div className="grow">
                <h3>{a.clienteNome}</h3>
                <div className="bs">
                  {maskTel(a.clienteId) && `${maskTel(a.clienteId)} · `}{nomesServ(a.servicoIds)}<br />
                  {nomeProf(a.profissionalId)}
                </div>
                {statusTag(a)}
              </div>
            </div>
          ))
        )}
        </>
        )}
      </div>

      {sel && (
        <AgendamentoModal
          agendamento={sel}
          servicos={servicos}
          profNome={nomeProf(sel.profissionalId)}
          onClose={() => setSel(null)}
          onChanged={carregar}
        />
      )}
    </div>
  );
}
