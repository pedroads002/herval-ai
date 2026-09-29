-- ============================================================================
-- Herval AI · trancar a memória de conversa da Helô
--
-- >>> JÁ EXECUTADO no banco em 29/09/2026, por Pedro, pelo SQL Editor.
-- >>> Este arquivo é o registro do que foi rodado, não uma pendência.
-- >>> Conferido depois: RLS ligada, 0 políticas, nenhuma permissão para a
-- >>> chave pública — e a Helô continuou gravando a conversa normalmente.
-- ============================================================================
--
-- A tabela n8n_chat_histories guarda o que a Helô e o lead disseram um ao
-- outro. É a memória dela: sem isso, a IA recomeçaria do zero a cada frase.
--
-- HOJE ELA ESTÁ ABERTA. É a única tabela do banco sem RLS — as outras dez já
-- estão trancadas. E as permissões da chave pública nela são estas:
--
--     anon: SELECT, INSERT, UPDATE, DELETE, TRUNCATE
--
-- A chave pública ("anon") vai dentro do JavaScript que o navegador baixa; ela
-- é pública de propósito, e quem a torna inofensiva é a RLS de cada tabela.
-- Sem RLS aqui, qualquer pessoa que abra a tela de login e leia o código-fonte
-- pode ler todas as conversas — e apagá-las.
--
-- São 26 mensagens de teste hoje. A partir da entrada de clientes reais, são
-- conversas de paciente de clínica: sintoma, procedimento, preço. Dado
-- sensível de saúde, com LGPD em cima.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. A tranca
-- ----------------------------------------------------------------------------
-- Ligar a RLS sem criar nenhuma política significa "ninguém entra por esta
-- porta". É o que queremos: o painel nunca lê esta tabela — conferido, não há
-- uma linha de código que a mencione. Quem precisa dela é só o n8n.

alter table public.n8n_chat_histories enable row level security;

-- ----------------------------------------------------------------------------
-- 2. Tirar as permissões da chave pública
-- ----------------------------------------------------------------------------
-- Isto NÃO é redundante com o passo 1, e o motivo é uma armadilha do Postgres:
--
--   A RLS filtra SELECT, INSERT, UPDATE e DELETE — linha a linha.
--   O TRUNCATE não passa por ela. É permissão de tabela, e ignora a RLS.
--
-- Ou seja: só com o passo 1, ninguém conseguiria ler nem escrever, mas ainda
-- conseguiria apagar a tabela inteira de uma vez. O passo 2 fecha isso.
--
-- O service_role fica intacto: ele é a chave secreta, vive só no servidor e
-- nunca chega ao navegador.

revoke all on table public.n8n_chat_histories from anon, authenticated;

-- ----------------------------------------------------------------------------
-- O que este arquivo NÃO faz, de propósito
-- ----------------------------------------------------------------------------
-- Não usa "force row level security". O "force" faria a tranca valer também
-- para o dono da tabela (postgres) — que é exatamente a conexão que o n8n usa
-- para gravar. Forçar aqui derrubaria a memória da Helô.
--
-- O n8n continua funcionando porque ele já escreve em `leads` e `mensagens`,
-- que já estão com RLS ligada, pela mesma credencial. Esta tabela passa a ser
-- tratada como as outras, e não de um jeito novo.

-- ============================================================================
-- Confere: deve mostrar rls_ligada = true e politicas = 0.
-- ============================================================================
select c.relname          as tabela,
       c.relrowsecurity   as rls_ligada,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as politicas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'n8n_chat_histories';

-- Confere: a chave pública não pode mais nada. Deve vir VAZIO.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'n8n_chat_histories'
  and grantee in ('anon', 'authenticated');
