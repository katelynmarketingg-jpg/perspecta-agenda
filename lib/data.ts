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
//
// Erro vindo do banco NÃO cai no mock: propaga. Cair no mock silenciosamente
// mascara problemas de configuração (schema não exposto, RLS, etc.) e faz o
// app parecer funcionar sem gravar nada. Use /api/diag para diagnosticar.
// ---------------------------------------------------------------------------

// Store em memória para agendamentos criados no modo mock.
// (Não persiste entre reinícios do servidor — no Supabase isso vira uma tabela.)
const criadosMock: Agendamento[] = [];

// Mudanças feitas pelo admin no modo mock (por id). Permite alterar tanto os
// agendamentos criados quanto os de seed sem um banco.
const statusOverrides: Record<string, StatusAgendamento> = {};
const servicoOverrides: Record<string, string[]> = {};
const pagamentoOverrides: Record<string, Pagamento[]> = {};

// ---------------------------------------------------------------------------
// Conversão linha do banco (snake_case) → tipo de domínio (camelCase)
// ---------------------------------------------------------------------------

function mapBranding(r: any): Branding {
  return {
    slug: r.slug,
    nome: r.nome,
    simbolo: r.simbolo ?? "💈",
    logoUrl: r.logo_url ?? null,
    cor: r.cor ?? "#c9974e",
    tagline: r.tagline ?? "",
  };
}

function mapUnidade(r: any): Unidade {
  return {
    id: r.id,
    slug: r.slug,
    nome: r.nome,
    endereco: r.endereco,
    distanciaKm: Number(r.distancia_km ?? 0),
    abreHora: Number(r.abre_hora),
    fechaHora: Number(r.fecha_hora),
  };
}

function mapServico(r: any): Servico {
  return {
    id: r.id,
    slug: r.slug,
    nome: r.nome,
    descricao: r.descricao ?? undefined,
    duracaoMin: Number(r.duracao_min),
    preco: Number(r.preco),
    ativo: r.ativo ?? true,
    combo: r.combo ?? false,
    itens: r.itens ?? undefined,
  };
}

function mapProfissional(r: any): Profissional {
  return {
    id: r.id,
    slug: r.slug,
    nome: r.nome,
    iniciais: r.iniciais ?? "",
    cor: r.cor ?? "linear-gradient(135deg,#d8ac66,#a5702c)",
    especialidade: r.especialidade ?? "",
    rating: Number(r.rating ?? 5),
    avaliacoes: Number(r.avaliacoes ?? 0),
    unidades: r.unidades ?? [],
    servicos: r.servicos ?? [],
    pin: r.pin ?? undefined,
    comissao: Number(r.comissao ?? 0),
  };
}

// `inicio` é timestamptz. O app trata a hora como "relógio de parede" e grava
// sem offset — o banco (UTC) armazena exatamente esses números. Na volta o
// PostgREST devolve com offset ("...T09:30:00+00:00"), então lemos os
// componentes em UTC para recuperar a hora original, independentemente do
// formato do offset.
function normalizarInicio(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toISOString().slice(0, 19);
}

function mapAgendamento(r: any): Agendamento {
  const pagamentos = (r.pagamentos ?? undefined) as Pagamento[] | undefined;
  return {
    id: r.id,
    slug: r.slug,
    clienteId: r.cliente_id,
    clienteNome: r.cliente_nome,
    unidadeId: r.unidade_id,
    profissionalId: r.profissional_id,
    servicoIds: r.servico_ids ?? [],
    inicio: normalizarInicio(r.inicio),
    duracaoMin: Number(r.duracao_min),
    preco: Number(r.preco),
    status: r.status,
    pagamentos: pagamentos?.length ? pagamentos : undefined,
    pago: r.pago ?? false,
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

// Recalcula duração e preço totais a partir dos serviços escolhidos (mock).
function recalcServicosMock(slug: string, servicoIds: string[]) {
  const servs = baseServicos().filter((s) => s.slug === slug && servicoIds.includes(s.id));
  return {
    duracaoMin: servs.reduce((a, s) => a + s.duracaoMin, 0),
    preco: servs.reduce((a, s) => a + s.preco, 0),
  };
}

// Versão que serve aos dois modos: lê o catálogo vigente (banco ou mock).
async function recalcServicos(slug: string, servicoIds: string[]) {
  const servs = (await getServicosAdmin(slug)).filter((s) => servicoIds.includes(s.id));
  return {
    duracaoMin: servs.reduce((a, s) => a + s.duracaoMin, 0),
    preco: servs.reduce((a, s) => a + s.preco, 0),
  };
}

// Stores mutáveis do catálogo (modo mock). Inicializam a partir do mock na
// primeira edição; enquanto null, lê-se direto do mock.
let brandingsStore: Branding[] | null = null;
let servicosStore: Servico[] | null = null;
let profsStore: Profissional[] | null = null;
function baseBrandings(): Branding[] { return brandingsStore ?? brandings; }
function baseServicos(): Servico[] { return servicosStore ?? servsMock; }
function baseProfs(): Profissional[] { return profsStore ?? profsMock; }
function mutBrandings(): Branding[] { return (brandingsStore ??= brandings.map((b) => ({ ...b }))); }
function mutServicos(): Servico[] { return (servicosStore ??= servsMock.map((s) => ({ ...s }))); }
function mutProfs(): Profissional[] { return (profsStore ??= profsMock.map((p) => ({ ...p }))); }

// ---------------------------------------------------------------------------
// Catálogo (leitura)
// ---------------------------------------------------------------------------

export async function getBranding(slug: string): Promise<Branding | null> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from("barbearia").select("*").eq("slug", slug).maybeSingle();
    if (error) throw new Error(`barbearia: ${error.message}`);
    return data ? mapBranding(data) : null;
  }
  return baseBrandings().find((b) => b.slug === slug) ?? null;
}

export async function getUnidades(slug: string): Promise<Unidade[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from("unidade").select("*").eq("slug", slug).order("nome");
    if (error) throw new Error(`unidade: ${error.message}`);
    return (data ?? []).map(mapUnidade);
  }
  return unidsMock.filter((u) => u.slug === slug);
}

// Serviços que aparecem para o cliente (ativos). Combos entram normalmente.
export async function getServicos(slug: string): Promise<Servico[]> {
  return (await getServicosAdmin(slug)).filter((s) => s.ativo !== false);
}

// Todos os serviços do tenant, inclusive inativos (para o painel de config).
export async function getServicosAdmin(slug: string): Promise<Servico[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from("servico").select("*").eq("slug", slug).order("preco");
    if (error) throw new Error(`servico: ${error.message}`);
    return (data ?? []).map(mapServico);
  }
  return baseServicos().filter((s) => s.slug === slug);
}

// Profissionais do tenant, opcionalmente filtrados por unidade e serviço.
export async function getProfissionais(
  slug: string,
  unidadeId?: string,
  servicoIds?: string[],
): Promise<Profissional[]> {
  const sb = getSupabase();
  let todos: Profissional[];
  if (sb) {
    const { data, error } = await sb.from("profissional").select("*").eq("slug", slug).order("nome");
    if (error) throw new Error(`profissional: ${error.message}`);
    todos = (data ?? []).map(mapProfissional);
  } else {
    todos = baseProfs().filter((p) => p.slug === slug);
  }

  return todos.filter((p) => {
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
export async function findProfissionalPorPin(slug: string, pin: string): Promise<Profissional | null> {
  if (!pin) return null;
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("profissional")
      .select("*")
      .eq("slug", slug)
      .eq("pin", pin)
      .limit(1);
    if (error) throw new Error(`profissional: ${error.message}`);
    return data?.length ? mapProfissional(data[0]) : null;
  }
  return baseProfs().find((p) => p.slug === slug && p.pin && p.pin === pin) ?? null;
}

// ---------------------------------------------------------------------------
// Agendamentos (leitura)
// ---------------------------------------------------------------------------

// Todos os agendamentos do tenant no mock (seed + criados), com datas
// resolvidas e os overrides do admin aplicados.
function todosAgendamentosMock(slug: string): Agendamento[] {
  const seed = agendamentosSeed
    .filter((a) => a.slug === slug)
    .map((a) => ({ ...a, inicio: resolveInicioSeed(a.inicio) }));
  return [...seed, ...criadosMock.filter((a) => a.slug === slug)].map((a) => {
    const servicoIds = servicoOverrides[a.id] ?? a.servicoIds;
    const recalc = servicoOverrides[a.id]
      ? recalcServicosMock(slug, servicoIds)
      : { duracaoMin: a.duracaoMin, preco: a.preco };
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

export type FiltrosAdmin = {
  dataISO?: string; // "YYYY-MM-DD"
  de?: string; // início do período ("YYYY-MM-DD")
  ate?: string; // fim do período ("YYYY-MM-DD")
  unidadeId?: string;
  profissionalId?: string;
  status?: StatusAgendamento;
};

// Consulta única de agendamentos que serve o admin, a grade de horários, a
// tela do cliente e o financeiro. No banco filtra no servidor; no mock, aqui.
async function buscarAgendamentos(slug: string, f: FiltrosAdmin = {}): Promise<Agendamento[]> {
  const sb = getSupabase();
  if (sb) {
    let q = sb.from("agendamento").select("*").eq("slug", slug);
    if (f.unidadeId) q = q.eq("unidade_id", f.unidadeId);
    if (f.profissionalId) q = q.eq("profissional_id", f.profissionalId);
    if (f.status) q = q.eq("status", f.status);
    if (f.dataISO) q = q.gte("inicio", `${f.dataISO}T00:00:00`).lte("inicio", `${f.dataISO}T23:59:59`);
    if (f.de) q = q.gte("inicio", `${f.de}T00:00:00`);
    if (f.ate) q = q.lte("inicio", `${f.ate}T23:59:59`);
    const { data, error } = await q.order("inicio", { ascending: true });
    if (error) throw new Error(`agendamento: ${error.message}`);
    return (data ?? []).map(mapAgendamento);
  }

  return todosAgendamentosMock(slug)
    .filter((a) => {
      const dia = a.inicio.slice(0, 10);
      if (f.unidadeId && a.unidadeId !== f.unidadeId) return false;
      if (f.profissionalId && a.profissionalId !== f.profissionalId) return false;
      if (f.status && a.status !== f.status) return false;
      if (f.dataISO && dia !== f.dataISO) return false;
      if (f.de && dia < f.de) return false;
      if (f.ate && dia > f.ate) return false;
      return true;
    })
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

// Intervalos ocupados (em minutos desde 00:00) de um profissional, numa unidade,
// num dia. Usado por gerarSlots() para desabilitar horários.
export async function getOcupados(
  slug: string,
  unidadeId: string,
  profissionalId: string,
  dataISO: string,
): Promise<{ inicioMin: number; fimMin: number }[]> {
  // "Sem preferência": assumimos que sempre há algum barbeiro livre.
  if (profissionalId === SEM_PREFERENCIA) return [];

  const ags = await buscarAgendamentos(slug, {
    unidadeId,
    profissionalId,
    dataISO,
    status: "confirmado",
  });

  return ags.map((a) => {
    const inicioMin = horaParaMin(a.inicio.slice(11, 16));
    return { inicioMin, fimMin: inicioMin + a.duracaoMin };
  });
}

export async function getAgendamentosDoCliente(
  slug: string,
  clienteId: string,
): Promise<Agendamento[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("agendamento")
      .select("*")
      .eq("slug", slug)
      .eq("cliente_id", clienteId)
      .eq("status", "confirmado")
      .order("inicio", { ascending: true });
    if (error) throw new Error(`agendamento: ${error.message}`);
    return (data ?? []).map(mapAgendamento);
  }

  return todosAgendamentosMock(slug)
    .filter((a) => a.status === "confirmado" && a.clienteId === clienteId)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

// Lista TODOS os agendamentos do tenant conforme filtros (visão do admin).
export async function listarAgendamentos(
  slug: string,
  f: FiltrosAdmin = {},
): Promise<Agendamento[]> {
  return buscarAgendamentos(slug, f);
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
  const recalc = await recalcServicos(slug, servicoIds);
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
  const [concluidos, catalogo, profs] = await Promise.all([
    buscarAgendamentos(slug, {
      de: p.de,
      ate: p.ate,
      unidadeId: p.unidadeId,
      profissionalId: p.profId,
      status: "concluido",
    }),
    getServicosAdmin(slug),
    getProfissionais(slug),
  ]);

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
      const s = catalogo.find((x) => x.id === sid);
      const ps = (porServMap[sid] ??= { qtd: 0, total: 0 });
      ps.qtd += 1;
      ps.total += s?.preco ?? 0;
    }
  }

  const porProfissional = Object.entries(porProfMap).map(([profId, v]) => {
    const prof = profs.find((x) => x.id === profId);
    const pct = prof?.comissao ?? 0;
    return { profId, nome: prof?.nome ?? "—", atendimentos: v.atendimentos, faturamento: v.faturamento, comissao: (v.comissaoBase * pct) / 100 };
  }).sort((a, b) => b.faturamento - a.faturamento);

  const porServico = Object.entries(porServMap).map(([servicoId, v]) => {
    const s = catalogo.find((x) => x.id === servicoId);
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

// Série dia a dia (faturamento e comissão por dia) — base dos relatórios.
export type PontoSerie = { data: string; atendimentos: number; faturamento: number; comissao: number };

export async function serieDiaria(slug: string, p: { de: string; ate: string; profId?: string }): Promise<PontoSerie[]> {
  const [concl, profs] = await Promise.all([
    buscarAgendamentos(slug, { de: p.de, ate: p.ate, profissionalId: p.profId, status: "concluido" }),
    getProfissionais(slug),
  ]);

  const map: Record<string, { atendimentos: number; faturamento: number; comissao: number }> = {};
  for (const a of concl) {
    const d = a.inicio.slice(0, 10);
    const valor = a.pagamentos?.length ? a.pagamentos.reduce((s, x) => s + x.valor, 0) : a.preco;
    const pct = profs.find((x) => x.id === a.profissionalId)?.comissao ?? 0;
    const m = (map[d] ??= { atendimentos: 0, faturamento: 0, comissao: 0 });
    m.atendimentos += 1;
    m.faturamento += valor;
    m.comissao += (a.preco * pct) / 100;
  }
  return Object.entries(map).map(([data, v]) => ({ data, ...v })).sort((a, b) => a.data.localeCompare(b.data));
}

export async function listarDespesas(slug: string, p: { de: string; ate: string; unidadeId?: string }): Promise<Despesa[]> {
  const sb = getSupabase();
  if (sb) {
    let q = sb.from("despesa").select("*").eq("slug", slug).gte("data", p.de).lte("data", p.ate);
    if (p.unidadeId) q = q.eq("unidade_id", p.unidadeId);
    const { data, error } = await q.order("data", { ascending: false });
    if (error) throw new Error(`despesa: ${error.message}`);
    return (data ?? []).map((r: any) => ({ id: r.id, slug: r.slug, unidadeId: r.unidade_id ?? undefined, data: r.data, categoria: r.categoria, descricao: r.descricao, valor: Number(r.valor) }));
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
    const atual = await getBranding(slug);
    if (!atual) throw new Error(`barbearia "${slug}" não encontrada`);
    return atual;
  }
  const arr = mutBrandings();
  const b = arr.find((x) => x.slug === slug);
  if (b) Object.assign(b, patch);
  if (!b) throw new Error(`barbearia "${slug}" não encontrada`);
  return b;
}

// Serviços e combos
export async function criarServico(slug: string, d: Omit<Servico, "id" | "slug">): Promise<Servico> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from("servico").insert({
      id: `s-${Date.now()}`,
      slug, nome: d.nome, descricao: d.descricao ?? null, duracao_min: d.duracaoMin, preco: d.preco,
      ativo: d.ativo ?? true, combo: d.combo ?? false, itens: d.itens ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    return mapServico(data);
  }
  const registro: Servico = { id: `s-${Date.now()}`, slug, ativo: true, ...d };
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
    return;
  }
  const s = mutServicos().find((x) => x.id === id);
  if (s) Object.assign(s, patch);
}

export async function excluirServico(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("servico").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
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
      id: registro.id,
      slug, nome: registro.nome, iniciais: registro.iniciais, cor: registro.cor, especialidade: registro.especialidade,
      rating: registro.rating, avaliacoes: registro.avaliacoes, unidades: registro.unidades, servicos: registro.servicos,
      pin: registro.pin ?? null, comissao: registro.comissao,
    }).select().single();
    if (error) throw new Error(error.message);
    return mapProfissional(data);
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
    return;
  }
  const p = mutProfs().find((x) => x.id === id);
  if (p) Object.assign(p, patch);
}

export async function excluirProfissional(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("profissional").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const arr = mutProfs();
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) arr.splice(i, 1);
}

// Cria um agendamento. No mock, empurra para o store em memória.
// No Supabase, insere na tabela `agendamento`.
export async function criarAgendamento(
  novo: NovoAgendamento,
): Promise<Agendamento> {
  const servs = (await getServicos(novo.slug)).filter((s) =>
    novo.servicoIds.includes(s.id),
  );
  if (!servs.length) throw new Error("Nenhum serviço válido selecionado");

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
    if (error) {
      // Índice único uniq_slot_profissional: alguém pegou o horário antes.
      if (error.code === "23505") throw new Error("Esse horário acabou de ser preenchido. Escolha outro.");
      throw new Error(error.message);
    }
    return mapAgendamento(data);
  }

  criadosMock.push(registro);
  return registro;
}
