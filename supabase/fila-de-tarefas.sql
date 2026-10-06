-- ============================================================================
-- Herval AI · fila de tarefas
--
-- >>> EXECUTADO em 06/10/2026 no projeto hkmehycruprsqprwgeco.
-- >>> É repetível: rodar de novo não recria nada e não apaga nada.
-- ============================================================================
--
-- Tira a Fila de Tarefas do exemplo fixo. Hoje `tarefasIniciais` em
-- `src/data/tarefas.ts` é um array vazio, e a tela mostra fila zerada mesmo
-- quando o cérebro da Helô acabou de sinalizar algo para o CRC.
--
-- O que o n8n sinaliza hoje são as três travas de atendimento e os dois casos
-- de clínica sem instância de WhatsApp — e só em `mensagens`, misturado com a
-- conversa do lead. Mensagem é registro do que foi dito; tarefa é trabalho
-- pendente com decisão em cima. São duas perguntas diferentes, e é por isso
-- que isto é tabela própria e não uma coluna nova em `mensagens`: o CRC precisa
-- de "o que está aberto agora", e isso não se responde varrendo conversa.
--
-- Os 16 gatilhos de `reguaAutomacao.ts` NÃO entram aqui: três deles são de
-- executor humano (lead novo do Meta Ads, lead novo do site, no-show), e
-- nenhum dos três existe no n8n hoje — não há intake de anúncio, não há
-- formulário de site e nada lê `agendamentos.status = 'Faltou'`. Esta fase
-- grava o que de fato é sinalizado; o catálogo entra quando os gatilhos
-- existirem de verdade.
--
-- Por que `tipo` com 'acao-ia' na lista mas sem uso: o tipo já existe no
-- painel (`TipoTarefa` em `src/data/tarefas.ts`) e a fila distingue alerta de
-- ação aprovável. Deixar o valor fora do check agora obrigaria a mexer na
-- constraint depois, e mexer em constraint de tabela com dados é mais caro que
-- deixar a porta aberta desde o começo. Nenhuma linha nasce 'acao-ia' nesta
-- fase.
--
-- Por que `check` e não enum nativo: é o padrão que o projeto já usa
-- (`leads_canal_aquisicao_da_lista`), e alterar enum do Postgres depois é bem
-- mais caro que alterar um check.
--
-- Por que `acao_sugerida` aceita nulo: alerta humano nem sempre tem ação
-- redigida. "A clínica não tem instância de WhatsApp" é aviso de
-- infraestrutura, não sugestão de abordagem. Nulo ali é um fato, não um buraco,
-- e inventar texto neutro faria a tela afirmar uma recomendação que ninguém
-- escreveu.
--
-- Por que `decidido_em`: sem ele `criado_em` sozinho não distingue "pendente há
-- três horas" de "resolvida em dois minutos" — as duas linhas teriam a mesma
-- idade. É o único campo que dá para medir tempo de resposta do CRC depois.
--
-- Por que PRAZO EM MINUTOS e não em horas: a trava bloqueia o atendimento de um
-- lead que está esperando resposta agora, e o prazo certo para isso é 30
-- minutos — meia hora não é número inteiro de horas, e guardar hora fracionada
-- em float para representar isso é pior que guardar minuto inteiro. O painel
-- divide por 60 na leitura, porque a tela mede em horas.
--
-- Os dois patamares de prazo, e por que não são o mesmo:
--   · travas 1, 2 e 3 → 30 min. O lead mandou mensagem, a IA não pode
--     responder, e alguém precisa assumir. É fila de atendimento.
--   · sem instância (chat e lembrete) → 1440 min (24h). A urgência real é "a
--     clínica está sem WhatsApp configurado", problema de infraestrutura da
--     clínica, não lead esperando. Forçar 30 min aqui encheria a fila de
--     vermelho que ninguém resolve em meia hora.
--
-- Por que `prazo_em_minutos` é NOT NULL com default de 24h: todo sinal que esta
-- fase grava tem prazo definido, e coluna nula obrigaria a tela a desenhar um
-- caminho "tarefa sem prazo" que hoje não existe em nenhum sinal. Se algum dia
-- aparecer tarefa realmente sem prazo, a mudança é um `drop not null` — mais
-- barato que um caminho morto na interface.
--
-- `lead_id` com `on delete cascade`: tarefa de lead apagado não tem dono.
-- ============================================================================
create table if not exists public.tarefas (
  id bigserial primary key,
  lead_id integer not null references public.leads (id) on delete cascade,
  tipo text not null default 'alerta-humano',
  regra text not null,
  acao_sugerida text,
  status text not null default 'Pendente',
  prazo_em_minutos integer not null default 1440,
  criado_em timestamptz not null default now(),
  decidido_em timestamptz
);

alter table public.tarefas
  drop constraint if exists tarefas_tipo_da_lista;

alter table public.tarefas
  add constraint tarefas_tipo_da_lista check (
    tipo in ('acao-ia', 'alerta-humano')
  );

alter table public.tarefas
  drop constraint if exists tarefas_status_da_lista;

alter table public.tarefas
  add constraint tarefas_status_da_lista check (
    status in ('Pendente', 'Aprovado', 'Rejeitado', 'Avisado')
  );

-- Prazo negativo ou zero não quer dizer nada: "vence em 0 minutos" é o mesmo
-- que não ter prazo, e o atraso é calculado a partir de `criado_em`, não guardado.
alter table public.tarefas
  drop constraint if exists tarefas_prazo_positivo;

alter table public.tarefas
  add constraint tarefas_prazo_positivo check (prazo_em_minutos > 0);

-- Decisão sem data, ou data de decisão em tarefa ainda pendente, seria estado
-- impossível: o painel mediria tempo de resposta em cima de linha incoerente.
alter table public.tarefas
  drop constraint if exists tarefas_decisao_coerente;

alter table public.tarefas
  add constraint tarefas_decisao_coerente check (
    (status = 'Pendente' and decidido_em is null)
    or (status <> 'Pendente' and decidido_em is not null)
  );

create index if not exists tarefas_lead_id_idx on public.tarefas (lead_id);

-- A fila lê sempre "o que está aberto, mais antigo primeiro". É esta a consulta
-- que a tela faz, e sem o índice ela varre a tabela inteira.
create index if not exists tarefas_abertas_idx
  on public.tarefas (status, criado_em desc);

comment on table public.tarefas is
  'Trabalho pendente sinalizado pelo cerebro da Helo para o CRC humano decidir. Nao confundir com mensagens, que e o registro do que foi dito ao lead.';

comment on column public.tarefas.tipo is
  'alerta-humano: aviso para a equipe agir por conta propria, a IA nunca executa. acao-ia: acao que a IA executa depois de aprovada. Reservado, sem uso nesta fase.';

comment on column public.tarefas.regra is
  'Qual sinal disparou a tarefa, no mesmo vocabulario que o n8n ja grava em mensagens.regra. Ex.: Trava 2 - primeiro contato e humano.';

comment on column public.tarefas.acao_sugerida is
  'O que se recomenda fazer. Nulo quando o sinal e aviso de infraestrutura e nao ha acao redigida.';

comment on column public.tarefas.prazo_em_minutos is
  'Minutos a partir de criado_em para a tarefa vencer. 30 para as travas de atendimento (lead esperando), 1440 para sem instancia (problema da clinica).';

comment on column public.tarefas.decidido_em is
  'Quando o CRC decidiu. Nulo enquanto Pendente. Sem isto nao ha como medir tempo de resposta do CRC.';

-- ============================================================================
-- Acesso
--
-- RLS ligada e leitura liberada para quem está autenticado no painel: a tarefa
-- não é dado de um usuário, é trabalho da operação, e todo mundo que entra no
-- painel é da operação. O recorte por clínica é feito na tela, como nas outras
-- telas.
--
-- Escrita fica com o n8n, que conecta como dono e passa por cima de RLS. O
-- painel só muda `status` e `decidido_em`, e por isso tem update próprio.
--
-- Sobre o `revoke truncate`: política de RLS não cobre TRUNCATE, então sem isso
-- a role do painel esvaziaria a tabela inteira com um comando e nenhuma política
-- impediria. O padrão do banco já foi corrigido em 29/09/2026 por
-- `fechar-truncate.sql`, e por isso tabela nova já nasce sem TRUNCATE para
-- `anon` e `authenticated` — os dois comandos abaixo são rede de segurança,
-- não o conserto. Ficam porque custam nada e porque este arquivo precisa valer
-- por si, inclusive num banco onde aquele padrão não tenha sido aplicado.
--
-- `anon` não ganha política nenhuma de propósito: a chave pública vai dentro do
-- JavaScript que o navegador baixa, e com RLS ligada e nenhuma política para
-- `anon` ela não lê nem grava uma linha.
-- ============================================================================
alter table public.tarefas enable row level security;

drop policy if exists tarefas_leitura_autenticada on public.tarefas;

create policy tarefas_leitura_autenticada on public.tarefas
  for select
  to authenticated
  using (true);

drop policy if exists tarefas_decisao_autenticada on public.tarefas;

create policy tarefas_decisao_autenticada on public.tarefas
  for update
  to authenticated
  using (true)
  with check (true);

revoke truncate on public.tarefas from authenticated;
revoke truncate on public.tarefas from anon;
