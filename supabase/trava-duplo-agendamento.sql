-- ============================================================================
-- Herval AI · trava de duplo agendamento
--
-- >>> JÁ EXECUTADO no banco em 30/09/2026. Este arquivo é o registro do que foi
-- >>> rodado, não uma pendência. É repetível: rodar de novo não recria nada.
-- ============================================================================
--
-- Nada no banco impedia marcar dois leads diferentes no mesmo profissional, no
-- mesmo dia e na mesma hora. A tela não avisava, a ação de gravar não conferia,
-- e as duas consultas apareciam empilhadas na mesma faixa da grade — ninguém vê
-- na tela e todo mundo descobre no dia.
--
-- A conferência principal mora na ação da tela (`lib/acoes/agenda.ts`), porque é
-- lá que dá para recusar em português. Este índice é a última barreira: ele pega
-- o caso em que duas pessoas marcam o mesmo horário no mesmo instante, e a
-- conferência de lá viu o horário livre nas duas.
--
-- Por que é índice parcial, e não constraint:
--
--   status = 'Agendada'          faltou, compareceu e cancelou é passado, e
--                                passado não ocupa horário. Sem este filtro,
--                                remarcar quem faltou às 14:00 para outro dia
--                                deixaria as 14:00 travadas para sempre.
--   profissional_id not null     consulta sem profissional ainda não ocupa a
--                                agenda de ninguém: ela espera distribuição.
--   hora_consulta not null       só o dia combinado não ocupa hora nenhuma.
--
-- O que ele NÃO faz: olhar a duração do procedimento. Uma consulta de 40 minutos
-- às 14:00 não impede outra às 14:20. A trava é da hora exata, que é o caso que
-- acontece de verdade — dois atendentes marcando "14:00".
-- ============================================================================
create unique index if not exists agendamentos_sem_duplo_agendamento
  on public.agendamentos (profissional_id, data_consulta, hora_consulta)
  where status = 'Agendada'
    and profissional_id is not null
    and hora_consulta is not null;
