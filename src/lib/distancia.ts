/**
 * Distância geográfica (haversine) em km.
 *
 * Coordenadas do CONSUMIDOR não entram aqui como persistência — quem
 * chama passa lat/lng já obtidos no dispositivo, depois da autorização.
 * Estabelecimento pode ter lat/lng públicas.
 *
 * Módulo puro: sem server-only, sem DOM, sem Intl.
 */

const RAIO_TERRA_KM = 6371;

function paraRad(graus: number): number {
  return (graus * Math.PI) / 180;
}

export function coordenadasValidas(
  lat: unknown,
  lng: unknown,
): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Distância em km entre dois pontos. `null` se algum lado for inválido
 * — nunca inventa localização.
 */
export function distanciaKm(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
): number | null {
  if (!coordenadasValidas(latA, lngA) || !coordenadasValidas(latB, lngB)) {
    return null;
  }
  const dLat = paraRad(latB - latA);
  const dLng = paraRad(lngB - lngA);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(paraRad(latA)) *
      Math.cos(paraRad(latB)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return RAIO_TERRA_KM * c;
}

export function ordenarPorDistancia<T>(
  itens: T[],
  origem: { lat: number; lng: number } | null,
  coordsDe: (item: T) => { lat: number | null; lng: number | null },
): { item: T; km: number | null }[] {
  const comKm = itens.map((item) => {
    const c = coordsDe(item);
    const km =
      origem && c.lat != null && c.lng != null
        ? distanciaKm(origem.lat, origem.lng, c.lat, c.lng)
        : null;
    return { item, km };
  });
  if (!origem) return comKm;
  return comKm.sort((a, b) => {
    if (a.km == null && b.km == null) return 0;
    if (a.km == null) return 1;
    if (b.km == null) return -1;
    if (a.km !== b.km) return a.km - b.km;
    return 0;
  });
}

export const TEXTO_GEO_NEGADO =
  "Ative sua localização para ver os mais próximos.";
