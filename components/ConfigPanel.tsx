"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Branding, Profissional, Servico, Unidade } from "@/lib/types";
import { reais } from "@/lib/format";

type Sub = "marca" | "servicos" | "combos" | "profissionais";
const CORES = ["#c9974e", "#c0392b", "#2e6fb5", "#3f8f63", "#7d5ba6"];

export default function ConfigPanel({ branding, unidades }: { branding: Branding; unidades: Unidade[] }) {
  const router = useRouter();
  const [sub, setSub] = useState<Sub>("marca");

  return (
    <>
      <div className="viewseg" style={{ flexWrap: "wrap" }}>
        <button className={sub === "marca" ? "on" : ""} onClick={() => setSub("marca")}>Marca</button>
        <button className={sub === "servicos" ? "on" : ""} onClick={() => setSub("servicos")}>Serviços</button>
        <button className={sub === "combos" ? "on" : ""} onClick={() => setSub("combos")}>Combos</button>
        <button className={sub === "profissionais" ? "on" : ""} onClick={() => setSub("profissionais")}>Profissionais</button>
      </div>

      {sub === "marca" && <Marca inicial={branding} onSaved={() => router.refresh()} />}
      {sub === "servicos" && <Servicos />}
      {sub === "combos" && <Combos />}
      {sub === "profissionais" && <Profissionais unidades={unidades} />}
    </>
  );
}

// ---- Marca -----------------------------------------------------------------
function Marca({ inicial, onSaved }: { inicial: Branding; onSaved: () => void }) {
  const [nome, setNome] = useState(inicial.nome);
  const [simbolo, setSimbolo] = useState(inicial.simbolo);
  const [cor, setCor] = useState(inicial.cor);
  const [salvo, setSalvo] = useState(false);
  const soft = `color-mix(in srgb, ${cor} 72%, white)`;

  async function salvar() {
    await fetch("/api/admin/config/marca", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome, simbolo, cor }) });
    setSalvo(true); setTimeout(() => setSalvo(false), 2000);
    onSaved();
  }

  return (
    <div style={{ ["--brass" as any]: cor, ["--brass-soft" as any]: soft }}>
      <div className="field"><label>Nome do app</label><input value={nome} maxLength={18} onChange={(e) => setNome(e.target.value)} /></div>
      <div className="field"><label>Símbolo (emoji)</label><input value={simbolo} maxLength={2} onChange={(e) => setSimbolo(e.target.value)} style={{ textAlign: "center", fontSize: 20 }} /></div>
      <div className="field"><label>Cor de destaque</label>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
          {CORES.map((c) => <button key={c} onClick={() => setCor(c)} aria-label={c} style={{ width: 34, height: 34, borderRadius: 10, background: c, cursor: "pointer", border: cor === c ? "2px solid var(--ink)" : "2px solid transparent" }} />)}
          <label style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", border: "1px dashed var(--line-strong)", cursor: "pointer", position: "relative", color: "var(--muted)" }}>+
            <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
          </label>
        </div>
      </div>
      <div className="adm-sec">Preview</div>
      <div className="ticket">
        <div className="login-hero" style={{ padding: "26px 0 18px" }}>
          <div className="logo"><span className="stroke">{simbolo}</span> {nome || "Barbearia"}</div>
          <div className="tagline">{inicial.tagline}</div>
        </div>
        <div style={{ padding: "0 18px 18px" }}><button className="cta">Agendar</button></div>
      </div>
      <div style={{ height: 12 }} />
      <button className="cta" onClick={salvar}>{salvo ? "Salvo ✓" : "Salvar marca"}</button>
    </div>
  );
}

// ---- Serviços --------------------------------------------------------------
function Servicos() {
  const [lista, setLista] = useState<Servico[] | null>(null);
  const [nome, setNome] = useState("");
  const [dur, setDur] = useState("");
  const [preco, setPreco] = useState("");

  const carregar = useCallback(() => {
    fetch("/api/admin/config/servicos").then((r) => r.json()).then((d) => setLista(d.servicos ?? [])).catch(() => setLista([]));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar() {
    if (!nome || !(Number(dur) > 0) || !(Number(preco) >= 0)) return;
    await fetch("/api/admin/config/servicos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome, duracaoMin: Number(dur), preco: Number(preco) }) });
    setNome(""); setDur(""); setPreco(""); carregar();
  }
  async function patch(id: string, body: any) { await fetch(`/api/admin/config/servicos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); carregar(); }
  async function excluir(id: string) { if (!confirm("Excluir este serviço?")) return; await fetch(`/api/admin/config/servicos/${id}`, { method: "DELETE" }); carregar(); }

  const servicos = (lista ?? []).filter((s) => !s.combo);

  return (
    <>
      <div className="adm-sec">Novo serviço</div>
      <div className="despesa-form">
        <div className="field full"><label>Nome</label><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Corte infantil" /></div>
        <div className="field"><label>Duração (min)</label><input inputMode="numeric" value={dur} onChange={(e) => setDur(e.target.value.replace(/\D/g, ""))} /></div>
        <div className="field"><label>Preço (R$)</label><input inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value.replace(/[^\d.]/g, ""))} /></div>
        <div className="field full"><button className="cta" onClick={adicionar} disabled={!nome || !(Number(dur) > 0)}>Adicionar serviço</button></div>
      </div>

      <div className="adm-sec">Serviços</div>
      {lista === null ? <div className="empty">Carregando…</div> : servicos.length === 0 ? <div className="empty">Nenhum serviço.</div> : servicos.map((s) => (
        <div key={s.id} className="fin-row" style={{ opacity: s.ativo === false ? 0.5 : 1 }}>
          <span style={{ flex: 1 }}>
            <span className="fl">{s.nome}</span>
            <span className="fsub" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <input defaultValue={s.duracaoMin} inputMode="numeric" onBlur={(e) => patch(s.id, { duracaoMin: Number(e.target.value) })} style={inp} /> min ·
              R$ <input defaultValue={s.preco} inputMode="decimal" onBlur={(e) => patch(s.id, { preco: Number(e.target.value) })} style={inp} />
            </span>
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            <button className="minibtn" onClick={() => patch(s.id, { ativo: s.ativo === false })}>{s.ativo === false ? "Ativar" : "Desativar"}</button>
            <button className="minibtn danger" onClick={() => excluir(s.id)}>Excluir</button>
          </span>
        </div>
      ))}
    </>
  );
}

// ---- Combos ----------------------------------------------------------------
function Combos() {
  const [lista, setLista] = useState<Servico[] | null>(null);
  const [nome, setNome] = useState("");
  const [itens, setItens] = useState<string[]>([]);
  const [preco, setPreco] = useState("");

  const carregar = useCallback(() => {
    fetch("/api/admin/config/servicos").then((r) => r.json()).then((d) => setLista(d.servicos ?? [])).catch(() => setLista([]));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const base = (lista ?? []).filter((s) => !s.combo);
  const combos = (lista ?? []).filter((s) => s.combo);
  const selecionados = base.filter((s) => itens.includes(s.id));
  const somaPreco = selecionados.reduce((a, s) => a + s.preco, 0);
  const somaDur = selecionados.reduce((a, s) => a + s.duracaoMin, 0);

  async function criar() {
    if (!nome || itens.length < 2 || !(Number(preco) > 0)) return;
    await fetch("/api/admin/config/servicos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome, duracaoMin: somaDur, preco: Number(preco), combo: true, itens }) });
    setNome(""); setItens([]); setPreco(""); carregar();
  }
  async function excluir(id: string) { if (!confirm("Excluir este combo?")) return; await fetch(`/api/admin/config/servicos/${id}`, { method: "DELETE" }); carregar(); }

  return (
    <>
      <div className="adm-sec">Novo combo</div>
      <div className="field"><label>Nome do combo</label><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Dia do noivo" /></div>
      <div className="slots-note" style={{ marginTop: 10 }}>Escolha 2+ serviços que compõem o combo:</div>
      {base.map((s) => (
        <button key={s.id} className={"card" + (itens.includes(s.id) ? " sel" : "")} onClick={() => setItens((p) => p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id])}>
          <span className="grow"><h3>{s.nome}</h3><span className="dur">{s.duracaoMin} min</span></span>
          <span className="price">{reais(s.preco)}</span><span className="check" />
        </button>
      ))}
      {itens.length >= 2 && (
        <>
          <div className="pay-status"><span>{somaDur} min · avulso {reais(somaPreco)}</span><b>preço exclusivo</b></div>
          <div className="field"><label>Preço do combo (R$)</label><input inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value.replace(/[^\d.]/g, ""))} placeholder={String(somaPreco)} /></div>
          <button className="cta" onClick={criar} disabled={!nome || !(Number(preco) > 0)}>Criar combo</button>
        </>
      )}

      <div className="adm-sec">Combos</div>
      {lista === null ? <div className="empty">Carregando…</div> : combos.length === 0 ? <div className="empty">Nenhum combo ainda.</div> : combos.map((c) => (
        <div key={c.id} className="fin-row">
          <span><span className="fl">{c.nome}</span><span className="fsub">{(c.itens ?? []).length} serviços · {c.duracaoMin} min</span></span>
          <span style={{ display: "flex", gap: 10, alignItems: "center" }}><span className="fv">{reais(c.preco)}</span><button className="minibtn danger" onClick={() => excluir(c.id)}>Excluir</button></span>
        </div>
      ))}
    </>
  );
}

// ---- Profissionais ---------------------------------------------------------
function Profissionais({ unidades }: { unidades: Unidade[] }) {
  const [lista, setLista] = useState<Profissional[] | null>(null);
  const [nome, setNome] = useState("");
  const [esp, setEsp] = useState("");
  const [comissao, setComissao] = useState("");
  const [pin, setPin] = useState("");

  const carregar = useCallback(() => {
    fetch("/api/admin/config/profissionais").then((r) => r.json()).then((d) => setLista(d.profissionais ?? [])).catch(() => setLista([]));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar() {
    if (!nome) return;
    await fetch("/api/admin/config/profissionais", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome, especialidade: esp, comissao: Number(comissao) || 0, pin: pin || undefined, unidades: unidades.map((u) => u.id) }) });
    setNome(""); setEsp(""); setComissao(""); setPin(""); carregar();
  }
  async function patch(id: string, body: any) { await fetch(`/api/admin/config/profissionais/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); carregar(); }
  async function excluir(id: string) { if (!confirm("Remover este profissional?")) return; await fetch(`/api/admin/config/profissionais/${id}`, { method: "DELETE" }); carregar(); }

  return (
    <>
      <div className="adm-sec">Novo profissional</div>
      <div className="despesa-form">
        <div className="field full"><label>Nome</label><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do barbeiro" /></div>
        <div className="field full"><label>Especialidade</label><input value={esp} onChange={(e) => setEsp(e.target.value)} placeholder="Ex.: Degradê · barba" /></div>
        <div className="field"><label>Comissão (%)</label><input inputMode="numeric" value={comissao} onChange={(e) => setComissao(e.target.value.replace(/\D/g, ""))} /></div>
        <div className="field"><label>PIN de acesso</label><input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="4 dígitos" /></div>
        <div className="field full"><button className="cta" onClick={adicionar} disabled={!nome}>Cadastrar profissional</button></div>
      </div>

      <div className="adm-sec">Profissionais</div>
      {lista === null ? <div className="empty">Carregando…</div> : (lista ?? []).length === 0 ? <div className="empty">Nenhum profissional.</div> : (lista ?? []).map((p) => (
        <div key={p.id} className="fin-row">
          <span style={{ flex: 1 }}>
            <span className="fl">{p.nome}</span>
            <span className="fsub" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
              {p.especialidade || "—"} · comissão <input defaultValue={p.comissao ?? 0} inputMode="numeric" onBlur={(e) => patch(p.id, { comissao: Number(e.target.value) })} style={inp} />% · PIN <input defaultValue={p.pin ?? ""} inputMode="numeric" onBlur={(e) => patch(p.id, { pin: e.target.value })} style={{ ...inp, width: 52 }} />
            </span>
          </span>
          <button className="minibtn danger" onClick={() => excluir(p.id)}>Remover</button>
        </div>
      ))}
    </>
  );
}

const inp: React.CSSProperties = { width: 46, background: "var(--elevated)", border: "1px solid var(--line)", borderRadius: 7, padding: "3px 6px", color: "var(--ink)", fontFamily: "var(--mono)", fontSize: 12 };
