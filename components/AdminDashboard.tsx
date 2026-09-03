"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Agendamento, Branding, Profissional, Servico, StatusAgendamento, Unidade } from "@/lib/types";
import { reais, dataLonga } from "@/lib/format";

type Props = {
  slug: string;
  branding: Branding;
  unidades: Unidade[];
  profissionais: Profissional[];
  servicos: Servico[];
};

function hojeLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function maskTel(digs: string): string {
  const d = (digs || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
const LABEL_STATUS: Record<StatusAgendamento, string> = {
  confirmado: "Confirmado", cancelado: "Cancelado", concluido: "Concluído",
};

export default function AdminDashboard({ slug, branding, unidades, profissionais, servicos }: Props) {
  const router = useRouter();
  const [unidadeId, setUnidadeId] = useState(unidades[0]?.id ?? "");
  const [dataISO, setDataISO] = useState(hojeLocalISO());
  const [prof, setProf] = useState("");
  const [status, setStatus] = useState<"" | StatusAgendamento>("");
  const [ags, setAgs] = useState<Agendamento[] | null>(null);

  const carregar = useCallback(() => {
    setAgs(null);
    const p = new URLSearchParams({ slug, data: dataISO });
    if (unidadeId) p.set("unidade", unidadeId);
    if (prof) p.set("prof", prof);
    if (status) p.set("status", status);
    fetch(`/api/admin/agendamentos?${p}`)
      .then((r) => {
        if (r.status === 401) { router.refresh(); return { agendamentos: [] }; }
        return r.json();
      })
      .then((d) => setAgs(d.agendamentos ?? []))
      .catch(() => setAgs([]));
  }, [slug, dataISO, unidadeId, prof, status, router]);

  useEffect(() => { carregar(); }, [carregar]);

  async function mudarStatus(id: string, novo: StatusAgendamento) {
    if (novo === "cancelado" && !window.confirm("Cancelar este agendamento?")) return;
    await fetch(`/api/admin/agendamentos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novo }),
    });
    carregar();
  }

  async function sair() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  const nomeProf = (id: string) => (id === "p-any" ? "Primeiro disponível" : profissionais.find((p) => p.id === id)?.nome ?? "—");
  const nomesServ = (ids: string[]) => servicos.filter((s) => ids.includes(s.id)).map((s) => s.nome).join(" + ");

  // Resumo do que está na tela (respeita os filtros aplicados).
  const resumo = useMemo(() => {
    const lista = ags ?? [];
    const conf = lista.filter((a) => a.status === "confirmado");
    return {
      total: lista.length,
      confirmados: conf.length,
      concluidos: lista.filter((a) => a.status === "concluido").length,
      cancelados: lista.filter((a) => a.status === "cancelado").length,
      faturamento: conf.reduce((s, a) => s + a.preco, 0),
    };
  }, [ags]);

  return (
    <div className="app" style={{ ["--brass" as any]: branding.cor, ["--brass-soft" as any]: `color-mix(in srgb, ${branding.cor} 72%, white)` }}>
      <div className="topbar">
        <div className="row">
          <button className="iconbtn" onClick={() => router.push("/")} aria-label="Voltar">‹</button>
          <div className="grow">
            <div className="crumb">{branding.nome} · admin</div>
            <div className="steptitle">Agenda</div>
          </div>
          <button className="theme-toggle" onClick={sair}>Sair</button>
        </div>
      </div>

      <div className="body">
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
          <div className="field">
            <label>Profissional</label>
            <select value={prof} onChange={(e) => setProf(e.target.value)}>
              <option value="">Todos</option>
              {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
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

        {/* Lista */}
        <div className="adm-sec">{dataLonga(dataISO)}</div>
        {ags === null ? (
          <div className="empty">Carregando…</div>
        ) : ags.length === 0 ? (
          <div className="empty">Nenhum agendamento com esses filtros.</div>
        ) : (
          ags.map((a) => {
            const hora = a.inicio.slice(11, 16);
            return (
              <div key={a.id} className="booking">
                <div className="when">
                  <div className="wt" style={{ marginTop: 0, fontSize: 15 }}>{hora}</div>
                  <div className="wm">{a.duracaoMin}min</div>
                </div>
                <div className="grow">
                  <h3>{a.clienteNome}</h3>
                  <div className="bs">
                    {maskTel(a.clienteId) && `${maskTel(a.clienteId)} · `}{nomesServ(a.servicoIds)}<br />
                    {nomeProf(a.profissionalId)}
                  </div>
                  <span className={"tag " + a.status}>● {LABEL_STATUS[a.status]}</span>
                  <div className="adm-actions">
                    {a.status === "confirmado" && (
                      <>
                        <button className="minibtn" onClick={() => mudarStatus(a.id, "concluido")}>Concluir</button>
                        <button className="minibtn danger" onClick={() => mudarStatus(a.id, "cancelado")}>Cancelar</button>
                      </>
                    )}
                    {a.status !== "confirmado" && (
                      <button className="minibtn" onClick={() => mudarStatus(a.id, "confirmado")}>Reabrir</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
