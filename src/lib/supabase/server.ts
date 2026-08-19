import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./database.types";
import { semCacheDoNext } from "./sem-cache";

/**
 * Client Supabase para Server Components, Server Actions e Route Handlers.
 * Padrão oficial @supabase/ssr: cookies via getAll/setAll.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: semCacheDoNext },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll chamado de um Server Component — pode ser ignorado
            // porque o middleware (updateSession) refresca a sessão.
          }
        },
      },
    },
  );
}
