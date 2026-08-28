"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Branding } from "@/lib/types";

// Login do cliente (MVP): não valida senha de verdade — apenas identifica o
// cliente e segue para o fluxo. A autenticação real (Supabase Auth) entra depois.
export default function LoginForm({ branding }: { branding: Branding }) {
  const router = useRouter();
  const [email, setEmail] = useState("katelyn@email.com");

  function entrar() {
    const nome = email.split("@")[0] || "Cliente";
    try {
      localStorage.setItem("cliente_id", email.toLowerCase());
      localStorage.setItem("cliente_nome", nome.charAt(0).toUpperCase() + nome.slice(1));
    } catch {
      /* localStorage indisponível — segue mesmo assim */
    }
    router.push("/agendar");
  }

  return (
    <div className="body">
      <div className="login-hero">
        <div className="logo">
          <span className="stroke">{branding.simbolo}</span> {branding.nome}
        </div>
        <div className="tagline">{branding.tagline}</div>
      </div>

      <div className="field">
        <label>E-mail ou telefone</label>
        <input
          value={email}
          inputMode="email"
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Senha</label>
        <input type="password" defaultValue="senha123" />
      </div>

      <div className="oauth">
        <button type="button" onClick={entrar}>Entrar com Google</button>
        <button type="button" onClick={entrar}>Entrar com Apple</button>
      </div>

      <div style={{ height: 18 }} />
      <button className="cta" onClick={entrar}>Entrar</button>

      <div className="divider">novo por aqui?</div>
      <button className="cta ghost" onClick={entrar}>Criar conta em 30 segundos</button>
    </div>
  );
}
