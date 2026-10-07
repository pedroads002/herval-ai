-- ============================================================================
-- Herval AI · criar tarefa à mão
--
-- >>> EXECUTADO em 06/10/2026 no projeto hkmehycruprsqprwgeco.
-- >>> É repetível: rodar de novo não recria coluna e não apaga nada.
-- ============================================================================
--
-- A Fila de Tarefas nasceu só com entrada automática: as cinco sinalizações do
-- cérebro da Helô (as três travas de atendimento e os dois casos de clínica sem
-- instância de WhatsApp). Não havia como abrir uma tarefa à mão — e metade do
-- trabalho do CRC é justamente aquilo que ninguém programou: "retornar o
-- contato do lead X na quinta às 14:30".
--
-- Esta migration acrescenta quatro colunas e dois valores de lista. Nenhuma
-- coluna existente muda, e o n8n continua gravando exatamente como gravava:
-- todas as colunas novas aceitam nulo, e nulo é o que o n8n deixa.
--
-- ----------------------------------------------------------------------------
-- `prazo_em` (data e hora livres)
--
-- `prazo_em_minutos` já existia e serve ao n8n: a trava dispara e o prazo é
-- "30 minutos a partir de agora". Mas ele não sabe dizer "quinta, 08/10, às
-- 14:30" — contagem a partir da criação não é data marcada, e obrigar quem cria
-- a calcular quantos minutos faltam até quinta-feira seria pedir para a pessoa
-- fazer a conta que o computador existe para fazer.
--
-- As duas convivem porque respondem a coisas diferentes, e nenhuma das duas
-- substitui a outra sem perder informação:
--   · tarefa do n8n   → `prazo_em_minutos`, `prazo_em` nulo
--   · tarefa à mão    → `prazo_em` com data e hora, `prazo_em_minutos` no default
-- O painel converte minutos em data e hora na leitura, então na tela as duas
-- aparecem do mesmo jeito. A conversão é de ida só, e é por isso que ela mora
-- na leitura e não aqui: gravar a data calculada congelaria um prazo que o
-- n8n pensa em minutos.
--
-- Sem `check` de data futura: tarefa com prazo no passado é normal — o CRC
-- registra na segunda algo que devia ter sido feito no sábado, e recusar isso
-- obrigaria a mentir a data para conseguir registrar.
--
-- ----------------------------------------------------------------------------
-- `descricao`
--
-- O motivo da tarefa, escrito por quem a criou. Não dá para reaproveitar
-- `regra` nem `acao_sugerida`: `regra` é o nome do sinal do n8n ("Trava 2 -
-- primeiro contato é humano"), vocabulário fechado que a conversa do lead em
-- `mensagens.regra` também usa, e `acao_sugerida` é o texto que o cérebro
-- redigiu. Enfiar texto livre de uma pessoa em qualquer um dos dois faria a
-- tela misturar o que a Helô sinalizou com o que um humano pediu.
--
-- ----------------------------------------------------------------------------
-- `atribuido_a` ('CRC' ou 'IA')
--
-- Hoje quem executa é **calculado** a partir do `tipo`: alerta humano é sempre
-- do humano, ação da IA é sempre da IA, e ninguém escolhe. Para tarefa criada à
-- mão isso não serve: a mesma tarefa — "retornar o contato" — pode ser do CRC
-- ou da Helô, e é a pessoa que cria quem decide.
--
-- Nulo nas tarefas automáticas, de propósito: lá a resposta continua saindo do
-- tipo, que é a única fonte, e preencher a coluna com o valor derivado criaria
-- um segundo lugar onde a mesma verdade poderia passar a discordar de si mesma.
--
-- **Tarefa atribuída à IA não é executada por ninguém ainda.** O n8n só escreve
-- em `tarefas`, nunca lê. A linha fica Pendente até existir a fase que faz a
-- Helô ler esta fila, e o painel diz isso na tela em vez de dar a impressão de
-- que ela já pegou o trabalho.
--
-- ----------------------------------------------------------------------------
-- `criado_por`
--
-- O nome de quem criou, assinado pelo servidor a partir da sessão. Nulo quer
-- dizer n8n. Sem esta coluna não há como distinguir, na própria linha, trabalho
-- que o sistema sinalizou de trabalho que uma pessoa pediu — e é essa diferença
-- que decide de quem se cobra a tarefa.
--
-- ----------------------------------------------------------------------------
-- `tipo = 'manual'` e `status = 'Concluída'`
--
-- Tarefa criada à mão não é nenhum dos dois tipos que existiam. `acao-ia` é
-- ação que a IA propôs e o humano aprova ou rejeita; `alerta-humano` é aviso
-- para a equipe agir. Tarefa à mão é o contrário das duas: a decisão já foi
-- tomada por quem criou, e o que falta é fazer. Reusar `alerta-humano` colocaria
-- o botão "Avisar CRC" numa tarefa que o próprio CRC escreveu, e reusar
-- `acao-ia` ofereceria "Aprovar" e "Rejeitar" para um pedido já aprovado.
--
-- Por isso o status novo: o que fecha uma tarefa à mão é "foi feita", e
-- nenhuma das quatro decisões que existiam diz isso. Marcar "Aprovado" para
-- "ligar para o lead" seria registro errado num campo que vai ser lido depois
-- para medir tempo de resposta do CRC.
-- ============================================================================
alter table public.tarefas add column if not exists prazo_em timestamptz;

alter table public.tarefas add column if not exists descricao text;

alter table public.tarefas add column if not exists atribuido_a text;

alter table public.tarefas add column if not exists criado_por text;

alter table public.tarefas
  drop constraint if exists tarefas_tipo_da_lista;

alter table public.tarefas
  add constraint tarefas_tipo_da_lista check (
    tipo in ('acao-ia', 'alerta-humano', 'manual')
  );

alter table public.tarefas
  drop constraint if exists tarefas_status_da_lista;

alter table public.tarefas
  add constraint tarefas_status_da_lista check (
    status in ('Pendente', 'Aprovado', 'Rejeitado', 'Avisado', 'Concluída')
  );

alter table public.tarefas
  drop constraint if exists tarefas_atribuicao_da_lista;

alter table public.tarefas
  add constraint tarefas_atribuicao_da_lista check (
    atribuido_a is null or atribuido_a in ('CRC', 'IA')
  );

-- As quatro colunas novas andam juntas, e só na tarefa à mão.
--
-- Tarefa `manual` sem prazo, sem descrição ou sem atribuição seria uma linha
-- que a tela não consegue desenhar: ela existe exatamente para dizer o que
-- fazer, para quando e de quem. E tarefa automática com atribuição preenchida
-- teria duas respostas para "quem executa" — a da coluna e a derivada do tipo.
--
-- `criado_por` entra na mesma regra porque é a assinatura do ato: tarefa à mão
-- sem autor não dá para cobrar de ninguém, e tarefa do n8n com autor seria
-- atribuir a uma pessoa trabalho que o sistema sinalizou sozinho.
alter table public.tarefas
  drop constraint if exists tarefas_manual_coerente;

alter table public.tarefas
  add constraint tarefas_manual_coerente check (
    (
      tipo = 'manual'
      and prazo_em is not null
      and descricao is not null
      and atribuido_a is not null
      and criado_por is not null
    )
    or (
      tipo <> 'manual'
      and prazo_em is null
      and atribuido_a is null
      and criado_por is null
    )
  );

-- A fila agrupa por prazo, e o prazo da tarefa à mão é esta coluna.
create index if not exists tarefas_prazo_em_idx
  on public.tarefas (prazo_em);

comment on column public.tarefas.prazo_em is
  'Data e hora marcadas para a tarefa, escolhidas por quem a criou. Nulo nas tarefas do n8n, que usam prazo_em_minutos contado a partir de criado_em.';

comment on column public.tarefas.descricao is
  'O motivo da tarefa, em texto livre, escrito por quem criou. Nulo nas tarefas do n8n, onde quem explica e regra mais acao_sugerida.';

comment on column public.tarefas.atribuido_a is
  'Quem executa a tarefa criada a mao: CRC (humano) ou IA (a Helo). Nulo nas tarefas do n8n, onde quem executa sai do tipo. Tarefa atribuida a IA ainda nao e executada: o n8n nao le esta tabela.';

comment on column public.tarefas.criado_por is
  'Nome de quem criou a tarefa, assinado pela sessao do painel. Nulo quer dizer que foi o n8n.';

-- ============================================================================
-- Acesso
--
-- A tabela nasceu com leitura e update para quem está autenticado, e escrita
-- só para o n8n, que conecta como dono e passa por cima de RLS. Agora o painel
-- precisa inserir — mas **só tarefa à mão**.
--
-- É o que o `with check` garante: sem ele, o painel poderia inserir uma linha
-- com `tipo = 'alerta-humano'` e um `regra` qualquer, ou seja, falsificar uma
-- sinalização do cérebro da Helô. Ninguém faria isso de propósito; a questão é
-- que a chave do painel vai dentro do navegador, e o que ela pode fazer é o
-- que qualquer pessoa autenticada pode fazer.
--
-- `anon` continua sem política nenhuma: com RLS ligada e nenhuma política para
-- ela, a chave pública não lê nem grava uma linha.
-- ============================================================================
drop policy if exists tarefas_criacao_autenticada on public.tarefas;

create policy tarefas_criacao_autenticada on public.tarefas
  for insert
  to authenticated
  with check (tipo = 'manual');
