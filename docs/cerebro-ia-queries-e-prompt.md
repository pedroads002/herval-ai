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
corrigido junto, e o node ganhou `onError: stopWorkflow`: se a mensagem do
lead não for gravada, o resto não deve seguir como se tivesse sido.

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
