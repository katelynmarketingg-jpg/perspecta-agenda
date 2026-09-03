import type {
  Branding,
  Unidade,
  Profissional,
  Servico,
  Agendamento,
} from "./types";

// Dados de demonstração — usados enquanto o Supabase não está configurado.
// Estruturados por `slug` (tenant) para já suportar multi-tenant / white-label.

export const brandings: Branding[] = [
  {
    slug: "navalha",
    nome: "Navalha",
    simbolo: "💈",
    logoUrl: null,
    cor: "#c9974e",
    tagline: "Barbearia · desde 2016",
  },
];

export const unidades: Unidade[] = [
  { id: "u-centro", slug: "navalha", nome: "Navalha · Centro", endereco: "Rua dos Andradas, 120", distanciaKm: 1.2, abreHora: 9, fechaHora: 20 },
  { id: "u-moinhos", slug: "navalha", nome: "Navalha · Moinhos", endereco: "Fernando Gomes, 45", distanciaKm: 3.8, abreHora: 9, fechaHora: 21 },
  { id: "u-canoas", slug: "navalha", nome: "Navalha · Canoas", endereco: "Av. Guilherme Schell, 900", distanciaKm: 11, abreHora: 9, fechaHora: 20 },
];

// PINs de exemplo dos barbeiros (MVP). Em produção, cada um define o seu
// (e no futuro isso vira login por usuário no Supabase Auth).
export const profissionais: Profissional[] = [
  { id: "p-rafael", slug: "navalha", nome: "Rafael Moura", iniciais: "RM", cor: "linear-gradient(135deg,#d8ac66,#a5702c)", especialidade: "Cortes clássicos · navalhado", rating: 4.9, avaliacoes: 320, unidades: ["u-centro", "u-moinhos"], servicos: [], pin: "1111" },
  { id: "p-bruno", slug: "navalha", nome: "Bruno Tavares", iniciais: "BT", cor: "linear-gradient(135deg,#8fae7f,#4e7a49)", especialidade: "Degradê · freestyle", rating: 4.8, avaliacoes: 210, unidades: ["u-centro", "u-canoas"], servicos: [], pin: "2222" },
  { id: "p-diego", slug: "navalha", nome: "Diego Antunes", iniciais: "DA", cor: "linear-gradient(135deg,#c98a6a,#9a5238)", especialidade: "Barba & terapia · toalha quente", rating: 4.7, avaliacoes: 156, unidades: ["u-moinhos", "u-canoas"], servicos: ["s-barba", "s-corte-barba", "s-premium"], pin: "3333" },
];

export const servicos: Servico[] = [
  { id: "s-corte", slug: "navalha", nome: "Corte", duracaoMin: 30, preco: 45 },
  { id: "s-barba", slug: "navalha", nome: "Barba na navalha", duracaoMin: 20, preco: 30 },
  { id: "s-corte-barba", slug: "navalha", nome: "Corte + Barba", descricao: "combo", duracaoMin: 50, preco: 70 },
  { id: "s-pezinho", slug: "navalha", nome: "Pezinho / acabamento", duracaoMin: 15, preco: 20 },
  { id: "s-premium", slug: "navalha", nome: "Combo Premium", descricao: "corte, barba & sobrancelha", duracaoMin: 60, preco: 95 },
];

// Agendamentos pré-existentes que ocupam horários na grade.
// (Datas relativas a hoje são resolvidas em runtime pela camada de dados.)
export const agendamentosSeed: Agendamento[] = [
  { id: "a-seed-1", slug: "navalha", clienteId: "outro", clienteNome: "Marcos", unidadeId: "u-centro", profissionalId: "p-rafael", servicoIds: ["s-corte"], inicio: "SEED_HOJE_T09:30", duracaoMin: 30, preco: 45, status: "confirmado" },
  { id: "a-seed-2", slug: "navalha", clienteId: "outro", clienteNome: "Paulo", unidadeId: "u-centro", profissionalId: "p-rafael", servicoIds: ["s-corte-barba"], inicio: "SEED_HOJE_T11:00", duracaoMin: 50, preco: 70, status: "confirmado" },
  { id: "a-seed-3", slug: "navalha", clienteId: "outro", clienteNome: "André", unidadeId: "u-centro", profissionalId: "p-rafael", servicoIds: ["s-corte"], inicio: "SEED_HOJE_T14:00", duracaoMin: 30, preco: 45, status: "confirmado" },
  { id: "a-seed-4", slug: "navalha", clienteId: "outro", clienteNome: "Lucas", unidadeId: "u-centro", profissionalId: "p-rafael", servicoIds: ["s-barba"], inicio: "SEED_HOJE_T16:30", duracaoMin: 20, preco: 30, status: "confirmado" },
];
