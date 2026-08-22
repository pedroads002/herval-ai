import { type TipoAgente } from "@/data/historicoEtapas";

/**
 * A conversa com o lead. Até aqui a base guardava só o que a IA mandou, num
 * campo dentro da tarefa — o lead nunca aparecia, e quem não estava na fila
 * não tinha conversa nenhuma. Isso serve para um log, não para uma tela de
 * atendimento, onde o CRC precisa ler os dois lados.
 *
 * Por isso a mensagem virou entidade própria, ligada ao lead pelo id, no mesmo
 * molde de `agendamentos.ts`: um lead pode ter muitas, e quem quiser a conversa
 * pergunta por lead em vez de carregar junto com a operação da fila.
 */

/**
 * Quem falou. São os mesmos tipos de agente de `historicoEtapas.ts` mais o
 * próprio lead — a única voz da conversa que nunca é do nosso lado.
 *
 * "IA" é a Helô conversando, "Automática" é mensagem disparada por regra (a de
 * retomada, por exemplo) e "Humano" é o CRC assumindo a conversa na mão.
 */
export type TipoRemetente = "Lead" | TipoAgente;

export const tiposDeRemetente: TipoRemetente[] = [
  "Lead",
  "IA",
  "Automática",
  "Humano",
];

export type Remetente = {
  tipo: TipoRemetente;
  /** Nome de quem escreveu. Só em mensagem humana, vinda do usuário logado. */
  nome?: string;
};

/**
 * Texto ou áudio. O formato importa porque a régua de atendimento pede que a
 * conversa seja majoritariamente em nota de voz depois que as ligações falham
 * — sem este campo não há como conferir se foi isso que aconteceu.
 */
export type FormatoMensagem = "texto" | "audio";

/**
 * Confirmação vinda do WhatsApp. Nasce vazia de propósito: sem a integração
 * real não existe quem preencha, e inventar "lida" seria dado falso numa tela
 * em que o CRC decide o que fazer justamente por ver se o lead leu.
 */
export type StatusEntrega = "enviada" | "entregue" | "lida";

export type Mensagem = {
  id: number;
  leadId: number;
  remetente: Remetente;
  formato: FormatoMensagem;
  /** Há quantos minutos, na convenção de `lib/tempo.ts`. Nunca data fixa. */
  minutosAtras: number;
  texto: string;
  /** Regra da automação que disparou a mensagem. Vazia no que o lead escreve. */
  regra?: string;
  status?: StatusEntrega;
};

/**
 * Formato compacto, como no resto da base: uma linha por mensagem, com
 *
 *   [leadId, remetente, formato, minutosAtras, texto, regra]
 *
 * O remetente vem pela posição em `tiposDeRemetente` e o formato é 0 para
 * texto e 1 para áudio. O `id` é a ordem de leitura, e por isso não é gravado.
 * `regra` vazia vira campo ausente.
 *
 * As linhas estão em ordem de leitura da conversa: por lead, da mais antiga
 * para a mais recente (`minutosAtras` decrescente).
 *
 * Dados de exemplo. Ainda não vêm de banco nem de API.
 */
type LinhaMensagem = [number, number, number, number, string, string];

const registros: LinhaMensagem[] = [
  [1, 1, 0, 2753, "Oi Mariana, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?", "Lead novo do site"],
  [1, 0, 0, 2713, "Pode explicar sim, por favor.", ""],
  [1, 1, 0, 1599, "Enviei o orçamento completo. O valor inclui o acompanhamento de 90 dias.", "Solicitação de valores"],
  [1, 0, 0, 1559, "Vi aqui. Vou pensar e te falo.", ""],
  [1, 1, 0, 1206, "Mariana, consigo encaixar você esta semana. Prefere manhã ou tarde?", "Pedido de horário"],
  [1, 0, 0, 1194, "Manhã fica melhor pra mim.", ""],
  [2, 1, 0, 2752, "Carlos, sua avaliação ficou marcada. Confirma para mim?", "Agendamento criado"],
  [2, 0, 0, 2572, "Está certo, vou sim.", ""],
  [2, 1, 0, 2359, "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.", "Lembrete automático 24h"],
  [2, 0, 0, 2269, "Ok, até amanhã.", ""],
  [3, 1, 0, 7103, "Olá Juliana! Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Retomada de conversa"],
  [3, 2, 0, 6698, "Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔", "Tentativas de ligação esgotadas"],
  [3, 1, 0, 6108, "Juliana, separei alguns resultados de pacientes com perfil parecido com o seu.", "Follow-up D+2"],
  [4, 1, 0, 2737, "Oi Rafael, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?", "Lead novo do site"],
  [4, 0, 0, 2725, "Oi, tudo bem? Tenho interesse sim. Qual o valor da avaliação?", ""],
  [5, 1, 0, 2801, "Ana, sua avaliação ficou marcada. Confirma para mim?", "Agendamento criado"],
  [5, 0, 0, 2797, "Confirmo. Preciso levar algum exame?", ""],
  [5, 1, 0, 1636, "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.", "Lembrete automático 24h"],
  [5, 0, 0, 1629, "Combinado, estarei aí.", ""],
  [6, 1, 0, 1291, "Oi Diego, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?", "Lead novo do site"],
  [6, 0, 0, 1287, "Pode explicar sim, por favor.", ""],
  [6, 1, 0, 898, "Enviei o orçamento completo. O valor inclui o acompanhamento de 90 dias.", "Solicitação de valores"],
  [6, 0, 0, 873, "Vi aqui. Vou pensar e te falo.", ""],
  [6, 1, 0, 0, "Diego, consigo encaixar você esta semana. Prefere manhã ou tarde?", "Pedido de horário"],
  [8, 1, 0, 201, "Oi Fernando, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?", "Lead novo do site"],
  [8, 0, 0, 176, "Oi, tudo bem? Tenho interesse sim. Qual o valor da avaliação?", ""],
  [9, 1, 0, 1306, "Oi Camila, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?", "Lead novo do site"],
  [9, 0, 0, 1299, "Oi! Pode sim, queria entender como funciona.", ""],
  [9, 1, 0, 0, "Enviei o orçamento completo. O valor inclui o acompanhamento de 90 dias.", "Solicitação de valores"],
  [9, 1, 0, 0, "Camila, consigo encaixar você esta semana. Prefere manhã ou tarde?", "Pedido de horário"],
  [10, 1, 0, 38616, "Olá Lucas! Nosso atendimento é presencial em Porto Alegre. Você consegue vir até uma das unidades?", "Verificação de localização"],
  [10, 0, 0, 38576, "Moro em outra cidade, ia ser difícil.", ""],
  [11, 1, 0, 0, "Oi Renata, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?", "Lead novo do site"],
  [12, 1, 0, 1373, "Oi Bruno, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?", "Lead novo do site"],
  [12, 0, 0, 1348, "Oi, tudo bem? Tenho interesse sim. Qual o valor da avaliação?", ""],
  [13, 1, 0, 4292, "Letícia, sua avaliação ficou marcada. Confirma para mim?", "Agendamento criado"],
  [13, 0, 0, 4202, "Está certo, vou sim.", ""],
  [13, 1, 0, 3297, "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.", "Lembrete automático 24h"],
  [13, 0, 0, 3293, "Ok, até amanhã.", ""],
  [14, 1, 0, 8467, "Gustavo, sua avaliação ficou marcada. Confirma para mim?", "Agendamento criado"],
  [14, 0, 0, 8455, "Está certo, vou sim.", ""],
  [14, 1, 0, 8062, "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.", "Lembrete automático 24h"],
  [14, 0, 0, 8050, "Obrigada pelo lembrete!", ""],
  [15, 1, 0, 8461, "Olá Aline! Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Retomada de conversa"],
  [15, 2, 0, 8152, "Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔", "Tentativas de ligação esgotadas"],
  [16, 1, 0, 11443, "Marcelo, sua avaliação ficou marcada. Confirma para mim?", "Agendamento criado"],
  [16, 0, 0, 11431, "Está certo, vou sim.", ""],
  [16, 1, 0, 11050, "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.", "Lembrete automático 24h"],
  [16, 0, 0, 11038, "Ok, até amanhã.", ""],
  [17, 1, 0, 7569, "Olá Vanessa! Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Retomada de conversa"],
  [17, 0, 0, 7565, "Oi! Desculpa a demora, ficou corrido aqui.", ""],
  [17, 2, 0, 7203, "Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔", "Tentativas de ligação esgotadas"],
  [17, 1, 0, 6633, "Vanessa, separei alguns resultados de pacientes com perfil parecido com o seu.", "Follow-up D+2"],
  [17, 0, 0, 6593, "Estou analisando ainda, te falo essa semana.", ""],
  [17, 1, 0, 6441, "Ainda dá tempo de garantir o horário desta semana, Vanessa. Quer que eu reserve?", "Follow-up D+3"],
  [18, 1, 0, 7071, "Olá Rodrigo! Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Retomada de conversa"],
  [18, 2, 0, 6714, "Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔", "Tentativas de ligação esgotadas"],
  [18, 1, 0, 0, "Rodrigo, separei alguns resultados de pacientes com perfil parecido com o seu.", "Follow-up D+2"],
  [18, 1, 0, 0, "Ainda dá tempo de garantir o horário desta semana, Rodrigo. Quer que eu reserve?", "Follow-up D+3"],
  [19, 1, 0, 7038, "Olá Priscila! Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Retomada de conversa"],
  [19, 2, 0, 6643, "Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔", "Tentativas de ligação esgotadas"],
  [20, 1, 0, 4246, "Oi Thiago, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?", "Lead novo do site"],
  [20, 0, 0, 3926, "Pode explicar sim, por favor.", ""],
  [21, 1, 0, 11606, "Olá Débora! Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Retomada de conversa"],
  [21, 2, 0, 11142, "Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔", "Tentativas de ligação esgotadas"],
  [22, 1, 0, 17168, "Eduardo, sua avaliação ficou marcada. Confirma para mim?", "Agendamento criado"],
  [22, 0, 0, 17164, "Confirmado! Obrigada.", ""],
  [22, 1, 0, 16775, "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.", "Lembrete automático 24h"],
  [22, 0, 0, 16771, "Obrigada pelo lembrete!", ""],
  [23, 1, 0, 11383, "Olá Sabrina! Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Retomada de conversa"],
  [23, 0, 0, 11379, "Oi, continuo interessada sim.", ""],
  [23, 2, 0, 11037, "Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔", "Tentativas de ligação esgotadas"],
  [23, 1, 0, 10388, "Sabrina, separei alguns resultados de pacientes com perfil parecido com o seu.", "Follow-up D+2"],
  [23, 0, 0, 10348, "Vi sim, gostei bastante dos resultados.", ""],
  [23, 1, 0, 9983, "Ainda dá tempo de garantir o horário desta semana, Sabrina. Quer que eu reserve?", "Follow-up D+3"],
  [24, 1, 0, 11357, "Olá Henrique! Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Retomada de conversa"],
  [24, 0, 0, 11037, "Oi, continuo interessada sim.", ""],
  [24, 2, 0, 10983, "Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔", "Tentativas de ligação esgotadas"],
  [24, 1, 0, 10952, "Henrique, separei alguns resultados de pacientes com perfil parecido com o seu.", "Follow-up D+2"],
  [24, 0, 0, 10945, "Estou analisando ainda, te falo essa semana.", ""],
  [24, 1, 0, 9787, "Ainda dá tempo de garantir o horário desta semana, Henrique. Quer que eu reserve?", "Follow-up D+3"],
  [25, 1, 0, 40247, "Olá Natália! Nosso atendimento é presencial em Porto Alegre. Você consegue vir até uma das unidades?", "Verificação de localização"],
  [25, 0, 0, 40207, "Consigo, mas só em horário de almoço ou depois das 18h.", ""],
  [26, 1, 0, 8590, "Olá Felipe! Nosso atendimento é presencial em Porto Alegre. Você consegue vir até uma das unidades?", "Verificação de localização"],
  [26, 0, 0, 8550, "Moro em outra cidade, ia ser difícil.", ""],
  [27, 1, 0, 4292, "Oi Larissa, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?", "Lead novo do site"],
  [27, 0, 0, 4252, "Oi, tudo bem? Tenho interesse sim. Qual o valor da avaliação?", ""],
  [27, 2, 0, 3828, "Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔", "Tentativas de ligação esgotadas"],
  [27, 1, 0, 3356, "Enviei o orçamento completo. O valor inclui o acompanhamento de 90 dias.", "Solicitação de valores"],
  [28, 1, 0, 48726, "Olá André! Nosso atendimento é presencial em Porto Alegre. Você consegue vir até uma das unidades?", "Verificação de localização"],
  [28, 0, 0, 48686, "Consigo, mas só em horário de almoço ou depois das 18h.", ""],
  [29, 1, 0, 2750, "Oi Bianca, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?", "Lead novo do site"],
  [29, 0, 0, 2743, "Pode explicar sim, por favor.", ""],
  [29, 2, 0, 2389, "Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔", "Tentativas de ligação esgotadas"],
  [29, 1, 0, 1049, "Enviei o orçamento completo. O valor inclui o acompanhamento de 90 dias.", "Solicitação de valores"],
  [29, 1, 0, 0, "Bianca, consigo encaixar você esta semana. Prefere manhã ou tarde?", "Pedido de horário"],
  [30, 1, 0, 20014, "Olá Otávio! Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Retomada de conversa"],
  [30, 2, 0, 19670, "Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔", "Tentativas de ligação esgotadas"],
  [32, 1, 0, 13858, "Olá Vinícius! Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Retomada de conversa"],
  [32, 2, 0, 13555, "Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔", "Tentativas de ligação esgotadas"],
  [32, 1, 0, 13465, "Vinícius, separei alguns resultados de pacientes com perfil parecido com o seu.", "Follow-up D+2"],
  [33, 1, 0, 18542, "Manuela, sua avaliação ficou marcada. Confirma para mim?", "Agendamento criado"],
  [33, 0, 0, 18535, "Confirmo. Preciso levar algum exame?", ""],
  [33, 1, 0, 17547, "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.", "Lembrete automático 24h"],
  [33, 0, 0, 17522, "Combinado, estarei aí.", ""],
  [34, 1, 0, 1305, "Oi Leandro, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?", "Lead novo do site"],
  [34, 2, 0, 926, "Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔", "Tentativas de ligação esgotadas"],
  [35, 1, 0, 4212, "Olá Tatiane! Nosso atendimento é presencial em Porto Alegre. Você consegue vir até uma das unidades?", "Verificação de localização"],
  [35, 0, 0, 4187, "Consigo sim, trabalho perto do centro.", ""],
  [36, 1, 0, 24100, "Olá Ricardo! Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Retomada de conversa"],
  [36, 0, 0, 24060, "Oi! Desculpa a demora, ficou corrido aqui.", ""],
  [36, 1, 0, 23707, "Ricardo, separei alguns resultados de pacientes com perfil parecido com o seu.", "Follow-up D+2"],
  [37, 1, 0, 21431, "Olá Isabela! Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Retomada de conversa"],
  [37, 0, 0, 21251, "Oi! Desculpa a demora, ficou corrido aqui.", ""],
  [37, 1, 0, 20495, "Isabela, separei alguns resultados de pacientes com perfil parecido com o seu.", "Follow-up D+2"],
  [37, 0, 0, 20315, "Vi sim, gostei bastante dos resultados.", ""],
  [37, 1, 0, 20303, "Ainda dá tempo de garantir o horário desta semana, Isabela. Quer que eu reserve?", "Follow-up D+3"],
  [40, 1, 0, 5720, "Oi Paulo, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?", "Lead novo do site"],
  [40, 0, 0, 5708, "Oi, tudo bem? Tenho interesse sim. Qual o valor da avaliação?", ""],
  [40, 2, 0, 5268, "Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔", "Tentativas de ligação esgotadas"],
  [40, 1, 0, 4019, "Enviei o orçamento completo. O valor inclui o acompanhamento de 90 dias.", "Solicitação de valores"],
  [40, 0, 0, 3979, "Vi aqui. Vou pensar e te falo.", ""],
  [40, 1, 0, 2865, "Paulo, consigo encaixar você esta semana. Prefere manhã ou tarde?", "Pedido de horário"],
  [41, 1, 0, 48711, "Olá Simone! Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Retomada de conversa"],
  [41, 0, 0, 48621, "Oi, continuo interessada sim.", ""],
  [41, 1, 0, 47557, "Simone, separei alguns resultados de pacientes com perfil parecido com o seu.", "Follow-up D+2"],
  [41, 0, 0, 47517, "Estou analisando ainda, te falo essa semana.", ""],
  [41, 1, 0, 47164, "Ainda dá tempo de garantir o horário desta semana, Simone. Quer que eu reserve?", "Follow-up D+3"],
  [42, 1, 0, 27178, "Olá Alexandre! Nosso atendimento é presencial em Porto Alegre. Você consegue vir até uma das unidades?", "Verificação de localização"],
  [42, 0, 0, 27138, "Moro em outra cidade, ia ser difícil.", ""],
  [43, 1, 0, 12832, "Fernanda, sua avaliação ficou marcada. Confirma para mim?", "Agendamento criado"],
  [43, 0, 0, 12792, "Confirmo. Preciso levar algum exame?", ""],
  [43, 1, 0, 11837, "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.", "Lembrete automático 24h"],
  [43, 0, 0, 11657, "Ok, até amanhã.", ""],
  [44, 1, 0, 48768, "Olá Douglas! Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Retomada de conversa"],
  [44, 1, 0, 48363, "Douglas, separei alguns resultados de pacientes com perfil parecido com o seu.", "Follow-up D+2"],
  [44, 1, 0, 47198, "Ainda dá tempo de garantir o horário desta semana, Douglas. Quer que eu reserve?", "Follow-up D+3"],
  [45, 1, 0, 5594, "Oi Elisa, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?", "Lead novo do site"],
  [45, 0, 0, 5274, "Pode explicar sim, por favor.", ""],
  [45, 2, 0, 5268, "Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔", "Tentativas de ligação esgotadas"],
  [45, 1, 0, 4429, "Enviei o orçamento completo. O valor inclui o acompanhamento de 90 dias.", "Solicitação de valores"],
  [45, 0, 0, 4339, "Recebi. Vocês parcelam em quantas vezes?", ""],
  [45, 1, 0, 4036, "Elisa, consigo encaixar você esta semana. Prefere manhã ou tarde?", "Pedido de horário"],
  [46, 1, 0, 24313, "Olá Rogério! Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Retomada de conversa"],
  [46, 1, 0, 23920, "Rogério, separei alguns resultados de pacientes com perfil parecido com o seu.", "Follow-up D+2"],
  [49, 1, 0, 11383, "Michele, sua avaliação ficou marcada. Confirma para mim?", "Agendamento criado"],
  [49, 0, 0, 11371, "Está certo, vou sim.", ""],
  [49, 1, 0, 4049, "Lembrete: sua consulta é amanhã. Chegue com 10 minutos de antecedência.", "Lembrete automático 24h"],
  [49, 0, 0, 3869, "Obrigada pelo lembrete!", ""],
  [50, 1, 0, 48791, "Olá Fábio! Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Retomada de conversa"],
  [50, 0, 0, 48611, "Oi, continuo interessada sim.", ""],
  [50, 1, 0, 47090, "Fábio, separei alguns resultados de pacientes com perfil parecido com o seu.", "Follow-up D+2"],
  [50, 0, 0, 46910, "Vi sim, gostei bastante dos resultados.", ""],
  [50, 1, 0, 45936, "Ainda dá tempo de garantir o horário desta semana, Fábio. Quer que eu reserve?", "Follow-up D+3"],
  [51, 1, 0, 4115, "Oi Rafaela, tudo bem? Vi seu interesse no procedimento. Posso te explicar como funciona a avaliação?", "Lead novo do site"],
  [51, 0, 0, 4103, "Oi! Pode sim, queria entender como funciona.", ""],
  [51, 2, 0, 3795, "Tentei entrar em contato com você anteriormente, mas não tive sucesso... 😔", "Tentativas de ligação esgotadas"],
  [51, 1, 0, 2961, "Enviei o orçamento completo. O valor inclui o acompanhamento de 90 dias.", "Solicitação de valores"],
  [51, 0, 0, 2921, "Recebi. Vocês parcelam em quantas vezes?", ""],
  [51, 1, 0, 2568, "Rafaela, consigo encaixar você esta semana. Prefere manhã ou tarde?", "Pedido de horário"],
  [52, 1, 0, 55081, "Olá Júlio! Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Retomada de conversa"],
  [52, 0, 0, 55069, "Oi, continuo interessada sim.", ""],
  [52, 1, 0, 54688, "Júlio, separei alguns resultados de pacientes com perfil parecido com o seu.", "Follow-up D+2"],
  [53, 1, 0, 47491, "Oi Aline! Confirmei sua avaliação de harmonização facial.", "Agendamento criado"],
  [53, 0, 0, 47484, "Está certo, vou sim.", ""],
  [53, 1, 0, 43069, "Que bom que deu tudo certo! O acompanhamento de 90 dias já está ativo.", "Pós-procedimento"],
  [53, 0, 0, 42979, "Obrigada pelo cuidado de vocês.", ""],
  [54, 1, 0, 38830, "Oi Débora! Confirmei sua avaliação de preenchimento labial.", "Agendamento criado"],
  [54, 0, 0, 38790, "Confirmado! Obrigada.", ""],
  [54, 1, 0, 27303, "Que bom que deu tudo certo! O acompanhamento de 90 dias já está ativo.", "Pós-procedimento"],
  [54, 0, 0, 27299, "Ficou ótimo, já indiquei para uma amiga.", ""],
  [55, 1, 0, 43177, "Oi Felipe! Confirmei sua avaliação de toxina botulínica.", "Agendamento criado"],
  [55, 0, 0, 43173, "Confirmo. Preciso levar algum exame?", ""],
  [55, 1, 0, 35841, "Que bom que deu tudo certo! O acompanhamento de 90 dias já está ativo.", "Pós-procedimento"],
  [55, 0, 0, 35816, "Obrigada pelo cuidado de vocês.", ""],
  [56, 1, 0, 14242, "Oi Tatiane! Confirmei sua avaliação de bioestimulador de colágeno.", "Agendamento criado"],
  [56, 0, 0, 14062, "Está certo, vou sim.", ""],
  [56, 1, 0, 7121, "Que bom que deu tudo certo! O acompanhamento de 90 dias já está ativo.", "Pós-procedimento"],
  [56, 0, 0, 7117, "Amei o resultado! Muito obrigada.", ""],
  [57, 1, 0, 30214, "Oi Rodrigo! Confirmei sua avaliação de limpeza de pele.", "Agendamento criado"],
  [57, 0, 0, 30034, "Confirmo. Preciso levar algum exame?", ""],
  [57, 1, 0, 26946, "Que bom que deu tudo certo! O acompanhamento de 90 dias já está ativo.", "Pós-procedimento"],
  [57, 0, 0, 26934, "Amei o resultado! Muito obrigada.", ""],
  [58, 1, 0, 17102, "Oi Priscila! Confirmei sua avaliação de harmonização facial.", "Agendamento criado"],
  [58, 0, 0, 17012, "Confirmo. Preciso levar algum exame?", ""],
  [58, 1, 0, 5611, "Que bom que deu tudo certo! O acompanhamento de 90 dias já está ativo.", "Pós-procedimento"],
  [58, 0, 0, 5604, "Ficou ótimo, já indiquei para uma amiga.", ""],
  [59, 1, 0, 46035, "Oi Márcio! Confirmei sua avaliação de preenchimento labial.", "Agendamento criado"],
  [59, 0, 0, 46031, "Confirmo. Preciso levar algum exame?", ""],
  [59, 1, 0, 33098, "Que bom que deu tudo certo! O acompanhamento de 90 dias já está ativo.", "Pós-procedimento"],
  [59, 0, 0, 32918, "Obrigada pelo cuidado de vocês.", ""],
  [60, 1, 0, 31534, "Oi Simone! Confirmei sua avaliação de toxina botulínica.", "Agendamento criado"],
  [60, 0, 0, 31522, "Confirmo. Preciso levar algum exame?", ""],
  [60, 1, 0, 22977, "Que bom que deu tudo certo! O acompanhamento de 90 dias já está ativo.", "Pós-procedimento"],
  [60, 0, 0, 22970, "Ficou ótimo, já indiquei para uma amiga.", ""],
  [61, 1, 0, 31624, "Oi Cristina, tudo bem? Vi seu interesse em bioestimulador de colágeno. Posso te explicar?", "Lead novo do Meta Ads"],
  [61, 0, 0, 31534, "Oi! Pode me explicar sim, vi o anúncio de vocês.", ""],
  [61, 1, 0, 28429, "Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Follow-up D+2"],
  [62, 1, 0, 23974, "Oi Anderson, tudo bem? Vi seu interesse em limpeza de pele. Posso te explicar?", "Lead novo do Meta Ads"],
  [62, 0, 0, 23884, "Oi! Pode me explicar sim, vi o anúncio de vocês.", ""],
  [62, 1, 0, 20779, "Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Follow-up D+2"],
  [63, 1, 0, 18602, "Oi Elaine, tudo bem? Vi seu interesse em harmonização facial. Posso te explicar?", "Lead novo do Meta Ads"],
  [63, 0, 0, 18590, "Tudo bem? Queria saber quanto fica e quantas sessões precisa.", ""],
  [63, 1, 0, 15407, "Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Follow-up D+2"],
  [64, 1, 0, 2721, "Oi Gustavo, tudo bem? Vi seu interesse em preenchimento labial. Posso te explicar?", "Lead novo do Meta Ads"],
  [64, 0, 0, 2696, "Pode sim. Faz muito tempo que eu penso nisso.", ""],
  [64, 1, 0, 0, "Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Follow-up D+2"],
  [65, 1, 0, 38724, "Oi Larissa, tudo bem? Vi seu interesse em toxina botulínica. Posso te explicar?", "Lead novo do Meta Ads"],
  [65, 0, 0, 38720, "Oi! Pode me explicar sim, vi o anúncio de vocês.", ""],
  [65, 1, 0, 35529, "Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Follow-up D+2"],
  [66, 1, 0, 22987, "Oi Otávio, tudo bem? Vi seu interesse em bioestimulador de colágeno. Posso te explicar?", "Lead novo do Meta Ads"],
  [66, 0, 0, 22962, "Tudo bem? Queria saber quanto fica e quantas sessões precisa.", ""],
  [66, 1, 0, 19792, "Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Follow-up D+2"],
  [67, 1, 0, 51787, "Oi Michele, tudo bem? Vi seu interesse em limpeza de pele. Posso te explicar?", "Lead novo do Meta Ads"],
  [67, 0, 0, 51607, "Oi! Pode me explicar sim, vi o anúncio de vocês.", ""],
  [67, 1, 0, 48592, "Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Follow-up D+2"],
  [68, 1, 0, 1364, "Oi Paulo, tudo bem? Vi seu interesse em harmonização facial. Posso te explicar?", "Lead novo do Meta Ads"],
  [68, 0, 0, 1274, "Pode sim. Faz muito tempo que eu penso nisso.", ""],
  [68, 1, 0, 0, "Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Follow-up D+2"],
  [69, 1, 0, 27306, "Oi Renata, tudo bem? Vi seu interesse em preenchimento labial. Posso te explicar?", "Lead novo do Meta Ads"],
  [69, 0, 0, 27126, "Pode sim. Faz muito tempo que eu penso nisso.", ""],
  [69, 1, 0, 24111, "Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Follow-up D+2"],
  [70, 1, 0, 9978, "Oi Diego, tudo bem? Vi seu interesse em toxina botulínica. Posso te explicar?", "Lead novo do Meta Ads"],
  [70, 0, 0, 9888, "Tudo bem? Queria saber quanto fica e quantas sessões precisa.", ""],
  [70, 1, 0, 6783, "Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Follow-up D+2"],
  [71, 1, 0, 25439, "Oi Fabiana, tudo bem? Vi seu interesse em bioestimulador de colágeno. Posso te explicar?", "Lead novo do Meta Ads"],
  [71, 0, 0, 25119, "Tudo bem? Queria saber quanto fica e quantas sessões precisa.", ""],
  [71, 1, 0, 22244, "Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Follow-up D+2"],
  [72, 1, 0, 44039, "Oi Sérgio, tudo bem? Vi seu interesse em limpeza de pele. Posso te explicar?", "Lead novo do Meta Ads"],
  [72, 0, 0, 43949, "Pode sim. Faz muito tempo que eu penso nisso.", ""],
  [72, 1, 0, 40844, "Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Follow-up D+2"],
  [73, 1, 0, 51512, "Oi Karine, tudo bem? Vi seu interesse em harmonização facial. Posso te explicar?", "Lead novo do Meta Ads"],
  [73, 0, 0, 51508, "Oi! Pode me explicar sim, vi o anúncio de vocês.", ""],
  [73, 1, 0, 48317, "Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Follow-up D+2"],
  [74, 1, 0, 27315, "Oi Thiago, tudo bem? Vi seu interesse em preenchimento labial. Posso te explicar?", "Lead novo do Meta Ads"],
  [74, 0, 0, 27275, "Tudo bem? Queria saber quanto fica e quantas sessões precisa.", ""],
  [74, 1, 0, 24120, "Passando para saber se ficou alguma dúvida sobre o que conversamos.", "Follow-up D+2"],
];

export const mensagensIniciais: Mensagem[] = registros.map(
  ([leadId, remetente, formato, minutosAtras, texto, regra], indice) => ({
    id: indice + 1,
    leadId,
    remetente: { tipo: tiposDeRemetente[remetente] },
    formato: formato === 1 ? "audio" : "texto",
    minutosAtras,
    texto,
    ...(regra ? { regra } : {}),
  }),
);

/** Mensagem do lead é a que chega; todo o resto é a clínica falando. */
export function ehDoLead(mensagem: Mensagem) {
  return mensagem.remetente.tipo === "Lead";
}

/**
 * Agrupa a conversa por lead uma vez só. A tela abre um lead de cada vez, e
 * varrer as mensagens inteiras a cada abertura é o tipo de detalhe que só
 * incomoda quando a base cresce — o mesmo motivo de `indexarPorLead` existir
 * em `historicoEtapas.ts`.
 */
export function indexarMensagens(mensagens: Mensagem[]) {
  const porLead = new Map<number, Mensagem[]>();
  for (const mensagem of mensagens) {
    const lista = porLead.get(mensagem.leadId);
    if (lista) lista.push(mensagem);
    else porLead.set(mensagem.leadId, [mensagem]);
  }
  return porLead;
}

export type Conversas = Mensagem[] | Map<number, Mensagem[]>;

/** A conversa de um lead, da mais antiga para a mais recente. */
export function conversaDoLead(mensagens: Conversas, leadId: number) {
  const lista =
    mensagens instanceof Map
      ? (mensagens.get(leadId) ?? [])
      : mensagens.filter((m) => m.leadId === leadId);
  return [...lista].sort((a, b) => b.minutosAtras - a.minutosAtras);
}

/** A última coisa dita na conversa, de qualquer lado. Nulo em quem não falou. */
export function ultimaMensagem(mensagens: Conversas, leadId: number) {
  const conversa = conversaDoLead(mensagens, leadId);
  return conversa[conversa.length - 1] ?? null;
}
