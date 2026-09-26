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

// Vazio de propósito: o conteúdo de exemplo saiu, a estrutura ficou.
// Quando esta tela passar a ler o banco, é este array que some.
export const profissionaisIniciais: Profissional[] = [];

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
