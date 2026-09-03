import type {
  Agendamento,
  Branding,
  Despesa,
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
  const servs = baseServicos().filter((s) => s.slug === slug && servicoIds.includes(s.id));
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

// Stores mutáveis do catálogo (modo mock). Inicializam a partir do mock na
// primeira edição; enquanto null, lê-se direto do mock. (No Supabase, o CRUD
// grava nas tabelas — a persistência definitiva vem ao ligar o banco.)
let brandingsStore: Branding[] | null = null;
let servicosStore: Servico[] | null = null;
let profsStore: Profissional[] | null = null;
function baseBrandings(): Branding[] { return brandingsStore ?? brandings; }
function baseServicos(): Servico[] { return servicosStore ?? servsMock; }
function baseProfs(): Profissional[] { return profsStore ?? profsMock; }
function mutBrandings(): Branding[] { return (brandingsStore ??= brandings.map((b) => ({ ...b }))); }
function mutServicos(): Servico[] { return (servicosStore ??= servsMock.map((s) => ({ ...s }))); }
function mutProfs(): Profissional[] { return (profsStore ??= profsMock.map((p) => ({ ...p }))); }

export function getBranding(slug: string): Branding | null {
  return baseBrandings().find((b) => b.slug === slug) ?? null;
}

export function getUnidades(slug: string): Unidade[] {
  return unidsMock.filter((u) => u.slug === slug);
}

// Serviços que aparecem para o cliente (ativos). Combos entram normalmente.
export function getServicos(slug: string): Servico[] {
  return baseServicos().filter((s) => s.slug === slug && s.ativo !== false);
}

// Todos os serviços do tenant, inclusive inativos (para o painel de config).
export function getServicosAdmin(slug: string): Servico[] {
  return baseServicos().filter((s) => s.slug === slug);
}

// Profissionais do tenant, opcionalmente filtrados por unidade e serviço.
export function getProfissionais(
  slug: string,
  unidadeId?: string,
  servicoIds?: string[],
): Profissional[] {
  return baseProfs().filter((p) => {
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

// Usado pelo login por PIN (lib/admin) — considera barbeiros criados na config.
export function findProfissionalPorPin(slug: string, pin: string): Profissional | null {
  return baseProfs().find((p) => p.slug === slug && p.pin && p.pin === pin) ?? null;
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

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------

// Despesas em memória (modo mock). No Supabase, vira a tabela `despesa`.
const despesasMock: Despesa[] = [];

export type PeriodoFinanceiro = { de: string; ate: string; unidadeId?: string; profId?: string };

export type ResumoFinanceiro = {
  faturamento: number;
  atendimentos: number;
  ticketMedio: number;
  porForma: { dinheiro: number; cartao: number; pix: number; semRegistro: number };
  comissoesTotal: number;
  porProfissional: { profId: string; nome: string; atendimentos: number; faturamento: number; comissao: number }[];
  porServico: { servicoId: string; nome: string; qtd: number; total: number }[];
};

function noPeriodo(dataISO: string, de: string, ate: string): boolean {
  return dataISO >= de && dataISO <= ate;
}

// Agrega os atendimentos CONCLUÍDOS no período (o dinheiro que entrou).
export async function resumoFinanceiro(slug: string, p: PeriodoFinanceiro): Promise<ResumoFinanceiro> {
  const concluidos = todosAgendamentos(slug).filter((a) => {
    if (a.status !== "concluido") return false;
    if (!noPeriodo(a.inicio.slice(0, 10), p.de, p.ate)) return false;
    if (p.unidadeId && a.unidadeId !== p.unidadeId) return false;
    if (p.profId && a.profissionalId !== p.profId) return false;
    return true;
  });

  const porForma = { dinheiro: 0, cartao: 0, pix: 0, semRegistro: 0 };
  let faturamento = 0;
  const porProfMap: Record<string, { atendimentos: number; faturamento: number; comissaoBase: number }> = {};
  const porServMap: Record<string, { qtd: number; total: number }> = {};

  for (const a of concluidos) {
    const valorPago = a.pagamentos?.length ? a.pagamentos.reduce((s, x) => s + x.valor, 0) : a.preco;
    faturamento += valorPago;

    if (a.pagamentos?.length) {
      for (const pg of a.pagamentos) porForma[pg.metodo] += pg.valor;
    } else {
      porForma.semRegistro += valorPago;
    }

    const pp = (porProfMap[a.profissionalId] ??= { atendimentos: 0, faturamento: 0, comissaoBase: 0 });
    pp.atendimentos += 1;
    pp.faturamento += valorPago;
    pp.comissaoBase += a.preco;

    for (const sid of a.servicoIds) {
      const s = baseServicos().find((x) => x.slug === slug && x.id === sid);
      const ps = (porServMap[sid] ??= { qtd: 0, total: 0 });
      ps.qtd += 1;
      ps.total += s?.preco ?? 0;
    }
  }

  const porProfissional = Object.entries(porProfMap).map(([profId, v]) => {
    const prof = baseProfs().find((x) => x.id === profId);
    const pct = prof?.comissao ?? 0;
    return { profId, nome: prof?.nome ?? "—", atendimentos: v.atendimentos, faturamento: v.faturamento, comissao: (v.comissaoBase * pct) / 100 };
  }).sort((a, b) => b.faturamento - a.faturamento);

  const porServico = Object.entries(porServMap).map(([servicoId, v]) => {
    const s = baseServicos().find((x) => x.id === servicoId);
    return { servicoId, nome: s?.nome ?? "—", qtd: v.qtd, total: v.total };
  }).sort((a, b) => b.total - a.total);

  const comissoesTotal = porProfissional.reduce((s, x) => s + x.comissao, 0);
  const atendimentos = concluidos.length;

  return {
    faturamento,
    atendimentos,
    ticketMedio: atendimentos ? faturamento / atendimentos : 0,
    porForma,
    comissoesTotal,
    porProfissional,
    porServico,
  };
}

export async function listarDespesas(slug: string, p: { de: string; ate: string; unidadeId?: string }): Promise<Despesa[]> {
  const sb = getSupabase();
  if (sb) {
    let q = sb.from("despesa").select("*").eq("slug", slug).gte("data", p.de).lte("data", p.ate);
    if (p.unidadeId) q = q.eq("unidade_id", p.unidadeId);
    const { data, error } = await q.order("data", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({ id: r.id, slug: r.slug, unidadeId: r.unidade_id ?? undefined, data: r.data, categoria: r.categoria, descricao: r.descricao, valor: r.valor }));
  }
  return despesasMock
    .filter((d) => d.slug === slug && noPeriodo(d.data, p.de, p.ate) && (!p.unidadeId || d.unidadeId === p.unidadeId))
    .sort((a, b) => b.data.localeCompare(a.data));
}

export async function criarDespesa(d: Omit<Despesa, "id">): Promise<Despesa> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from("despesa").insert({
      slug: d.slug, unidade_id: d.unidadeId ?? null, data: d.data, categoria: d.categoria, descricao: d.descricao, valor: d.valor,
    }).select().single();
    if (error) throw new Error(error.message);
    return { ...d, id: data?.id ?? `d-${Date.now()}` };
  }
  const registro: Despesa = { ...d, id: `d-${Date.now()}` };
  despesasMock.push(registro);
  return registro;
}

export async function excluirDespesa(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("despesa").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const i = despesasMock.findIndex((d) => d.id === id);
  if (i >= 0) despesasMock.splice(i, 1);
}

// ---------------------------------------------------------------------------
// Configurações (catálogo editável pelo dono)
// ---------------------------------------------------------------------------

// Marca / branding
export async function atualizarBranding(slug: string, patch: Partial<Branding>): Promise<Branding> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("barbearia").update({
      nome: patch.nome, simbolo: patch.simbolo, logo_url: patch.logoUrl, cor: patch.cor, tagline: patch.tagline,
    }).eq("slug", slug);
    if (error) throw new Error(error.message);
  }
  const arr = mutBrandings();
  const b = arr.find((x) => x.slug === slug);
  if (b) Object.assign(b, patch);
  return b ?? (getBranding(slug) as Branding);
}

// Serviços e combos
export async function criarServico(slug: string, d: Omit<Servico, "id" | "slug">): Promise<Servico> {
  const registro: Servico = { id: `s-${Date.now()}`, slug, ativo: true, ...d };
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from("servico").insert({
      slug, nome: d.nome, descricao: d.descricao ?? null, duracao_min: d.duracaoMin, preco: d.preco,
      ativo: d.ativo ?? true, combo: d.combo ?? false, itens: d.itens ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    if (data?.id) registro.id = data.id;
  }
  mutServicos().push(registro);
  return registro;
}

export async function atualizarServico(id: string, patch: Partial<Servico>): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const up: any = {};
    if (patch.nome !== undefined) up.nome = patch.nome;
    if (patch.descricao !== undefined) up.descricao = patch.descricao;
    if (patch.duracaoMin !== undefined) up.duracao_min = patch.duracaoMin;
    if (patch.preco !== undefined) up.preco = patch.preco;
    if (patch.ativo !== undefined) up.ativo = patch.ativo;
    if (patch.itens !== undefined) up.itens = patch.itens;
    const { error } = await sb.from("servico").update(up).eq("id", id);
    if (error) throw new Error(error.message);
  }
  const s = mutServicos().find((x) => x.id === id);
  if (s) Object.assign(s, patch);
}

export async function excluirServico(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) { const { error } = await sb.from("servico").delete().eq("id", id); if (error) throw new Error(error.message); }
  const arr = mutServicos();
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) arr.splice(i, 1);
}

// Profissionais
export async function criarProfissional(slug: string, d: Omit<Profissional, "id" | "slug">): Promise<Profissional> {
  const registro: Profissional = {
    id: `p-${Date.now()}`, slug,
    iniciais: d.iniciais || (d.nome || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase(),
    cor: d.cor || "linear-gradient(135deg,#d8ac66,#a5702c)",
    rating: d.rating ?? 5, avaliacoes: d.avaliacoes ?? 0,
    unidades: d.unidades ?? [], servicos: d.servicos ?? [],
    nome: d.nome, especialidade: d.especialidade ?? "", pin: d.pin, comissao: d.comissao ?? 0,
  };
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from("profissional").insert({
      slug, nome: registro.nome, iniciais: registro.iniciais, cor: registro.cor, especialidade: registro.especialidade,
      rating: registro.rating, avaliacoes: registro.avaliacoes, unidades: registro.unidades, servicos: registro.servicos,
      pin: registro.pin ?? null, comissao: registro.comissao,
    }).select().single();
    if (error) throw new Error(error.message);
    if (data?.id) registro.id = data.id;
  }
  mutProfs().push(registro);
  return registro;
}

export async function atualizarProfissional(id: string, patch: Partial<Profissional>): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const up: any = {};
    for (const [k, col] of [["nome", "nome"], ["especialidade", "especialidade"], ["pin", "pin"], ["comissao", "comissao"], ["unidades", "unidades"], ["servicos", "servicos"], ["cor", "cor"], ["iniciais", "iniciais"]] as const) {
      if ((patch as any)[k] !== undefined) up[col] = (patch as any)[k];
    }
    const { error } = await sb.from("profissional").update(up).eq("id", id);
    if (error) throw new Error(error.message);
  }
  const p = mutProfs().find((x) => x.id === id);
  if (p) Object.assign(p, patch);
}

export async function excluirProfissional(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) { const { error } = await sb.from("profissional").delete().eq("id", id); if (error) throw new Error(error.message); }
  const arr = mutProfs();
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) arr.splice(i, 1);
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
