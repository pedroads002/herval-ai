-- ============================================================================
-- Herval AI · valor da consulta de avaliação
--
-- Aprovado em 18/10/2026, junto com a reconstrução da aba Clínica do
-- Atendimento (ver AbasDoAtendimento.tsx / ConversaReal.tsx e a Estratégia do
-- Cliente em FormularioEstrategia.tsx).
-- ============================================================================
--
-- POR QUE ISTO É UMA EXCEÇÃO, E NÃO UMA VOLTA ATRÁS
--
-- `valor-medio-por-procedimento.sql` derrubou todo preço fechado do sistema: o
-- número que a paciente pode tomar como combinado só é dito de viva voz, na
-- consulta de avaliação, porque fechar valor fora dali é problema legal para o
-- cliente.
--
-- Este número é outro: é o preço da PRÓPRIA consulta de avaliação, não de um
-- procedimento. Não é estimativa — é o que a clínica decidiu cobrar por aquela
-- consulta, e cada cliente cobra o que quiser. Faixa não serve aqui: faixa é
-- para quando o valor real varia (um procedimento complexo custa mais ou
-- menos dependendo do caso), e o preço de uma consulta não varia de paciente
-- para paciente.
--
-- A regra de nunca fechar preço de PROCEDIMENTO continua de pé, inteira. Esta
-- coluna não abre exceção nenhuma nela.
--
-- IMPORTANTE: gravar este valor aqui não faz a Helô falar dele por conta
-- própria. O prompt do `Supervisor1`, no workflow `Helô - base`, ainda não foi
-- ajustado para ler esta coluna — isso é um passo separado, no n8n, ainda não
-- aprovado. Até lá o valor fica só no cadastro, para o CRC ver na aba Clínica
-- do Atendimento.

alter table clinicas
  add column if not exists avaliacao_valor numeric(10,2);

alter table clinicas
  drop constraint if exists clinicas_avaliacao_valor_positivo;
alter table clinicas
  add constraint clinicas_avaliacao_valor_positivo
    check (avaliacao_valor is null or avaliacao_valor > 0);

comment on column clinicas.avaliacao_valor is
  'Preço da própria consulta de avaliação (não de procedimento), quando avaliacao_gratuita = false. Nulo = gratuita, ou ainda não informado. Decidido pela clínica, não é estimativa — por isso é número único, não faixa.';
