"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Agendamento, Branding, Profissional, Servico, Unidade } from "@/lib/types";
import { partesData } from "@/lib/format";

type Props = {
  slug: string;
  branding: Branding;
  unidades: Unidade[];
  profissionais: Profissional[];
  servicos: Servico[];
  telInicial?: string; // dígitos vindos da query (?tel=)
};

function maskTel(digs: string): string {
  const d = digs.slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function MyBookings({ slug, branding, unidades, profissionais, servicos, telInicial }: Props) {
  const router = useRouter();
  const [tel, setTel] = useState(telInicial || "");
  const [ags, setAgs] = useState<Agendamento[] | null>(null);
  const [buscou, setBuscou] = useState(false);

  const digitos = tel.replace(/\D/g, "").slice(0, 11);

  function buscar(digs: string) {
    if (digs.length < 10) return;
    setAgs(null);
    setBuscou(true);
    try { localStorage.setItem("cliente_tel", digs); } catch { /* ignore */ }
    fetch(`/api/agendamentos?slug=${slug}&tel=${encodeURIComponent(digs)}`)
      .then((r) => r.json())
      .then((d) => setAgs(d.agendamentos ?? []))
      .catch(() => setAgs([]));
  }

  // Busca automática se veio telefone pela query, senão tenta o último salvo.
  useEffect(() => {
    let inicial = telInicial || "";
    if (!inicial) {
      try { inicial = localStorage.getItem("cliente_tel") || ""; } catch { /* ignore */ }
      if (inicial) setTel(inicial);
    }
    if (inicial.length >= 10) buscar(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nomeUnidade = (id: string) => unidades.find((u) => u.id === id)?.nome ?? "";
  const nomeProf = (id: string) => (id === "p-any" ? "Primeiro disponível" : profissionais.find((p) => p.id === id)?.nome ?? "");
  const nomesServ = (ids: string[]) => servicos.filter((s) => ids.includes(s.id)).map((s) => s.nome).join(" + ");

  return (
    <div className="app" style={{ ["--brass" as any]: branding.cor, ["--brass-soft" as any]: `color-mix(in srgb, ${branding.cor} 72%, white)` }}>
      <div className="topbar">
        <div className="row">
          <button className="iconbtn" onClick={() => router.push("/")} aria-label="Voltar">‹</button>
          <div className="grow">
            <div className="crumb">{branding.nome}</div>
            <div className="steptitle">Meus agendamentos</div>
          </div>
        </div>
      </div>

      <div className="body">
        <div className="field">
          <label>Seu telefone</label>
          <input
            value={maskTel(digitos)}
            onChange={(e) => setTel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar(digitos)}
            placeholder="(51) 99999-9999"
            inputMode="tel"
            autoComplete="tel"
          />
        </div>
        <div style={{ height: 10 }} />
        <button className="cta ghost" onClick={() => buscar(digitos)} disabled={digitos.length < 10}>Buscar</button>

        <div style={{ height: 8 }} />
        {ags === null && buscou ? (
          <div className="empty">Carregando…</div>
        ) : ags && buscou && ags.length === 0 ? (
          <div className="empty">Nenhum agendamento encontrado para este telefone.</div>
        ) : ags && ags.length > 0 ? (
          ags.map((a) => {
            const p = partesData(a.inicio.slice(0, 10));
            const hora = a.inicio.slice(11, 16);
            return (
              <div key={a.id} className="booking">
                <div className="when">
                  <div className="wd">{p.dia}</div>
                  <div className="wm">{p.mes}</div>
                  <div className="wt">{hora}</div>
                </div>
                <div className="grow">
                  <h3>{nomesServ(a.servicoIds)} · {nomeProf(a.profissionalId)}</h3>
                  <div className="bs">{nomeUnidade(a.unidadeId)}</div>
                  <span className="tag">● {a.status === "confirmado" ? "Confirmado" : a.status}</span>
                </div>
              </div>
            );
          })
        ) : null}
      </div>

      <div className="foot">
        <div className="stack">
          <button className="cta" onClick={() => router.push("/agendar")}>Novo agendamento</button>
        </div>
      </div>
    </div>
  );
}
