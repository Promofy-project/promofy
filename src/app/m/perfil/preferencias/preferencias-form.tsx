"use client";

import * as React from "react";

import { MobilePageHeader } from "@/components/mobile-page-header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  salvarPreferenciasAction,
  definirConsentimentoPersonalizacaoAction,
} from "@/lib/actions/preferencias";
import type { PreferenciasCanonicas } from "@/lib/preferencias";
import { consentimentoAtivo } from "@/lib/consentimento";
import type { ConsentimentoRegistro } from "@/lib/consentimento";

function Chip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={
        selected
          ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
          : "rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-muted-foreground"
      }
    >
      {label}
    </button>
  );
}

function toggleLista(lista: string[], id: string): string[] {
  return lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id];
}

export function PreferenciasForm({
  inicial,
  consentimento,
}: {
  inicial: PreferenciasCanonicas;
  consentimento: ConsentimentoRegistro | null;
}) {
  const [prefs, setPrefs] = React.useState(inicial);
  const [consente, setConsente] = React.useState(consentimentoAtivo(consentimento));
  const [salvando, setSalvando] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);

  async function salvar() {
    setErro(null);
    setMsg(null);
    setSalvando(true);
    const r = await salvarPreferenciasAction(prefs);
    const c = await definirConsentimentoPersonalizacaoAction(consente);
    setSalvando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    if (!c.ok) {
      setErro(c.erro);
      return;
    }
    setMsg("Preferências salvas.");
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex items-start justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3">
        <span>
          <span className="block text-sm font-bold">Recomendações personalizadas</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Recusar não impede o uso do Promofy. Sem este consentimento, a
            ordem das ofertas é neutra (popularidade real e novidade).
          </span>
        </span>
        <Switch checked={consente} onCheckedChange={setConsente} />
      </label>

      <section>
        <h2 className="text-sm font-bold">Objetivos</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            ["economizar_alimentacao", "Economizar em alimentação"],
            ["saude_bem_estar", "Saúde e bem-estar"],
            ["lazer_entretenimento", "Lazer"],
            ["servicos_essenciais", "Serviços"],
            ["produtos", "Produtos"],
          ].map(([id, label]) => (
            <Chip
              key={id}
              label={label}
              selected={prefs.objetivos.includes(id)}
              onToggle={() =>
                setPrefs((p) => ({ ...p, objetivos: toggleLista(p.objetivos, id) }))
              }
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold">Segmentos</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {["alimentacao", "fitness", "beleza", "entretenimento", "moda", "pet", "automotivo"].map(
            (id) => (
              <Chip
                key={id}
                label={id}
                selected={prefs.segmentos.includes(id)}
                onToggle={() =>
                  setPrefs((p) => ({ ...p, segmentos: toggleLista(p.segmentos, id) }))
                }
              />
            ),
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold">Categorias</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {["restaurante", "pizzaria", "academia", "salao-de-beleza", "cinema"].map((id) => (
            <Chip
              key={id}
              label={id}
              selected={prefs.categorias.includes(id)}
              onToggle={() =>
                setPrefs((p) => ({ ...p, categorias: toggleLista(p.categorias, id) }))
              }
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold">Estilo de consumo</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            ["local", "No local"],
            ["delivery_retirada", "Delivery / retirada"],
            ["casa", "Em casa"],
          ].map(([id, label]) => (
            <Chip
              key={id}
              label={label}
              selected={prefs.estiloConsumo.includes(id)}
              onToggle={() =>
                setPrefs((p) => ({ ...p, estiloConsumo: toggleLista(p.estiloConsumo, id) }))
              }
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold">Dias</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            ["uteis", "Dias úteis"],
            ["sabado", "Sábados"],
            ["domingo_feriado", "Domingos e feriados"],
          ].map(([id, label]) => (
            <Chip
              key={id}
              label={label}
              selected={prefs.dias.includes(id)}
              onToggle={() => setPrefs((p) => ({ ...p, dias: toggleLista(p.dias, id) }))}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold">Benefício preferido</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            ["desconto", "Desconto"],
            ["leve_mais_pague_menos", "Leve mais, pague menos"],
            ["combo", "Combo"],
          ].map(([id, label]) => (
            <Chip
              key={id}
              label={label}
              selected={prefs.beneficioPreferido.includes(id)}
              onToggle={() =>
                setPrefs((p) => ({
                  ...p,
                  beneficioPreferido: toggleLista(p.beneficioPreferido, id),
                }))
              }
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold">Pontos e recompensas</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            ["sim", "Sim"],
            ["talvez", "Talvez"],
            ["nao", "Não"],
          ].map(([id, label]) => (
            <Chip
              key={id}
              label={label}
              selected={prefs.gamificacao.includes(id)}
              onToggle={() =>
                setPrefs((p) => ({ ...p, gamificacao: toggleLista(p.gamificacao, id) }))
              }
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold">Cidade preferida</h2>
        <input
          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={prefs.locais[0]?.cidade ?? ""}
          onChange={(e) => {
            const cidade = e.target.value;
            setPrefs((p) => ({
              ...p,
              locais: cidade.trim() ? [{ cidade: cidade.trim() }] : [],
            }));
          }}
          placeholder="Ex.: São Paulo, SP"
        />
      </section>

      {erro && <p className="text-sm font-semibold text-danger">{erro}</p>}
      {msg && <p className="text-sm font-semibold text-success">{msg}</p>}

      <Button onClick={() => void salvar()} disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar preferências"}
      </Button>
    </div>
  );
}

export function PreferenciasShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <MobilePageHeader title="Preferências" back="/m/perfil" />
      <div className="px-4 pb-6 pt-4">{children}</div>
    </div>
  );
}
