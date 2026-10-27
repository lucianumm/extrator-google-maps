// Autocompletar de localidades usando o endpoint de sugestões do próprio Maps
// (https://www.google.com/s?tbm=map&suggest=p).

import { obterJsonGoogle } from './cliente.js';
import { pegar } from './busca.js';

function tipoSugestao(t) {
  if (pegar(t, 3) === 2) return 'consulta';
  const codigo = pegar(t, 7, 2, 0);
  if (codigo === 444) return 'cidade';
  if (codigo === 446) return 'regiao';
  if (codigo === 426) return 'empresa';
  return 'lugar';
}

export async function sugerirLocalidades(texto, { idioma = 'pt-BR', regiao = 'br', limite = 8 } = {}) {
  const params = new URLSearchParams({ tbm: 'map', suggest: 'p', gs_ri: 'maps', authuser: '0', hl: idioma, gl: regiao, q: texto, pb: `!2i${limite}` });
  const dados = await obterJsonGoogle(`https://www.google.com/s?${params}`, { tentativas: 1 });
  const itens = pegar(dados, 0, 1) || [];
  const saida = [];
  for (const item of itens) {
    const t = pegar(item, 22);
    if (!Array.isArray(t)) continue;
    const tipo = tipoSugestao(t);
    if (tipo === 'consulta' || tipo === 'empresa') continue;
    const descricao = pegar(t, 0, 0);
    const lat = pegar(t, 11, 2);
    const lon = pegar(t, 11, 3);
    if (!descricao || typeof lat !== 'number') continue;
    saida.push({ tipo, descricao, principal: pegar(t, 1, 0) ?? descricao, secundario: pegar(t, 2, 0), lat, lon });
  }
  return saida;
}
