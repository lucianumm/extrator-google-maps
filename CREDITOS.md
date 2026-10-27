# Créditos e licenças de terceiros

O código do Extrator Google Maps é distribuído sob a [licença MIT](LICENSE). Ele usa os dados e as bibliotecas abaixo, cada um
com a sua própria licença.

## Dados embutidos em `dados/`

| Dados | Arquivos | Fonte | Licença |
|---|---|---|---|
| Estados, municípios e mesorregiões do Brasil | `estados.json`, `municipios.json` | [IBGE — API de Localidades](https://servicodados.ibge.gov.br/api/docs/localidades) | Dados públicos do Governo Federal |
| Coordenadas dos municípios e fronteiras (cache) | `municipios.json` (lat/lon), `cache/malhas/` | [IBGE — API de Malhas Territoriais](https://servicodados.ibge.gov.br/api/docs/malhas) | Dados públicos do Governo Federal |
| Países, estados/províncias e cidades do mundo | `paises.json`, `cidades-mundo.json` | [GeoNames](https://www.geonames.org) (`countryInfo.txt`, `admin1CodesASCII.txt`, `cities15000.zip`) | [Creative Commons Attribution 4.0 (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) |
| Nomes dos países em português | `paises.json` (campo `nome`) | [Unicode CLDR](https://cldr.unicode.org), via `Intl.DisplayNames` do Node.js | [Unicode License v3](https://www.unicode.org/license.txt) |
| Certificado intermediário do IBGE | `certs/sectigo-dv-r36.pem` | Sectigo | Certificado público |

**Atribuição GeoNames (CC BY 4.0):** os arquivos `dados/paises.json` e `dados/cidades-mundo.json` foram derivados dos dados do
GeoNames (www.geonames.org). Foram mantidos só os campos usados pelo programa (nome, coordenadas arredondadas a 4 casas, população e
região de cada cidade; idioma, continente e regiões de cada país), e foram removidos bairros e localidades históricas. Os dados são
fornecidos "como estão", sem garantias. Para regerá-los a partir da fonte: `npm run dados-geo`
([`scripts/atualizar-dados-geo.js`](scripts/atualizar-dados-geo.js)).

## Serviços usados durante o uso

| Serviço | Uso | Termos |
|---|---|---|
| Google Maps | Busca de empresas (endpoints internos, não oficiais — leia o aviso legal no [README](README.md)) | [Termos de Serviço do Google](https://policies.google.com/terms) |
| OpenStreetMap | Mapas da interface (modos ponto e polígono) | © colaboradores do OpenStreetMap, [ODbL](https://www.openstreetmap.org/copyright) |

## Bibliotecas

| Biblioteca | Uso | Licença |
|---|---|---|
| [Express](https://expressjs.com) | Servidor local | MIT |
| [ExcelJS](https://github.com/exceljs/exceljs) | Exportação em Excel | MIT |
| [Leaflet](https://leafletjs.com) | Mapas da interface | BSD-2-Clause |
| [Playwright](https://playwright.dev) (`playwright-core`, opcional) | Abrir o navegador para entrar na conta Google | Apache-2.0 |
