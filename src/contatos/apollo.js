// Leads (pessoas/decisores) do Apollo.io usando a chave de API do próprio usuário.
// A chamada vai direto ao Apollo, sem intermediários. Filtros: senioridade, cargos,
// status do e-mail, localização da pessoa e máximo por empresa.
// Documentação: https://docs.apollo.io (People API Search + People Enrichment).

const BASE = 'https://api.apollo.io/api/v1';

async function chamar(caminho, chave, corpo) {
  const r = await fetch(`${BASE}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'x-api-key': chave },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(30000),
  });
  const texto = await r.text();
  let j;
  try { j = JSON.parse(texto); } catch { j = { error: texto.slice(0, 200) }; }
  if (!r.ok) {
    const e = new Error(`Apollo ${r.status}: ${j.error || j.message || 'erro'}`);
    e.status = r.status;
    throw e;
  }
  return j;
}

const lista = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

export async function buscarLeads(site, cfg) {
  let dominio;
  try { dominio = new URL(site).hostname.replace(/^www\./, ''); } catch { return { leads: [], erro_leads: 'sem site' }; }
  if (/instagram|facebook|linktr|wa\.me|whatsapp|goomer|ifood/.test(dominio)) return { leads: [], erro_leads: 'site é rede social/plataforma' };

  const maximo = Math.min(25, Number(cfg.maximo) || 3);
  const filtros = {
    q_organization_domains_list: [dominio],
    person_seniorities: cfg.senioridades?.length ? cfg.senioridades : undefined,
    person_titles: lista(cfg.cargos).length ? lista(cfg.cargos) : undefined,
    contact_email_status: cfg.status_email?.length ? cfg.status_email : undefined,
    person_locations: lista(cfg.localizacoes).length ? lista(cfg.localizacoes) : undefined,
    page: 1,
    per_page: maximo,
  };

  let busca;
  try {
    busca = await chamar('/mixed_people/api_search', cfg.chave, filtros);
  } catch (e) {
    if (e.status !== 404) throw e;
    busca = await chamar('/mixed_people/search', cfg.chave, filtros); // endpoint antigo
  }
  const pessoas = (busca.people || busca.contacts || []).slice(0, maximo);

  const leads = [];
  for (const p of pessoas) {
    let completo = p;
    if (!p.email && cfg.revelar_emails !== false && p.id) {
      try {
        completo = (await chamar('/people/match', cfg.chave, { id: p.id, reveal_personal_emails: false })).person || p;
      } catch { /* sem créditos ou não encontrado */ }
    }
    leads.push({
      nome: completo.name || [completo.first_name, completo.last_name].filter(Boolean).join(' '),
      cargo: completo.title || null,
      headline: completo.headline || null,
      email: completo.email && !/email_not_unlocked/.test(completo.email) ? completo.email : null,
      status_email: completo.email_status || null,
      linkedin: completo.linkedin_url || null,
      twitter: completo.twitter_url || null,
      facebook: completo.facebook_url || null,
      foto: completo.photo_url || null,
      cidade: completo.city || null,
      estado: completo.state || null,
      pais: completo.country || null,
      senioridade: completo.seniority || null,
      departamentos: completo.departments || [],
    });
  }
  return { leads, erro_leads: null };
}
