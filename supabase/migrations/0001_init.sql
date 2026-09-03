-- Navalha Agenda — schema inicial (multi-tenant por `slug`).
-- Rode no SQL Editor do Supabase (ou via CLI). Depois preencha as variáveis
-- NEXT_PUBLIC_SUPABASE_* para o app deixar o mock e passar a usar o banco.

-- ---------------------------------------------------------------------------
-- Barbearia (tenant) + branding white-label
-- ---------------------------------------------------------------------------
create table if not exists barbearia (
  slug        text primary key,
  nome        text not null,
  simbolo     text not null default '💈',
  logo_url    text,
  cor         text not null default '#c9974e',
  tagline     text default '',
  criado_em   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Unidades
-- ---------------------------------------------------------------------------
create table if not exists unidade (
  id           text primary key,
  slug         text not null references barbearia(slug) on delete cascade,
  nome         text not null,
  endereco     text not null,
  distancia_km numeric default 0,
  abre_hora    int not null default 9,
  fecha_hora   int not null default 20
);

-- ---------------------------------------------------------------------------
-- Serviços
-- ---------------------------------------------------------------------------
create table if not exists servico (
  id          text primary key,
  slug        text not null references barbearia(slug) on delete cascade,
  nome        text not null,
  descricao   text,
  duracao_min int not null,
  preco       numeric not null
);

-- ---------------------------------------------------------------------------
-- Profissionais (barbeiros)
-- ---------------------------------------------------------------------------
create table if not exists profissional (
  id            text primary key,
  slug          text not null references barbearia(slug) on delete cascade,
  nome          text not null,
  iniciais      text,
  cor           text,
  especialidade text,
  rating        numeric default 5,
  avaliacoes    int default 0,
  unidades      text[] not null default '{}', -- ids de unidade onde atende
  servicos      text[] not null default '{}', -- ids de serviço que executa; {} = todos
  pin           text,                         -- PIN de acesso do barbeiro ao painel
  comissao      numeric default 0             -- % de comissão sobre os serviços
);

-- ---------------------------------------------------------------------------
-- Agendamentos
-- ---------------------------------------------------------------------------
create table if not exists agendamento (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null references barbearia(slug) on delete cascade,
  cliente_id       text not null,
  cliente_nome     text not null,
  unidade_id       text not null references unidade(id),
  profissional_id  text not null,
  servico_ids      text[] not null,
  inicio           timestamptz not null,
  duracao_min      int not null,
  preco            numeric not null,
  status           text not null default 'confirmado',
  pagamentos       jsonb,               -- formas de pagamento no ato (pode ser dividido)
  pago             boolean default false,
  criado_em        timestamptz not null default now()
);

-- Colunas adicionadas depois (idempotente, para bancos já criados).
alter table profissional add column if not exists pin text;
alter table profissional add column if not exists comissao numeric default 0;
alter table agendamento  add column if not exists pagamentos jsonb;
alter table agendamento  add column if not exists pago boolean default false;

-- ---------------------------------------------------------------------------
-- Despesas (controle financeiro)
-- ---------------------------------------------------------------------------
create table if not exists despesa (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null references barbearia(slug) on delete cascade,
  unidade_id text references unidade(id),
  data       date not null,
  categoria  text not null default 'outro',
  descricao  text not null,
  valor      numeric not null,
  criado_em  timestamptz not null default now()
);
create index if not exists idx_despesa_periodo on despesa (slug, data);
alter table despesa enable row level security;
-- Ajustar ao Supabase Auth depois; por ora, gestão via app (server).
create policy "despesa gestao" on despesa for all using (true) with check (true);

-- Evita dois agendamentos no mesmo horário para o mesmo profissional/unidade.
create unique index if not exists uniq_slot_profissional
  on agendamento (unidade_id, profissional_id, inicio)
  where status = 'confirmado';

create index if not exists idx_ag_cliente on agendamento (slug, cliente_id);
create index if not exists idx_ag_dia on agendamento (unidade_id, profissional_id, inicio);

-- ---------------------------------------------------------------------------
-- RLS — habilitar e ajustar políticas conforme a autenticação (Supabase Auth).
-- (Deixe habilitada; comece restritivo e abra o necessário.)
-- ---------------------------------------------------------------------------
alter table barbearia    enable row level security;
alter table unidade      enable row level security;
alter table servico      enable row level security;
alter table profissional enable row level security;
alter table agendamento  enable row level security;

-- Leitura pública do catálogo (branding, unidades, serviços, profissionais).
create policy "catalogo leitura publica" on barbearia    for select using (true);
create policy "unidade leitura publica"  on unidade      for select using (true);
create policy "servico leitura publica"  on servico      for select using (true);
create policy "prof leitura publica"     on profissional for select using (true);

-- Agendamentos: cada cliente vê/gerencia os seus (ajustar ao auth.uid()).
create policy "ag leitura do cliente" on agendamento
  for select using (cliente_id = auth.jwt() ->> 'email' or true);
create policy "ag insere" on agendamento
  for insert with check (true);

-- ---------------------------------------------------------------------------
-- Seed de exemplo (barbearia Navalha) — opcional.
-- ---------------------------------------------------------------------------
insert into barbearia (slug, nome, simbolo, cor, tagline) values
  ('navalha', 'Navalha', '💈', '#c9974e', 'Barbearia · desde 2016')
on conflict (slug) do nothing;

insert into unidade (id, slug, nome, endereco, distancia_km, abre_hora, fecha_hora) values
  ('u-centro',  'navalha', 'Navalha · Centro',  'Rua dos Andradas, 120',       1.2, 9, 20),
  ('u-moinhos', 'navalha', 'Navalha · Moinhos', 'Fernando Gomes, 45',          3.8, 9, 21),
  ('u-canoas',  'navalha', 'Navalha · Canoas',  'Av. Guilherme Schell, 900',    11, 9, 20)
on conflict (id) do nothing;

insert into servico (id, slug, nome, descricao, duracao_min, preco) values
  ('s-corte',       'navalha', 'Corte',                 null,                            30, 45),
  ('s-barba',       'navalha', 'Barba na navalha',      null,                            20, 30),
  ('s-corte-barba', 'navalha', 'Corte + Barba',         'combo',                         50, 70),
  ('s-pezinho',     'navalha', 'Pezinho / acabamento',  null,                            15, 20),
  ('s-premium',     'navalha', 'Combo Premium',         'corte, barba & sobrancelha',    60, 95)
on conflict (id) do nothing;

insert into profissional (id, slug, nome, iniciais, cor, especialidade, rating, avaliacoes, unidades, servicos, pin, comissao) values
  ('p-rafael', 'navalha', 'Rafael Moura',  'RM', 'linear-gradient(135deg,#d8ac66,#a5702c)', 'Cortes clássicos · navalhado',      4.9, 320, '{u-centro,u-moinhos}', '{}',                              '1111', 50),
  ('p-bruno',  'navalha', 'Bruno Tavares', 'BT', 'linear-gradient(135deg,#8fae7f,#4e7a49)', 'Degradê · freestyle',               4.8, 210, '{u-centro,u-canoas}',  '{}',                              '2222', 45),
  ('p-diego',  'navalha', 'Diego Antunes', 'DA', 'linear-gradient(135deg,#c98a6a,#9a5238)', 'Barba & terapia · toalha quente',   4.7, 156, '{u-moinhos,u-canoas}', '{s-barba,s-corte-barba,s-premium}', '3333', 40)
on conflict (id) do nothing;
