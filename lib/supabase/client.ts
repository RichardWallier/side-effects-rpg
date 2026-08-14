"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Client do browser. anon key + JWT da sessão do usuário. Tudo que sai daqui é
 * filtrado por RLS. Nunca importe `admin.ts` num módulo que chega no bundle.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}

let singleton: ReturnType<typeof createBrowserClient> | null = null;

/** Mesma instância entre componentes — o Realtime precisa de uma socket só. */
export function supabaseBrowser() {
  if (!singleton) singleton = createClient();
  return singleton;
}
