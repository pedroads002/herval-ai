-- ============================================================================
-- Herval AI · motivo da perda no lead
--
-- >>> JÁ EXECUTADO no banco em 30/09/2026. Este arquivo é o registro do que foi
-- >>> rodado, não uma pendência. É repetível: rodar de novo não recria nada.
-- ============================================================================
--
-- Mover um lead para "Venda Perdida" sempre cobrou o motivo numa lista fechada,
-- mas o motivo morava só na memória do navegador: recarregar a página e ele
-- sumia, deixando o lead perdido sem explicação nenhuma. Agora que o Funil grava
-- etapa no banco, o motivo precisa de coluna.
--
-- Por que lista fechada, e não texto livre: este campo alimenta o card "Motivos
-- de perda" da Visão Geral. Com texto digitado cada pessoa escreve de um jeito e
-- a contagem não fecha. A mesma lista vive em `motivosDePerda`, em
-- `src/data/leads.ts` — mexer em uma sem mexer na outra faz a tela oferecer
-- opção que o banco recusa.
--
-- O que o CHECK NÃO faz: exigir que a etapa seja "Venda Perdida" para o motivo
-- existir. Seria a regra certa no papel, mas o cérebro no n8n também escreve em
-- `leads`, e uma regra que cruza duas colunas quebraria a gravação dele por
-- ordem de atualização — etapa primeiro, motivo depois. Quem limpa o motivo ao
-- tirar o lead de "Venda Perdida" é a aplicação, em `lib/acoes/etapaDoLead.ts`.
-- ============================================================================
alter table public.leads
  add column if not exists motivo_perda text;

alter table public.leads
  drop constraint if exists leads_motivo_perda_da_lista;

alter table public.leads
  add constraint leads_motivo_perda_da_lista check (
    motivo_perda is null
    or motivo_perda in (
      'Clicou errado',
      'Convênio',
      'Localização distante',
      'Perdeu o interesse',
      'Fechou em outra clínica',
      'Não atende o procedimento',
      'Sem dinheiro',
      'Spam',
      'Outros'
    )
  );

comment on column public.leads.motivo_perda is
  'Motivo da perda, da lista fechada de motivosDePerda em src/data/leads.ts. Nulo fora de "Venda Perdida" — quem limpa ao sair da etapa e a aplicacao.';
