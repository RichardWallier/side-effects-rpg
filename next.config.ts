import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Sem isso o Next escolhe a raiz do workspace pelo lockfile mais alto que
  // encontra — se houver um package-lock.json solto acima deste diretório, o
  // rastreio de arquivos do build sai errado.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
