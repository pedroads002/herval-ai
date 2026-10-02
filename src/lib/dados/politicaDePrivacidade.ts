/**
 * O texto da Política de Privacidade da Helô, palavra por palavra.
 *
 * Mora aqui, e não dentro da página, por um motivo prático: política de
 * privacidade é documento jurídico que muda por fora do código — alguém revisa
 * o texto e manda a versão nova. Com o texto separado do layout, atualizar é
 * mexer só nesta lista; a página continua intacta.
 *
 * Quando o texto mudar, mude também `ATUALIZADA_EM`. É a data que a página
 * mostra no topo, e é por ela que se sabe qual versão está no ar.
 */

export const ATUALIZADA_EM = "29/09/2026";

export type BlocoDaPolitica =
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "lista"; itens: readonly string[] }
  // Pares rótulo/valor (razão social, CNPJ, e-mail). Valor com "@" virei link
  // de e-mail na página — é o único caso em que o leitor precisa clicar.
  | { tipo: "dados"; itens: readonly { rotulo: string; valor: string }[] };

export type SubsecaoDaPolitica = {
  numero: string;
  titulo: string;
  blocos: readonly BlocoDaPolitica[];
};

export type SecaoDaPolitica = {
  numero: number;
  titulo: string;
  blocos: readonly BlocoDaPolitica[];
  subsecoes?: readonly SubsecaoDaPolitica[];
};

/** Os parágrafos de abertura, antes da seção 1. */
export const ABERTURA: readonly string[] = [
  "A Helô - Herval AI (“Helô”) é uma plataforma de tecnologia desenvolvida pela Herval Marketing, destinada à automação e gestão de processos comerciais, atendimento, comunicação com leads e clientes, acompanhamento de agendamentos, automações e funcionalidades relacionadas à operação comercial.",
  "A proteção da privacidade e dos dados pessoais tratados por meio da plataforma é importante para nós. Esta Política de Privacidade explica, de forma transparente, quais dados podem ser tratados pela Helô, para quais finalidades, em quais circunstâncias eles podem ser compartilhados e quais direitos podem ser exercidos pelos titulares.",
  "Esta Política deve ser lida em conjunto com os demais termos, contratos e políticas eventualmente aplicáveis à utilização da plataforma.",
];

export const SECOES_DA_POLITICA: readonly SecaoDaPolitica[] = [
  {
    numero: 1,
    titulo: "Identificação do responsável pela Helô",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "A Helô - Herval AI é um software desenvolvido pela Herval Marketing e operado pela empresa:",
      },
      {
        tipo: "dados",
        itens: [
          {
            rotulo: "Razão social",
            valor: "50 814 514 LAIS DE OLIVEIRA COSTA HERVAL",
          },
          { rotulo: "CNPJ", valor: "50.814.514/0001-59" },
          { rotulo: "Nome do produto", valor: "Helô - Herval AI" },
          { rotulo: "E-mail de contato", valor: "contato@hervalmarketing.com" },
        ],
      },
      {
        tipo: "paragrafo",
        texto:
          "Para questões relacionadas à privacidade e ao tratamento de dados pessoais, o contato poderá ser realizado pelo endereço eletrônico informado acima.",
      },
    ],
  },
  {
    numero: 2,
    titulo: "Sobre a Helô",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "A Helô é uma plataforma tecnológica voltada à gestão e automação de processos comerciais e de atendimento.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Entre suas funcionalidades, atuais ou que poderão ser disponibilizadas conforme contratação, configuração e integrações habilitadas, estão:",
      },
      {
        tipo: "lista",
        itens: [
          "atendimento automatizado e assistido;",
          "chatbots e recursos de inteligência artificial;",
          "organização e acompanhamento de leads;",
          "automação de follow-ups;",
          "comunicação por WhatsApp;",
          "registro e acompanhamento de agendamentos;",
          "registro de comparecimentos;",
          "acompanhamento de conversões comerciais;",
          "comunicação de informações comerciais configuradas pelos clientes;",
          "registro de valores associados a consultas, avaliações, vendas, procedimentos, tratamentos, produtos ou serviços, quando aplicável;",
          "gestão e análise de informações comerciais;",
          "integração com plataformas de comunicação;",
          "integração com ferramentas de publicidade e marketing;",
          "automações de processos comerciais e administrativos.",
        ],
      },
      {
        tipo: "paragrafo",
        texto:
          "A disponibilidade de cada funcionalidade poderá variar de acordo com o plano, configuração, integrações e serviços utilizados por cada cliente da Helô.",
      },
    ],
  },
  {
    numero: 3,
    titulo: "Papéis no tratamento de dados",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "Dependendo da natureza da operação, a empresa responsável pela Helô poderá atuar em diferentes posições previstas na legislação de proteção de dados.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Quando uma empresa cliente utiliza a Helô para realizar atendimento, organizar leads, executar automações, registrar agendamentos ou tratar informações de seus próprios consumidores, pacientes ou potenciais clientes, a empresa cliente poderá atuar como Controladora dos dados pessoais, determinando as finalidades e os meios essenciais do tratamento.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Nessas situações, a Helô poderá atuar como Operadora, tratando dados pessoais em nome e de acordo com as instruções do cliente, observadas as obrigações legais e contratuais aplicáveis.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Em outras situações, como no tratamento de informações necessárias para cadastro, contratação, faturamento, segurança, suporte e relacionamento direto com os próprios clientes e usuários da Helô, a empresa responsável pela Helô poderá atuar como Controladora.",
      },
      {
        tipo: "paragrafo",
        texto:
          "A definição dos respectivos papéis dependerá da natureza concreta de cada operação de tratamento.",
      },
    ],
  },
  {
    numero: 4,
    titulo: "Dados que podem ser tratados",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "Conforme as funcionalidades utilizadas e as interações realizadas por meio da plataforma, a Helô poderá tratar diferentes categorias de dados pessoais.",
      },
    ],
    subsecoes: [
      {
        numero: "4.1",
        titulo: "Dados de identificação e contato",
        blocos: [
          { tipo: "paragrafo", texto: "Podem incluir:" },
          {
            tipo: "lista",
            itens: [
              "nome ou nome de perfil informado no WhatsApp;",
              "número de telefone e WhatsApp;",
              "outras informações de identificação fornecidas voluntariamente durante o atendimento.",
            ],
          },
        ],
      },
      {
        numero: "4.2",
        titulo: "Dados de comunicação e atendimento",
        blocos: [
          { tipo: "paragrafo", texto: "Podem incluir:" },
          {
            tipo: "lista",
            itens: [
              "mensagens enviadas e recebidas;",
              "conteúdo de conversas;",
              "respostas fornecidas durante o atendimento;",
              "informações relacionadas ao interesse demonstrado pelo usuário;",
              "histórico necessário para continuidade do atendimento;",
              "arquivos, imagens, vídeos, áudios ou documentos enviados voluntariamente durante uma conversa, quando tecnicamente recebidos pela plataforma ou pelos serviços integrados.",
            ],
          },
        ],
      },
      {
        numero: "4.3",
        titulo: "Dados relacionados a agendamentos",
        blocos: [
          { tipo: "paragrafo", texto: "Podem incluir:" },
          {
            tipo: "lista",
            itens: [
              "data e horário da consulta ou atendimento;",
              "informações necessárias para organização do agendamento;",
              "confirmação, cancelamento ou reagendamento;",
              "registro de comparecimento ou ausência.",
            ],
          },
        ],
      },
      {
        numero: "4.4",
        titulo: "Dados comerciais e informações relacionadas a pagamentos",
        blocos: [
          { tipo: "paragrafo", texto: "Podem incluir:" },
          {
            tipo: "lista",
            itens: [
              "interesse em determinado produto, serviço, procedimento ou tratamento;",
              "estágio do atendimento ou processo comercial;",
              "informação sobre conversão ou fechamento;",
              "valores relacionados a consultas e avaliações;",
              "valores exatos, valores iniciais, faixas de valores, referências ou estimativas comerciais relacionadas a procedimentos, tratamentos, produtos ou serviços, quando aplicável;",
              "valor efetivamente associado à venda ou contratação, quando registrado pelo cliente;",
              "informações relacionadas à confirmação de pagamento de consultas ou avaliações, quando aplicável;",
              "comprovantes de pagamento enviados pelo usuário durante o atendimento, quando aplicável;",
              "informações necessárias para acompanhamento de resultados e indicadores comerciais.",
            ],
          },
          {
            tipo: "paragrafo",
            texto:
              "As informações comerciais comunicadas durante o atendimento poderão variar de acordo com a configuração adotada pela empresa cliente, com a natureza do produto, serviço, procedimento ou tratamento e com as regras aplicáveis à respectiva atividade profissional.",
          },
          {
            tipo: "paragrafo",
            texto:
              "Dependendo do cliente, do serviço oferecido e das regras aplicáveis, a Helô poderá comunicar valores exatos, valores iniciais, faixas de valores, referências ou estimativas comerciais fornecidas ou configuradas pelo próprio cliente.",
          },
          {
            tipo: "paragrafo",
            texto:
              "Quando determinado procedimento ou tratamento depender de avaliação individual, eventual valor inicial, faixa, referência ou estimativa comercial comunicada durante o atendimento não constitui, por si só, orçamento clínico individualizado, diagnóstico, prescrição ou definição da indicação do usuário.",
          },
          {
            tipo: "paragrafo",
            texto:
              "A Helô não realiza o processamento financeiro dos pagamentos efetuados entre usuários e empresas clientes.",
          },
          {
            tipo: "paragrafo",
            texto:
              "Quando uma consulta, avaliação, procedimento, tratamento, produto ou serviço exigir pagamento, esse pagamento será realizado diretamente à clínica, estabelecimento ou profissional responsável, utilizando os meios de pagamento disponibilizados pelo próprio destinatário do pagamento.",
          },
          {
            tipo: "paragrafo",
            texto:
              "A Helô poderá, durante o atendimento automatizado ou assistido, comunicar ao usuário informações de pagamento fornecidas pela própria clínica ou profissional, como valor da consulta ou avaliação e chave PIX destinada ao pagamento.",
          },
          {
            tipo: "paragrafo",
            texto:
              "A Helô não é banco, instituição financeira, instituição de pagamento, gateway de pagamento, processadora de pagamentos, adquirente, subadquirente ou intermediadora financeira.",
          },
          {
            tipo: "paragrafo",
            texto:
              "A Helô e a Herval Marketing não recebem, custodiam, movimentam, liquidam ou intermedeiam os valores financeiros pagos pelos usuários às clínicas, estabelecimentos ou profissionais responsáveis.",
          },
          {
            tipo: "paragrafo",
            texto:
              "Os valores de consultas, avaliações, procedimentos, tratamentos, produtos ou serviços são pagos diretamente pelo usuário à clínica, estabelecimento ou profissional responsável. Nenhum valor destinado a esses pagamentos transita por conta bancária, conta de pagamento ou estrutura financeira pertencente à Helô ou à Herval Marketing.",
          },
          {
            tipo: "paragrafo",
            texto:
              "Informações relacionadas ao pagamento e eventuais comprovantes enviados pelo usuário poderão, entretanto, ser tecnicamente recebidos e tratados pela Helô como parte do atendimento, inclusive para dar continuidade a fluxos automatizados ou assistidos, registrar a informação correspondente e permitir a confirmação do agendamento, conforme a configuração adotada pela empresa cliente.",
          },
          {
            tipo: "paragrafo",
            texto:
              "O tratamento dessas informações dentro da Helô não significa que a plataforma tenha processado, intermediado ou recebido o respectivo pagamento.",
          },
        ],
      },
      {
        numero: "4.5",
        titulo: "Dados técnicos e de utilização",
        blocos: [
          {
            tipo: "paragrafo",
            texto:
              "Quando aplicável, poderão ser tratados dados técnicos necessários ao funcionamento, segurança e melhoria da plataforma, tais como:",
          },
          {
            tipo: "lista",
            itens: [
              "registros de acesso;",
              "eventos de utilização;",
              "informações técnicas do navegador ou dispositivo;",
              "registros de erros;",
              "logs de segurança;",
              "identificadores técnicos;",
              "informações necessárias à autenticação e funcionamento das integrações.",
            ],
          },
        ],
      },
    ],
  },
  {
    numero: 5,
    titulo: "Dados relacionados à saúde e conteúdos enviados pelo usuário",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "A Helô não é um sistema destinado à realização de diagnóstico médico, odontológico ou de qualquer outra natureza clínica, prescrição, elaboração de prontuários, realização de anamnese ou substituição de avaliação realizada por profissional habilitado.",
      },
      {
        tipo: "paragrafo",
        texto:
          "A plataforma é destinada predominantemente a atividades comerciais e administrativas, como atendimento inicial, identificação de interesse, comunicação, fornecimento de informações comerciais, follow-up, agendamento, comparecimento e acompanhamento de conversões.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Apesar disso, durante uma conversa, um usuário poderá, por iniciativa própria, encaminhar fotografias, vídeos, áudios, documentos ou mensagens contendo informações que possam revelar dados relacionados à sua saúde ou outras informações de natureza sensível.",
      },
      {
        tipo: "paragrafo",
        texto:
          "A Helô não solicita esse conteúdo para realizar diagnóstico ou avaliação clínica e o seu envio não implica realização de diagnóstico, prescrição, definição de tratamento ou avaliação profissional pela plataforma.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Quando tais informações forem espontaneamente enviadas e tecnicamente processadas pelos sistemas utilizados na comunicação, seu tratamento deverá ocorrer apenas na medida necessária para o funcionamento do atendimento, cumprimento das instruções do cliente responsável e observância das obrigações legais aplicáveis.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Sempre que uma avaliação clínica ou profissional individualizada for necessária, o usuário deverá ser direcionado ao profissional ou estabelecimento responsável pelos meios apropriados de atendimento.",
      },
    ],
  },
  {
    numero: 6,
    titulo: "Finalidades do tratamento",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "Os dados pessoais poderão ser tratados, conforme o contexto e as funcionalidades utilizadas, para:",
      },
      {
        tipo: "lista",
        itens: [
          "possibilitar o funcionamento da plataforma;",
          "identificar usuários e contatos;",
          "permitir comunicação entre empresas e seus leads ou clientes;",
          "fornecer atendimento automatizado ou assistido;",
          "executar chatbots e automações;",
          "manter o contexto necessário à continuidade das conversas;",
          "realizar follow-ups;",
          "organizar e acompanhar leads;",
          "registrar, confirmar, reagendar ou acompanhar agendamentos;",
          "registrar comparecimentos e ausências;",
          "acompanhar conversões comerciais;",
          "comunicar informações comerciais fornecidas ou configuradas pelas empresas clientes;",
          "registrar valores exatos, valores iniciais, faixas, referências ou estimativas comerciais relacionadas a consultas, avaliações, procedimentos, tratamentos, produtos ou serviços, quando aplicável;",
          "registrar valores efetivamente associados a vendas ou contratações;",
          "registrar informações relacionadas à confirmação de pagamentos realizados diretamente às clínicas, estabelecimentos ou profissionais, quando necessárias ao fluxo de atendimento;",
          "tratar, quando enviados pelo usuário, comprovantes ou informações relacionadas ao pagamento para continuidade do atendimento e confirmação de agendamentos;",
          "gerar indicadores e informações de desempenho comercial;",
          "executar integrações autorizadas pelos clientes;",
          "prestar suporte técnico;",
          "prevenir fraudes, abusos e acessos não autorizados;",
          "manter a segurança e estabilidade dos sistemas;",
          "diagnosticar falhas técnicas;",
          "cumprir obrigações legais, regulatórias ou contratuais;",
          "exercer direitos em processos administrativos, judiciais ou arbitrais, quando aplicável;",
          "desenvolver, manter e aprimorar as funcionalidades da Helô, observados os requisitos legais aplicáveis.",
        ],
      },
    ],
  },
  {
    numero: 7,
    titulo: "WhatsApp e serviços de comunicação",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "A Helô poderá utilizar tecnologias e provedores destinados à integração e automação de comunicações realizadas por WhatsApp.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Durante a fase atual de desenvolvimento, testes e implantação, determinadas funcionalidades poderão utilizar tecnologias de integração como Evolution API e componentes tecnológicos associados, incluindo Baileys.",
      },
      {
        tipo: "paragrafo",
        texto:
          "A arquitetura de comunicação da Helô poderá ser atualizada ou substituída conforme a evolução técnica da plataforma.",
      },
      {
        tipo: "paragrafo",
        texto:
          "A Helô também está sendo preparada para integração com a WhatsApp Business Platform disponibilizada pela Meta, permitindo que empresas clientes conectem e utilizem seus próprios ativos, contas e números de WhatsApp conforme os mecanismos de autorização disponibilizados pela Meta.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Quando uma empresa cliente conecta seus ativos à Helô, o acesso e tratamento dessas informações ficam limitados às autorizações concedidas, às funcionalidades contratadas e às finalidades necessárias à prestação do serviço.",
      },
      {
        tipo: "paragrafo",
        texto:
          "A utilização do WhatsApp também está sujeita aos termos, políticas e regras estabelecidos pela Meta e pelo WhatsApp.",
      },
    ],
  },
  {
    numero: 8,
    titulo: "Meta e recursos de publicidade",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "A Helô poderá integrar-se a produtos e APIs disponibilizados pela Meta Platforms para fornecer funcionalidades relacionadas a comunicação, publicidade, análise e gestão comercial.",
      },
      {
        tipo: "paragrafo",
        texto: "Entre essas tecnologias poderão estar:",
      },
      {
        tipo: "lista",
        itens: [
          "WhatsApp Business Platform;",
          "Meta Marketing API;",
          "mecanismos de autorização e integração disponibilizados pela Meta.",
        ],
      },
      {
        tipo: "paragrafo",
        texto:
          "Quando uma empresa cliente autorizar a Helô a acessar determinados ativos da Meta, a plataforma poderá processar as informações necessárias para executar as funcionalidades autorizadas.",
      },
      {
        tipo: "paragrafo",
        texto:
          "O acesso será limitado às permissões concedidas pelo cliente, às permissões disponibilizadas e aprovadas pelas plataformas envolvidas e às funcionalidades efetivamente utilizadas.",
      },
    ],
  },
  {
    numero: 9,
    titulo: "Inteligência artificial e automações",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "A Helô poderá utilizar sistemas de inteligência artificial e automação para executar funcionalidades como:",
      },
      {
        tipo: "lista",
        itens: [
          "interpretação de mensagens;",
          "geração de respostas;",
          "atendimento automatizado;",
          "classificação e organização de interações;",
          "execução de fluxos de atendimento;",
          "automações operacionais;",
          "suporte ao processamento de informações comerciais;",
          "comunicação de informações comerciais configuradas pelas empresas clientes;",
          "execução de etapas operacionais relacionadas ao atendimento e ao agendamento;",
          "continuidade de fluxos após o recebimento de informações ou documentos enviados pelo usuário;",
          "confirmação de agendamentos conforme as regras e configurações definidas pela empresa cliente.",
        ],
      },
      {
        tipo: "paragrafo",
        texto:
          "A Helô poderá comunicar informações comerciais, incluindo valores exatos, valores iniciais, faixas, referências ou estimativas, quando essas informações forem fornecidas ou configuradas pela empresa cliente e sua comunicação for aplicável ao respectivo atendimento.",
      },
      {
        tipo: "paragrafo",
        texto:
          "A forma como essas informações são comunicadas poderá variar conforme o cliente, o produto, serviço, procedimento ou tratamento oferecido e as regras aplicáveis à respectiva atividade profissional.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Quando o valor final de determinado procedimento ou tratamento depender de avaliação individual, eventual referência ou estimativa comunicada pela Helô não representa diagnóstico, indicação clínica ou orçamento individualizado definitivo.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Para essas funcionalidades, determinadas informações poderão ser processadas por provedores tecnológicos utilizados pela Helô, conforme a configuração da plataforma e a necessidade de cada operação.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Atualmente, a infraestrutura tecnológica da Helô poderá utilizar serviços e tecnologias fornecidos por empresas como OpenAI e Anthropic, além de ferramentas de automação como n8n.",
      },
      {
        tipo: "paragrafo",
        texto:
          "A utilização desses serviços deverá ser limitada às informações necessárias para a execução das respectivas funcionalidades e observar as configurações, contratos e medidas de proteção aplicáveis.",
      },
      {
        tipo: "paragrafo",
        texto:
          "A Helô não deve ser utilizada para substituir avaliação, diagnóstico, prescrição, indicação de tratamento ou decisão clínica de profissional habilitado.",
      },
    ],
  },
  {
    numero: 10,
    titulo: "Infraestrutura e fornecedores de tecnologia",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "Para operar a plataforma, a Helô utiliza ou poderá utilizar fornecedores especializados de infraestrutura, banco de dados, hospedagem, inteligência artificial, automação, comunicação e outros serviços tecnológicos.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Entre os serviços atualmente utilizados ou previstos na arquitetura da plataforma estão:",
      },
      {
        tipo: "lista",
        itens: [
          "Vercel — hospedagem e disponibilização de aplicações web;",
          "Supabase — infraestrutura de banco de dados e serviços relacionados;",
          "OpenAI — recursos de inteligência artificial, quando aplicável;",
          "Anthropic — recursos de inteligência artificial, quando aplicável;",
          "n8n — automação e orquestração de fluxos;",
          "Meta Platforms / WhatsApp — recursos relacionados à comunicação e publicidade, quando integrados;",
          "Evolution API e tecnologias associadas — integração de comunicação utilizada durante a atual fase de desenvolvimento, testes e transição tecnológica.",
        ],
      },
      {
        tipo: "paragrafo",
        texto:
          "Esses fornecedores poderão processar informações estritamente relacionadas aos serviços que prestam, de acordo com suas respectivas funções, contratos, políticas e medidas de segurança.",
      },
      {
        tipo: "paragrafo",
        texto:
          "A relação de fornecedores e tecnologias poderá mudar conforme a evolução da Helô, sempre buscando preservar a segurança e a proteção dos dados tratados.",
      },
    ],
  },
  {
    numero: 11,
    titulo: "Compartilhamento de dados",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "A Helô não comercializa dados pessoais de leads, pacientes ou usuários como produto.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Os dados poderão ser compartilhados ou processados por terceiros quando necessário para:",
      },
      {
        tipo: "lista",
        itens: [
          "fornecer as funcionalidades da plataforma;",
          "executar serviços contratados pelo cliente;",
          "manter infraestrutura tecnológica;",
          "processar comunicações;",
          "executar automações;",
          "fornecer recursos de inteligência artificial;",
          "realizar armazenamento e processamento de dados;",
          "garantir segurança e prevenção a fraudes;",
          "cumprir obrigações legais;",
          "atender determinações de autoridades competentes;",
          "proteger direitos da Helô, de seus clientes ou de terceiros.",
        ],
      },
      {
        tipo: "paragrafo",
        texto:
          "Quando a Helô atuar como Operadora em nome de uma empresa cliente, o tratamento e eventual compartilhamento também deverão observar as instruções legítimas do respectivo Controlador.",
      },
    ],
  },
  {
    numero: 12,
    titulo: "Transferência internacional de dados",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "Alguns fornecedores de tecnologia utilizados pela Helô poderão possuir infraestrutura, servidores, empresas afiliadas ou operações localizadas fora do Brasil.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Consequentemente, determinados dados poderão estar sujeitos a processamento ou armazenamento internacional, conforme a arquitetura dos serviços utilizados.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Quando aplicável, a Helô buscará observar os requisitos legais relacionados à transferência internacional de dados pessoais e utilizar fornecedores que ofereçam mecanismos adequados de proteção e segurança.",
      },
    ],
  },
  {
    numero: 13,
    titulo: "Armazenamento e retenção",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "Os dados pessoais serão mantidos pelo período necessário para cumprir as finalidades para as quais foram tratados, atender às obrigações contratuais, preservar registros necessários à prestação do serviço e cumprir obrigações legais ou regulatórias.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Quando a Helô atuar como Operadora, determinados períodos de retenção também poderão ser definidos pelo cliente Controlador, conforme sua relação com os titulares e suas obrigações legais.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Encerrada a necessidade de tratamento, os dados poderão ser eliminados, anonimizados ou mantidos quando houver fundamento legal que justifique sua conservação.",
      },
    ],
  },
  {
    numero: 14,
    titulo: "Segurança da informação",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "A Helô adota e busca aprimorar medidas técnicas e administrativas destinadas à proteção dos dados pessoais contra acessos não autorizados e situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou tratamento inadequado.",
      },
      {
        tipo: "paragrafo",
        texto: "Essas medidas podem incluir, conforme aplicável:",
      },
      {
        tipo: "lista",
        itens: [
          "controles de autenticação e acesso;",
          "segregação de permissões;",
          "proteção de credenciais;",
          "utilização de conexões seguras;",
          "registros técnicos e logs;",
          "mecanismos de banco de dados e infraestrutura com controles de segurança;",
          "limitação de acesso de acordo com a necessidade operacional;",
          "monitoramento e correção de vulnerabilidades identificadas.",
        ],
      },
      {
        tipo: "paragrafo",
        texto:
          "Nenhum sistema conectado à internet pode ser considerado absolutamente imune a incidentes. Caso ocorra um incidente relevante envolvendo dados pessoais, serão adotadas as medidas aplicáveis conforme a legislação e as circunstâncias do caso.",
      },
    ],
  },
  {
    numero: 15,
    titulo: "Direitos dos titulares",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "Nos termos da Lei Geral de Proteção de Dados Pessoais — LGPD (Lei nº 13.709/2018), o titular poderá exercer os direitos previstos na legislação, conforme aplicáveis ao respectivo tratamento.",
      },
      {
        tipo: "paragrafo",
        texto: "Esses direitos podem incluir, entre outros:",
      },
      {
        tipo: "lista",
        itens: [
          "confirmação da existência de tratamento;",
          "acesso aos dados pessoais;",
          "correção de dados incompletos, inexatos ou desatualizados;",
          "anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a legislação;",
          "portabilidade, quando aplicável e observada a regulamentação pertinente;",
          "informação sobre compartilhamento de dados;",
          "informação sobre a possibilidade de não fornecer consentimento e suas consequências, quando o consentimento for a base legal utilizada;",
          "revogação do consentimento, quando aplicável;",
          "eliminação dos dados tratados com fundamento no consentimento, observadas as hipóteses legais de conservação;",
          "oposição ao tratamento, nas hipóteses previstas em lei;",
          "demais direitos previstos na legislação aplicável.",
        ],
      },
    ],
  },
  {
    numero: 16,
    titulo: "Como exercer direitos ou solicitar exclusão de dados",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "Solicitações relacionadas a privacidade, acesso, correção, exclusão ou demais direitos relativos aos dados pessoais poderão ser encaminhadas para:",
      },
      {
        tipo: "dados",
        itens: [{ rotulo: "E-mail", valor: "contato@hervalmarketing.com" }],
      },
      {
        tipo: "paragrafo",
        texto:
          "Para proteger os dados contra solicitações fraudulentas, poderão ser solicitadas informações necessárias para confirmar a identidade do requerente.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Quando a Helô atuar exclusivamente como Operadora dos dados em nome de uma empresa cliente, determinadas solicitações poderão precisar ser direcionadas ao respectivo cliente Controlador ou encaminhadas a ele para que sejam adotadas as providências adequadas.",
      },
      {
        tipo: "paragrafo",
        texto:
          "A exclusão de dados não será necessariamente imediata ou absoluta quando a manutenção de determinadas informações for necessária ou permitida para cumprimento de obrigação legal ou regulatória, exercício regular de direitos, segurança, prevenção a fraudes ou outras hipóteses autorizadas pela legislação.",
      },
    ],
  },
  {
    numero: 17,
    titulo: "Clientes da Helô e responsabilidade pelo atendimento",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "As empresas e profissionais que utilizam a Helô são responsáveis por utilizar a plataforma de maneira compatível com a legislação aplicável, com as normas eventualmente aplicáveis às suas respectivas atividades profissionais e com as políticas dos serviços integrados.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Quando uma empresa ou profissional cliente utiliza a Helô para entrar em contato com seus leads, consumidores ou pacientes, cabe ao cliente observar as bases legais, deveres de transparência e demais requisitos aplicáveis à sua própria relação com esses titulares.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Também cabe ao cliente fornecer e configurar adequadamente as informações comerciais utilizadas pela Helô durante o atendimento, inclusive quando envolverem valores exatos, valores iniciais, faixas, referências ou estimativas relacionadas a consultas, avaliações, produtos, serviços, procedimentos ou tratamentos.",
      },
      {
        tipo: "paragrafo",
        texto:
          "A utilização da Helô não transfere automaticamente para a plataforma as responsabilidades legais, profissionais ou regulatórias próprias de cada cliente enquanto Controlador dos dados e responsável pelos produtos ou serviços oferecidos.",
      },
    ],
  },
  {
    numero: 18,
    titulo: "Comunicações e mensagens automatizadas",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "A Helô poderá ser utilizada por seus clientes para automatizar ou auxiliar comunicações comerciais e administrativas.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Essas comunicações poderão incluir, conforme configuração do cliente:",
      },
      {
        tipo: "lista",
        itens: [
          "respostas a contatos iniciados pelo usuário;",
          "continuidade de atendimentos;",
          "confirmações de agendamento;",
          "lembretes;",
          "reagendamentos;",
          "follow-ups;",
          "informações relacionadas a produtos, serviços, procedimentos ou tratamentos de interesse do usuário;",
          "informações comerciais, incluindo valores exatos, valores iniciais, faixas, referências ou estimativas, quando aplicável;",
          "informações relacionadas a valores de consultas ou avaliações;",
          "comunicação de meios de pagamento fornecidos diretamente pela clínica, estabelecimento ou profissional responsável, como chave PIX;",
          "continuidade do atendimento após o envio de comprovantes;",
          "confirmação de agendamentos após as etapas aplicáveis do atendimento.",
        ],
      },
      {
        tipo: "paragrafo",
        texto:
          "A natureza das informações comerciais comunicadas poderá variar conforme a empresa ou profissional cliente, a natureza do serviço oferecido, as configurações do atendimento e as regras aplicáveis à respectiva atividade profissional.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Quando determinado procedimento ou tratamento depender de avaliação individual, valores iniciais, faixas, referências ou estimativas eventualmente comunicados durante o atendimento não constituem, por si só, orçamento clínico individualizado, diagnóstico, prescrição ou definição da indicação do usuário.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Quando a Helô comunicar uma chave PIX ou outro meio de pagamento durante o atendimento, essa informação será fornecida pela empresa cliente ou profissional responsável pelo recebimento.",
      },
      {
        tipo: "paragrafo",
        texto:
          "A disponibilização dessas informações pela Helô não caracteriza intermediação financeira ou processamento de pagamento.",
      },
      {
        tipo: "paragrafo",
        texto:
          "O pagamento ocorre diretamente entre o usuário e a clínica, estabelecimento ou profissional responsável.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Nenhum valor destinado a consultas, avaliações, procedimentos, tratamentos, produtos ou serviços é recebido, custodiado, movimentado ou intermediado financeiramente pela Helô ou pela Herval Marketing.",
      },
      {
        tipo: "paragrafo",
        texto:
          "As empresas clientes são responsáveis por utilizar essas funcionalidades em conformidade com a legislação aplicável, com as regras aplicáveis às suas respectivas atividades e com as políticas dos canais de comunicação utilizados, inclusive regras relacionadas a consentimento, opt-in, modelos de mensagem e preferências de comunicação, quando aplicáveis.",
      },
    ],
  },
  {
    numero: 19,
    titulo: "Decisões automatizadas",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "A Helô utiliza recursos de automação e inteligência artificial para auxiliar e executar determinados processos de atendimento e operação comercial.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Esses recursos podem participar da interpretação de mensagens, seleção ou geração de respostas, organização de informações, comunicação de informações comerciais, execução de fluxos previamente configurados e realização de determinadas etapas operacionais do atendimento, incluindo ações relacionadas ao processo de agendamento.",
      },
      {
        tipo: "paragrafo",
        texto:
          "A Helô não se destina à tomada automatizada de decisões clínicas, realização de diagnóstico, prescrição ou definição de tratamentos.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Quando aplicável, questões relacionadas a decisões baseadas exclusivamente em tratamento automatizado serão tratadas de acordo com os direitos e requisitos previstos na legislação aplicável.",
      },
    ],
  },
  {
    numero: 20,
    titulo: "Cookies e tecnologias semelhantes",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "O site e a plataforma Helô poderão utilizar cookies, armazenamento local e tecnologias semelhantes quando necessários para autenticação, segurança, manutenção de sessão, preferências do usuário, funcionamento da aplicação e análise técnica.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Caso sejam implementadas tecnologias adicionais de rastreamento, publicidade ou analytics que exijam informações ou escolhas adicionais do usuário, esta Política e os mecanismos de consentimento aplicáveis poderão ser atualizados.",
      },
    ],
  },
  {
    numero: 21,
    titulo: "Links e serviços de terceiros",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "A plataforma poderá conter integrações, links ou funcionalidades fornecidas por terceiros.",
      },
      {
        tipo: "paragrafo",
        texto:
          "A utilização desses serviços também poderá estar sujeita aos termos e políticas de privacidade dos respectivos fornecedores.",
      },
      {
        tipo: "paragrafo",
        texto:
          "A Helô recomenda que os usuários e clientes consultem as políticas aplicáveis aos serviços externos que utilizarem.",
      },
    ],
  },
  {
    numero: 22,
    titulo: "Alterações desta Política",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "Esta Política de Privacidade poderá ser atualizada periodicamente para refletir:",
      },
      {
        tipo: "lista",
        itens: [
          "alterações nas funcionalidades da Helô;",
          "inclusão ou substituição de fornecedores;",
          "mudanças na arquitetura tecnológica;",
          "novas integrações;",
          "alterações regulatórias;",
          "aprimoramentos nas práticas de privacidade e segurança.",
        ],
      },
      {
        tipo: "paragrafo",
        texto:
          "A versão mais atual estará disponível nesta página, acompanhada da respectiva data de atualização.",
      },
      {
        tipo: "paragrafo",
        texto:
          "Quando uma alteração exigir comunicação adicional ou consentimento específico nos termos da legislação aplicável, serão adotadas as medidas correspondentes.",
      },
    ],
  },
  {
    numero: 23,
    titulo: "Legislação aplicável",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "Esta Política deverá ser interpretada de acordo com a legislação brasileira aplicável, especialmente a Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais (LGPD), sem prejuízo de outras normas aplicáveis às atividades realizadas pela Helô e por seus clientes.",
      },
    ],
  },
  {
    numero: 24,
    titulo: "Contato",
    blocos: [
      {
        tipo: "paragrafo",
        texto:
          "Para dúvidas, solicitações ou questões relacionadas a esta Política de Privacidade ou ao tratamento de dados pessoais pela Helô, entre em contato:",
      },
      {
        tipo: "dados",
        itens: [
          {
            rotulo: "Helô - Herval AI",
            valor: "Software desenvolvido pela Herval Marketing",
          },
          {
            rotulo: "Razão social",
            valor: "50 814 514 LAIS DE OLIVEIRA COSTA HERVAL",
          },
          { rotulo: "CNPJ", valor: "50.814.514/0001-59" },
          { rotulo: "E-mail", valor: "contato@hervalmarketing.com" },
        ],
      },
    ],
  },
];
