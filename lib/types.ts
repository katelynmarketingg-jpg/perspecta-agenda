// Modelo de domínio do agendamento de barbearia (multi-loja / multi-tenant).
// Cada barbearia é um "tenant" com o próprio branding (white-label).

// Fonte de um dado: banco ao vivo (Supabase) ou mock (sem chave configurada).
export type Source = "live" | "mock";

// Identidade visual personalizável pelo dono da barbearia.
export type Branding = {
  slug: string; // identificador do tenant, ex.: "navalha"
  nome: string; // nome do app exibido em todo lugar
  simbolo: string; // emoji usado como logo quando não há imagem
  logoUrl: string | null; // logo enviada pelo dono (PNG/SVG); null = usa `simbolo`
  cor: string; // cor de destaque (accent) em hex, ex.: "#c9974e"
  tagline: string; // slogan curto
};

export type Unidade = {
  id: string;
  slug: string; // tenant a que pertence
  nome: string;
  endereco: string;
  distanciaKm: number; // apenas ilustrativo no MVP
  abreHora: number; // hora de abertura (ex.: 9)
  fechaHora: number; // hora de fechamento (ex.: 20)
};

export type Profissional = {
  id: string;
  slug: string;
  nome: string;
  iniciais: string;
  cor: string; // cor do avatar
  especialidade: string;
  rating: number; // 0..5
  avaliacoes: number;
  unidades: string[]; // ids de Unidade onde atende
  servicos: string[]; // ids de Serviço que executa; [] = todos
  pin?: string; // PIN de acesso do próprio barbeiro ao painel
  comissao?: number; // percentual de comissão sobre os serviços (ex.: 40 = 40%)
};

export type CategoriaDespesa = "aluguel" | "produtos" | "salario" | "marketing" | "outro";

export type Despesa = {
  id: string;
  slug: string;
  unidadeId?: string;
  data: string; // "YYYY-MM-DD"
  categoria: CategoriaDespesa;
  descricao: string;
  valor: number;
};

export type MetodoPagamento = "dinheiro" | "cartao" | "pix";

export type Pagamento = {
  metodo: MetodoPagamento;
  valor: number;
};

export type Servico = {
  id: string;
  slug: string;
  nome: string;
  descricao?: string;
  duracaoMin: number;
  preco: number; // em reais
};

export type StatusAgendamento = "confirmado" | "cancelado" | "concluido";

export type Agendamento = {
  id: string;
  slug: string;
  clienteId: string;
  clienteNome: string;
  unidadeId: string;
  profissionalId: string;
  servicoIds: string[];
  inicio: string; // ISO 8601 (data + hora do início)
  duracaoMin: number;
  preco: number;
  status: StatusAgendamento;
  pagamentos?: Pagamento[]; // registrado no ato (pode ser dividido)
  pago?: boolean;
};

// Um horário na grade que o cliente vê.
export type Slot = {
  hora: string; // "HH:MM"
  disponivel: boolean; // false = ocupado ou fora do expediente
};

// Payload para criar um agendamento (vem do wizard).
export type NovoAgendamento = {
  slug: string;
  clienteId: string;
  clienteNome: string;
  unidadeId: string;
  profissionalId: string;
  servicoIds: string[];
  dataISO: string; // "YYYY-MM-DD"
  hora: string; // "HH:MM"
};
