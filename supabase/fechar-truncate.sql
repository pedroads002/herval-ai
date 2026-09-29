-- ============================================================================
-- Herval AI · fechar o TRUNCATE da chave pública
--
-- >>> JÁ EXECUTADO no banco em 29/09/2026. Este arquivo é o registro do que
-- >>> foi rodado, não uma pendência. Rodar de novo não faz mal (é repetível),
-- >>> mas não é necessário.
-- ============================================================================
--
-- O QUE ESTÁ ERRADO HOJE
--
-- A RLS de cada tabela filtra SELECT, INSERT, UPDATE e DELETE linha a linha.
-- Ela NÃO cobre TRUNCATE: apagar a tabela inteira de uma vez é permissão de
-- tabela e passa por cima da RLS.
--
-- Todas as dez tabelas abaixo estão com RLS ligada e, mesmo assim, dão
-- TRUNCATE para `anon` — a chave pública que vai dentro do JavaScript que o
-- navegador baixa. Na prática: quem abre a tela de login, lê o código-fonte e
-- pega a chave NÃO consegue ler nem alterar uma linha, mas CONSEGUE esvaziar
-- a tabela de leads, de mensagens e de notas. De uma vez, sem deixar rastro
-- de linha.
--
-- Isso não é uma falha nova nem algo que alguém configurou errado: é o padrão
-- do Supabase para tabelas criadas no schema `public`. Foi descoberto ao
-- trancar a `n8n_chat_histories` e conferido em todas as outras.
--
-- O QUE ESTE ARQUIVO FAZ
--
--   1. Tira o TRUNCATE de `anon` e de `authenticated` nas dez tabelas.
--   2. Muda o PADRÃO, para que toda tabela criada daqui em diante já nasça
--      sem esse furo — sem isso, o conserto vale só para as tabelas de hoje.
--
-- O QUE NÃO MUDA
--
--   · Nenhuma estrutura: nenhuma coluna criada, alterada ou removida.
--   · Nenhuma linha de dado: nada é lido, escrito ou apagado.
--   · O painel: ele lê e grava como `authenticated`, e continua com SELECT,
--     INSERT, UPDATE e DELETE. Só perde a permissão de esvaziar tabela, que
--     ele nunca usou e nunca deve usar.
--   · O n8n: escreve como dono da tabela (`postgres`), que não é afetado por
--     nenhum dos comandos abaixo.
--   · O `service_role`: é a chave secreta, vive só no servidor, fica intacta.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. As dez tabelas que estão expostas agora
-- ----------------------------------------------------------------------------
-- Em ordem de gravidade do que se perderia: leads e conversas primeiro.

revoke truncate on table public.leads                  from anon, authenticated;
revoke truncate on table public.mensagens              from anon, authenticated;
revoke truncate on table public.notas                  from anon, authenticated;
revoke truncate on table public.lead_etapa_eventos     from anon, authenticated;
revoke truncate on table public.clinicas               from anon, authenticated;
revoke truncate on table public.clinica_especialidades from anon, authenticated;
revoke truncate on table public.especialidades         from anon, authenticated;
revoke truncate on table public.objecoes               from anon, authenticated;

-- Havia mais duas tabelas na lista original: "Pedro Herval" e "Equipe Herval".
-- Estavam vazias e tinham só `id` e `created_at` — nasceram por engano. Foram
-- apagadas em 29/09/2026, depois de conferido que não tinham nenhuma linha e
-- que nada apontava para elas. Por isso não aparecem nos comandos acima: hoje
-- não existem, e o `revoke` nelas daria erro.

-- A `n8n_chat_histories` não está na lista porque já foi fechada antes, junto
-- com a RLS dela. As quatro tabelas da seção Profissionais também já nasceram
-- fechadas.


-- ----------------------------------------------------------------------------
-- 2. O padrão, para não reabrir sozinho
-- ----------------------------------------------------------------------------
-- Sem este passo, o conserto acima dura até a próxima tabela ser criada.
--
-- O banco guarda uma regra de "permissões padrão": quando `postgres` cria uma
-- tabela em `public`, ela já nasce dando tudo para `anon` e `authenticated` —
-- TRUNCATE incluído. Tabela criada pelo editor do Supabase ou pelo SQL Editor
-- é criada por `postgres`, então é esta a regra que vale para nós.
--
-- Depois disto, tabela nova continua nascendo com SELECT, INSERT, UPDATE e
-- DELETE para o painel (o normal, e a RLS decide quem vê o quê), mas já sem
-- TRUNCATE para ninguém além do dono.

alter default privileges for role postgres in schema public
  revoke truncate on tables from anon;

alter default privileges for role postgres in schema public
  revoke truncate on tables from authenticated;


-- ============================================================================
-- Confere 1: quem ainda pode truncar alguma tabela do painel.
-- Deve vir VAZIO.
-- ============================================================================
select table_name, grantee
from information_schema.role_table_grants
where table_schema = 'public'
  and privilege_type = 'TRUNCATE'
  and grantee in ('anon', 'authenticated')
order by table_name, grantee;

-- ============================================================================
-- Confere 2: o painel continua podendo trabalhar.
-- Deve mostrar SELECT, INSERT, UPDATE e DELETE para `authenticated`,
-- em cada tabela, e nenhum TRUNCATE.
-- ============================================================================
select table_name,
       string_agg(privilege_type, ', ' order by privilege_type) as pode
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'authenticated'
  and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
group by table_name
order by table_name;

-- ============================================================================
-- Confere 3: o padrão de tabela nova, agora sem o TRUNCATE.
-- No resultado, `anon` e `authenticated` devem aparecer como `arwdxt`
-- (sem o `D`, que é o TRUNCATE). O dono segue com `arwdDxtm`.
-- ============================================================================
select pg_get_userbyid(d.defaclrole) as papel_que_cria,
       d.defaclacl::text            as permissoes_padrao
from pg_default_acl d
join pg_namespace n on n.oid = d.defaclnamespace
where n.nspname = 'public'
  and d.defaclobjtype = 'r'
  and pg_get_userbyid(d.defaclrole) = 'postgres';
