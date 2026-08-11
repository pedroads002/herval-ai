-- ============================================================================
-- Herval AI · tabela de perfis dos usuários
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Pode rodar mais de uma vez sem quebrar nada.
-- ============================================================================

-- 1) Tabela ligada aos usuários de autenticação do Supabase.
--    Apagar o usuário em Authentication apaga o perfil junto (on delete cascade).
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nome       text,
  sobrenome  text,
  email      text
);

-- 2) Segurança por linha: cada pessoa só enxerga o próprio perfil.
alter table public.profiles enable row level security;

drop policy if exists "Usuario le o proprio perfil" on public.profiles;
create policy "Usuario le o proprio perfil"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Usuario atualiza o proprio perfil" on public.profiles;
create policy "Usuario atualiza o proprio perfil"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 3) Ao criar um usuário em Authentication > Users, a linha do perfil já nasce
--    junto (só com o e-mail). Depois é só preencher nome e sobrenome na tabela.
create or replace function public.criar_perfil_do_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row
  execute function public.criar_perfil_do_usuario();

-- 4) Cria o perfil de usuários que já existiam antes deste script.
insert into public.profiles (id, email)
select u.id, u.email from auth.users u
on conflict (id) do nothing;
