import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta oficial Herval: verde, preto e branco.
        herval: {
          verde: "#01D800",
          verdeEscuro: "#01B300",
          preto: "#000000",
          branco: "#FFFFFF",
          // Tons fora da paleta, reservados para sinalização: vermelho para
          // ação destrutiva, erro e alerta crítico; âmbar para alerta de
          // atenção nos relatórios.
          vermelho: "#D93025",
          atencao: "#C77700",
        },
      },
      borderRadius: {
        card: "16px",
        controle: "10px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.06)",
        topo: "0 1px 0 rgba(0, 0, 0, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
