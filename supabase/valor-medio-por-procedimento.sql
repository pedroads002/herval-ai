-- ============================================================================
-- Herval AI · valor médio no lugar do preço fechado
--
-- >>> A PARTE 1 JÁ FOI EXECUTADA no banco em 01/10/2026. Este arquivo é o
-- >>> registro do que foi rodado. A PARTE 2 (derrubar `valor`) está AQUI DE
-- >>> PROPÓSITO E AINDA NÃO FOI RODADA — ver a condição logo abaixo dela.
-- ============================================================================
--
-- A REGRA QUE MUDOU
--
-- Preço fechado deixa de existir como conceito no sistema, em qualquer campo e
-- para qualquer fim. O número que a paciente pode tomar como combinado é dito
-- de viva voz, na consulta de avaliação, e não fica guardado em lugar nenhum.
-- O motivo é legal: a Helô não pode "fechar" valor fora da avaliação.
--
-- A única forma de valor que o sistema passa a conhecer é uma FAIXA de valor
-- médio aproximado, por procedimento e por clínica. Faixa, e não um número
-- único, por dois motivos práticos: um número solitário é lido como preço
-- mesmo quando se chama de média, e campo de texto livre é onde alguém acaba
-- escrevendo "R$ 950 fechado".
--
-- ----------------------------------------------------------------------------
-- PARTE 1 — criar a faixa (executada em 01/10/2026)
-- ----------------------------------------------------------------------------

alter table clinica_especialidades
  add column valor_medio_de numeric(10,2),
  add column valor_medio_ate numeric(10,2);

-- Meia faixa não é faixa: "a partir de R$ 800" sozinho é justamente o que a
-- política "Não informa antes da avaliação" proíbe. Ou os dois limites, ou
-- nenhum.
alter table clinica_especialidades
  add constraint clinica_especialidades_faixa_completa
    check ((valor_medio_de is null) = (valor_medio_ate is null));

-- E faixa com os dois limites iguais é preço fechado com outro nome: "de
-- R$ 950 a R$ 950" é uma cotação. O limite de cima tem de ser maior.
alter table clinica_especialidades
  add constraint clinica_especialidades_faixa_ordenada
    check (valor_medio_de is null or
           (valor_medio_de > 0 and valor_medio_ate > valor_medio_de));

comment on column clinica_especialidades.valor_medio_de is
  'Limite inferior da faixa de valor médio aproximado. Nunca preço fechado.';
comment on column clinica_especialidades.valor_medio_ate is
  'Limite superior da faixa de valor médio aproximado. Nunca preço fechado.';

-- ----------------------------------------------------------------------------
-- PARTE 2 — derrubar o preço fechado (AINDA NÃO RODADA)
-- ----------------------------------------------------------------------------
--
-- A coluna `valor` não é lida por nenhuma linha de código do painel. Quem a lê
-- é o cérebro: o node "Contexto e Travas" do workflow `Helô - base` monta
-- `especialidades_ativas` com `'valor', ce.valor`, e o prompt do Supervisor1
-- formata aquilo como "R$ 950,00".
--
-- Por isso esta parte NÃO pode rodar antes da outra: derrubar a coluna com a
-- consulta do n8n ainda apontando para ela faz a consulta falhar, e a Helô
-- para de responder no meio das conversas.
--
-- CONDIÇÃO PARA RODAR: o workflow `Helô - base` já estar publicado com a
-- consulta lendo `valor_medio_de` / `valor_medio_ate` e sem nenhuma menção a
-- `ce.valor`.

-- alter table clinica_especialidades drop column valor;
