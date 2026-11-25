-- ============================================================================
-- Herval AI · tela de Pacientes
--
-- Duas mudanças, pedidas em 24/11/2026:
--
-- 1. Excluir paciente. Até aqui `leads` não tinha política de DELETE, então
--    ninguém conseguia apagar um lead pelo painel. Passa a poder:
--    - a Herval, em qualquer clínica;
--    - o admin da clínica (`cliente_admin`), só na própria.
--    O colaborador (`cliente_operacional`) continua sem poder.
--    A exclusão apaga junto, pelas chaves estrangeiras em cascata, as
--    mensagens, agendamentos, vendas, notas, tarefas, mídias, ligações e o
--    histórico de etapas do lead. A memória da Helô no n8n
--    (n8n_chat_histories) não tem chave para `leads` e não é tocada.
--
-- 2. "pacientes" entra na lista de telas que o admin da clínica libera por
--    colaborador, em Equipe. Quem hoje está "sem restrição" (`null`) já vê a
--    tela nova; quem tem uma lista gravada só vê quando o admin marcar.
--
-- É repetível: rodar de novo não duplica nada.
-- ============================================================================

create or replace function public.eh_admin_da_operacao(clinica integer)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.autorizacoes a
    where a.usuario_id = auth.uid()
      and a.ativo
      and a.papel = 'cliente_admin'
      and a.clinica_id = clinica
  );
$$;

drop policy if exists apaga_na_propria_operacao on public.leads;
create policy apaga_na_propria_operacao on public.leads
  for delete
  using (public.eh_herval_admin() or public.eh_admin_da_operacao(clinica_id));

alter table public.autorizacoes
  drop constraint if exists autorizacoes_telas_da_lista;
alter table public.autorizacoes
  add constraint autorizacoes_telas_da_lista check (
    telas_permitidas is null
    or telas_permitidas <@ array['funil', 'atendimento', 'relatorios', 'agenda', 'pacientes']::text[]
  );
