/**
 * O adaptador entre `lead_etapa_eventos` e o `HistoricoDeEtapas` que
 * `lib/atendimento.ts` já consome.
 *
 * Mesma regra das fases anteriores: o adaptador traduz, a conta não muda.
 * `chegadaDoLead`, `primeiroContato`, `minutosAteOPrimeiroContato` e
 * `aguardandoContato` continuam exatamente como estão — inclusive a definição
 * oficial de primeiro contato, que é a entrada na etapa "Em Contato".
 *
 * Duas coisas que o banco impõe e que valem explicação:
 *
 * 1. **A chegada do lead não está em `lead_etapa_eventos`.** Aquela tabela
 *    guarda mudança de etapa, e a primeira linha de um lead já é uma mudança
 *    (hoje, no lead 29, "Agendamento → Venda Perdida"). Tomar essa linha como
 *    chegada diria que o lead nasceu em Agendamento, horas depois de existir, e
 *    todo tempo de espera sairia encurtado. A chegada vem de `leads.criado_em`,
 *    que é o dado exato, e a etapa dessa linha sintética é o `de_etapa` da
 *    primeira mudança — a etapa em que o lead estava antes de qualquer mexida.
 *
 * 2. **`minutosAtras` é em minutos, contra o instante de agora**, e não contra
 *    a meia-noite de hoje: é isso que a convenção de `lib/tempo.ts` e as faixas
 *    de espera exigem. Por isso a conversão acontece na tela, com o relógio de
 *    quem abre o painel, e não no servidor — o mesmo motivo já documentado em
 *    `lib/relatorios/doBanco.ts`.
 */
import { etapasFunil, type EtapaFunil } from "@/data/leads";
import {
  AGENTE_AUTOMATICO,
  type Agente,
  type MudancaDeEtapa,
} from "@/data/historicoEtapas";

export type LinhaDeEventoDeEtapaDoBanco = {
  id: number;
  lead_id: number;
  de_etapa: string | null;
  para_etapa: string;
  autor_nome: string | null;
  criado_em: string;
};

/** O que o histórico precisa do lead: quando chegou e onde está agora. */
export type LinhaDeLeadParaHistorico = {
  id: number;
  etapa: string;
  criado_em: string;
};

export type HistoricoDoBanco = {
  historico: Map<number, MudancaDeEtapa[]>;
  desconhecidos: { etapas: string[] };
};

const UM_MINUTO = 60 * 1000;

/**
 * Nunca negativo: evento gravado um segundo adiante do relógio de quem olha
 * apareceria como espera negativa, e `minutosAtras` conta para trás por
 * definição.
 */
function minutosAtrasDe(texto: string, agora: Date) {
  const quando = new Date(texto).getTime();
  if (!Number.isFinite(quando)) return 0;
  return Math.max(0, Math.round((agora.getTime() - quando) / UM_MINUTO));
}

function etapaConhecida(nome: string | null): EtapaFunil | null {
  if (nome === null) return null;
  return etapasFunil.find((etapa) => etapa === nome) ?? null;
}

/**
 * Quem executou a mudança.
 *
 * `lead_etapa_eventos` guarda o autor (`autor_nome`), e não o tipo de agente
 * que `TipoAgente` descreve. Quem move card no painel é pessoa logada, então
 * linha com autor é "Humano" com o nome que a tabela gravou; linha sem autor
 * ficou sem quem assumir e é lida como ação do sistema.
 *
 * Nenhuma conta de `atendimento.ts` lê este campo — ele existe porque o tipo
 * `MudancaDeEtapa` pede. Ou seja: não entra em número nenhum da tela. No dia em
 * que entrar, a tabela precisa de uma coluna de tipo de agente, e não de um
 * palpite aqui.
 */
function agenteDo(autor: string | null): Agente {
  const nome = (autor ?? "").trim();
  return nome === "" ? AGENTE_AUTOMATICO : { tipo: "Humano", nome };
}

/**
 * Monta o histórico por lead, já no formato indexado que as contas preferem.
 *
 * Etapa fora do funil derruba só aquela mudança, e fica no aviso: a corrente
 * continua coerente porque a etapa anterior de cada linha vem da linha anterior
 * que ficou, e não do texto do banco.
 */
export function montarHistoricoDoBanco(
  leads: LinhaDeLeadParaHistorico[],
  eventos: LinhaDeEventoDeEtapaDoBanco[],
  agora: Date,
): HistoricoDoBanco {
  const etapas = new Set<string>();

  const porLead = new Map<number, LinhaDeEventoDeEtapaDoBanco[]>();
  for (const evento of eventos) {
    const lista = porLead.get(evento.lead_id);
    if (lista) lista.push(evento);
    else porLead.set(evento.lead_id, [evento]);
  }

  const historico = new Map<number, MudancaDeEtapa[]>();
  let proximoId = 1;

  for (const lead of leads) {
    // Do mais antigo para o mais novo. O `id` desempata: no banco há duas
    // mudanças do mesmo lead gravadas no mesmo instante, e sem desempate a
    // ordem delas seria sorteio.
    const meus = [...(porLead.get(lead.id) ?? [])].sort(
      (a, b) =>
        new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime() ||
        a.id - b.id,
    );

    const primeiro = meus[0];
    // Onde o lead estava antes de qualquer mudança. Sem mudança nenhuma, é onde
    // ele ainda está.
    const etapaDeEntrada =
      etapaConhecida(primeiro?.de_etapa ?? null) ??
      etapaConhecida(primeiro?.para_etapa ?? null) ??
      etapaConhecida(lead.etapa);

    if (etapaDeEntrada === null) {
      // Sem etapa de entrada reconhecida não há chegada, e sem chegada nenhuma
      // conta de espera existe para este lead.
      etapas.add(lead.etapa);
      continue;
    }

    const linhas: MudancaDeEtapa[] = [
      {
        id: proximoId++,
        leadId: lead.id,
        etapaAnterior: null,
        etapaNova: etapaDeEntrada,
        minutosAtras: minutosAtrasDe(lead.criado_em, agora),
        agente: AGENTE_AUTOMATICO,
      },
    ];

    for (const evento of meus) {
      const destino = etapaConhecida(evento.para_etapa);
      if (destino === null) {
        etapas.add(evento.para_etapa);
        continue;
      }

      linhas.push({
        id: proximoId++,
        leadId: lead.id,
        etapaAnterior: linhas[linhas.length - 1].etapaNova,
        etapaNova: destino,
        minutosAtras: minutosAtrasDe(evento.criado_em, agora),
        agente: agenteDo(evento.autor_nome),
      });
    }

    historico.set(lead.id, linhas);
  }

  return { historico, desconhecidos: { etapas: [...etapas] } };
}

/** O aviso de mudança que o funil não sabe desenhar. */
export function avisoDoHistorico(
  desconhecidos: HistoricoDoBanco["desconhecidos"],
): string | null {
  if (desconhecidos.etapas.length === 0) return null;
  const lista = desconhecidos.etapas.map((valor) => `"${valor}"`).join(", ");
  return `Há mudança de etapa para etapa que o funil não tem: ${lista}. Essas mudanças ficaram fora das contas de espera.`;
}
