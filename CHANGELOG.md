# Changelog

Todas as mudanças relevantes deste projeto são registradas aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.0.0] — 2026-10-27

Primeira versão pública.

### Funcionalidades
- Extração de empresas do Google Maps por tipo de negócio × localidade: estados, mesorregiões, municípios e bairros do Brasil (IBGE),
  qualquer lugar do mundo, ponto + raio, polígono GeoJSON e links do Maps.
- Modos de busca *Rápida* e *Grade* (grade de pontos sobre a fronteira oficial do IBGE).
- Detalhes completos do lugar, fotos (links ou download), avaliações, horários de pico e concorrentes (com conta Google).
- E-mails e redes sociais nos sites das empresas, e-mail recomendado, verificação de e-mails (DNS/SMTP grátis, MillionVerifier ou ZeroBounce)
  e decisores do Apollo.io.
- Filtros, exportação em Excel/CSV/JSON, linha de comando (`src/cli.js`) e diagnóstico dos endpoints (`npm run diagnostico`).
- Interface web em português, com atualização em tempo real.
- Janela de apoio (Pix) ao abrir e ao concluir uma extração, configurável em `dados/apoio.json`.
- Erros explicados: causa, o que faltou e como resolver, com detalhes técnicos copiáveis; validação prévia que lista tudo o que falta.

### Segurança
- Servidor local com validação de `Host` e `Origin`, Content-Security-Policy e Leaflet com SRI.
- Downloads de sites e fotos bloqueiam endereços de rede interna, inclusive em redirecionamentos.
- Cookies da sessão gravados com permissão restrita (Linux/macOS).

### Robustez
- Uma falha (ex.: bloqueio do Google) agora interrompe todos os trabalhadores, em vez de só um.
- Gravação atômica dos resultados e da sessão.
- Ritmo de requisições global (`INTERVALO_MS`) com backoff exponencial e respeito ao `Retry-After`.
- Verificação SMTP pausa por 10 minutos após falhas seguidas, em vez de desligar até reiniciar.
- E-mails `noreply@` do próprio domínio deixam de ser recomendados.

[1.0.0]: https://github.com/lucianumm/extrator-google-maps/releases/tag/v1.0.0
