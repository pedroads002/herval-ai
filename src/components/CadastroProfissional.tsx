"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, Building2, Check, Plus, UserPlus, X } from "lucide-react";
import {
  cadastrarCliente,
  cadastrarProfissional,
} from "@/lib/acoes/profissionais";
import { RESULTADO_INICIAL } from "@/lib/acoes/resultadoDoCadastro";
import { tiposDeProfissional } from "@/lib/dados/tiposDeProfissional";
import type {
  ClienteDoCadastro,
  EspecialidadeDoCadastro,
} from "@/lib/dados/profissionais";

/**
 * Os dois cadastros da seção: cliente novo e profissional novo.
 *
 * Ficam no mesmo lugar de propósito. Não existe tela de cliente separada — na
 * prática, esta é a tela de cadastro de cliente também. E não existe tela de
 * "Unidades": a primeira unidade nasce junto com o cliente, e as outras
 * aparecem aqui como lugares onde marcar.
 *
 * Só um formulário fica aberto por vez. Dois cartões abertos lado a lado,
 * ambos começando com um campo "nome", é o tipo de tela em que se digita o
 * nome da pessoa no lugar do nome da clínica.
 */

const campoBase =
  "w-full rounded-controle border border-black/15 bg-herval-branco px-4 py-3 text-sm text-herval-preto outline-none transition-colors placeholder:text-black/35 focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20";

const botaoPrincipal =
  "inline-flex items-center gap-2 rounded-full bg-herval-verde px-5 py-3 text-sm font-extrabold text-herval-preto transition-colors hover:bg-herval-verdeEscuro disabled:cursor-not-allowed disabled:opacity-50";

const botaoSecundario =
  "inline-flex items-center gap-2 rounded-full border border-black/15 px-5 py-3 text-sm font-bold text-black/70 transition-colors hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-40";

const rotulo = "mb-2 block text-xs font-bold uppercase tracking-wide text-black/50";

type Aberto = "nenhum" | "cliente" | "profissional";

export default function CadastroProfissional({
  clientes,
  especialidades,
}: {
  clientes: ClienteDoCadastro[];
  especialidades: EspecialidadeDoCadastro[];
}) {
  const [aberto, setAberto] = useState<Aberto>("nenhum");
  /**
   * A confirmação vive aqui, fora do cartão, porque o cartão fecha quando a
   * gravação dá certo — e uma mensagem de sucesso que some junto com o
   * formulário deixa quem cadastrou sem saber se salvou.
   */
  const [sucesso, setSucesso] = useState("");

  const temCliente = clientes.length > 0;

  function concluir(mensagem: string) {
    setSucesso(mensagem);
    setAberto("nenhum");
  }

  function alternar(qual: Exclude<Aberto, "nenhum">) {
    setSucesso("");
    setAberto((a) => (a === qual ? "nenhum" : qual));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => alternar("profissional")}
          disabled={!temCliente}
          className={botaoPrincipal}
        >
          {aberto === "profissional" ? (
            <X className="h-4 w-4" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {aberto === "profissional" ? "Fechar" : "Cadastrar profissional"}
        </button>

        <button
          type="button"
          onClick={() => alternar("cliente")}
          className={botaoSecundario}
        >
          {aberto === "cliente" ? (
            <X className="h-4 w-4" />
          ) : (
            <Building2 className="h-4 w-4" />
          )}
          {aberto === "cliente" ? "Fechar" : "Cadastrar cliente"}
        </button>

        {/* Sem cliente não há onde encaixar ninguém: o botão desabilitado
            sozinho não explica isso, e quem lê "Cadastrar profissional"
            apagado fica sem saber o que fazer antes. */}
        {!temCliente && (
          <span className="text-xs font-medium text-black/45">
            Cadastre um cliente primeiro — é a clínica em que a pessoa trabalha.
          </span>
        )}
      </div>

      {sucesso !== "" && aberto === "nenhum" && (
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-card bg-herval-verde/15 px-5 py-3 text-sm font-bold text-herval-preto"
        >
          <Check className="h-4 w-4" />
          {sucesso}
        </p>
      )}

      {aberto === "cliente" && <FormularioCliente aoConcluir={concluir} />}

      {aberto === "profissional" && (
        <FormularioProfissional
          clientes={clientes}
          especialidades={especialidades}
          aoConcluir={concluir}
        />
      )}
    </div>
  );
}

function FormularioCliente({
  aoConcluir,
}: {
  aoConcluir: (mensagem: string) => void;
}) {
  const [estado, acao, enviando] = useActionState(
    cadastrarCliente,
    RESULTADO_INICIAL,
  );
  /** Controlado pelo mesmo motivo do outro formulário: o React limpa os
      campos quando a ação termina, inclusive quando ela recusou. */
  const [nome, setNome] = useState("");

  useFecharQuandoDerCerto(estado, aoConcluir);

  return (
    <Cartao titulo="Cliente novo">
      {/* O `key` muda a cada resposta do servidor, o que redesenha o
          formulário a partir do estado guardado acima. Sem isso, o React
          esvazia os campos quando a ação termina — inclusive quando ela
          recusou — e quem errou um campo perde o que já tinha preenchido. */}
      <form key={estado.envio} action={acao} className="space-y-6">
        <div className="max-w-xl">
          <label htmlFor="cliente-nome" className={rotulo}>
            Nome do cliente
          </label>
          <input
            id="cliente-nome"
            name="nome"
            type="text"
            maxLength={120}
            autoComplete="off"
            placeholder="Ex.: Clínica Bella Face"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={campoBase}
          />
          <p className="mt-2 text-xs font-medium text-black/45">
            A primeira unidade é criada junto, com este mesmo nome. Só é preciso
            dar nome às unidades quando o cliente tiver mais de uma.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={enviando} className={botaoPrincipal}>
            <Plus className="h-4 w-4" />
            {enviando ? "Cadastrando…" : "Cadastrar cliente"}
          </button>
          <Aviso estado={estado} />
        </div>
      </form>
    </Cartao>
  );
}

function FormularioProfissional({
  clientes,
  especialidades,
  aoConcluir,
}: {
  clientes: ClienteDoCadastro[];
  especialidades: EspecialidadeDoCadastro[];
  aoConcluir: (mensagem: string) => void;
}) {
  const [estado, acao, enviando] = useActionState(
    cadastrarProfissional,
    RESULTADO_INICIAL,
  );

  useFecharQuandoDerCerto(estado, aoConcluir);

  /**
   * Os campos são controlados pela tela, e não deixados por conta do
   * navegador, por um motivo que só aparece no erro: quando a ação termina, o
   * React limpa o formulário. Sem guardar o que foi digitado, quem errasse o
   * tipo perderia o nome já preenchido e teria que redigitar tudo.
   */
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [registro, setRegistro] = useState("");
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});

  /**
   * Especialidade inativa não entra na lista de marcar. Ela continua aparecendo
   * riscada em quem já a tinha — o histórico não se apaga —, mas oferecê-la num
   * cadastro novo seria convidar a marcar algo que a clínica deixou de atender.
   */
  const disponiveis = especialidades.filter((e) => e.ativa);

  return (
    <Cartao titulo="Profissional novo">
      {/* Mesmo motivo do outro formulário: redesenhar a partir do estado
          depois de cada resposta. Aqui importa ainda mais, porque as caixas
          marcadas somem no esvaziamento e o texto digitado não. */}
      <form key={estado.envio} action={acao} className="space-y-7">
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <label htmlFor="prof-nome" className={rotulo}>
              Nome
            </label>
            <input
              id="prof-nome"
              name="nome"
              type="text"
              maxLength={120}
              autoComplete="off"
              placeholder="Ex.: Dra. Ana Martins"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={campoBase}
            />
          </div>

          <div>
            <label htmlFor="prof-tipo" className={rotulo}>
              Tipo
            </label>
            <select
              id="prof-tipo"
              name="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className={campoBase}
            >
              <option value="" disabled>
                Escolha o tipo
              </option>
              {tiposDeProfissional.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="prof-registro" className={rotulo}>
              Registro <span className="normal-case">(opcional)</span>
            </label>
            <input
              id="prof-registro"
              name="registro"
              type="text"
              maxLength={60}
              autoComplete="off"
              placeholder="Ex.: CRM 12345"
              value={registro}
              onChange={(e) => setRegistro(e.target.value)}
              className={campoBase}
            />
            <p className="mt-2 text-xs font-medium text-black/45">
              Nem todo cargo tem conselho de classe.
            </p>
          </div>
        </div>

        <fieldset>
          <legend className={rotulo}>Especialidades que atende</legend>
          {disponiveis.length === 0 ? (
            <p className="text-sm font-medium text-black/45">
              Nenhuma especialidade ativa cadastrada ainda. Dá para cadastrar a
              pessoa assim e marcar depois.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {disponiveis.map((especialidade) => (
                <Marcador
                  key={especialidade.id}
                  campo="especialidades"
                  valor={especialidade.id}
                  texto={especialidade.nome}
                  marcados={marcados}
                  aoMarcar={setMarcados}
                />
              ))}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className={rotulo}>Onde atende</legend>
          <div className="space-y-4">
            {clientes.map((cliente) => {
              /* Cliente de uma unidade só mostra uma caixa com o nome dele —
                 quem tem um lugar só nunca precisa saber que "unidade" existe.
                 O agrupamento aparece mesmo com um cliente só, porque é o que
                 deixa claro a qual cliente o lugar pertence. */
              const unidades = cliente.unidades.filter((u) => u.ativa);

              return (
                <div key={cliente.id}>
                  <p className="mb-2 text-sm font-bold text-herval-preto">
                    {cliente.nome}
                  </p>
                  {unidades.length === 0 ? (
                    <p className="text-xs font-medium text-black/45">
                      Nenhuma unidade ativa.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {unidades.map((unidade) => (
                        <Marcador
                          key={unidade.id}
                          campo="unidades"
                          valor={unidade.id}
                          texto={unidade.nome}
                          marcados={marcados}
                          aoMarcar={setMarcados}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={enviando} className={botaoPrincipal}>
            <Plus className="h-4 w-4" />
            {enviando ? "Cadastrando…" : "Cadastrar profissional"}
          </button>
          <Aviso estado={estado} />
        </div>
      </form>
    </Cartao>
  );
}

/**
 * Uma caixa de marcar com cara de etiqueta, igual às da tabela. Também
 * controlada, pelo mesmo motivo dos campos de texto: o que foi marcado
 * precisa sobreviver a um erro de validação.
 */
function Marcador({
  campo,
  valor,
  texto,
  marcados,
  aoMarcar,
}: {
  campo: string;
  valor: number;
  texto: string;
  marcados: Record<string, boolean>;
  aoMarcar: (mudar: (atual: Record<string, boolean>) => Record<string, boolean>) => void;
}) {
  const chave = `${campo}-${valor}`;

  return (
    <label className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/15 px-3.5 py-2 text-xs font-bold text-black/70 transition-colors has-[:checked]:border-herval-verde has-[:checked]:bg-herval-verde/15 has-[:checked]:text-herval-preto">
      <input
        type="checkbox"
        name={campo}
        value={valor}
        checked={marcados[chave] ?? false}
        onChange={(e) =>
          aoMarcar((atual) => ({ ...atual, [chave]: e.target.checked }))
        }
        className="h-3.5 w-3.5 accent-herval-verde"
      />
      {texto}
    </label>
  );
}

function Cartao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-black/10 bg-herval-branco p-8 shadow-card">
      <h2 className="mb-6 flex items-center gap-2.5 text-base font-extrabold tracking-tight text-herval-preto">
        <span className="h-4 w-1 rounded-full bg-herval-verde" />
        {titulo}
      </h2>
      {children}
    </div>
  );
}

/** A resposta do servidor, do lado do botão. Erro e acerto não se parecem. */
function Aviso({
  estado,
}: {
  estado: { ok: boolean; mensagem: string; envio: number };
}) {
  if (estado.mensagem === "") return null;

  return (
    <span
      role="status"
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold",
        estado.ok
          ? "bg-herval-verde/15 text-herval-preto"
          : "border border-herval-vermelho/40 text-herval-preto",
      ].join(" ")}
    >
      {estado.ok ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <AlertCircle className="h-3.5 w-3.5" />
      )}
      {estado.mensagem}
    </span>
  );
}

/**
 * Fecha o formulário quando a gravação dá certo.
 *
 * Compara o número do envio, e não o `ok`: sem isso, um segundo cadastro
 * bem-sucedido não fecharia nada, porque o estado já estaria em `ok` desde o
 * primeiro e o efeito não voltaria a rodar.
 */
function useFecharQuandoDerCerto(
  estado: { ok: boolean; mensagem: string; envio: number },
  aoConcluir: (mensagem: string) => void,
) {
  const ultimoEnvio = useRef(0);

  useEffect(() => {
    if (estado.ok && estado.envio !== ultimoEnvio.current) {
      ultimoEnvio.current = estado.envio;
      aoConcluir(estado.mensagem);
    }
  }, [estado, aoConcluir]);
}
