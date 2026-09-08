"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cancelarEncerramentoContaAction } from "@/lib/actions/legal";

/**
 * Bloqueio de uso enquanto a conta não está `ativo` (Fase 11/12
 * LEGAL-PRIVACY-01 — "solicitação → conta deixa de ser utilizável").
 *
 * O cancelamento vive AQUI, embutido, em vez de linkar para
 * `/m/perfil/privacidade`: aquela rota está atrás do MESMO layout que
 * renderiza este bloqueio, então um link para lá seria um beco sem saída
 * enquanto a conta não voltar a `ativo`.
 */
export function EncerramentoBloqueio({
  status,
}: {
  status: "encerramento_solicitado" | "anonimizado";
}) {
  const router = useRouter();
  const [carregando, setCarregando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  if (status === "anonimizado") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 py-10 text-center">
        <h1 className="text-lg font-extrabold text-foreground">Conta encerrada</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Esta conta foi encerrada e seus dados pessoais foram anonimizados.
          Fale com{" "}
          <a href="mailto:privacidade@promofy.com.br" className="underline">
            privacidade@promofy.com.br
          </a>{" "}
          se isso não deveria ter acontecido.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 py-10 text-center">
      <h1 className="text-lg font-extrabold text-foreground">
        Sua conta está em encerramento
      </h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Você solicitou o encerramento da sua conta Promofy. Enquanto o pedido
        é processado, o app fica indisponível para uso. Alguns registros
        podem ser preservados por obrigação legal.
      </p>
      {erro && <p className="text-sm font-semibold text-danger">{erro}</p>}
      <Button
        variant="outline"
        disabled={carregando}
        onClick={async () => {
          setErro(null);
          setCarregando(true);
          const r = await cancelarEncerramentoContaAction();
          setCarregando(false);
          if (!r.ok) {
            setErro(r.erro);
            return;
          }
          router.refresh();
        }}
      >
        {carregando ? "Cancelando…" : "Cancelar encerramento"}
      </Button>
    </div>
  );
}
