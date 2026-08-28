# Navalha Agenda

Sistema de **agendamento online para barbearias** — multi-loja e white-label.
O cliente faz login e agenda escolhendo, nesta ordem:

**Local → Profissional → Serviço → Dia → Horário → Confirmação.**

Na etapa de horário, a grade mostra **todos os slots do dia**; os ocupados
aparecem desabilitados (não escondidos) para o cliente enxergar a
disponibilidade real e escolher o melhor horário.

Stack: **Next.js 14 (App Router) + TypeScript + Supabase**, CSS puro com
variáveis (tema claro/escuro e cor da marca por tenant). Mesmo padrão dos
demais projetos Perspecta — deploy pela Vercel.

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # opcional: preencha as chaves do Supabase
npm run dev
```

Abra `http://localhost:3000`. **Sem chaves do Supabase o app já funciona** com
dados de exemplo (`lib/mock.ts`) — dá para navegar todo o fluxo.

## Estrutura

```
app/
  login/         Login do cliente
  agendar/       Fluxo de agendamento (BookingWizard)
  meus/          "Meus agendamentos"
  config/        Painel do dono — personalização da marca (white-label)
  api/
    slots/       GET  — grade de horários (disponível/ocupado)
    agendamentos/ GET/POST — listar e criar agendamentos
components/       BookingWizard, MyBookings, BrandingPanel, LoginForm
lib/
  types.ts        Modelo de domínio
  mock.ts         Dados de exemplo (sem banco)
  data.ts         Acesso a dados — usa Supabase se houver chaves, senão o mock
  slots.ts        Regra de geração de horários (expediente + duração + ocupados)
  branding.ts     Branding do tenant → variáveis CSS
  format.ts       Formatação pt-BR
supabase/
  migrations/0001_init.sql   Schema multi-tenant + seed
```

## Personalização (white-label)

Cada barbearia (tenant, identificada por `slug`) tem o próprio **nome, símbolo/
logo e cor de destaque**. O dono ajusta em `/config` com preview ao vivo; a cor
vira a variável CSS `--brass` e recolore toda a UI, em tema claro e escuro.
O tenant padrão vem de `NEXT_PUBLIC_TENANT` (default `navalha`).

## Ligar o Supabase

1. Crie um projeto no Supabase e rode `supabase/migrations/0001_init.sql`.
2. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Pronto: `lib/data.ts` passa a ler/gravar no banco automaticamente.

## Próximos passos

- **Autenticação real** com Supabase Auth (hoje o login é simplificado).
- **Lembretes**: disparo de WhatsApp/e-mail na criação do agendamento
  (ver `app/api/agendamentos/route.ts`, onde há o ponto de integração).
- **Reagendar/cancelar** a partir de "Meus agendamentos".
- **Painéis do profissional e do admin** (agenda do dia, bloqueios, relatórios).
- Persistir o branding editado em `/config` na tabela `barbearia`.

> Nota: no modo mock, agendamentos criados ficam em memória do servidor e podem
> não persistir entre instâncias serverless. Com o Supabase ligado, a persistência
> é definitiva.
