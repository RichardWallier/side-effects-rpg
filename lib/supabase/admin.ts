import "server-only";

import { createClient } from "@supabase/supabase-js";
import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";

/**
 * service_role: ignora RLS. Só Route Handlers / Server Actions.
 *
 * O `server-only` acima faz o build quebrar se algum componente client importar
 * este módulo, direta ou indiretamente — é a rede de segurança que impede a
 * chave de vazar pro bundle.
 */
export function createAdminClient() {
  return createClient(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
