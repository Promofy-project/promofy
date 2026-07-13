import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";

/**
 * Client Supabase para Client Components (browser).
 *
 * SEMPRE instanciar via esta factory dentro de handlers/efeitos — nunca em
 * escopo de módulo: /m/login, /m/cadastro e /m/cupom/[id] são prerenderizadas
 * no build (SSG) e um client de módulo executaria o construtor sem browser.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
