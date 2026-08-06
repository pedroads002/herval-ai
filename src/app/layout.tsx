import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import MenuLateral from "@/components/MenuLateral";
import CabecalhoTopo from "@/components/CabecalhoTopo";

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
      <body className="bg-herval-branco antialiased">
        <CabecalhoTopo />
        <MenuLateral />
        <main className="ml-56 px-6 pb-16 pt-24 md:ml-64 md:px-10">
          {children}
        </main>
      </body>
    </html>
  );
}
