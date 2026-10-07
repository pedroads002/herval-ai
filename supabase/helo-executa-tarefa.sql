-- ============================================================================
-- Herval AI · a Helô executa a tarefa que lhe foi atribuída
--
-- >>> EXECUTADO em 07/10/2026 no projeto hkmehycruprsqprwgeco.
-- >>> É repetível: rodar de novo não recria coluna e não apaga nada.
-- ============================================================================
--
-- `criar-tarefa-a-mao.sql` (06/10/2026) deixou isto escrito com todas as
-- letras: "**Tarefa atribuída à IA não é executada por ninguém ainda.** O n8n
-- só escreve em `tarefas`, nunca lê." Esta migration é a metade de banco da
-- fase que conserta isso — a outra metade é um workflow novo no n8n, com
-- gatilho de relógio, porque tarefa marcada para quinta às 14:30 tem que
-- disparar no horário e não quando o lead mandar mensagem.
--
-- ----------------------------------------------------------------------------
-- O que a Helô faz com a tarefa, e por que precisa de uma coluna nova
--
-- A cada rodada ela pega as tarefas `atribuido_a = 'IA'`, `Pendente`, com
-- `prazo_em` já liberado, e para cada uma confere as **mesmas quatro travas**
-- do cérebro (clínica permite, já houve conversa antes, especialidade ativa, IA
-- não pausada no lead) mais a instância de WhatsApp da clínica. Passando tudo,
-- ela escreve a mensagem, envia, grava em `mensagens` e fecha a tarefa como
-- `Concluída`.
--
-- Quando alguma trava barra — ou quando o prazo venceu há mais de três horas —
-- **nada é enviado**, e a tarefa **volta para o CRC**: `atribuido_a` passa de
-- 'IA' para 'CRC' e ela continua `Pendente`, com o mesmo prazo.
--
-- Voltar para o CRC é o desenho certo porque o trabalho continua existindo: a
-- tarefa não foi feita, e quem pediu precisa que alguém a faça. As alternativas
-- eram piores:
--   · deixar `Pendente` como 'IA' → a cada rodada ela tenta de novo para sempre
--     e ninguém descobre que está travada;
--   · gravar `Rejeitado` → esse status quer dizer "o CRC rejeitou a ação da
--     IA", e aqui ninguém rejeitou nada. A tela mentiria sobre quem decidiu;
--   · abrir uma segunda linha de alerta → o CRC veria a mesma tarefa duas vezes.
--
-- `motivo_devolucao` existe porque sem ela a tarefa trocaria de dono em
-- silêncio: o CRC abriria a fila e encontraria como sua uma tarefa que ele
-- havia passado para a Helô, sem nenhuma explicação na linha. O motivo não
-- cabe em `descricao` (é o texto que a pessoa escreveu, e reescrevê-lo apagaria
-- o pedido original) nem em `acao_sugerida` (é o que o cérebro redige para o
-- CRC fazer, e aqui o que se diz é por que a IA não fez).
--
-- Anulável e sem default: nulo quer dizer "nunca foi devolvida", que é o estado
-- de toda tarefa que existe hoje e da imensa maioria das que vão existir.
-- ----------------------------------------------------------------------------
alter table public.tarefas add column if not exists motivo_devolucao text;

-- Devolução só faz sentido na tarefa à mão: é a única que tem `atribuido_a`,
-- e devolver é justamente trocar essa atribuição. Tarefa do n8n não foi
-- atribuída a ninguém, logo não há de quem voltar.
alter table public.tarefas
  drop constraint if exists tarefas_devolucao_so_manual;

alter table public.tarefas
  add constraint tarefas_devolucao_so_manual check (
    motivo_devolucao is null or tipo = 'manual'
  );

comment on column public.tarefas.motivo_devolucao is
  'Por que a Helo nao executou a tarefa que lhe foi atribuida e a devolveu ao CRC (trava do cerebro, clinica sem instancia de WhatsApp, ou prazo vencido demais). Nulo quer dizer que nunca foi devolvida.';

-- ----------------------------------------------------------------------------
-- O índice da rodada do relógio
--
-- A consulta do workflow novo é sempre a mesma e roda a cada 5 minutos:
-- "tarefa à mão, da IA, pendente, com prazo até agora". Sem índice ela varre a
-- tabela inteira a cada rodada, e a tabela só cresce.
--
-- Índice parcial de propósito: as tarefas da IA são uma fatia pequena da fila,
-- e um índice que já nasce filtrado é menor e mais barato de manter do que um
-- índice sobre as três colunas inteiras. `tarefas_abertas_idx`, que a tela usa,
-- não serve aqui: ele ordena por `criado_em`, e o relógio pergunta por
-- `prazo_em`.
-- ----------------------------------------------------------------------------
create index if not exists tarefas_da_ia_idx
  on public.tarefas (prazo_em)
  where tipo = 'manual' and atribuido_a = 'IA' and status = 'Pendente';

-- ----------------------------------------------------------------------------
-- Acesso
--
-- Nada muda. O n8n conecta como dono e passa por cima de RLS, e é ele quem
-- grava `motivo_devolucao` e fecha a tarefa. O painel já tem `select` liberado
-- para quem está autenticado, e coluna nova entra nesse `select` sozinha — ele
-- lê o motivo e mostra na linha, sem precisar de política nova.
--
-- O painel **não** ganha permissão de escrever `motivo_devolucao`: devolução é
-- afirmação sobre o que a Helô tentou fazer, e quem pode afirmar isso é quem
-- tentou. A política de update do painel continua existindo para a decisão do
-- CRC, como antes.
-- ----------------------------------------------------------------------------
