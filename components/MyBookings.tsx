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
};

export default function MyBookings({ slug, branding, unidades, profissionais, servicos }: Props) {
  const router = useRouter();
  const [ags, setAgs] = useState<Agendamento[] | null>(null);

  useEffect(() => {
    let clienteId = "";
    try { clienteId = localStorage.getItem("cliente_id") || ""; } catch { /* ignore */ }
    if (!clienteId) { setAgs([]); return; }
    fetch(`/api/agendamentos?slug=${slug}&cliente=${encodeURIComponent(clienteId)}`)
      .then((r) => r.json())
      .then((d) => setAgs(d.agendamentos ?? []))
      .catch(() => setAgs([]));
  }, [slug]);

  const nomeUnidade = (id: string) => unidades.find((u) => u.id === id)?.nome ?? "";
  const nomeProf = (id: string) => (id === "p-any" ? "Primeiro disponível" : profissionais.find((p) => p.id === id)?.nome ?? "");
  const nomesServ = (ids: string[]) => servicos.filter((s) => ids.includes(s.id)).map((s) => s.nome).join(" + ");

  return (
    <div className="app" style={{ ["--brass" as any]: branding.cor, ["--brass-soft" as any]: `color-mix(in srgb, ${branding.cor} 72%, white)` }}>
      <div className="topbar">
        <div className="row">
          <button className="iconbtn" onClick={() => router.push("/agendar")} aria-label="Voltar">‹</button>
          <div className="grow">
            <div className="crumb">{branding.nome}</div>
            <div className="steptitle">Meus agendamentos</div>
          </div>
        </div>
      </div>

      <div className="body">
        {ags === null ? (
          <div className="empty">Carregando…</div>
        ) : ags.length === 0 ? (
          <div className="empty">Você ainda não tem agendamentos.</div>
        ) : (
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
        )}
      </div>

      <div className="foot">
        <div className="stack">
          <button className="cta ghost" onClick={() => router.push("/agendar")}>Novo agendamento</button>
        </div>
      </div>
    </div>
  );
}
