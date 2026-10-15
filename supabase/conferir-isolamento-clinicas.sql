-- Conferência do isolamento multi-tenant — Fase 5 (clinicas, unidades,
-- clinica_especialidades, profissionais, profissional_especialidades,
-- profissional_unidades).
--
-- Mesma técnica de conferir-isolamento.sql (Fase 4): troca de role dentro da
-- transação (`set local role authenticated` + `request.jwt.claims`), tudo
-- desfeito pelo `raise exception` do fim. Pode rodar quantas vezes quiser.
--
-- O que cada teste prova:
--   A1  cliente da operação A vê a própria clínica
--   A2  cliente da operação A NÃO vê a clínica B
--   A3  cliente da operação A NÃO vê o profissional da operação B (prova que
--       profissional_na_operacao() atravessa profissional_unidades/unidades
--       corretamente, não só que clinicas está protegida)
--   B1  cliente da operação B NÃO vê a clínica A (o espelho de A2, noutro
--       usuário real)
--   C1  Herval admin vê as duas clínicas
--
-- Pré-requisito: isolamento-clinicas-profissionais.sql já aplicado.
--
-- Último resultado: (rode e preencha aqui depois de aplicar a migration)

do $$
declare
  u1 uuid := '3d931baf-839e-42ab-9ce6-5308349d5e38'; -- admin Herval real nº1
  u2 uuid := '827fdc59-8732-47b4-815d-6ccd9bcce910'; -- admin Herval real nº2
  clinica_a integer;
  clinica_b integer;
  unidade_a integer;
  unidade_b integer;
  profissional_b integer;
  n integer;
  r text := '';
begin
  insert into public.clinicas (nome) values ('TESTE RLS clinicas A') returning id into clinica_a;
  insert into public.clinicas (nome) values ('TESTE RLS clinicas B') returning id into clinica_b;

  insert into public.unidades (clinica_id, nome) values (clinica_a, 'Unidade teste A') returning id into unidade_a;
  insert into public.unidades (clinica_id, nome) values (clinica_b, 'Unidade teste B') returning id into unidade_b;

  insert into public.profissionais (nome, tipo) values ('Profissional Teste B', 'Médico') returning id into profissional_b;
  insert into public.profissional_unidades (profissional_id, unidade_id) values (profissional_b, unidade_b);

  -- u1 vira cliente_admin da operação A só para este bloco.
  update public.autorizacoes set papel = 'cliente_admin', clinica_id = clinica_a
    where usuario_id = u1;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', u1::text)::text, true);

  select count(*) into n from public.clinicas where id = clinica_a;
  r := r || case when n = 1 then 'A1=ok ' else format('A1=FALHOU(viu %s) ', n) end;

  select count(*) into n from public.clinicas where id = clinica_b;
  r := r || case when n = 0 then 'A2=ok ' else 'A2=FALHOU(viu a clinica B) ' end;

  select count(*) into n from public.profissionais where id = profissional_b;
  r := r || case when n = 0 then 'A3=ok ' else 'A3=FALHOU(viu o profissional da clinica B) ' end;

  reset role;

  -- u2 vira cliente_admin da operação B, no lugar do próprio admin Herval.
  update public.autorizacoes set papel = 'cliente_admin', clinica_id = clinica_b
    where usuario_id = u2;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', u2::text)::text, true);

  select count(*) into n from public.clinicas where id = clinica_a;
  r := r || case when n = 0 then 'B1=ok ' else 'B1=FALHOU(viu a clinica A) ' end;

  reset role;

  -- Restaura os dois antes de testar a Herval, mesma razão da Fase 4: C1
  -- vale por si, sem depender da ordem de limpeza.
  update public.autorizacoes set papel = 'herval_admin', clinica_id = null where usuario_id = u1;
  update public.autorizacoes set papel = 'herval_admin', clinica_id = null where usuario_id = u2;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', u1::text)::text, true);

  select count(*) into n from public.clinicas where id in (clinica_a, clinica_b);
  r := r || case when n = 2 then 'C1=ok ' else format('C1=FALHOU(viu %s de 2) ', n) end;

  reset role;

  raise exception 'RESULTADO: %', r;
end $$;
