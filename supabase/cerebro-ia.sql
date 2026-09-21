-- ============================================================================
-- Herval AI · Fase 1 do "cérebro" da Helô
-- Tabelas mínimas para o MVP conversacional isolado (sem WhatsApp real ainda).
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Pode rodar mais de uma vez sem quebrar nada (tudo com "if not exists").
--
-- Escopo: só o necessário para o n8n conseguir buscar contexto (lead,
-- clínica, especialidades, objeções) e gravar a conversa de verdade.
-- NÃO inclui ainda: agendamentos, histórico de etapas, ligações, notas,
-- régua de automação completa. Isso é o restante do modelo já documentado
-- em docs/documentacao-tecnica.md e entra numa Fase 2, quando o motor de
-- escalonamento de ligação e a Fila de Atendimento também migrarem.
-- ============================================================================

-- 1) Especialidades ---------------------------------------------------------
-- "ativa = false" é a trava que impede a Helô de oferecer ou agendar um
-- procedimento pausado (ver docs/especificacao-area-de-atendimento.md e o
-- cenário "especialidade-pausada" do Teste da IA).
create table if not exists public.especialidades (
  id                serial primary key,
  nome              text not null,
  ativa             boolean not null default true,
  duracao_minutos   integer not null default 40,
  -- Como a IA deve se comportar quando perguntam sobre ela estando pausada.
  -- Fica vazio para especialidades sempre ativas.
  como_abordar_pausada text
);

-- 2) Clínicas -----------------------------------------------------------
-- A ficha completa (estratégia, comercial, público-alvo) que a especificação
-- da Área de Atendimento pediu para enriquecer, mais o modo de atendimento
-- que hoje mora em src/data/estrategia.ts (era config global, aqui é por
-- clínica, que é o nível certo: cada cliente pode querer um modo diferente).
create table if not exists public.clinicas (
  id                     serial primary key,
  nome                   text not null,
  cidade                 text,
  numero_unidades        integer not null default 0,
  ativa                  boolean not null default true,

  -- Trava mestra: se a IA pode agir nesta clínica, e em quais leads.
  modo_atendimento text not null default 'Todo lead'
    check (modo_atendimento in ('Pausada', 'Todo lead', 'Só marketing', 'Só humano')),

  -- Estratégia e diferenciais
  historia               text,
  diferenciais           text,
  tratamentos_oferecidos text,

  -- Comercial e condições
  parcelamento           text,
  formas_pagamento       text,
  convenios              text,

  -- Público-alvo
  classe_economica       text,
  faixa_etaria           text,
  principais_dores       text,

  -- Operacional (usado pela IA para confirmar consulta / dar endereço)
  endereco               text,
  horario_funcionamento  text
);

-- 3) Valor por procedimento, por clínica -------------------------------
-- N:N porque o mesmo procedimento pode ter preço diferente em cada clínica
-- (hoje Especialidade só tinha um valor global — ver seção 3.2 item 3 da
-- especificação). Ausência de linha aqui = "consultar equipe", nunca "grátis".
create table if not exists public.clinica_especialidades (
  clinica_id       integer not null references public.clinicas(id) on delete cascade,
  especialidade_id integer not null references public.especialidades(id) on delete cascade,
  valor            numeric(10,2),
  primary key (clinica_id, especialidade_id)
);

-- 4) Leads ----------------------------------------------------------------
-- Só os campos que o cérebro precisa para responder. NÃO é a tabela final —
-- quando a Fila de Tarefas e o Funil migrarem, ela ganha etapa (enum das 16
-- etapas), motivo de perda, e todo o resto já documentado. Por ora, etapa é
-- texto livre só para a trava de "primeiro contato" (item 5) funcionar.
create table if not exists public.leads (
  id                        serial primary key,
  nome                      text not null,
  telefone                  text,
  clinica_id                integer references public.clinicas(id),
  especialidade_interesse_id integer references public.especialidades(id),
  etapa                     text not null default 'Leads Recebidos',
  origem                    text,
  criado_em                 timestamptz not null default now()
);

-- 5) Banco de objeções -------------------------------------------------
create table if not exists public.objecoes (
  id       serial primary key,
  objecao  text not null,
  resposta text not null,
  usos     integer not null default 0
);

-- 6) Mensagens — a conversa real -----------------------------------------
-- Mesmo modelo bidirecional de src/data/mensagens.ts, só que com timestamp
-- absoluto de verdade (criado_em) no lugar de "minutosAtras": aqui os dados
-- não são mais demonstração que precisa não envelhecer, são conversa real.
create table if not exists public.mensagens (
  id             bigserial primary key,
  lead_id        integer not null references public.leads(id) on delete cascade,
  remetente_tipo text not null check (remetente_tipo in ('Lead', 'IA', 'Automática', 'Humano')),
  -- Nome de quem escreveu. Só preenchido em mensagem humana.
  remetente_nome text,
  formato        text not null default 'texto' check (formato in ('texto', 'audio')),
  texto          text not null,
  -- Regra da automação que disparou a mensagem (vazio no que o lead escreve
  -- e no que a IA responde em conversa livre).
  regra          text,
  status         text check (status in ('enviada', 'entregue', 'lida')),
  criado_em      timestamptz not null default now()
);

create index if not exists mensagens_lead_id_idx on public.mensagens (lead_id, criado_em);

-- ============================================================================
-- Segurança por linha
--
-- Diferente de "profiles" (perfis.sql), estas tabelas não são dado pessoal
-- de quem está logado — são a operação inteira, que qualquer CRC autenticado
-- no painel precisa ver por completo (é assim que o app já se comporta hoje
-- com o dado fixo em src/data/). Por isso a política é "autenticado lê e
-- grava tudo", não "só a própria linha".
--
-- O n8n NÃO deve usar a chave anônima (NEXT_PUBLIC_SUPABASE_ANON_KEY) —
-- deve usar a service role key do Supabase, que ignora RLS. Essa chave é
-- secreta: fica só nas credenciais do n8n, nunca no .env.local do Next.js
-- nem em código que roda no navegador.
-- ============================================================================

alter table public.especialidades enable row level security;
alter table public.clinicas enable row level security;
alter table public.clinica_especialidades enable row level security;
alter table public.leads enable row level security;
alter table public.objecoes enable row level security;
alter table public.mensagens enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['especialidades', 'clinicas', 'clinica_especialidades', 'leads', 'objecoes', 'mensagens']
  loop
    execute format(
      'drop policy if exists "Autenticado le e grava" on public.%I;
       create policy "Autenticado le e grava" on public.%I
         for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'');',
      t, t
    );
  end loop;
end $$;
