-- Isolamento multi-tenant — Fase 5: clinicas, unidades, clinica_especialidades,
-- profissionais, profissional_especialidades, profissional_unidades,
-- follow_up_mensagens.
--
-- A Fase 4 fechou leads/mensagens/agendamentos/tarefas/notas/lead_etapa_eventos
-- — o lado "paciente" do painel. Estas sete tabelas são o lado "cadastro":
-- a ficha da própria clínica (preço, diferenciais, convênios — tudo guardado
-- em `clinicas`), as unidades, os profissionais e a régua de follow-up padrão.
-- Hoje `clinicas` e `profissionais` (e tudo pendurado neles) têm a mesma
-- política antiga de leads antes da Fase 4: qualquer `authenticated` lê e
-- grava qualquer linha. Na tela "Clientes", isso significa que um
-- `cliente_admin` de uma clínica enxerga — e edita — a ficha comercial de
-- toda clínica que a Herval atende, não só a própria.
--
-- `profissionais` não tem `clinica_id` próprio: o vínculo é profissional →
-- unidade (`profissional_unidades`) → clínica (`unidades.clinica_id`). Por
-- isso a função auxiliar desta fase é `profissional_na_operacao`, espelhando
-- `lead_na_operacao` da Fase 4, mas atravessando uma tabela em vez de ler um
-- campo direto.
--
-- Diferença importante para quem comparar com a Fase 4: lá nenhuma das seis
-- tabelas tinha DELETE em uso, e a migration não criou política de DELETE de
-- propósito. Aqui é o oposto — `src/lib/acoes/profissionais.ts` apaga
-- `clinicas`, `unidades` e `profissionais` em vários pontos (inclusive como
-- desfazer de cadastro malsucedido) — então esta migration cria DELETE em
-- todas as sete, com a mesma condição de operação das demais.
--
-- O que esta migration NÃO muda, pelos mesmos três motivos da Fase 4: n8n
-- continua enxergando tudo (dono de tabela/`service_role` ignora RLS); as
-- rotas que já conferem operação no código continuam com a conferência
-- própria delas; e nada aqui liga `FORCE ROW LEVEL SECURITY`.
--
-- Pré-requisito: Fase 4 (`isolamento-leads-mensagens.sql`) já aplicada — esta
-- migration reusa `operacao_do_usuario()` e `eh_herval_admin()` de lá.

-- ============================================================
-- Funções auxiliares novas desta fase
-- ============================================================

-- A unidade pertence à operação do usuário logado?
create or replace function public.unidade_na_operacao(p_unidade_id integer)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.unidades u
    where u.id = p_unidade_id
      and u.clinica_id = public.operacao_do_usuario()
  );
$$;

-- O profissional pertence à operação do usuário logado?
--
-- Atravessa `profissional_unidades` até `unidades.clinica_id`, porque
-- `profissionais` não guarda a clínica diretamente (um profissional só vira
-- "de alguém" quando entra numa unidade). Um profissional recém-criado, ainda
-- sem nenhuma unidade vinculada, não pertence à operação de ninguém (nem da
-- Herval, por este critério — ela entra pelo outro lado do `or`, como sempre)
-- — é esperado: o insert em `profissionais` sozinho não expõe nada, e o
-- vínculo seguinte em `profissional_unidades` é quem de fato precisa ser de
-- uma unidade própria.
create or replace function public.profissional_na_operacao(p_profissional_id integer)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profissional_unidades pu
    join public.unidades u on u.id = pu.unidade_id
    where pu.profissional_id = p_profissional_id
      and u.clinica_id = public.operacao_do_usuario()
  );
$$;

revoke all on function public.unidade_na_operacao(integer) from public;
revoke all on function public.profissional_na_operacao(integer) from public;
grant execute on function public.unidade_na_operacao(integer) to authenticated;
grant execute on function public.profissional_na_operacao(integer) to authenticated;

-- ============================================================
-- clinicas — a própria operação. Criar uma clínica nova continua sendo coisa
-- da Herval (é ela quem cadastra os clientes que atende, não o contrário);
-- ler e atualizar a própria ficha, o cliente já pode.
-- ============================================================

drop policy if exists "Autenticado le e grava" on public.clinicas;

create policy "le_a_propria_operacao"
  on public.clinicas for select
  to authenticated
  using (public.eh_herval_admin() or id = public.operacao_do_usuario());

create policy "cria_somente_herval"
  on public.clinicas for insert
  to authenticated
  with check (public.eh_herval_admin());

create policy "atualiza_a_propria_operacao"
  on public.clinicas for update
  to authenticated
  using (public.eh_herval_admin() or id = public.operacao_do_usuario())
  with check (public.eh_herval_admin() or id = public.operacao_do_usuario());

create policy "apaga_somente_herval"
  on public.clinicas for delete
  to authenticated
  using (public.eh_herval_admin());

-- ============================================================
-- unidades — diretamente de uma clínica. Aqui a própria operação pode criar,
-- editar e apagar unidade sua (é o próprio local de atendimento dela).
-- ============================================================

drop policy if exists "Autenticado le e grava" on public.unidades;

create policy "le_a_propria_operacao"
  on public.unidades for select
  to authenticated
  using (public.eh_herval_admin() or clinica_id = public.operacao_do_usuario());

create policy "cria_na_propria_operacao"
  on public.unidades for insert
  to authenticated
  with check (public.eh_herval_admin() or clinica_id = public.operacao_do_usuario());

create policy "atualiza_a_propria_operacao"
  on public.unidades for update
  to authenticated
  using (public.eh_herval_admin() or clinica_id = public.operacao_do_usuario())
  with check (public.eh_herval_admin() or clinica_id = public.operacao_do_usuario());

create policy "apaga_a_propria_operacao"
  on public.unidades for delete
  to authenticated
  using (public.eh_herval_admin() or clinica_id = public.operacao_do_usuario());

-- ============================================================
-- clinica_especialidades — preço por especialidade da própria clínica.
-- ============================================================

drop policy if exists "Autenticado le e grava" on public.clinica_especialidades;

create policy "le_a_propria_operacao"
  on public.clinica_especialidades for select
  to authenticated
  using (public.eh_herval_admin() or clinica_id = public.operacao_do_usuario());

create policy "cria_na_propria_operacao"
  on public.clinica_especialidades for insert
  to authenticated
  with check (public.eh_herval_admin() or clinica_id = public.operacao_do_usuario());

create policy "atualiza_a_propria_operacao"
  on public.clinica_especialidades for update
  to authenticated
  using (public.eh_herval_admin() or clinica_id = public.operacao_do_usuario())
  with check (public.eh_herval_admin() or clinica_id = public.operacao_do_usuario());

create policy "apaga_a_propria_operacao"
  on public.clinica_especialidades for delete
  to authenticated
  using (public.eh_herval_admin() or clinica_id = public.operacao_do_usuario());

-- ============================================================
-- profissionais — sem clinica_id próprio; ver profissional_na_operacao().
--
-- O INSERT libera para qualquer cliente autenticado (operacao_do_usuario()
-- não nulo), não só Herval: o código cria o profissional e, na sequência, o
-- vínculo em
-- `profissional_unidades` — é ESSA segunda escrita que confere a unidade
-- (ela sim sabe a clínica). Um `profissionais` solto, sem unidade, não
-- aparece pra ninguém (SELECT exige profissional_na_operacao) e o próprio
-- código já desfaz o cadastro quando o passo seguinte falha.
-- ============================================================

drop policy if exists "Autenticado le e grava" on public.profissionais;

create policy "le_a_propria_operacao"
  on public.profissionais for select
  to authenticated
  using (public.eh_herval_admin() or public.profissional_na_operacao(id));

create policy "cria_autenticado"
  on public.profissionais for insert
  to authenticated
  with check (
    public.eh_herval_admin() or public.operacao_do_usuario() is not null
  );

create policy "atualiza_a_propria_operacao"
  on public.profissionais for update
  to authenticated
  using (public.eh_herval_admin() or public.profissional_na_operacao(id))
  with check (public.eh_herval_admin() or public.profissional_na_operacao(id));

create policy "apaga_a_propria_operacao"
  on public.profissionais for delete
  to authenticated
  using (public.eh_herval_admin() or public.profissional_na_operacao(id));

-- ============================================================
-- profissional_especialidades — ligado ao profissional, não à unidade.
-- ============================================================

drop policy if exists "Autenticado le e grava" on public.profissional_especialidades;

create policy "le_a_propria_operacao"
  on public.profissional_especialidades for select
  to authenticated
  using (public.eh_herval_admin() or public.profissional_na_operacao(profissional_id));

create policy "cria_na_propria_operacao"
  on public.profissional_especialidades for insert
  to authenticated
  with check (public.eh_herval_admin() or public.profissional_na_operacao(profissional_id));

create policy "atualiza_a_propria_operacao"
  on public.profissional_especialidades for update
  to authenticated
  using (public.eh_herval_admin() or public.profissional_na_operacao(profissional_id))
  with check (public.eh_herval_admin() or public.profissional_na_operacao(profissional_id));

create policy "apaga_a_propria_operacao"
  on public.profissional_especialidades for delete
  to authenticated
  using (public.eh_herval_admin() or public.profissional_na_operacao(profissional_id));

-- ============================================================
-- profissional_unidades — o vínculo em si. Aqui a conferência é pela
-- UNIDADE, não pelo profissional: é o lado que sempre sabe a clínica, mesmo
-- no primeiro vínculo de um profissional recém-criado.
-- ============================================================

drop policy if exists "Autenticado le e grava" on public.profissional_unidades;

create policy "le_a_propria_operacao"
  on public.profissional_unidades for select
  to authenticated
  using (public.eh_herval_admin() or public.unidade_na_operacao(unidade_id));

create policy "cria_na_propria_operacao"
  on public.profissional_unidades for insert
  to authenticated
  with check (public.eh_herval_admin() or public.unidade_na_operacao(unidade_id));

create policy "atualiza_a_propria_operacao"
  on public.profissional_unidades for update
  to authenticated
  using (public.eh_herval_admin() or public.unidade_na_operacao(unidade_id))
  with check (public.eh_herval_admin() or public.unidade_na_operacao(unidade_id));

create policy "apaga_a_propria_operacao"
  on public.profissional_unidades for delete
  to authenticated
  using (public.eh_herval_admin() or public.unidade_na_operacao(unidade_id));

-- ============================================================
-- follow_up_mensagens — única tabela desta fase que já tinha RLS pensado
-- (só SELECT, `qual: true`). `clinica_id` aceita nulo de propósito: é o
-- texto padrão da régua antes de a clínica personalizar a própria. Nulo
-- continua público para todo autenticado; o que muda é que uma clínica só
-- enxerga a PRÓPRIA personalização, não a de outra. Sem política de escrita
-- antes desta migration e sem nenhum `.insert`/`.update` nestas tabelas
-- encontrado no código — então não cria nenhuma aqui, mantendo o padrão
-- atual (escrita só por quem administra o banco, ou pelo n8n/dono da
-- tabela).
-- ============================================================

alter policy "follow_up_mensagens_leitura_autenticada" on public.follow_up_mensagens
  using (
    clinica_id is null
    or public.eh_herval_admin()
    or clinica_id = public.operacao_do_usuario()
  );
