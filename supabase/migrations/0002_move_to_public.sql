-- Move as tabelas do schema navalha para o public, com prefixo nav_.
-- Motivo: neste projeto, expor um schema novo (navalha) na Data API não estava
-- aplicando no PostgREST. O schema public já está exposto e funcional, então
-- passamos as tabelas para lá com prefixo, sem colidir com Commerce/Juris.
-- Preserva os dados já inseridos (rename/move não apaga nada).

-- 1) renomeia dentro do navalha (evita colisão transitória no public)
alter table if exists navalha.barbearia    rename to nav_barbearia;
alter table if exists navalha.unidade      rename to nav_unidade;
alter table if exists navalha.servico      rename to nav_servico;
alter table if exists navalha.profissional rename to nav_profissional;
alter table if exists navalha.agendamento  rename to nav_agendamento;
alter table if exists navalha.despesa      rename to nav_despesa;

-- 2) move para o schema public
alter table if exists navalha.nav_barbearia    set schema public;
alter table if exists navalha.nav_unidade      set schema public;
alter table if exists navalha.nav_servico      set schema public;
alter table if exists navalha.nav_profissional set schema public;
alter table if exists navalha.nav_agendamento  set schema public;
alter table if exists navalha.nav_despesa      set schema public;

-- 3) garante acesso via API (PostgREST)
grant all on table
  public.nav_barbearia, public.nav_unidade, public.nav_servico,
  public.nav_profissional, public.nav_agendamento, public.nav_despesa
  to anon, authenticated, service_role;

-- 4) limpa o schema navalha (agora vazio)
drop schema if exists navalha cascade;
