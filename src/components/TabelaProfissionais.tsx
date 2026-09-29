import type {
  ClienteDoCadastro,
  ProfissionalCadastrado,
  UnidadeDoCadastro,
} from "@/lib/dados/profissionais";

/**
 * A tabela de quem atende, lendo o banco.
 *
 * Antes esta tela mostrava uma lista fixa de profissionais inventados, com um
 * deles marcado em verde como "avaliador" — o único que recebia a primeira
 * consulta. Isso saiu: avaliador é um cargo como os outros dezesseis, sem
 * destaque, sem contador próprio e sem explicação no pé da tabela.
 *
 * Não recebe o dado por conta própria: quem lê o banco é a página, que é
 * componente de servidor. Assim este arquivo continua sendo só desenho, e o
 * cadastro da etapa seguinte entra sem mexer na leitura.
 */
export default function TabelaProfissionais({
  profissionais,
  clientes,
  falha,
}: {
  profissionais: ProfissionalCadastrado[];
  clientes: ClienteDoCadastro[];
  falha: string | null;
}) {
  /**
   * Falha de leitura não é lista vazia. Sem esta distinção, banco fora do ar e
   * cadastro realmente vazio viram a mesma tela em branco — e a primeira é
   * defeito, que alguém leria como "não tem ninguém cadastrado".
   */
  if (falha) {
    return (
      <div className="rounded-card border border-herval-vermelho/30 bg-herval-vermelho/5 px-5 py-6">
        <p className="text-sm font-bold text-herval-preto">
          Não deu para carregar os profissionais.
        </p>
        <p className="mt-1 text-sm font-medium text-black/60">{falha}</p>
      </div>
    );
  }

  const unidades = clientes.flatMap((c) => c.unidades);

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium text-black/55">
        <span className="font-extrabold text-herval-preto">
          {profissionais.length}
        </span>{" "}
        {profissionais.length === 1 ? "profissional" : "profissionais"} ·{" "}
        <span className="font-extrabold text-herval-preto">
          {clientes.length}
        </span>{" "}
        {clientes.length === 1 ? "cliente" : "clientes"} ·{" "}
        <span className="font-extrabold text-herval-preto">
          {unidades.length}
        </span>{" "}
        {unidades.length === 1 ? "unidade" : "unidades"}.
      </p>

      {profissionais.length === 0 ? (
        <Vazio temCliente={clientes.length > 0} />
      ) : (
        <>
          <div className="overflow-hidden rounded-card border border-black/10 bg-herval-branco shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b border-black/10 bg-black/[0.03] text-left text-xs uppercase tracking-wider text-black/50">
                  <tr>
                    <th className="px-6 py-4 font-bold">Profissional</th>
                    <th className="px-6 py-4 font-bold">Tipo</th>
                    <th className="px-6 py-4 font-bold">
                      Especialidades que atende
                    </th>
                    <th className="px-6 py-4 font-bold">Onde atende</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.07]">
                  {profissionais.map((profissional) => (
                    <tr
                      key={profissional.id}
                      className="transition-colors hover:bg-herval-verde/[0.06]"
                    >
                      <td className="px-6 py-5">
                        <span className="block font-bold text-herval-preto">
                          {profissional.nome}
                        </span>
                        {/* Registro em branco é comum e não é erro: esteticista
                            não tem conselho de classe. Some, em vez de virar
                            uma linha vazia pedindo para ser preenchida. */}
                        {profissional.registro && (
                          <span className="mt-0.5 block text-xs font-medium text-black/50">
                            {profissional.registro}
                          </span>
                        )}
                        {!profissional.ativo && (
                          <span className="mt-1.5 inline-block rounded-full border border-black/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black/45">
                            Inativo
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-5">
                        <span className="inline-flex items-center rounded-full border border-black/20 px-3 py-1 text-xs font-bold text-black/65">
                          {profissional.tipo}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        {profissional.especialidades.length === 0 ? (
                          <span className="text-xs font-medium text-black/35">
                            Nenhuma marcada
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {profissional.especialidades.map((especialidade) => (
                              <span
                                key={especialidade.id}
                                className={[
                                  "rounded-full px-2.5 py-1 text-xs font-bold",
                                  especialidade.ativa
                                    ? "bg-herval-verde/15 text-herval-preto"
                                    : "border border-black/15 text-black/40 line-through",
                                ].join(" ")}
                              >
                                {especialidade.nome}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-5">
                        {profissional.unidades.length === 0 ? (
                          <span className="text-xs font-medium text-black/35">
                            Nenhum lugar marcado
                          </span>
                        ) : (
                          <ul className="space-y-1">
                            {profissional.unidades.map((unidade) => (
                              <li
                                key={unidade.id}
                                className="text-xs font-medium text-black/65"
                              >
                                {ondeAtende(unidade)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs font-medium text-black/45">
            Especialidades riscadas estão inativas na tela de Especialidades.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Como o lugar de atendimento é escrito.
 *
 * Todo cliente tem no mínimo uma unidade, criada junto com ele e com o mesmo
 * nome. Quando é essa, repetir o nome duas vezes ("Clínica Teste — Clínica
 * Teste") só faria o leitor procurar a diferença que não existe. Cliente com
 * mais de um lugar é que precisa dizer qual.
 */
function ondeAtende(unidade: UnidadeDoCadastro) {
  const lugar =
    unidade.nome === unidade.clienteNome
      ? unidade.clienteNome
      : `${unidade.clienteNome} · ${unidade.nome}`;

  return unidade.ativa ? lugar : `${lugar} (unidade inativa)`;
}

/**
 * O estado vazio. Diz qual é o próximo passo, e o próximo passo depende de
 * existir cliente ou não — sem isso a tela pediria para cadastrar profissional
 * sem ter onde encaixá-lo.
 */
function Vazio({ temCliente }: { temCliente: boolean }) {
  return (
    <div className="rounded-card border border-dashed border-black/15 bg-herval-branco px-6 py-10 text-center">
      <p className="text-sm font-bold text-herval-preto">
        Nenhum profissional cadastrado ainda.
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium text-black/55">
        {temCliente
          ? "Cadastre quem atende: nome, tipo, as especialidades que a pessoa cobre e em qual unidade ela trabalha."
          : "Antes de cadastrar quem atende, cadastre o cliente — é a clínica em que a pessoa trabalha."}
      </p>
    </div>
  );
}
