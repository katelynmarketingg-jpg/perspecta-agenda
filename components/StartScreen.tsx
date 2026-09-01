"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Branding } from "@/lib/types";

// Tela inicial — sem login. Dois caminhos: agendar ou consultar por telefone.
export default function StartScreen({ branding }: { branding: Branding }) {
  const router = useRouter();
  const [tel, setTel] = useState("");

  const digitos = tel.replace(/\D/g, "").slice(0, 11);

  function maskTel(digs: string): string {
    const d = digs;
    if (d.length <= 2) return d ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  function consultar() {
    if (digitos.length < 10) return;
    router.push(`/meus?tel=${digitos}`);
  }

  return (
    <div className="app" style={{ ["--brass" as any]: branding.cor, ["--brass-soft" as any]: `color-mix(in srgb, ${branding.cor} 72%, white)` }}>
      <div className="body">
        <div className="login-hero">
          <div className="logo">
            <span className="stroke">{branding.simbolo}</span> {branding.nome}
          </div>
          <div className="tagline">{branding.tagline}</div>
        </div>

        <div style={{ height: 10 }} />
        <button className="cta" onClick={() => router.push("/agendar")}>Agendar horário</button>

        <div className="divider">já é cliente?</div>

        <div className="field">
          <label>Consulte seus agendamentos pelo telefone</label>
          <input
            value={maskTel(digitos)}
            onChange={(e) => setTel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && consultar()}
            placeholder="(51) 99999-9999"
            inputMode="tel"
            autoComplete="tel"
          />
        </div>
        <div style={{ height: 10 }} />
        <button className="cta ghost" onClick={consultar} disabled={digitos.length < 10}>
          Buscar meus agendamentos
        </button>
      </div>

      <div className="foot">
        <div className="hint">
          É o dono?{" "}
          <Link href="/config" style={{ color: "var(--brass)" }}>Personalizar a marca</Link>
        </div>
      </div>
    </div>
  );
}
