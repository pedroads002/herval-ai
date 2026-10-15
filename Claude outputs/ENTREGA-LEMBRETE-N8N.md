# Lembrete de consulta no n8n — estado em 09/10/2026, 19:50

Workflow: **`gDP9Cy9pPeRGaRS5` — "Helô - base"** em `https://n8n.hervalmarketing.com`
Ramo: **Lembrete de Agendamento**

Objetivo da seção: o paciente recebe **dois** avisos da consulta — um **24h antes** e outro
**2h antes**. Antes disso recebia um só, e na hora errada.

---

## 1. O QUE JÁ ESTÁ FEITO E PUBLICADO — não refazer

Versão publicada: **"Lembrete em dois horários (24h e 2h)"**, `ef01f91e-5689-4d60-9b91-483143c7b1bf`,
criada em 09/10/2026 19:14. Conferido no servidor campo por campo. Tudo abaixo **está salvo**:

| Item | O que foi feito | Confirmado |
|---|---|---|
| `Schedule Trigger3` | Passou a rodar a cada **15 minutos** | ✅ |
| `Get upcoming event` | Janela `Before` = `{{ $now.plus({ hours: 25 }) }}`, `Limit` = 250 | ✅ |
| **`Qual lembrete?`** (node novo, Code) | Decide se a consulta está na hora de um dos dois avisos e etiqueta o item com `lembrete: "24h"` ou `"2h"` | ✅ |
| `Already sent?` | Chave do dedupe virou `{{ $json.id }}-{{ $json.lembrete }}` | ✅ |
| `Secretary Agent` | O `Prompt (User Message)` ganhou a linha "Tipo de lembrete", que diz à IA se é o aviso de véspera ou o final | ✅ |

**Ordem da esteira (não reordenar):**
`Schedule Trigger3` → `Get upcoming event` → **`Qual lembrete?`** → `Already sent?` →
`Extrair Número do Cliente1` → `Validar Número Encontrado1` → `Secretary Agent` →
`Resolver instância - lembrete` → `Tem instância? - lembrete` → `Enviar Mensagem WhatsApp`

### Três decisões que não podem ser desfeitas sem quebrar

1. **O portão de horário (`Qual lembrete?`) tem que vir ANTES do `Already sent?`.**
   Se o dedupe rodasse primeiro, uma consulta vista cedo demais seria marcada como "já
   avisada" e nunca receberia aviso nenhum.
2. **A chave do dedupe tem que levar a etiqueta.** Só com o `id`, o aviso de 24h marcaria a
   consulta como avisada e o de 2h seria descartado.
3. **O `timeMin`/`timeMax` do Google Calendar pega evento que CRUZA a janela, não que
   COMEÇA nela.** Foi essa a causa do defeito original. A janela sozinha nunca resolve —
   por isso existe o `Qual lembrete?`.

### Teste já feito

Três consultas falsas (+24h, +2h, +7h) foram fixadas no `Get upcoming event` (pinned data) e
o `Qual lembrete?` rodou sozinho com `Execute step`. Resultado na tela: **2 itens**, um com
`"lembrete": "24h"` e outro com `"lembrete": "2h"`; a de +7h caiu fora, como devia.
O pin foi removido depois. **Esse teste não precisa ser repetido.**

### Código do `Qual lembrete?` (já está no servidor, é só referência)

```javascript
// Decide se esta consulta esta na hora de um dos dois lembretes, e etiqueta
// qual deles e. Quem nao esta na hora de nenhum, nao passa daqui.
const FOLGA = 15; // minutos; igual ao intervalo do gatilho, de proposito
const AVISOS = [
  { etiqueta: "24h", minutos: 24 * 60 },
  { etiqueta: "2h", minutos: 2 * 60 },
];
const agora = Date.now();
const saida = [];
for (const item of $input.all()) {
  const inicio = item.json.start?.dateTime;
  if (!inicio) continue; // evento de dia inteiro nao tem hora marcada
  const quando = new Date(inicio).getTime();
  if (Number.isNaN(quando)) continue;
  const faltam = (quando - agora) / 60000;
  const aviso = AVISOS.find(
    (a) => faltam >= a.minutos - FOLGA && faltam < a.minutos + FOLGA,
  );
  if (!aviso) continue;
  saida.push({ json: { ...item.json, lembrete: aviso.etiqueta } });
}
return saida;
```

Comentários sem acento de propósito — o editor de código do n8n embaralha acento em
comentário. O texto que o paciente lê continua com acento.

### Credencial do Google Calendar

Criada e conectada por ele: **`Google Calendar account`**, tipo `googleCalendarOAuth2Api`,
id `dzHgssXKR0RVfbxM`. Redirect URI usada:
`https://n8n.hervalmarketing.com/rest/oauth2-credential/callback`
Também foi criada uma agenda nova no Google, **"Teste Lembrete"**, para o teste real.

---

## 2. O QUE FALTA — e o estado em que o rascunho está agora

> ⚠️ **Existe um rascunho NÃO publicado no servidor (19:45) e ele está pior que a versão
> publicada. NÃO publique esse rascunho como está.**

Comparação do node `Get upcoming event`:

| Campo | Versão publicada (19:14) ✅ | Rascunho atual (19:45) ⚠️ |
|---|---|---|
| `resource` / `operation` | `operation: getAll` (Event → Get Many) | `resource: calendar`, **sem operation** — virou outra operação, não busca mais eventos |
| `limit` | `250` | **desapareceu** |
| `timeMax` (Before) | `{{ $now.plus({ hours: 25 }) }}` | igual ✅ |
| `calendar` | `Agente de Atendimento` (agenda da clínica) | `pedroaguiarsdr@gmail.com` (**agenda pessoal dele**) |
| credencial | nenhuma | `Google Calendar account` ✅ |

Ou seja: ao conectar a credencial, o `Resource` do node foi trocado sem querer de **Event**
para **Calendar**, e isso derrubou o `Operation` e o `Limit`. Do rascunho, a única coisa que
vale a pena guardar é a credencial.

**Observação:** o campo `After` (`timeMin`) nunca esteve salvo, nem na versão publicada. Isso
**não é um problema** — o `Qual lembrete?` só aceita consulta que começa dentro das janelas
de 24h e 2h no futuro, então evento passado é descartado de qualquer forma. Não precisa
preencher.

### Tarefa A — consertar o `Get upcoming event`

Abrir o node e deixar exatamente assim:

- **Credential:** `Google Calendar account`
- **Resource:** `Event`
- **Operation:** `Get Many`
- **Calendar:** `Teste Lembrete` *(durante o teste — ver Tarefa D para depois)*
- **Return All:** desligado · **Limit:** `250`
- **Before:** `{{ $now.plus({ hours: 25 }) }}`
- **After:** deixar vazio

Depois: **Publish**.

> 🔴 Por que o calendário importa tanto: este ramo lê o telefone do título/descrição do
> evento e **manda WhatsApp de verdade**. Se ficar apontado para a agenda pessoal, qualquer
> compromisso pessoal com um número dentro vira mensagem para uma pessoa real.

### Tarefa B — dar um modelo de IA ao `Secretary Agent`

Aprovado por ele como "opção A": usar **Anthropic**, que já é o provedor da casa aqui.

Estado atual: o `Secretary Agent` está ligado ao **`OpenAI Chat Model5`**, que está
**desativado e sem nenhuma credencial** — e não existe credencial OpenAI nenhuma neste n8n.
Do jeito que está, o lembrete morre calado no passo da IA, mesmo com tudo o resto certo.

Como fazer:

1. Passar o mouse no fio pontilhado entre `OpenAI Chat Model5` e `Secretary Agent` e
   **apagar só o fio** (ícone de lixeira). O n8n aceita um só Chat Model por agente — é por
   isso que o `+` não deixa adicionar outro enquanto o fio existe.
2. Clicar no `+` do conector **Chat Model** embaixo do `Secretary Agent`.
3. Escolher **`Anthropic Chat Model`**.
4. Credential: **`Anthropic account`** (id `xvRMhkj4JLcUDsjr`, já existe).
5. Model: **`Claude Sonnet 5`** (`claude-sonnet-5`) — é exatamente o que o
   `Anthropic Chat Model` do `Supervisor1` já usa neste mesmo workflow.
6. Fechar e **Publish**.

> **Não apagar o `OpenAI Chat Model5`.** Ele já está desativado e inerte, e não há garantia
> de que nada mais no workflow faça referência a ele.

### Tarefa C — teste real (o único teste que falta)

1. Criar na agenda **Teste Lembrete** um evento com o telefone de teste
   **+55 61 98418-8473** na **descrição do evento** (não na descrição da agenda — a agenda é
   ignorada), em um horário que dê folga de configuração.
2. Reativar os dois nodes desligados, selecionando cada um e apertando **`D`**:
   - `Schedule Trigger3` (hoje `disabled: true`)
   - `Get upcoming event` (hoje `disabled: true`)
3. **Publish.**
4. Esperar. O gatilho roda a cada 15 min; o aviso de 2h chega por WhatsApp cerca de 2h antes
   do evento (folga de ±15 min).
5. Confirmar que a mensagem chegou e que o texto diz "hoje, daqui a cerca de 2 horas".

O workflow em si já está `active: true` — o que segura o ramo é só esses dois nodes
desativados.

### Tarefa D — depois do teste

1. Trocar o `Calendar` do `Get upcoming event` de `Teste Lembrete` para
   **`Agente de Atendimento`** (id
   `3180fa1001aa40ed9116c309144b17c5a29c36e068474966e442de99c180e364@group.calendar.google.com`).
2. Conectar a conta Google **da clínica** no lugar da pessoal dele.
3. Conferir se nenhum outro node do workflow pegou a credencial pessoal.

---

## 3. Coisas que eu vi e NÃO mexi (não estavam no escopo aprovado)

- **`Validar Número Encontrado1`** tem uma condição `or` que é sempre verdadeira — ou seja,
  não valida nada. Passa qualquer coisa adiante.
- **`Secretary Agent`** está com `Require Specific Output Format` **ligado** e **nenhum
  output parser conectado**.
- **`Log de Erro - Sem Telefone1`** está sem `parameters.url`. Está desativado, então é
  inerte hoje, mas quebra se alguém ligar.

---

## 4. Regras que valem para quem continuar

- **Nunca rodar `Execute workflow` na tela.** Esse workflow manda WhatsApp real para leads
  reais. Só `Execute step` em node isolado (Code, com dados fixados) é seguro.
- **Nada de publicar sem o Pedro confirmar**, caso por caso.
- **Quem digita credencial é ele**, nunca o agente. Nenhuma API key, senha ou token deve ser
  digitada por automação em campo nenhum do n8n.
- O workflow **`JZUSk4iSyBrHEhtQ` não deve ser tocado.**
- Se sobrar dado fixado (pinned data) em algum node, a produção passa a usar a consulta
  falsa. Sempre **Unpin** depois de testar.
- **O n8n aqui não tem botão Save, só `Publish`.** Enquanto não publicar, o trabalho existe
  só na aba do navegador — fechar a aba perde.
