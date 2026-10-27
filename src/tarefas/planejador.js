// Converte a configuração escolhida na interface em uma lista de consultas ao Maps.
// Modos: municípios do IBGE, localidade livre, ponto + raio, polígono e links do Maps;
// municípios vêm do IBGE local e a divisão em grade é calculada aqui.

import { obterMunicipio, municipiosDosEstados, municipiosDaRegiao, malhaMunicipio, normalizar } from '../localidades/ibge.js';
import { DENSIDADES, circulo, gerarGrade, validarGeoJson } from '../geo/grade.js';
import { ErroValidacao } from '../erros.js';

function embaralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function municipiosSelecionados(cfg) {
  const ids = new Map();
  for (const id of cfg.municipios || []) {
    const m = obterMunicipio(id);
    if (m) ids.set(m.id, m);
  }
  for (const r of cfg.regioes || []) for (const m of municipiosDaRegiao(r.uf, r.meso)) ids.set(m.id, m);
  if (cfg.estados?.length) for (const m of municipiosDosEstados(cfg.estados)) ids.set(m.id, m);
  return [...ids.values()];
}

function analisarLinkBusca(link) {
  const u = new URL(link);
  const caminho = decodeURIComponent(u.pathname.replace(/\+/g, ' '));
  const coord = caminho.match(/@(-?\d+\.\d+),(-?\d+\.\d+)(?:,(\d+(?:\.\d+)?)z)?/);
  const lat = coord ? parseFloat(coord[1]) : 0;
  const lon = coord ? parseFloat(coord[2]) : 0;
  const zoom = coord?.[3] ? Math.round(parseFloat(coord[3])) : 13;
  let consulta = null, unico = false;
  const busca = caminho.match(/\/maps\/search\/([^/@]+)/);
  const lugar = caminho.match(/\/maps\/place\/([^/@]+)/);
  if (busca) consulta = busca[1];
  else if (lugar) { consulta = lugar[1]; unico = true; }
  else if (u.searchParams.get('query') || u.searchParams.get('q')) consulta = u.searchParams.get('query') || u.searchParams.get('q');
  if (!consulta) throw new ErroValidacao(`Link sem termo de busca: ${link}`);
  return { consulta: consulta.trim(), lat, lon, zoom, unico };
}

// Confere a configuração ANTES de criar a tarefa e junta tudo o que falta numa só mensagem.
export function validarConfig(cfg = {}) {
  const faltou = [];
  const tipos = (cfg.tipos || []).map((t) => String(t).trim()).filter(Boolean);
  const exigirTipos = () => {
    if (!tipos.length) faltou.push('escolha pelo menos um tipo de negócio (ex.: dentista, pizzaria)');
  };
  switch (cfg.modo_local) {
    case 'brasil':
      exigirTipos();
      if (!municipiosSelecionados(cfg).length) faltou.push('selecione pelo menos um estado, região ou município');
      break;
    case 'livre':
      exigirTipos();
      if (!(cfg.locais_livres || []).some((l) => l && (l.descricao || typeof l === 'string'))) faltou.push('adicione pelo menos uma localidade');
      break;
    case 'ponto': {
      exigirTipos();
      const lat = Number(cfg.ponto?.lat), lon = Number(cfg.ponto?.lon);
      if (cfg.ponto?.lat == null || cfg.ponto?.lon == null || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
        faltou.push('informe latitude (-90 a 90) e longitude (-180 a 180) válidas — clique no mapa ou digite as coordenadas');
      }
      break;
    }
    case 'poligono': {
      exigirTipos();
      try {
        const geo = typeof cfg.poligono === 'string' ? JSON.parse(cfg.poligono) : cfg.poligono;
        const erro = validarGeoJson(geo);
        if (erro) faltou.push(erro.charAt(0).toLowerCase() + erro.slice(1));
      } catch {
        faltou.push('o GeoJSON do polígono está vazio ou não é um JSON válido (desenhe no mapa ou cole um GeoJSON do geojson.io)');
      }
      break;
    }
    case 'links': {
      const links = (cfg.links || []).map((l) => String(l).trim()).filter(Boolean);
      if (!links.length) faltou.push('informe pelo menos um link do Google Maps');
      for (const link of links) {
        if (!/google\.[a-z.]+\/maps|maps\.google\./.test(link)) faltou.push(`"${link}" não é um link do Google Maps`);
        else try { analisarLinkBusca(link); } catch (e) { faltou.push(e.message.charAt(0).toLowerCase() + e.message.slice(1)); }
      }
      break;
    }
    default:
      faltou.push('escolha onde buscar (Brasil, qualquer lugar, ponto + raio, polígono ou links do Maps)');
  }
  if (faltou.length) {
    throw new ErroValidacao(`Não dá para iniciar ainda: ${faltou.join('; ')}.`, { faltou: faltou.map((f) => f.charAt(0).toUpperCase() + f.slice(1)) });
  }
}

export async function planejarConsultas(cfg, aoLog = () => {}) {
  validarConfig(cfg);
  const tipos = (cfg.tipos || []).map((t) => String(t).trim()).filter(Boolean);
  const estrategia = cfg.estrategia === 'grade' ? 'grade' : 'rapida';
  const dens = DENSIDADES[cfg.densidade] || DENSIDADES.media;
  const paginasGrade = Math.max(1, Number(cfg.paginas_por_ponto) || 2);
  const paginasRapida = Math.max(1, Math.min(20, Number(cfg.max_paginas) || 20));
  const consultas = [];

  const adicionarGrade = (geometria, rotuloArea, filtro) => {
    const pontos = gerarGrade(geometria, dens.espacamentoKm);
    aoLog(`${rotuloArea}: ${pontos.length} ponto(s) de grade (espaçamento ${dens.espacamentoKm} km)`);
    for (const tipo of tipos) {
      pontos.forEach((p, i) => consultas.push({
        rotulo: `${tipo} — ${rotuloArea} (ponto ${i + 1}/${pontos.length})`,
        tipo, consulta: tipo, lat: p.lat, lon: p.lon, zoom: dens.zoom, maxPaginas: paginasGrade, filtro,
      }));
    }
  };

  switch (cfg.modo_local) {
    case 'brasil': {
      if (!tipos.length) throw new ErroValidacao('Escolha pelo menos um tipo de negócio');
      let lista = municipiosSelecionados(cfg);
      if (!lista.length) throw new ErroValidacao('Selecione pelo menos um estado, região ou município');
      if (cfg.embaralhar_cidades) lista = embaralhar(lista);
      const bairros = (cfg.bairros || []).map((b) => String(b).trim()).filter(Boolean);
      for (const m of lista) {
        const filtroCidade = cfg.somente_dentro_da_cidade !== false ? { cidade: m.nome, cidadeNorm: normalizar(m.nome), uf: m.uf } : null;
        if (estrategia === 'grade') {
          let geometria;
          try {
            geometria = await malhaMunicipio(m.id);
          } catch (e) {
            aoLog(`Não foi possível obter a fronteira de ${m.nome}-${m.uf} (${e.message}); usando busca rápida`);
          }
          if (geometria) {
            adicionarGrade(geometria, `${m.nome} - ${m.uf}`, cfg.somente_dentro_da_cidade !== false ? { geometria, ...filtroCidade } : null);
            continue;
          }
        }
        const alvos = bairros.length ? bairros.map((b) => `${b}, ${m.nome} - ${m.uf}`) : [`${m.nome} - ${m.uf}`];
        for (const tipo of tipos) for (const alvo of alvos) {
          consultas.push({ rotulo: `${tipo} em ${alvo}`, tipo, consulta: `${tipo} em ${alvo}`, maxPaginas: paginasRapida, filtro: filtroCidade });
        }
      }
      break;
    }
    case 'livre': {
      if (!tipos.length) throw new ErroValidacao('Escolha pelo menos um tipo de negócio');
      const locais = (cfg.locais_livres || []).filter((l) => l && (l.descricao || typeof l === 'string'));
      if (!locais.length) throw new ErroValidacao('Adicione pelo menos uma localidade');
      for (const l of locais) {
        const local = typeof l === 'string' ? { descricao: l } : l;
        if (estrategia === 'grade' && Number.isFinite(local.lat)) {
          const raio = Number(cfg.raio_km) || 5;
          const geometria = circulo(local.lat, local.lon, raio);
          adicionarGrade(geometria, `${local.descricao} (raio ${raio} km)`, cfg.somente_dentro_da_cidade !== false ? { geometria } : null);
        } else {
          for (const tipo of tipos) consultas.push({
            rotulo: `${tipo} em ${local.descricao}`, tipo, consulta: `${tipo} em ${local.descricao}`,
            lat: local.lat ?? 0, lon: local.lon ?? 0, zoom: 13, maxPaginas: paginasRapida, filtro: null,
          });
        }
      }
      break;
    }
    case 'ponto': {
      if (!tipos.length) throw new ErroValidacao('Escolha pelo menos um tipo de negócio');
      const lat = Number(cfg.ponto?.lat), lon = Number(cfg.ponto?.lon), raio = Number(cfg.ponto?.raio_km) || 2;
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
        throw new ErroValidacao('Coordenadas inválidas (latitude -90 a 90, longitude -180 a 180)');
      }
      const geometria = circulo(lat, lon, raio);
      adicionarGrade(geometria, `Ponto ${lat.toFixed(5)}, ${lon.toFixed(5)} (raio ${raio} km)`, cfg.somente_dentro_da_cidade !== false ? { geometria } : null);
      break;
    }
    case 'poligono': {
      if (!tipos.length) throw new ErroValidacao('Escolha pelo menos um tipo de negócio');
      const geo = typeof cfg.poligono === 'string' ? JSON.parse(cfg.poligono) : cfg.poligono;
      const erro = validarGeoJson(geo);
      if (erro) throw new ErroValidacao(erro);
      adicionarGrade(geo, 'Polígono', cfg.somente_dentro_da_cidade !== false ? { geometria: geo } : null);
      break;
    }
    case 'links': {
      const links = (cfg.links || []).map((l) => String(l).trim()).filter(Boolean);
      if (!links.length) throw new ErroValidacao('Informe pelo menos um link do Google Maps');
      for (const link of links) {
        if (!/google\.[a-z.]+\/maps|maps\.google\./.test(link)) throw new ErroValidacao(`Não é um link do Google Maps: ${link}`);
        const a = analisarLinkBusca(link);
        consultas.push({
          rotulo: a.unico ? `Lugar: ${a.consulta}` : `Link: ${a.consulta}`, tipo: null, consulta: a.consulta,
          lat: a.lat, lon: a.lon, zoom: a.zoom, maxPaginas: a.unico ? 1 : paginasRapida, unico: a.unico, filtro: null,
        });
      }
      break;
    }
    default:
      throw new ErroValidacao('Modo de localidade desconhecido');
  }
  return consultas;
}
