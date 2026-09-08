/**
 * Identidade versionada dos documentos legais do Promofy.
 *
 * Aceite grava (usuario, documento, versao, timestamp) em
 * `aceites_documento` — tabela genérica, sem update/delete (trilha).
 * A versão "atual" de cada documento vive AQUI, não no banco: o texto
 * jurídico integral não está versionado neste repositório (ver
 * docs/audits/2026-09-02-final-client-audit.md §1.3 e
 * docs/audits/2026-09-08-legal-privacy-gap-analysis.md) — só o
 * identificador e o número de versão, para a mecânica de aceite/reaceite
 * funcionar sem depender do texto estar publicado.
 *
 * PromoPoints não entra na lista de REQUERIDOS: o Termo v1 (WP) diverge
 * dos valores de `config_pontos` em runtime (DECISÃO DO CLIENTE, Parte 20
 * do audit acima) — gatear aceite antes dos valores estarem decididos
 * seria fingir que o documento é definitivo. Fica pronto para entrar na
 * lista assim que a decisão vier.
 *
 * Módulo puro: sem server-only, sem DOM, sem Intl.
 */

export const DOCUMENTO_TERMOS_CONSUMIDOR = "termos_consumidor";
export const VERSAO_TERMOS_CONSUMIDOR = "2.0";

export const DOCUMENTO_PRIVACIDADE = "privacidade";
export const VERSAO_PRIVACIDADE = "2.0";

export const DOCUMENTO_TERMOS_PARCEIRO = "termos_parceiro";
export const VERSAO_TERMOS_PARCEIRO = "3.0";

export const DOCUMENTO_COOKIES = "cookies";
export const VERSAO_COOKIES = "2.0";

export const DOCUMENTO_PROMOPOINTS = "promopoints";
export const VERSAO_PROMOPOINTS = "1.0";

export interface DocumentoLegal {
  documento: string;
  versao: string;
  /** Título curto para UI (gate de reaceite, tela de privacidade). */
  titulo: string;
  /** Slug da página pública em /legal/[doc]. */
  slug: string;
}

export const DOC_TERMOS_CONSUMIDOR: DocumentoLegal = {
  documento: DOCUMENTO_TERMOS_CONSUMIDOR,
  versao: VERSAO_TERMOS_CONSUMIDOR,
  titulo: "Termos de Uso do Consumidor",
  slug: "termos-consumidor",
};

export const DOC_PRIVACIDADE: DocumentoLegal = {
  documento: DOCUMENTO_PRIVACIDADE,
  versao: VERSAO_PRIVACIDADE,
  titulo: "Política de Privacidade",
  slug: "privacidade",
};

export const DOC_TERMOS_PARCEIRO: DocumentoLegal = {
  documento: DOCUMENTO_TERMOS_PARCEIRO,
  versao: VERSAO_TERMOS_PARCEIRO,
  titulo: "Termos de Uso do Parceiro",
  slug: "termos-parceiro",
};

export const DOC_COOKIES: DocumentoLegal = {
  documento: DOCUMENTO_COOKIES,
  versao: VERSAO_COOKIES,
  titulo: "Política de Cookies",
  slug: "cookies",
};

export const DOC_PROMOPOINTS: DocumentoLegal = {
  documento: DOCUMENTO_PROMOPOINTS,
  versao: VERSAO_PROMOPOINTS,
  titulo: "Termo PromoPoints",
  slug: "promopoints",
};

/** Documentos com aceite obrigatório por papel. Cookies e PromoPoints são
 * informativos/condicionais — não entram no gate de bloqueio. */
export const DOCUMENTOS_REQUERIDOS_CONSUMIDOR: DocumentoLegal[] = [
  DOC_TERMOS_CONSUMIDOR,
  DOC_PRIVACIDADE,
];

export const DOCUMENTOS_REQUERIDOS_PARCEIRO: DocumentoLegal[] = [
  DOC_TERMOS_PARCEIRO,
  DOC_PRIVACIDADE,
];

export const TODOS_DOCUMENTOS_LEGAIS: DocumentoLegal[] = [
  DOC_TERMOS_CONSUMIDOR,
  DOC_PRIVACIDADE,
  DOC_TERMOS_PARCEIRO,
  DOC_COOKIES,
  DOC_PROMOPOINTS,
];
