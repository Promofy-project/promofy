import { NextResponse, type NextRequest } from "next/server";

import {
  buildPdfBuffer,
  buildXlsxBuffer,
  labelFiltroCrm,
  nomeArquivoExport,
} from "@/lib/crm-export";
import {
  buscarContextoCrmDaSessao,
  buscarCrmExportDados,
  registrarCrmExportacao,
} from "@/lib/data/crm";
import type { CrmFiltro, CrmResumo } from "@/lib/crm-tipos";

const FILTROS: CrmFiltro[] = ["todos", "recentes", "recorrentes", "periodo_90d"];

function lerFiltro(raw: string | null): CrmFiltro {
  if (raw && (FILTROS as string[]).includes(raw)) return raw as CrmFiltro;
  return "todos";
}

function headersAnexo(filename: string, contentType: string): HeadersInit {
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  };
}

/**
 * Contexto CRM = `crm_contexto_sessao` (= `private.crm_estab_da_sessao`).
 * Query/body/header `estabelecimento_id` não é autoridade — nem é lido.
 */
async function garantirContextoCrm() {
  const ctx = await buscarContextoCrmDaSessao();
  if (!ctx.ok || !ctx.estabelecimentoId) return null;
  return ctx;
}

export async function GET_xlsx(request: NextRequest) {
  const ctx = await garantirContextoCrm();
  if (!ctx) {
    return NextResponse.json({ ok: false, motivo: "nao_autorizado" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q");
  const filtro = lerFiltro(sp.get("filtro"));

  const dados = await buscarCrmExportDados({ q, filtro });
  if (!dados.ok) {
    return NextResponse.json(
      { ok: false, motivo: dados.motivo ?? "erro" },
      { status: 403 },
    );
  }
  if (dados.estabelecimentoId !== ctx.estabelecimentoId) {
    return NextResponse.json({ ok: false, motivo: "contexto_divergente" }, { status: 403 });
  }

  const buffer = await buildXlsxBuffer(dados.clientes, dados.historico);
  await registrarCrmExportacao({
    formato: "xlsx",
    linhasClientes: dados.clientes.length,
    linhasHistorico: dados.historico.length,
    q,
    filtro,
  });

  const filename = nomeArquivoExport("xlsx");
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: headersAnexo(
      filename,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ),
  });
}

export async function GET_pdf(request: NextRequest) {
  const ctx = await garantirContextoCrm();
  if (!ctx) {
    return NextResponse.json({ ok: false, motivo: "nao_autorizado" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q");
  const filtro = lerFiltro(sp.get("filtro"));

  const dados = await buscarCrmExportDados({ q, filtro });
  if (!dados.ok) {
    return NextResponse.json(
      { ok: false, motivo: dados.motivo ?? "erro" },
      { status: 403 },
    );
  }
  if (dados.estabelecimentoId !== ctx.estabelecimentoId) {
    return NextResponse.json({ ok: false, motivo: "contexto_divergente" }, { status: 403 });
  }

  // Resumo derivado dos dados exportados (honestos; sem ticket/receita/LTV).
  const resumo: CrmResumo = {
    clientesUnicos: dados.clientes.length,
    novos30d: dados.clientes.filter((c) => {
      if (!c.primeiroResgate) return false;
      const t = Date.parse(c.primeiroResgate);
      return Number.isFinite(t) && t >= Date.now() - 30 * 86400e3;
    }).length,
    recorrentes: dados.clientes.filter((c) => c.totalResgates >= 2).length,
    resgatesConfirmados: dados.historico.length,
  };

  // Label do arquivo (não vai para o audit).
  const filtrosLabel = [
    labelFiltroCrm(filtro),
    q?.trim() ? `busca “${q.trim()}”` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  let buffer: Buffer;
  try {
    buffer = await buildPdfBuffer({
      estabelecimentoNome: ctx.nome ?? "",
      geradoEm: new Date(),
      filtrosLabel,
      resumo,
      clientes: dados.clientes,
      historico: dados.historico,
    });
  } catch {
    return NextResponse.json({ ok: false, motivo: "erro_pdf" }, { status: 500 });
  }

  await registrarCrmExportacao({
    formato: "pdf",
    linhasClientes: dados.clientes.length,
    linhasHistorico: dados.historico.length,
    q,
    filtro,
  });

  const filename = nomeArquivoExport("pdf");
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: headersAnexo(filename, "application/pdf"),
  });
}
