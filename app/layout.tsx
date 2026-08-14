import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Efeitos Colaterais — Sistema de Caso",
  description: "Mesa digital do RPG de investigação Efeitos Colaterais.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Mesmas fontes do protótipo, carregadas por <link> em vez de next/font:
            globals.css referencia as famílias pelo nome real ('Special Elite',
            'IBM Plex Sans/Mono') em dezenas de regras, e next/font gera nomes
            com hash. No App Router isto vale pra todas as rotas — a regra
            no-page-custom-font só se aplica ao Pages Router. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Special+Elite&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
