"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  agendamentosIniciais,
  etapaPorStatus,
  type Agendamento,
  type StatusAgendamento,
} from "@/data/agendamentos";
import {
  ETAPA_AGENDADO,
  ETAPA_GANHA,
  ETAPA_PERDIDA,
  type EtapaFunil,
  type MotivoPerda,
} from "@/data/leads";
import { tarefasIniciais, type StatusTarefa, type Tarefa } from "@/data/tarefas";
import {
  AGENTE_AUTOMATICO,
  historicoDeEtapasInicial,
  type Agente,
  type MudancaDeEtapa,
} from "@/data/historicoEtapas";

/** O que o CRC precisa informar quando move o lead à mão. */
export type DadosDaMovimentacao = {
  motivoPerda?: MotivoPerda;
  valorVenda?: number;
};

/** Horário e profissional definidos na Agenda. */
export type DadosDaConsulta = {
  profissionalId: number;
  especialidadeId: number;
  /** Dias até a consulta, no mesmo formato do agendamento. */
  consultaEmDias: number;
  hora: string;
};

type ValorContexto = {
  tarefas: Tarefa[];
  agendamentos: Agendamento[];
  historicoDeEtapas: MudancaDeEtapa[];
  definirStatus: (id: number, status: StatusTarefa) => void;
  moverEtapa: (
    id: number,
    etapa: EtapaFunil,
    dados?: DadosDaMovimentacao,
  ) => void;
  /** Marca o desfecho da consulta. O lead se move sozinho conforme a regra. */
  definirStatusDoAgendamento: (
    agendamentoId: number,
    status: StatusAgendamento,
  ) => void;
  /** Marca ou remarca a consulta de um lead. */
  definirConsulta: (leadId: number, dados: DadosDaConsulta) => void;
};

const ContextoLeads = createContext<ValorContexto | null>(null);

/**
 * Guarda a base compartilhada pelas telas de dentro do painel: os leads da fila
 * e os agendamentos. É assim que mover um card no Funil aparece na hora na Fila
 * de Tarefas, e que marcar uma falta na Agenda empurra o lead para
 * "Reagendamento" sem ninguém arrastar nada.
 *
 * Continua sendo só memória do navegador: nada é enviado nem salvo, e ao
 * recarregar a página tudo volta ao estado inicial.
 */
export default function ProvedorLeads({
  usuario,
  children,
}: {
  /** Nome de quem está logado, vindo de `perfil.ts`. Assina as ações manuais. */
  usuario?: string;
  children: React.ReactNode;
}) {
  const [tarefas, setTarefas] = useState<Tarefa[]>(tarefasIniciais);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>(
    agendamentosIniciais,
  );
  const [historicoDeEtapas, setHistoricoDeEtapas] = useState<MudancaDeEtapa[]>(
    historicoDeEtapasInicial,
  );

  /**
   * Quem move o card na mão é o usuário autenticado. Não há cadastro de agente
   * à parte: o login já é a identidade, e duplicar isso criaria duas versões da
   * mesma pessoa. Sem sessão (o exemplo aberto), fica só "Humano".
   */
  const agenteHumano = useMemo<Agente>(
    () => ({ tipo: "Humano", ...(usuario ? { nome: usuario } : {}) }),
    [usuario],
  );

  const definirStatus = useCallback((id: number, status: StatusTarefa) => {
    setTarefas((atuais) =>
      atuais.map((tarefa) =>
        tarefa.id === id ? { ...tarefa, status } : tarefa,
      ),
    );
  }, []);

  /**
   * Grava a mudança de etapa. Sem isto a base só sabe onde o lead está agora,
   * e não quando ele chegou lá — que é a pergunta de qualquer medida de tempo
   * de resposta.
   */
  const registrar = useCallback(
    (
      leadId: number,
      etapaAnterior: EtapaFunil | null,
      etapaNova: EtapaFunil,
      agente: Agente,
    ) => {
      setHistoricoDeEtapas((atuais) => [
        ...atuais,
        {
          id: Math.max(0, ...atuais.map((m) => m.id)) + 1,
          leadId,
          etapaAnterior,
          etapaNova,
          minutosAtras: 0,
          agente,
        },
      ]);
    },
    [],
  );

  /**
   * Aplica a etapa no lead. `dados` só vem quando o CRC move à mão para uma
   * etapa que exige informação; o sistema, movendo sozinho, nunca precisa.
   */
  const aplicarEtapa = useCallback(
    (
      id: number,
      etapa: EtapaFunil,
      dados?: DadosDaMovimentacao,
      agente: Agente = AGENTE_AUTOMATICO,
    ) => {
      // A etapa de origem sai da lista atual, e não de dentro do setState: a
      // função de atualização não roda na hora.
      const anterior = tarefas.find((t) => t.id === id)?.etapa ?? null;
      if (anterior === etapa) return;

      setTarefas((atuais) =>
        atuais.map((tarefa) => {
          if (tarefa.id !== id) return tarefa;
          // Motivo e valor só existem enquanto o lead está na etapa que os
          // pede; sair de lá limpa o campo para não sobrar dado sem sentido.
          const { motivoPerda: _m, valorVenda: _v, ...resto } = tarefa;
          return {
            ...resto,
            etapa,
            ...(etapa === ETAPA_PERDIDA && dados?.motivoPerda
              ? { motivoPerda: dados.motivoPerda }
              : {}),
            ...(etapa === ETAPA_GANHA && dados?.valorVenda !== undefined
              ? { valorVenda: dados.valorVenda }
              : {}),
          };
        }),
      );

      registrar(id, anterior, etapa, agente);
    },
    [tarefas, registrar],
  );

  const moverEtapa = useCallback(
    (id: number, etapa: EtapaFunil, dados?: DadosDaMovimentacao) =>
      // Movimento manual: quem assina é o usuário logado.
      aplicarEtapa(id, etapa, dados, agenteHumano),
    [aplicarEtapa, agenteHumano],
  );

  const definirStatusDoAgendamento = useCallback(
    (agendamentoId: number, status: StatusAgendamento) => {
      // O lead sai da lista atual, e não de dentro do setState: a função de
      // atualização não roda na hora, então ler o valor de lá não é confiável.
      const alvo = agendamentos.find((a) => a.id === agendamentoId);
      if (!alvo) return;

      setAgendamentos((atuais) =>
        atuais.map((agendamento) =>
          agendamento.id === agendamentoId
            ? { ...agendamento, status }
            : agendamento,
        ),
      );

      // Regra automática: o desfecho da consulta manda o lead de etapa.
      const destino = etapaPorStatus(status);
      if (destino) aplicarEtapa(alvo.leadId, destino);
    },
    [agendamentos, aplicarEtapa],
  );

  const definirConsulta = useCallback(
    (leadId: number, dados: DadosDaConsulta) => {
      // Decidido sobre a lista atual, não dentro do setState, pelo mesmo motivo.
      const emAberto = agendamentos.find(
        (a) =>
          a.leadId === leadId &&
          (a.status === "Agendada" || a.status === "Faltou"),
      );
      // Remarcação é dar data nova a quem faltou; a primeira marcação não é.
      const remarcou = emAberto?.status === "Faltou";

      setAgendamentos((atuais) => {
        // Só corrigir o dia de uma consulta que continua de pé altera a linha
        // existente. Remarcar é outro ato: a falta continua registrada e nasce
        // um agendamento novo, senão o trabalho de remarcar sumiria da
        // produção, que conta pelo ato de agendar.
        if (emAberto && !remarcou) {
          return atuais.map((a) =>
            a.id === emAberto.id
              ? {
                  ...a,
                  ...dados,
                  status: "Agendada" as const,
                  criadoHaDias: 0,
                  confirmada: false,
                }
              : a,
          );
        }

        const lead = tarefas.find((t) => t.id === leadId);
        const proximoId = Math.max(0, ...atuais.map((a) => a.id)) + 1;
        return [
          ...atuais,
          {
            id: proximoId,
            leadId,
            clinicaId: emAberto?.clinicaId ?? lead?.clinicaId ?? 0,
            criadoHaDias: 0,
            status: "Agendada" as const,
            fechadoPor: "CRC" as const,
            valorOrcamento: null,
            confirmada: false,
            ...dados,
          },
        ];
      });

      // Remarcação efetivada: guarda a contagem e devolve o lead para agendado.
      const anterior = tarefas.find((t) => t.id === leadId)?.etapa ?? null;

      setTarefas((atuais) =>
        atuais.map((tarefa) =>
          tarefa.id === leadId
            ? {
                ...tarefa,
                etapa: ETAPA_AGENDADO,
                ...(remarcou
                  ? { remarcacoes: (tarefa.remarcacoes ?? 0) + 1 }
                  : {}),
              }
            : tarefa,
        ),
      );

      // Marcar a consulta é ato de quem está na Agenda; a etapa vem junto.
      if (anterior !== ETAPA_AGENDADO) {
        registrar(leadId, anterior, ETAPA_AGENDADO, agenteHumano);
      }
    },
    [agendamentos, tarefas, registrar, agenteHumano],
  );

  const valor = useMemo(
    () => ({
      tarefas,
      agendamentos,
      historicoDeEtapas,
      definirStatus,
      moverEtapa,
      definirStatusDoAgendamento,
      definirConsulta,
    }),
    [
      tarefas,
      agendamentos,
      historicoDeEtapas,
      definirStatus,
      moverEtapa,
      definirStatusDoAgendamento,
      definirConsulta,
    ],
  );

  return (
    <ContextoLeads.Provider value={valor}>{children}</ContextoLeads.Provider>
  );
}

export function useLeads() {
  const valor = useContext(ContextoLeads);
  if (!valor) {
    throw new Error("useLeads precisa estar dentro de ProvedorLeads.");
  }
  return valor;
}
