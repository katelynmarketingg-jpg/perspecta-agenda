"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Branding,
  Profissional,
  Servico,
  Slot,
  Unidade,
} from "@/lib/types";
import { reais, partesData, dataLonga } from "@/lib/format";

const SEM_PREFERENCIA = "p-any";
const FLOW = ["local", "prof", "serv", "dia", "hora", "resumo"] as const;
type Step = (typeof FLOW)[number];

const TITULOS: Record<Step, string> = {
  local: "Escolha o local",
  prof: "Escolha o profissional",
  serv: "Escolha o serviço",
  dia: "Escolha o dia",
  hora: "Escolha o horário",
  resumo: "Confirme os detalhes",
};

type Props = {
  slug: string;
  branding: Branding;
  unidades: Unidade[];
  profissionais: Profissional[];
  servicos: Servico[];
};

export default function BookingWizard({ slug, branding, unidades, profissionais, servicos }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"flow" | "ok">("flow");
  const [step, setStep] = useState<Step>("local");

  const [localId, setLocalId] = useState("");
  const [profId, setProfId] = useState("");
  const [servIds, setServIds] = useState<string[]>([]);
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");

  // Identificação do cliente — pedida só no fim (etapa Resumo).
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState(""); // apenas dígitos

  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  // Pré-preenche com o último cliente deste dispositivo (conveniência).
  useEffect(() => {
    try {
      setNome(localStorage.getItem("cliente_nome") || "");
      setTelefone(localStorage.getItem("cliente_tel") || "");
    } catch { /* ignore */ }
  }, []);

  const telValido = telefone.length >= 10;
  const podeConfirmar = nome.trim().length >= 2 && telValido;

  // Seleções resolvidas em objetos --------------------------------------
  const unidade = unidades.find((u) => u.id === localId) || null;
  const profSel = profissionais.find((p) => p.id === profId) || null;
  const servSel = servicos.filter((s) => servIds.includes(s.id));
  const duracao = servSel.reduce((a, s) => a + s.duracaoMin, 0);
  const preco = servSel.reduce((a, s) => a + s.preco, 0);
  const profNome = profId === SEM_PREFERENCIA ? "Primeiro disponível" : profSel?.nome ?? "";

  // Listas derivadas ----------------------------------------------------
  const profsDaUnidade = useMemo(
    () => profissionais.filter((p) => !localId || p.unidades.includes(localId)),
    [profissionais, localId],
  );
  // Serviços que o profissional escolhido executa (vazio = faz todos).
  const servsDoProf = useMemo(() => {
    if (!profSel || profSel.servicos.length === 0) return servicos;
    return servicos.filter((s) => profSel.servicos.includes(s.id));
  }, [servicos, profSel]);

  const dias = useMemo(() => gerarDias(12), []);

  // Busca de horários ao entrar na etapa (ou mudar dependências) ---------
  useEffect(() => {
    if (step !== "hora" || !unidade || !dia || !duracao) return;
    setSlots(null);
    const params = new URLSearchParams({
      slug, unidade: unidade.id, prof: profId, data: dia, dur: String(duracao),
    });
    fetch(`/api/slots?${params}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []))
      .catch(() => setSlots([]));
  }, [step, slug, unidade, dia, duracao, profId]);

  // Progresso e navegação ----------------------------------------------
  const idx = FLOW.indexOf(step);

  const completo: Record<Step, boolean> = {
    local: !!localId,
    prof: !!profId,
    serv: servIds.length > 0,
    dia: !!dia,
    hora: !!hora,
    resumo: true,
  };

  function avancar() {
    if (step === "resumo") return confirmar();
    setStep(FLOW[idx + 1]);
  }
  function voltar() {
    if (phase === "ok") { setPhase("flow"); setStep("resumo"); return; }
    if (idx > 0) setStep(FLOW[idx - 1]);
    else router.push("/");
  }

  function toggleServ(id: string) {
    setServIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function escolherProf(id: string) {
    setProfId(id);
    setServIds([]); // reinicia serviços porque a lista depende do profissional
  }

  async function confirmar() {
    if (!podeConfirmar) return;
    setEnviando(true);
    setErro("");
    // O telefone (só dígitos) é a identidade do cliente; o nome é exibição.
    const clienteId = telefone;
    const clienteNome = nome.trim();
    try {
      localStorage.setItem("cliente_nome", clienteNome);
      localStorage.setItem("cliente_tel", telefone);
    } catch { /* ignore */ }

    try {
      const r = await fetch("/api/agendamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, clienteId, clienteNome,
          unidadeId: localId, profissionalId: profId,
          servicoIds: servIds, dataISO: dia, hora,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.erro || "Não foi possível confirmar.");
      }
      setPhase("ok");
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  // ---------------------------------------------------------------- render
  return (
    <div className="app" style={{ ["--brass" as any]: branding.cor, ["--brass-soft" as any]: `color-mix(in srgb, ${branding.cor} 72%, white)` }}>
      <div className="topbar">
        <div className="row">
          <button className="iconbtn" onClick={voltar} aria-label="Voltar">‹</button>
          <div className="grow">
            <div className="crumb">
              {phase === "ok" ? branding.nome : `Etapa ${idx + 1} de 6`}
            </div>
            <div className="steptitle">
              {phase === "ok" ? "Tudo certo" : TITULOS[step]}
            </div>
          </div>
          <ThemeToggle />
        </div>
        {phase === "flow" && (
          <div className="progress">
            {FLOW.map((_, i) => (
              <i key={i} className={i < idx ? "done" : i === idx ? "now" : ""} />
            ))}
          </div>
        )}
      </div>

      <div className="body">
        {phase === "ok" ? (
          <Confirmacao
            profNome={profNome}
            dataISO={dia}
            hora={hora}
          />
        ) : step === "local" ? (
          unidades.map((u) => (
            <button key={u.id} className={"card" + (localId === u.id ? " sel" : "")} onClick={() => setLocalId(u.id)}>
              <span className="pin">📍</span>
              <span className="grow">
                <h3>{u.nome}</h3>
                <span className="sub">{u.endereco} · {u.distanciaKm} km · abre {u.abreHora}h–{u.fechaHora}h</span>
              </span>
              <span className="check" />
            </button>
          ))
        ) : step === "prof" ? (
          <>
            {profsDaUnidade.map((p) => (
              <button key={p.id} className={"card" + (profId === p.id ? " sel" : "")} onClick={() => escolherProf(p.id)}>
                <span className="avatar" style={{ background: p.cor }}>{p.iniciais}</span>
                <span className="grow">
                  <h3>{p.nome}</h3>
                  <span className="sub">{p.especialidade}</span>
                  <span className="stars">{"★".repeat(Math.round(p.rating))} {p.rating.toFixed(1)} · {p.avaliacoes} avaliações</span>
                </span>
                <span className="check" />
              </button>
            ))}
            <button className={"card" + (profId === SEM_PREFERENCIA ? " sel" : "")} onClick={() => escolherProf(SEM_PREFERENCIA)}>
              <span className="avatar" style={{ background: "var(--elevated)", color: "var(--brass)" }}>✦</span>
              <span className="grow">
                <h3>Sem preferência</h3>
                <span className="sub">Pega o primeiro barbeiro livre — costuma abrir mais horários</span>
              </span>
              <span className="check" />
            </button>
          </>
        ) : step === "serv" ? (
          <>
            <div className="slots-note">Toque em um ou mais serviços — a duração soma e ajusta os horários.</div>
            {servsDoProf.map((s) => (
              <button key={s.id} className={"card" + (servIds.includes(s.id) ? " sel" : "")} onClick={() => toggleServ(s.id)}>
                <span className="grow">
                  <h3>{s.nome}</h3>
                  <span className="dur">{s.duracaoMin} min{s.descricao ? ` · ${s.descricao}` : ""}</span>
                </span>
                <span className="price">{reais(s.preco)}</span>
                <span className="check" />
              </button>
            ))}
          </>
        ) : step === "dia" ? (
          <>
            <div className="crumb" style={{ marginBottom: 12 }}>Toque para escolher o dia</div>
            <div className="days">
              {dias.map((d) => (
                <button
                  key={d.iso}
                  className={"day" + (dia === d.iso ? " sel" : "") + (d.off ? " off" : "")}
                  disabled={d.off}
                  onClick={() => !d.off && setDia(d.iso)}
                >
                  <div className="dow">{d.dow}</div>
                  <div className="dnum">{d.dia}</div>
                  <div className="dmo">{d.mes}</div>
                </button>
              ))}
            </div>
            <div className="pill"><span className="dot" /> Domingos e dias sem vaga aparecem em cinza</div>
          </>
        ) : step === "hora" ? (
          <SlotGrid slots={slots} horaSel={hora} onPick={setHora} />
        ) : (
          <Resumo
            branding={branding}
            localNome={unidade?.nome ?? ""}
            profNome={profNome}
            servTxt={servSel.map((s) => s.nome).join(" + ")}
            duracao={duracao}
            dataISO={dia}
            hora={hora}
            preco={preco}
            erro={erro}
            nome={nome}
            telefone={telefone}
            onNome={setNome}
            onTelefone={(v) => setTelefone(soDigitos(v).slice(0, 11))}
          />
        )}
      </div>

      <div className="foot">
        <div className="stack">
          {phase === "ok" ? (
            <button className="cta" onClick={() => router.push("/meus")}>Ver meus agendamentos</button>
          ) : step === "resumo" ? (
            <button className="cta" onClick={confirmar} disabled={enviando || !podeConfirmar}>
              {enviando ? "Confirmando…" : "Confirmar agendamento"}
            </button>
          ) : (
            <button className="cta" onClick={avancar} disabled={!completo[step]}>Continuar</button>
          )}
        </div>
        {phase === "flow" && step === "serv" && servIds.length > 0 && (
          <div className="hint">{duracao} min no total</div>
        )}
      </div>
    </div>
  );
}

// --- subcomponentes --------------------------------------------------------

function SlotGrid({ slots, horaSel, onPick }: { slots: Slot[] | null; horaSel: string; onPick: (h: string) => void }) {
  if (slots === null) return <div className="empty">Carregando horários…</div>;
  if (slots.length === 0) return <div className="empty">Sem horários para este dia.</div>;
  const am = slots.filter((s) => s.hora < "13:00");
  const pm = slots.filter((s) => s.hora >= "13:00");
  const bloco = (arr: Slot[]) => (
    <div className="grid">
      {arr.map((s) => (
        <button
          key={s.hora}
          className={"slot" + (!s.disponivel ? " busy" : "") + (horaSel === s.hora ? " sel" : "")}
          disabled={!s.disponivel}
          onClick={() => s.disponivel && onPick(s.hora)}
        >
          {s.hora}
        </button>
      ))}
    </div>
  );
  return (
    <>
      <div className="slots-note">
        <span className="swatch"><b style={{ background: "var(--brass)" }} /> livre</span>
        <span className="swatch"><b style={{ background: "var(--disabled-bg)", border: "1px dashed var(--faint)" }} /> ocupado</span>
      </div>
      {am.length > 0 && <><div className="period">Manhã</div>{bloco(am)}</>}
      {pm.length > 0 && <><div className="period">Tarde</div>{bloco(pm)}</>}
    </>
  );
}

function Resumo(props: {
  branding: Branding; localNome: string; profNome: string; servTxt: string;
  duracao: number; dataISO: string; hora: string; preco: number; erro: string;
  nome: string; telefone: string;
  onNome: (v: string) => void; onTelefone: (v: string) => void;
}) {
  return (
    <>
      <div className="ticket">
        <div className="thead">
          <div className="k">Confira seu agendamento</div>
          <h2>{props.profNome}</h2>
        </div>
        <div className="lines">
          <div className="li"><span className="lk">Local</span><span className="lv">{props.localNome}</span></div>
          <div className="li"><span className="lk">Serviço</span><span className="lv">{props.servTxt}<small>{props.duracao} min</small></span></div>
          <div className="li"><span className="lk">Data</span><span className="lv">{props.dataISO ? dataLonga(props.dataISO) : "—"}</span></div>
          <div className="li"><span className="lk">Horário</span><span className="lv">{props.hora}</span></div>
        </div>
        <div className="total"><span>Total · pagamento no local</span><b>{reais(props.preco)}</b></div>
      </div>

      {/* Identificação — só aqui no fim, sem login */}
      <div className="period">Seus dados</div>
      <div className="field">
        <label>Nome</label>
        <input value={props.nome} onChange={(e) => props.onNome(e.target.value)} placeholder="Como te chamamos?" autoComplete="name" />
      </div>
      <div className="field">
        <label>Telefone (WhatsApp)</label>
        <input value={maskTel(props.telefone)} onChange={(e) => props.onTelefone(e.target.value)} placeholder="(51) 99999-9999" inputMode="tel" autoComplete="tel" />
      </div>

      <div className="pill"><span className="dot" /> Você paga na barbearia — nada é cobrado agora</div>
      {props.erro && <div className="pill" style={{ color: "#e08a7a" }}>{props.erro}</div>}
    </>
  );
}

// Só os dígitos de um texto.
function soDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

// Formata dígitos como telefone BR: (99) 99999-9999 ou (99) 9999-9999.
function maskTel(digs: string): string {
  const d = digs.slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function Confirmacao({ profNome, dataISO, hora }: { profNome: string; dataISO: string; hora: string }) {
  return (
    <div className="confirm">
      <div className="seal">✓</div>
      <h2>Horário garantido!</h2>
      <p>{dataISO ? `Te esperamos ${dataLonga(dataISO)} às ${hora}, com ${profNome}.` : ""}</p>
      <div className="reminders">
        <div className="rem">
          <div className="ri">💬</div>
          <div><div className="rt">Lembrete no WhatsApp</div><div className="rs">Confirmação agora e um aviso 2h antes</div></div>
        </div>
        <div className="rem">
          <div className="ri">✉️</div>
          <div><div className="rt">E-mail com os detalhes</div><div className="rs">Endereço, mapa e opção de reagendar</div></div>
        </div>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(true);
  function toggle() {
    const root = document.documentElement;
    const next = !dark;
    root.setAttribute("data-theme", next ? "dark" : "light");
    setDark(next);
  }
  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Alternar tema">
      {dark ? "☾" : "☀"}
    </button>
  );
}

// Gera os próximos N dias a partir de hoje (domingos desabilitados).
// Usa componentes locais (não toISOString, que é UTC e poderia pular um dia à noite).
function gerarDias(n: number) {
  const out: { iso: string; dow: string; dia: number; mes: string; off: boolean }[] = [];
  const hoje = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const p = partesData(iso);
    out.push({ iso, dow: p.dow, dia: p.dia, mes: p.mes, off: d.getDay() === 0 });
  }
  return out;
}
