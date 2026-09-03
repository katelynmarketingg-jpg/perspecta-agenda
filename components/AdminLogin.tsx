"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Branding } from "@/lib/types";

// Entrada do admin por PIN. Ao acertar, o cookie é setado e a página recarrega
// mostrando o painel.
export default function AdminLogin({ branding }: { branding: Branding }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar() {
    setEnviando(true);
    setErro("");
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!r.ok) throw new Error("PIN incorreto");
      router.refresh();
    } catch (e: any) {
      setErro(e.message);
      setEnviando(false);
    }
  }

  return (
    <div className="app" style={{ ["--brass" as any]: branding.cor, ["--brass-soft" as any]: `color-mix(in srgb, ${branding.cor} 72%, white)` }}>
      <div className="body">
        <div className="login-hero">
          <div className="logo"><span className="stroke">{branding.simbolo}</span> {branding.nome}</div>
          <div className="tagline">Painel · dono ou barbeiro</div>
        </div>

        <div className="field">
          <label>PIN de acesso</label>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entrar()}
            placeholder="••••"
            inputMode="numeric"
            autoFocus
          />
        </div>
        <div style={{ height: 10 }} />
        <button className="cta" onClick={entrar} disabled={enviando || pin.length < 3}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
        {erro && <div className="pill" style={{ color: "#e08a7a", marginTop: 14 }}>{erro}</div>}
      </div>

      <div className="foot">
        <div className="hint"><Link href="/" style={{ color: "var(--brass)" }}>‹ Voltar ao app</Link></div>
      </div>
    </div>
  );
}
