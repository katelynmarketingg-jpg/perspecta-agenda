"use client";

import { useMemo, useState } from "react";
import type { Agendamento, MetodoPagamento, Servico, StatusAgendamento } from "@/lib/types";
import { reais, dataLonga } from "@/lib/format";

type Aba = "atendimento" | "servicos" | "pagamento";
const METODOS: { v: MetodoPagamento; l: string }[] = [
  { v: "dinheiro", l: "Dinheiro" },
  { v: "cartao", l: "Cartão" },
  { v: "pix", l: "Pix" },
];
const LABEL_STATUS: Record<StatusAgendamento, string> = {
  confirmado: "Confirmado", cancelado: "Cancelado", concluido: "Concluído",
};

export default function AgendamentoModal({
  agendamento, servicos, profNome, onClose, onChanged,
}: {
  agendamento: Agendamento;
  servicos: Servico[];
  profNome: string;
  onClose: () => void;
  onChanged: () => void; // avisa o painel para recarregar a lista
}) {
  const a = agendamento;
  const [aba, setAba] = useState<Aba>("atendimento");
  const [salvando, setSalvando] = useState(false);

  // Serviços selecionados (edição)
  const [sel, setSel] = useState<string[]>(a.servicoIds);
  const selServ = servicos.filter((s) => sel.includes(s.id));
  const totalPreco = selServ.reduce((x, s) => x + s.preco, 0);
  const totalDur = selServ.reduce((x, s) => x + s.duracaoMin, 0);

  // Pagamento
  const [dividir, setDividir] = useState(false);
  const [m1, setM1] = useState<MetodoPagamento>("dinheiro");
  const [v1, setV1] = useState<string>(String(totalPreco));
  const [m2, setM2] = useState<MetodoPagamento>("pix");
  const [v2, setV2] = useState<string>("");

  const soma = (Number(v1) || 0) + (dividir ? Number(v2) || 0 : 0);
  const falta = Math.max(0, totalPreco - soma);
  const troco = Math.max(0, soma - totalPreco);
  const podePagar = soma >= totalPreco && (Number(v1) || 0) > 0 && (!dividir || (Number(v2) || 0) > 0);

  async function patch(body: any) {
    setSalvando(true);
    try {
      const r = await fetch(`/api/admin/agendamentos/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Falha");
      onChanged();
      return true;
    } catch {
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarAtendimento() { if (await patch({ status: "concluido" })) onClose(); }
  async function cancelar() {
    if (!window.confirm("Cancelar este agendamento?")) return;
    if (await patch({ status: "cancelado" })) onClose();
  }
  async function reabrir() { if (await patch({ status: "confirmado" })) onClose(); }
  async function salvarServicos() {
    if (sel.length === 0) return;
    await patch({ servicoIds: sel });
    // Atualiza o valor sugerido no pagamento e vai para a aba de pagamento.
    setV1(String(totalPreco));
    setAba("pagamento");
  }
  async function registrarPagamento() {
    const pags = [{ metodo: m1, valor: Number(v1) }];
    if (dividir) pags.push({ metodo: m2, valor: Number(v2) });
    if (await patch({ pagamentos: pags })) onClose();
  }

  const hora = a.inicio.slice(11, 16);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <div className="crumb">{dataLonga(a.inicio.slice(0, 10))} · {hora}</div>
            <h3>{a.clienteNome}</h3>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className="tabs">
          <button className={aba === "atendimento" ? "on" : ""} onClick={() => setAba("atendimento")}>Atendimento</button>
          <button className={aba === "servicos" ? "on" : ""} onClick={() => setAba("servicos")}>Serviços</button>
          <button className={aba === "pagamento" ? "on" : ""} onClick={() => setAba("pagamento")}>Pagamento</button>
        </div>

        <div className="modal-body">
          {aba === "atendimento" && (
            <>
              <div className="li"><span className="lk">Profissional</span><span className="lv">{profNome}</span></div>
              <div className="li"><span className="lk">Serviço</span><span className="lv">{selServ.map((s) => s.nome).join(" + ")}<small>{totalDur} min</small></span></div>
              <div className="li"><span className="lk">Status</span><span className="lv">{LABEL_STATUS[a.status]}</span></div>
              <div className="li"><span className="lk">Total</span><span className="lv">{reais(totalPreco)}</span></div>
              {a.pago && a.pagamentos && (
                <div className="pill" style={{ marginTop: 12 }}><span className="dot" /> Pago: {a.pagamentos.map((p) => `${reais(p.valor)} ${p.metodo}`).join(" + ")}</div>
              )}
              <div style={{ height: 14 }} />
              {a.status === "confirmado" ? (
                <>
                  <button className="cta" onClick={confirmarAtendimento} disabled={salvando}>Confirmar atendimento</button>
                  <div style={{ height: 10 }} />
                  <button className="cta ghost" onClick={cancelar} disabled={salvando}>Cancelar agendamento</button>
                </>
              ) : (
                <button className="cta ghost" onClick={reabrir} disabled={salvando}>Reabrir</button>
              )}
            </>
          )}

          {aba === "servicos" && (
            <>
              <div className="slots-note">Toque para trocar ou acrescentar serviços — o total recalcula.</div>
              {servicos.map((s) => (
                <button key={s.id} className={"card" + (sel.includes(s.id) ? " sel" : "")}
                  onClick={() => setSel((p) => p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id])}>
                  <span className="grow"><h3>{s.nome}</h3><span className="dur">{s.duracaoMin} min</span></span>
                  <span className="price">{reais(s.preco)}</span>
                  <span className="check" />
                </button>
              ))}
              <div className="pay-status"><span>{totalDur} min</span><b>{reais(totalPreco)}</b></div>
              <button className="cta" onClick={salvarServicos} disabled={salvando || sel.length === 0}>Salvar serviços</button>
            </>
          )}

          {aba === "pagamento" && (
            <>
              <div className="li"><span className="lk">Total a pagar</span><span className="lv">{reais(totalPreco)}</span></div>
              <div style={{ height: 8 }} />
              <div className="viewseg">
                <button className={!dividir ? "on" : ""} onClick={() => setDividir(false)}>Uma forma</button>
                <button className={dividir ? "on" : ""} onClick={() => { setDividir(true); setV1(String(Math.ceil(totalPreco / 2))); setV2(String(totalPreco - Math.ceil(totalPreco / 2))); }}>Dividir em duas</button>
              </div>

              <div className="pay-row">
                <div className="field"><label>Forma</label>
                  <select value={m1} onChange={(e) => setM1(e.target.value as MetodoPagamento)}>
                    {METODOS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                  </select>
                </div>
                <div className="field"><label>Valor (R$)</label>
                  <input inputMode="decimal" value={v1} onChange={(e) => setV1(e.target.value.replace(/[^\d.]/g, ""))} />
                </div>
              </div>

              {dividir && (
                <div className="pay-row">
                  <div className="field"><label>2ª forma</label>
                    <select value={m2} onChange={(e) => setM2(e.target.value as MetodoPagamento)}>
                      {METODOS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Valor (R$)</label>
                    <input inputMode="decimal" value={v2} onChange={(e) => setV2(e.target.value.replace(/[^\d.]/g, ""))} />
                  </div>
                </div>
              )}

              <div className="pay-status">
                <span>{falta > 0 ? `Falta ${reais(falta)}` : troco > 0 ? `Troco ${reais(troco)}` : "Fecha certo ✓"}</span>
                <b>{reais(soma)} / {reais(totalPreco)}</b>
              </div>
              <button className="cta" onClick={registrarPagamento} disabled={salvando || !podePagar}>
                Registrar pagamento e concluir
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
