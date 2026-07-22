import { PhoneFrame } from "@/components/phone-frame";
import { MobileFlowProvider } from "@/components/mobile-flow-provider";
import {
  CouponStateProvider,
  type EstadoInicial,
} from "@/components/coupon-state-provider";
import {
  FavoritesProvider,
  type FavoritosInicial,
} from "@/components/favorites-provider";
import { AuthSync } from "@/components/auth-sync";
import { createClient } from "@/lib/supabase/server";
import type { EstadoCupomDTO } from "@/lib/actions/cupons";

const INICIAL_ANONIMO: EstadoInicial = {
  logado: false,
  usuario: null,
  saldo: 0,
  economia: 0,
  config: {},
  estados: [],
};

/**
 * Layout do app do consumidor. Lê a sessão (cookies) — o que torna todo
 * o segmento /m dinâmico — e hidrata o CouponStateProvider a partir do
 * servidor numa única RPC. Se o banco estiver fora, degrada para o
 * estado anônimo (a demo pública continua de pé).
 *
 * `key={userId}` garante re-hidratação em login/logout (router.refresh
 * re-renderiza o layout; sem a key o useState inicial ficaria obsoleto).
 */
export default async function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let inicial = INICIAL_ANONIMO;
  let favoritos: FavoritosInicial = { logado: false, ids: [] };
  let userId: string | null = null;

  try {
    const supabase = createClient();
    const { data: claims } = await supabase.auth.getClaims();
    userId = claims?.claims?.sub ?? null;

    if (userId) {
      // estado + economia + favoritos (leitura sob RLS own) numa ida só
      const [{ data, error }, { data: economiaData }, { data: favs }] =
        await Promise.all([
          supabase.rpc("meu_estado_consumidor"),
          supabase.rpc("economia_total_consumidor"),
          supabase.from("favoritos").select("estabelecimento_id"),
        ]);
      favoritos = {
        logado: true,
        ids: (favs ?? []).map((f) => f.estabelecimento_id),
      };
      if (!error && data) {
        const p = data as unknown as {
          usuario: { nome: string; cpf_mascarado: string } | null;
          saldo: number;
          config: Record<string, number>;
          estados: EstadoCupomDTO[];
        };
        inicial = {
          logado: true,
          usuario: p.usuario
            ? { nome: p.usuario.nome, cpfMascarado: p.usuario.cpf_mascarado }
            : null,
          saldo: p.saldo ?? 0,
          economia: Number(economiaData ?? 0),
          config: p.config ?? {},
          estados: p.estados ?? [],
        };
      }
    }
  } catch {
    // banco indisponível → segue anônimo (não derruba /m)
    inicial = INICIAL_ANONIMO;
    favoritos = { logado: false, ids: [] };
  }

  return (
    <MobileFlowProvider>
      {/* Fora dos providers com key={userId}: fica montado estável na sessão
          toda (não re-monta a cada navegação) p/ ouvir a perda de sessão e
          invalidar o Router Cache. `serverLogado` = havia sessão no render. */}
      <AuthSync serverLogado={Boolean(userId)} />
      <FavoritesProvider key={userId ?? "anon"} initial={favoritos}>
        <CouponStateProvider key={userId ?? "anon"} initial={inicial}>
          <PhoneFrame>{children}</PhoneFrame>
        </CouponStateProvider>
      </FavoritesProvider>
    </MobileFlowProvider>
  );
}
