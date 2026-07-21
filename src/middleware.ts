import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Proteção de rotas por papel (Fase 1).
 *
 * ⚠️ Este arquivo PRECISA viver em src/ (irmão de src/app): com diretório
 * src/, o Next 14 ignora silenciosamente um middleware.ts na raiz do repo.
 *
 * Papel vem do claim app_metadata.role do JWT — escrito somente pela
 * admin API (seed); o usuário não consegue se auto-atribuir. Sessão sem
 * claim de role = consumidor. Isto é fronteira de UX (redirects); a
 * fronteira de segurança real é o RLS no banco.
 */

const LOGIN_PORTAL = "/portal/login";
const LOGIN_ADMIN = "/admin/login";
const LOGIN_E = "/e/login";
const LOGIN_M = "/m/login";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, claims } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const role: string | null = claims
    ? ((claims.app_metadata as { role?: string } | undefined)?.role ??
      "consumidor")
    : null;

  const redirect = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    // Novo response: copiar os cookies do supabaseResponse (regra de ouro
    // do @supabase/ssr — sem isso a sessão dessincroniza).
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies
      .getAll()
      .forEach(({ name, value }) => res.cookies.set(name, value));
    return res;
  };

  // /portal — exige lojista (a tela de login é pública)
  if (pathname.startsWith("/portal")) {
    if (pathname.startsWith(LOGIN_PORTAL)) {
      if (role === "lojista") return redirect("/portal");
      return supabaseResponse;
    }
    if (role !== "lojista") return redirect(LOGIN_PORTAL);
    return supabaseResponse;
  }

  // /admin — exige admin (a tela de login é pública)
  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith(LOGIN_ADMIN)) {
      if (role === "admin") return redirect("/admin");
      return supabaseResponse;
    }
    if (role !== "admin") return redirect(LOGIN_ADMIN);
    return supabaseResponse;
  }

  // /e — app operacional do estabelecimento; exige lojista (mesmo padrão
  // do /portal: a tela de login é pública). A exceção do path de login VEM
  // ANTES do gate — senão anônimo/consumidor em /e/login entraria em loop.
  if (pathname.startsWith("/e")) {
    if (pathname.startsWith(LOGIN_E)) {
      if (role === "lojista") return redirect("/e");
      return supabaseResponse;
    }
    if (role !== "lojista") return redirect(LOGIN_E);
    return supabaseResponse;
  }

  // /m — só o perfil exige sessão (browsing segue público; o gate do
  // "usar cupom" é client-side, decisão D2 do plano)
  if (pathname.startsWith("/m/perfil") && !claims) {
    return redirect(LOGIN_M);
  }

  return supabaseResponse;
}

export const config = {
  // Landings (/, /para-voce, /para-empresas) ficam fora de propósito:
  // zero overhead de auth em páginas de marketing.
  matcher: ["/m/:path*", "/e/:path*", "/portal/:path*", "/admin/:path*"],
};
