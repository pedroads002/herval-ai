export type TipoProfissional =
  | "Avaliador"
  | "Médico Esteta"
  | "Biomédico Esteticista"
  | "Enfermeiro Esteta"
  | "Esteticista";

export type Profissional = {
  id: number;
  nome: string;
  /** Conselho de classe conforme a formação: CRM, CRBM, COREN. */
  registro: string;
  tipo: TipoProfissional;
  /** Ids da tela de Especialidades. Um profissional pode atender várias. */
  especialidadeIds: number[];
  /**
   * Clínicas em que este profissional atende. É lista, e não um id só, porque
   * médico esteta alugar sala em mais de uma clínica é comum no mercado — e
   * porque os agendamentos já registravam isso antes de o campo existir.
   */
  clinicaIds: number[];
};

// Dados de exemplo. Ainda não vêm de banco nem de API.
export const profissionaisIniciais: Profissional[] = [
  {
    id: 1,
    nome: "Dr. Otávio Lins",
    registro: "CRM-RS 34.221",
    tipo: "Avaliador",
    // O avaliador recebe o lead na primeira consulta e encaminha internamente.
    especialidadeIds: [1, 2, 3, 4, 5, 6],
    clinicaIds: [1, 6, 7],
  },
  {
    id: 2,
    nome: "Dra. Camila Rocha",
    registro: "CRM-RS 41.907",
    tipo: "Médico Esteta",
    especialidadeIds: [1, 2, 3],
    clinicaIds: [3, 5],
  },
  {
    id: 3,
    nome: "Dr. Rafael Menezes",
    registro: "CRM-RS 29.315",
    tipo: "Médico Esteta",
    especialidadeIds: [1, 3, 4],
    clinicaIds: [2, 10],
  },
  {
    id: 4,
    nome: "Dra. Bianca Toledo",
    registro: "CRBM-RS 8.640",
    tipo: "Biomédico Esteticista",
    especialidadeIds: [2, 3, 4],
    clinicaIds: [3, 4],
  },
  {
    id: 5,
    nome: "Marina Cardoso",
    registro: "Téc. em Estética",
    tipo: "Esteticista",
    especialidadeIds: [5, 6],
    clinicaIds: [2, 7],
  },
  {
    id: 6,
    nome: "Henrique Sales",
    registro: "COREN-RS 512.118",
    tipo: "Enfermeiro Esteta",
    especialidadeIds: [3, 5, 6],
    clinicaIds: [9],
  },
  {
    id: 7,
    nome: "Dra. Helena Braga",
    registro: "CRM-RS 38.104",
    tipo: "Médico Esteta",
    especialidadeIds: [1, 2, 3],
    clinicaIds: [6],
  },
  {
    id: 8,
    nome: "Dra. Renata Bulhões",
    registro: "CRM-RS 44.520",
    tipo: "Médico Esteta",
    especialidadeIds: [1, 2, 3],
    clinicaIds: [1],
  },
  {
    id: 9,
    nome: "Juliana Kroeff",
    registro: "CRBM-RS 9.117",
    tipo: "Biomédico Esteticista",
    especialidadeIds: [2, 3, 5],
    clinicaIds: [1],
  },
  {
    id: 10,
    nome: "Rodrigo Balbinot",
    registro: "CRBM-RS 7.902",
    tipo: "Biomédico Esteticista",
    especialidadeIds: [2, 3, 4],
    clinicaIds: [5],
  },
  {
    id: 11,
    nome: "Dra. Vivian Lacerda",
    registro: "CRM-RS 40.338",
    tipo: "Médico Esteta",
    especialidadeIds: [1, 3, 4],
    clinicaIds: [4, 5],
  },
  {
    id: 12,
    nome: "Tatiane Vargas",
    registro: "Téc. em Estética",
    tipo: "Esteticista",
    especialidadeIds: [5],
    clinicaIds: [7],
  },
  {
    id: 13,
    nome: "Dr. Márcio Deppe",
    registro: "CRM-RS 31.776",
    tipo: "Médico Esteta",
    especialidadeIds: [1, 2, 4],
    clinicaIds: [8],
  },
  {
    id: 14,
    nome: "Camila Speck",
    registro: "COREN-SC 318.440",
    tipo: "Enfermeiro Esteta",
    especialidadeIds: [3, 5],
    clinicaIds: [11],
  },
  {
    id: 15,
    nome: "Dra. Patrícia Vasques",
    registro: "CRM-SC 22.905",
    tipo: "Médico Esteta",
    especialidadeIds: [1, 2, 3],
    clinicaIds: [9],
  },
  {
    id: 16,
    nome: "Dr. Leonardo Fiuza",
    registro: "CRM-SC 19.482",
    tipo: "Médico Esteta",
    especialidadeIds: [1, 2, 4],
    clinicaIds: [9, 10],
  },
  {
    id: 17,
    nome: "Fernanda Ourique",
    registro: "Téc. em Estética",
    tipo: "Esteticista",
    especialidadeIds: [5],
    clinicaIds: [9],
  },
  {
    id: 18,
    nome: "Dra. Aline Petry",
    registro: "CRM-SC 25.613",
    tipo: "Médico Esteta",
    especialidadeIds: [1, 3],
    clinicaIds: [11],
  },
  {
    id: 19,
    nome: "Simone Kirchner",
    registro: "Téc. em Estética",
    tipo: "Esteticista",
    especialidadeIds: [5],
    clinicaIds: [3],
  },
  {
    id: 20,
    nome: "Dr. Gustavo Zanetti",
    registro: "CRM-PR 27.084",
    tipo: "Médico Esteta",
    especialidadeIds: [1, 3],
    // Cliente com contrato pausado: a equipe continua cadastrada.
    clinicaIds: [12],
  },
];

/**
 * Quem atende uma especialidade. A ligação mora só na lista de profissionais,
 * então as duas telas nunca discordam entre si.
 */
export function profissionaisDaEspecialidade(especialidadeId: number) {
  return profissionaisIniciais.filter((p) =>
    p.especialidadeIds.includes(especialidadeId),
  );
}

/** A equipe de uma clínica. */
export function profissionaisDaClinica(clinicaId: number) {
  return profissionaisIniciais.filter((p) => p.clinicaIds.includes(clinicaId));
}

/**
 * Quem pode atender esta especialidade nesta clínica — o cruzamento que o
 * formulário de agendamento precisa fazer para não oferecer um profissional
 * que não trabalha ali.
 */
export function profissionaisDisponiveis(
  clinicaId: number,
  especialidadeId: number,
) {
  return profissionaisIniciais.filter(
    (p) =>
      p.clinicaIds.includes(clinicaId) &&
      p.especialidadeIds.includes(especialidadeId),
  );
}
