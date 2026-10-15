-- Conferência do isolamento multi-tenant — Fase 4 (leads, mensagens,
-- agendamentos, tarefas, notas, lead_etapa_eventos).
--
-- Diferença para conferir-autorizacoes.sql: aquele testava CHECK/FK, que
-- valem para qualquer role. RLS só entra em ação para quem não é dono da
-- tabela — então este teste troca de role no meio da transação
-- (`set local role authenticated`) e simula o usuário logado com
-- `request.jwt.claims`, exatamente como o PostgREST faz. `set local` e o
-- role de volta por `reset role` valem só dentro desta transação.
--
-- Pode rodar quantas vezes quiser, em qualquer ambiente: tudo o que insere
-- (2 clínicas de teste, 2 leads de teste) e tudo o que atualiza (as
-- autorizações dos dois admins Herval reais, temporariamente) desfaz sozinho
-- no `raise exception` do fim — é rollback, não limpeza manual. O resultado
-- vem no texto da mensagem de erro.
--
-- Pré-requisito: supabase/isolamento-leads-mensagens.sql já aplicado.
--
-- O que cada teste prova:
--   A1  cliente da operação A vê o próprio lead
--   A2  cliente da operação A NÃO vê o lead da operação B
--   A3  cliente da operação A NÃO vê a mensagem do lead da operação B
--   B1  cliente da operação B NÃO vê o lead da operação A (o espelho de A2,
--       noutro usuário real — A2 sozinho não provaria nada se o primeiro
--       usuário testado por acaso enxergasse tudo por outro motivo)
--   C1  Herval admin vê os leads das duas operações
--
-- Último resultado: (rode e preencha aqui depois de aplicar a migration)

do $$
declare
  u1 uuid := '3d931baf-839e-42ab-9ce6-5308349d5e38'; -- admin Herval real nº1
  u2 uuid := '827fdc59-8732-47b4-815d-6ccd9bcce910'; -- admin Herval real nº2
  clinica_a integer;
  clinica_b integer;
  lead_a integer;
  lead_b integer;
  n integer;
  r text := '';
begin
  insert into public.clinicas (nome) values ('TESTE RLS A') returning id into clinica_a;
  insert into public.clinicas (nome) values ('TESTE RLS B') returning id into clinica_b;

  insert into public.leads (nome, telefone, clinica_id, origem)
    values ('Lead Teste RLS A', '000000000001', clinica_a, 'Teste RLS')
    returning id into lead_a;
  insert into public.leads (nome, telefone, clinica_id, origem)
    values ('Lead Teste RLS B', '000000000002', clinica_b, 'Teste RLS')
    returning id into lead_b;

  insert into public.mensagens (lead_id, remetente_tipo, texto)
    values (lead_b, 'Lead', 'mensagem de teste RLS');

  -- u1 vira cliente_admin da operação A só para este bloco.
  update public.autorizacoes set papel = 'cliente_admin', clinica_id = clinica_a
    where usuario_id = u1;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', u1::text)::text, true);

  select count(*) into n from public.leads where id = lead_a;
  r := r || case when n = 1 then 'A1=ok ' else format('A1=FALHOU(viu %s) ', n) end;

  select count(*) into n from public.leads where id = lead_b;
  r := r || case when n = 0 then 'A2=ok ' else 'A2=FALHOU(viu o da operacao B) ' end;

  select count(*) into n from public.mensagens where lead_id = lead_b;
  r := r || case when n = 0 then 'A3=ok ' else 'A3=FALHOU(viu mensagem da operacao B) ' end;

  reset role;

  -- u2 vira cliente_admin da operação B, no lugar do próprio admin Herval.
  update public.autorizacoes set papel = 'cliente_admin', clinica_id = clinica_b
    where usuario_id = u2;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', u2::text)::text, true);

  select count(*) into n from public.leads where id = lead_a;
  r := r || case when n = 0 then 'B1=ok ' else 'B1=FALHOU(viu o da operacao A) ' end;

  reset role;

  -- Restaura os dois antes de testar a Herval, mesmo que o rollback final
  -- já fosse restaurar sozinho — assim o teste C1 vale por si, sem depender
  -- da ordem de limpeza.
  update public.autorizacoes set papel = 'herval_admin', clinica_id = null where usuario_id = u1;
  update public.autorizacoes set papel = 'herval_admin', clinica_id = null where usuario_id = u2;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', u1::text)::text, true);

  select count(*) into n from public.leads where id in (lead_a, lead_b);
  r := r || case when n = 2 then 'C1=ok ' else format('C1=FALHOU(viu %s de 2) ', n) end;

  reset role;

  raise exception 'RESULTADO: %', r;
end $$;
