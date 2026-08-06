import type { Metadata } from "next";
import "./globals.css";
import MenuLateral from "@/components/MenuLateral";

export const metadata: Metadata = {
  title: "Herval AI",
  description: "Painel de operação comercial assistida por IA",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <div className="flex min-h-screen">
          <MenuLateral />
          <main className="flex-1 ml-56 p-6 md:ml-64 md:p-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
