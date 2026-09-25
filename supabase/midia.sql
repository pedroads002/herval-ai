-- ============================================================================
-- Herval AI · guardar a referência da mídia de uma mensagem
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Pode rodar mais de uma vez sem quebrar nada.
-- ============================================================================
--
-- Hoje áudio, imagem e vídeo chegam e ficam registrados só pelo formato: a
-- linha diz "veio um áudio" e nada mais. O conteúdo em si se perde, e o CRC
-- não tem como ouvir o que o lead mandou.
--
-- O que falta é o identificador da mensagem no WhatsApp. Com ele, a Evolution
-- devolve o arquivo quando alguém abre a conversa.
--
-- POR QUE NÃO GUARDAR O ARQUIVO AQUI, que seria o caminho óbvio:
--
--   1. As URLs que o WhatsApp manda são criptografadas. Não abrem no
--      navegador, não valem como link — só a Evolution sabe decifrá-las.
--   2. Guardar o arquivo exigiria um bucket de armazenamento, com custo por
--      gigabyte e por tráfego, e uma segunda cópia de cada foto e áudio.
--   3. A Evolution já guarda. Copiar criaria duas versões do mesmo arquivo,
--      livres para divergir quando uma for apagada e a outra não.
--
-- O preço dessa escolha é honesto e vale dizer: se a Evolution apagar a mídia
-- antiga, a conversa no painel perde o áudio e fica só com o rótulo. O texto
-- e o registro de que houve um áudio permanecem — some o conteúdo, não o fato.
-- ============================================================================

alter table public.mensagens
  add column if not exists midia_id text;

comment on column public.mensagens.midia_id is
  'Id da mensagem no WhatsApp (data.key.id). Serve para pedir o arquivo à Evolution na hora de exibir. Nulo em mensagem de texto.';

-- A conversa é lida por lead e por data; o índice serve à busca de quem tem
-- mídia, que é o que a tela precisa saber para montar o player.
create index if not exists mensagens_com_midia
  on public.mensagens (lead_id)
  where midia_id is not null;

-- Confere: deve listar a coluna nova.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'mensagens' and column_name = 'midia_id';
