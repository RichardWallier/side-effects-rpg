import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * service_role: ignora RLS. Só Route Handlers / Server Actions.
 *
 * O `server-only` acima faz o build quebrar se algum componente client importar
 * este módulo, direta ou indiretamente — é a rede de segurança que impede a
 * chave de vazar pro bundle.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
