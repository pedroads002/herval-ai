import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--fonte-herval",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Herval AI",
  description: "Painel de operação comercial assistida por IA",
  // O ícone da aba é só o robô da Helô, recortado do fundo preto da logo.
  // Três tamanhos porque o navegador escolhe o que mais se aproxima da tela:
  // reduzir um arquivo grande até 16px borra os olhos e a boca.
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="bg-herval-branco antialiased">{children}</body>
    </html>
  );
}
