import { Megaphone, Eye, EyeOff } from "lucide-react";

import { buscarAvisosDoLojista } from "@/lib/data/avisos";
import { formatDateTimeBRT } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

/**
 * Mural no portal web (Fase 8/M1).
 *
 * MESMO fetcher do `/e` — `buscarAvisosDoLojista`. O que muda é o layout:
 * aqui é gestão (tudo visível de uma vez, corpo aberto, métrica no topo), lá
 * é totem (cartão grande, um por vez, abrir marca como lido).
 *
 * Esta tela NÃO marca como lido. Marcar exigiria a interação de abrir, que no
 * layout de gestão não existe — tudo já está aberto. Quem confirma leitura é
 * o app do balcão, onde o lojista de fato lê. Consequência assumida: abrir o
 * portal não zera o badge do `/e`.
 */
export default async function PortalMural() {
  const avisos = await buscarAvisosDoLojista();
  const naoLidos = avisos.filter((a) => !a.lido).length;

  return (
    <>
      <PageHeader
        title="Mural"
        description="Recados da equipe Promofy para o seu estabelecimento."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Recados recebidos" value={String(avisos.length)} icon="Megaphone" />
        <MetricCard label="Não lidos" value={String(naoLidos)} icon="Eye" />
        <MetricCard
          label="Último recado"
          value={avisos[0] ? formatDateTimeBRT(avisos[0].publicadoEm).slice(0, 10) : "—"}
          icon="CalendarClock"
        />
      </div>

      {avisos.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center gap-3 p-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
            <Megaphone className="h-6 w-6 text-muted-foreground" aria-hidden />
          </div>
          <p className="font-semibold">Nenhum recado ainda</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Quando a equipe Promofy publicar um aviso, ele aparece aqui e no app do balcão.
          </p>
        </Card>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {avisos.map((a) => (
            <li key={a.id}>
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-bold leading-snug">{a.titulo}</h3>
                  <Badge variant={a.lido ? "muted" : "yellow-soft"} className="shrink-0">
                    <span className="inline-flex items-center gap-1">
                      {a.lido ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {a.lido ? "Lido" : "Não lido"}
                    </span>
                  </Badge>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                  {a.corpo}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {formatDateTimeBRT(a.publicadoEm)}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
