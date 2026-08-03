"use client";

import * as React from "react";
import { Check } from "lucide-react";

import type { CategoriaId, Cupom } from "@/lib/types";
import { DIAS_SEMANA } from "@/lib/dias";
import {
  FORMAS_CONSUMO,
  PRAZO_ATIVACAO_MIN_HORAS,
  TAXAS,
} from "@/lib/cupom-campos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CouponCard } from "@/components/coupon-card";
import type { ItemCupomPortal } from "@/components/portal/cupons-seed";
import { criarCupomAction, editarCupomAction } from "@/lib/actions/cupons";
import type { CupomParaEdicao } from "@/lib/data/cupons";

// formato canônico dos dias vive em src/lib/dias.ts (Fase 4)
const DIAS = DIAS_SEMANA;

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Formulário de cupom do portal — CRIAR e EDITAR no mesmo componente
 * (Fase 6.5/C2). O portal é a tela completa: controla todos os campos, então
 * o payload de edição carrega todos eles. Quem tem subconjunto é o `/e`.
 */
export function NovoCupomForm({
  estabelecimentoNome,
  categorias,
  categoriaPrincipal,
  cupomInicial,
  onSalvar,
  onCancelar,
}: {
  estabelecimentoNome: string;
  categorias: { id: string; label: string }[];
  categoriaPrincipal: string | null;
  /** Presente = modo EDITAR (DTO fiel à linha, ver buscarCupomParaEdicao). */
  cupomInicial?: CupomParaEdicao;
  onSalvar: (item: ItemCupomPortal) => void;
  onCancelar: () => void;
}) {
  const editando = Boolean(cupomInicial);
  const [titulo, setTitulo] = React.useState(cupomInicial?.titulo ?? "");
  const [beneficio, setBeneficio] = React.useState(cupomInicial?.beneficio ?? "");
  // Fase 4: o estabelecimento pode ter N categorias — seleção entre elas,
  // principal pré-setada. O servidor valida contra o conjunto (junção).
  const [categoriaSel, setCategoriaSel] = React.useState<string>(
    cupomInicial?.categoriaId ?? categoriaPrincipal ?? categorias[0]?.id ?? "alimentacao",
  );
  const categoria = categoriaSel as CategoriaId;
  const categoriaLabel =
    categorias.find((c) => c.id === categoriaSel)?.label ?? categoriaSel;
  const [economia, setEconomia] = React.useState(
    cupomInicial ? String(cupomInicial.economia) : "",
  );
  // Fase 6/C3: com a flag, `economia` passa a ser o MÍNIMO garantido.
  const [economiaVariavel, setEconomiaVariavel] = React.useState(
    cupomInicial?.economiaVariavel ?? false,
  );
  // Fase 6/C1: multivalorados, saneados de novo no servidor.
  const [taxas, setTaxas] = React.useState<string[]>(cupomInicial?.taxas ?? []);
  const [formasConsumo, setFormasConsumo] = React.useState<string[]>(
    cupomInicial?.formasConsumo ?? [],
  );
  const [limiteUsuarioIlimitado, setLimiteUsuarioIlimitado] = React.useState(
    cupomInicial ? cupomInicial.limiteUsuario === null : false,
  );
  const [limiteTotalIlimitado, setLimiteTotalIlimitado] = React.useState(
    cupomInicial ? cupomInicial.limiteTotal === null : false,
  );
  const [validade, setValidade] = React.useState(cupomInicial?.validadeFim ?? "");
  const [dataInicio, setDataInicio] = React.useState(cupomInicial?.validadeInicio ?? "");
  const [ocultarAteInicio, setOcultarAteInicio] = React.useState(
    cupomInicial?.ocultarAteInicio ?? false,
  );
  const [prazoAtivacao, setPrazoAtivacao] = React.useState(
    cupomInicial ? String(cupomInicial.prazoAtivacaoHoras) : "5",
  );
  // Cupom legado sem janela estruturada abre com os campos vazios — e o
  // `horarioIncompleto` abaixo só cobra hora quando há dias marcados.
  const [dias, setDias] = React.useState<string[]>(
    cupomInicial ? cupomInicial.dias : ["Sex", "Sáb", "Dom"],
  );
  const [horaInicio, setHoraInicio] = React.useState(
    cupomInicial ? cupomInicial.horaInicio : "18:00",
  );
  const [horaFim, setHoraFim] = React.useState(
    cupomInicial ? cupomInicial.horaFim : "23:00",
  );
  const [limiteUsuario, setLimiteUsuario] = React.useState(
    cupomInicial?.limiteUsuario != null ? String(cupomInicial.limiteUsuario) : "1",
  );
  const [limiteTotal, setLimiteTotal] = React.useState(
    cupomInicial?.limiteTotal != null ? String(cupomInicial.limiteTotal) : "500",
  );
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  const toggleDia = (d: string) =>
    setDias((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );

  /** Alterna um id numa lista multivalorada (taxas / formas de consumo). */
  const toggleEm = (
    set: React.Dispatch<React.SetStateAction<string[]>>,
    id: string,
  ) =>
    set((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const previewCupom: Cupom = {
    id: "preview",
    titulo: titulo || "Título do seu cupom",
    estabelecimento: estabelecimentoNome,
    estabelecimentoId: "preview",
    categoria,
    economia: Number(economia) || 0,
    economiaVariavel,
    taxas,
    formasConsumo,
    distanciaKm: 1.2,
    rating: 0,
    avaliacoes: 0,
    validade: validade || "2026-12-31",
    status: "ativo",
    imagem: "",
    beneficio: beneficio || "Descreva o benefício da oferta",
    regras: beneficio ? [beneficio] : [],
    horarios: `${horaInicio} às ${horaFim}`,
    destaque: false,
  };

  // Fase 5 — se o cupom restringe dias, precisa restringir horário também:
  // desde que a janela de consumo virou barreira no servidor, um cupom com
  // dias e horário em branco é ambíguo para quem cadastra. Os <input
  // type="time"> não são `required`, então a checagem vive aqui.
  const horaValida = (h: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(h.trim());
  const horarioIncompleto =
    dias.length > 0 && !(horaValida(horaInicio) && horaValida(horaFim));

  // Fase 6: o mínimo de 5h é regra de negócio (o consumidor precisa de
  // tempo para chegar ao balcão). Aqui é só aviso — quem recusa é a
  // Server Action, e o CHECK da coluna cobre o PostgREST direto.
  const prazoInvalido =
    prazoAtivacao.trim().length > 0 &&
    Number(prazoAtivacao) < PRAZO_ATIVACAO_MIN_HORAS;

  // validade agora é obrigatória (a coluna é NOT NULL no banco)
  const podeSalvar =
    titulo.trim().length > 0 &&
    Number(economia) > 0 &&
    validade.length > 0 &&
    !horarioIncompleto &&
    !prazoInvalido;

  const salvar = async () => {
    if (!podeSalvar || salvando) return;
    setErro(null);
    setSalvando(true);
    // Payload montado SEMPRE a partir dos estados que este form controla —
    // nunca de literais. Aqui o portal controla todos, então criar e editar
    // mandam o mesmo conjunto; no `/e` (subconjunto) isso não vale.
    const campos = {
      titulo,
      beneficio,
      categoria,
      economia: Number(economia),
      economiaVariavel,
      validade,
      ocultarAteInicio,
      prazoAtivacao: Number(prazoAtivacao) || PRAZO_ATIVACAO_MIN_HORAS,
      dias,
      horaInicio,
      horaFim,
      limiteUsuario: Number(limiteUsuario) || 1,
      limiteTotal: Number(limiteTotal) || 1,
      limiteUsuarioIlimitado,
      limiteTotalIlimitado,
      taxas,
      formasConsumo,
    };
    // estabelecimento_id é derivado no SERVIDOR (owner_id) — nunca do form
    const r = cupomInicial
      ? await editarCupomAction({
          id: cupomInicial.id,
          ...campos,
          // `null` (e não `undefined`) para LIMPAR o agendamento de propósito:
          // no contrato parcial, `undefined` significaria "não mexer".
          dataInicio: dataInicio || null,
          // `regras` é campo próprio (EXTRA da fase) e este form ainda não o
          // edita — fica de fora do payload em vez de virar cópia do benefício.
        })
      : await criarCupomAction({ ...campos, dataInicio: dataInicio || undefined });
    setSalvando(false);
    if (r.ok) {
      onSalvar(r.item);
    } else {
      setErro(r.erro);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Formulário */}
      <Card className="p-5 lg:p-6">
        <h2 className="text-lg font-bold">{editando ? "Editar oferta" : "Dados da oferta"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha os campos — a pré-visualização atualiza em tempo real.
        </p>

        <div className="mt-5 flex flex-col gap-4">
          <Field label="Título" htmlFor="f-titulo">
            <Input
              id="f-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Rodízio de pizza em dobro"
            />
          </Field>

          <Field label="Benefício / descrição" htmlFor="f-beneficio">
            <Input
              id="f-beneficio"
              value={beneficio}
              onChange={(e) => setBeneficio(e.target.value)}
              placeholder="Ex.: 2 rodízios pelo preço de 1"
            />
          </Field>

          <Field label="Categoria">
            {categorias.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {categorias.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoriaSel(c.id)}
                    className={cn(
                      "h-9 rounded-lg border px-3 text-sm font-semibold transition-colors",
                      categoriaSel === c.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex h-11 items-center justify-between rounded-btn border border-border bg-muted/60 px-3.5 text-sm">
                <span className="font-medium text-foreground">{categoriaLabel}</span>
                <span className="text-xs text-muted-foreground">
                  definida pelo estabelecimento
                </span>
              </div>
            )}
          </Field>

          {/* Fase 6/C3: com "variável", o valor deixa de ser exato e vira
              o PISO — o app passa a exibir "a partir de R$ X" no cupom e
              "mais de R$ X" no total do consumidor. */}
          <Field
            label={economiaVariavel ? "Economia mínima garantida (R$)" : "Economia (R$)"}
            htmlFor="f-economia"
          >
            <Input
              id="f-economia"
              type="number"
              min={0}
              value={economia}
              onChange={(e) => setEconomia(e.target.value)}
              placeholder="45"
            />
          </Field>

          <label
            htmlFor="f-economia-variavel"
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
          >
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                Economia variável
              </span>
              <span className="text-xs text-muted-foreground">
                O cliente economiza <b>pelo menos</b> esse valor — pode ser mais.
              </span>
            </span>
            <Switch
              id="f-economia-variavel"
              checked={economiaVariavel}
              onCheckedChange={setEconomiaVariavel}
            />
          </label>

          <Field label="Formas de consumo">
            <div className="flex flex-wrap gap-2">
              {FORMAS_CONSUMO.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggleEm(setFormasConsumo, f.id)}
                  aria-pressed={formasConsumo.includes(f.id)}
                  className={cn(
                    "h-9 rounded-lg border px-3 text-sm font-semibold transition-colors",
                    formasConsumo.includes(f.id)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              Onde o cupom vale. Sem seleção, o app não exibe esta informação.
            </span>
          </Field>

          <Field label="Taxas NÃO cobertas pelo benefício">
            <div className="flex flex-wrap gap-2">
              {TAXAS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleEm(setTaxas, t.id)}
                  aria-pressed={taxas.includes(t.id)}
                  className={cn(
                    "h-9 rounded-lg border px-3 text-sm font-semibold transition-colors",
                    taxas.includes(t.id)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              O cliente vê &ldquo;não inclui…&rdquo; — evita discussão no balcão.
            </span>
          </Field>

          {/* Início à ESQUERDA, validade à direita — ordem de leitura do
              período (pedido do cliente). Só o layout muda: o que é salvo
              continua validade_inicio / validade_fim, sem inversão. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data de início" htmlFor="f-inicio">
              <Input
                id="f-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </Field>
            <Field label="Validade da oferta" htmlFor="f-validade">
              <Input
                id="f-validade"
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
              />
            </Field>
          </div>

          <label
            htmlFor="f-ocultar"
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
          >
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                Ocultar cupom até a data de início
              </span>
              <span className="text-xs text-muted-foreground">
                O cupom só aparece a partir do início da campanha.
              </span>
            </span>
            <Switch
              id="f-ocultar"
              checked={ocultarAteInicio}
              onCheckedChange={setOcultarAteInicio}
            />
          </label>

          <Field label="Prazo de ativação (horas)" htmlFor="f-prazo">
            <Input
              id="f-prazo"
              type="number"
              min={PRAZO_ATIVACAO_MIN_HORAS}
              value={prazoAtivacao}
              onChange={(e) => setPrazoAtivacao(e.target.value)}
              placeholder={String(PRAZO_ATIVACAO_MIN_HORAS)}
            />
            {prazoInvalido && (
              <span className="text-xs font-medium text-danger">
                Mínimo de {PRAZO_ATIVACAO_MIN_HORAS} horas — é o tempo que o
                cliente tem para chegar ao estabelecimento.
              </span>
            )}
          </Field>

          <Field label="Dias de consumo">
            <div className="flex flex-wrap gap-2">
              {DIAS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDia(d)}
                  className={cn(
                    "h-9 w-12 rounded-lg border text-sm font-semibold transition-colors",
                    dias.includes(d)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Início do horário" htmlFor="f-hi">
              <Input
                id="f-hi"
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </Field>
            <Field label="Fim do horário" htmlFor="f-hf">
              <Input
                id="f-hf"
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
              />
            </Field>
          </div>
          {horarioIncompleto && (
            <p className="-mt-1 text-xs font-medium text-danger">
              Preencha início e fim do horário — o cupom só pode ser usado nos
              dias e no horário definidos aqui.
            </p>
          )}

          {/* Fase 6/C1: "ilimitado" explícito e SEPARADO nos dois limites.
              Marcado, o servidor grava NULL — o mesmo vocabulário que
              `limite_total` já usava desde o começo. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Limite por usuário" htmlFor="f-lu">
              <Input
                id="f-lu"
                type="number"
                min={1}
                value={limiteUsuario}
                onChange={(e) => setLimiteUsuario(e.target.value)}
                placeholder="1"
                disabled={limiteUsuarioIlimitado}
              />
              <label
                htmlFor="f-lu-ilimitado"
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
              >
                <Switch
                  id="f-lu-ilimitado"
                  checked={limiteUsuarioIlimitado}
                  onCheckedChange={setLimiteUsuarioIlimitado}
                />
                Ilimitado por usuário
              </label>
            </Field>
            <Field label="Limite total" htmlFor="f-lt">
              <Input
                id="f-lt"
                type="number"
                min={1}
                value={limiteTotal}
                onChange={(e) => setLimiteTotal(e.target.value)}
                placeholder="500"
                disabled={limiteTotalIlimitado}
              />
              <label
                htmlFor="f-lt-ilimitado"
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
              >
                <Switch
                  id="f-lt-ilimitado"
                  checked={limiteTotalIlimitado}
                  onCheckedChange={setLimiteTotalIlimitado}
                />
                Sem limite total
              </label>
            </Field>
          </div>
        </div>

        {erro && (
          <p className="mt-4 text-sm font-medium text-danger">{erro}</p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={salvar} disabled={!podeSalvar || salvando}>
            <Check className="h-4 w-4" /> {salvando ? "Salvando…" : editando ? "Salvar alteracoes" : "Salvar cupom"}
          </Button>
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </Card>

      {/* Pré-visualização ao vivo */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Pré-visualização ao vivo
        </p>
        <CouponCard cupom={previewCupom} ctaLabel="Usar agora" />
        <Card className="mt-4 p-4">
          <h3 className="text-sm font-bold">Resumo da campanha</h3>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Início</dt>
              <dd className="font-medium">{dataInicio || "—"}</dd>
            </div>
            {ocultarAteInicio && dataInicio && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Visibilidade</dt>
                <dd className="font-medium">Oculto até {dataInicio}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Dias</dt>
              <dd className="text-right font-medium">
                {dias.length ? dias.join(", ") : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Horário</dt>
              <dd className="font-medium">
                {horaInicio} às {horaFim}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Ativação em até</dt>
              <dd className="font-medium">{prazoAtivacao || "—"}h</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Limite / usuário</dt>
              <dd className="font-medium">{limiteUsuarioIlimitado ? "Ilimitado" : limiteUsuario || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Limite total</dt>
              <dd className="font-medium">{limiteTotalIlimitado ? "Ilimitado" : limiteTotal || "—"}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
