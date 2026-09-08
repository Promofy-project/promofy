/**
 * Identidade versionada dos documentos legais do Promofy.
 *
 * Aceite grava (usuario, documento, versao, timestamp) em
 * `aceites_documento` — tabela genérica, sem update/delete (trilha).
 * A versão "atual" de cada documento vive AQUI, não no banco: mesmo
 * padrão que já existia para termos_consumidor antes deste módulo.
 *
 * FONTE PRIMÁRIA (LEGAL-PRIVACY-01H): os 5 arquivos .docx do cliente
 * agora estão em docs/legal/source/ — ver
 * docs/audits/2026-09-08-legal-source-of-truth.md. O texto completo,
 * extraído verbatim, vive em src/lib/legal-content/*.ts.
 *
 * STATUS DRAFT vs PUBLISHED (Fase 2/3 do WP 01H) — regra dura:
 * um documento só entra em DOCUMENTOS_REQUERIDOS_* (só pode gerar aceite
 * obrigatório / aparecer no gate) quando `status === "published"`. Hoje
 * os 5 documentos-fonte trazem "Última atualização: [DATA DE PUBLICAÇÃO]"
 * — um placeholder, não uma data real — então TODOS nascem "draft" aqui.
 * Isso não é bug: marcá-los "published" seria inventar que o documento
 * está vigente quando o próprio arquivo diz o contrário. Resultado
 * prático enquanto ficarem draft: o gate de reaceite não bloqueia
 * ninguém (`buscarPendenciasLegais` sempre devolve vazio), mas as
 * páginas /legal/[doc] já mostram o texto real, sinalizado como em
 * revisão.
 *
 * Trocar um documento para "published" é ato de conteúdo (edição deste
 * arquivo com data real vinda do cliente/jurídico), não decisão de
 * código — nenhuma migration nem deploy é necessário para isso.
 *
 * Módulo puro: sem server-only, sem DOM, sem Intl.
 */

export type StatusDocumentoLegal = "draft" | "published";

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

/** Canais de contato confirmados pela fonte primária — os 5 documentos
 * concordam entre si em `contato@usepromofy.com` / `privacidade@usepromofy.com`.
 * (LEGAL-PRIVACY-01 havia usado `@promofy.com.br` por falta de fonte —
 * corrigido aqui, não é uma decisão do cliente, é alinhar com o que os
 * próprios documentos já dizem, sem exceção, nos cinco arquivos.) */
export const EMAIL_CONTATO = "contato@usepromofy.com";
export const EMAIL_PRIVACIDADE = "privacidade@usepromofy.com";

export interface DocumentoLegal {
  documento: string;
  versao: string;
  /** Título curto para UI (gate de reaceite, tela de privacidade). */
  titulo: string;
  /** Slug da página pública em /legal/[doc]. */
  slug: string;
  status: StatusDocumentoLegal;
  /** ISO date. `null` enquanto draft — nenhuma data foi inventada. */
  publishedAt: string | null;
  effectiveAt: string | null;
  /** Só documentos published-e-requiresAcceptance entram no gate. */
  requiresAcceptance: boolean;
  /** Papéis para os quais este documento é relevante/exigível. */
  papeis: readonly ("consumidor" | "lojista")[];
}

export const DOC_TERMOS_CONSUMIDOR: DocumentoLegal = {
  documento: DOCUMENTO_TERMOS_CONSUMIDOR,
  versao: VERSAO_TERMOS_CONSUMIDOR,
  titulo: "Termos de Uso do Consumidor",
  slug: "termos-consumidor",
  status: "draft",
  publishedAt: null,
  effectiveAt: null,
  requiresAcceptance: true,
  papeis: ["consumidor"],
};

export const DOC_PRIVACIDADE: DocumentoLegal = {
  documento: DOCUMENTO_PRIVACIDADE,
  versao: VERSAO_PRIVACIDADE,
  titulo: "Política de Privacidade",
  slug: "privacidade",
  status: "draft",
  publishedAt: null,
  effectiveAt: null,
  requiresAcceptance: true,
  papeis: ["consumidor", "lojista"],
};

export const DOC_TERMOS_PARCEIRO: DocumentoLegal = {
  documento: DOCUMENTO_TERMOS_PARCEIRO,
  versao: VERSAO_TERMOS_PARCEIRO,
  titulo: "Termos de Uso do Parceiro",
  slug: "termos-parceiro",
  status: "draft",
  publishedAt: null,
  effectiveAt: null,
  requiresAcceptance: true,
  papeis: ["lojista"],
};

export const DOC_COOKIES: DocumentoLegal = {
  documento: DOCUMENTO_COOKIES,
  versao: VERSAO_COOKIES,
  titulo: "Política de Cookies",
  slug: "cookies",
  status: "draft",
  publishedAt: null,
  effectiveAt: null,
  // Mesmo se um dia virar "published": o documento descreve painel de
  // consentimento granular e cookies de terceiros (GA/Meta Ads) que não
  // existem no runtime (Fase 10 do WP 01H). Informativo, não é um aceite
  // bloqueante — igual à Política de Cookies nunca ter sido um checkbox
  // de cadastro em nenhum momento deste projeto.
  requiresAcceptance: false,
  papeis: ["consumidor", "lojista"],
};

export const DOC_PROMOPOINTS: DocumentoLegal = {
  documento: DOCUMENTO_PROMOPOINTS,
  versao: VERSAO_PROMOPOINTS,
  titulo: "Termo PromoPoints",
  slug: "promopoints",
  status: "draft",
  publishedAt: null,
  effectiveAt: null,
  // Termo descreve motor de fraude/estorno/banimento e valores de pontos
  // que não existem no runtime (config_pontos diverge — DECISÃO DO
  // CLIENTE). Gatear aceite antes disso seria fingir que o documento
  // já rege o que o produto faz.
  requiresAcceptance: false,
  papeis: ["consumidor"],
};

export const TODOS_DOCUMENTOS_LEGAIS: DocumentoLegal[] = [
  DOC_TERMOS_CONSUMIDOR,
  DOC_PRIVACIDADE,
  DOC_TERMOS_PARCEIRO,
  DOC_COOKIES,
  DOC_PROMOPOINTS,
];

/**
 * Regra dura do gate (Fase 2/3 LEGAL-PRIVACY-01H): só documento
 * `status === "published" && requiresAcceptance === true` para o papel
 * dado pode aparecer como pendência. Exportada (não só usada
 * internamente) para o teste automatizado poder provar a regra com
 * fixtures sintéticos, sem depender do status real dos 5 documentos
 * vigentes (que é draft hoje e pode virar published mais tarde).
 */
/**
 * Único ponto de decisão "este documento pode gerar um aceite novo
 * agora?" — usado tanto pelo filtro do gate quanto por
 * `registrarAceiteAction`. Extraído como função pura (sem `next/headers`)
 * para o teste automatizado poder provar a regra sem precisar de um
 * request Next real.
 */
export function documentoAceitavel(doc: DocumentoLegal): boolean {
  return doc.status === "published";
}

export function filtrarDocumentosRequeridos(
  docs: readonly DocumentoLegal[],
  papel: "consumidor" | "lojista",
): DocumentoLegal[] {
  return docs.filter(
    (d) => documentoAceitavel(d) && d.requiresAcceptance && d.papeis.includes(papel),
  );
}

/**
 * Computados, não curados à mão: um documento só entra aqui quando
 * `status === "published"`. Hoje, com os 5 em draft, ambas as listas
 * ficam vazias — o gate de reaceite não bloqueia ninguém até que um
 * documento seja formalmente publicado (edição deste arquivo).
 */
export const DOCUMENTOS_REQUERIDOS_CONSUMIDOR: DocumentoLegal[] = filtrarDocumentosRequeridos(
  TODOS_DOCUMENTOS_LEGAIS,
  "consumidor",
);
export const DOCUMENTOS_REQUERIDOS_PARCEIRO: DocumentoLegal[] = filtrarDocumentosRequeridos(
  TODOS_DOCUMENTOS_LEGAIS,
  "lojista",
);
