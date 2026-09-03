import type {
  Agendamento,
  Branding,
  NovoAgendamento,
  Pagamento,
  Profissional,
  Servico,
  StatusAgendamento,
  Unidade,
} from "./types";
import {
  agendamentosSeed,
  brandings,
  profissionais as profsMock,
  servicos as servsMock,
  unidades as unidsMock,
} from "./mock";
import { getSupabase } from "./supabaseClient";
import { horaParaMin } from "./slots";
import { hojeBrasilISO } from "./tz";

// ---------------------------------------------------------------------------
// Camada de acesso a dados.
// Se o Supabase estiver configurado, lê/grava lá; caso contrário, usa o mock.
// Mantém a mesma assinatura para os dois caminhos, então as páginas e rotas
// não precisam saber qual está ativo.
// ---------------------------------------------------------------------------

// Store em memória para agendamentos criados no modo mock.
// (Não persiste entre reinícios do servidor — no Supabase isso vira uma tabela.)
const criadosMock: Agendamento[] = [];

// Mudanças feitas pelo admin no modo mock (por id). Permite alterar tanto os
// agendamentos criados quanto os de seed sem um banco.
const statusOverrides: Record<string, StatusAgendamento> = {};
const servicoOverrides: Record<string, string[]> = {};
const pagamentoOverrides: Record<string, Pagamento[]> = {};

// Recalcula duração e preço totais a partir dos serviços escolhidos.
function recalcServicos(slug: string, servicoIds: string[]) {
  const servs = servsMock.filter((s) => s.slug === slug && servicoIds.includes(s.id));
  return {
    duracaoMin: servs.reduce((a, s) => a + s.duracaoMin, 0),
    preco: servs.reduce((a, s) => a + s.preco, 0),
  };
}

// Sentinela do profissional "sem preferência".
export const SEM_PREFERENCIA = "p-any";

// Resolve marcadores de seed ("SEED_HOJE_T09:30") para a data de hoje.
function resolveInicioSeed(inicio: string): string {
  const m = inicio.match(/^SEED_HOJE_T(\d{2}:\d{2})$/);
  if (!m) return inicio;
  const hoje = hojeBrasilISO();
  return `${hoje}T${m[1]}:00`;
}

export function getBranding(slug: string): Branding | null {
  return brandings.find((b) => b.slug === slug) ?? null;
}

export function getUnidades(slug: string): Unidade[] {
  return unidsMock.filter((u) => u.slug === slug);
}

export function getServicos(slug: string): Servico[] {
  return servsMock.filter((s) => s.slug === slug);
}

// Profissionais do tenant, opcionalmente filtrados por unidade e serviço.
export function getProfissionais(
  slug: string,
  unidadeId?: string,
  servicoIds?: string[],
): Profissional[] {
  return profsMock.filter((p) => {
    if (p.slug !== slug) return false;
    if (unidadeId && !p.unidades.includes(unidadeId)) return false;
    if (servicoIds && servicoIds.length && p.servicos.length) {
      // p.servicos === [] significa "faz todos"; senão precisa cobrir os pedidos.
      const cobre = servicoIds.every((s) => p.servicos.includes(s));
      if (!cobre) return false;
    }
    return true;
  });
}

// Todos os agendamentos do tenant (seed + criados), com datas resolvidas e
// os status sobrescritos pelo admin aplicados. Sem filtrar por status.
function todosAgendamentos(slug: string): Agendamento[] {
  const seed = agendamentosSeed
    .filter((a) => a.slug === slug)
    .map((a) => ({ ...a, inicio: resolveInicioSeed(a.inicio) }));
  return [...seed, ...criadosMock.filter((a) => a.slug === slug)].map((a) => {
    const servicoIds = servicoOverrides[a.id] ?? a.servicoIds;
    const recalc = servicoOverrides[a.id] ? recalcServicos(slug, servicoIds) : { duracaoMin: a.duracaoMin, preco: a.preco };
    const pagamentos = pagamentoOverrides[a.id] ?? a.pagamentos;
    return {
      ...a,
      servicoIds,
      duracaoMin: recalc.duracaoMin,
      preco: recalc.preco,
      status: statusOverrides[a.id] ?? a.status,
      pagamentos,
      pago: pagamentos ? true : a.pago,
    };
  });
}

// Só os ativos (confirmados) — usado pela grade de horários e pela consulta
// do cliente. Cancelados/concluídos não ocupam vaga nem aparecem para o cliente.
function agendamentosAtivos(slug: string): Agendamento[] {
  return todosAgendamentos(slug).filter((a) => a.status === "confirmado");
}

// Intervalos ocupados (em minutos desde 00:00) de um profissional, numa unidade,
// num dia. Usado por gerarSlots() para desabilitar horários.
export function getOcupados(
  slug: string,
  unidadeId: string,
  profissionalId: string,
  dataISO: string,
): { inicioMin: number; fimMin: number }[] {
  // "Sem preferência": assumimos que sempre há algum barbeiro livre.
  if (profissionalId === SEM_PREFERENCIA) return [];

  return agendamentosAtivos(slug)
    .filter(
      (a) =>
        a.unidadeId === unidadeId &&
        a.profissionalId === profissionalId &&
        a.inicio.slice(0, 10) === dataISO,
    )
    .map((a) => {
      const inicioMin = horaParaMin(a.inicio.slice(11, 16));
      return { inicioMin, fimMin: inicioMin + a.duracaoMin };
    });
}

export function getAgendamentosDoCliente(
  slug: string,
  clienteId: string,
): Agendamento[] {
  return agendamentosAtivos(slug)
    .filter((a) => a.clienteId === clienteId)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export type FiltrosAdmin = {
  dataISO?: string; // "YYYY-MM-DD"
  unidadeId?: string;
  profissionalId?: string;
  status?: StatusAgendamento;
};

// Lista TODOS os agendamentos do tenant conforme filtros (visão do admin).
export async function listarAgendamentos(
  slug: string,
  f: FiltrosAdmin = {},
): Promise<Agendamento[]> {
  const sb = getSupabase();
  if (sb) {
    let q = sb.from("agendamento").select("*").eq("slug", slug);
    if (f.unidadeId) q = q.eq("unidade_id", f.unidadeId);
    if (f.profissionalId) q = q.eq("profissional_id", f.profissionalId);
    if (f.status) q = q.eq("status", f.status);
    if (f.dataISO) q = q.gte("inicio", `${f.dataISO}T00:00:00`).lte("inicio", `${f.dataISO}T23:59:59`);
    const { data, error } = await q.order("inicio", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id, slug: r.slug, clienteId: r.cliente_id, clienteNome: r.cliente_nome,
      unidadeId: r.unidade_id, profissionalId: r.profissional_id, servicoIds: r.servico_ids,
      inicio: r.inicio, duracaoMin: r.duracao_min, preco: r.preco, status: r.status,
    }));
  }

  return todosAgendamentos(slug)
    .filter((a) => {
      if (f.unidadeId && a.unidadeId !== f.unidadeId) return false;
      if (f.profissionalId && a.profissionalId !== f.profissionalId) return false;
      if (f.status && a.status !== f.status) return false;
      if (f.dataISO && a.inicio.slice(0, 10) !== f.dataISO) return false;
      return true;
    })
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

// Muda o status de um agendamento (concluir, cancelar, reabrir).
export async function atualizarStatusAgendamento(
  id: string,
  status: StatusAgendamento,
): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("agendamento").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  statusOverrides[id] = status;
}

// Troca/acrescenta serviços de um agendamento e recalcula duração e preço.
export async function atualizarServicosAgendamento(
  slug: string,
  id: string,
  servicoIds: string[],
): Promise<{ duracaoMin: number; preco: number }> {
  const recalc = recalcServicos(slug, servicoIds);
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from("agendamento")
      .update({ servico_ids: servicoIds, duracao_min: recalc.duracaoMin, preco: recalc.preco })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return recalc;
  }
  servicoOverrides[id] = servicoIds;
  return recalc;
}

// Registra o pagamento feito no ato (uma ou duas formas) e conclui o atendimento.
export async function registrarPagamento(
  id: string,
  pagamentos: Pagamento[],
): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from("agendamento")
      .update({ pagamentos, pago: true, status: "concluido" })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  pagamentoOverrides[id] = pagamentos;
  statusOverrides[id] = "concluido";
}

// Cria um agendamento. No mock, empurra para o store em memória.
// No Supabase, insere na tabela `agendamento`.
export async function criarAgendamento(
  novo: NovoAgendamento,
): Promise<Agendamento> {
  const servs = getServicos(novo.slug).filter((s) =>
    novo.servicoIds.includes(s.id),
  );
  const duracaoMin = servs.reduce((acc, s) => acc + s.duracaoMin, 0);
  const preco = servs.reduce((acc, s) => acc + s.preco, 0);
  const inicio = `${novo.dataISO}T${novo.hora}:00`;

  const registro: Agendamento = {
    id: `a-${Date.now()}`,
    slug: novo.slug,
    clienteId: novo.clienteId,
    clienteNome: novo.clienteNome,
    unidadeId: novo.unidadeId,
    profissionalId: novo.profissionalId,
    servicoIds: novo.servicoIds,
    inicio,
    duracaoMin,
    preco,
    status: "confirmado",
  };

  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("agendamento")
      .insert({
        slug: registro.slug,
        cliente_id: registro.clienteId,
        cliente_nome: registro.clienteNome,
        unidade_id: registro.unidadeId,
        profissional_id: registro.profissionalId,
        servico_ids: registro.servicoIds,
        inicio: registro.inicio,
        duracao_min: registro.duracaoMin,
        preco: registro.preco,
        status: registro.status,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (data) registro.id = data.id;
    return registro;
  }

  criadosMock.push(registro);
  return registro;
}
