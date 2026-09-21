# Cérebro da Helô — as queries das travas e o prompt de sistema

Complementa `docs/especificacao-cerebro-ia.md`, que desenha o fluxo. Aqui está o
texto literal do que vai dentro dos nodes.

Tudo abaixo foi escrito contra o **schema lido do banco em 21/09/2026**, não
contra `supabase/cerebro-ia.sql` — o banco já andou além daquele arquivo
(`leads.atendimento_ia` e `clinicas.instancia_whatsapp` existem no banco e não
no SQL).

---

## 1. Um node de contexto, não três de trava

A especificação desenha as três travas como losangos separados. Em SQL elas
saem **de uma vez só**, numa única consulta, e os nodes `IF` só leem o veredito.

O motivo não é economia de node: é que a regra passa a existir num lugar só. Se
a trava 1 mora metade no SQL e metade na condição do `IF`, um dia alguém muda um
lado e não o outro. Aqui o `IF` não decide nada — ele só pergunta `trava1_ok`.

Um efeito colateral bom: dá para testar as três travas rodando a query sozinha
no SQL Editor do Supabase, sem executar o workflow.

### Node: `Contexto e Travas` (Postgres → Execute Query)

O `leadId` entra como **parâmetro de query** (`$1`), nunca interpolado no texto
do SQL. Em *Options → Query Parameters*, use `{{ $json.leadId }}`.

```sql
with ctx as (
  select
    l.id                as lead_id,
    l.nome              as lead_nome,
    l.telefone          as lead_telefone,
    l.origem            as lead_origem,
    l.etapa             as lead_etapa,
    l.atendimento_ia    as lead_atendimento_ia,

    c.id                as clinica_id,
    c.nome              as clinica_nome,
    c.ativa             as clinica_ativa,
    c.modo_atendimento  as modo_atendimento,
    c.historia, c.diferenciais, c.tratamentos_oferecidos,
    c.parcelamento, c.formas_pagamento, c.convenios,
    c.classe_economica, c.faixa_etaria, c.principais_dores,
    c.endereco, c.horario_funcionamento,

    e.id                as especialidade_id,
    e.nome              as especialidade_nome,
    e.ativa             as especialidade_ativa,
    e.como_abordar_pausada,

    (select count(*) from mensagens m where m.lead_id = l.id) as total_mensagens
  from leads l
  left join clinicas c      on c.id = l.clinica_id
  left join especialidades e on e.id = l.especialidade_interesse_id
  where l.id = $1
)
select
  ctx.*,

  -- ── TRAVA 1: modo de atendimento da clínica ───────────────────────────
  -- Sem clínica vinculada, a IA não tem como saber o modo: não responde.
  -- "Só marketing" usa a mesma lista de origens pagas do painel
  -- (origensPagas em src/data/leads.ts): Meta Ads e Google Ads.
  case
    when ctx.clinica_id is null                              then false
    when ctx.clinica_ativa is not true                       then false
    when ctx.modo_atendimento in ('Pausada', 'Só humano')    then false
    when ctx.modo_atendimento = 'Só marketing'
         and coalesce(ctx.lead_origem, '')
             not in ('Meta Ads', 'Google Ads')               then false
    else true
  end as trava1_ok,

  case
    when ctx.clinica_id is null                           then 'lead sem clínica vinculada'
    when ctx.clinica_ativa is not true                    then 'clínica inativa'
    when ctx.modo_atendimento in ('Pausada', 'Só humano') then 'modo ' || ctx.modo_atendimento
    when ctx.modo_atendimento = 'Só marketing'
         and coalesce(ctx.lead_origem, '')
             not in ('Meta Ads', 'Google Ads')            then 'Só marketing, lead de origem orgânica'
    else null
  end as trava1_motivo,

  -- ── TRAVA 2: a IA nunca faz o primeiro contato ────────────────────────
  -- Primeiro contato = nenhuma linha em mensagens, mesmo que o lead já
  -- exista cadastrado. Confirmado em 21/09/2026.
  (ctx.total_mensagens > 0) as trava2_ok,

  -- ── TRAVA 3: especialidade pausada ────────────────────────────────────
  -- Cobre só a especialidade REGISTRADA como interesse. O caso "o lead
  -- pergunta por uma pausada no meio da conversa" não é resolvível em SQL:
  -- vai no prompt, via a lista especialidades_pausadas abaixo.
  (ctx.especialidade_id is null or ctx.especialidade_ativa) as trava3_ok,

  -- ── Insumos do prompt ─────────────────────────────────────────────────
  (
    select coalesce(json_agg(json_build_object(
             'nome',  e2.nome,
             'duracao_minutos', e2.duracao_minutos,
             -- Linha ausente e valor nulo são a mesma coisa: consultar a
             -- equipe. Nunca "grátis", nunca um número chutado.
             'valor', ce.valor
           ) order by e2.nome), '[]'::json)
    from especialidades e2
    left join clinica_especialidades ce
           on ce.especialidade_id = e2.id
          and ce.clinica_id = ctx.clinica_id
    where e2.ativa
  ) as especialidades_ativas,

  (
    select coalesce(json_agg(e3.nome order by e3.nome), '[]'::json)
    from especialidades e3 where not e3.ativa
  ) as especialidades_pausadas,

  (
    select coalesce(json_agg(json_build_object(
             'nome', e4.nome, 'como_abordar', e4.como_abordar_pausada
           ) order by e4.nome), '[]'::json)
    from especialidades e4
    where not e4.ativa and e4.como_abordar_pausada is not null
  ) as roteiro_das_pausadas,

  (
    select coalesce(json_agg(json_build_object(
             'objecao', o.objecao, 'resposta', o.resposta
           ) order by o.id), '[]'::json)
    from objecoes o
  ) as objecoes,

  -- Histórico em ordem cronológica, as 20 últimas. A subquery inverte duas
  -- vezes porque "as 20 últimas" pede desc e o prompt pede asc.
  (
    select coalesce(json_agg(json_build_object(
             'remetente_tipo', h.remetente_tipo,
             'remetente_nome', h.remetente_nome,
             'texto',          h.texto,
             'criado_em',      h.criado_em
           ) order by h.criado_em), '[]'::json)
    from (
      select * from mensagens m
      where m.lead_id = ctx.lead_id
      order by m.criado_em desc limit 20
    ) h
  ) as historico
from ctx;
```

**Devolve uma linha, ou nenhuma.** Nenhuma linha significa `leadId`
inexistente — trate como erro do chamador, não como lead novo.

### Os três nodes `IF`

Nenhum deles calcula nada. Condição, em ordem:

| Node | Condição (boolean, is true) | Falso vai para |
|---|---|---|
| `Trava 1 — Clínica permite?` | `{{ $json.trava1_ok }}` | `Gravar mensagem do lead` → fim |
| `Trava 2 — Já houve conversa?` | `{{ $json.trava2_ok }}` | `Gravar + sinalizar CRC` → fim |
| `Trava 3 — Especialidade ativa?` | `{{ $json.trava3_ok }}` | `Responder com texto fixo` → fim |

---

## 2. Gravar a conversa

### `Gravar mensagem do lead` — sempre, inclusive nos ramos bloqueados

Roda **antes** de qualquer decisão sobre responder. O lead falou; isso é fato, e
fato se grava mesmo quando ninguém vai responder agora.

```sql
insert into mensagens (lead_id, remetente_tipo, formato, texto, regra)
values ($1, 'Lead', $2, $3, null)
returning id;
```

Parâmetros: `{{ $json.leadId }}`, `{{ $json.formato || 'texto' }}`, `{{ $json.texto }}`.

### `Sinalizar CRC` — nos ramos bloqueados

`mensagens.regra` existe para isto: registrar qual automação (ou qual trava)
motivou o registro. Grava uma linha `Automática` que não vai para o lead, é
marca interna para o painel mostrar por que ninguém respondeu.

```sql
insert into mensagens (lead_id, remetente_tipo, formato, texto, regra)
values ($1, 'Automática', 'texto', $2, $3);
```

Parâmetros por ramo:

| Trava | `texto` | `regra` |
|---|---|---|
| 1 | `Atendimento humano necessário: {{ $json.trava1_motivo }}` | `Trava 1 - modo de atendimento` |
| 2 | `Primeiro contato deste lead. A IA não abre conversa.` | `Trava 2 - primeiro contato é humano` |
| 3 | `Lead interessado em especialidade pausada ({{ $json.especialidade_nome }}).` | `Trava 3 - especialidade pausada` |

### `Gravar resposta da IA`

```sql
insert into mensagens (lead_id, remetente_tipo, formato, texto, regra, status)
values ($1, 'IA', 'texto', $2, null, 'enviada');
```

---

## 3. O prompt de sistema

Vai no campo *System Message* do `Supervisor1`. A parte fixa está abaixo; a
parte entre `{{ }}` sai do node de contexto.

```
Você é a Helô, consultora de relacionamento da {{ $json.clinica_nome }}.
Conversa com pacientes por WhatsApp. Seu objetivo é levar a conversa até uma
consulta de avaliação marcada.

## Como você escreve
- Português do Brasil, tom de pessoa, não de empresa. Direto e caloroso.
- Mensagens curtas, de WhatsApp. Duas a quatro linhas. Uma pergunta por vez.
- Você NUNCA se apresenta de novo nem cumprimenta como se a conversa
  estivesse começando. Esta conversa já está em andamento e alguém da equipe
  já falou com esta pessoa antes de você.
- Sem emoji em excesso. No máximo um, e só quando couber.
- Nunca diga que é uma IA, um robô ou um assistente virtual.

## O que você não pode fazer, mesmo se insistirem
1. NUNCA invente valor. Se o procedimento aparece abaixo sem valor definido,
   diga que vai confirmar o valor exato com a equipe. Não estime, não dê
   faixa, não diga "por volta de". Um número errado aqui vira reclamação na
   recepção.
2. NUNCA ofereça, elogie ou dê a entender que dá para agendar um procedimento
   da lista de pausados. Se perguntarem por um deles, use o roteiro que
   acompanha aquele procedimento e ofereça falar com a equipe.
3. NUNCA confirme um horário como se estivesse marcado. Você propõe; quem
   confirma é a clínica.
4. NUNCA prometa resultado clínico, prazo de recuperação ou ausência de
   efeito colateral. Isso é conversa de profissional de saúde, não sua.
5. Se não souber, diga que vai confirmar com a equipe. Isso é sempre melhor
   que uma resposta inventada.

## Objeções
Quando reconhecer uma das objeções abaixo, use a resposta já cadastrada como
base — ela foi escrita pela equipe e testada. Adapte o tom ao que a pessoa
escreveu, mas não troque o argumento por um seu.

{{ JSON.stringify($json.objecoes, null, 2) }}

## A clínica
Nome: {{ $json.clinica_nome }}
Endereço: {{ $json.endereco }}
Horário: {{ $json.horario_funcionamento }}
História: {{ $json.historia }}
Diferenciais: {{ $json.diferenciais }}
Parcelamento: {{ $json.parcelamento }}
Formas de pagamento: {{ $json.formas_pagamento }}
Convênios: {{ $json.convenios }}
Público: {{ $json.classe_economica }} · {{ $json.faixa_etaria }}
Dores mais comuns: {{ $json.principais_dores }}

Campo vazio acima significa "não cadastrado" — trate como algo que você não
sabe e vai confirmar, nunca como algo que não existe.

## Procedimentos que você PODE oferecer
{{ JSON.stringify($json.especialidades_ativas, null, 2) }}

valor nulo = não cadastrado para esta clínica = confirmar com a equipe.

## Procedimentos PAUSADOS — não oferecer em nenhuma hipótese
{{ JSON.stringify($json.roteiro_das_pausadas, null, 2) }}

## Quem é esta pessoa
Nome: {{ $json.lead_nome }}
Chegou por: {{ $json.lead_origem }}
Interesse registrado: {{ $json.especialidade_nome }}
Etapa no funil: {{ $json.lead_etapa }}
```

### Duas decisões dentro do prompt

**Campo vazio ≠ inexistente.** Hoje a clínica de teste está sem história,
diferenciais, convênios e dores. Sem essa instrução, a IA tende a preencher o
buraco sozinha — "não trabalhamos com convênios" é uma frase que ela inventaria
com naturalidade, e que pode ser mentira.

**A lista de pausados vai no prompt mesmo com a trava 3 existindo.** A trava só
enxerga o interesse *registrado* do lead. Uma pessoa registrada em "Limpeza de
pele" que pergunta sobre drenagem passa pela trava — e aí só o prompt segura.

---

## 4. O teste das travas, sem gravar nada

As três travas foram rodadas contra treze casos, no banco real, em 21/09/2026.
O teste fabrica os leads dentro da própria query (`with ctx(...) as (values ...)`)
em vez de inserir linhas — assim exercita a regra inteira sem sujar `leads`.

Para repetir, cole no SQL Editor do Supabase:

```sql
with ctx(caso, clinica_id, clinica_ativa, modo_atendimento, lead_origem,
         total_mensagens, especialidade_id, especialidade_ativa) as (values
  ('1  Todo lead, já conversou, esp ativa',      1, true,  'Todo lead',    'Site',      3, 1,    true),
  ('2  clínica Pausada',                         1, true,  'Pausada',      'Meta Ads',  3, 1,    true),
  ('3  clínica Só humano',                       1, true,  'Só humano',    'Meta Ads',  3, 1,    true),
  ('4  Só marketing + lead orgânico',            1, true,  'Só marketing', 'Site',      3, 1,    true),
  ('5  Só marketing + Meta Ads',                 1, true,  'Só marketing', 'Meta Ads',  3, 1,    true),
  ('6  Só marketing + Google Ads',               1, true,  'Só marketing', 'Google Ads',3, 1,    true),
  ('7  Só marketing + origem nula',              1, true,  'Só marketing', null,        3, 1,    true),
  ('8  clínica inativa',                         1, false, 'Todo lead',    'Meta Ads',  3, 1,    true),
  ('9  lead sem clínica vinculada',           null, null,  null,           'Meta Ads',  3, 1,    true),
  ('10 primeiro contato (0 mensagens)',          1, true,  'Todo lead',    'Meta Ads',  0, 1,    true),
  ('11 lead cadastrado, 0 mensagens',            1, true,  'Todo lead',    'Site',      0, 2,    true),
  ('12 especialidade pausada',                   1, true,  'Todo lead',    'Meta Ads',  5, 3,    false),
  ('13 sem especialidade de interesse',          1, true,  'Todo lead',    'Meta Ads',  5, null, null)
)
select caso,
  case when clinica_id is null then false
       when clinica_ativa is not true then false
       when modo_atendimento in ('Pausada','Só humano') then false
       when modo_atendimento = 'Só marketing'
            and coalesce(lead_origem,'') not in ('Meta Ads','Google Ads') then false
       else true end as t1,
  (total_mensagens > 0) as t2,
  (especialidade_id is null or especialidade_ativa) as t3
from ctx;
```

| # | Caso | T1 | T2 | T3 | Resultado |
|---|---|:--:|:--:|:--:|---|
| 1 | Todo lead, já conversou, esp. ativa | ✓ | ✓ | ✓ | IA responde |
| 2 | Clínica `Pausada` | ✗ | — | — | só grava |
| 3 | Clínica `Só humano` | ✗ | — | — | só grava |
| 4 | `Só marketing` + lead do Site | ✗ | — | — | só grava |
| 5 | `Só marketing` + Meta Ads | ✓ | ✓ | ✓ | IA responde |
| 6 | `Só marketing` + Google Ads | ✓ | ✓ | ✓ | IA responde |
| 7 | `Só marketing` + origem nula | ✗ | — | — | só grava |
| 8 | Clínica inativa | ✗ | — | — | só grava |
| 9 | Lead sem clínica vinculada | ✗ | — | — | só grava |
| 10 | Primeiro contato, 0 mensagens | ✓ | ✗ | — | sinaliza CRC |
| 11 | **Lead já cadastrado, 0 mensagens** | ✓ | **✗** | — | **sinaliza CRC** |
| 12 | Especialidade pausada | ✓ | ✓ | ✗ | texto fixo + sinaliza |
| 13 | Sem especialidade de interesse | ✓ | ✓ | ✓ | IA responde |

O caso 11 é o que a regra existe para pegar: o lead está cadastrado, mas
ninguém nunca falou com ele. A IA não abre conversa.

O caso 7 merece atenção: origem nula sob `Só marketing` bloqueia. É o lado
seguro — sem saber de onde o lead veio, não dá para afirmar que é de campanha.

---

## 5. Três coisas para você decidir

**a) Clínica inativa bloqueia a IA?** Coloquei `clinica_ativa is not true` na
trava 1. A especificação não pede isso — ela só fala de `modo_atendimento`.
Coloquei porque erra para o lado seguro, que é o critério que você mesmo
estabeleceu. Se discordar, é apagar uma linha.

**b) Todos os preços estão nulos.** As três linhas de `clinica_especialidades`
existem com `valor` em branco. Do jeito que está, a Helô vai responder
"confirmo com a equipe" para qualquer pergunta de preço — que é o
comportamento correto, mas significa que nenhum teste de preço vai exercitar
o caminho de verdade. Vale cadastrar ao menos um valor antes de testar.

**c) `leads.atendimento_ia` não é usado por nada aqui.** A coluna existe no
banco, os nodes `Pausar IA1` e `Reativar IA1` escrevem nela, e nenhuma das três
travas lê. Ou ela é uma quarta trava que ninguém documentou, ou é resto de um
desenho antigo. Não inventei uso para ela — precisa de uma decisão sua.
