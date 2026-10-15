-- Isolamento multi-tenant — Fase 4: leads, mensagens, agendamentos, tarefas,
-- notas e lead_etapa_eventos.
--
-- Hoje estas seis tabelas têm uma única política por tabela (ou, em tarefas/
-- notas/lead_etapa_eventos, políticas já separadas por comando, mas nenhuma
-- delas confere operação) que libera qualquer sessão autenticada para
-- qualquer linha. As duas rotas corrigidas antes desta fase (mídia e envio
-- manual) conferem a operação no código do Next — mas isso protege só essas
-- duas rotas. Toda leitura e escrita feita pelos Server Actions do painel
-- (Agenda, Funil, Fila de Tarefas, Visão Geral etc.) continua sem filtro
-- nenhum, porque nenhuma delas toca em `autorizacoes`.
--
-- Esta migration fecha isso na origem: a política passa a valer para
-- qualquer jeito de ler ou escrever estas tabelas por `authenticated`,
-- presente ou futuro, sem precisar caçar e corrigir cada função de
-- `lib/acoes` e `lib/dados` uma por uma.
--
-- O que ESTA migration não muda, de propósito:
--
-- 1. Conexões que não passam por `authenticated`/`anon` — o n8n lê e grava
--    com uma credencial Postgres própria, que é dona das tabelas (ou
--    `service_role`), e dono de tabela ignora RLS por padrão a menos que
--    `FORCE ROW LEVEL SECURITY` esteja ligado. Nenhuma tabela aqui tem isso
--    ligado, e esta migration não liga. Então o n8n continua enxergando tudo,
--    como hoje — mas ANTES DE RODAR, confirme com quem mantém o n8n qual
--    usuário Postgres a credencial "Supabase - Helô" usa: se por algum motivo
--    ela já rodar como um usuário comum (não dono, sem bypassrls), esta
--    migration bloquearia o n8n também, e isso tem que ser visto antes, não
--    descoberto depois.
-- 2. As rotas `src/app/api/crc/midia/route.ts` e `.../enviar/route.ts` — elas
--    continuam com a conferência própria delas. Esta migration vira uma
--    segunda tranca atrás da primeira, não a substitui.
-- 3. DELETE nas seis tabelas — nenhuma das duas políticas antigas de
--    `leads`/`mensagens`/`agendamentos` (ambas "ALL") tinha essa operação
--    exercida em lugar nenhum do código (conferido: nenhum `.delete()` do
--    painel aponta para estas seis tabelas). Em vez de herdar um DELETE
--    amplo que ninguém usa, esta migration simplesmente não cria política de
--    DELETE para `authenticated` — fica negado por padrão. Se o painel um dia
--    precisar apagar um lead ou uma mensagem, essa política entra nessa hora,
--    com o mesmo desenho de operação.
--
-- Pré-requisito: supabase/autorizacoes.sql já aplicado (tabela
-- `public.autorizacoes` existindo, com os dois admins Herval cadastrados).

-- ============================================================
-- Funções auxiliares
-- ============================================================

-- A operação do usuário logado, OU `null` se ele for Herval, OU `null` se não
-- tiver autorização nenhuma — os mesmos três casos de `operacaoDoUsuario()`
-- em `src/lib/autorizacao.ts`, aqui em SQL. É por isso que esta função nunca
-- é usada sozinha numa política: `clinica_id = operacao_do_usuario()` dá
-- falso tanto pro cliente sem autorização quanto pro lead sem clínica, e
-- nunca dá verdadeiro para a Herval (que não tem `clinica_id` nenhum pra
-- bater) — a Herval entra sempre pelo outro lado do `or`, em
-- `eh_herval_admin()`.
create or replace function public.operacao_do_usuario()
returns integer
language sql
stable
as $$
  select a.clinica_id
  from public.autorizacoes a
  where a.usuario_id = auth.uid()
    and a.ativo
    and a.papel in ('cliente_admin', 'cliente_operacional')
  limit 1;
$$;

-- Acesso global da Herval — mesma regra de `ehHervalAdmin()` no Next.
create or replace function public.eh_herval_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.autorizacoes a
    where a.usuario_id = auth.uid()
      and a.ativo
      and a.papel = 'herval_admin'
  );
$$;

-- O lead pertence à operação do usuário logado?
--
-- `mensagens`, `agendamentos`, `tarefas`, `notas` e `lead_etapa_eventos` não
-- têm `clinica_id` próprio — todas têm `lead_id not null`, e a clínica é
-- sempre a do lead (conferido no schema antes de escrever esta migration).
-- Esta função é o único lugar que faz essa travessia, para as cinco tabelas
-- pedirem a mesma pergunta da mesma forma.
create or replace function public.lead_na_operacao(p_lead_id integer)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.leads l
    where l.id = p_lead_id
      and l.clinica_id = public.operacao_do_usuario()
  );
$$;

-- Mesma lógica de "porta soma" de autorizacoes.sql: não contar com o padrão
-- do Postgres (EXECUTE para PUBLIC em função nova). Só quem está logado
-- chama; `anon` não.
revoke all on function public.operacao_do_usuario() from public;
revoke all on function public.eh_herval_admin() from public;
revoke all on function public.lead_na_operacao(integer) from public;
grant execute on function public.operacao_do_usuario() to authenticated;
grant execute on function public.eh_herval_admin() to authenticated;
grant execute on function public.lead_na_operacao(integer) to authenticated;

-- ============================================================
-- leads — a única tabela com clinica_id próprio
-- ============================================================

drop policy if exists "Autenticado le e grava" on public.leads;

create policy "le_a_propria_operacao"
  on public.leads for select
  to authenticated
  using (public.eh_herval_admin() or clinica_id = public.operacao_do_usuario());

create policy "cria_na_propria_operacao"
  on public.leads for insert
  to authenticated
  with check (public.eh_herval_admin() or clinica_id = public.operacao_do_usuario());

create policy "atualiza_a_propria_operacao"
  on public.leads for update
  to authenticated
  using (public.eh_herval_admin() or clinica_id = public.operacao_do_usuario())
  with check (public.eh_herval_admin() or clinica_id = public.operacao_do_usuario());

-- Flagrado na Fase 2 e nunca criado: toda leitura agora passa por aqui.
create index if not exists leads_clinica_id_idx on public.leads (clinica_id);

-- ============================================================
-- mensagens
-- ============================================================

drop policy if exists "Autenticado le e grava" on public.mensagens;

create policy "le_a_propria_operacao"
  on public.mensagens for select
  to authenticated
  using (public.eh_herval_admin() or public.lead_na_operacao(lead_id));

create policy "cria_na_propria_operacao"
  on public.mensagens for insert
  to authenticated
  with check (public.eh_herval_admin() or public.lead_na_operacao(lead_id));

create policy "atualiza_a_propria_operacao"
  on public.mensagens for update
  to authenticated
  using (public.eh_herval_admin() or public.lead_na_operacao(lead_id))
  with check (public.eh_herval_admin() or public.lead_na_operacao(lead_id));

-- ============================================================
-- agendamentos
-- ============================================================

drop policy if exists "Autenticado le e grava" on public.agendamentos;

create policy "le_a_propria_operacao"
  on public.agendamentos for select
  to authenticated
  using (public.eh_herval_admin() or public.lead_na_operacao(lead_id));

create policy "cria_na_propria_operacao"
  on public.agendamentos for insert
  to authenticated
  with check (public.eh_herval_admin() or public.lead_na_operacao(lead_id));

create policy "atualiza_a_propria_operacao"
  on public.agendamentos for update
  to authenticated
  using (public.eh_herval_admin() or public.lead_na_operacao(lead_id))
  with check (public.eh_herval_admin() or public.lead_na_operacao(lead_id));

-- ============================================================
-- tarefas — já tinha 3 políticas por comando; mantém nome e condição
-- original, só ADICIONA a operação com "and".
-- ============================================================

alter policy "tarefas_leitura_autenticada" on public.tarefas
  using (public.eh_herval_admin() or public.lead_na_operacao(lead_id));

alter policy "tarefas_criacao_autenticada" on public.tarefas
  with check (
    tipo = 'manual'
    and (public.eh_herval_admin() or public.lead_na_operacao(lead_id))
  );

alter policy "tarefas_decisao_autenticada" on public.tarefas
  using (public.eh_herval_admin() or public.lead_na_operacao(lead_id))
  with check (public.eh_herval_admin() or public.lead_na_operacao(lead_id));

-- ============================================================
-- notas — mesma ideia: mantém a condição de autoria, adiciona a operação.
-- ============================================================

alter policy "Equipe le as notas" on public.notas
  using (public.eh_herval_admin() or public.lead_na_operacao(lead_id));

alter policy "Equipe escreve nota" on public.notas
  with check (
    auth.uid() = autor_id
    and (public.eh_herval_admin() or public.lead_na_operacao(lead_id))
  );

-- ============================================================
-- lead_etapa_eventos — idem.
-- ============================================================

alter policy "Equipe le o historico de etapas" on public.lead_etapa_eventos
  using (public.eh_herval_admin() or public.lead_na_operacao(lead_id));

alter policy "Equipe registra mudanca de etapa" on public.lead_etapa_eventos
  with check (
    auth.uid() = autor_id
    and (public.eh_herval_admin() or public.lead_na_operacao(lead_id))
  );
