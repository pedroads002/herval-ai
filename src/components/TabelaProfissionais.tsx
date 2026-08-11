import { Stethoscope } from "lucide-react";
import { profissionaisIniciais } from "@/data/profissionais";
import { especialidadePorId } from "@/data/especialidades";

/**
 * Lista fixa de profissionais. As especialidades vêm da tela de Especialidades
 * pelo id, então os dois cadastros nunca discordam entre si.
 */
export default function TabelaProfissionais() {
  const avaliadores = profissionaisIniciais.filter(
    (p) => p.tipo === "Avaliador",
  ).length;

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium text-black/55">
        <span className="font-extrabold text-herval-preto">
          {profissionaisIniciais.length}
        </span>{" "}
        profissionais cadastrados ·{" "}
        <span className="font-extrabold text-herval-preto">{avaliadores}</span>{" "}
        {avaliadores === 1 ? "avaliador" : "avaliadores"} recebendo a primeira
        consulta.
      </p>

      <div className="overflow-hidden rounded-card border border-black/10 bg-herval-branco shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-black/10 bg-black/[0.03] text-left text-xs uppercase tracking-wider text-black/50">
              <tr>
                <th className="px-6 py-4 font-bold">Profissional</th>
                <th className="px-6 py-4 font-bold">Tipo</th>
                <th className="px-6 py-4 font-bold">Especialidades que atende</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.07]">
              {profissionaisIniciais.map((profissional) => {
                const avaliador = profissional.tipo === "Avaliador";

                return (
                  <tr
                    key={profissional.id}
                    className={
                      avaliador
                        ? "bg-herval-verde/[0.07]"
                        : "transition-colors hover:bg-herval-verde/[0.06]"
                    }
                  >
                    <td className="px-6 py-5">
                      <span className="block font-bold text-herval-preto">
                        {profissional.nome}
                      </span>
                      <span className="mt-0.5 block text-xs font-medium text-black/50">
                        {profissional.registro}
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className={[
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
                          avaliador
                            ? "bg-herval-preto text-herval-branco"
                            : "border border-black/20 text-black/65",
                        ].join(" ")}
                      >
                        {avaliador && <Stethoscope className="h-3 w-3" />}
                        {profissional.tipo}
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1.5">
                        {profissional.especialidadeIds.map((id) => {
                          const especialidade = especialidadePorId(id);
                          if (!especialidade) return null;

                          return (
                            <span
                              key={id}
                              className={[
                                "rounded-full px-2.5 py-1 text-xs font-bold",
                                especialidade.ativa
                                  ? "bg-herval-verde/15 text-herval-preto"
                                  : "border border-black/15 text-black/40 line-through",
                              ].join(" ")}
                            >
                              {especialidade.nome}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs font-medium text-black/45">
        A linha em verde é do avaliador: é com ele que a IA marca a primeira
        consulta, antes de o caso ir para o especialista. Especialidades
        riscadas estão inativas na tela de Especialidades.
      </p>
    </div>
  );
}
