/**
 * Clientes da agência. Cada cliente aparece como uma linha nos relatórios.
 *
 * O nome "clínica" é o que a equipe usa no dia a dia, mas o cadastro é do
 * cliente: ele pode ter uma unidade, dezenas, ou nenhuma ainda (quem está
 * começando e atende em espaço alugado ou a domicílio).
 */
export type Clinica = {
  id: number;
  nome: string;
  cidade: string;
  /** Quantas unidades físicas. Zero é válido: cliente sem clínica própria. */
  unidades: number;
  /** Cliente pausado continua no cadastro, mas fora da operação. */
  ativa: boolean;
};

// Dados de exemplo. Ainda não vêm de banco nem de API.
export const clinicasIniciais: Clinica[] = [
  { id: 1, nome: "Clínica Bella Face", cidade: "Porto Alegre/RS", unidades: 3, ativa: true },
  { id: 2, nome: "Instituto Renove", cidade: "Porto Alegre/RS", unidades: 1, ativa: true },
  { id: 3, nome: "Studio Lumina", cidade: "Canoas/RS", unidades: 2, ativa: true },
  { id: 4, nome: "Espaço Vitta", cidade: "Novo Hamburgo/RS", unidades: 1, ativa: true },
  { id: 5, nome: "Clínica Arte & Estética", cidade: "Caxias do Sul/RS", unidades: 4, ativa: true },
  { id: 6, nome: "Dra. Helena Braga", cidade: "Pelotas/RS", unidades: 0, ativa: true },
  { id: 7, nome: "Nova Pele", cidade: "Santa Maria/RS", unidades: 1, ativa: true },
  { id: 8, nome: "Clínica Aurora", cidade: "Gramado/RS", unidades: 1, ativa: true },
  { id: 9, nome: "Corpus Harmonia", cidade: "Florianópolis/SC", unidades: 6, ativa: true },
  { id: 10, nome: "Belle Époque", cidade: "Curitiba/PR", unidades: 2, ativa: true },
  // Entrou agora: cadastrada, sem campanha rodando ainda.
  { id: 11, nome: "Clínica Semprebom", cidade: "Blumenau/SC", unidades: 1, ativa: true },
  // Contrato pausado: fica no cadastro para o histórico não sumir.
  { id: 12, nome: "Estética Viva", cidade: "Londrina/PR", unidades: 2, ativa: false },
];

export function clinicaPorId(id: number) {
  return clinicasIniciais.find((c) => c.id === id);
}

/** Nome da clínica, com um rótulo seguro caso o id não exista mais. */
export function nomeDaClinica(id: number) {
  return clinicaPorId(id)?.nome ?? "Clínica removida";
}
