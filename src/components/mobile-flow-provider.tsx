"use client";

import * as React from "react";

interface MobileFlowState {
  /** true quando o usuário acabou de concluir o onboarding */
  tutorialPending: boolean;
  /** dispara o tutorial (chamado ao fim do onboarding) */
  triggerTutorial: () => void;
  /** consome o tutorial (ao fechar) */
  consumeTutorial: () => void;
}

const MobileFlowContext = React.createContext<MobileFlowState | null>(null);

/**
 * Estado do fluxo do app do consumidor, mantido EM MEMÓRIA (sem localStorage).
 * Persiste entre navegações dentro de /m porque o layout não remonta;
 * zera num reload — comportamento desejado para a demo.
 */
export function MobileFlowProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tutorialPending, setTutorialPending] = React.useState(false);

  const value = React.useMemo<MobileFlowState>(
    () => ({
      tutorialPending,
      triggerTutorial: () => setTutorialPending(true),
      consumeTutorial: () => setTutorialPending(false),
    }),
    [tutorialPending],
  );

  return (
    <MobileFlowContext.Provider value={value}>
      {children}
    </MobileFlowContext.Provider>
  );
}

export function useMobileFlow(): MobileFlowState {
  const ctx = React.useContext(MobileFlowContext);
  if (!ctx) {
    // fallback seguro fora do provider (ex.: testes isolados)
    return {
      tutorialPending: false,
      triggerTutorial: () => {},
      consumeTutorial: () => {},
    };
  }
  return ctx;
}
