-- Conferência da tabela `public.autorizacoes` — Fase 1.
--
-- Pode rodar quantas vezes quiser, em qualquer ambiente: o bloco SEMPRE
-- termina em `raise exception`, e isso desfaz tudo o que ele inseriu. Nenhuma
-- linha sobra, nem quando todos os testes passam. O resultado vem no texto da
-- mensagem de erro — o "erro" é o rollback, não uma falha.
--
-- O que cada teste prova:
--   A  administrador da Herval não pode ter operação vinculada
--   B  usuário de cliente não pode existir sem operação
--   C  papel fora da lista é recusado
--   D  não existe vínculo com operação inexistente
--   E  não existe vínculo com usuário inexistente
--   F1 uma linha coerente é aceita
--   F2 o mesmo usuário não consegue ter uma segunda operação
--   G  uma operação pode ter vários usuários
--
-- Último resultado (09/10/2026, projeto hkmehycruprsqprwgeco):
--   A=ok B=ok C=ok D=ok E=ok F1=ok F2=ok G=ok(2 na mesma operacao)

do $$
declare
  -- Dois usuários que existem, só para satisfazer a chave estrangeira. Troque
  -- pelos ids do ambiente onde estiver rodando, se forem outros.
  u1 uuid := (select id from auth.users order by created_at limit 1);
  u2 uuid := (select id from auth.users order by created_at desc limit 1);
  c integer := (select min(id) from public.clinicas);
  r text := '';
begin
  begin
    insert into public.autorizacoes (usuario_id, papel, clinica_id) values (u1,'herval_admin',c);
    r := r || 'A=FALHOU(aceitou) ';
  exception when check_violation then r := r || 'A=ok ';
  end;

  begin
    insert into public.autorizacoes (usuario_id, papel, clinica_id) values (u1,'cliente_admin',null);
    r := r || 'B=FALHOU(aceitou) ';
  exception when check_violation then r := r || 'B=ok ';
  end;

  begin
    insert into public.autorizacoes (usuario_id, papel, clinica_id) values (u1,'super_admin',null);
    r := r || 'C=FALHOU(aceitou) ';
  exception when check_violation then r := r || 'C=ok ';
  end;

  begin
    insert into public.autorizacoes (usuario_id, papel, clinica_id) values (u1,'cliente_admin',999999);
    r := r || 'D=FALHOU(aceitou) ';
  exception when foreign_key_violation then r := r || 'D=ok ';
  end;

  begin
    insert into public.autorizacoes (usuario_id, papel, clinica_id)
      values ('00000000-0000-0000-0000-000000000000','herval_admin',null);
    r := r || 'E=FALHOU(aceitou) ';
  exception when foreign_key_violation then r := r || 'E=ok ';
  end;

  insert into public.autorizacoes (usuario_id, papel, clinica_id) values (u1,'cliente_admin',c);
  r := r || 'F1=ok ';

  begin
    insert into public.autorizacoes (usuario_id, papel, clinica_id)
      values (u1,'cliente_admin',(select max(id) from public.clinicas));
    r := r || 'F2=FALHOU(duas operacoes) ';
  exception when unique_violation then r := r || 'F2=ok ';
  end;

  insert into public.autorizacoes (usuario_id, papel, clinica_id)
    values (u2,'cliente_operacional',c);
  r := r || 'G=ok(' || (select count(*) from public.autorizacoes where clinica_id = c) || ' na mesma operacao) ';

  raise exception 'RESULTADO: %', r;
end $$;

-- Conferência das permissões (esta é leitura pura, roda separada).
--
-- Esperado: auth_select = true, e TODO o resto false.
--
-- select
--   (select count(*) from public.autorizacoes) as linhas,
--   (select relrowsecurity from pg_class where oid='public.autorizacoes'::regclass) as rls_ligada,
--   has_table_privilege('authenticated','public.autorizacoes','SELECT') as auth_select,
--   has_table_privilege('authenticated','public.autorizacoes','INSERT') as auth_insert,
--   has_table_privilege('authenticated','public.autorizacoes','UPDATE') as auth_update,
--   has_table_privilege('authenticated','public.autorizacoes','DELETE') as auth_delete,
--   has_table_privilege('anon','public.autorizacoes','SELECT') as anon_select,
--   has_table_privilege('anon','public.autorizacoes','INSERT') as anon_insert,
--   has_table_privilege('anon','public.autorizacoes','UPDATE') as anon_update,
--   has_table_privilege('anon','public.autorizacoes','DELETE') as anon_delete;
