// Geometria para o modo "grade": divide uma área (município, polígono GeoJSON ou círculo)
// em pontos; cada ponto vira uma busca com viés de coordenada (zoom 14 a 17).

const KM_POR_GRAU_LAT = 110.574;
const kmPorGrauLon = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180);

// Densidades oferecidas na interface: espaçamento entre pontos e zoom enviado ao Maps.
export const DENSIDADES = {
  larga: { espacamentoKm: 2, zoom: 14 },
  media: { espacamentoKm: 1, zoom: 15 },
  densa: { espacamentoKm: 0.5, zoom: 16 },
  muito_densa: { espacamentoKm: 0.25, zoom: 17 },
};

function poligonos(geometria) {
  if (!geometria) return [];
  if (geometria.type === 'Polygon') return [geometria.coordinates];
  if (geometria.type === 'MultiPolygon') return geometria.coordinates;
  if (geometria.type === 'Feature') return poligonos(geometria.geometry);
  if (geometria.type === 'FeatureCollection') return geometria.features.flatMap((f) => poligonos(f.geometry));
  return [];
}

function dentroDoAnel(lon, lat, anel) {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

export function pontoNaGeometria(lat, lon, geometria) {
  for (const poli of poligonos(geometria)) {
    if (!poli.length || !dentroDoAnel(lon, lat, poli[0])) continue;
    if (poli.slice(1).some((buraco) => dentroDoAnel(lon, lat, buraco))) continue;
    return true;
  }
  return false;
}

export function caixaLimite(geometria) {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const poli of poligonos(geometria)) {
    for (const [lon, lat] of poli[0]) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
  }
  return { minLat, maxLat, minLon, maxLon };
}

export function centro(geometria) {
  const c = caixaLimite(geometria);
  return { lat: (c.minLat + c.maxLat) / 2, lon: (c.minLon + c.maxLon) / 2 };
}

export function circulo(lat, lon, raioKm, lados = 48) {
  const anel = [];
  for (let i = 0; i <= lados; i++) {
    const a = (2 * Math.PI * i) / lados;
    anel.push([lon + (raioKm * Math.cos(a)) / kmPorGrauLon(lat), lat + (raioKm * Math.sin(a)) / KM_POR_GRAU_LAT]);
  }
  return { type: 'Polygon', coordinates: [anel] };
}

export function gerarGrade(geometria, espacamentoKm) {
  const c = caixaLimite(geometria);
  if (!Number.isFinite(c.minLat)) return [];
  const passoLat = espacamentoKm / KM_POR_GRAU_LAT;
  const pontos = [];
  for (let lat = c.minLat + passoLat / 2; lat <= c.maxLat; lat += passoLat) {
    const passoLon = espacamentoKm / kmPorGrauLon(lat);
    for (let lon = c.minLon + passoLon / 2; lon <= c.maxLon; lon += passoLon) {
      if (pontoNaGeometria(lat, lon, geometria)) pontos.push({ lat, lon });
    }
  }
  if (!pontos.length) pontos.push(centro(geometria));
  return pontos;
}

export function validarGeoJson(geo) {
  const lista = poligonos(geo);
  if (!lista.length) return 'Informe um GeoJSON com Polygon/MultiPolygon (ex.: FeatureCollection do geojson.io)';
  for (const poli of lista) {
    if (!Array.isArray(poli[0]) || poli[0].length < 3) return 'Cada polígono precisa de pelo menos 3 coordenadas';
    for (const ponto of poli[0]) {
      const [lon, lat] = ponto;
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'Latitude fora do intervalo -90 a 90';
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) return 'Longitude fora do intervalo -180 a 180';
    }
  }
  return null;
}
