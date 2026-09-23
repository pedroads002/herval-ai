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

  -- ── TRAVA 4: handoff humano em andamento ──────────────────────────────
  -- Avaliada PRIMEIRA, apesar do número. É a mais específica e a mais
  -- urgente: alguém da equipe está com a conversa na mão neste momento.
  --
  -- Quem escreve nesta coluna (conferido nos nodes em 21/09/2026):
  --   Pausar IA1   grava 'pause'      quando a equipe manda qualquer
  --                                   mensagem que não seja "Atendimento
  --                                   finalizado"
  --   Reativar IA1 grava 'reativada'  1 minuto depois de a equipe mandar
  --                                   exatamente "Atendimento finalizado"
  --                                   (o node Wait1 é essa espera)
  --
  -- A coluna guarda estado atual, não histórico: 'reativada' sobrescreve
  -- 'pause'. Por isso não é preciso checar "e não foi reativada depois" —
  -- se ainda diz 'pause', é porque ninguém reativou.
  --
  -- Valor inesperado bloqueia junto com 'pause'. Se um dia alguém gravar
  -- 'pausado' ou 'PAUSE', o erro deve ser a IA calar, não a IA atropelar
  -- um atendimento humano.
  case
    when ctx.lead_atendimento_ia is null                       then true
    when lower(trim(ctx.lead_atendimento_ia)) = 'reativada'    then true
    else false
  end as trava4_ok,

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

| Ordem | Node | Condição (boolean, is true) | Falso vai para |
|---|---|---|---|
| 1º | `Trava 4 — Humano está atendendo?` | `{{ $json.trava4_ok }}` | `Gravar mensagem do lead` → fim |
| 2º | `Trava 1 — Clínica permite?` | `{{ $json.trava1_ok }}` | `Gravar + sinalizar CRC` → fim |
| 3º | `Trava 2 — Já houve conversa?` | `{{ $json.trava2_ok }}` | `Gravar + sinalizar CRC` → fim |
| 4º | `Trava 3 — Especialidade ativa?` | `{{ $json.trava3_ok }}` | `Responder com texto fixo` → fim |

A trava 4 vem primeiro apesar de ter o número maior. Como as quatro saem da
mesma consulta, a ordem não muda quem bloqueia — muda só qual motivo fica
registrado quando mais de uma barra ao mesmo tempo. E o motivo mais útil para
quem for olhar depois é "tinha gente atendendo", não "a clínica está em modo X".

**A trava 4 é a única que não sinaliza o CRC.** As outras gravam uma linha
`Automática` pedindo atenção humana. Aqui o humano já está lá — avisar seria
encher a conversa de recado para quem está lendo em tempo real. Grava só a
mensagem do lead e para.

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

E a trava 4, com a mesma técnica (sete casos, nenhuma escrita):

| # | `atendimento_ia` | T4 | Resultado |
|---|---|:--:|---|
| 14 | `'pause'` | ✗ | humano está atendendo, IA cala |
| 15 | `'reativada'` | ✓ | IA volta a responder |
| 16 | `null` (nunca houve handoff) | ✓ | IA responde |
| 17 | `'PAUSE'` | ✗ | valor inesperado bloqueia |
| 18 | `'pausado'` | ✗ | valor inesperado bloqueia |
| 19 | `'pause'` + clínica `Pausada` | ✗ | bloqueia pelo motivo da trava 4 |
| 20 | `' Pause '` (espaço e maiúscula) | ✗ | bloqueia |

Os casos 17, 18 e 20 são de propósito: se um dia alguém gravar um valor
diferente de `'pause'` e `'reativada'`, o erro resultante deve ser a IA calar,
nunca a IA atropelar uma conversa que um humano está conduzindo.

O caso 11 é o que a regra existe para pegar: o lead está cadastrado, mas
ninguém nunca falou com ele. A IA não abre conversa.

O caso 7 merece atenção: origem nula sob `Só marketing` bloqueia. É o lado
seguro — sem saber de onde o lead veio, não dá para afirmar que é de campanha.

---

## 4-A. Impedimento maior: o pacote da Evolution não está instalado

Descoberto em 21/09/2026. O pacote `n8n-nodes-evolution-api` não está
instalado no servidor. Isso é mais amplo do que parecia:

1. **Trava o envio de resposta.** Os nodes `Evolution API`,
   `Enviar Mensagem WhatsApp` e `Enviar texto1` não rodam.
2. **Trava toda edição programática do workflow.** Não é a ferramenta que não
   reconhece o node — é o servidor que não tem o pacote, então a validação do
   workflow inteiro falha. Testado: tentar acrescentar **um post-it** ao
   workflow é recusado com `Unrecognized node type:
   n8n-nodes-evolution-api.evolutionApi`.

O ponto 2 desfaz uma suposição do handoff. A seção 4 dele atribuía o bloqueio
de escrita a uma limitação da tool MCP e sugeria contornar pela API REST. Não
contorna: a causa é a mesma do ponto 1, e vale para qualquer via de escrita.

Consequência prática: **duplicar o workflow não ajuda em nada nesse ponto** —
a cópia carrega os mesmos três nodes e é igualmente intocável. Enquanto o
pacote não for instalado, qualquer construção precisa acontecer fora de um
workflow que contenha nodes da Evolution.

Instalar o pacote destrava as duas coisas de uma vez. É o item de maior
prioridade da lista.

---

## 4-B. A trava 4 já existia — em `Rota Atendimento1`

Ao procurar o ponto de emenda, encontrei o node `Rota Atendimento1`, um
switch que já faz exatamente o que a trava 4 faria:

| saída | condição | destino |
|---|---|---|
| 0 — "IA Ativa" | `atendimento_ia != 'pause'` | `ROTA Mensagens1` |
| 1 — "IA pausada" | `atendimento_ia == 'pause'` | `Salvar Historico2` |

Acrescentar a trava 4 como node novo criaria a mesma regra em dois lugares —
o problema que este projeto passa a vida evitando. São duas saídas possíveis:

**Apontar `Rota Atendimento1` para `trava4_ok`.** A regra passa a existir só
na consulta, e o switch vira leitor. Exige que o contexto rode antes dele.

**Deixar como está e tirar `trava4_ok` da consulta.** Menos mexida, mas perde
o tratamento de valor inesperado.

A diferença entre as duas implementações não é cosmética. A atual compara com
`'pause'` exato: `'PAUSE'` ou `'pausado'` caem em "IA Ativa" e a IA atropela
um atendimento humano. A da consulta bloqueia qualquer valor que não seja
`'reativada'` ou nulo. Some-se a isso que a comparação atual roda com
`typeValidation: strict` contra um campo que costuma ser nulo.

**DECIDIDO em 21/09/2026: `Rota Atendimento1` passa a ler `trava4_ok`.** A
regra fica só na consulta e o switch vira leitor.

**Aplicado pela metade, e não por escolha.** No `Helô - Travas (dev)` já é
assim por construção — o `Trava 4 — Humano atendendo?` lê `trava4_ok`. No
workflow principal e na cópia, a edição está **bloqueada pelo 4-A**: não dá
para tocar em `Rota Atendimento1` enquanto o pacote da Evolution não estiver
instalado. Fica na fila do transplante.

---

## 4-C. O vínculo lead ↔ clínica — decidido em 21/09/2026

- `instancia_whatsapp` é **provavelmente** o vínculo certo (formato padrão da
  Evolution API), mas o nome exato do campo no payload só pode ser confirmado
  com um payload real. Não existe nenhum no histórico de execuções: a única
  execução registrada falhou antes de chegar lá, pelo mesmo motivo do 4-A.
  **Pendente de confirmação** assim que o pacote estiver instalado.
- Instância sem clínica correspondente: **bloqueia e sinaliza humano.** Sem
  clínica padrão automática.
- Entra um node novo, **`Resolver Clínica`**, logo após o webhook — antes de
  `Buscar Cliente1`/`Criar Cliente1` e antes das travas. Resolve `clinica_id`
  pela instância; não achando, desvia para o bloqueio.
- `Criar Cliente1` passa a gravar `clinica_id`.
- `Buscar Cliente1` passa a filtrar por **telefone + clinica_id**, não só
  telefone — evita misturar lead de clínicas diferentes com número parecido.

---

## 5. Consequência: hoje a trava 1 barraria 100% dos leads

Ao rastrear `atendimento_ia` pelos nodes, encontrei outra coisa. Procurei
`clinica_id` no JSON inteiro do workflow — **112 nodes, zero ocorrências**.
O mesmo para `especialidade_interesse_id` e para `clinicas.instancia_whatsapp`.

O node que cria lead, `Criar Cliente1`, grava exatamente quatro campos:

```
nome      ← NomeWhatsapp
telefone  ← remoteJid do webhook
criado_em ← $now
origem    ← "WhatsApp"   (literal, fixo)
```

Sem `clinica_id`. E a trava 1 barra lead sem clínica vinculada — decisão sua,
confirmada, e correta. O resultado combinado é que **todo lead novo vindo do
WhatsApp seria bloqueado**, sempre, com o motivo "lead sem clínica vinculada".
A Helô nunca responderia ninguém.

Isso não é defeito da trava. É um pedaço que falta antes dela: alguém precisa
decidir de qual clínica é a conversa.

A peça para isso já existe e está sem uso: **`clinicas.instancia_whatsapp`**.
O webhook da Evolution API diz por qual instância a mensagem chegou; a coluna
liga instância a clínica. É quase certamente para isso que ela foi criada.

Não implementei porque é decisão de negócio, não de código:

- Confirmar que `instancia_whatsapp` é mesmo o vínculo pretendido.
- Definir o que fazer quando a instância não bater com nenhuma clínica —
  bloquear (seguro) ou cair numa clínica padrão (arriscado com 12 clientes).
- Decidir se `Criar Cliente1` passa a gravar `clinica_id` na criação, ou se um
  node novo resolve isso antes das travas.

Enquanto isso não for decidido, as travas estão certas mas o caminho feliz
nunca acontece. Vale resolver antes de montar os nodes na cópia.

Um efeito menor do mesmo achado: como `especialidade_interesse_id` também
nunca é preenchido, a metade SQL da trava 3 hoje passa sempre. Quem segura
especialidade pausada, na prática, é só o prompt. A trava continua valendo a
pena — ela passa a funcionar no dia em que o interesse for registrado.

---

## 5-A. Estado da construção

**`Helô - Travas (dev)`** — id `J1rCthAxvek0491j`, projeto pessoal, criado em
22/09/2026, `active: false`. Doze nodes, conferidos no JSON bruto depois de
criar.

```
Entrada de teste (webhook POST /helo-travas)
  → Contexto e Travas          (uma consulta, os 4 vereditos + insumos)
  → Gravar mensagem do lead    (antes de qualquer decisão)
  → Trava 4 — Humano atendendo?
       ├ não → Humano já está atendendo        (fim, sem sinalizar)
       └ sim → Trava 1 — Clínica permite?
                  ├ não → Sinalizar CRC — Trava 1
                  └ sim → Trava 2 — Já houve conversa?
                             ├ não → Sinalizar CRC — Trava 2
                             └ sim → Trava 3 — Especialidade ativa?
                                        ├ não → Sinalizar CRC — Trava 3
                                        └ sim → Liberado para a IA
```

Os quatro `IF` leem `$('Contexto e Travas').item.json.travaN_ok`. Nenhum
calcula nada — a regra existe só na consulta.

`Liberado para a IA` é um node vazio de propósito: é onde entram o montar
prompt, a chamada ao Claude e o gravar da resposta, na próxima fase.

Nasceu fora do workflow principal pelo motivo do 4-A, não por preferência.
Quando o pacote da Evolution for instalado, vira sub-workflow chamado pelo
principal ou é transplantado para dentro dele.

Credencial `Supabase - Helô` anexada aos cinco nodes de banco em 22/09/2026.

### Query Parameters: use um array, nunca texto solto com vírgula

Esta é uma armadilha do node Postgres do n8n que custou três nodes quebrados.

O campo *Query Parameters* **parece** aceitar uma lista separada por vírgula,
misturando texto literal e expressões:

```
❌ ={{ $json.lead_id }},Primeiro contato deste lead.,Trava 2
```

O n8n descarta os trechos que não estão dentro de `{{ }}`. Sobra um parâmetro
onde a query espera três, e o Postgres responde `there is no parameter $2`.

O formato certo é **uma expressão só, devolvendo um array**:

```
✅ ={{ [$('Contexto e Travas').item.json.lead_id,
       "Primeiro contato deste lead. A IA não abre conversa.",
       "Trava 2 - primeiro contato é humano"] }}
```

Parte dinâmica entra concatenada dentro do array, com `+`.

O mesmo defeito estava em `Gravar mensagem do lead`, e ali **não apareceu nos
testes** porque os três trechos tinham chaves. Mas quebraria na primeira
mensagem de lead com vírgula — que em texto de WhatsApp é quase toda. Foi
corrigido junto: se a mensagem do lead não for gravada, o resto não deve
seguir como se tivesse sido, e parar em erro já é o comportamento padrão do
n8n para esse node.

---

## 5-B. A perna da IA, depois das travas

Montada em 22/09/2026. O `Liberado para a IA` deixou de ser node vazio:

```
Liberado para a IA
  → Montar prompt          (Code)
  → Chamar Claude          (HTTP Request)
       ├ sucesso → Gravar resposta da IA
       └ erro    → Sinalizar CRC — Falha na IA
```

### `Montar prompt`

Um node Code, e não expressões espalhadas, por um motivo concreto: transformar
histórico em turnos `user`/`assistant` não cabe numa expressão. A API da
Anthropic exige alternância, então mensagens seguidas do mesmo lado precisam
virar um turno só, e a conversa precisa começar pelo lead.

Três detalhes que o código resolve e que não são óbvios:

- **A mensagem nova não está no histórico.** `Contexto e Travas` roda *antes*
  de `Gravar mensagem do lead` — de propósito, é o que faz `total_mensagens`
  contar só o que veio antes, que é a pergunta da trava 2. Então a mensagem
  que acabou de chegar é anexada ao prompt à parte.
- **`json_agg` pode chegar como array ou como texto**, dependendo do driver.
  A função `lista()` aceita os dois.
- **Campo vazio vira `(nao cadastrado)`**, e o prompt diz explicitamente que
  isso significa "não sei, vou confirmar" e nunca "não existe". Sem isso, a IA
  preenche o buraco sozinha — "não trabalhamos com convênios" é uma frase que
  ela inventaria com naturalidade, e que hoje seria mentira.

### `Chamar Claude`

`POST https://api.anthropic.com/v1/messages`, modelo `claude-sonnet-5` — o
mesmo já configurado no `Anthropic Chat Model` do workflow principal.

A chave vem de uma **credencial do n8n** (`anthropicApi`), nunca escrita no
node.

**Duas tentativas, 2 segundos entre elas.** Uma oscilação de rede não deve
virar chamado para humano. Se as duas falharem, aí sim.

### O bloco de thinking — e por que `max_tokens: 400` estava errado

Custou um teste com crédito real. No Sonnet 5 **o raciocínio é adaptativo e já
vem ligado**: não é preciso pedir, e omitir o parâmetro não desliga. A resposta
então chega assim:

```json
{ "content": [ {"type": "thinking", ...}, {"type": "text", "text": "..."} ] }
```

Duas consequências, e as duas mordem:

**1. `content[0]` não é a resposta.** É o bloco de raciocínio. Ler por índice
fixo pegava o bloco errado e o insert quebrava com `null value in column texto`.
Procura-se **por tipo**, nunca por posição — e juntando todos os blocos de
texto, porque pode vir mais de um.

**2. O raciocínio consome do mesmo `max_tokens`.** Com 400, o teto podia se
esgotar antes de sobrar espaço para a resposta. Subiu para **2000**, folgado
para duas a quatro linhas, e o `effort` passou a **`low`** — conversa curta de
WhatsApp não paga esforço alto, e é o nível indicado para esse tipo de rota.

O `thinking` ficou ligado de propósito. Ajuda a respeitar as regras duras (não
inventar valor, não oferecer procedimento pausado), que é onde um erro custa
caro. Desligar é possível no Sonnet 5, se algum dia o custo pesar mais que isso.

### `Extrair resposta`

Existe porque há três casos em que a API responde **HTTP 200 e mesmo assim não
existe resposta para o lead**:

| Caso | `stop_reason` | O que seria gravado sem o node |
|---|---|---|
| A IA recusou | `refusal` | linha vazia, violando o `not null` |
| Resposta cortada no meio | `max_tokens` | meia frase enviada a um paciente |
| Nenhum bloco de texto | qualquer | linha vazia |

Nos três o node falha alto, e a falha cai no mesmo `Sinalizar CRC - Falha na
IA` do ramo de erro do HTTP. Chamar um humano é melhor que mandar qualquer
coisa.

### O ramo de erro

Seção 3.2 da especificação: falha na chamada não pode deixar o lead em
silêncio, e muito menos virar resposta inventada. A saída de erro do HTTP grava
uma linha `Automática` com a regra `Erro - chamada à IA falhou` e para.

A mensagem do lead já foi gravada lá atrás, antes de qualquer decisão — então
mesmo nesse caminho a conversa não some.

### O que falta

**Credencial da Anthropic.** É a única coisa entre isto e rodar os 4 cenários
do `src/data/testeIa.ts` de ponta a ponta.

Não há envio de WhatsApp aqui, e isso é de propósito: o webhook devolve a
resposta gerada (o `returning id, texto` do último node), que é o que a seção
3.1 item 9 da especificação pede para esta fase. Quem envia é o workflow
principal, quando o pacote da Evolution for instalado.

---

## 6. Onde ficaram as decisões

**a) Clínica inativa bloqueia a IA — DECIDIDO (21/09/2026).** `clinica_ativa
is not true` fica na trava 1. Erra para o lado seguro.

**b) Preços nulos — em aberto, não bloqueante.** As três linhas de
`clinica_especialidades` existem com `valor` em branco, e são dado real da
clínica, não dado de teste. A Helô vai responder "confirmo com a equipe" em
qualquer pergunta de preço — comportamento correto, mas nenhum teste de preço
exercita o caminho de verdade enquanto isso. Quem cuida do cadastro vai
preencher ao menos um valor antes dos cenários de preço.

**c) `leads.atendimento_ia` — RESOLVIDO (21/09/2026).** Não era resto de
desenho antigo: é o mecanismo de handoff humano manual, ativo. Virou a trava 4.

**d) Vínculo lead ↔ clínica — em aberto e BLOQUEANTE.** Ver seção 5.

---

## 7. Mensageria real do WhatsApp — estado em 22/09/2026

**O pacote da Evolution foi instalado.** O impedimento do 4-A caiu: a definição
do node resolve e a escrita programática voltou a funcionar em workflows que
contêm esses nós. Tudo que estava travado por ele está liberado.

### Feito

- **`mensagens.formato`** aceita agora `texto`, `audio`, `imagem` e `video`.
  Nenhuma linha existente violava. Atenção: `src/data/mensagens.ts` ainda
  declara `FormatoMensagem = "texto" | "audio"` — precisa alargar quando o
  painel passar a ler do banco.
- **`ROTA Mensagens1`** ganhou a saída `video` para `messageType =
  "videoMessage"`, no mesmo formato das outras quatro.
- **`Dados1`** mapeia `content_type = 'video'`, a URL do vídeo e a legenda
  dele (a legenda entrou junto porque o node já fazia isso para imagem, e sem
  ela o texto que o lead escreveu junto do vídeo se perderia).

### Onde a mensagem do lead é gravada: em lugar nenhum

Confirmado varrendo os 112 nós. Só **um** escreve em `mensagens`:
`Cria Histórico Supabase1`, sempre com `remetente_tipo: 'IA'` e `formato:
'texto'` fixos. Os nós `Salvar Historico2` e `Salvar Historico3` gravam em
`n8n_chat_histories`, que é a memória do agente — não é histórico de CRM.

Não precisa ser inventado: o node `Gravar mensagem do lead`, já construído e
testado no `Helô - Travas (dev)`, faz exatamente isso. Entra junto com as
travas, no transplante.

### Três coisas que não foram feitas, e por quê

**A saída de vídeo ficou sem ligação.** O caminho da imagem é
`Edit Fields4 → Converter Foto1 → OpenAI (visão)`. Mandar vídeo por ali
analisaria um vídeo como se fosse foto. Para onde o vídeo deve ir é decisão de
negócio.

**O `instanceName` fixo `"cheffin"` continua nos dois nós.** Trocar pela
referência do `Evolution API` quebraria: `Enviar Mensagem WhatsApp` nasce do
`Schedule Trigger3` e `Enviar texto1` do `Schedule Trigger` — **`Dados1` não
está no caminho de nenhum dos dois**, e referenciar um node que não executou
falha em tempo de execução. A fonte certa é `clinicas.instancia_whatsapp`,
que existe e segue sem uso.

**A captura de anúncio (CTWA) não foi codificada.** O próprio arquivo de
payloads diz que `contextInfo.externalAdReply` é estimativa não validada.
Continua pendente de um clique real num anúncio ou da documentação.

---

## 8. Transplante para o `Helô - base` — 23/09/2026

A cadeia validada no `Helô - Travas (dev)` entrou no workflow principal
(`gDP9Cy9pPeRGaRS5`), que continua **inativo**. 112 → 120 nós.

### O caminho da mensagem recebida, agora

```
ROTA Entrando ou Saindo1 [incoming]
  → Contexto e Travas          os 4 vereditos + insumos, numa consulta
  → Gravar mensagem do lead    antes de qualquer decisão
  → Rota Atendimento1          passou a ler trava4_ok
       ├ IA pausada → Salvar Historico2        (como antes)
       └ IA Ativa   → Trava 1 → Trava 2 → Trava 3 → ROTA Mensagens1
                        ↓         ↓         ↓
                     Sinalizar CRC — Trava 1 / 2 / 3
```

**`ROTA Mensagens1` passou a ter uma única entrada: `Trava 3`.** É a
verificação que importa — não existe caminho que chegue à IA sem passar pelas
quatro travas.

### Duas mudanças com consequência

**`Rota Atendimento1` deixou de comparar `atendimento_ia` com `'pause'`.** Lê
`trava4_ok`. Era obrigatório, não opcional: com nós novos antes dele, `$json`
deixou de ser a linha do lead. De quebra resolveu o furo — `'PAUSE'` ou
`'pausado'` agora bloqueiam em vez de liberar.

**O `CASE` de tradução do formato.** `Dados1.content_type` fala inglês
(`text`, `audio`, `image`, `video`) e `mensagens.formato` fala português. A
tradução acontece dentro do `insert`, num lugar só, com `'texto'` como padrão
para tipo desconhecido.

### Removido

`Supervisor1 → Busca Telefone1`, a conexão morta que a seção 7 do handoff
pedia para tirar. O nó continua existindo, desativado e agora desconectado.

### O que ainda impede a ativação

1. **Credenciais da Evolution API e do Redis não existem.** Só há
   `Supabase - Helô` e `Anthropic account`. Os nós de envio e o buffer de
   mensagens falham na primeira execução real.
2. **Destino da saída de vídeo** — decisão de negócio (seção 7).
3. **Fonte do `instanceName`** — `clinicas.instancia_whatsapp` (seção 7).
4. **Campo do CTWA** — pendente de payload real (seção 7).

Uma observação para quando rodar: mensagem de áudio ou vídeo sem legenda grava
`texto` vazio. O formato fica correto, e a lista do painel já mostra "Áudio"
pelo `formato` — mas a bolha da conversa pode aparecer em branco. Vale decidir
se o painel renderiza por formato ou se o `insert` guarda um marcador.

---

## 9. Vídeo, bolha sem texto, e uma regressão que eu causei

### A regressão, primeiro

No transplante da seção 8 eu removi `Supervisor1 → Busca Telefone1`, seguindo
a seção 7 do handoff. **Isso quebrou a gravação da resposta da IA.**

A cadeia real era:

```
Supervisor1 → [Busca Telefone1] → [If] → [Adiciona CHAT supabase1] → Cria Histórico Supabase1
                 desativado      desativado     desativado              ATIVO
```

No n8n, **nó desativado passa o dado adiante**. Os três desativados eram um
cano, e `Cria Histórico Supabase1` — o único nó que grava a resposta da IA em
`mensagens` — bebia dali. Cortar a ponta do cano secou o nó do fim.

Nem o aviso de nó desconectado apontava para isso: ele reclamou do
`Busca Telefone1`, que é inerte, e não do nó ativo que dependia dele.

Consertado ligando **`Supervisor1 → Cria Histórico Supabase1` direto**. Melhor
que restaurar a ligação antiga: acaba a dependência de passagem por nós
desativados, que foi o que escondeu o problema.

### Vídeo recebido

```
ROTA Mensagens1 [video]
  → Resposta padrão - vídeo   (Set: o texto mora aqui, num lugar só)
  → Responder vídeo           (envio próprio)
  → Gravar resposta - vídeo   (Automática, status enviada)
```

Não processa o vídeo. O conteúdo já ficou salvo pelo `Gravar mensagem do lead`
para a equipe revisar; aqui é só o acolhimento.

Três decisões: o texto vive num nó `Set` para não existir duas vezes (envio e
gravação leem dele); o envio tem nó próprio em vez de reusar o `Evolution API`,
que vive dentro do laço que fatia a resposta da IA em várias mensagens; e a
gravação vem **depois** do envio, com `status: 'enviada'`, para o histórico só
registrar o que de fato saiu.

E, por construção, esse ramo está depois das quatro travas — um vídeo de lead
em primeiro contato, ou de clínica pausada, não recebe a resposta padrão.

### Bolha sem texto

`textoVisivel()` em `mensagens.ts`: devolve o texto quando existe, e o rótulo
do formato quando não existe. A mesma função alimenta a bolha da conversa e o
trecho da lista de Atendimento, para as duas telas nunca discordarem.

**O `insert` não mudou** — continua gravando o texto real, vazio como veio.
O rótulo é decisão de exibição. Inventar conteúdo no banco tiraria de quem lê
o histórico a capacidade de distinguir o que o lead escreveu do que o sistema
preencheu por ele.

Usei ícone do lucide (`Mic`, `Image`, `Video`) em vez de emoji, para ficar
igual ao resto do painel. Se preferir o emoji, é uma linha.

Sete casos testados na função, incluindo texto só com espaços e mídia **com**
legenda (que mostra a legenda, não o rótulo).

**O que não deu para verificar ao vivo:** a bolha vazia em si. Os dados fixos
do painel não têm nenhuma mensagem sem texto — isso só aparece quando o
WhatsApp real gravar. Conferi que a conversa atual continua renderizando igual,
e a lógica por teste direto.

---

## 10. A instância do WhatsApp vem da clínica — 23/09/2026

O `"cheffin"` fixo saiu dos dois nós de envio agendado. Nenhuma das duas
cadeias consultava clínica, então entraram dois nós de consulta:

```
AI Agent1       → Resolver instância - chat     → Tem instância? → Enviar texto1
Secretary Agent → Resolver instância - lembrete → Tem instância? → Enviar Mensagem WhatsApp
                                                         ↓ não
                                             Sinalizar CRC - sem instância
```

### A consulta, e por que ela normaliza o telefone

```sql
select l.id as lead_id, c.instancia_whatsapp
from leads l
left join clinicas c on c.id = l.clinica_id
where regexp_replace(l.telefone, '\D', '', 'g')
    = regexp_replace($1::text, '\D', '', 'g')
order by l.criado_em desc
limit 1;
```

A normalização não é zelo: **sem ela a consulta nunca acharia nada.**
`Criar Cliente1` grava `leads.telefone` a partir do `remoteJid`, ou seja o JID
completo (`5511977776666@s.whatsapp.net`); já `Extrair Número do Cliente1`
produz só dígitos, de um regex sobre a descrição do evento do Calendar.
Comparar os dois direto daria zero sempre.

Testado no banco com os três formatos — JID, dígitos crus e número formatado
com parênteses e hífen. Os três casam com o mesmo lead; telefone desconhecido
devolve nada.

### Os dois jeitos de não enviar

| Situação | O que acontece |
|---|---|
| Telefone não casa com nenhum lead | a consulta devolve **zero linhas** e a cadeia para. Sem envio e sem registro — não há lead a que anexar a nota. |
| Lead existe, clínica sem instância | um lead existe, então grava linha `Automática` com a regra `Envio bloqueado - sem instância`, **sem `status`** (não foi enviada). |

### Um efeito imediato que vale saber

**Nenhuma clínica tem `instancia_whatsapp` preenchida hoje.** Com os dados
atuais, todo envio agendado cai no ramo de bloqueio e sinaliza em vez de
enviar. É o comportamento correto — e é bem melhor que mandar para `"cheffin"`,
que não existe — mas significa que preencher essa coluna virou pré-requisito
de qualquer envio.

### Um erro que a inserção quase causou

`Enviar Mensagem WhatsApp` lia o texto de `{{ $json.output }}`. Com nós novos
antes dele, `$json` deixaria de ser a saída do `Secretary Agent` e passaria a
ser a linha da consulta — o envio sairia sem texto. Passou a referenciar
`$('Secretary Agent')` explicitamente. É o mesmo tipo de armadilha do
`Rota Atendimento1` na seção 8: inserir um nó no meio de uma cadeia muda o que
`$json` significa dali para frente.

---

## 11. O buffer de rajada saiu do Redis — 23/09/2026

Não havia Redis nenhum configurado: zero credenciais do tipo, e os sete nós
Redis sem credencial. Em vez de provisionar um serviço, o buffer passou a sair
da própria conversa — que já é gravada em `mensagens` desde o transplante.

### Como era e como ficou

| | Redis | Postgres |
|---|---|---|
| Onde a mensagem ficava | lista com chave = telefone | `mensagens`, onde já estava |
| Quem desempatava | comparar o **texto** da mensagem com o último da lista | comparar o **id** |
| Limpar depois | dois nós de `delete` | nada a limpar |
| Transcrição do áudio | empilhada só na lista | **atualiza a linha do CRM** |

```
ROTA Mensagens1 [texto] ────────────────────────────┐
OpenAI5 → Texto do áudio ─────┐                     │
If7 → Texto da imagem ────────┼→ Atualizar texto ───┤
If7 → Texto da imagem c/ leg ─┘    da mídia         │
                                                     ▼
                                                 Mensagem1
                                                     ↓
                                          Intervalo entre Mensagens1
                                                     ↓
                                            Mensagens pendentes
                                                     ↓
                                             Compara Memoria
                                    ├ sou a última → Mensagem Completa → Supervisor1
                                    └ não sou      → No Operation
```

### A consulta que substitui o buffer

```sql
select
  coalesce(string_agg(nullif(btrim(texto), ''), E'\n' order by id), '') as mensagem_completa,
  coalesce(max(id), 0)::int as ultima_id,
  count(*)::int as quantas
from mensagens
where lead_id = $1::int
  and remetente_tipo = 'Lead'
  and id > coalesce((select max(id) from mensagens
                      where lead_id = $1::int
                        and remetente_tipo <> 'Lead'), 0);
```

A fronteira do "já respondido" é a última linha que **não** é do lead. Ela anda
sozinha quando a resposta é gravada — por isso não existe buffer para limpar,
e os dois nós de `delete` do Redis deixaram de ter função.

### Três ganhos que não eram o objetivo

**O desempate ficou correto.** O anterior comparava o *texto* da mensagem com
o último item da lista. Se o lead mandasse "oi" duas vezes seguidas, as duas
execuções se achariam a última e a Helô responderia duas vezes. Comparando id,
isso não acontece.

**A transcrição do áudio entra no histórico.** Antes ela só existia dentro da
lista do Redis, e a linha em `mensagens` ficava sem texto. Agora o nó
`Atualizar texto da mídia` atualiza a mesma linha — o CRM passa a mostrar o que
foi dito no áudio, não "Áudio enviado".

**Um serviço a menos** para provisionar, monitorar e que pode cair.

### Testado

Quatro execuções simuladas no banco, sem gravar nada. Rajada de três mensagens:
as duas primeiras param, a terceira responde, e as três veem o mesmo texto
agrupado. Lead sem resposta anterior: pega tudo desde o começo. Mensagem em
branco no meio: fica fora do texto agrupado.

### A janela é de 1 segundo — e provavelmente é curta demais

`Intervalo entre Mensagens1` tem `amount: 1` e nenhuma unidade. O padrão do nó
Wait é **segundos**, então o agrupamento só pega mensagens separadas por menos
de um segundo.

Isso é anterior a esta mudança, mas importa: com um segundo, alguém digitando
"Oi" e depois "quanto custa?" recebe duas respostas. Janela típica de digitação
é de 5 a 15 segundos. Não mexi porque é decisão de produto — mais janela
significa resposta mais lenta.

### Os sete nós do Redis

Desativados **e desconectados**. As duas coisas: no n8n, nó desativado passa o
dado adiante, e foi exatamente isso que escondeu a regressão da seção 9.

---

## 12. Resolver Clínica, e por que os testes ainda não rodaram — 23/09/2026

### O vínculo lead ↔ clínica fechou

A decisão da seção 4-C virou nó. `Resolver Clínica` entra **depois** do
`Normal ou Treinamento1` e antes do `Buscar Cliente1`:

```sql
select id as clinica_id, nome as clinica_nome, instancia_whatsapp
from clinicas
where instancia_whatsapp = $1::text
limit 1;
```

Depois, e não antes, por um motivo concreto: `Normal ou Treinamento1` lê
`$json.message.content`, e um nó novo no meio mudaria o que `$json` significa
— a mesma armadilha do `Rota Atendimento1` e do `Enviar Mensagem WhatsApp`.

**Não filtra por `ativa`** de propósito. Clínica inativa deve ser barrada pela
trava 1, que grava o motivo no histórico, e não sumir em silêncio aqui.

`Criar Cliente1` passou a gravar `clinica_id`, e `Buscar Cliente1` a filtrar
por telefone **e** clínica.

Testado: `helo-teste` resolve para a clínica 1; instância desconhecida devolve
nada, e a cadeia para.

### Sem isso, os sete testes dariam o mesmo resultado

`Criar Cliente1` não gravava `clinica_id`, e a trava 1 barra lead sem clínica.
Todo payload de teste terminaria em `Sinalizar CRC - Trava 1`, com o motivo
"lead sem clínica vinculada". Sete execuções idênticas, nenhuma exercitando o
que se queria testar.

### Por que os testes não rodaram

Os dois webhooks recusam POST enquanto o workflow está inativo:

| URL | Resposta |
|---|---|
| `/webhook-test/<path>` | 404 — *"Click the 'Execute workflow' button on the canvas, then try again. In test mode, the webhook only works for one call after you click this button"* |
| `/webhook/<path>` | 404 — *"The workflow must be active for a production URL to run successfully"* |

E o `test_workflow` do n8n não serve: ele **fixa** todo nó com credencial, o
que inclui os cinco Postgres e os quatro da Evolution. Não escreveria em
`mensagens` nem exercitaria as travas — testaria a fiação, não o
comportamento.

Então os testes dependem de uma das duas: alguém clicar "Execute workflow" no
canvas antes de cada disparo (uma chamada por clique, então sete cliques), ou
o workflow ser ativado.

### O envio pelo painel não existe

Pergunta mais crítica da rodada, e a resposta é curta: **quando o CRC responde
pela tela de atendimento, a mensagem não sai do navegador.**

`enviarMensagem` em `ProvedorLeads.tsx` faz uma coisa só — `setMensagens`, que
acrescenta um item ao estado do React. Não há `fetch`, não há webhook, não há
Evolution. Recarregar a página apaga.

Não é defeito: o painel foi construído como demonstração sobre dado fixo, e o
comentário do provedor diz isso desde sempre. Mas significa que **o caminho
humano → lead não existe em lugar nenhum** — nem pelo n8n, nem direto. Só o
caminho da IA existe.

Construir isso é trabalho novo dos dois lados: uma rota no Next que recebe o
texto, e um webhook no n8n que grava em `mensagens` como `Humano` e manda pela
Evolution — ou o painel falando direto com a Evolution, o que espalharia a
credencial para o servidor do painel.
