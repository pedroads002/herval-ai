-- ============================================================================
-- Herval AI · aceitar reação como formato de mensagem
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Pode rodar mais de uma vez sem quebrar nada.
-- ============================================================================
--
-- ORDEM IMPORTA: rode este arquivo ANTES de mexer no n8n.
--
-- Enquanto o CHECK não aceitar 'reacao', o nó que grava a mensagem do lead
-- falha ao inserir uma reação, e a execução inteira morre — hoje ela ao menos
-- grava (com texto vazio) e segue. Com a ordem invertida, a correção pioraria
-- o que ela veio consertar.
--
-- Por que 'reacao' e não guardar como 'texto': reação não é uma fala. Ela não
-- devolve o lead para a fila de quem espera resposta, e não reinicia a
-- contagem de há quanto tempo ele está sem retorno. Sem um formato próprio, a
-- tela não teria como distinguir um "❤️" de alguém que digitou "❤️" — e as
-- duas coisas pedem tratamento diferente.
--
-- Sem acento no valor, de propósito: acompanha 'audio', que já está assim.
-- ============================================================================

alter table public.mensagens drop constraint if exists mensagens_formato_check;

alter table public.mensagens add constraint mensagens_formato_check
  check (formato = any (array['texto', 'audio', 'imagem', 'video', 'reacao']));

-- Confere o resultado: deve listar os cinco valores.
select pg_get_constraintdef(oid) as formato_aceito
from pg_constraint
where conrelid = 'public.mensagens'::regclass
  and conname = 'mensagens_formato_check';
