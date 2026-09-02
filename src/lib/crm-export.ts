import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

import { escaparCelulaExcel } from "./crm-xlsx-sanitize";
import type {
  CrmClienteResumo,
  CrmExportHistoricoItem,
  CrmResumo,
} from "./crm-tipos";

function celula(v: string | null | undefined): string {
  return escaparCelulaExcel((v ?? "").trim());
}

function fmtData(iso: string | null | undefined): string {
  if (!iso) return "";
  // ISO → YYYY-MM-DD (sem Intl — builders rodam no Node do servidor Next)
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : iso;
}

function fmtEconomia(
  economia: number | null | undefined,
  variavel: boolean | undefined,
): string {
  if (variavel) return "Variável";
  if (economia == null || Number.isNaN(economia)) return "";
  return economia.toFixed(2).replace(".", ",");
}

/**
 * Gera XLSX com abas Clientes e Histórico.
 * Sem CPF, sem usuario_id nas colunas exportadas.
 */
export async function buildXlsxBuffer(
  clientes: CrmClienteResumo[],
  historico: CrmExportHistoricoItem[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Promofy";
  wb.created = new Date();

  const sheetClientes = wb.addWorksheet("Clientes", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheetClientes.columns = [
    { header: "Nome", key: "nome", width: 28 },
    { header: "E-mail", key: "email", width: 32 },
    { header: "Telefone", key: "telefone", width: 16 },
    { header: "Nascimento", key: "nascimento", width: 14 },
    { header: "Total de resgates", key: "total", width: 16 },
    { header: "Primeiro resgate", key: "primeiro", width: 16 },
    { header: "Último resgate", key: "ultimo", width: 16 },
  ];
  sheetClientes.getRow(1).font = { bold: true };

  for (const c of clientes) {
    sheetClientes.addRow({
      nome: celula(c.nome),
      email: celula(c.email),
      telefone: celula(c.telefone),
      nascimento: celula(c.nascimento),
      total: c.totalResgates,
      primeiro: fmtData(c.primeiroResgate),
      ultimo: fmtData(c.ultimoResgate),
    });
  }

  const sheetHist = wb.addWorksheet("Histórico", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheetHist.columns = [
    { header: "Cliente", key: "nome", width: 28 },
    { header: "Cupom", key: "titulo", width: 28 },
    { header: "Benefício", key: "beneficio", width: 32 },
    { header: "Economia (R$)", key: "economia", width: 14 },
    { header: "Validado em", key: "validado", width: 16 },
    { header: "Status", key: "status", width: 12 },
    { header: "NPS", key: "nps", width: 8 },
  ];
  sheetHist.getRow(1).font = { bold: true };

  for (const h of historico) {
    sheetHist.addRow({
      nome: celula(h.nome),
      titulo: celula(h.titulo),
      beneficio: celula(h.beneficio),
      economia: fmtEconomia(h.economia, h.economiaVariavel),
      validado: fmtData(h.validadoEm),
      status: celula(h.status),
      nps: h.nps == null ? "" : h.nps,
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export interface PdfExportInput {
  estabelecimentoNome: string;
  geradoEm: Date;
  filtrosLabel: string;
  resumo: CrmResumo;
  clientes: CrmClienteResumo[];
  historico?: CrmExportHistoricoItem[];
}

/**
 * PDF em português: cabeçalho Promofy + estabelecimento + data, resumo e
 * lista de clientes (histórico opcional em páginas seguintes).
 */
export async function buildPdfBuffer(input: PdfExportInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: {
        Title: `Clientes — ${input.estabelecimentoNome}`,
        Author: "Promofy",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const dataStr = input.geradoEm.toISOString().slice(0, 10);

    doc.fontSize(16).font("Helvetica-Bold").text("Promofy", { continued: false });
    doc.moveDown(0.3);
    doc.fontSize(12).font("Helvetica").text(input.estabelecimentoNome);
    doc.fontSize(10).fillColor("#555555").text(`Gerado em ${dataStr}`);
    if (input.filtrosLabel) {
      doc.text(`Filtros: ${input.filtrosLabel}`);
    }
    doc.fillColor("#000000");
    doc.moveDown();

    doc.fontSize(11).font("Helvetica-Bold").text("Resumo");
    doc.font("Helvetica").fontSize(10);
    doc.text(`Clientes únicos: ${input.resumo.clientesUnicos}`);
    doc.text(`Novos (30 dias): ${input.resumo.novos30d}`);
    doc.text(`Recorrentes (≥2 resgates): ${input.resumo.recorrentes}`);
    doc.text(`Resgates confirmados: ${input.resumo.resgatesConfirmados}`);
    doc.moveDown();

    doc.fontSize(11).font("Helvetica-Bold").text("Clientes");
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(9);

    for (const c of input.clientes) {
      const linha =
        `${celulaTexto(c.nome)} · ${celulaTexto(c.email)} · ` +
        `${c.totalResgates} resgate(s) · último ${fmtData(c.ultimoResgate) || "—"}`;
      doc.text(linha, { width: doc.page.width - 96 });
      if (doc.y > doc.page.height - 72) {
        doc.addPage();
        doc.fontSize(9).font("Helvetica");
      }
    }

    if (input.historico && input.historico.length > 0) {
      doc.addPage();
      doc.fontSize(11).font("Helvetica-Bold").text("Histórico de resgates");
      doc.moveDown(0.4);
      doc.font("Helvetica").fontSize(9);
      for (const h of input.historico) {
        const linha =
          `${fmtData(h.validadoEm) || "—"} · ${celulaTexto(h.nome)} · ` +
          `${celulaTexto(h.titulo)} · ${fmtEconomia(h.economia, h.economiaVariavel)}`;
        doc.text(linha, { width: doc.page.width - 96 });
        if (doc.y > doc.page.height - 72) {
          doc.addPage();
          doc.fontSize(9).font("Helvetica");
        }
      }
    }

    doc.end();
  });
}

function celulaTexto(v: string | null | undefined): string {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : "Não informado";
}

export function labelFiltroCrm(filtro: string | null | undefined): string {
  switch (filtro) {
    case "recentes":
      return "Recentes (30 dias)";
    case "recorrentes":
      return "Recorrentes";
    case "periodo_90d":
      return "Últimos 90 dias";
    default:
      return "Todos";
  }
}

export function nomeArquivoExport(ext: "xlsx" | "pdf", quando = new Date()): string {
  const d = quando.toISOString().slice(0, 10);
  return `promofy-clientes-${d}.${ext}`;
}
