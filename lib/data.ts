import type {
  Agendamento,
  Branding,
  NovoAgendamento,
  Profissional,
  Servico,
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

// Todos os agendamentos ativos do tenant (seed + criados), com datas resolvidas.
function agendamentosAtivos(slug: string): Agendamento[] {
  const seed = agendamentosSeed
    .filter((a) => a.slug === slug)
    .map((a) => ({ ...a, inicio: resolveInicioSeed(a.inicio) }));
  return [...seed, ...criadosMock.filter((a) => a.slug === slug)].filter(
    (a) => a.status === "confirmado",
  );
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
