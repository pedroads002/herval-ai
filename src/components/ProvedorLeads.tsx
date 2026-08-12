"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  tarefasIniciais,
  type EtapaFunil,
  type MotivoPerda,
  type StatusTarefa,
  type Tarefa,
} from "@/data/tarefas";

type ValorContexto = {
  tarefas: Tarefa[];
  definirStatus: (id: number, status: StatusTarefa) => void;
  moverEtapa: (id: number, etapa: EtapaFunil, motivo?: MotivoPerda) => void;
};

const ContextoLeads = createContext<ValorContexto | null>(null);

/**
 * Guarda a base de leads em um único lugar, compartilhado pelas telas de
 * dentro do painel. É assim que mover um card no Funil aparece na hora na
 * Fila de Tarefas e nos Motivos de perda da Visão Geral.
 *
 * Continua sendo só memória do navegador: nada é enviado nem salvo, e ao
 * recarregar a página tudo volta ao estado inicial.
 */
export default function ProvedorLeads({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tarefas, setTarefas] = useState<Tarefa[]>(tarefasIniciais);

  const definirStatus = useCallback((id: number, status: StatusTarefa) => {
    setTarefas((atuais) =>
      atuais.map((tarefa) =>
        tarefa.id === id ? { ...tarefa, status } : tarefa,
      ),
    );
  }, []);

  const moverEtapa = useCallback(
    (id: number, etapa: EtapaFunil, motivo?: MotivoPerda) => {
      setTarefas((atuais) =>
        atuais.map((tarefa) => {
          if (tarefa.id !== id) return tarefa;
          // O motivo só existe enquanto o lead está em Venda Perdida; sair de
          // lá limpa o campo para não sobrar dado sem sentido.
          const { motivoPerda: _antigo, ...resto } = tarefa;
          return etapa === "Venda Perdida"
            ? { ...resto, etapa, motivoPerda: motivo }
            : { ...resto, etapa };
        }),
      );
    },
    [],
  );

  const valor = useMemo(
    () => ({ tarefas, definirStatus, moverEtapa }),
    [tarefas, definirStatus, moverEtapa],
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
