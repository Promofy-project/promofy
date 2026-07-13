import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca a sessão e devolve os claims do usuário para o middleware raiz
 * (src/middleware.ts) decidir redirects por papel.
 *
 * Regras de ouro do padrão oficial @supabase/ssr:
 * - NÃO rodar código entre createServerClient e supabase.auth.getClaims().
 * - NÃO remover o getClaims(): sem ele, usuários podem ser deslogados
 *   aleatoriamente com SSR.
 * - SEMPRE retornar o supabaseResponse como está (cookies intactos); quem
 *   criar um response novo precisa copiar request e cookies.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: não rodar nada entre a criação do client e o getClaims().
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  return { supabaseResponse, claims };
}
