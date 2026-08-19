/**
 * Clientes da agência. Cada cliente aparece como uma linha nos relatórios.
 *
 * O nome "clínica" é o que a equipe usa no dia a dia, mas o cadastro é do
 * cliente: ele pode ter uma unidade, dezenas, ou nenhuma ainda (quem está
 * começando e atende em espaço alugado ou a domicílio).
 *
 * A ficha completa mora aqui, e não numa tela de configuração à parte, porque
 * ela é de cada cliente. Enquanto história, diferenciais, formas de pagamento
 * e público-alvo viveram em `estrategia.ts`, existia uma ficha só para doze
 * clientes — o que só funcionava enquanto ninguém olhava dois deles lado a
 * lado. `estrategia.ts` ficou com o que é de fato configuração da IA.
 */

/** Classe econômica predominante do público da clínica. */
export type ClasseEconomica = "A" | "B" | "C" | "D";

export const classesEconomicas: ClasseEconomica[] = ["A", "B", "C", "D"];

export type FormaPagamento =
  | "Pix"
  | "Dinheiro"
  | "Cartão de crédito"
  | "Cartão de débito"
  | "Boleto"
  | "Financiamento próprio";

export const formasDePagamento: FormaPagamento[] = [
  "Pix",
  "Dinheiro",
  "Cartão de crédito",
  "Cartão de débito",
  "Boleto",
  "Financiamento próprio",
];

/**
 * Convênio aceito e o que ele cobre. Estética quase nunca é coberta, então a
 * lista vazia é o caso comum — e é uma informação, não uma lacuna: serve para
 * o CRC responder na hora que o lead pergunta.
 */
export type Convenio = {
  nome: string;
  /** Ids da tela de Especialidades cobertos por este convênio. */
  especialidadeIds: number[];
};

/**
 * O que a clínica oferece e quanto cobra pela consulta de avaliação.
 *
 * É uma lista só, e não uma lista de procedimentos mais uma tabela de preços:
 * duas listas que precisam concordar sobre quais procedimentos existem é como
 * a divergência começa. Estar aqui já quer dizer que a clínica oferece.
 */
export type ProcedimentoDaClinica = {
  especialidadeId: number;
  /** Em reais. Nulo quando a avaliação é gratuita nesta clínica. */
  valorConsulta: number | null;
};

export type Clinica = {
  id: number;
  nome: string;
  cidade: string;
  /** Quantas unidades físicas. Zero é válido: cliente sem clínica própria. */
  unidades: number;
  /** Cliente pausado continua no cadastro, mas fora da operação. */
  ativa: boolean;
  endereco: string;
  horarioFuncionamento: string;

  // Estratégia e diferenciais
  historia: string;
  diferenciais: string;
  /** Carro-chefe da clínica. Id da tela de Especialidades. */
  tratamentoFocoId: number;
  procedimentos: ProcedimentoDaClinica[];

  // Comercial e condições
  /** Em reais. Nulo em cliente que ainda não tem histórico de venda. */
  ticketMedio: number | null;
  parcelasMaximas: number;
  formasPagamento: FormaPagamento[];
  convenios: Convenio[];

  // Público-alvo
  classes: ClasseEconomica[];
  faixaEtaria: { de: number; ate: number };
  principaisDores: string[];
};

// Dados de exemplo. Ainda não vêm de banco nem de API.
export const clinicasIniciais: Clinica[] = [
  {
    id: 1,
    nome: "Clínica Bella Face",
    cidade: "Porto Alegre/RS",
    unidades: 3,
    ativa: true,
    endereco:
      "Rua Mostardeiro, 322 · Sala 704 · Moinhos de Vento · Porto Alegre/RS",
    horarioFuncionamento:
      "Segunda a sexta, das 9h às 19h. Sábado, das 9h às 13h.",
    historia:
      "Fundada em 2015 como consultório único no Moinhos de Vento. Abriu a segunda unidade em 2019 e a terceira em 2023, hoje atende mais de 300 pacientes por mês.",
    diferenciais:
      "Equipe médica própria em todas as unidades, protocolo de harmonização autoral e acompanhamento pós-procedimento por 90 dias, incluso no valor.",
    tratamentoFocoId: 1,
    procedimentos: [
      { especialidadeId: 1, valorConsulta: null },
      { especialidadeId: 2, valorConsulta: null },
      { especialidadeId: 3, valorConsulta: null },
      { especialidadeId: 4, valorConsulta: 200 },
      { especialidadeId: 5, valorConsulta: null },
    ],
    ticketMedio: 4200,
    parcelasMaximas: 12,
    formasPagamento: [
      "Pix",
      "Cartão de crédito",
      "Cartão de débito",
      "Boleto",
      "Financiamento próprio",
    ],
    convenios: [],
    classes: ["A", "B"],
    faixaEtaria: { de: 30, ate: 55 },
    principaisDores: [
      "Medo de ficar com resultado artificial",
      "Já fez em outro lugar e não gostou",
      "Quer resultado antes de um evento com data marcada",
    ],
  },
  {
    id: 2,
    nome: "Instituto Renove",
    cidade: "Porto Alegre/RS",
    unidades: 1,
    ativa: true,
    endereco: "Av. Protásio Alves, 2870 · Sala 301 · Petrópolis · Porto Alegre/RS",
    horarioFuncionamento: "Segunda a sexta, das 8h às 18h.",
    historia:
      "Aberta em 2021 por duas sócias que saíram de uma rede grande. Trabalha com agenda cheia e ticket baixo: o objetivo é volume e recorrência, não procedimento único caro.",
    diferenciais:
      "Preço fechado publicado no Instagram, sem orçamento surpresa. Toxina aplicada em consulta de 30 minutos, com retorno de avaliação em 15 dias sem custo.",
    tratamentoFocoId: 3,
    procedimentos: [
      { especialidadeId: 2, valorConsulta: null },
      { especialidadeId: 3, valorConsulta: null },
      { especialidadeId: 5, valorConsulta: null },
    ],
    ticketMedio: 1800,
    parcelasMaximas: 6,
    formasPagamento: ["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito"],
    convenios: [],
    classes: ["B", "C"],
    faixaEtaria: { de: 25, ate: 45 },
    principaisDores: [
      "Acha que harmonização é só para quem tem muito dinheiro",
      "Tem pouco tempo livre e precisa de horário no fim do dia",
      "Quer começar por algo simples antes de fazer mais",
    ],
  },
  {
    id: 3,
    nome: "Studio Lumina",
    cidade: "Canoas/RS",
    unidades: 2,
    ativa: true,
    endereco: "Rua Ipiranga, 145 · Centro · Canoas/RS",
    horarioFuncionamento:
      "Segunda a sexta, das 10h às 20h. Sábado, das 10h às 16h.",
    historia:
      "Nasceu em 2020 como estúdio de lábios e cresceu pelo Instagram. A segunda unidade, em 2024, foi aberta dentro de um shopping para pegar o público que passa.",
    diferenciais:
      "Especialista dedicada só a lábios, simulação em foto antes de aplicar e retorno de 30 dias incluso. Atende até as 20h para quem sai do trabalho.",
    tratamentoFocoId: 2,
    procedimentos: [
      { especialidadeId: 1, valorConsulta: null },
      { especialidadeId: 2, valorConsulta: null },
      { especialidadeId: 3, valorConsulta: null },
      { especialidadeId: 5, valorConsulta: null },
    ],
    ticketMedio: 2400,
    parcelasMaximas: 10,
    formasPagamento: ["Pix", "Cartão de crédito", "Cartão de débito"],
    convenios: [],
    classes: ["B", "C"],
    faixaEtaria: { de: 22, ate: 38 },
    principaisDores: [
      "Medo de exagero e de ficar com boca artificial",
      "Compara preço com estúdio que aplica sem médico",
      "Quer ver antes e depois de alguém parecido com ela",
    ],
  },
  {
    id: 4,
    nome: "Espaço Vitta",
    cidade: "Novo Hamburgo/RS",
    unidades: 1,
    ativa: true,
    endereco: "Rua Marechal Floriano, 720 · Centro · Novo Hamburgo/RS",
    horarioFuncionamento: "Terça a sábado, das 9h às 18h.",
    historia:
      "Consultório de uma biomédica que atendia em casa e abriu espaço próprio em 2022. Cresceu por indicação de paciente, quase sem tráfego pago até entrar na agência.",
    diferenciais:
      "Foco em resultado gradual e natural: o plano é montado para acontecer ao longo de meses, com fotos de acompanhamento a cada sessão.",
    tratamentoFocoId: 4,
    procedimentos: [
      { especialidadeId: 1, valorConsulta: null },
      { especialidadeId: 3, valorConsulta: null },
      { especialidadeId: 4, valorConsulta: 150 },
    ],
    ticketMedio: 3100,
    parcelasMaximas: 10,
    formasPagamento: ["Pix", "Dinheiro", "Cartão de crédito", "Boleto"],
    convenios: [],
    classes: ["B"],
    faixaEtaria: { de: 35, ate: 55 },
    principaisDores: [
      "Quer efeito de rejuvenescimento sem parecer que fez",
      "Se incomoda com flacidez, não com rugas",
      "Já ouviu que bioestimulador dói e tem receio",
    ],
  },
  {
    id: 5,
    nome: "Clínica Arte & Estética",
    cidade: "Caxias do Sul/RS",
    unidades: 4,
    ativa: true,
    endereco: "Rua Sinimbu, 1885 · Centro · Caxias do Sul/RS",
    horarioFuncionamento:
      "Segunda a sexta, das 8h30 às 19h. Sábado, das 9h às 14h.",
    historia:
      "A mais antiga da carteira: começou em 2009 como clínica de dermatologia e migrou para estética avançada em 2016. Hoje tem quatro unidades na serra gaúcha.",
    diferenciais:
      "Estrutura de clínica médica com corpo clínico fixo, sala de procedimento própria em cada unidade e convênio empresarial com indústrias da região.",
    tratamentoFocoId: 1,
    procedimentos: [
      { especialidadeId: 1, valorConsulta: null },
      { especialidadeId: 2, valorConsulta: null },
      { especialidadeId: 3, valorConsulta: null },
      { especialidadeId: 4, valorConsulta: 180 },
      { especialidadeId: 5, valorConsulta: 80 },
    ],
    ticketMedio: 3800,
    parcelasMaximas: 12,
    formasPagamento: [
      "Pix",
      "Dinheiro",
      "Cartão de crédito",
      "Cartão de débito",
      "Boleto",
    ],
    convenios: [{ nome: "Unimed Nordeste RS", especialidadeIds: [5] }],
    classes: ["A", "B"],
    faixaEtaria: { de: 30, ate: 60 },
    principaisDores: [
      "Quer clínica com médico, não com esteticista",
      "Pergunta se o convênio cobre antes de qualquer coisa",
      "Mora em cidade vizinha e quer resolver em uma visita só",
    ],
  },
  {
    id: 6,
    nome: "Dra. Helena Braga",
    cidade: "Pelotas/RS",
    unidades: 0,
    ativa: true,
    endereco:
      "Atende em consultório compartilhado · Rua General Osório, 480 · Centro · Pelotas/RS",
    horarioFuncionamento: "Quarta a sexta, das 13h às 19h. Agenda por hora marcada.",
    historia:
      "Médica que atendia em clínica de terceiros e começou a atender no próprio nome em 2024. Ainda não tem espaço fixo: aluga sala em consultório compartilhado três dias por semana.",
    diferenciais:
      "Atendimento inteiro com a médica, da avaliação ao retorno, sem passar por recepção nem por outro profissional. Poucos pacientes por dia, por escolha.",
    tratamentoFocoId: 1,
    procedimentos: [
      { especialidadeId: 1, valorConsulta: 250 },
      { especialidadeId: 2, valorConsulta: 250 },
      { especialidadeId: 3, valorConsulta: 250 },
    ],
    ticketMedio: 5200,
    parcelasMaximas: 6,
    formasPagamento: ["Pix", "Cartão de crédito"],
    convenios: [],
    classes: ["A"],
    faixaEtaria: { de: 35, ate: 60 },
    principaisDores: [
      "Não quer ser atendida em clínica de volume",
      "Quer saber quem vai aplicar antes de agendar",
      "Estranha pagar pela avaliação e precisa entender o porquê",
    ],
  },
  {
    id: 7,
    nome: "Nova Pele",
    cidade: "Santa Maria/RS",
    unidades: 1,
    ativa: true,
    endereco: "Rua Venâncio Aires, 1240 · Centro · Santa Maria/RS",
    horarioFuncionamento: "Segunda a sábado, das 9h às 19h.",
    historia:
      "Aberta em 2018 perto da universidade, com público majoritariamente estudante. Faz volume de limpeza de pele e usa isso como porta de entrada para o resto.",
    diferenciais:
      "Primeira limpeza de pele com valor de entrada e plano de pele mensal. Horário estendido e sábado inteiro, pensando em quem estuda durante a semana.",
    tratamentoFocoId: 5,
    procedimentos: [
      { especialidadeId: 3, valorConsulta: null },
      { especialidadeId: 5, valorConsulta: null },
    ],
    ticketMedio: 900,
    parcelasMaximas: 4,
    formasPagamento: ["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito"],
    convenios: [],
    classes: ["C", "B"],
    faixaEtaria: { de: 18, ate: 32 },
    principaisDores: [
      "Acne ativa e marca de espinha",
      "Orçamento apertado, decide pelo preço da primeira sessão",
      "Nunca fez procedimento nenhum e tem medo de doer",
    ],
  },
  {
    id: 8,
    nome: "Clínica Aurora",
    cidade: "Gramado/RS",
    unidades: 1,
    ativa: true,
    endereco: "Av. Borges de Medeiros, 2145 · Centro · Gramado/RS",
    horarioFuncionamento:
      "Segunda a sábado, das 9h às 19h. Alta temporada com agenda estendida.",
    historia:
      "Aberta em 2019 dentro do circuito turístico de Gramado. Boa parte dos pacientes vem de fora e faz o procedimento durante a viagem, o que muda toda a lógica de agenda.",
    diferenciais:
      "Pacote de dois dias para quem vem de outra cidade, com avaliação e procedimento na mesma viagem, e acompanhamento por vídeo depois que o paciente volta para casa.",
    tratamentoFocoId: 1,
    procedimentos: [
      { especialidadeId: 1, valorConsulta: 250 },
      { especialidadeId: 2, valorConsulta: 250 },
      { especialidadeId: 4, valorConsulta: 250 },
    ],
    ticketMedio: 6400,
    parcelasMaximas: 12,
    formasPagamento: ["Pix", "Cartão de crédito", "Financiamento próprio"],
    convenios: [],
    classes: ["A"],
    faixaEtaria: { de: 32, ate: 58 },
    principaisDores: [
      "Mora longe e só tem os dias da viagem",
      "Quer garantir que dá para voltar de carro no dia seguinte",
      "Precisa de data fechada antes de comprar passagem",
    ],
  },
  {
    id: 9,
    nome: "Corpus Harmonia",
    cidade: "Florianópolis/SC",
    unidades: 6,
    ativa: true,
    endereco: "Rod. José Carlos Daux, 4150 · Saco Grande · Florianópolis/SC",
    horarioFuncionamento: "Segunda a sexta, das 8h às 20h. Sábado, das 9h às 15h.",
    historia:
      "Maior cliente da carteira. Começou em 2014 com uma unidade na Trindade e virou rede em 2021, com seis unidades na Grande Florianópolis e operação de call center própria.",
    diferenciais:
      "Escala: seis unidades, agenda com horário em qualquer dia da semana e equipe grande o bastante para encaixar paciente no mesmo dia. Preço padronizado entre as unidades.",
    tratamentoFocoId: 1,
    procedimentos: [
      { especialidadeId: 1, valorConsulta: null },
      { especialidadeId: 2, valorConsulta: null },
      { especialidadeId: 3, valorConsulta: null },
      { especialidadeId: 4, valorConsulta: 150 },
      { especialidadeId: 5, valorConsulta: null },
    ],
    ticketMedio: 3600,
    parcelasMaximas: 12,
    formasPagamento: [
      "Pix",
      "Dinheiro",
      "Cartão de crédito",
      "Cartão de débito",
      "Boleto",
      "Financiamento próprio",
    ],
    convenios: [
      { nome: "Unimed Grande Florianópolis", especialidadeIds: [5] },
      { nome: "Amil Dental Estética", especialidadeIds: [] },
    ],
    classes: ["A", "B", "C"],
    faixaEtaria: { de: 25, ate: 55 },
    principaisDores: [
      "Quer a unidade mais perto de casa ou do trabalho",
      "Já tentou agendar antes e não conseguiu horário",
      "Compara preço entre unidades e quer saber se muda",
    ],
  },
  {
    id: 10,
    nome: "Belle Époque",
    cidade: "Curitiba/PR",
    unidades: 2,
    ativa: true,
    endereco: "Al. Dom Pedro II, 255 · Batel · Curitiba/PR",
    horarioFuncionamento: "Segunda a sexta, das 9h às 19h.",
    historia:
      "Clínica de bairro nobre aberta em 2017, com público fiel e pouca renovação de base. Entrou na agência justamente para trazer paciente novo sem perder o posicionamento.",
    diferenciais:
      "Protocolo de rejuvenescimento em etapas, com bioestimulador como base do plano anual. Consulta longa, de uma hora, e plano escrito entregue ao paciente.",
    tratamentoFocoId: 4,
    procedimentos: [
      { especialidadeId: 1, valorConsulta: 300 },
      { especialidadeId: 2, valorConsulta: 300 },
      { especialidadeId: 4, valorConsulta: 300 },
    ],
    ticketMedio: 7200,
    parcelasMaximas: 12,
    formasPagamento: ["Pix", "Cartão de crédito", "Financiamento próprio"],
    convenios: [],
    classes: ["A"],
    faixaEtaria: { de: 40, ate: 65 },
    principaisDores: [
      "Não quer procedimento que mude os traços do rosto",
      "Tem medo de parecer que fez e ser notada no trabalho",
      "Já fez com outro profissional e quer entender o que deu errado",
    ],
  },
  {
    id: 11,
    nome: "Clínica Semprebom",
    cidade: "Blumenau/SC",
    unidades: 1,
    ativa: true,
    endereco: "Rua Sete de Setembro, 980 · Centro · Blumenau/SC",
    horarioFuncionamento: "Segunda a sexta, das 9h às 18h.",
    // Entrou agora: cadastrada, sem campanha rodando ainda.
    historia:
      "Cliente novo, assinou contrato neste mês. A clínica existe desde 2023, mas ainda não rodou campanha com a agência — a ficha vai ser completada na reunião de onboarding.",
    diferenciais:
      "Ainda não levantados. O que a clínica informou até agora é que atende sem fila de espera e faz o retorno de 15 dias sem custo.",
    tratamentoFocoId: 3,
    procedimentos: [
      { especialidadeId: 3, valorConsulta: null },
      { especialidadeId: 5, valorConsulta: null },
    ],
    ticketMedio: null,
    parcelasMaximas: 6,
    formasPagamento: ["Pix", "Cartão de crédito"],
    convenios: [],
    classes: ["B", "C"],
    faixaEtaria: { de: 25, ate: 50 },
    principaisDores: ["Ainda não levantadas com o cliente"],
  },
  {
    id: 12,
    nome: "Estética Viva",
    cidade: "Londrina/PR",
    unidades: 2,
    ativa: false,
    endereco: "Av. Higienópolis, 1400 · Centro · Londrina/PR",
    horarioFuncionamento: "Segunda a sexta, das 9h às 18h.",
    // Contrato pausado: fica no cadastro para o histórico não sumir.
    historia:
      "Cliente de 2022 a 2025, com duas unidades em Londrina. Pausou o contrato para reformar a unidade principal. A ficha está congelada como estava no último mês ativo.",
    diferenciais:
      "Preço de tabela abaixo da média da região e pacote fechado de três sessões, que era o principal argumento de venda enquanto a campanha rodava.",
    tratamentoFocoId: 1,
    procedimentos: [
      { especialidadeId: 1, valorConsulta: null },
      { especialidadeId: 3, valorConsulta: null },
      { especialidadeId: 5, valorConsulta: null },
    ],
    ticketMedio: 2900,
    parcelasMaximas: 10,
    formasPagamento: ["Pix", "Dinheiro", "Cartão de crédito", "Boleto"],
    convenios: [],
    classes: ["B", "C"],
    faixaEtaria: { de: 28, ate: 50 },
    principaisDores: [
      "Decide por preço e compara com clínica popular",
      "Quer parcelar sem entrada",
    ],
  },
];

export function clinicaPorId(id: number) {
  return clinicasIniciais.find((c) => c.id === id);
}

/** Nome da clínica, com um rótulo seguro caso o id não exista mais. */
export function nomeDaClinica(id: number) {
  return clinicaPorId(id)?.nome ?? "Clínica removida";
}

/** O procedimento na clínica. Nulo quando ela não oferece. */
export function procedimentoDaClinica(clinica: Clinica, especialidadeId: number) {
  return (
    clinica.procedimentos.find((p) => p.especialidadeId === especialidadeId) ??
    null
  );
}

/** Se a clínica oferece o procedimento. Estar na lista já é a resposta. */
export function oferece(clinica: Clinica, especialidadeId: number) {
  return procedimentoDaClinica(clinica, especialidadeId) !== null;
}

/** Quais clínicas oferecem o procedimento. */
export function clinicasQueOferecem(especialidadeId: number) {
  return clinicasIniciais.filter((c) => oferece(c, especialidadeId));
}

/**
 * Quais convênios cobrem o procedimento nesta clínica. Devolve lista vazia
 * quando nenhum cobre — que é o caso comum em estética, e é uma resposta.
 */
export function conveniosQueCobrem(clinica: Clinica, especialidadeId: number) {
  return clinica.convenios.filter((c) =>
    c.especialidadeIds.includes(especialidadeId),
  );
}
