-- ============================================================================
-- Herval AI · Estratégia do Cliente
--
-- >>> JÁ EXECUTADO no banco em 30/09/2026. Este arquivo é o registro do que foi
-- >>> rodado, não uma pendência. É repetível: rodar de novo não recria nada.
-- ============================================================================
--
-- A tela "Estratégia da Clínica" nunca gravou nada: o botão Salvar só acendia
-- uma confirmação por dois segundos. Metade dos campos que ela mostrava não tinha
-- coluna, e a outra metade tinha coluna de texto livre que ninguém preenchia. A
-- Helô já lê esses campos no nó "Contexto e Travas" e sempre recebe vazio.
--
-- Agora a tela vira "Estratégia do Cliente" — cliente, não clínica, porque em
-- Clientes cadastramos tanto equipe quanto profissional sozinho — e grava de
-- verdade, em cinco blocos.
--
-- O que este arquivo faz:
--   1. cria as 14 colunas que não existiam (2 delas são as do item 3);
--   2. muda o formato de 5 colunas de texto livre para lista/número/jsonb;
--   3. troca `faixa_etaria` (texto) por duas colunas de idade;
--   4. derruba `tratamentos_oferecidos`, que ninguém lê;
--   5. põe CHECK nas listas fechadas.
--
-- Por que agora é a hora certa da mudança de formato: as seis colunas estão
-- nulas nas duas linhas de `clinicas`. Não há uma única frase digitada para
-- converter, então a troca de tipo não tem como perder conteúdo de ninguém.
--
-- Por que lista fechada em vez de texto livre, de novo: é o mesmo motivo de
-- `motivo-perda-do-lead.sql`. Cada lista daqui vive também em
-- `src/lib/dados/fichaDaEstrategia.ts` — mexer em uma sem mexer na outra faz a
-- tela oferecer opção que o banco recusa.
--
-- Sobre CHECK que cruza duas colunas: em `leads` isso é proibido, porque o
-- cérebro no n8n grava lá coluna por coluna e na ordem dele. Em `clinicas` não
-- é: os quatro nós do n8n que tocam esta tabela só leem (`Contexto e Travas`,
-- `Resolver Clínica`, e os dois `Resolver instância`), conferido no workflow ao
-- vivo. Quem grava em `clinicas` é só o painel, então a faixa etária pode exigir
-- que o "de" não passe o "até".
--
-- O que este arquivo NÃO faz, de propósito:
--   · nenhuma coluna de valor, preço ou dinheiro. A Helô fala de política —
--     é gratuita, quando é cobrada, se abate, se ela pode informar — e nunca de
--     número. Confirmado com ele em 30/09/2026.
--   · não encosta em `modo_atendimento`: ele sai desta tela e ainda não tem
--     outra casa. A coluna continua intacta, e é ela que a trava 1 lê.
--   · não encosta em `instancia_whatsapp`, `endereco` nem
--     `horario_funcionamento`. Endereço e horário são de Clientes; a Estratégia
--     mostra, nunca edita.
--   · não dá default nenhum. Nulo quer dizer "não cadastrado", e é assim que o
--     prompt da Helô já trata: "campo vazio significa algo que você não sabe e
--     vai confirmar, nunca algo que não existe". Default inventado viraria a
--     Helô afirmando política que ninguém escolheu.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Bloco 1 · Objetivo do Atendimento
-- ----------------------------------------------------------------------------
alter table public.clinicas
  add column if not exists objetivo_atendimento text,
  add column if not exists prioridade_comercial text;

-- ----------------------------------------------------------------------------
-- 2. Bloco 2 · Avaliação / Consulta
--
-- Os três booleanos ficam nulos enquanto ninguém respondeu. `false` e "ainda não
-- me disseram" são coisas diferentes: com `false` a Helô afirmaria que a
-- avaliação não é gratuita sem ninguém ter dito isso.
-- ----------------------------------------------------------------------------
alter table public.clinicas
  add column if not exists tem_avaliacao_inicial boolean,
  add column if not exists tipo_avaliacao text,
  add column if not exists avaliacao_gratuita boolean,
  add column if not exists avaliacao_quando_cobrada text,
  add column if not exists avaliacao_abate_procedimento boolean,
  add column if not exists helo_pode_informar_valor boolean;

-- ----------------------------------------------------------------------------
-- 3. Bloco 3 · Condições Comerciais
--
-- `formas_pagamento`: de texto para lista. O que a tela mostra é caixa de
-- seleção, e lista é o que caixa de seleção grava sem ambiguidade.
--
-- `parcelamento`: de texto para número, e o nome continua o mesmo. Renomear para
-- `parcelas_maximas` deixaria mais claro, mas obrigaria a mexer no SELECT do
-- cérebro só por causa do nome — risco sem ganho. O número é o teto de parcelas;
-- o comentário da coluna diz isso, e o n8n formata como "em até 10x".
--
-- `convenios`: de texto para jsonb, uma lista de { nome, especialidade_ids }. É
-- jsonb e não tabela nova porque convênio não tem vida própria no sistema: ele
-- existe só como informação daquele cliente, e tabela com uma coluna útil é
-- cerimônia sem uso. Os ids apontam para `especialidades`.
-- ----------------------------------------------------------------------------
alter table public.clinicas
  add column if not exists politica_de_valores text;

alter table public.clinicas
  drop constraint if exists clinicas_formas_pagamento_da_lista;

alter table public.clinicas
  alter column formas_pagamento type text[] using
    case when formas_pagamento is null then null
         else array[formas_pagamento] end;

alter table public.clinicas
  alter column parcelamento type integer using
    nullif(regexp_replace(coalesce(parcelamento, ''), '\D', '', 'g'), '')::integer;

alter table public.clinicas
  alter column convenios type jsonb using
    case when convenios is null then null
         else jsonb_build_array(jsonb_build_object('nome', convenios, 'especialidade_ids', '[]'::jsonb))
    end;

-- ----------------------------------------------------------------------------
-- 4. Bloco 4 · Público-alvo
--
-- `faixa_etaria` era texto ("25 a 55", "adultos", o que a pessoa escrevesse).
-- Vira duas colunas de idade, porque intervalo com começo e fim é o que a tela
-- pede e o que o banco sabe conferir.
--
-- A coluna de texto NÃO é derrubada aqui, e a ordem importa: o nó "Contexto e
-- Travas" ainda seleciona `c.faixa_etaria`, e derrubar a coluna antes de ajustar
-- o nó faria a consulta do cérebro falhar em lead de verdade, no meio de uma
-- conversa. Ela sai em `estrategia-do-cliente-faixa-etaria-antiga.sql`, depois
-- que o nó já lê as duas novas.
-- ----------------------------------------------------------------------------
alter table public.clinicas
  add column if not exists faixa_etaria_de integer,
  add column if not exists faixa_etaria_ate integer;

alter table public.clinicas
  alter column classe_economica type text[] using
    case when classe_economica is null then null
         else array[classe_economica] end;

alter table public.clinicas
  alter column principais_dores type text[] using
    case when principais_dores is null then null
         else array[principais_dores] end;

-- ----------------------------------------------------------------------------
-- 5. Bloco 5 · Diretrizes de Comunicação
--
-- `historia` e `diferenciais` já existem e já são lidos pela Helô. Continuam
-- aqui, e continuam opcionais: salvar em branco é o normal, não é erro.
-- ----------------------------------------------------------------------------
alter table public.clinicas
  add column if not exists tom_predominante text,
  add column if not exists informacoes_a_evitar text,
  add column if not exists observacoes_atendimento text;

-- ----------------------------------------------------------------------------
-- 6. `tratamentos_oferecidos` sai
--
-- Não é lido em lugar nenhum: nem no painel, nem no workflow `Helô - base`
-- (conferido nó por nó no workflow ao vivo em 30/09/2026 — a coluna aparecia no
-- documento `docs/cerebro-ia-queries-e-prompt.md`, de 23/09, mas o nó foi
-- reescrito depois e não a seleciona mais). Quem diz o que o cliente oferece é a
-- equipe dele, por `profissional_especialidades`.
-- ----------------------------------------------------------------------------
alter table public.clinicas
  drop column if exists tratamentos_oferecidos;

-- ----------------------------------------------------------------------------
-- 7. As listas fechadas
--
-- `<@` é "está contido em": a lista gravada só pode conter itens da lista
-- oferecida. Lista vazia passa, e é o que a tela grava quando ninguém marcou
-- caixa nenhuma.
-- ----------------------------------------------------------------------------
alter table public.clinicas
  drop constraint if exists clinicas_objetivo_atendimento_da_lista;
alter table public.clinicas
  add constraint clinicas_objetivo_atendimento_da_lista check (
    objetivo_atendimento is null
    or objetivo_atendimento in (
      'Agendar avaliação',
      'Agendar consulta',
      'Qualificar antes do agendamento',
      'Encaminhar para humano',
      'Outro'
    )
  );

alter table public.clinicas
  drop constraint if exists clinicas_prioridade_comercial_da_lista;
alter table public.clinicas
  add constraint clinicas_prioridade_comercial_da_lista check (
    prioridade_comercial is null
    or prioridade_comercial in (
      'Volume de agendamentos',
      'Ocupar agenda ociosa',
      'Procedimento carro-chefe',
      'Fidelizar base'
    )
  );

alter table public.clinicas
  drop constraint if exists clinicas_tipo_avaliacao_da_lista;
alter table public.clinicas
  add constraint clinicas_tipo_avaliacao_da_lista check (
    tipo_avaliacao is null
    or tipo_avaliacao in ('Presencial', 'Online', 'Ambas')
  );

alter table public.clinicas
  drop constraint if exists clinicas_avaliacao_quando_cobrada_da_lista;
alter table public.clinicas
  add constraint clinicas_avaliacao_quando_cobrada_da_lista check (
    avaliacao_quando_cobrada is null
    or avaliacao_quando_cobrada in (
      'Sempre',
      'Só quando o paciente não fecha o procedimento',
      'Só em alguns procedimentos',
      'Nunca'
    )
  );

alter table public.clinicas
  drop constraint if exists clinicas_politica_de_valores_da_lista;
alter table public.clinicas
  add constraint clinicas_politica_de_valores_da_lista check (
    politica_de_valores is null
    or politica_de_valores in (
      'Pode informar',
      'Só a partir de',
      'Só se perguntarem',
      'Não informa antes da avaliação'
    )
  );

alter table public.clinicas
  add constraint clinicas_formas_pagamento_da_lista check (
    formas_pagamento is null
    or formas_pagamento <@ array[
      'Pix',
      'Dinheiro',
      'Cartão de crédito',
      'Cartão de débito',
      'Boleto',
      'Financiamento próprio'
    ]::text[]
  );

alter table public.clinicas
  drop constraint if exists clinicas_classe_economica_da_lista;
alter table public.clinicas
  add constraint clinicas_classe_economica_da_lista check (
    classe_economica is null
    or classe_economica <@ array['A', 'B', 'C', 'D']::text[]
  );

alter table public.clinicas
  drop constraint if exists clinicas_parcelamento_no_limite;
alter table public.clinicas
  add constraint clinicas_parcelamento_no_limite check (
    parcelamento is null or parcelamento between 1 and 24
  );

-- Convênio é lista, nunca objeto solto: o n8n percorre isso com `jsonb_array_elements`
-- e um objeto no lugar de uma lista quebraria a leitura.
alter table public.clinicas
  drop constraint if exists clinicas_convenios_e_lista;
alter table public.clinicas
  add constraint clinicas_convenios_e_lista check (
    convenios is null or jsonb_typeof(convenios) = 'array'
  );

-- A única regra que cruza duas colunas, e ela só é possível porque o cérebro
-- não grava em `clinicas` — ver o cabeçalho.
alter table public.clinicas
  drop constraint if exists clinicas_faixa_etaria_na_ordem;
alter table public.clinicas
  add constraint clinicas_faixa_etaria_na_ordem check (
    faixa_etaria_de is null
    or faixa_etaria_ate is null
    or faixa_etaria_de <= faixa_etaria_ate
  );

alter table public.clinicas
  drop constraint if exists clinicas_faixa_etaria_plausivel;
alter table public.clinicas
  add constraint clinicas_faixa_etaria_plausivel check (
    (faixa_etaria_de is null or faixa_etaria_de between 0 and 120)
    and (faixa_etaria_ate is null or faixa_etaria_ate between 0 and 120)
  );

-- ----------------------------------------------------------------------------
-- 8. O que cada coluna quer dizer
-- ----------------------------------------------------------------------------
comment on column public.clinicas.objetivo_atendimento is
  'O que a Helo tenta conseguir na conversa. Lista fechada, igual a objetivosDoAtendimento em src/lib/dados/fichaDaEstrategia.ts.';
comment on column public.clinicas.prioridade_comercial is
  'A prioridade da operacao. Lista fechada, igual a prioridadesComerciais em src/lib/dados/fichaDaEstrategia.ts.';
comment on column public.clinicas.tem_avaliacao_inicial is
  'Se o cliente faz avaliacao antes do procedimento. Nulo = ninguem respondeu ainda, diferente de false.';
comment on column public.clinicas.tipo_avaliacao is
  'Presencial, Online ou Ambas.';
comment on column public.clinicas.avaliacao_gratuita is
  'Se a avaliacao inicial e gratuita. Nulo = nao cadastrado.';
comment on column public.clinicas.avaliacao_quando_cobrada is
  'Em que situacao a avaliacao e cobrada. Lista fechada. Politica, nunca valor.';
comment on column public.clinicas.avaliacao_abate_procedimento is
  'Se o que foi pago na avaliacao abate no procedimento.';
comment on column public.clinicas.helo_pode_informar_valor is
  'Se a Helo tem permissao de falar de valor com o paciente. O numero em si nao existe no sistema: com true ela ainda confirma com a equipe.';
comment on column public.clinicas.formas_pagamento is
  'Lista de formas aceitas, da lista fechada formasDePagamento em src/lib/dados/fichaDaEstrategia.ts. O n8n junta em texto no no Contexto e Travas.';
comment on column public.clinicas.parcelamento is
  'Teto de parcelas (1 a 24). So o numero: o n8n formata como "em ate 10x".';
comment on column public.clinicas.convenios is
  'Lista jsonb de { nome, especialidade_ids }. Os ids apontam para especialidades; o n8n troca id por nome antes de a Helo falar.';
comment on column public.clinicas.politica_de_valores is
  'Quanto a Helo pode falar sobre valor. Lista fechada. Nao guarda valor nenhum.';
comment on column public.clinicas.classe_economica is
  'Lista de classes atendidas, entre A, B, C e D.';
comment on column public.clinicas.faixa_etaria_de is
  'Idade minima do publico-alvo. Par com faixa_etaria_ate.';
comment on column public.clinicas.faixa_etaria_ate is
  'Idade maxima do publico-alvo. Par com faixa_etaria_de.';
comment on column public.clinicas.principais_dores is
  'Lista livre das dores mais comuns do publico. Texto digitado, uma por item.';
comment on column public.clinicas.tom_predominante is
  'Como a Helo deve soar com esse cliente. Texto livre.';
comment on column public.clinicas.informacoes_a_evitar is
  'O que a Helo nao deve dizer. Texto livre, e entra no prompt junto das travas, nao no fim.';
comment on column public.clinicas.observacoes_atendimento is
  'Qualquer combinado de atendimento que nao cabe nos outros campos. Texto livre.';
