// Exportação dos resultados em CSV (padrão Excel pt-BR, separador ;), XLSX e JSON.

import ExcelJS from 'exceljs';

const STATUS_EMAIL = { valido: 'válido', invalido: 'inválido', arriscado: 'arriscado (catch-all)', dominio_valido: 'domínio válido', desconhecido: 'desconhecido' };

function resumoPico(pico) {
  if (!pico) return '';
  return Object.entries(pico).map(([dia, horas]) => {
    const top = [...horas].sort((a, b) => (b.ocupacao ?? 0) - (a.ocupacao ?? 0))[0];
    return top?.ocupacao ? `${dia}: pico às ${top.hora}h (${top.ocupacao}%)` : null;
  }).filter(Boolean).join(' | ');
}

const lista = (v) => (Array.isArray(v) ? v.join(', ') : v ?? '');
const simNao = (v) => (v ? 'Sim' : 'Não');

export const COLUNAS = [
  ['Nome', (l) => l.nome],
  ['Categoria principal', (l) => l.categoria_principal],
  ['Categorias', (l) => lista(l.categorias)],
  ['Nota', (l) => l.nota],
  ['Avaliações', (l) => l.avaliacoes],
  ['Telefone', (l) => l.telefone],
  ['Telefone internacional', (l) => l.telefone_internacional],
  ['Site', (l) => l.site],
  ['E-mails', (l) => lista(l.emails)],
  ['E-mail recomendado', (l) => lista(l.emails_recomendados)],
  ['Verificação dos e-mails', (l) => (l.verificacao_emails || []).map((v) => `${v.email}: ${STATUS_EMAIL[v.status] || v.status}`).join(' | ')],
  ['E-mails válidos', (l) => lista(l.emails_validos)],
  ['Instagram', (l) => lista(l.instagram)],
  ['Facebook', (l) => lista(l.facebook)],
  ['LinkedIn', (l) => lista(l.linkedin)],
  ['WhatsApp', (l) => lista(l.whatsapp)],
  ['YouTube', (l) => lista(l.youtube)],
  ['TikTok', (l) => lista(l.tiktok)],
  ['Twitter/X', (l) => lista(l.twitter)],
  ['Endereço', (l) => l.endereco],
  ['Bairro', (l) => l.bairro],
  ['Rua', (l) => l.rua],
  ['Cidade', (l) => l.cidade],
  ['Estado', (l) => l.estado],
  ['CEP', (l) => l.cep],
  ['País', (l) => l.pais],
  ['Latitude', (l) => l.latitude],
  ['Longitude', (l) => l.longitude],
  ['Horário de funcionamento', (l) => (l.horarios || []).map((h) => `${h.dia}: ${h.horarios.join(', ')}`).join(' | ')],
  ['Fechado em', (l) => lista(l.fechado_em)],
  ['Situação', (l) => l.situacao],
  ['Fechado temporariamente', (l) => simNao(l.fechado_temporariamente)],
  ['Fechado permanentemente', (l) => simNao(l.fechado_permanentemente)],
  ['Faixa de preço', (l) => l.faixa_preco],
  ['Descrição', (l) => l.descricao],
  ['Imagem de capa', (l) => l.imagem],
  ['Total de fotos', (l) => l.total_fotos],
  ['Fotos extraídas', (l) => (l.fotos || []).map((f) => f.link).join(' | ')],
  ['Distribuição das notas (1–5★)', (l) => (l.distribuicao_notas ? [1, 2, 3, 4, 5].map((n) => `${n}★: ${l.distribuicao_notas[n]}`).join(' | ') : '')],
  ['Palavras-chave das avaliações', (l) => (l.palavras_chave_avaliacoes || []).map((k) => `${k.palavra} (${k.qtd})`).join(', ')],
  ['Horários de pico', (l) => resumoPico(l.horarios_pico)],
  ['Concorrentes', (l) => (l.concorrentes || []).map((c) => `${c.nome} (${c.nota ?? '-'}★, ${c.avaliacoes ?? 0})`).join(' | ')],
  ['Plus code', (l) => l.plus_code],
  ['Comodidades', (l) => (l.sobre || []).map((g) => `${g.grupo}: ${g.itens.filter((i) => i.disponivel).map((i) => i.nome).join(', ')}`).join(' | ')],
  ['Leads (Apollo)', (l) => (l.leads || []).map((p) => [p.nome, p.cargo, p.email].filter(Boolean).join(' — ')).join(' | ')],
  ['Proprietário', (l) => l.proprietario],
  ['Pode reivindicar', (l) => simNao(l.pode_reivindicar)],
  ['Link no Google Maps', (l) => l.link],
  ['Link das avaliações', (l) => l.link_avaliacoes],
  ['Place ID', (l) => l.place_id],
  ['Data ID', (l) => l.data_id],
  ['Consulta', (l) => l.consulta],
];

const COLUNAS_AVALIACOES = [
  ['Empresa', (l) => l.nome],
  ['Place ID', (l) => l.place_id],
  ['Autor', (_, a) => a.autor],
  ['Nota', (_, a) => a.nota],
  ['Texto', (_, a) => a.texto],
  ['Publicada', (_, a) => a.publicada],
  ['Data (UTC)', (_, a) => a.publicada_em],
  ['Resposta do proprietário', (_, a) => a.resposta_proprietario],
  ['Guia local', (_, a) => simNao(a.guia_local)],
  ['Perfil do autor', (_, a) => a.autor_perfil],
  ['Link', (_, a) => a.link],
];

function celulaCsv(v) {
  if (v == null) return '';
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function paraCsv(resultados) {
  const linhas = [COLUNAS.map(([t]) => t).join(';')];
  for (const l of resultados) linhas.push(COLUNAS.map(([, f]) => celulaCsv(f(l))).join(';'));
  return '﻿' + linhas.join('\r\n');
}

export async function paraXlsx(resultados) {
  const livro = new ExcelJS.Workbook();
  livro.creator = 'Extrator Google Maps';
  const folha = livro.addWorksheet('Empresas', { views: [{ state: 'frozen', ySplit: 1 }] });
  folha.columns = COLUNAS.map(([titulo]) => ({ header: titulo, width: Math.min(45, Math.max(12, titulo.length + 4)) }));
  for (const l of resultados) folha.addRow(COLUNAS.map(([, f]) => f(l) ?? null));
  folha.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  folha.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A73E8' } };
  folha.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUNAS.length } };

  const comAvaliacoes = resultados.filter((l) => l.lista_avaliacoes?.length);
  if (comAvaliacoes.length) {
    const fa = livro.addWorksheet('Avaliações', { views: [{ state: 'frozen', ySplit: 1 }] });
    fa.columns = COLUNAS_AVALIACOES.map(([titulo]) => ({ header: titulo, width: titulo === 'Texto' ? 80 : 20 }));
    for (const l of comAvaliacoes) for (const a of l.lista_avaliacoes) fa.addRow(COLUNAS_AVALIACOES.map(([, f]) => f(l, a) ?? null));
    fa.getRow(1).font = { bold: true };
  }
  const comFotos = resultados.filter((l) => l.fotos?.length);
  if (comFotos.length) {
    const ff = livro.addWorksheet('Fotos', { views: [{ state: 'frozen', ySplit: 1 }] });
    ff.columns = [{ header: 'Empresa', width: 40 }, { header: 'Place ID', width: 30 }, { header: 'Link', width: 90 }, { header: 'Arquivo', width: 50 },
      { header: 'Largura', width: 10 }, { header: 'Altura', width: 10 }, { header: 'Publicada em', width: 20 }];
    for (const l of comFotos) for (const f of l.fotos) ff.addRow([l.nome, l.place_id, f.link, f.arquivo || null, f.largura, f.altura, f.publicada_em]);
    ff.getRow(1).font = { bold: true };
  }

  const comLeads = resultados.filter((l) => l.leads?.length);
  if (comLeads.length) {
    const fl = livro.addWorksheet('Leads', { views: [{ state: 'frozen', ySplit: 1 }] });
    fl.columns = ['Empresa', 'Site', 'Nome', 'Cargo', 'E-mail', 'Status do e-mail', 'LinkedIn', 'Senioridade', 'Cidade', 'Estado', 'País']
      .map((h) => ({ header: h, width: 24 }));
    for (const l of comLeads) for (const p of l.leads) fl.addRow([l.nome, l.site, p.nome, p.cargo, p.email, p.status_email, p.linkedin, p.senioridade, p.cidade, p.estado, p.pais]);
    fl.getRow(1).font = { bold: true };
  }
  return livro.xlsx.writeBuffer();
}
