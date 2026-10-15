-- Autocadastro de clientes — convite com link + código de acesso.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Pode rodar mais de uma vez sem quebrar nada.
-- ============================================================================
--
-- O que esta tabela resolve: hoje, dar login a um cliente é `provisionar-
-- cliente` criar a conta por ele (convite do próprio Supabase, por e-mail).
-- A partir daqui existe um segundo caminho — pedido no documento "Auto
-- cadastro de clientes": a Herval gera um link, o cliente abre e preenche o
-- próprio cadastro (nome, e-mail, CPF/CNPJ, senha). As duas portas continuam
-- de pé; esta tabela é só o controle da nova.
--
-- Duas decisões dentro do desenho, registradas aqui para não se perderem:
--
-- 1. Código de acesso é segundo fator, não é senha da operação. O link
--    sozinho (token de 32 bytes, impossível de adivinhar) já bastaria como
--    segredo — o código existe para o caso do link ser encaminhado ou
--    vazado: a Herval manda o link por um canal e o código por outro (ex.:
--    e-mail e WhatsApp), e quem só tiver um dos dois não completa o
--    cadastro. Por isso o código é curto (8 caracteres, fácil de digitar) e
--    de uso único — este desenho não precisa dele resistir a força bruta por
--    si só, porque pressupõe o token já em mãos.
--
-- 2. Nunca grava o código em texto puro. A coluna `clinicas.codigo_acesso`
--    que existia antes era um rascunho de teste (texto puro, nunca usado por
--    código nenhum) — esta versão guarda hash + sal, no mesmo espírito de
--    como o próprio Supabase Auth guarda senha. Comparação sempre em tempo
--    constante, feita em `src/lib/convites.ts`.
--
-- Fica de fora de propósito, por agora: convite de colaborador (cliente_admin
-- convidando a própria equipe) é a próxima fase, não esta. O desenho aqui —
-- tabela própria, história preservada por linha — já suporta isso quando
-- chegar a vez, sem precisar ser refeito.

alter table public.clinicas
  drop column if exists codigo_acesso;

alter table public.clinicas
  add column if not exists cpf_cnpj text;

create table if not exists public.convites (
  token         text primary key,
  clinica_id    integer not null references public.clinicas (id) on delete cascade,

  -- Hoje só 'cliente_admin' chega por aqui (é o botão "Convidar cliente" da
  -- tela Clientes). 'cliente_operacional' já está na lista porque é o mesmo
  -- papel que o convite de colaborador vai usar — sem repetir o CHECK depois.
  papel         text not null check (papel = any (array['cliente_admin', 'cliente_operacional'])),

  codigo_hash   text not null,
  codigo_sal    text not null,

  -- Errou demais, o convite morre. Sem isso, o código de 8 caracteres —
  -- curto de propósito, para digitar fácil — ficaria exposto a tentativa
  -- repetida enquanto o link continuasse válido.
  tentativas    integer not null default 0,

  criado_por    uuid references auth.users (id) on delete set null,
  criado_em     timestamptz not null default now(),
  expira_em     timestamptz not null,

  -- Os dois ficam nulos até o cadastro ser concluído. Depois disso o convite
  -- é história, não é mais usado para autorizar nada.
  usado_em        timestamptz,
  usuario_criado  uuid references auth.users (id) on delete set null
);

create index if not exists convites_clinica_id_idx on public.convites (clinica_id);

alter table public.convites enable row level security;

-- Nenhuma política. Diferente de `autorizacoes` (que concede SELECT da
-- própria linha), aqui não existe "própria linha" — quem teria uma ainda não
-- tem conta nenhuma. Todo acesso passa pela service_role, dentro de rotas de
-- servidor que primeiro confirmam o privilégio certo (herval_admin para criar
-- o convite; ninguém, além da própria rota, para validar e consumir o
-- token). Ver `src/lib/supabase/admin.ts`.
revoke all on public.convites from anon;
revoke all on public.convites from authenticated;
