# Helô - Herval AI — Especificação: Nova Área de Atendimento

**Contexto:** hoje a Helô não tem nenhuma camada operacional de atendimento — o CRC não tem um chat centralizado com o lead, não tem ligação integrada, e não consegue agendar a consulta do lead sem sair do fluxo. Esta especificação nasce da depuração do Workstation da Mavi (documentada em `WORKSTATION-MAVI_relatorio-area-de-chat.md`), usado como referência de mercado — **adaptado**, não copiado, às regras específicas da Helô.

**Fora de escopo aqui (mesma fronteira do documento técnico anterior):** a integração real de telefonia, a API de chamada de voz do WhatsApp Business, e a inteligência da IA (o que a Helô decide responder no chat). Este documento especifica estrutura, dado e regra de negócio — o que precisa existir para essa integração ser plugada depois pela sua parceira.

---

## 1. Diferenças deliberadas em relação à Mavi (não é cópia 1:1)

| Na Mavi | Na Helô |
|---|---|
| A própria IA (Mavi) faz ligações — "Histórico de Ligações **IA**" | Ligação é **sempre ação humana** do CRC. A Helô nunca liga. |
| Só um canal de ligação (discador via Api4Com) | **Dois canais** disponíveis pro CRC: discador tradicional e **chamada via WhatsApp** — o CRC escolhe qual usar por lead |
| Terminologia própria da Mavi | Segue o vocabulário já fixado no projeto: CRC (não "CS"), Helô (não "Mavi") |

---

## 2. Relação com a Fila de Atendimento v1 (confirmado)

**Confirmado por você:** essa nova área de Atendimento **convive** com a "Fila de Atendimento" v1 já existente — não substitui, não se funde. A Fila de Atendimento v1 continua sendo a tela **analítica** (métricas agregadas do time); essa nova área é a camada **operacional** (o CRC trabalhando um lead de cada vez, dentro da conversa). Uma mede o trabalho, a outra é onde o trabalho acontece.

Isso tem uma implicação direta: a sequência de ligação/mensagem definida na seção 5.1 é exatamente o que passa a alimentar de dado real as métricas de "tempo de resposta" e "primeiro contato" que já existem na Fila de Atendimento v1 — ver seção 5.1.2.

---

## 3. Estrutura da tela

### 3.1 Ponto de entrada
Diferente da Mavi (que tem uma "Fila de Leads" própria, redundante com o Kanban dela), a Helô **já tem** um Kanban/Funil com as 16 etapas. Recomendação: o ponto de entrada para o atendimento individual é o **próprio card do lead no Kanban** (ou um botão "Atender" nele) — não duplicar uma segunda lista. Isso evita recriar o problema de fonte duplicada que a gente já resolveu na Fase de Unificação.

**Atenção de escopo (achado do Claude Code):** esse ponto de entrada só cobre os 74 leads da fila viva — os 2.936 leads históricos não têm nome, telefone nem mensagem, então nunca tiveram uma conversa de verdade. Está certo pro MVP (não faz sentido "atender" um lead histórico), mas a tela precisa nascer sabendo disso — nenhuma rota genérica que tente abrir o atendimento de um lead histórico e quebre.

### 3.2 Tela de atendimento individual (chat) — 3 colunas, como na Mavi

**Cabeçalho:** nome do lead, telefone, clínica, origem, etapa atual. Botões de ação: **Ligar** (abre seletor de canal — discador ou WhatsApp, ver seção 5.1), e as ações de etapa que já existem hoje no sistema (mover etapa, marcar Venda Ganha/Perdida com suas regras já vigentes).

**Coluna esquerda — dados do lead:**
- Dados de contato (já existentes em `leads.ts`)
- **Notas internas** — campo novo (não existe hoje na Helô). **Decidido:** não é um campo único editável — é uma **lista de notas**, cada uma com autor e horário, nunca sobrescrevendo a anterior. Mesmo princípio de rastreabilidade já usado em todo o resto do sistema (`historicoEtapas.ts` e afins). Um campo que se apaga a cada edição contradiz a base em que o resto da Helô foi construído.
- **Atividades do lead** — pode reaproveitar `historicoEtapas.ts`, que já registra toda mudança de etapa com timestamp e agente.

**Coluna central — chat:**
- Histórico de mensagens entre lead e Helô/CRC. Estrutura de dado detalhada na seção 4.
- Barra de envio de mensagem para o CRC assumir a conversa manualmente quando necessário.

**Coluna direita — abas**, adaptando as 4 vistas na Mavi:

1. **Agenda** — botão "Agendar Consulta", que abre o mesmo tipo de formulário visto na Mavi (ver seção 3.3). Deve gravar em `agendamentos.ts`, a fonte única de verdade já estabelecida — **não criar uma tabela paralela**.
2. **Ligações** — histórico de ligações feitas pelo CRC (nunca pela Helô). Cada registro guarda o canal usado (discador ou WhatsApp). Estrutura na seção 4.
3. **Clínica** — ficha de contexto da clínica. **Confirmado:** vai ser enriquecida com o mesmo nível de detalhe visto na Mavi — estratégia e diferenciais, comercial e condições (parcelamento, formas de pagamento, convênios cobertos), público-alvo (classe econômica, faixa etária, principais dores) e valores por procedimento. Isso significa estender `clinicas.ts`, que hoje só tem nome, cidade, número de unidades e ativa/inativa — ver seção 4.

   **Decisão pendente pra Fase 3 (achado do Claude Code):** `Profissional` hoje só tem `especialidadeIds`, e `Especialidade` tem um valor de avaliação global — nenhum dos dois está vinculado a uma clínica específica. A ficha nova pede valores por procedimento *por clínica*, e o formulário de agendamento (seção 3.3) pede "Especialista" — sem esse vínculo, o seletor ofereceria o mesmo elenco de profissionais pras 12 clínicas, o que não faz sentido. Precisa ser resolvido antes ou durante a Fase 3, não é urgente agora.
4. **Log** — **a Helô já tem exatamente o dado pra isso**: `historicoEtapas.ts` já registra cada mudança de etapa com quem fez e quando. Essa aba praticamente já está pronta do lado de dado, só falta a interface.

### 3.3 Agendar consulta direto do chat
Mesmos campos vistos na Mavi, adaptados:
- Lead (pré-preenchido, vem do contexto)
- Procedimento/especialidade
- Especialista
- Data
- Horário — **ajuste do Claude Code:** só o horário de início precisa ser gravado. `Agendamento` hoje só tem início; o horário final é derivável de `especialidades.duracaoMinutos`, que já existe. Não gravar os dois separadamente — dois campos que precisam concordar entre si é como divergência de dado começa.
- Observações (campo livre, opcional)

Grava em `agendamentos.ts` — mesma fonte usada por Kanban, Agenda e Relatórios hoje. Isso é importante: se esse agendamento não passar pela mesma fonte, os Relatórios ficam errados de novo (foi exatamente o bug que resolvemos na Fase de Unificação).

**Boa notícia encontrada pelo Claude Code:** essa funcionalidade não é 100% nova — `definirConsulta`, já existente em `ProvedorLeads`, já cobre exatamente os campos que essa spec pede (profissional, especialidade, dia, hora). Falta só adicionar o campo de observação. Isso reduz bastante o risco dessa fase.

---

## 4. Modelo de dado — o que já existe vs. o que é novo

### Já existe e pode ser reaproveitado
- **`agendamentos.ts`** — o "Agendar Consulta" grava aqui, sem mudança de estrutura.
- **`historicoEtapas.ts`** — alimenta a aba "Log" praticamente pronto.
- **`clinicas.ts`** — base da aba "Clínica", precisa de campos novos se você decidir enriquecer (ver 3.2, item 3).
- **`leads.ts`** — dados de contato do lead.

### Novo — não existe hoje na Helô
- **Modelo de mensagens bidirecional.** Hoje a Helô só tem `EventoHistorico`, **dentro de `tarefas.ts` (campo de `Tarefa`, não de `Lead`** — correção do Claude Code sobre este próprio documento, que originalmente dizia `leads.ts`), um **log unidirecional** de mensagens que a IA enviou — não registra resposta do lead, não é uma conversa de verdade, e por estar preso a `Tarefa` só existe pros 74 leads da fila. Pra essa tela funcionar, precisa de uma estrutura de chat real, nova, própria: quem enviou (lead / Helô / CRC humano), conteúdo, formato (áudio ou texto — relevante pra regra 5.1, que exige predominância de áudio), horário, e status de entrega/leitura (opcional — sem WhatsApp real integrado, nunca vai ser preenchido; mesma decisão já tomada com `hora`/`profissionalId` em agendamentos). Precisa também suportar mensagens de origem `Automática` (ex.: a mensagem de retomada em T+8h, seção 5.1) — mesmo conceito de tipo de agente já usado em `historicoEtapas.ts`.

  **Recomendação de implementação do Claude Code, que faz sentido adotar:** entidade própria `mensagens.ts`, por `leadId`, no mesmo molde de `agendamentos.ts` — migrando os 135 eventos existentes pra lá e **removendo** `Tarefa.historico` (não deixando os dois coexistirem, mesmo raciocínio de fonte única já usado quando `Tarefa.consulta` foi removido em favor de `agendamentos.ts`). Migração barata: só `TabelaTarefas.tsx:398` lê esse campo hoje.
- **Notas internas por lead** — lista de notas com autor e horário (ver decisão na seção 3.2), não existe hoje.
- **Histórico de ligações** — registro por lead, um item por tentativa: quem ligou (sempre humano), **canal** (`discador` ou `whatsapp`), **número da tentativa** dentro da sequência (até 3 no discador, até 2 no WhatsApp, mais a eventual 6ª tentativa de recuperação em T+8h — ver 5.1), horário, e **desfecho** (`atendida` / `não atendida`). A partir desses registros, dá pra derivar a contagem total de tentativas por canal para cada lead (não precisa gravar um contador solto — soma-se pelos registros, mesmo princípio de "derivado, não duplicado" já usado em `ehQualificado`). O horário da primeira tentativa também é o marco que abre a janela de 8h da regra 5.1 — vale nascer com um jeito fácil de consultar "primeira tentativa deste lead" sem varrer tudo. **Dois pontos técnicos do Claude Code:** os horários precisam seguir a mesma convenção de tempo relativo (`minutosAtras`) usada em todo o resto da base — timestamp fixo faria a regra das 8h parar de fazer sentido conforme a base envelhece; e o padrão de "consulta rápida por lead" já existe pronto em `indexarPorLead`/`entradaNaEtapa` (`historicoEtapas.ts:3099`) — reaproveitar essa forma, não inventar uma nova.
- **Campos de enriquecimento de `clinicas.ts`** — estratégia e diferenciais (tratamento foco, história, tratamentos oferecidos, diferenciais), comercial e condições (parcelamento, formas de pagamento, convênios com tratamentos cobertos por convênio), público-alvo (classe econômica, faixa etária, principais dores), e valores de consulta por procedimento. Estrutura de dado exata (campos livres vs. tags fixas) é uma decisão de implementação a alinhar com o Claude Code na hora de codar — aqui só especifico o conteúdo que precisa existir.

---

## 5. Regras de negócio centrais

### 5.1 Ligação é sempre ação humana — sequência completa de escalonamento

A Helô nunca inicia ou realiza uma ligação sozinha. O botão "Ligar" existe para o CRC, e o contato por voz/áudio segue esta linha do tempo obrigatória, contada a partir do momento em que o lead chega:

**T+0 (imediato):** assim que o lead chega, o CRC faz **5 tentativas de ligação em sequência imediata** — primeiro **3x pelo discador tradicional**, depois, se nenhuma foi atendida, **2x por chamada de WhatsApp**. Não são tentativas espaçadas ao longo do dia — é uma rajada imediata na chegada do lead.

**Se nenhuma das 5 for atendida:** o atendimento passa a acontecer **por mensagem**, majoritariamente em áudio (notas de voz), podendo mesclar mensagens curtas de texto quando fizer sentido. **E a etapa do lead muda** — exemplo dado por você: de `Leads Recebidos` para `Em Contato`.

**T+8h (contadas a partir da primeira tentativa de ligação):** se o lead não respondeu nada até ali, **ou** respondeu e depois parou de responder, o CRC faz **mais 1 tentativa de ligação — só por WhatsApp** (não repete o discador). Essa é uma tentativa de recuperação: reconquistar a atenção do lead e tentar converter o agendamento antes dele cair nas etapas de Follow-Up (F1 em diante).

**Se a 6ª tentativa também não for atendida:** é disparada uma **mensagem automática** de retomada, texto fixo confirmado por você:

> *"Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔"*

Só então o lead segue pras etapas de Follow-Up (F1 em diante). **Confirmado:** é enviada automaticamente pela própria Helô, como mensagem de sistema — mesmo padrão de `agente: "Automática"` já usado em `historicoEtapas.ts`. Importante: a Helô **não se apresenta** nem se identifica ao mandar essa mensagem — é só o texto puro, sem "Oi, aqui é a Helô" ou qualquer framing de apresentação.

Total possível: **até 6 tentativas de ligação por lead** (5 imediatas na chegada + 1 de recuperação 8h depois), com uma janela de atendimento por mensagem entre a 5ª e a 6ª, e essa mensagem automática de fechamento caso nada funcione.

### 5.1.0.1 Os três desfechos possíveis quando uma ligação É atendida (dentro das 5 tentativas iniciais)

Isso substitui minha suposição anterior (que qualquer ligação atendida movia o lead direto pra `Em Contato`) — a regra real é mais específica, com três caminhos:

- **Atendeu e o CRC converteu o agendamento** (data, horário, especialidade e especialista definidos) → etapa vira **`Agendamento`**.
- **Atendeu, mas o CRC não conseguiu converter** (conversa aconteceu, agendamento não fechou ali) → etapa vira **`Em Contato`**.
- **Atendeu, mas o lead se desqualifica na própria ligação** → etapa vira **`Venda Perdida`** — **confirmado:** é o mesmo destino já documentado, reaproveitando exatamente os motivos existentes: `Clicou errado` (clicou por engano), `Não atende o procedimento` (especialidade que procura não é oferecida), `Localização distante` (mora longe demais sem chance real de comparecer). Não é uma etapa nova — é o caminho já existente, só chegando por essa via específica (desqualificação já na primeira ligação).

**Lembrete importante (não é bug, é consequência de uma decisão já tomada):** por decisão sua na fase de qualificação, `Localização distante` **não** desqualifica retroativamente — `leads.ts` só marca como desqualificantes `Clicou errado`, `Não atende o procedimento` e `Spam`. Então um lead perdido por `Localização distante` nessa ligação continua contando como qualificado no denominador. Nada quebra, mas se essa via virar comum, a taxa de agendamento sobre qualificados vai cair sem a operação ter piorado de verdade — vale lembrar disso ao interpretar aquele número no futuro.

### 5.1.1 Conexão com a Fila de Atendimento v1 (métricas) — decisão fechada

**Achado do Claude Code, o mais sério da descoberta:** se "primeiro contato" continuasse definido como "entrada na etapa `Em Contato`" (definição antiga, herdada da Fila de Atendimento v1), a regra 5.1.0.1 quebraria a métrica em silêncio. Pelo fluxo definido aqui, quem **atende** a ligação vai direto pra `Agendamento` ou `Venda Perdida` — nunca passa por `Em Contato`. Só chega em `Em Contato` quem **não atendeu nenhuma das 5 tentativas**. Ou seja: exatamente os leads bem atendidos sairiam da conta, e a métrica passaria a medir, na prática, "tempo até a operação desistir do telefone" — com o mesmo nome e o mesmo lugar na tela, mas medindo o oposto do que promete.

**Decisão tomada:** "primeiro contato" passa a ser definido como **a primeira tentativa de ligação** (o registro criado pela seção 4, "Histórico de ligações"), não mais a entrada em `Em Contato`. Isso é fiel à promessa real da operação ("ligar em até 5 minutos") e funciona pra todo lead, independente de como a ligação se resolve.

**Implicação prática:** a Fila de Atendimento v1 precisa ser revisitada com essa definição quando essa área for construída — isso já está previsto como Fase 6 do plano de implementação (seção 8).

### 5.1.2 O que fica de fora desta regra
O que define "atendeu" ou "não atendeu" tecnicamente (detecção de chamada atendida via discador ou via WhatsApp) é parte da integração real de telefonia — fora de escopo deste documento (seção 6). Aqui só especificamos a regra de negócio: quantas tentativas, em qual ordem, com que espaçamento, e o que muda quando esgotam.

### 5.2 Fonte única para agendamento
Um agendamento criado a partir do chat é o mesmo tipo de registro usado no resto do sistema — grava em `agendamentos.ts`, sem exceção. Mesma lógica de "fonte única de verdade" já aplicada a todo o resto da Helô.

### 5.3 Campos obrigatórios do agendamento via chat
Procedimento, especialista, data e horário são obrigatórios (mesma lógica de campos obrigatórios já usada em outros pontos do sistema, como valor da venda em Venda Ganha ou motivo em Venda Perdida). Observação é opcional.

**Ajuste técnico do Claude Code, importante:** essa obrigatoriedade não pode virar parte do tipo `Agendamento` (ex.: `hora: string` sem permitir vazio) — hoje 698 dos 705 agendamentos existentes têm `hora` nulo, e isso quebraria todos eles. A obrigatoriedade mora na **validação do formulário do chat**, não no tipo — mesmo padrão já usado com `valorVenda` (obrigatório em Venda Ganha, opcional no tipo).

**Efeito colateral esperado, sem ser bug:** hoje só 7 dos 705 agendamentos têm `hora` preenchida — "sem horário" é a regra, a grade é exceção. Depois que essa tela existir, isso se inverte: todo agendamento novo feito pelo chat vai ter hora. A Agenda vai parecer "vazia" no passado e "cheia" no presente — é o comportamento esperado, não uma inconsistência a corrigir.

---

## 6. O que fica de fora deste documento (fronteira)

- Integração real com qualquer provedor de telefonia (equivalente ao Api4Com) — trabalho técnico da sua parceira.
- Integração real com a API de chamada de voz do WhatsApp Business — idem.
- Qualquer lógica de "o que a Helô responde" dentro do chat — isso é a camada de inteligência/IA, já existente conceitualmente segundo você, mas fora do que documentamos aqui.

---

## 7. Estado das pendências

Todas as perguntas em aberto das rodadas anteriores foram resolvidas e confirmadas por você — seções 2, 3.2, 4, 5.1, 5.1.0.1, 5.1.1 (definição de primeiro contato) e a mensagem automática de retomada. A única pendência real que resta é de produto, não de regra: o vínculo entre profissionais/especialidades e clínica (seção 3.2, item 3) — não bloqueia o início da implementação, só precisa estar decidido até a Fase 3.

---

## 8. Plano de implementação (proposto pelo Claude Code, aprovado)

Seis fases, cada uma destravando a seguinte. As três primeiras são só dado — nenhuma tela muda, e cada uma termina com checagem cruzada passando (mesmo padrão de verificação usado em todas as fases anteriores do projeto).

1. **Modelo de mensagens** — cria `mensagens.ts` bidirecional, migra os 135 eventos existentes de `Tarefa.historico`, remove esse campo, adapta `TabelaTarefas`. Termina com a fila mostrando exatamente a mesma conversa de hoje, só lendo de outro lugar — prova a migração sem nenhuma tela nova envolvida.
2. **Ligações e notas internas** — estrutura dos dois (lista de notas rastreável, ver seção 3.2), mais geração de histórico plausível pros leads da fila, no mesmo método já usado em `historicoEtapas.ts`.
3. **Enriquecimento de `clinicas.ts`** — os quatro blocos da seção 4, mais a decisão de vincular profissionais/especialidades à clínica (pendência da seção 7).
4. **A tela, sem a régua** — três colunas e quatro abas (seção 3.2), lendo tudo que as fases 1–3 criaram. Agendar consulta reaproveita `definirConsulta` já existente. Fase mais visível, menor risco — nada de novo é inventado, só exibido.
5. **Motor das 6 tentativas** — a régua de escalonamento (seção 5.1), a mudança automática de etapa (5.1.0.1) e a mensagem de retomada. Só entra depois da definição de "primeiro contato" estar fechada (já está, seção 5.1.1) — o motor é o que produz o dado que a métrica lê.
6. **Revisitar a Fila de Atendimento v1** — ajustar a métrica de "primeiro contato"/"tempo de resposta" à nova definição, com checagem cruzada completa entre as duas telas.
