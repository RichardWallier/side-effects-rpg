/**
 * Cria uma conta. Não existe cadastro público — quem abre acesso é você.
 *
 *   npm run user:create -- rafael minhasenha
 *   npm run user:create -- rafael minhasenha "Rafael Nunes"
 *
 * O nome vira o identificador de login: "rafael" -> rafael@efeitos.local. Usa a
 * MESMA normalização do formulário (lib/auth/identity), então o que é criado
 * aqui é exatamente o que loga lá.
 *
 * Se a conta já existir, só troca a senha — serve como "resetar senha do fulano".
 *
 * Precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (lê .env.local).
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { emailFromName, slugFromName } from "../lib/auth/identity";

for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // arquivo não existe, segue com o ambiente
  }
}

const [rawName, password, displayName] = process.argv.slice(2);

if (!rawName || !password) {
  console.error("uso: npm run user:create -- <nome> <senha> [\"Nome de Exibição\"]");
  process.exit(1);
}

const slug = slugFromName(rawName);
if (!slug) {
  console.error(`"${rawName}" não sobrou nada depois de normalizar. Use letras ou números.`);
  process.exit(1);
}
if (password.length < 6) {
  console.error("A senha precisa de pelo menos 6 caracteres (exigência do Supabase).");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = emailFromName(rawName);
const display = (displayName ?? rawName).trim();

async function main() {
  // email_confirm: true = já nasce confirmada. Nenhum email é enviado; o domínio
  // .local não é roteável de qualquer forma.
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: display },
  });

  if (!error) {
    console.log(`✔ conta criada: ${email}`);
    console.log(`  nome exibido: ${display}`);
    console.log(`  login: nome "${slug}" + a senha que você definiu`);
    return;
  }

  const alreadyExists =
    error.status === 422 || /already (been )?registered|already exists/i.test(error.message);

  if (!alreadyExists) {
    console.error(`✘ ${error.message}`);
    // O caso que mais dói: projeto que recusa domínio não roteável.
    if (/invalid|email/i.test(error.message)) {
      console.error(
        `\n  Se o Supabase recusou o domínio, troque IDENTITY_DOMAIN em` +
          ` lib/auth/identity.ts por um domínio seu e rode de novo.`,
      );
    }
    process.exit(1);
  }

  // Já existe: vira troca de senha. Precisa achar o id primeiro.
  console.log(`• ${email} já existe — atualizando a senha.`);

  let userId: string | undefined;
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data: list, error: listError } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listError) {
      console.error(`✘ ${listError.message}`);
      process.exit(1);
    }
    userId = list.users.find((u) => u.email === email)?.id;
    if (list.users.length < 200) break;
  }

  if (!userId) {
    console.error(`✘ ${email} existe mas não foi encontrado na listagem.`);
    process.exit(1);
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password,
    user_metadata: { display_name: display },
  });

  if (updateError) {
    console.error(`✘ ${updateError.message}`);
    process.exit(1);
  }

  console.log(`✔ senha atualizada para ${email}`);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
