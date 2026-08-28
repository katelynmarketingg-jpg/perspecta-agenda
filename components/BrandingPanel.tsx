"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Branding } from "@/lib/types";

const CORES = ["#c9974e", "#c0392b", "#2e6fb5", "#3f8f63", "#7d5ba6"];

// Painel do dono: personaliza nome, símbolo e cor da barbearia, com preview
// ao vivo. No MVP salva em localStorage; em produção grava na tabela
// `barbearia` do Supabase (ver README) — cada tenant com o seu branding.
export default function BrandingPanel({ inicial }: { inicial: Branding }) {
  const router = useRouter();
  const [nome, setNome] = useState(inicial.nome);
  const [simbolo, setSimbolo] = useState(inicial.simbolo);
  const [cor, setCor] = useState(inicial.cor);
  const [salvo, setSalvo] = useState(false);

  const soft = `color-mix(in srgb, ${cor} 72%, white)`;

  function salvar() {
    try {
      localStorage.setItem("branding_override", JSON.stringify({ ...inicial, nome, simbolo, cor }));
    } catch { /* ignore */ }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2200);
  }

  return (
    <div className="app" style={{ ["--brass" as any]: cor, ["--brass-soft" as any]: soft }}>
      <div className="topbar">
        <div className="row">
          <button className="iconbtn" onClick={() => router.push("/login")} aria-label="Voltar">‹</button>
          <div className="grow">
            <div className="crumb">Painel do dono</div>
            <div className="steptitle">Personalizar a marca</div>
          </div>
        </div>
      </div>

      <div className="body">
        {/* Editor */}
        <div className="field">
          <label>Nome do app</label>
          <input value={nome} maxLength={18} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="field">
          <label>Símbolo / logo (emoji)</label>
          <input value={simbolo} maxLength={2} onChange={(e) => setSimbolo(e.target.value)} style={{ textAlign: "center", fontSize: 20 }} />
        </div>
        <div className="field">
          <label>Cor de destaque</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
            {CORES.map((c) => (
              <button
                key={c}
                onClick={() => setCor(c)}
                aria-label={`Cor ${c}`}
                style={{
                  width: 34, height: 34, borderRadius: 10, background: c, cursor: "pointer",
                  border: cor === c ? "2px solid var(--ink)" : "2px solid transparent",
                }}
              />
            ))}
            <label style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center",
              border: "1px dashed var(--line-strong)", cursor: "pointer", position: "relative", color: "var(--muted)" }}>
              +
              <input type="color" value={cor} onChange={(e) => setCor(e.target.value)}
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
            </label>
          </div>
        </div>

        {/* Preview ao vivo */}
        <div className="period">Preview</div>
        <div className="ticket">
          <div className="login-hero" style={{ padding: "28px 0 20px" }}>
            <div className="logo"><span className="stroke">{simbolo}</span> {nome || "Barbearia"}</div>
            <div className="tagline">{inicial.tagline}</div>
          </div>
          <div style={{ padding: "0 18px 18px" }}>
            <button className="cta">Entrar</button>
          </div>
        </div>
        <div className="hint" style={{ marginTop: 14, lineHeight: 1.5 }}>
          Nome, logo e cor valem para todas as unidades desta barbearia e aparecem
          no login, no fluxo, nos lembretes e no e-mail.
        </div>
      </div>

      <div className="foot">
        <div className="stack">
          <button className="cta" onClick={salvar}>{salvo ? "Salvo ✓" : "Salvar personalização"}</button>
        </div>
      </div>
    </div>
  );
}
