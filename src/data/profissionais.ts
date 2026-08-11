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
  },
  {
    id: 2,
    nome: "Dra. Camila Rocha",
    registro: "CRM-RS 41.907",
    tipo: "Médico Esteta",
    especialidadeIds: [1, 2, 3],
  },
  {
    id: 3,
    nome: "Dr. Rafael Menezes",
    registro: "CRM-RS 29.315",
    tipo: "Médico Esteta",
    especialidadeIds: [1, 3, 4],
  },
  {
    id: 4,
    nome: "Dra. Bianca Toledo",
    registro: "CRBM-RS 8.640",
    tipo: "Biomédico Esteticista",
    especialidadeIds: [2, 3, 4],
  },
  {
    id: 5,
    nome: "Marina Cardoso",
    registro: "Téc. em Estética",
    tipo: "Esteticista",
    especialidadeIds: [5, 6],
  },
  {
    id: 6,
    nome: "Henrique Sales",
    registro: "COREN-RS 512.118",
    tipo: "Enfermeiro Esteta",
    especialidadeIds: [3, 5, 6],
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
