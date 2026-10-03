-- ============================================================================
-- Herval AI · canal de aquisição do lead
--
-- >>> JÁ EXECUTADO no banco em 03/10/2026. Este arquivo é o registro do que foi
-- >>> rodado, não uma pendência. É repetível: rodar de novo não recria nada.
-- ============================================================================
--
-- Prepara a estrutura para quando as UTMs e as APIs de anúncio chegarem. Nesta
-- fase é só o banco: nada no painel nem no cérebro do n8n escreve nestas
-- colunas ainda, e a integração vai pedir autorização separada.
--
-- Por que NÃO reaproveitar `origem`: ela responde outra pergunta — por qual
-- canal técnico o lead entrou (hoje sempre "WhatsApp" ou "Teste manual"). O
-- canal de aquisição é de onde veio o interesse (Meta Ads, Google Ads,
-- orgânico). Misturar os dois perderia uma das duas informações, e `origem` já
-- é lida pelo painel. `origem` fica exatamente como está.
--
-- Por que lista fechada em `canal_aquisicao`: o campo vai alimentar contagem
-- por canal. Com texto livre cada integração escreveria de um jeito e a conta
-- não fecharia. O literal é "Meta Ads", igual à constante `origensPagas` que já
-- existe em `src/data/leads.ts` — não "Facebook/Instagram".
--
-- Por que `DEFAULT 'Não identificado'` só aqui: lead sem canal reconhecido é um
-- fato normal (entrou direto no WhatsApp), e o default já deixa as linhas
-- antigas marcadas assim. Campanha, conjunto e anúncio não têm default porque
-- nulo ali quer dizer "não veio de anúncio nenhum" — inventar texto neutro
-- nesses três atrapalharia o cruzamento com as APIs.
--
-- `anuncio_id` é text, não número: os ids do Meta e do Google são cadeias
-- longas, e tratá-los como número estragaria o valor.
-- ============================================================================
alter table public.leads
  add column if not exists canal_aquisicao text default 'Não identificado';

alter table public.leads
  add column if not exists campanha text;

alter table public.leads
  add column if not exists conjunto_anuncio text;

alter table public.leads
  add column if not exists anuncio_id text;

alter table public.leads
  drop constraint if exists leads_canal_aquisicao_da_lista;

alter table public.leads
  add constraint leads_canal_aquisicao_da_lista check (
    canal_aquisicao is null
    or canal_aquisicao in (
      'Meta Ads',
      'Google Ads',
      'Orgânico',
      'Não identificado'
    )
  );

comment on column public.leads.canal_aquisicao is
  'De onde veio o interesse, em lista fechada: Meta Ads, Google Ads, Organico ou Nao identificado. Nao confundir com origem, que e o canal tecnico de entrada.';

comment on column public.leads.campanha is
  'Nome da campanha de anuncio que trouxe o lead. Nulo quando nao veio de anuncio.';

comment on column public.leads.conjunto_anuncio is
  'Nome do conjunto de anuncios. Nulo quando nao veio de anuncio.';

comment on column public.leads.anuncio_id is
  'Id do anuncio no Meta ou no Google, como texto. Nulo quando nao veio de anuncio.';
