/**
 * Conversas pré-roteirizadas do simulador. Nada aqui chama uma IA de verdade
 * nem envia mensagem para ninguém: é só um roteiro fixo, para a equipe ver o
 * tom das respostas antes de qualquer coisa ir para o ar.
 */
export type AutorMensagem = "Lead" | "IA" | "Humano" | "Sistema";

export type MensagemSimulada = {
  autor: AutorMensagem;
  texto: string;
  /** De qual tela do sistema veio esse conteúdo. */
  fonte?: string;
};

export type Cenario = {
  id: string;
  nome: string;
  descricao: string;
  mensagens: MensagemSimulada[];
};

export const cenarios: Cenario[] = [
  {
    id: "lead-novo-preco",
    nome: "Lead novo pedindo preço",
    descricao:
      "Lead do Meta Ads que chega no WhatsApp perguntando quanto custa, antes de qualquer contato.",
    mensagens: [
      {
        autor: "Lead",
        texto: "Oi, vi o anúncio de vocês. Quanto custa preenchimento labial?",
      },
      {
        autor: "Sistema",
        texto:
          "Lead novo: o primeiro contato é sempre da CRC, nunca da IA. A régua dispara o aviso e a pessoa liga em até 5 minutos.",
        fonte: "Régua de Automação · Lead novo do Meta Ads",
      },
      {
        autor: "Humano",
        texto:
          "Oi! Aqui é a Letícia, da recepção. Vi que você se interessou pelo preenchimento labial. Posso te explicar como funciona?",
      },
      {
        autor: "Sistema",
        texto: "A partir daqui a IA assume o acompanhamento da conversa.",
        fonte: "Estratégia da Clínica · Modo de atendimento: Todo lead",
      },
      {
        autor: "IA",
        texto:
          "O valor depende do volume que combina com o seu rosto, por isso a gente não passa um número solto: a avaliação é gratuita e dura cerca de 40 minutos.",
        fonte: "Especialidades · Preenchimento labial",
      },
      {
        autor: "Lead",
        texto: "E dá pra parcelar?",
      },
      {
        autor: "IA",
        texto:
          "Dá sim: Pix, cartão em até 12x, boleto e financiamento próprio. Quer que eu veja um horário para esta semana?",
        fonte: "Estratégia da Clínica · Formas de pagamento",
      },
      {
        autor: "Lead",
        texto: "Pode ser quinta de manhã",
      },
      {
        autor: "IA",
        texto:
          "Fechado. Quinta às 9h30 com o Dr. Otávio Lins, nosso avaliador. Fica na Rua Mostardeiro, 322, sala 704, Moinhos de Vento.",
        fonte: "Profissionais · Dr. Otávio Lins · Estratégia da Clínica · Endereço",
      },
    ],
  },
  {
    id: "objecao-preco",
    nome: "Objeção de preço",
    descricao:
      "Lead recebeu o orçamento, achou caro e ficou em silêncio. A régua dispara a retomada.",
    mensagens: [
      {
        autor: "Lead",
        texto: "Recebi o orçamento, mas achei bem caro pra mim agora",
      },
      {
        autor: "Sistema",
        texto:
          "A IA reconheceu a objeção de preço e usou a resposta padrão cadastrada.",
        fonte: "Régua de Automação · Objeção de preço detectada",
      },
      {
        autor: "IA",
        texto:
          "Entendo. Nosso valor inclui acompanhamento por 90 dias e retoques. Também parcelamos em até 12x sem comprometer o orçamento.",
        fonte: "Quebra de Objeções · Está muito caro",
      },
      {
        autor: "Lead",
        texto: "É que vi mais barato numa clínica aqui perto",
      },
      {
        autor: "IA",
        texto:
          "Vale comparar o que está incluso: produto usado, lote rastreado e equipe médica. Posso detalhar nosso pacote para você comparar.",
        fonte: "Quebra de Objeções · Vi mais barato em outra clínica",
      },
      {
        autor: "Lead",
        texto: "Manda aí então",
      },
      {
        autor: "IA",
        texto:
          "Envio ainda hoje. E se preferir, seguro um horário provisório para sexta: se mudar de ideia, cancelamos sem custo.",
        fonte: "Quebra de Objeções · Vou pensar e retorno",
      },
    ],
  },
  {
    id: "confirmacao-consulta",
    nome: "Confirmação de consulta",
    descricao:
      "Disparo automático 24h antes da consulta, com o desfecho de quem pede para remarcar.",
    mensagens: [
      {
        autor: "Sistema",
        texto:
          "Disparo automático: lembrete enviado 24h antes do horário marcado.",
        fonte: "Régua de Automação · Confirmação de consulta · D-1",
      },
      {
        autor: "IA",
        texto:
          "Oi, Renata! Passando para confirmar sua avaliação amanhã às 14h com a Dra. Camila Rocha. Chegue 10 minutos antes, na Rua Mostardeiro, 322, sala 704.",
        fonte: "Profissionais · Dra. Camila Rocha",
      },
      {
        autor: "Lead",
        texto: "Amanhã não vai dar, tenho reunião nesse horário",
      },
      {
        autor: "IA",
        texto:
          "Sem problema. Tenho quinta às 9h ou sexta às 18h30. Algum desses funciona melhor?",
        fonte: "Estratégia da Clínica · Horário de funcionamento",
      },
      {
        autor: "Lead",
        texto: "Sexta 18h30 fica ótimo",
      },
      {
        autor: "IA",
        texto:
          "Remarcado para sexta às 18h30, com a Dra. Camila. Envio o lembrete um dia antes. Até lá!",
      },
    ],
  },
  {
    id: "especialidade-pausada",
    nome: "Pergunta sobre especialidade pausada",
    descricao:
      "Lead pergunta por um serviço que está inativo. A IA não pode oferecer nem agendar.",
    mensagens: [
      {
        autor: "Lead",
        texto: "Vocês fazem drenagem linfática? Queria começar esse mês",
      },
      {
        autor: "Sistema",
        texto:
          "Especialidade marcada como inativa: a IA não oferece nem agenda, apenas aciona a equipe.",
        fonte: "Especialidades · Drenagem linfática (inativa)",
      },
      {
        autor: "IA",
        texto:
          "A drenagem está pausada enquanto nossa sala corporal passa por reforma. Vou pedir para a recepção te avisar assim que voltar, tudo bem?",
        fonte: "Especialidades · Drenagem linfática · Como abordar",
      },
      {
        autor: "Lead",
        texto: "Tudo bem. E limpeza de pele vocês fazem?",
      },
      {
        autor: "IA",
        texto:
          "Fazemos sim, com avaliação gratuita de 30 minutos. Tenho horário na terça de manhã, quer que eu reserve?",
        fonte: "Especialidades · Limpeza de pele",
      },
    ],
  },
];
