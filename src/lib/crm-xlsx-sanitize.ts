/**
 * Escapa valores controlados pelo usuário antes de gravar em células Excel.
 *
 * Células que começam com `=`, `+`, `-` ou `@` podem ser interpretadas como
 * fórmula pelo Excel/LibreOffice (CSV/XLSX formula injection). Prefixo `'`
 * força texto — o Excel exibe o valor sem o apóstrofo na maioria dos casos.
 *
 * Módulo puro (sem server-only) para a suíte poder importar direto.
 */
export function escaparCelulaExcel(v: string): string {
  if (v.length === 0) return v;
  const primeiro = v.charAt(0);
  if (primeiro === "=" || primeiro === "+" || primeiro === "-" || primeiro === "@") {
    return `'${v}`;
  }
  return v;
}
