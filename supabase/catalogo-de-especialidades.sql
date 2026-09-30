-- ============================================================================
-- Herval AI · catálogo de especialidades
--
-- >>> JÁ EXECUTADO no banco em 29/09/2026. Este arquivo é o registro do que foi
-- >>> rodado, não uma pendência. É repetível: rodar de novo não duplica nada.
-- ============================================================================
--
-- O que faz, em duas partes:
--
--   1. impede nome repetido em `especialidades`
--   2. carrega as 23 especialidades que os clientes da Herval executam
--   3. apaga as 3 que sobraram dos testes
--
-- Por que o passo 1 vem antes: a tabela não tinha nada que impedisse duas
-- linhas com o mesmo nome. Sem isso, rodar esta carga duas vezes deixaria o
-- formulário de cadastro com "Rinomodelação" aparecendo duas vezes, e quem
-- cadastrasse não teria como saber qual das duas marcar. O índice é o que
-- torna o `on conflict do nothing` do passo 2 possível.
--
-- A estrutura não muda além disso: nenhuma coluna criada, alterada ou removida.
-- `duracao_minutos` fica no padrão da tabela (40 minutos) para todas — é o
-- número que a Agenda vai usar quando existir, e ninguém informou a duração de
-- cada procedimento ainda. Quando informarem, é um UPDATE por linha.
--
-- As três especialidades que existiam antes ("Preenchimento labial", "Limpeza
-- de pele" e "Drenagem linfática") eram dado de teste e não estão na lista dos
-- 23 procedimentos. Saem no passo 3, por decisão de Pedro em 29/09/2026.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Nome único
-- ----------------------------------------------------------------------------
create unique index if not exists especialidades_nome_unico
  on public.especialidades (nome);


-- ----------------------------------------------------------------------------
-- 2. A carga
--
-- Os nomes estão exatamente como foram passados, inclusive a acentuação. Quem
-- cadastra reconhece a lista que usa no dia a dia; "corrigir" a grafia aqui
-- faria a tela mostrar uma palavra diferente da que a agência fala.
-- ----------------------------------------------------------------------------
insert into public.especialidades (nome)
values
  ('Harmonização facial'),
  ('Rinomodelação'),
  ('Rino Estruturada'),
  ('Blefaroplastia'),
  ('Diástase Abdominal'),
  ('Harmonização Íntima Masculina'),
  ('Harmonização Íntima Feminina'),
  ('Lipo Íntima Masculina'),
  ('Lipo Íntima Feminina'),
  ('Mini Lifting'),
  ('Lifting Facial'),
  ('Lipo de Papada'),
  ('Cervicoplastia'),
  ('Lobuloplastia'),
  ('Peeling'),
  ('Laser CO2'),
  ('Implante Capilar'),
  ('Clareamento Dental'),
  ('Facetas de Resina'),
  ('Facetas de Porcelana'),
  ('Implante Dentário'),
  ('Prótese Dentária'),
  ('Ortodontia')
on conflict (nome) do nothing;


-- ----------------------------------------------------------------------------
-- 3. As três de teste saem
--
-- Só é seguro porque nada aponta para elas: nenhum profissional, nenhum
-- cliente e nenhum lead. Vale conferir antes de rodar num banco com dado de
-- verdade — `leads.especialidade_interesse_id` NÃO apaga em cascata, e um lead
-- interessado numa especialidade apagada trava o DELETE.
-- ----------------------------------------------------------------------------
delete from public.especialidades
where nome in ('Preenchimento labial', 'Limpeza de pele', 'Drenagem linfática');
