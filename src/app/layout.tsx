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
