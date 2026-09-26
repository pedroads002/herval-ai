"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Gravar uma nota de voz pelo navegador, como no WhatsApp.
 *
 * Existe porque anexar arquivo não resolve o caso real: o CRC está no meio de
 * uma conversa e precisa responder falando, não procurar um .ogg no
 * computador. O áudio gravado sai daqui como um `File` comum e segue pelo
 * mesmo caminho do anexo — base64, limite de tamanho, `send-audio`. Nenhum
 * segundo caminho de envio.
 */

/**
 * Formatos que o gravador pode produzir, do melhor para o pior.
 *
 * Ogg/Opus primeiro porque é o que o WhatsApp usa em nota de voz — é o que
 * tem mais chance de chegar como áudio tocável, e não como arquivo anexo.
 * Mas quem decide é o navegador: o Chrome só grava webm, o Firefox grava ogg,
 * o Safari grava mp4. Pedimos o melhor e aceitamos o que vier.
 */
const FORMATOS_PREFERIDOS = [
  "audio/ogg;codecs=opus",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

const EXTENSOES: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
};

function extensaoDe(tipo: string) {
  const base = tipo.split(";")[0].trim();
  return EXTENSOES[base] ?? "ogg";
}

function melhorFormato() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const formato of FORMATOS_PREFERIDOS) {
    if (MediaRecorder.isTypeSupported(formato)) return formato;
  }
  // Vazio deixa o navegador escolher sozinho, em vez de falhar.
  return "";
}

/**
 * Teto de duração.
 *
 * Não é sobre tamanho — opus a 24 kbps gasta uns 3 KB por segundo, então o
 * limite de 3 MB do envio só chegaria perto dos quinze minutos. É sobre o
 * gravador ficar aberto por esquecimento: o microfone ligado e a luzinha
 * acesa, com o CRC achando que já parou.
 */
export const DURACAO_MAXIMA = 5 * 60;

export type EstadoDaGravacao = "indisponivel" | "parado" | "gravando";

export function useGravadorDeAudio({
  aoTerminar,
  aoFalhar,
}: {
  aoTerminar: (audio: File) => void;
  aoFalhar: (motivo: string) => void;
}) {
  const [estado, setEstado] = useState<EstadoDaGravacao>("parado");
  const [segundos, setSegundos] = useState(0);

  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const microfone = useRef<MediaStream | null>(null);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Desliga o microfone de verdade.
   *
   * Sem parar cada trilha, o navegador continua mostrando que a página está
   * gravando mesmo depois de terminar — e continua gravando de fato. É o tipo
   * de coisa que não aparece em teste e aparece na cara do usuário.
   */
  const soltarMicrofone = useCallback(() => {
    microfone.current?.getTracks().forEach((trilha) => trilha.stop());
    microfone.current = null;
    if (relogio.current) {
      clearInterval(relogio.current);
      relogio.current = null;
    }
  }, []);

  // Sair da tela no meio de uma gravação não pode deixar o microfone ligado.
  useEffect(() => soltarMicrofone, [soltarMicrofone]);

  const parar = useCallback(() => {
    if (gravador.current?.state === "recording") gravador.current.stop();
  }, []);

  const gravar = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setEstado("indisponivel");
      aoFalhar("Este navegador não permite gravar áudio.");
      return;
    }

    let trilhas: MediaStream;
    try {
      trilhas = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Recusar o microfone é escolha legítima de quem está usando, não erro
      // do sistema — por isso o texto explica onde mudar, sem alarmar.
      aoFalhar(
        "O navegador não liberou o microfone. Autorize nas permissões do site para gravar.",
      );
      return;
    }

    microfone.current = trilhas;
    pedacos.current = [];

    const formato = melhorFormato();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(
        trilhas,
        formato ? { mimeType: formato } : undefined,
      );
    } catch {
      soltarMicrofone();
      aoFalhar("Este navegador não conseguiu iniciar a gravação.");
      return;
    }

    gravador.current = recorder;

    recorder.ondataavailable = (evento) => {
      if (evento.data.size > 0) pedacos.current.push(evento.data);
    };

    recorder.onstop = () => {
      soltarMicrofone();
      setEstado("parado");

      // O tipo real vem do gravador, e não do que pedimos: o navegador pode
      // ter escolhido outro, e o nome do arquivo precisa combinar com o
      // conteúdo para o resto do caminho reconhecer que é áudio.
      const tipo = recorder.mimeType || formato || "audio/webm";
      const blob = new Blob(pedacos.current, { type: tipo });
      pedacos.current = [];

      if (blob.size === 0) {
        aoFalhar("A gravação saiu vazia. Tente de novo.");
        return;
      }

      const carimbo = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-");
      aoTerminar(
        new File([blob], `audio-${carimbo}.${extensaoDe(tipo)}`, { type: tipo }),
      );
    };

    recorder.start();
    setEstado("gravando");
    setSegundos(0);

    relogio.current = setInterval(() => {
      setSegundos((passados) => {
        const agora = passados + 1;
        if (agora >= DURACAO_MAXIMA) parar();
        return agora;
      });
    }, 1000);
  }, [aoFalhar, aoTerminar, parar, soltarMicrofone]);

  return { estado, segundos, gravar, parar };
}

/** "0:07", "1:23" — a contagem que aparece enquanto grava. */
export function duracaoEmMinutos(segundos: number) {
  const minutos = Math.floor(segundos / 60);
  return `${minutos}:${String(segundos % 60).padStart(2, "0")}`;
}
