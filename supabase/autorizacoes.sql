-- Autorizações de acesso à Helô — Fase 1: identidade, papel e operação.
--
-- Hoje o painel sabe apenas se alguém está logado. Não sabe QUEM é a pessoa
-- dentro do negócio, nem a qual cliente da Herval ela pertence. Esta tabela é
-- o lugar onde essas duas respostas passam a existir — e só isso. Nenhuma
-- política das tabelas operacionais é alterada aqui, e nada no painel lê esta
-- tabela ainda: enquanto ela estiver vazia, a Helô funciona exatamente como
-- antes.
--
-- Três decisões que estão dentro do desenho:
--
-- 1. A operação continua sendo `public.clinicas`. Não existe tabela de
--    "tenants" — ela seria um segundo nome para o mesmo fato, e `clinicas` já
--    distingue profissional individual de equipe pelo `tipo_operacao`.
--
-- 2. Um usuário tem UMA autorização. Isso não é uma regra escrita num
--    comentário: é a chave primária ser `usuario_id`. Para um dia permitir
--    acesso a mais de uma operação, troca-se a chave primária por
--    (usuario_id, clinica_id) — a tabela não precisa ser refeita.
--
-- 3. Ninguém se promove. Não existe NENHUMA política de escrita aqui, e o
--    `authenticated` recebe apenas SELECT da própria linha. Conceder e
--    revogar acesso é operação de dono do banco (SQL editor), nunca algo que
--    saia do navegador. É por isso que o papel NÃO mora em `profiles`: lá o
--    próprio usuário tem permissão de update.
--
-- Ausência de linha = ausência de autorização. Nunca administrador.

create table if not exists public.autorizacoes (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  papel text not null,
  clinica_id integer references public.clinicas (id) on delete restrict,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null,
  atualizado_em timestamptz,

  -- Minúsculo porque é código interno, não texto de tela. É a mesma forma de
  -- `clinicas.tipo_operacao` ('individual' / 'equipe') e de `tarefas.tipo`
  -- ('manual'). Title Case neste projeto é reservado ao que o usuário lê.
  constraint autorizacoes_papel_da_lista check (
    papel = any (array['herval_admin', 'cliente_admin', 'cliente_operacional'])
  ),

  -- O administrador da Herval não recebe vínculo artificial com clínica
  -- nenhuma, e cliente nenhum existe sem operação. As duas metades da mesma
  -- regra, para que o banco recuse a linha incoerente em vez de o código ter
  -- que desconfiar dela depois.
  constraint autorizacoes_operacao_coerente check (
    (papel = 'herval_admin' and clinica_id is null)
    or (papel <> 'herval_admin' and clinica_id is not null)
  )
);

-- Para responder "quais usuários pertencem a esta operação?" sem varrer a
-- tabela. O Postgres não indexa chave estrangeira sozinho.
create index if not exists autorizacoes_clinica_id_idx
  on public.autorizacoes (clinica_id);

alter table public.autorizacoes enable row level security;

-- A única política da tabela. Leitura da própria linha, nada mais: um cliente
-- não consegue nem listar quem mais tem acesso, nem descobrir a operação de
-- outra pessoa.
create policy "Cada um le a propria autorizacao"
  on public.autorizacoes
  for select
  using (auth.uid() = usuario_id);

-- Política sozinha não basta. O Supabase concede permissões a `anon` e
-- `authenticated` por padrão em tabela nova no schema public, e permissão
-- concedida é a porta; a política é só a tranca. Aqui a porta some.
revoke all on public.autorizacoes from anon;
revoke all on public.autorizacoes from authenticated;
grant select on public.autorizacoes to authenticated;
