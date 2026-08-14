/**
 * O identificador de login é sintético: a pessoa digita "Rafael" e isso vira
 * `rafael@efeitos.local`. Não é dado pessoal — `.local` não é roteável, nenhum
 * email é enviado nunca, e o Supabase Auth só precisa de *alguma* string única.
 *
 * Este módulo é a única fonte da verdade dessa construção. O formulário de login
 * e o script que cria contas importam daqui: se as duas pontas normalizassem
 * diferente ("ana.paula" vs "anapaula"), a conta criada não seria a conta
 * logável, e o erro apareceria como "senha errada".
 */

export const IDENTITY_DOMAIN = "efeitos.local";

/**
 * Normaliza para a parte local do email. Tolerante de propósito — "Rafael",
 * "rafael" e "  RAFAEL " chegam no mesmo lugar, porque errar acento ou caixa
 * não deveria impedir ninguém de entrar no jogo.
 *
 *   "Rafael"     -> "rafael"
 *   "João"       -> "joao"
 *   "Ana Paula"  -> "anapaula"
 */
export function slugFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacríticos ("ã" -> "a")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function emailFromName(name: string): string {
  return `${slugFromName(name)}@${IDENTITY_DOMAIN}`;
}

/** "rafael@efeitos.local" -> "rafael". Usado só pra exibir algo legível. */
export function nameFromEmail(email: string): string {
  return email.split("@")[0] ?? email;
}
