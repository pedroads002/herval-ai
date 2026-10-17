-- ============================================================================
-- Herval AI · canal de fechamento do agendamento
--
-- >>> JÁ EXECUTADO no banco em 17/10/2026 (migração 20261017070006). Este
-- >>> arquivo é o registro do que foi rodado, não uma pendência. É repetível:
-- >>> rodar de novo não recria nada.
-- ============================================================================
--
-- A coluna foi criada direto no banco, sem arquivo versionado em `supabase/`,
-- no mesmo ciclo em que o Atendimento passou a marcar a consulta de verdade
-- via `marcarConsulta` (antes disso só existia um mock em memória). Este
-- arquivo só registra o que já está em produção, para o histórico não ficar
-- órfão — mesmo caso de `clinicas.cpf_cnpj` em
-- `cadastro-cliente-cpf-cnpj-e-codigo.sql`.
--
-- Por que lista fechada em `canal_fechamento`, e não texto livre: o campo
-- alimenta a contagem de Relatórios e Visão Geral (Ligação × WhatsApp). Com
-- texto livre cada tela gravaria de um jeito e a conta não fecharia.
--
-- Por que aceita nulo, sem default: todo agendamento marcado antes deste
-- campo existir não tem como saber por qual canal foi fechado — nulo é o
-- valor honesto, não "WhatsApp" por eliminação. Relatórios e Visão Geral
-- excluem quem está nulo da base do percentual, em vez de contar como
-- WhatsApp.
-- ============================================================================
alter table public.agendamentos
  add column if not exists canal_fechamento text;

alter table public.agendamentos
  drop constraint if exists agendamentos_canal_fechamento_valido;

alter table public.agendamentos
  add constraint agendamentos_canal_fechamento_valido check (
    canal_fechamento is null
    or canal_fechamento in ('Ligação', 'WhatsApp')
  );

comment on column public.agendamentos.canal_fechamento is
  'Como o agendamento foi fechado com o lead: Ligação (direta ou via WhatsApp) ou WhatsApp (mensagem). Nulo em consultas marcadas antes deste campo existir.';
