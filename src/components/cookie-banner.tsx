"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

const CHAVE_DISPENSADO = "promofy_cookie_banner_v1";

/**
 * Fase 7/8 LEGAL-PRIVACY-01: hoje não existe cookie opcional (sem
 * analytics/marketing/remarketing no app — auditado em
 * docs/audits/2026-09-08-legal-privacy-gap-analysis.md). Criar categorias
 * "aceitar opcionais/analytics/marketing" agora seria fingir consentimento
 * granular para algo que não existe. Este banner é só informativo; a
 * arquitetura de consentimento por finalidade já existe (ver
 * `consentimentos_usuario` / personalização) e é reaproveitável no dia em
 * que um cookie opcional entrar.
 */
export function CookieBanner() {
  const [visivel, setVisivel] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    try {
      if (!window.localStorage.getItem(CHAVE_DISPENSADO)) setVisivel(true);
    } catch {
      setVisivel(true);
    }
  }, []);

  // LEGAL-PRIVACY-01M: o banner é `fixed` (escapa do fluxo normal), então
  // nada empurra conteúdo de página para cima dele por conta própria — o
  // fim de uma tela curta (ex.: a confirmação de encerramento em
  // /m/perfil/privacidade) pode acabar posicionado embaixo do banner,
  // coberto e inclicável. Expor a altura real como custom property deixa
  // `body` (páginas normais) e o scroll interno do PhoneFrame (/m) reservarem
  // esse espaço — sem chutar um valor fixo nem repetir isso por página.
  React.useEffect(() => {
    if (!visivel) {
      document.documentElement.style.setProperty("--cookie-banner-h", "0px");
      return;
    }
    const el = ref.current;
    if (!el) return;
    const atualizar = () =>
      document.documentElement.style.setProperty("--cookie-banner-h", `${el.offsetHeight}px`);
    atualizar();
    const ro = new ResizeObserver(atualizar);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.setProperty("--cookie-banner-h", "0px");
    };
  }, [visivel]);

  function dispensar() {
    setVisivel(false);
    try {
      window.localStorage.setItem(CHAVE_DISPENSADO, "1");
    } catch {
      // localStorage indisponível (privado/bloqueado) — segue sem persistir.
    }
  }

  if (!visivel) return null;

  return (
    <div
      ref={ref}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card px-4 py-3 shadow-card"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground sm:text-sm">
          Usamos apenas cookies essenciais atualmente (login e sessão). Sem
          analytics ou marketing.{" "}
          <a href="/legal/cookies" className="underline">
            Política de Cookies
          </a>
          .
        </p>
        <Button size="sm" onClick={dispensar} className="shrink-0">
          Entendi
        </Button>
      </div>
    </div>
  );
}
