// Proteções do servidor local. Ele só escuta em 127.0.0.1, mas um site aberto no navegador
// ainda poderia falar com ele (CSRF, DNS rebinding); por isso Host e Origin são validados.

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '[::1]']);

// Host deve ser localhost / 127.0.0.1 / [::1] na porta do servidor (barra DNS rebinding).
export function hostPermitido(host, porta) {
  if (typeof host !== 'string') return false;
  const m = host.toLowerCase().match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/);
  if (!m || !HOSTS_LOCAIS.has(m[1])) return false;
  return Number(m[2] || 80) === Number(porta);
}

// Pedidos que alteram estado só valem se vierem da própria interface (mesma origem).
export function origemPermitida(origin, host) {
  if (origin === undefined) return true; // curl, CLI e navegação direta não enviam Origin
  try {
    return new URL(origin).host.toLowerCase() === String(host).toLowerCase();
  } catch {
    return false;
  }
}

export function protegerLocal(porta) {
  return (req, res, next) => {
    if (!hostPermitido(req.headers.host, porta)) return res.status(403).json({ erro: 'Host não permitido' });
    const altera = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (altera && !origemPermitida(req.headers.origin, req.headers.host)) {
      return res.status(403).json({ erro: 'Origem não permitida' });
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; " +
        "img-src * data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    next();
  };
}
