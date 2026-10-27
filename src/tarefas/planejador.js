// Converte a configuração escolhida na interface (ou no arquivo JSON da CLI) em uma lista de
// consultas ao Maps. Modos de localidade (campo "modo_local"):
//
//   brasil    estados, mesorregiões e municípios do IBGE (por código ou por nome: "Campinas - SP")
//   pais      as N maiores cidades de qualquer país (base GeoNames), opcionalmente de alguns estados
//   livre     qualquer lugar digitado (o autocompletar do Maps dá as coordenadas)
//   ponto     latitude/longitude + raio em km
//   poligono  área desenhada (GeoJSON)
//   links     links de busca ou de lugar do Google Maps
//
// Estratégias: "rapida" (uma busca por tipo × local, até 20 páginas de 20) e "grade" (divide a área
// em pontos e busca em cada um — encontra muito mais em cidades grandes). A referência completa dos
// campos está em docs/CONFIGURACAO.md.

import {
  municipiosDosEstados, municipiosDaRegiao, malhaMunicipio, normalizar,
  resolverMunicipio, resolverEstados, nomeDoEstado, regioesDoEstado, distanciaEdicao,
} from '../localidades/ibge.js';
import { obterPais, cidadesDoPais, resolverRegioesPais } from '../localidades/paises.js';
import { DENSIDADES, circulo, gerarGrade, validarGeoJson } from '../geo/grade.js';
import { sugerirLocalidades } from '../maps/sugestoes.js';
import { INTERVALO_MS } from '../maps/cliente.js';
import { ErroValidacao } from '../erros.js';

export const MODOS = ['brasil', 'pais', 'livre', 'ponto', 'poligono', 'links'];

// Campos aceitos no topo da configuração (usados para avisar de erros de digitação).
const CAMPOS = [
  'nome', 'tipos', 'modo_local', 'estrategia', 'densidade', 'paginas_por_ponto', 'max_paginas',
  'estados', 'regioes', 'municipios', 'bairros', 'pais', 'locais_livres', 'raio_km', 'ponto', 'poligono', 'links',
  'somente_dentro_da_cidade', 'embaralhar_cidades', 'idioma', 'regiao', 'max_resultados_por_consulta',
  'max_resultados_total', 'paralelismo', 'filtros', 'detalhes', 'fotos', 'avaliacoes', 'contatos', 'leads', 'rotulo_local',
];

// Avisos que não impedem a extração (ex.: "tipo" em vez de "tipos" seria ignorado em silêncio).
export function avisosDaConfig(cfg = {}) {
  const avisos = [];
  for (const chave of Object.keys(cfg)) {
    if (CAMPOS.includes(chave)) continue;
    const parecido = CAMPOS.map((c) => [c, distanciaEdicao(chave, c)]).sort((a, b) => a[1] - b[1])[0];
    avisos.push(`campo "${chave}" não é reconhecido e será ignorado${parecido[1] <= 3 ? ` — você quis dizer "${parecido[0]}"?` : ''}`);
  }
  if (cfg.estrategia && !['rapida', 'grade'].includes(cfg.estrategia)) avisos.push(`estratégia "${cfg.estrategia}" desconhecida; usando "rapida" (opções: rapida, grade)`);
  if (cfg.densidade && !DENSIDADES[cfg.densidade]) avisos.push(`densidade "${cfg.densidade}" desconhecida; usando "media" (opções: ${Object.keys(DENSIDADES).join(', ')})`);
  return avisos;
}

function embaralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Municípios escolhidos no modo "brasil". Aceita códigos do IBGE ou nomes; o que não for
// reconhecido volta em `erros` para a validação listar.
function municipiosSelecionados(cfg) {
  const ids = new Map();
  const erros = [];
  for (const entrada of cfg.municipios || []) {
    const r = resolverMunicipio(entrada);
    r.municipio ? ids.set(r.municipio.id, r.municipio) : erros.push(r.erro);
  }
  for (const r of cfg.regioes || []) {
    const uf = resolverEstados([r.uf]).siglas[0];
    const meso = uf && regioesDoEstado(uf).find((x) => normalizar(x.nome) === normalizar(r.meso));
    if (!meso) { erros.push(`mesorregião "${r.meso}" não encontrada em ${r.uf}`); continue; }
    for (const m of municipiosDaRegiao(uf, meso.nome)) ids.set(m.id, m);
  }
  if (cfg.estados?.length) {
    const { siglas, desconhecidos } = resolverEstados(cfg.estados);
    for (const d of desconhecidos) erros.push(`estado "${d}" não encontrado (use a sigla, ex.: "SP", ou o nome)`);
    for (const m of municipiosDosEstados(siglas)) ids.set(m.id, m);
  }
  return { lista: [...ids.values()], erros };
}

function configDoPais(cfg) {
  const p = typeof cfg.pais === 'string' ? { codigo: cfg.pais } : cfg.pais || {};
  return {
    pais: obterPais(p.codigo),
    codigo: p.codigo,
    regioes: p.regioes || [],
    maxCidades: p.max_cidades == null || p.max_cidades === '' ? 20 : Math.max(0, Number(p.max_cidades) || 0),
    populacaoMinima: Math.max(0, Number(p.populacao_minima) || 0),
  };
}

// País do Google (parâmetro gl) quando a configuração não define "regiao".
export function regiaoPadrao(cfg = {}) {
  if (cfg.modo_local === 'pais') return configDoPais(cfg).pais?.codigo.toLowerCase() ?? 'br';
  return cfg.modo_local === 'livre' || cfg.modo_local === 'links' ? '' : 'br';
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

const minuscula = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// Confere a configuração ANTES de criar a tarefa e junta tudo o que falta numa só mensagem.
export function validarConfig(cfg = {}) {
  const faltou = [];
  const tipos = (cfg.tipos || []).map((t) => String(t).trim()).filter(Boolean);
  const exigirTipos = () => {
    if (!tipos.length) faltou.push('escolha pelo menos um tipo de negócio no campo "tipos" (ex.: dentista, pizzaria)');
  };
  switch (cfg.modo_local) {
    case 'brasil': {
      exigirTipos();
      const { lista, erros } = municipiosSelecionados(cfg);
      faltou.push(...erros);
      if (!lista.length && !erros.length) faltou.push('selecione pelo menos um estado, região ou município');
      break;
    }
    case 'pais': {
      exigirTipos();
      const p = configDoPais(cfg);
      if (!p.codigo) faltou.push('escolha o país (código como "PT" ou nome como "Portugal")');
      else if (!p.pais) faltou.push(`país "${p.codigo}" não encontrado (use o código ISO de 2 letras, ex.: PT, US, AR, ou o nome em português)`);
      else {
        const { desconhecidas } = resolverRegioesPais(p.pais, p.regioes);
        for (const d of desconhecidas) faltou.push(`região "${d}" não existe em ${p.pais.nome} (veja a lista de regiões na interface)`);
        if (!desconhecidas.length && !cidadesDoPais(p.pais.codigo, { regioes: p.regioes, maximo: 1, populacaoMinima: p.populacaoMinima }).length) {
          faltou.push(`nenhuma cidade de ${p.pais.nome} atende aos critérios (diminua a população mínima ou escolha outras regiões)`);
        }
      }
      break;
    }
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
        if (erro) faltou.push(minuscula(erro));
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
        else try { analisarLinkBusca(link); } catch (e) { faltou.push(minuscula(e.message)); }
      }
      break;
    }
    default:
      faltou.push(`escolha onde buscar no campo "modo_local": ${MODOS.join(', ')}`);
  }
  if (faltou.length) {
    throw new ErroValidacao(`Não dá para iniciar ainda: ${faltou.join('; ')}.`, { faltou: faltou.map((f) => f.charAt(0).toUpperCase() + f.slice(1)) });
  }
}

// Coordenadas de uma localidade digitada como texto, pelo autocompletar do Maps (melhora a precisão:
// a busca passa a ser centrada no lugar certo). Se falhar, a busca segue só com o texto.
async function geolocalizar(local, cfg, aoLog) {
  try {
    const [s] = await sugerirLocalidades(local.descricao, { idioma: cfg.idioma && cfg.idioma !== 'auto' ? cfg.idioma : 'pt-BR', regiao: cfg.regiao || '', limite: 1 });
    if (s) {
      aoLog(`"${local.descricao}" localizado como ${s.descricao} (${s.lat.toFixed(4)}, ${s.lon.toFixed(4)})`);
      return { ...local, lat: s.lat, lon: s.lon };
    }
    aoLog(`"${local.descricao}" não foi localizado no mapa; a busca usará só o texto`);
  } catch (e) {
    aoLog(`Não consegui localizar "${local.descricao}" no mapa (${e.message}); a busca usará só o texto`);
  }
  return local;
}

export async function planejarConsultas(cfg, aoLog = () => {}) {
  validarConfig(cfg);
  for (const a of avisosDaConfig(cfg)) aoLog(`⚠ Aviso: ${a}`);
  const tipos = (cfg.tipos || []).map((t) => String(t).trim()).filter(Boolean);
  const estrategia = cfg.estrategia === 'grade' ? 'grade' : 'rapida';
  const dens = DENSIDADES[cfg.densidade] || DENSIDADES.media;
  const paginasGrade = Math.max(1, Number(cfg.paginas_por_ponto) || 2);
  const paginasRapida = Math.max(1, Math.min(20, Number(cfg.max_paginas) || 20));
  const somenteDentro = cfg.somente_dentro_da_cidade !== false;
  const consultas = [];

  const adicionarGrade = (geometria, rotuloArea, filtro, extra = {}) => {
    const pontos = gerarGrade(geometria, dens.espacamentoKm);
    aoLog(`${rotuloArea}: ${pontos.length} ponto(s) de grade (espaçamento ${dens.espacamentoKm} km)`);
    for (const tipo of tipos) {
      pontos.forEach((p, i) => consultas.push({
        rotulo: `${tipo} — ${rotuloArea} (ponto ${i + 1}/${pontos.length})`,
        tipo, consulta: tipo, lat: p.lat, lon: p.lon, zoom: dens.zoom, maxPaginas: paginasGrade, filtro, ...extra,
      }));
    }
  };

  switch (cfg.modo_local) {
    case 'brasil': {
      let { lista } = municipiosSelecionados(cfg);
      if (cfg.embaralhar_cidades) lista = embaralhar(lista);
      const bairros = (cfg.bairros || []).map((b) => String(b).trim()).filter(Boolean);
      for (const m of lista) {
        const filtroCidade = somenteDentro
          ? { pais: 'BR', cidade: m.nome, cidadeNorm: normalizar(m.nome), uf: m.uf, estadoNorm: normalizar(nomeDoEstado(m.uf)) }
          : null;
        if (estrategia === 'grade') {
          let geometria;
          try {
            geometria = await malhaMunicipio(m.id);
          } catch (e) {
            aoLog(`Não foi possível obter a fronteira de ${m.nome}-${m.uf} (${e.message}); usando busca rápida`);
          }
          if (geometria) {
            adicionarGrade(geometria, `${m.nome} - ${m.uf}`, somenteDentro ? { pais: 'BR', geometria } : null);
            continue;
          }
        }
        // A coordenada do município centraliza a busca na cidade certa (há 200+ nomes repetidos no Brasil).
        const alvos = bairros.length ? bairros.map((b) => `${b}, ${m.nome} - ${m.uf}`) : [`${m.nome} - ${m.uf}`];
        for (const tipo of tipos) for (const alvo of alvos) {
          consultas.push({
            rotulo: `${tipo} em ${alvo}`, tipo, consulta: `${tipo} em ${alvo}`,
            lat: m.lat ?? 0, lon: m.lon ?? 0, zoom: 13, maxPaginas: paginasRapida, filtro: filtroCidade,
          });
        }
      }
      break;
    }
    case 'pais': {
      const p = configDoPais(cfg);
      const pais = p.pais;
      let cidades = cidadesDoPais(pais.codigo, { regioes: p.regioes, maximo: p.maxCidades, populacaoMinima: p.populacaoMinima });
      if (cfg.embaralhar_cidades) cidades = embaralhar(cidades);
      const idioma = cfg.idioma === 'auto' ? pais.idioma : undefined;
      const extra = { regiao: pais.codigo.toLowerCase(), ...(idioma ? { idioma } : {}) };
      aoLog(`${pais.nome}: ${cidades.length} cidade(s) selecionada(s), da maior para a menor` +
        (cidades.length ? ` (${cidades.slice(0, 5).map((c) => c.nome).join(', ')}${cidades.length > 5 ? '…' : ''})` : ''));
      for (const c of cidades) {
        const rotuloArea = `${c.nome}, ${pais.nome}`;
        if (estrategia === 'grade') {
          const geometria = circulo(c.lat, c.lon, c.raio_km);
          adicionarGrade(geometria, `${rotuloArea} (raio ${c.raio_km} km)`, somenteDentro ? { pais: pais.codigo, geometria } : null, extra);
          continue;
        }
        // folga de 50% no raio: o raio estimado pela população é aproximado
        const filtro = somenteDentro ? { pais: pais.codigo, centro: { lat: c.lat, lon: c.lon }, raioKm: c.raio_km * 1.5 } : null;
        for (const tipo of tipos) consultas.push({
          rotulo: `${tipo} em ${rotuloArea}`, tipo, consulta: `${tipo} em ${c.nome}${c.regiao ? `, ${c.regiao}` : ''}, ${pais.nome}`,
          lat: c.lat, lon: c.lon, zoom: 13, maxPaginas: paginasRapida, filtro, ...extra,
        });
      }
      break;
    }
    case 'livre': {
      const locais = (cfg.locais_livres || []).filter((l) => l && (l.descricao || typeof l === 'string'));
      for (const l of locais) {
        let local = typeof l === 'string' ? { descricao: l } : l;
        if (!Number.isFinite(local.lat)) local = await geolocalizar(local, cfg, aoLog);
        if (estrategia === 'grade' && Number.isFinite(local.lat)) {
          const raio = Number(cfg.raio_km) || 5;
          const geometria = circulo(local.lat, local.lon, raio);
          adicionarGrade(geometria, `${local.descricao} (raio ${raio} km)`, somenteDentro ? { geometria } : null);
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
      const lat = Number(cfg.ponto.lat), lon = Number(cfg.ponto.lon), raio = Number(cfg.ponto.raio_km) || 2;
      const geometria = circulo(lat, lon, raio);
      adicionarGrade(geometria, `Ponto ${lat.toFixed(5)}, ${lon.toFixed(5)} (raio ${raio} km)`, somenteDentro ? { geometria } : null);
      break;
    }
    case 'poligono': {
      const geo = typeof cfg.poligono === 'string' ? JSON.parse(cfg.poligono) : cfg.poligono;
      adicionarGrade(geo, 'Polígono', somenteDentro ? { geometria: geo } : null);
      break;
    }
    case 'links': {
      const links = (cfg.links || []).map((l) => String(l).trim()).filter(Boolean);
      for (const link of links) {
        const a = analisarLinkBusca(link);
        consultas.push({
          rotulo: a.unico ? `Lugar: ${a.consulta}` : `Link: ${a.consulta}`, tipo: null, consulta: a.consulta,
          lat: a.lat, lon: a.lon, zoom: a.zoom, maxPaginas: a.unico ? 1 : paginasRapida, unico: a.unico, filtro: null,
        });
      }
      break;
    }
  }
  return consultas;
}

// Resumo do plano para conferir antes de rodar (CLI --simular e botão "Calcular plano").
// O tempo considera só as buscas; detalhes, fotos, contatos etc. somam ~1 requisição por empresa.
export function resumirPlano(consultas) {
  const minimo = consultas.length;
  const maximo = consultas.reduce((s, c) => s + (c.maxPaginas || 1), 0);
  const segundos = (n) => Math.round((n * INTERVALO_MS) / 1000);
  return {
    consultas: consultas.length,
    requisicoes_min: minimo,
    requisicoes_max: maximo,
    tempo_min_s: segundos(minimo),
    tempo_max_s: segundos(maximo),
    resultados_max: maximo * 20,
    exemplos: consultas.slice(0, 8).map((c) => c.rotulo),
  };
}

export function formatarDuracao(s) {
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}
