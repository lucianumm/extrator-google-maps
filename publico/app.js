'use strict';

// ---------- utilidades ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const num = (v) => (v === '' || v == null ? null : Number(v));
const fmt = (n) => Number(n || 0).toLocaleString('pt-BR');

// Erro de chamada à API: `detalhe` = { titulo, causa, solucao, tecnico, faltou? } para a janela de erro.
class ErroApi extends Error {
  constructor(mensagem, detalhe) {
    super(mensagem);
    this.detalhe = detalhe;
  }
}

async function api(url, opcoes = {}) {
  let r;
  try {
    r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opcoes });
  } catch (e) {
    throw new ErroApi('Sem conexão com o programa', {
      titulo: 'Sem conexão com o programa',
      causa: 'O servidor local do extrator não respondeu.',
      solucao: 'Confira se a janela preta (terminal) do extrator continua aberta. Se ela foi fechada, abra o programa de novo (iniciar.bat ou ./iniciar.sh) e recarregue esta página.',
      tecnico: `${opcoes.method || 'GET'} ${url}: ${e}`,
    });
  }
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new ErroApi(dados.erro || `Erro ${r.status}`, dados.detalhe || {
      titulo: `Erro ${r.status}`,
      causa: dados.erro || 'O programa devolveu um erro sem detalhes.',
      solucao: 'Tente de novo. Se continuar, copie os detalhes técnicos e relate em uma issue no GitHub.',
      tecnico: `HTTP ${r.status} em ${opcoes.method || 'GET'} ${url}`,
    });
  }
  return dados;
}

let tempoAviso;
function aviso(msg, ms = 3500) {
  const a = $('#aviso');
  a.textContent = msg;
  a.classList.remove('oculto');
  clearTimeout(tempoAviso);
  tempoAviso = setTimeout(() => a.classList.add('oculto'), ms);
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ---------- janelas de erro e de apoio ----------
for (const dlg of $$('#apoio, #erro-dialogo')) dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
for (const [botao, dlg] of [['#apoio-fechar', '#apoio'], ['#apoio-fechar-topo', '#apoio'], ['#erro-fechar', '#erro-dialogo'], ['#erro-fechar-topo', '#erro-dialogo']]) {
  $(botao).addEventListener('click', () => $(dlg).close());
}

async function copiarTexto(texto, botao) {
  const original = botao.textContent;
  let ok = false;
  try {
    await navigator.clipboard.writeText(texto);
    ok = true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.cssText = 'position:fixed;opacity:0';
    (botao.closest('dialog') || document.body).append(ta); // dentro da janela aberta, senão o foco não vai para o campo
    ta.select();
    try { ok = document.execCommand('copy'); } catch { /* sem permissão */ }
    ta.remove();
  }
  botao.textContent = ok ? 'Copiado! ✔' : 'Não consegui copiar — selecione o texto à mão';
  setTimeout(() => { botao.textContent = original; }, 2500);
}

// Qualquer erro (da API, da tarefa ou do navegador) vira { titulo, causa, solucao, tecnico }.
function detalheDe(e) {
  if (e?.detalhe) return e.detalhe;
  const msg = String(e?.message ?? e ?? 'erro desconhecido');
  if (/\bL is not defined|leaflet/i.test(msg)) {
    return { titulo: 'O mapa não carregou', causa: 'A biblioteca do mapa (Leaflet/OpenStreetMap) vem da internet e não foi carregada.', solucao: 'Conecte-se à internet e recarregue a página (F5). Os modos de busca sem mapa continuam funcionando.', tecnico: msg };
  }
  return { titulo: 'Erro na interface', causa: msg, solucao: 'Recarregue a página (F5) e tente de novo. Se repetir, copie os detalhes técnicos e relate em uma issue no GitHub.', tecnico: e?.stack || msg };
}

let erroExibido = '';
function mostrarErro(d) {
  const dlg = $('#erro-dialogo');
  const chave = `${d.titulo}|${d.causa}`;
  if (dlg.open && erroExibido === chave) return; // não empilha o mesmo erro
  erroExibido = chave;
  const faltou = d.faltou || [];
  $('#erro-titulo').textContent = d.titulo || 'Algo deu errado';
  $('#erro-causa').textContent = d.causa || '';
  $('#erro-faltou-caixa').classList.toggle('oculto', !faltou.length);
  $('#erro-faltou').replaceChildren(...faltou.map((f) => Object.assign(document.createElement('li'), { textContent: f })));
  $('#erro-solucao').textContent = d.solucao || 'Tente de novo.';
  $('#erro-tecnico').textContent = d.tecnico || '(sem detalhes técnicos)';
  $('#erro-copiar').onclick = (ev) => copiarTexto(
    `${d.titulo}\n${d.causa}\nComo resolver: ${d.solucao}\n\nDetalhes técnicos: ${d.tecnico}\nNavegador: ${navigator.userAgent}`, ev.currentTarget);
  if (!dlg.open) dlg.showModal();
}

// Falhas que ninguém tratou também aparecem, em vez de sumirem no console.
window.addEventListener('unhandledrejection', (e) => { e.preventDefault(); mostrarErro(detalheDe(e.reason)); });
window.addEventListener('error', (e) => mostrarErro(detalheDe(e.error || { message: e.message })));

let apoioCfg = null;
let apoioPendente = null;
function mostrarApoio({ linhas = [], avisos = [] } = {}) {
  if (!apoioCfg?.ativo) return;
  if ($$('dialog[open]').length) { apoioPendente = { linhas, avisos }; return; } // espera a outra janela fechar
  const contexto = $('#apoio-contexto');
  contexto.replaceChildren();
  if (linhas.length || avisos.length) {
    const caixa = Object.assign(document.createElement('div'), { className: 'apoio-contexto-ok' });
    for (const l of linhas) caixa.append(Object.assign(document.createElement('p'), { textContent: l }));
    for (const a of avisos) caixa.append(Object.assign(document.createElement('p'), { textContent: a, className: 'apoio-contexto-aviso' }));
    contexto.append(caixa);
  }
  $('#apoio-titulo').textContent = `☕ ${apoioCfg.titulo}`;
  $('#apoio-qr').src = apoioCfg.qr;
  $('#apoio-dados').textContent = `Favorecido: ${apoioCfg.favorecido} (${apoioCfg.cidade}) · Chave Pix (${apoioCfg.tipoChave}): ${apoioCfg.chave}`;
  $('#apoio-copiar').onclick = (ev) => copiarTexto(apoioCfg.copiaECola, ev.currentTarget);
  $('#apoio').showModal();
}
document.addEventListener('close', () => {
  if (apoioPendente && !$$('dialog[open]').length) {
    const p = apoioPendente;
    apoioPendente = null;
    setTimeout(() => mostrarApoio(p), 400);
  }
}, true);

// Chamado quando uma tarefa passa de ativa para finalizada.
function aoTerminarTarefa(t) {
  if (t.status === 'erro') {
    mostrarErro(t.erro_detalhe || { titulo: 'A extração falhou', causa: t.erro || 'Erro sem detalhes.', solucao: 'Abra a tarefa e veja o log.', tecnico: '' });
    return;
  }
  if (t.status !== 'concluida') return;
  const p = t.progresso || {};
  const avisos = [];
  if (p.erros) avisos.push(`⚠ ${fmt(p.erros)} item(ns) falharam durante a coleta — abra a tarefa e veja o log para saber quais.`);
  if (t.saude?.suspeito) avisos.push(`⚠ Campos essenciais vieram vazios (${t.saude.quebrados.join(', ')}): o Google pode ter mudado o formato. Rode o Diagnóstico em Avançado.`);
  if (!p.resultados) avisos.push('⚠ Nenhuma empresa foi coletada. Confira o tipo de negócio, a localidade e os filtros (veja o log da tarefa).');
  mostrarApoio({ linhas: [`✅ A extração “${t.nome}” terminou: ${fmt(p.resultados)} empresa(s) coletada(s).`, 'Exporte em Excel, CSV ou JSON na tela da tarefa.'], avisos });
}

// Lista de sugestões com teclado (↑ ↓ Enter Esc).
function autocompletar(input, caixa, { buscar, aoEscolher, aoEnterLivre }) {
  let itens = [], foco = -1;
  const fechar = () => { caixa.classList.add('oculto'); foco = -1; };
  const desenhar = (lista) => {
    itens = lista.filter((x) => !x.grupo);
    if (!lista.length) return fechar();
    caixa.innerHTML = lista.map((x) => (x.grupo
      ? `<div class="grupo">${esc(x.grupo)}</div>`
      : `<div class="item" data-i="${itens.indexOf(x)}">${x.html ?? esc(x.rotulo)}</div>`)).join('');
    caixa.classList.remove('oculto');
  };
  const atualizar = async () => desenhar(await buscar(input.value));
  input.addEventListener('input', debounce(atualizar, 180));
  input.addEventListener('focus', atualizar);
  input.addEventListener('blur', () => setTimeout(fechar, 150));
  caixa.addEventListener('mousedown', (e) => {
    const d = e.target.closest('.item');
    if (!d) return;
    e.preventDefault();
    aoEscolher(itens[+d.dataset.i]);
    input.value = '';
    atualizar();
  });
  input.addEventListener('keydown', (e) => {
    const els = $$('.item', caixa);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!els.length) return;
      foco = (foco + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length;
      els.forEach((x, i) => x.classList.toggle('foco', i === foco));
      els[foco].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (foco >= 0 && itens[foco] && !caixa.classList.contains('oculto')) aoEscolher(itens[foco]);
      else if (input.value.trim() && aoEnterLivre) aoEnterLivre(input.value.trim());
      else return;
      input.value = '';
      atualizar();
    } else if (e.key === 'Escape') fechar();
  });
}

function desenharChips(caixa, lista, rotulo, remover, vazio) {
  if (!lista.length) { caixa.innerHTML = vazio ? `<span class="vazio">${vazio}</span>` : ''; return; }
  caixa.innerHTML = lista.map((x, i) => `<span class="chip">${esc(rotulo(x))}<button type="button" data-i="${i}" title="Remover">×</button></span>`).join('');
  $$('button', caixa).forEach((b) => b.addEventListener('click', () => remover(+b.dataset.i)));
}

// ---------- navegação ----------
function mostrarTela(nome) {
  $$('.tela').forEach((t) => t.classList.toggle('ativa', t.id === `tela-${nome}`));
  $$('.aba-nav').forEach((b) => b.classList.toggle('ativa', b.dataset.tela === nome || (nome === 'detalhe' && b.dataset.tela === 'tarefas')));
  window.scrollTo(0, 0);
}
$$('.aba-nav').forEach((b) => b.addEventListener('click', () => { mostrarTela(b.dataset.tela); if (b.dataset.tela === 'tarefas') desenharTarefas(); }));

// ---------- tipos de negócio ----------
let categorias = {};
const tipos = [];
function adicionarTipo(t) {
  t = String(t).trim();
  if (t && !tipos.some((x) => normalizar(x) === normalizar(t))) tipos.push(t);
  desenharTipos();
}
function desenharTipos() {
  desenharChips($('#chips-tipos'), tipos, (x) => x, (i) => { tipos.splice(i, 1); desenharTipos(); });
  estimar();
}
autocompletar($('#busca-tipo'), $('#sug-tipos'), {
  buscar: async (q) => {
    const n = normalizar(q);
    const saida = [];
    for (const [grupo, lista] of Object.entries(categorias)) {
      const achados = lista.filter((c) => !tipos.includes(c) && (!n || normalizar(c).includes(n)));
      if (achados.length) saida.push({ grupo }, ...achados.slice(0, n ? 50 : 6).map((c) => ({ rotulo: c, valor: c })));
    }
    if (n && !Object.values(categorias).flat().some((c) => normalizar(c) === n)) saida.push({ grupo: 'Termo livre' }, { rotulo: `Usar “${q.trim()}”`, valor: q.trim() });
    return saida;
  },
  aoEscolher: (x) => adicionarTipo(x.valor),
  aoEnterLivre: adicionarTipo,
});
$('#grupo-tipos').addEventListener('change', (e) => {
  if (!e.target.value) return;
  categorias[e.target.value].forEach((c) => tipos.includes(c) || tipos.push(c));
  e.target.value = '';
  desenharTipos();
});
$('#btn-massa-tipos').addEventListener('click', () => $('#massa-tipos').classList.toggle('oculto'));
$('#btn-add-massa-tipos').addEventListener('click', () => {
  $('#txt-massa-tipos').value.split(/[\n,;]+/).forEach(adicionarTipo);
  $('#txt-massa-tipos').value = '';
  $('#massa-tipos').classList.add('oculto');
});
$('#btn-limpar-tipos').addEventListener('click', () => { tipos.length = 0; desenharTipos(); });

// ---------- localidade: modo ----------
let modoLocal = 'brasil';
$$('#abas-local .aba').forEach((b) => b.addEventListener('click', () => {
  modoLocal = b.dataset.modo;
  $$('#abas-local .aba').forEach((x) => x.classList.toggle('ativa', x === b));
  $$('.painel-local').forEach((p) => p.classList.toggle('ativo', p.dataset.modo === modoLocal));
  if (modoLocal === 'ponto') iniciarMapaPonto();
  if (modoLocal === 'poligono') iniciarMapaPoligono();
  if (modoLocal === 'ponto' || modoLocal === 'poligono') $('input[name=estrategia][value=grade]').checked = true;
  atualizarEstrategia();
}));

// ---------- localidade: Brasil ----------
let estados = [];
const locais = []; // {tipo:'estado'|'meso'|'mun', ...}
const cacheMunEstado = {};

async function municipiosDoEstado(uf) {
  return (cacheMunEstado[uf] ??= await api(`/api/estados/${uf}/municipios`));
}
function rotuloLocal(l) {
  if (l.tipo === 'estado') return `${l.nome} (estado inteiro · ${fmt(l.total)} municípios)`;
  if (l.tipo === 'meso') return `${l.meso} - ${l.uf} (mesorregião · ${fmt(l.total)})`;
  return `${l.nome} - ${l.uf}`;
}
function adicionarLocal(l) {
  const chave = (x) => (x.tipo === 'mun' ? `m${x.id}` : x.tipo === 'estado' ? `e${x.uf}` : `r${x.uf}|${x.meso}`);
  if (!locais.some((x) => chave(x) === chave(l))) locais.push(l);
  desenharLocais();
}
function totalMunicipios() {
  const ufsInteiros = new Set(locais.filter((l) => l.tipo === 'estado').map((l) => l.uf));
  let total = locais.filter((l) => l.tipo === 'estado').reduce((s, l) => s + l.total, 0);
  total += locais.filter((l) => l.tipo === 'meso' && !ufsInteiros.has(l.uf)).reduce((s, l) => s + l.total, 0);
  total += locais.filter((l) => l.tipo === 'mun' && !ufsInteiros.has(l.uf)).length;
  return total;
}
function desenharLocais() {
  desenharChips($('#chips-locais'), locais, rotuloLocal, (i) => { locais.splice(i, 1); desenharLocais(); }, 'Nenhuma localidade selecionada');
  const t = totalMunicipios();
  $('#total-mun').textContent = t ? `· aproximadamente ${fmt(t)} município(s)` : '';
  estimar();
}

$('#uf').addEventListener('change', async (e) => {
  const uf = e.target.value;
  $('#btn-estado-inteiro').disabled = !uf;
  const meso = $('#meso');
  meso.disabled = $('#btn-meso').disabled = !uf;
  if (!uf) { meso.innerHTML = '<option value="">Selecione o estado primeiro</option>'; return; }
  const regioes = await api(`/api/estados/${uf}/regioes`);
  meso.innerHTML = regioes.map((r) => `<option value="${esc(r.nome)}" data-total="${r.total}">${esc(r.nome)} (${r.total})</option>`).join('');
});
$('#btn-estado-inteiro').addEventListener('click', async () => {
  const uf = $('#uf').value;
  const est = estados.find((x) => x.sigla === uf);
  adicionarLocal({ tipo: 'estado', uf, nome: est.nome, total: (await municipiosDoEstado(uf)).length });
});
$('#btn-meso').addEventListener('click', () => {
  const op = $('#meso').selectedOptions[0];
  if (op) adicionarLocal({ tipo: 'meso', uf: $('#uf').value, meso: op.value, total: +op.dataset.total });
});
autocompletar($('#busca-mun'), $('#sug-mun'), {
  buscar: async (q) => {
    if (!q.trim()) return [];
    const uf = $('#uf').value;
    const lista = await api(`/api/municipios?q=${encodeURIComponent(q)}&ufs=${uf}&limite=20`);
    return lista.map((m) => ({ ...m, html: `${esc(m.nome)} - ${m.uf} <small>${esc(m.meso)}</small>` }));
  },
  aoEscolher: (m) => adicionarLocal({ tipo: 'mun', id: m.id, nome: m.nome, uf: m.uf }),
});
$('#btn-massa-mun').addEventListener('click', () => $('#massa-mun').classList.toggle('oculto'));
$('#btn-add-massa-mun').addEventListener('click', async () => {
  const linhas = $('#txt-massa-mun').value.split('\n').map((x) => x.trim()).filter(Boolean);
  const naoAchados = [];
  for (const linha of linhas) {
    const m = linha.match(/^(.+?)\s*[-,/]\s*([A-Za-z]{2})$/);
    const nome = m ? m[1] : linha;
    const uf = m ? m[2].toUpperCase() : '';
    const lista = await api(`/api/municipios?q=${encodeURIComponent(nome)}&ufs=${uf}&limite=5`);
    const exato = lista.find((x) => normalizar(x.nome) === normalizar(nome)) || (lista.length === 1 ? lista[0] : null);
    if (exato) adicionarLocal({ tipo: 'mun', id: exato.id, nome: exato.nome, uf: exato.uf });
    else naoAchados.push(linha);
  }
  $('#txt-massa-mun').value = naoAchados.join('\n');
  aviso(naoAchados.length ? `${naoAchados.length} cidade(s) não encontrada(s) — ficaram na caixa para corrigir` : 'Cidades adicionadas');
  if (!naoAchados.length) $('#massa-mun').classList.add('oculto');
});
$('#bairros').addEventListener('input', debounce(estimar, 300));

// ---------- localidade: qualquer lugar ----------
const locaisLivres = [];
function desenharLivres() {
  desenharChips($('#chips-livres'), locaisLivres, (l) => l.descricao + (l.lat == null ? ' (texto livre)' : ''), (i) => { locaisLivres.splice(i, 1); desenharLivres(); }, 'Nenhuma localidade');
  estimar();
}
autocompletar($('#busca-livre'), $('#sug-livre'), {
  buscar: async (q) => {
    if (q.trim().length < 2) return [];
    try {
      const lista = await api(`/api/sugestoes?q=${encodeURIComponent(q)}&hl=${$('#idioma').value}&gl=${$('#regiao').value}`);
      return lista.map((s) => ({ ...s, html: `${esc(s.principal)} <small>${esc(s.secundario || '')} · ${esc(s.tipo)}</small>` }));
    } catch { return []; }
  },
  aoEscolher: (s) => { locaisLivres.push({ descricao: s.descricao, lat: s.lat, lon: s.lon }); desenharLivres(); },
  aoEnterLivre: (t) => { locaisLivres.push({ descricao: t }); desenharLivres(); },
});

// ---------- mapas ----------
const camadaBase = () => L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
let mapaPonto, marcador, circuloPonto;
function iniciarMapaPonto() {
  if (mapaPonto || !window.L) return setTimeout(() => mapaPonto?.invalidateSize(), 50);
  mapaPonto = L.map('mapa-ponto').setView([-15.8, -47.9], 4);
  camadaBase().addTo(mapaPonto);
  mapaPonto.on('click', (e) => { $('#lat').value = e.latlng.lat.toFixed(6); $('#lon').value = e.latlng.lng.toFixed(6); desenharPonto(); });
}
function desenharPonto() {
  const lat = num($('#lat').value), lon = num($('#lon').value), raio = num($('#raio').value) || 2;
  if (!mapaPonto || lat == null || lon == null) return;
  marcador ? marcador.setLatLng([lat, lon]) : (marcador = L.marker([lat, lon]).addTo(mapaPonto));
  circuloPonto ? circuloPonto.setLatLng([lat, lon]).setRadius(raio * 1000) : (circuloPonto = L.circle([lat, lon], { radius: raio * 1000 }).addTo(mapaPonto));
  mapaPonto.fitBounds(circuloPonto.getBounds());
  estimar();
}
['#lat', '#lon', '#raio'].forEach((s) => $(s).addEventListener('change', desenharPonto));

let mapaPoli, camadaPoli;
const vertices = [];
function iniciarMapaPoligono() {
  if (mapaPoli || !window.L) return setTimeout(() => mapaPoli?.invalidateSize(), 50);
  mapaPoli = L.map('mapa-poligono').setView([-15.8, -47.9], 4);
  camadaBase().addTo(mapaPoli);
  mapaPoli.on('click', (e) => { vertices.push([e.latlng.lng, e.latlng.lat]); poligonoDosVertices(); });
}
function poligonoDosVertices() {
  const geo = vertices.length >= 3
    ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...vertices, vertices[0]]] } }] }
    : null;
  $('#geojson').value = geo ? JSON.stringify(geo) : '';
  desenharGeo(geo, false);
}
function desenharGeo(geo, ajustar = true) {
  if (!mapaPoli) return;
  camadaPoli?.remove();
  camadaPoli = null;
  if (vertices.length && !geo) camadaPoli = L.layerGroup(vertices.map(([lo, la]) => L.circleMarker([la, lo], { radius: 4 }))).addTo(mapaPoli);
  if (geo) {
    camadaPoli = L.geoJSON(geo).addTo(mapaPoli);
    if (ajustar) mapaPoli.fitBounds(camadaPoli.getBounds());
  }
}
$('#btn-poli-desfazer').addEventListener('click', () => { vertices.pop(); poligonoDosVertices(); });
$('#btn-poli-limpar').addEventListener('click', () => { vertices.length = 0; poligonoDosVertices(); });
$('#geojson').addEventListener('change', () => {
  try { const g = JSON.parse($('#geojson').value); vertices.length = 0; desenharGeo(g); } catch { aviso('GeoJSON inválido'); }
});

// ---------- estratégia e estimativa ----------
function atualizarEstrategia() {
  const grade = $('input[name=estrategia]:checked').value === 'grade';
  $('#densidade').disabled = $('#paginas-ponto').disabled = !grade;
  estimar();
}
$$('input[name=estrategia]').forEach((r) => r.addEventListener('change', atualizarEstrategia));
const SUBOPCOES = { '#x-fotos': '#opc-fotos', '#x-aval': '#opc-aval', '#x-contatos': '#opc-contatos', '#x-verificar': '#opc-verificar', '#x-leads': '#opc-leads' };
function atualizarSubopcoes() {
  for (const [chk, painel] of Object.entries(SUBOPCOES)) $(painel).classList.toggle('oculto', !$(chk).checked);
}
Object.keys(SUBOPCOES).forEach((s) => $(s).addEventListener('change', atualizarSubopcoes));
atualizarSubopcoes();

// Chaves de API: guardadas só neste navegador, e só se o usuário pedir.
const CAMPOS_CHAVE = ['#x-chave-verif', '#x-apollo-chave'];
try {
  const salvas = JSON.parse(localStorage.getItem('chaves') || 'null');
  if (salvas) {
    $('#lembrar-chaves').checked = true;
    CAMPOS_CHAVE.forEach((s) => { $(s).value = salvas[s] || ''; });
  }
} catch { /* armazenamento indisponível */ }
function lembrarChaves() {
  try {
    if ($('#lembrar-chaves').checked) localStorage.setItem('chaves', JSON.stringify(Object.fromEntries(CAMPOS_CHAVE.map((s) => [s, $(s).value]))));
    else localStorage.removeItem('chaves');
  } catch { /* armazenamento indisponível */ }
}
[...CAMPOS_CHAVE, '#lembrar-chaves'].forEach((s) => $(s).addEventListener('change', lembrarChaves));
const marcados = (sel) => $$(`${sel} input:checked`).map((i) => i.value);

// ---------- sessão do Google e diagnóstico ----------
async function atualizarSessao(dados) {
  const s = dados || (await api('/api/sessao'));
  $('#auto-navegador').checked = s.usarNavegador !== false;
  $('#estado-sessao').textContent = s.abrindo
    ? 'Navegador aberto — conclua a ação na janela do Edge/Chrome.'
    : s.logada
      ? `Conectado a uma conta Google (desde ${new Date(s.renovadaEm).toLocaleString('pt-BR')}). A galeria completa de fotos fica disponível.`
      : s.temCookies
        ? `Sessão anônima renovada em ${new Date(s.renovadaEm).toLocaleString('pt-BR')}.`
        : 'Sem sessão salva: as buscas usam HTTP direto (funciona na maioria dos casos).';
  if (s.ultimoErro) $('#estado-sessao').textContent += ` ⚠ A última tentativa falhou (${s.ultimoErro.titulo}). ${s.ultimoErro.solucao}`;
  return s;
}
async function acaoSessao(acao) {
  const s = await api('/api/sessao', { method: 'POST', body: JSON.stringify({ acao }) });
  await atualizarSessao({ ...s, abrindo: acao !== 'limpar' });
  if (acao !== 'limpar') {
    aviso(acao === 'login' ? 'Entre na conta na janela que abriu e depois feche-a' : 'Conclua a verificação na janela que abriu');
    const vigia = setInterval(async () => {
      const x = await atualizarSessao();
      if (x.abrindo) return;
      clearInterval(vigia);
      if (x.ultimoErro) mostrarErro(x.ultimoErro);
    }, 3000);
  }
}
$('#btn-login').addEventListener('click', () => acaoSessao('login'));
$('#btn-renovar').addEventListener('click', () => acaoSessao('verificar'));
$('#btn-limpar-sessao').addEventListener('click', () => confirm('Apagar cookies e o perfil do navegador usado pelo extrator?') && acaoSessao('limpar'));
$('#auto-navegador').addEventListener('change', (e) => api('/api/sessao', { method: 'POST', body: JSON.stringify({ usarNavegador: e.target.checked }) }));
$('#btn-diagnostico').addEventListener('click', async (e) => {
  const b = e.target;
  b.disabled = true;
  $('#resultado-diagnostico').innerHTML = '<p class="ajuda">Testando… (leva uns 15 segundos)</p>';
  try {
    const r = await api(`/api/diagnostico?hl=${$('#idioma').value}&gl=${$('#regiao').value}`);
    $('#resultado-diagnostico').innerHTML = `<ul class="diagnostico">${r.etapas.map((x) =>
      `<li class="${x.ok ? 'ok' : 'falha'}">${x.ok ? '✔' : '✖'} <b>${esc(x.nome)}</b> — ${esc(x.detalhe)} <small>(${(x.ms / 1000).toFixed(1)} s)</small></li>`).join('')}</ul>
      <p class="${r.ok ? 'ajuda' : 'erro'}">${r.ok ? 'Tudo compatível.' : 'Algo mudou no Google ou a conexão falhou. Tente "Renovar sessão" e rode de novo.'}</p>`;
  } catch (ex) {
    $('#resultado-diagnostico').innerHTML = `<p class="erro">${esc(ex.message)}</p>`;
  }
  b.disabled = false;
});

function linhas(sel) {
  return $(sel).value.split(/\n|,/).map((x) => x.trim()).filter(Boolean);
}
function estimar() {
  const nt = Math.max(tipos.length, 0);
  const grade = $('input[name=estrategia]:checked')?.value === 'grade';
  let txt = '';
  if (modoLocal === 'brasil') {
    const m = totalMunicipios();
    const b = Math.max(1, linhas('#bairros').length);
    if (nt && m) txt = grade ? `${fmt(nt)} tipo(s) × ${fmt(m)} município(s) em grade — o número de buscas depende da área de cada cidade` : `≈ ${fmt(nt * m * b)} busca(s)`;
  } else if (modoLocal === 'livre') {
    if (nt && locaisLivres.length) txt = `≈ ${fmt(nt * locaisLivres.length)} busca(s)${grade ? ' (× pontos da grade)' : ''}`;
  } else if (modoLocal === 'ponto' && nt) {
    const raio = num($('#raio').value) || 2;
    const esp = { larga: 2, media: 1, densa: 0.5, muito_densa: 0.25 }[$('#densidade').value];
    txt = `≈ ${fmt(Math.max(1, Math.round((Math.PI * raio * raio) / (esp * esp))) * nt)} busca(s) na grade`;
  }
  $('#estimativa').textContent = txt;
}
$('#densidade').addEventListener('change', estimar);

// ---------- envio ----------
function montarConfig() {
  const estrategia = $('input[name=estrategia]:checked').value;
  const cfg = {
    nome: $('#nome').value,
    tipos: [...tipos],
    modo_local: modoLocal,
    estrategia,
    densidade: $('#densidade').value,
    paginas_por_ponto: num($('#paginas-ponto').value),
    max_paginas: num($('#max-paginas').value),
    somente_dentro_da_cidade: $('#dentro-cidade').checked,
    embaralhar_cidades: $('#embaralhar').checked,
    idioma: $('#idioma').value,
    regiao: $('#regiao').value,
    max_resultados_por_consulta: num($('#max-consulta').value),
    max_resultados_total: num($('#max-total').value),
    paralelismo: num($('#paralelo').value) || 2,
    filtros: {
      min_avaliacoes: num($('#f-min-av').value),
      max_avaliacoes: num($('#f-max-av').value),
      nota_minima: num($('#f-nota-min').value),
      nota_maxima: num($('#f-nota-max').value),
      site: $('#f-site').value,
      telefone: $('#f-tel').value,
      categoria_contem: $('#f-cat').value,
      categoria_exclui: $('#f-cat-ex').value,
      excluir_fechados: $('#f-fechados').checked,
    },
    detalhes: { ativo: $('#x-detalhes').checked },
    fotos: { ativo: $('#x-fotos').checked, maximo: num($('#x-fotos-max').value) || 0, baixar: $('#x-fotos-baixar').checked, street_view: $('#x-fotos-sv').checked },
    contatos: {
      ativo: $('#x-contatos').checked, paginas_extras: num($('#x-paginas').value), recomendados: num($('#x-recom').value),
      verificar: $('#x-verificar').checked, verificar_todos: $('#x-verif-todos').checked, servico: $('#x-servico').value, chave: $('#x-chave-verif').value.trim(),
    },
    leads: {
      ativo: $('#x-leads').checked, chave: $('#x-apollo-chave').value.trim(), maximo: num($('#x-apollo-max').value) || 3,
      cargos: $('#x-apollo-cargos').value, localizacoes: $('#x-apollo-local').value,
      senioridades: marcados('#x-apollo-senior'), status_email: marcados('#x-apollo-status'),
    },
    avaliacoes: { ativo: $('#x-aval').checked, maximo: num($('#x-aval-max').value) || 0, ordenacao: $('#x-aval-ord').value, desde: $('#x-aval-desde').value || null },
  };
  if (modoLocal === 'brasil') {
    cfg.estados = locais.filter((l) => l.tipo === 'estado').map((l) => l.uf);
    cfg.regioes = locais.filter((l) => l.tipo === 'meso').map((l) => ({ uf: l.uf, meso: l.meso }));
    cfg.municipios = locais.filter((l) => l.tipo === 'mun').map((l) => l.id);
    cfg.bairros = linhas('#bairros');
    cfg.rotulo_local = locais.length === 1 ? rotuloLocal(locais[0]).replace(/ \(.*\)$/, '') : `${locais.length} localidades`;
  } else if (modoLocal === 'livre') {
    cfg.locais_livres = [...locaisLivres];
    cfg.raio_km = num($('#raio-livre').value);
    cfg.rotulo_local = locaisLivres.length === 1 ? locaisLivres[0].descricao : `${locaisLivres.length} localidades`;
  } else if (modoLocal === 'ponto') {
    cfg.ponto = { lat: num($('#lat').value), lon: num($('#lon').value), raio_km: num($('#raio').value) };
    cfg.rotulo_local = 'Ponto + raio';
  } else if (modoLocal === 'poligono') {
    cfg.poligono = $('#geojson').value;
    cfg.rotulo_local = 'Polígono';
  } else if (modoLocal === 'links') {
    cfg.links = $('#links').value.split('\n').map((x) => x.trim()).filter(Boolean);
    cfg.rotulo_local = 'Links do Maps';
  }
  return cfg;
}

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const erro = $('#erro-form');
  erro.classList.add('oculto');
  const cfg = montarConfig();
  try { // o servidor confere tudo e responde com a lista completa do que falta
    const t = await api('/api/tarefas', { method: 'POST', body: JSON.stringify(cfg) });
    estado.tarefas.set(t.id, t);
    aviso('Extração iniciada');
    abrirDetalhe(t.id);
  } catch (ex) {
    erro.textContent = ex.message;
    erro.classList.remove('oculto');
    erro.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (ex.detalhe && !ex.detalhe.faltou) mostrarErro(ex.detalhe); // erros de validação ficam no próprio formulário
  }
});

// ---------- tarefas ----------
const estado = { tarefas: new Map(), detalhe: null, resultados: [], filtrados: [], pagina: 0, ordem: { col: null, asc: false } };
const NOMES_STATUS = {
  na_fila: 'Na fila', planejando: 'Planejando', executando: 'Buscando', detalhes: 'Buscando detalhes', fotos: 'Coletando fotos',
  avaliacoes: 'Extraindo avaliações', contatos: 'Buscando contatos', verificando: 'Verificando e-mails', leads: 'Buscando decisores',
  concluida: 'Concluída', cancelada: 'Cancelada', erro: 'Erro', interrompida: 'Interrompida',
};
const FASES = ['detalhes', 'fotos', 'avaliacoes', 'contatos', 'verificando', 'leads'];
const ATIVAS = new Set(['na_fila', 'planejando', 'executando', ...FASES]);

function porcentagem(t) {
  const p = t.progresso;
  if (FASES.includes(t.status) && p.enriquecimento_total) return (100 * p.enriquecimento_feito) / p.enriquecimento_total;
  if (t.status === 'concluida') return 100;
  return p.consultas_total ? (100 * p.consultas_feitas) / p.consultas_total : 0;
}

function htmlProgresso(t) {
  const p = t.progresso;
  const enr = FASES.includes(t.status) ? ` · ${fmt(p.enriquecimento_feito)}/${fmt(p.enriquecimento_total)}` : '';
  return `
    <div class="progresso"><div style="width:${porcentagem(t).toFixed(1)}%"></div></div>
    <div class="numeros">
      <span><b>${fmt(p.resultados)}</b> empresas</span>
      <span>${fmt(p.consultas_feitas)}/${fmt(p.consultas_total)} buscas${enr}</span>
      <span>${fmt(p.encontrados)} vistos</span>
      <span>${fmt(p.filtrados)} filtrados</span>
      <span>${fmt(p.fora_da_area)} fora da área</span>
      ${p.erros ? `<span style="color:var(--vermelho)">${fmt(p.erros)} erro(s)</span>` : ''}
    </div>`;
}

function botoesTarefa(t) {
  return `
    ${ATIVAS.has(t.status) ? `<button class="botao perigo" data-acao="cancelar" data-id="${t.id}">Cancelar</button>` : ''}
    <a class="botao secundario" href="/api/tarefas/${t.id}/exportar/xlsx">Excel</a>
    <a class="botao secundario" href="/api/tarefas/${t.id}/exportar/csv">CSV</a>
    <a class="botao secundario" href="/api/tarefas/${t.id}/exportar/json">JSON</a>
    ${(t.status === 'erro' || t.status === 'interrompida') && t.erro_detalhe ? `<button class="botao secundario" data-acao="erro" data-id="${t.id}">Ver erro</button>` : ''}
    ${!ATIVAS.has(t.status) ? `<button class="botao link" data-acao="excluir" data-id="${t.id}" style="color:var(--vermelho)">Excluir</button>` : ''}`;
}

function desenharTarefas() {
  const lista = [...estado.tarefas.values()].sort((a, b) => b.criada_em.localeCompare(a.criada_em));
  const ativas = lista.filter((t) => ATIVAS.has(t.status)).length;
  const c = $('#contador-ativas');
  c.textContent = ativas;
  c.classList.toggle('oculto', !ativas);
  $('#lista-tarefas').innerHTML = lista.length
    ? lista.map((t) => `
      <div class="cartao tarefa">
        <div>
          <h3><a href="#" data-acao="abrir" data-id="${t.id}">${esc(t.nome)}</a><span class="status ${t.status}">${NOMES_STATUS[t.status] || t.status}</span></h3>
          <div class="meta">Criada em ${new Date(t.criada_em).toLocaleString('pt-BR')}${t.erro ? ` · ${esc(t.erro)}` : ''}</div>
          ${htmlProgresso(t)}
        </div>
        <div class="linha">${botoesTarefa(t)}</div>
      </div>`).join('')
    : '<div class="vazio-grande">Nenhuma extração ainda. Comece em <b>Nova extração</b>.</div>';
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-acao]');
  if (!b) return;
  e.preventDefault();
  const id = b.dataset.id;
  if (b.dataset.acao === 'abrir') abrirDetalhe(id);
  if (b.dataset.acao === 'erro') { const d = estado.tarefas.get(id)?.erro_detalhe; if (d) mostrarErro(d); }
  if (b.dataset.acao === 'cancelar') { await api(`/api/tarefas/${id}/cancelar`, { method: 'POST' }); aviso('Cancelando…'); }
  if (b.dataset.acao === 'excluir' && confirm('Excluir esta tarefa e os resultados?')) {
    await api(`/api/tarefas/${id}`, { method: 'DELETE' });
    estado.tarefas.delete(id);
    if (estado.detalhe === id) mostrarTela('tarefas');
    desenharTarefas();
  }
});

// ---------- detalhe e tabela ----------
const COLS = [
  { t: 'Nome', v: (l) => l.nome, h: (l) => `<b>${esc(l.nome)}</b><div class="peq">${esc(l.categoria_principal || '')}</div>` },
  { t: 'Nota', v: (l) => l.nota ?? -1, h: (l) => (l.nota != null ? `★ ${String(l.nota).replace('.', ',')}` : '—'), c: 'num' },
  { t: 'Avaliações', v: (l) => l.avaliacoes, h: (l) => fmt(l.avaliacoes), c: 'num' },
  { t: 'Telefone', v: (l) => l.telefone || '', h: (l) => esc(l.telefone || '—') },
  { t: 'Site', v: (l) => l.site || '', h: (l) => (l.site ? `<a href="${esc(/^https?:\/\//i.test(l.site) ? l.site : '#')}" target="_blank" rel="noopener">${esc(l.site.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40))}</a>` : '—') },
  { t: 'E-mails', v: (l) => (l.emails || []).join(', '), h: (l) => esc((l.emails || []).slice(0, 2).join(', ')) || '—' },
  { t: 'Cidade', v: (l) => `${l.cidade || ''} ${l.estado || ''}`, h: (l) => `${esc(l.cidade || '')}<div class="peq">${esc(l.bairro || '')}</div>` },
  { t: 'Endereço', v: (l) => l.endereco || '', h: (l) => `<span class="peq">${esc(l.endereco || '')}</span>` },
];

async function abrirDetalhe(id) {
  estado.detalhe = id;
  estado.pagina = 0;
  mostrarTela('detalhe');
  await atualizarDetalhe(true);
}

async function atualizarDetalhe(resultadosTambem) {
  const id = estado.detalhe;
  if (!id) return;
  const t = await api(`/api/tarefas/${id}`);
  estado.tarefas.set(id, { ...estado.tarefas.get(id), ...t });
  desenharCabecalho(t);
  $('#log').textContent = (t.log || []).join('\n');
  if (resultadosTambem) {
    estado.resultados = await api(`/api/tarefas/${id}/resultados`);
    filtrarResultados();
  }
}

function desenharCabecalho(t) {
  $('#detalhe-cabecalho').innerHTML = `
    <div class="tarefa">
      <div>
        <h3>${esc(t.nome)}<span class="status ${t.status}">${NOMES_STATUS[t.status] || t.status}</span></h3>
        <div class="meta">Criada em ${new Date(t.criada_em).toLocaleString('pt-BR')}${t.finalizada_em ? ` · finalizada em ${new Date(t.finalizada_em).toLocaleString('pt-BR')}` : ''}${t.erro ? ` · ${esc(t.erro)}` : ''}</div>
        ${htmlProgresso(t)}
      </div>
      <div class="linha">${botoesTarefa(t)}</div>
    </div>`;
}

function filtrarResultados() {
  const q = normalizar($('#filtro-resultados').value);
  let lista = estado.resultados;
  if ($('#so-site').checked) lista = lista.filter((l) => l.site);
  if ($('#so-tel').checked) lista = lista.filter((l) => l.telefone);
  if ($('#so-email').checked) lista = lista.filter((l) => l.emails?.length);
  if (q) lista = lista.filter((l) => normalizar([l.nome, l.categorias?.join(' '), l.cidade, l.bairro, l.endereco, l.telefone, l.site, l.emails?.join(' ')].join(' ')).includes(q));
  const { col, asc } = estado.ordem;
  if (col != null) {
    const f = COLS[col].v;
    lista = [...lista].sort((a, b) => {
      const x = f(a), y = f(b);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt');
      return asc ? r : -r;
    });
  }
  estado.filtrados = lista;
  desenharTabela();
}

const POR_PAGINA = 100;
function desenharTabela() {
  const { col, asc } = estado.ordem;
  $('#tabela thead').innerHTML = `<tr>${COLS.map((c, i) => `<th data-col="${i}" class="${col === i ? `ordenado ${asc ? 'asc' : ''}` : ''}">${c.t}</th>`).join('')}</tr>`;
  const ini = estado.pagina * POR_PAGINA;
  const pagina = estado.filtrados.slice(ini, ini + POR_PAGINA);
  $('#tabela tbody').innerHTML = pagina.length
    ? pagina.map((l, i) => `<tr data-i="${ini + i}">${COLS.map((c) => `<td class="${c.c || ''}">${c.h(l)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${COLS.length}" class="vazio-grande">Nenhum resultado${estado.resultados.length ? ' com esse filtro' : ' ainda'}.</td></tr>`;
  $('#contagem-resultados').textContent = `${fmt(estado.filtrados.length)} de ${fmt(estado.resultados.length)}`;
  const paginas = Math.ceil(estado.filtrados.length / POR_PAGINA);
  $('#paginacao').innerHTML = paginas > 1
    ? `<button class="botao secundario" data-pag="-1" ${estado.pagina === 0 ? 'disabled' : ''}>‹ Anterior</button>
       <span>Página ${estado.pagina + 1} de ${paginas}</span>
       <button class="botao secundario" data-pag="1" ${estado.pagina >= paginas - 1 ? 'disabled' : ''}>Próxima ›</button>`
    : '';
}

$('#tabela thead').addEventListener('click', (e) => {
  const th = e.target.closest('th');
  if (!th) return;
  const c = +th.dataset.col;
  estado.ordem = { col: c, asc: estado.ordem.col === c ? !estado.ordem.asc : c === 0 };
  filtrarResultados();
});
$('#paginacao').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pag]');
  if (!b) return;
  estado.pagina += +b.dataset.pag;
  desenharTabela();
  $('.tabela-rolagem').scrollTop = 0;
});
$('#filtro-resultados').addEventListener('input', debounce(() => { estado.pagina = 0; filtrarResultados(); }, 200));
['#so-site', '#so-tel', '#so-email'].forEach((s) => $(s).addEventListener('change', () => { estado.pagina = 0; filtrarResultados(); }));
$('#btn-voltar').addEventListener('click', () => { estado.detalhe = null; mostrarTela('tarefas'); desenharTarefas(); });

$('#tabela tbody').addEventListener('click', (e) => {
  if (e.target.closest('a')) return; // clique em link abre o site, não o detalhe
  const tr = e.target.closest('tr[data-i]');
  if (tr) abrirLugar(estado.filtrados[+tr.dataset.i]);
});

function linkOuTexto(v) {
  if (!v) return '';
  return /^https?:\/\//.test(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v);
}

const STATUS_EMAIL = { valido: 'válido', invalido: 'inválido', arriscado: 'arriscado (aceita tudo)', dominio_valido: 'domínio válido', desconhecido: 'desconhecido' };

function abrirLugar(l) {
  const lista = (arr) => (arr || []).map(linkOuTexto).join('<br>');
  const campos = [
    ['Categorias', esc((l.categorias || []).join(', '))],
    ['Nota', l.nota != null ? `★ ${String(l.nota).replace('.', ',')} (${fmt(l.avaliacoes)} avaliações)` : '—'],
    ['Telefone', esc([l.telefone, l.telefone_internacional].filter(Boolean).join(' · '))],
    ['Site', linkOuTexto(l.site)],
    ['E-mails', esc((l.emails || []).join(', '))],
    ['E-mail recomendado', esc((l.emails_recomendados || []).join(', '))],
    ['Verificação', (l.verificacao_emails || []).map((v) => `${esc(v.email)}: <b>${esc(STATUS_EMAIL[v.status] || v.status)}</b> <span class="ajuda">${esc(v.motivo || '')}</span>`).join('<br>')],
    ['Instagram', lista(l.instagram)], ['Facebook', lista(l.facebook)], ['LinkedIn', lista(l.linkedin)],
    ['WhatsApp', lista(l.whatsapp)], ['YouTube', lista(l.youtube)], ['TikTok', lista(l.tiktok)], ['Twitter/X', lista(l.twitter)],
    ['Endereço', esc(l.endereco)],
    ['Bairro / Cidade / UF', esc([l.bairro, l.cidade, l.estado].filter(Boolean).join(' · '))],
    ['CEP', esc(l.cep)],
    ['Coordenadas', l.latitude != null ? `${l.latitude}, ${l.longitude}` : ''],
    ['Horário', (l.horarios || []).map((h) => `${esc(h.dia)}: ${esc(h.horarios.join(', '))}`).join('<br>')],
    ['Situação', esc([l.situacao, l.fechado_temporariamente && 'Fechado temporariamente', l.fechado_permanentemente && 'Fechado permanentemente'].filter(Boolean).join(' · '))],
    ['Faixa de preço', esc(l.faixa_preco)],
    ['Descrição', esc(l.descricao)],
    ['Distribuição das notas', l.distribuicao_notas ? [5, 4, 3, 2, 1].map((n) => `${n}★ ${fmt(l.distribuicao_notas[n])}`).join(' · ') : ''],
    ['Palavras-chave', esc((l.palavras_chave_avaliacoes || []).map((k) => `${k.palavra} (${k.qtd})`).join(', '))],
    ['Horários de pico', l.horarios_pico ? Object.entries(l.horarios_pico).map(([dia, hs]) => {
      const top = [...hs].sort((a, b) => (b.ocupacao ?? 0) - (a.ocupacao ?? 0))[0];
      return top?.ocupacao ? `${esc(dia)}: ${top.hora}h (${top.ocupacao}%)` : '';
    }).filter(Boolean).join('<br>') : ''],
    ['Concorrentes', (l.concorrentes || []).map((c) => `${esc(c.nome)} <span class="ajuda">★ ${c.nota ?? '-'} · ${fmt(c.avaliacoes)}</span>`).join('<br>')],
    ['Total de fotos', l.total_fotos ? fmt(l.total_fotos) : ''],
    ['Plus code', esc(l.plus_code)],
    ['Proprietário', esc(l.proprietario)],
    ['Reservas', (l.reservas || []).map((r) => linkOuTexto(r.link)).join('<br>')],
    ['Pedido online', (l.pedido_online || []).map((r) => `${esc(r.fonte)}: ${linkOuTexto(r.link)}`).join('<br>')],
    ['Comodidades', (l.sobre || []).map((g) => `<b>${esc(g.grupo)}:</b> ${esc(g.itens.filter((i) => i.disponivel).map((i) => i.nome).join(', '))}`).join('<br>')],
    ['Pode reivindicar', l.pode_reivindicar ? 'Sim' : 'Não'],
    ['Google Maps', linkOuTexto(l.link)],
    ['Place ID', esc(l.place_id)],
    ['Consulta', esc(l.consulta)],
    ['Erro nos contatos', esc(l.erro_contatos)],
    ['Erro nos leads', esc(l.erro_leads)],
  ].filter(([, v]) => v);
  const capa = l.imagem ? `<img class="capa" src="${esc(l.imagem)}" alt="" loading="lazy">` : '';
  const fotos = (l.fotos || []).length
    ? `<h3>Fotos (${l.fotos.length})</h3><div class="galeria">${l.fotos.map((f) =>
      `<a href="${esc(f.link)}" target="_blank" rel="noopener"><img src="${esc(f.link.replace(/=w1920-h1080|=s1920/, '=w300-h220'))}" alt="" loading="lazy"></a>`).join('')}</div>`
    : '';
  const leads = (l.leads || []).length
    ? `<h3>Decisores (${l.leads.length})</h3><table class="mini"><tr><th>Nome</th><th>Cargo</th><th>E-mail</th><th>LinkedIn</th></tr>${l.leads.map((p) =>
      `<tr><td>${esc(p.nome)}</td><td>${esc(p.cargo || '')}</td><td>${esc(p.email || '—')}${p.status_email ? ` <span class="ajuda">${esc(p.status_email)}</span>` : ''}</td><td>${linkOuTexto(p.linkedin)}</td></tr>`).join('')}</table>`
    : '';
  const avs = (l.lista_avaliacoes || []).map((a) => `
    <div class="avaliacao"><b>${esc(a.autor)}</b> · ${'★'.repeat(a.nota || 0)} · <span class="ajuda">${esc(a.publicada || '')}</span>
      <div>${esc(a.texto || '(sem texto)')}</div>
      ${a.resposta_proprietario ? `<div class="ajuda"><b>Resposta:</b> ${esc(a.resposta_proprietario)}</div>` : ''}</div>`).join('');
  $('#modal-titulo').textContent = l.nome;
  $('#modal-corpo').innerHTML = `${capa}<dl class="campos">${campos.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    ${leads}${fotos}${avs ? `<h3>Avaliações (${l.lista_avaliacoes.length})</h3>${avs}` : ''}`;
  $('#modal').showModal();
}
$('#modal-fechar').addEventListener('click', () => $('#modal').close());
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('#modal').close(); });

// ---------- tempo real ----------
let ultimaRecarga = 0;
let semConexao = false;
function conectarEventos() {
  const fonte = new EventSource('/api/eventos');
  fonte.addEventListener('tarefa', (e) => {
    const t = JSON.parse(e.data);
    const anterior = estado.tarefas.get(t.id)?.status;
    estado.tarefas.set(t.id, t);
    if (anterior && ATIVAS.has(anterior) && !ATIVAS.has(t.status)) aoTerminarTarefa(t);
    if ($('#tela-tarefas').classList.contains('ativa')) desenharTarefas();
    else {
      const ativas = [...estado.tarefas.values()].filter((x) => ATIVAS.has(x.status)).length;
      $('#contador-ativas').textContent = ativas;
      $('#contador-ativas').classList.toggle('oculto', !ativas);
    }
    if (estado.detalhe === t.id) {
      desenharCabecalho(t);
      $('#log').textContent = (t.log || []).join('\n');
      const terminou = !ATIVAS.has(t.status);
      if (terminou || Date.now() - ultimaRecarga > 4000) { ultimaRecarga = Date.now(); atualizarDetalhe(true); }
    }
  });
  fonte.addEventListener('removida', (e) => { estado.tarefas.delete(JSON.parse(e.data).id); desenharTarefas(); });
  fonte.onopen = () => { if (semConexao) { semConexao = false; aviso('Conexão com o programa restabelecida'); } };
  fonte.onerror = () => {
    fonte.close();
    if (!semConexao) {
      semConexao = true;
      aviso('Perdi a conexão com o programa. Se a janela preta (terminal) foi fechada, abra o extrator de novo e recarregue a página.', 9000);
    }
    setTimeout(conectarEventos, 3000);
  };
}

// ---------- início ----------
(async function iniciar() {
  categorias = await api('/api/categorias');
  $('#grupo-tipos').innerHTML += Object.entries(categorias).map(([g, l]) => `<option value="${esc(g)}">${esc(g)} (${l.length})</option>`).join('');
  estados = await api('/api/estados');
  $('#uf').innerHTML += estados.map((e) => `<option value="${e.sigla}">${esc(e.nome)} (${e.sigla})</option>`).join('');
  for (const t of await api('/api/tarefas')) estado.tarefas.set(t.id, t);
  desenharTipos();
  desenharLocais();
  desenharLivres();
  atualizarEstrategia();
  desenharTarefas();
  conectarEventos();
  atualizarSessao().catch(() => {});
  // pedido de apoio a cada abertura do programa (dados/apoio.json: "ativo": false desliga)
  apoioCfg = await api('/api/apoio').catch(() => null);
  setTimeout(() => mostrarApoio(), 600);
})();
