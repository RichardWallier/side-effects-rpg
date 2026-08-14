/**
 * Leitura das variáveis de ambiente com erro legível.
 *
 * Sem isto, faltar uma variável vira "Your project's URL and Key are required to
 * create a Supabase client!" — vindo de dentro do @supabase/ssr, apontando pra
 * uma linha que não é o problema. Como o middleware roda em toda request, o app
 * inteiro morre e a mensagem não diz qual variável falta nem onde declarar.
 *
 * As NEXT_PUBLIC_* precisam ser lidas como acesso literal a `process.env.NOME`:
 * o Next substitui isso no build por texto, e `process.env[nome]` dinâmico não é
 * substituído (viria undefined no browser).
 */

function required(name: string, value: string | undefined): string {
  if (value && value.trim()) return value;
  throw new Error(
    `Variável de ambiente ${name} não definida.\n\n` +
      `Crie um .env.local na raiz do projeto:\n\n` +
      `  cp .env.example .env.local\n\n` +
      `e preencha com os valores do seu projeto Supabase ` +
      `(Project Settings → API). Depois reinicie o \`npm run dev\` — ` +
      `o Next só relê .env.local ao subir.`,
  );
}

export const supabaseUrl = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabaseAnonKey = () =>
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Só servidor. Quem chama já está atrás de `server-only`. */
export const supabaseServiceRoleKey = () =>
  required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
