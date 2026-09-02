"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, PartyPopper } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useMobileFlow } from "@/components/mobile-flow-provider";
import { salvarOnboardingAction } from "@/lib/actions/preferencias";
import { OPCOES_ONBOARDING } from "@/lib/preferencias";

const STEPS = OPCOES_ONBOARDING;

export default function OnboardingPage() {
  const router = useRouter();
  const { triggerTutorial } = useMobileFlow();

  const [step, setStep] = React.useState(0);
  const [done, setDone] = React.useState(false);
  const [answers, setAnswers] = React.useState<string[][]>(() =>
    STEPS.map(() => []),
  );

  function toggle(option: string) {
    setAnswers((prev) => {
      const next = prev.map((a) => [...a]);
      const list = next[step];
      const idx = list.indexOf(option);
      if (idx >= 0) list.splice(idx, 1);
      else list.push(option);
      return next;
    });
  }

  function prosseguir() {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else setDone(true);
  }

  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  async function aplicarCodigo() {
    setErro(null);
    setSalvando(true);
    const r = await salvarOnboardingAction(answers);
    setSalvando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    triggerTutorial();
    router.push("/m");
  }

  // ── Tela final (card azul) ─────────────────────────────
  if (done) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-5">
        <div className="w-full max-w-[340px] rounded-[24px] bg-primary p-8 text-center text-white shadow-xl">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-white/15">
            <PartyPopper className="h-8 w-8 text-yellow" />
          </div>
          <h2 className="text-2xl font-extrabold leading-tight">
            Sua experiência será completa!
          </h2>
          <p className="mt-2 text-sm text-white/80">
            Tudo pronto para você economizar de verdade na sua cidade.
          </p>
          {erro && (
            <p className="mt-3 text-sm font-semibold text-yellow">{erro}</p>
          )}
          <Button
            onClick={() => void aplicarCodigo()}
            disabled={salvando}
            className="mt-7 w-full bg-white text-primary hover:bg-white/90"
          >
            {salvando ? "Salvando…" : "Começar"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Passos do wizard ───────────────────────────────────
  const current = STEPS[step];

  return (
    <div className="flex flex-1 flex-col items-center justify-start p-5">
      <div className="my-2 w-full max-w-[360px] rounded-[24px] bg-surface p-6 shadow-xl">
        {/* header */}
        <div className="flex items-center gap-2">
          {step > 0 ? (
            <button
              type="button"
              aria-label="Voltar"
              onClick={() => setStep((s) => s - 1)}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="h-8 w-8" />
          )}
          <p className="flex-1 text-center text-sm font-bold text-foreground">
            Personalize Sua Experiencia
          </p>
          <span className="w-8 text-right text-xs font-semibold text-muted-foreground">
            {step + 1}/{STEPS.length}
          </span>
        </div>

        <Progress
          value={((step + 1) / STEPS.length) * 100}
          className="mt-3"
          indicatorClassName="bg-yellow"
        />

        <h2 className="mt-5 text-lg font-extrabold leading-snug">
          {current.q}
        </h2>

        <div className="mt-4 flex flex-col gap-2.5">
          {current.options.map((opt) => {
            const selected = answers[step].includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                aria-pressed={selected}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3.5 text-left text-sm transition-colors",
                  selected
                    ? "border-primary bg-primary/5 font-semibold"
                    : "border-border bg-surface hover:border-primary/40",
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-md border",
                    selected
                      ? "border-primary bg-primary text-white"
                      : "border-border",
                  )}
                >
                  {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>

        <Button onClick={prosseguir} variant="onYellow" className="mt-6 w-full">
          Prosseguir
        </Button>

        <button
          type="button"
          onClick={() => router.push("/m")}
          className="mt-3 w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          continuar depois
        </button>
      </div>
    </div>
  );
}
