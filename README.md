<div align="center">

<img src="publico/apoio/cafe-pix.png" width="240" alt="QR Code Pix para contribuir com um café">

### ☕ Contribua com um café

Este projeto é **gratuito e de código aberto**. Se ele economizou o seu tempo, contribua com qualquer valor por **Pix**:
abra o app do seu banco → **Pix → Ler QR Code** → aponte para o código acima → digite o valor e confira o favorecido
(**Lucianum Magnum Inacio P**).

<details>
<summary>Está no celular ou prefere copiar? Use o Pix Copia e Cola</summary>

<br>

Chave Pix (aleatória): `9c9afabf-3a30-417d-a9e0-801480ca5796`

```text
00020126580014br.gov.bcb.pix01369c9afabf-3a30-417d-a9e0-801480ca57965204000053039865802BR5924Lucianum Magnum Inacio P6009Sao Paulo62230519daqr1441345083046826304F37E
```

No banco: **Pix → Pix Copia e Cola** → cole o código acima.

</details>

*Contribuir é opcional: o programa continua completo e gratuito para todos. Obrigado! 💛*

---

# Extrator Google Maps

**Extraia empresas do Google Maps — nome, telefone, site, endereço, horários, avaliações, e-mails e redes sociais — direto no seu computador, com interface em português e seleção de localidades do IBGE.**

[![CI](https://github.com/lucianumm/extrator-google-maps/actions/workflows/ci.yml/badge.svg)](https://github.com/lucianumm/extrator-google-maps/actions/workflows/ci.yml)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-green.svg)](LICENSE)
[![Node.js ≥ 20](https://img.shields.io/badge/node-%E2%89%A5%2020-339933.svg)](https://nodejs.org)
[![Última versão](https://img.shields.io/github/v/release/lucianumm/extrator-google-maps)](https://github.com/lucianumm/extrator-google-maps/releases)
[![PRs bem-vindos](https://img.shields.io/badge/PRs-bem--vindos-brightgreen.svg)](CONTRIBUTING.md)

[English](README.en.md) · **Português**

</div>

> [!WARNING]
> **Aviso legal — leia antes de usar.**
> Este projeto lê endpoints internos e não documentados do Google Maps. Isso pode violar os
> [Termos de Serviço do Google](https://policies.google.com/terms), que podem mudar ou bloquear o acesso a qualquer momento.
> O projeto **não tem vínculo com o Google**. Dados de contato de pessoas e empresas são dados pessoais:
> trate-os conforme a **LGPD** (ou a lei do seu país) e use só para finalidades legítimas.
> Você é o único responsável pelo uso. O software é fornecido "como está", sem garantias (veja [LICENSE](LICENSE)).

## Sumário

- [O que ele faz](#o-que-ele-faz)
- [Instalação e primeiro uso](#instalação-e-primeiro-uso)
- [Guia de uso](#guia-de-uso)
- [Qual modo escolher?](#qual-modo-escolher)
- [Dicas de precisão](#dicas-de-precisão)
- [Linha de comando](#linha-de-comando)
- [Configuração](#configuração)
- [Sessão do Google e diagnóstico](#sessão-do-google-e-diagnóstico)
- [Segurança e privacidade](#segurança-e-privacidade)
- [Problemas comuns](#problemas-comuns)
- [Quer ajudar a melhorar?](#quer-ajudar-a-melhorar)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Licença e créditos](#licença-e-créditos)

## O que ele faz

- **Busca por tipo de negócio × localidade**: estados inteiros, mesorregiões, municípios e bairros do Brasil (base do IBGE),
  **as maiores cidades de qualquer país** (base GeoNames embutida, filtrável por estado/província), qualquer lugar do mundo
  (autocompletar do Maps), ponto + raio, polígono GeoJSON ou links do Maps.
- **Dois modos de busca**: *Rápida* (até 400 resultados por busca) e *Grade* (divide a área pela fronteira oficial do IBGE e
  encontra muito mais lugares em cidades grandes).
- **Precisão**: cada busca vai centrada na coordenada da cidade e os resultados de fora da área são descartados — por cidade **e**
  UF no Brasil (sem misturar homônimos), por país e distância no exterior, pela fronteira oficial na grade.
- **Fácil de configurar**: guia na própria tela, *Calcular plano* (quantas buscas e quanto tempo antes de rodar), cidades por
  nome (`"Campinas - SP"`) nos arquivos da CLI, exemplos prontos e aviso de campo digitado errado.
- **Dados completos**: nome, categorias, nota, avaliações, telefone, site, endereço, coordenadas, horários, fotos, distribuição das
  notas, palavras-chave das avaliações, comodidades e mais; com conta Google, também horários de pico e concorrentes.
- **Contatos**: e-mails e redes sociais (Instagram, Facebook, LinkedIn, WhatsApp, YouTube, TikTok, X) encontrados no site da empresa,
  com e-mail recomendado e verificação (grátis por DNS/SMTP, ou MillionVerifier/ZeroBounce com a sua chave).
- **Decisores** do Apollo.io (dono, diretor, cargos específicos) com a sua chave.
- **Filtros**: nota, número de avaliações, com/sem site ou telefone, categoria contém/exclui, ignorar fechados.
- **Exportação** em Excel, CSV (abre direto no Excel em português) e JSON, além de uma **linha de comando**.
- **Erros que explicam**: toda falha mostra o que aconteceu, o que faltou e como resolver.
- **Tudo local**: sem conta, sem licença, sem limite artificial, sem enviar seus dados a ninguém.

## Instalação e primeiro uso

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

**Windows:** baixe o projeto e dê dois cliques em `iniciar.bat`.
**Linux/macOS:** `./iniciar.sh`.

Ou, em qualquer sistema:

```bash
git clone https://github.com/lucianumm/extrator-google-maps.git
cd extrator-google-maps
npm install
npm start
```

A interface abre em `http://localhost:3210`. Deixe o terminal aberto enquanto usa o programa.

## Guia de uso

A tela **Nova extração** tem um guia de 30 segundos no topo. Em resumo:

1. **O que extrair** — busque tipos (dentista, pizzaria, academia…), adicione um grupo inteiro (ex.: *Saúde*), cole uma lista
   ou digite qualquer termo e tecle Enter. Cada tipo vira uma busca separada.
2. **Onde** — escolha uma aba:
   - **Brasil** — estado inteiro, mesorregião, municípios (busca ou lista colada: `Campinas - SP`, uma por linha), o *Brasil inteiro*
     e, opcionalmente, bairros.
   - **Outro país** — escolha o país (ex.: Portugal), opcionalmente estados/províncias (ex.: *Florida*), e quantas cidades incluir;
     a prévia mostra exatamente quais cidades serão buscadas, das maiores para as menores.
   - **Qualquer lugar** — autocompletar do próprio Google Maps (cidades, bairros, regiões…).
   - **Ponto + raio** — clique no mapa ou digite latitude/longitude.
   - **Polígono** — desenhe no mapa ou cole um GeoJSON do [geojson.io](https://geojson.io).
   - **Links do Maps** — cole links de busca ou de lugar.
3. **Como buscar** — *Rápida* (cidades pequenas/médias, muitas cidades) ou *Grade* (capitais e áreas grandes; encontra muito mais).
4. **Filtros** e **Dados extras** (detalhes, fotos, avaliações, e-mails e redes sociais, decisores do Apollo) — todos opcionais.
5. Clique em **Calcular plano** para ver quantas buscas, quantas requisições e quanto tempo — sem iniciar nada.
6. Clique em **Iniciar extração** e acompanhe em **Tarefas**: os resultados aparecem em tempo real e podem ser filtrados,
   ordenados e exportados em **Excel**, **CSV** ou **JSON**.

As tarefas ficam salvas em `saida/tarefas/` e continuam disponíveis depois de fechar o programa. As chaves de API não são gravadas
nas tarefas; só ficam no seu navegador se você marcar "Lembrar as chaves".

## Qual modo escolher?

| Quero… | Aba / modo | Estratégia |
|---|---|---|
| Uma ou algumas cidades do Brasil | Brasil → municípios | Rápida |
| Uma capital inteira, sem perder nada | Brasil → o município | Grade (densidade média ou densa) |
| Um estado inteiro ou o Brasil inteiro | Brasil → estado / *Brasil inteiro* | Rápida |
| Só alguns bairros | Brasil → bairros, ou Polígono | Rápida / Grade |
| Um país estrangeiro (ou alguns estados dele) | Outro país | Rápida; Grade para as maiores cidades |
| Uma cidade ou bairro específico no exterior | Qualquer lugar | Rápida ou Grade |
| Tudo em volta de um endereço | Ponto + raio | (sempre grade) |
| Exatamente o que eu vi no Google Maps | Links do Maps | — |

| | Rápida | Grade |
|---|---|---|
| Como funciona | Uma busca por tipo × cidade | Divide a área em pontos e busca em cada um |
| Limite | ~400 resultados por busca (limite do Google) | Praticamente sem limite |
| Tempo | Rápido | 10× a 100× mais buscas |

## Dicas de precisão

- **Deixe marcado "Somente resultados dentro da área"** (padrão). O Google mistura empresas de cidades vizinhas; o extrator
  descarta o que estiver fora — no Brasil confere **cidade e UF** do endereço (nada de *Bom Jesus - RS* numa busca por
  *Bom Jesus - PI*, nem *Rua Campinas* em Goiânia), na grade usa a **fronteira oficial** do IBGE e no exterior confere o **país** e a
  **distância** até a cidade.
- **Capitais e cidades grandes: use Grade.** A busca rápida para em ~400 resultados por termo.
- **Vários termos parecidos** (`Dentista`, `Clínica odontológica`, `Ortodontista`) aumentam a cobertura; duplicados são removidos.
- **No exterior, escreva o tipo no idioma local** e use *Avançado → Idioma: Automático*.
- **Filtre por categoria** (*Categoria contém*: `odonto`) para tirar resultados que o Google acha "parecidos" mas não são.
- Use **Calcular plano** antes de extrações grandes para conferir as cidades e o tempo.

## Linha de comando

Roda uma extração a partir de um arquivo JSON — o mesmo formato que a interface usa. Comece por um exemplo pronto:

```bash
node src/cli.js --exemplo                                  # lista os exemplos (um por modo)
node src/cli.js --exemplo brasil-rapida > minha-tarefa.json
node src/cli.js minha-tarefa.json --simular                # confere e mostra o plano, sem rodar
node src/cli.js minha-tarefa.json --formato xlsx --saida empresas.xlsx
```

Um arquivo mínimo:

```json
{
  "tipos": ["Dentista", "Ortodontista"],
  "modo_local": "brasil",
  "municipios": ["Campinas - SP", "Goiânia - GO"]
}
```

Outro país:

```json
{
  "tipos": ["Clínica dentária"],
  "modo_local": "pais",
  "pais": { "codigo": "PT", "max_cidades": 10 },
  "idioma": "auto"
}
```

| Comando | O que faz |
|---|---|
| `node src/cli.js <arquivo> [--formato csv\|xlsx\|json] [--saida arquivo]` | Roda a extração (padrão: CSV na pasta atual) |
| `node src/cli.js <arquivo> --simular` | Valida e mostra quantas buscas, requisições e quanto tempo |
| `node src/cli.js --exemplo [nome]` | Lista os exemplos ou imprime um deles |
| `node src/cli.js --paises [busca]` | Lista países e códigos (modo `pais`) |
| `node src/cli.js --regioes <país>` | Lista os estados/províncias de um país |
| `node src/cli.js --ajuda` | Ajuda completa |

Cidades podem ser escritas por nome (`"Campinas - SP"`, `"Goiânia/GO"`) ou código do IBGE; estados por sigla ou nome
(`["BR"]` = Brasil inteiro). Todos os campos estão em **[docs/CONFIGURACAO.md](docs/CONFIGURACAO.md)**. `Ctrl+C` cancela e grava o
que já foi coletado.

## Configuração

**As opções de cada extração** (tipos, locais, estratégia, filtros, extras) estão documentadas campo a campo em
**[docs/CONFIGURACAO.md](docs/CONFIGURACAO.md)**.

**As opções do programa** ficam num arquivo `.env` opcional: copie [`.env.exemplo`](.env.exemplo) para `.env` e ajuste.
Variáveis definidas no sistema têm prioridade.

| Variável | Padrão | Efeito |
|---|---|---|
| `PORTA` | `3210` | Porta do servidor local (escuta só em `127.0.0.1`) |
| `INTERVALO_MS` | `600` | Intervalo mínimo entre requisições ao Google, somando todos os trabalhadores |
| `ABRIR_NAVEGADOR` | — | Se definida, abre a interface no navegador padrão ao iniciar |

Se o Google responder 429/5xx, o programa respeita `Retry-After` ou espera 30 s, 60 s… antes de tentar de novo.
Diminua "Buscas em paralelo" (em *Avançado*) ou aumente `INTERVALO_MS` se isso acontecer com frequência.

O pedido de apoio (Pix) mostrado ao abrir e ao concluir uma extração fica em `dados/apoio.json`; quem fizer um fork pode trocar os
dados ou desligar com `"ativo": false`.

## Sessão do Google e diagnóstico

Em **Avançado**:

- **Entrar na conta Google** — abre o Edge/Chrome; entre na conta e feche a janela. Libera a galeria completa de fotos, horários
  de pico e concorrentes (o Google esconde isso de visitantes sem login). Precisa do `playwright-core` (dependência opcional) e do
  Edge ou Chrome instalados.
- **Renovar sessão** — use se o Google pedir verificação. Com a opção automática marcada, o programa abre o navegador sozinho
  quando isso acontecer; basta concluir a verificação na janela.
- **Executar diagnóstico** — testa busca, detalhes, avaliações, fotos e sugestões e mostra o que está ok. No terminal:
  `npm run diagnostico`.

Os cookies da sessão ficam em `dados/cache/sessao.json` (texto puro; em Linux/macOS o arquivo só é legível pelo dono) e o perfil do
navegador em `dados/cache/perfil-navegador/`. **Nunca compartilhe nem versione essa pasta** (já está no `.gitignore`).
Use "Apagar sessão" para removê-los.

## Segurança e privacidade

- O servidor só escuta em `127.0.0.1` e valida `Host` e `Origin` (proteção contra CSRF e DNS rebinding). Não o exponha na rede.
- Sites de empresas e fotos são baixados sem acesso a endereços de rede interna (127.0.0.1, 10.x, 192.168.x…).
- A verificação **grátis** de e-mails abre conexões SMTP (porta 25) com os servidores de e-mail das empresas. Isso pode fazer o seu IP
  entrar em listas de bloqueio; para listas grandes prefira MillionVerifier ou ZeroBounce.
- Nada é enviado a servidores do projeto: as únicas conexões são com o Google, o IBGE, os sites das empresas e os serviços cujas
  chaves você informar.
- Encontrou uma vulnerabilidade? Veja [SECURITY.md](SECURITY.md).

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| "O Google pediu verificação" | Em *Avançado*, clique em **Renovar sessão do Google** e conclua a verificação na janela. Diminua as buscas em paralelo. |
| Poucos resultados em cidade grande | Use o modo **Grade** em vez de *Rápida* (a rápida para em 400 por busca). |
| "O Google limitou as requisições (429)" | Espere alguns minutos e aumente `INTERVALO_MS`. |
| Campos vazios / algo parou de funcionar | O Google mudou o formato. Rode o **diagnóstico**; se falhar, [abra uma issue](https://github.com/lucianumm/extrator-google-maps/issues/new/choose) com o resultado. |
| Verificação de e-mail só diz "domínio válido" | Seu provedor bloqueia a porta 25. Use MillionVerifier ou ZeroBounce. |
| "Edge ou Chrome não encontrado" | Instale um deles; só é necessário para entrar na conta Google/renovar a sessão. |
| Porta 3210 ocupada | Crie um `.env` com `PORTA=3300` (veja `.env.exemplo`) ou inicie com `PORTA=3300 npm start` (PowerShell: `$env:PORTA=3300; npm start`). |
| "Cidade existe em N estados" / "não encontrada" | Escreva com a UF: `"Bom Jesus - PI"`. A mensagem sugere a grafia certa quando há erro de digitação. |
| Vieram empresas de cidades vizinhas | Deixe marcado *Somente resultados dentro da área* (padrão). Elas aparecem como *fora da área* no progresso. |
| Poucos resultados em outro país | Escreva o tipo no idioma local (`dentist`, `odontólogo`) e use *Idioma: Automático*. Aumente *Quantas cidades*. |
| Campo do JSON ignorado | Rode com `--simular`: campos com nome errado geram aviso com a sugestão do nome certo. |

## Quer ajudar a melhorar?

Contribuições são muito bem-vindas — de um erro de digitação corrigido a uma nova funcionalidade.

- 🐛 **Achou um bug?** [Abra uma issue](https://github.com/lucianumm/extrator-google-maps/issues/new/choose). Inclua o botão *Copiar detalhes* da janela de erro.
- 🔧 **O Google mudou o formato?** Esse é o tipo de contribuição mais valioso. Veja o passo a passo em [CONTRIBUTING.md](CONTRIBUTING.md#o-google-mudou-o-formato).
- 💡 **Tem uma ideia?** Abra uma issue de *sugestão* antes de começar a codar, para alinharmos o escopo.
- 🙋 **Quer um ponto de partida?** Procure as issues com os rótulos [`good first issue`](https://github.com/lucianumm/extrator-google-maps/labels/good%20first%20issue) e [`help wanted`](https://github.com/lucianumm/extrator-google-maps/labels/help%20wanted).
- 🌍 **Traduções, documentação e testes** também ajudam muito.

Como contribuir, em resumo:

```bash
git clone https://github.com/<seu-usuario>/extrator-google-maps.git
cd extrator-google-maps
npm install
npm test            # todos os testes devem passar
npm start           # roda a interface em http://localhost:3210
```

Crie uma branch, faça a mudança (com testes quando fizer sentido), rode `npm test` e abra um Pull Request preenchendo o modelo.
Leia o [guia de contribuição](CONTRIBUTING.md) e o [código de conduta](CODE_OF_CONDUCT.md). Veja o histórico em [CHANGELOG.md](CHANGELOG.md).

Ideias em aberto: retomar extrações interrompidas, interface em inglês, armazenamento incremental de resultados, empacotamento como
executável e testes com respostas gravadas do Google.

## Estrutura do projeto

| Pasta/arquivo | Conteúdo |
|---|---|
| `src/maps/` | Endpoints internos do Maps: busca, detalhes do lugar, fotos, avaliações, sugestões, sessão, diagnóstico |
| `src/localidades/ibge.js` | Estados, municípios, mesorregiões e fronteiras do IBGE; nomes de cidades → códigos |
| `src/localidades/paises.js` | Países, regiões e cidades do mundo (modo *Outro país*) |
| `src/geo/grade.js` | Grade de pontos, ponto-em-polígono, círculo |
| `src/tarefas/` | Planejamento das buscas, filtro de área (`area.js`) e execução (fila, deduplicação, filtros, enriquecimento) |
| `src/contatos/` | E-mails e redes sociais nos sites, verificação de e-mails, leads do Apollo |
| `src/erros.js` | Tradução de erros técnicos em causa + como resolver |
| `src/seguranca.js`, `src/rede-segura.js` | Proteção do servidor local e downloads sem acesso à rede interna |
| `src/exportar.js` | CSV / Excel / JSON |
| `src/cli.js` | Linha de comando |
| `publico/` | Interface web |
| `dados/` | Categorias em português, base do IBGE (com coordenadas), países e cidades do mundo (GeoNames), certificado intermediário do IBGE e `apoio.json` |
| `docs/` | [Referência de configuração](docs/CONFIGURACAO.md) |
| `exemplos/` | Arquivos de tarefa prontos para a CLI, um por modo |
| `test/` | Testes (`npm test`, usa o `node:test` nativo) |
| `scripts/` | Utilitários (`npm run diagnostico`; `npm run dados-geo` regera as bases de países/cidades e coordenadas) |

## Licença e créditos

[MIT](LICENSE) © 2026 Lucianum Magnum.

Dados de municípios e fronteiras: [IBGE](https://www.ibge.gov.br) (APIs de Localidades e de Malhas).
Países e cidades do mundo: dados derivados do [GeoNames](https://www.geonames.org), sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Nomes dos países em português: [Unicode CLDR](https://cldr.unicode.org).

Lista completa de fontes, bibliotecas e licenças em **[CREDITOS.md](CREDITOS.md)**.
Mapas: © colaboradores do [OpenStreetMap](https://www.openstreetmap.org/copyright), via [Leaflet](https://leafletjs.com).
Planilhas: [ExcelJS](https://github.com/exceljs/exceljs). Servidor: [Express](https://expressjs.com).

<div align="center">

☕ Gostou? [Contribua com um café](#-contribua-com-um-café) · ⭐ Deixe uma estrela no repositório

</div>
