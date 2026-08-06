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
        marca: {
          DEFAULT: "#2563eb",
          escura: "#1d4ed8",
          clara: "#eff6ff",
        },
        menu: "#111827",
      },
    },
  },
  plugins: [],
};

export default config;
