-- ============================================================================
-- Herval AI · tirar o "Só a partir de" da política de valores
--
-- >>> AS DUAS PARTES JÁ FORAM EXECUTADAS no banco em 01/10/2026. Este arquivo
-- >>> é o registro do que foi rodado.
-- ============================================================================
--
-- POR QUE A OPÇÃO SAIU
--
-- "Só a partir de" prometia o que a regra do valor médio proíbe: um piso
-- solitário — "a partir de R$ 800" — é meia faixa, e meia faixa é preço de
-- entrada com outro nome. Desde que o valor fechado deixou de existir no
-- sistema, essa opção não tinha mais efeito nenhum: escolhê-la fazia a Helô
-- responder exatamente igual a "Pode informar", porque é só isso que ela pode
-- fazer — dar a média aproximada se perguntarem, nunca fechar número.
--
-- Ver `valor-medio-por-procedimento.sql` para a regra que motivou a mudança.
--
-- ----------------------------------------------------------------------------
-- PARTE 1 — mover quem já estava na opção antiga (executada em 01/10/2026)
-- ----------------------------------------------------------------------------
--
-- Precisa vir ANTES da Parte 2: com as linhas antigas ainda no lugar, a trava
-- nova seria recusada pelo Postgres. Eram 2 clínicas, as duas cadastradas.
-- "Pode informar" é o equivalente exato hoje.

update public.clinicas
   set politica_de_valores = 'Pode informar'
 where politica_de_valores = 'Só a partir de';

-- ----------------------------------------------------------------------------
-- PARTE 2 — apertar a trava para as 3 opções (executada em 01/10/2026)
-- ----------------------------------------------------------------------------
--
-- A lista da tela já não oferece a opção removida. Esta trava é o que garante
-- que ela também não volte por fora do painel.

alter table public.clinicas
  drop constraint if exists clinicas_politica_de_valores_da_lista;
alter table public.clinicas
  add constraint clinicas_politica_de_valores_da_lista check (
    politica_de_valores is null
    or politica_de_valores in (
      'Pode informar',
      'Só se perguntarem',
      'Não informa antes da avaliação'
    )
  );
