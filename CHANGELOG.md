# Changelog

Todas as mudanças relevantes deste projeto são registradas aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.1.0] — 2026-10-29

### Novidades
- **Busca por país** (aba *Outro país* / `"modo_local": "pais"`): as maiores cidades de qualquer um dos 244 países, opcionalmente
  só de alguns estados/províncias, com prévia das cidades na tela. Base GeoNames embutida (~32 mil cidades com 15 mil+ habitantes).
  O país do Google é ajustado automaticamente e `"idioma": "auto"` usa o idioma do país.
- **Calcular plano** (interface) e `--simular` (CLI): mostra quantas buscas, requisições e o tempo estimado antes de iniciar.
- CLI: `--exemplo`, `--paises`, `--regioes` e ajuda detalhada; 11 exemplos prontos em `exemplos/`, um por modo.
- Cidades e estados **por nome** no JSON (`"Campinas - SP"`, `"Goiânia/GO"`, `["BR"]` = Brasil inteiro), com sugestão quando o nome
  é ambíguo ou tem erro de digitação.
- Aviso de campo desconhecido na configuração, com sugestão do nome certo (ex.: `"tipo"` → `"tipos"`).
- Botão *Brasil inteiro*, guia "Como funciona" e explicação em cada seção e campo da interface (o que é, quando usar, o que
  muda no resultado), inclusive nas telas de tarefas e resultados e nos números de progresso.
- Arquivo `.env` opcional (veja `.env.exemplo`) e referência completa da configuração em `docs/CONFIGURACAO.md`.
- `CREDITOS.md` com as fontes de dados, bibliotecas e licenças (inclui a atribuição CC BY 4.0 do GeoNames), também citadas no
  rodapé da interface.

### Precisão
- A busca rápida por município agora vai **centrada na coordenada da cidade** (antes ia sem coordenada), o que evita confundir
  homônimos. As coordenadas vêm das fronteiras do IBGE (`npm run dados-geo` regera).
- Filtro "somente dentro da área" mais rigoroso: confere cidade **e** UF (antes uma rua com o nome da cidade, ou uma cidade homônima
  de outro estado, podia passar); no modo país confere o país e a distância até a cidade.
- Localidades digitadas como texto livre são localizadas no mapa antes da busca.

### Correções
- A CLI parava de mostrar o progresso depois de 400 linhas de log.
- Escolher Mato Grosso dava "Cannot read properties of null (reading 'localeCompare')" e a lista continuava com as mesorregiões do
  estado anterior: municípios criados depois de 2017 (Boa Esperança do Norte) não têm mesorregião no IBGE. Agora herdam a da sua
  região imediata, e a lista é limpa antes de carregar.

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
