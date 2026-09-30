"use client";

import { useActionState, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Plus,
  Save,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  cadastrarProcedimento,
  editarProcedimento,
  excluirProcedimento,
} from "@/lib/acoes/procedimentos";
import { RESULTADO_INICIAL } from "@/lib/acoes/resultadoDoCadastro";
import type { ProcedimentoDoCatalogo } from "@/lib/dados/procedimentos";
import {
  Aviso,
  botaoPerigo,
  botaoPrincipal,
  botaoSecundario,
  Campo,
  Cartao,
  rotulo,
  Status,
  useQuandoDerCerto,
  useValores,
} from "@/components/cadastro/comuns";
import Etiqueta from "@/components/Etiqueta";
import { formatarDuracao } from "@/lib/formato";

/**
 * O catálogo de procedimentos da agência: a lista, a edição de cada um e o
 * cadastro de mais.
 *
 * Até aqui esta tela mostrava um arquivo fixo — e o arquivo estava vazio, então
 * ela mostrava nada, enquanto os 23 procedimentos que o cadastro de profissional
 * oferece viviam no banco sem tela nenhuma que os deixasse mudar. Agora é o
 * banco, nos dois sentidos: lê de lá e grava lá.
 *
 * O desenho segue a tela de Clientes de propósito — lista fechada, uma ficha
 * aberta por vez, formulário no mesmo cartão. É o mesmo tipo de trabalho, e duas
 * gramáticas diferentes para cadastrar coisa no mesmo painel só dariam a quem usa
 * duas coisas para aprender.
 */
export default function ListaEspecialidades({
  procedimentos,
  falha,
}: {
  procedimentos: ProcedimentoDoCatalogo[];
  falha: string | null;
}) {
  /** Qual procedimento está aberto. Um de cada vez: dois abertos é rolagem à toa. */
  const [aberto, setAberto] = useState<number | null>(null);
  const [adicionando, setAdicionando] = useState(false);

  // Falha de leitura não é catálogo vazio. Sem esta distinção, banco fora do ar
  // e catálogo realmente vazio viram a mesma tela em branco — e a primeira é
  // defeito, que alguém leria como "não tem procedimento cadastrado".
  if (falha) {
    return (
      <div className="rounded-card border border-herval-vermelho/30 bg-herval-vermelho/5 px-5 py-6">
        <p className="text-sm font-bold text-herval-preto">
          Não deu para carregar os procedimentos.
        </p>
        <p className="mt-1 text-sm font-medium text-black/60">{falha}</p>
      </div>
    );
  }

  const ativos = procedimentos.filter((p) => p.ativa).length;

  return (
    <Cartao
      titulo="Catálogo de procedimentos"
      acoes={
        <button
          type="button"
          onClick={() => {
            setAdicionando((atual) => !atual);
            setAberto(null);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 transition-colors hover:text-herval-preto"
        >
          {adicionando ? (
            <X className="h-3.5 w-3.5" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {adicionando ? "Cancelar" : "Adicionar procedimento"}
        </button>
      }
    >
      <p className="mb-6 text-sm font-medium text-black/55">
        <span className="font-extrabold text-herval-preto">{ativos}</span> de{" "}
        <span className="font-extrabold text-herval-preto">
          {procedimentos.length}
        </span>{" "}
        procedimentos ativos. A Helô só oferece e agenda os ativos.
      </p>

      {procedimentos.length === 0 && !adicionando && (
        <p className="text-sm font-medium text-black/55">
          O catálogo está vazio. É dele que cada profissional marca o que
          realiza, então sem procedimento nenhum o cadastro de quem atende fica
          sem o que marcar.
        </p>
      )}

      {procedimentos.length > 0 && (
        <ul className="space-y-3">
          {procedimentos.map((procedimento) => (
            <li
              key={procedimento.id}
              className="overflow-hidden rounded-card border border-black/10"
            >
              <button
                type="button"
                onClick={() =>
                  setAberto((atual) =>
                    atual === procedimento.id ? null : procedimento.id,
                  )
                }
                className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-herval-verde/[0.06]"
              >
                <span className="mt-0.5 text-black/40">
                  {aberto === procedimento.id ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-bold text-herval-preto">
                    {procedimento.nome}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-black/50">
                    <Clock className="h-3.5 w-3.5" />
                    {formatarDuracao(procedimento.duracaoMinutos)}
                  </span>
                  <QuemAtende procedimento={procedimento} />
                </span>
                <Etiqueta
                  texto={procedimento.ativa ? "Ativo" : "Inativo"}
                  tom={procedimento.ativa ? "verde" : "preto"}
                />
              </button>

              {aberto === procedimento.id && (
                <div className="border-t border-black/10 px-5 py-6">
                  <Formulario
                    procedimento={procedimento}
                    aoSalvar={() => setAberto(null)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {adicionando && (
        <div
          className={
            procedimentos.length > 0 ? "mt-6 border-t border-black/10 pt-6" : ""
          }
        >
          <Formulario
            procedimento={null}
            aoSalvar={() => setAdicionando(false)}
          />
        </div>
      )}

      <p className="mt-6 text-xs font-medium text-black/45">
        Quem realiza cada procedimento é marcado na ficha de cada profissional,
        dentro do cliente. Aqui fica o que é do procedimento em si.
      </p>
    </Cartao>
  );
}

/**
 * Quem realiza o procedimento, na linha fechada.
 *
 * Aparece sempre, inclusive com zero — e o zero é a informação mais útil da
 * tela: procedimento ativo que ninguém realiza é o que a Helô ofereceria sem
 * ter a quem encaminhar.
 */
function QuemAtende({
  procedimento,
}: {
  procedimento: ProcedimentoDoCatalogo;
}) {
  if (procedimento.quemAtende.length === 0) {
    return (
      <span className="mt-2 block text-xs font-medium text-black/40">
        Ninguém realiza este procedimento hoje
      </span>
    );
  }

  return (
    <span className="mt-2 block">
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-black/45">
        <Users className="h-3.5 w-3.5" />
        Quem realiza ({procedimento.quemAtende.length})
      </span>
      <span className="mt-1.5 flex flex-wrap gap-1.5">
        {procedimento.quemAtende.map((pessoa) => (
          <span
            key={pessoa.id}
            className="rounded-full bg-herval-verde/15 px-2.5 py-1 text-xs font-bold text-herval-preto"
          >
            {pessoa.nome}
          </span>
        ))}
      </span>
    </span>
  );
}

/** O formulário de um procedimento. Serve para cadastrar e para editar. */
function Formulario({
  procedimento,
  aoSalvar,
}: {
  procedimento: ProcedimentoDoCatalogo | null;
  aoSalvar: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    procedimento ? editarProcedimento : cadastrarProcedimento,
    RESULTADO_INICIAL,
  );

  const { valores, mudar } = useValores({
    nome: procedimento?.nome ?? "",
    // Quarenta é o padrão da coluna no banco, e o que os procedimentos já
    // cadastrados usam. Chegar com o campo já preenchido poupa a digitação que
    // quase sempre seria essa.
    duracao_minutos: String(procedimento?.duracaoMinutos ?? 40),
  });
  const [ativa, setAtiva] = useState(procedimento?.ativa ?? true);

  useQuandoDerCerto(estado, aoSalvar);

  return (
    <form key={estado.envio} action={executar} className="space-y-7">
      {procedimento && (
        <input type="hidden" name="id" value={procedimento.id} />
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Campo
          nome="nome"
          etiqueta="Nome do procedimento"
          valores={valores}
          aoMudar={mudar}
          obrigatorio
          exemplo="Harmonização facial"
        />
        <Duracao valores={valores} aoMudar={mudar} />
      </div>

      <Status
        nome="ativa"
        etiqueta="Status"
        ligado={ativa}
        aoMudar={setAtiva}
        palavras={["Ativo", "Inativo"]}
      />

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={enviando} className={botaoPrincipal}>
          {procedimento ? (
            <Save className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {enviando
            ? procedimento
              ? "Salvando…"
              : "Cadastrando…"
            : procedimento
              ? "Salvar alterações"
              : "Cadastrar procedimento"}
        </button>
        {procedimento && <Excluir procedimento={procedimento} />}
        <Aviso estado={estado} />
      </div>
    </form>
  );
}

/**
 * A duração, em minutos.
 *
 * Campo próprio em vez de `Campo`: `type="number"` traz do navegador as setas e
 * a recusa de letra, e `Campo` só faz texto e e-mail. Um `type="text"` aqui
 * aceitaria "quarenta" até o servidor responder.
 */
function Duracao({
  valores,
  aoMudar,
}: {
  valores: Record<string, string>;
  aoMudar: (campo: string, valor: string) => void;
}) {
  return (
    <div>
      <label htmlFor="campo-duracao" className={rotulo}>
        Duração da avaliação (minutos)
      </label>
      <input
        id="campo-duracao"
        name="duracao_minutos"
        type="number"
        min={5}
        max={480}
        step={5}
        required
        value={valores.duracao_minutos ?? ""}
        onChange={(e) => aoMudar("duracao_minutos", e.target.value)}
        className="w-full rounded-controle border border-black/15 bg-herval-branco px-4 py-3 text-sm text-herval-preto outline-none transition-colors focus:border-herval-verde focus:ring-4 focus:ring-herval-verde/20"
      />
      <p className="mt-1.5 text-xs font-medium text-black/45">
        É o tempo que a Agenda reserva para a consulta de avaliação.
      </p>
    </div>
  );
}

/**
 * Exclusão em dois cliques, como na tela de Clientes.
 *
 * O primeiro clique troca o botão por uma pergunta; o segundo apaga. Apagar é a
 * única ação desta tela que não tem volta, e um botão de um clique ao lado de
 * "salvar" apaga por engano de mira.
 *
 * Quem realiza o procedimento não é conferido aqui, e sim na ação: a tela sabe
 * quantas pessoas ativas realizam, mas a recusa tem que valer também para quem
 * está inativo — e para quem chamasse a ação sem passar por tela nenhuma.
 */
function Excluir({ procedimento }: { procedimento: ProcedimentoDoCatalogo }) {
  const [estado, executar, enviando] = useActionState(
    excluirProcedimento,
    RESULTADO_INICIAL,
  );
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className={botaoPerigo}
      >
        <Trash2 className="h-4 w-4" />
        Excluir
      </button>
    );
  }

  return (
    <form action={executar} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={procedimento.id} />
      <span className="text-sm font-bold text-herval-preto">
        Excluir {procedimento.nome}?
      </span>
      <button type="submit" disabled={enviando} className={botaoPerigo}>
        {enviando ? "Excluindo…" : "Sim, excluir"}
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className={botaoSecundario}
      >
        Não
      </button>
      <Aviso estado={estado} />
    </form>
  );
}
