"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Recarrega os dados da tela de tempos em tempos, sem a pessoa pedir.
 *
 * Existe porque o painel não tinha nada disso: mensagem nova só aparecia se o
 * CRC apertasse F5. Para ler relatório isso serve; para atender, não — quem
 * está do outro lado espera resposta, e ninguém fica recarregando a página
 * para descobrir se foi respondido.
 *
 * É `router.refresh()`, e não um `fetch` próprio: a busca continua morando no
 * componente de servidor, com a sessão e a RLS valendo como valem. Um segundo
 * caminho de leitura no navegador seria outra cópia da mesma regra, livre para
 * discordar da primeira.
 *
 * O rascunho não se perde: `refresh` troca o que veio do servidor e preserva o
 * estado dos componentes de cliente, então o texto meio digitado continua lá.
 *
 * Por que 10 segundos e não tempo real: o Supabase tem Realtime e é para lá
 * que isso deve ir. Mas Realtime é conexão viva, reconexão, assinatura por
 * tabela — e o que resolve o problema do CRC hoje é a tela não ficar parada.
 * Dez segundos resolve isso com uma peça que não tem como quebrar em
 * produção. A troca fica para depois da estreia.
 */
export default function AtualizacaoAutomatica({
  intervaloEmSegundos = 10,
}: {
  intervaloEmSegundos?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const intervalo = setInterval(() => {
      // Aba escondida não precisa de dado novo: recarregar aqui gastaria
      // banco e bateria de todo mundo que deixa o painel aberto num canto.
      // Ao voltar para a aba, o efeito abaixo atualiza na hora.
      if (document.hidden) return;
      router.refresh();
    }, intervaloEmSegundos * 1000);

    // Voltar para a aba é o momento em que a tela está mais desatualizada e a
    // pessoa mais quer olhar. Esperar o próximo tique seria mostrar o passado
    // justamente para quem acabou de chegar.
    const aoVoltar = () => {
      if (!document.hidden) router.refresh();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [router, intervaloEmSegundos]);

  return null;
}
