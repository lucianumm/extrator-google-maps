# Referência de configuração

Toda extração é descrita por um objeto JSON. A interface web monta esse objeto para você; na linha de comando você o escreve
num arquivo. **É o mesmo formato nos dois casos** — então dá para montar na interface, conferir com *Calcular plano* e
reproduzir depois pela CLI.

> **Atalho:** não comece do zero. Gere um exemplo e edite:
>
> ```bash
> node src/cli.js --exemplo                    # lista os exemplos
> node src/cli.js --exemplo brasil-rapida > minha-tarefa.json
> node src/cli.js minha-tarefa.json --simular  # confere tudo sem rodar
> ```

Só três coisas são obrigatórias: **o que** (`tipos`), **onde** (`modo_local` + os campos do modo) e, opcionalmente, **como**
(`estrategia`). Todo o resto tem um padrão sensato.

```json
{
  "tipos": ["Dentista"],
  "modo_local": "brasil",
  "municipios": ["Campinas - SP"]
}
```

Campos com nome errado (ex.: `"tipo"` em vez de `"tipos"`) não são ignorados em silêncio: o extrator avisa e sugere o nome certo.

## Sumário

- [1. O que buscar](#1-o-que-buscar)
- [2. Onde buscar (`modo_local`)](#2-onde-buscar-modo_local)
  - [brasil](#brasil--estados-mesorregiões-e-municípios-do-ibge) · [pais](#pais--as-maiores-cidades-de-qualquer-país) · [livre](#livre--qualquer-lugar-digitado) · [ponto](#ponto--ponto--raio) · [poligono](#poligono--área-desenhada) · [links](#links--links-do-google-maps)
- [3. Como buscar (estratégia)](#3-como-buscar-estratégia)
- [4. Precisão: "somente dentro da área"](#4-precisão-somente-dentro-da-área)
- [5. Limites, idioma e país do Google](#5-limites-idioma-e-país-do-google)
- [6. Filtros](#6-filtros)
- [7. Dados extras](#7-dados-extras)
- [8. Variáveis de ambiente (.env)](#8-variáveis-de-ambiente-env)
- [Qual modo escolher?](#qual-modo-escolher)

## 1. O que buscar

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `nome` | texto | tipos + local | Nome da tarefa na lista de tarefas e no arquivo exportado. |
| `tipos` | lista de textos | — (**obrigatório**, exceto no modo `links`) | Tipos de negócio. Cada tipo vira uma busca separada em cada local. Pode ser qualquer termo que você digitaria no Google Maps. |

Dica: em outros países, escreva o tipo no idioma local (`"dentist"`, `"odontólogo"`, `"Zahnarzt"`) — o Google encontra mais.

## 2. Onde buscar (`modo_local`)

### `brasil` — estados, mesorregiões e municípios do IBGE

O modo mais preciso para o Brasil: cada município vira uma busca própria, **centrada na coordenada da cidade** e filtrada por
**cidade + UF** (evita misturar homônimos como *Bom Jesus - PI* e *Bom Jesus - RS*).

| Campo | Tipo | Exemplo | Descrição |
|---|---|---|---|
| `municipios` | lista | `["Campinas - SP", "Goiânia/GO", 5300108]` | Por nome com UF (`"Cidade - UF"`, `"Cidade/UF"`, `"Cidade, UF"`), só o nome (se não houver outra cidade igual) ou código IBGE de 7 dígitos. |
| `estados` | lista | `["SP", "Minas Gerais"]` | Estados inteiros, por sigla ou nome. `["BR"]` = Brasil inteiro (5.570 municípios). |
| `regioes` | lista | `[{ "uf": "SP", "meso": "Campinas" }]` | Mesorregiões do IBGE. |
| `bairros` | lista | `["Centro", "Cambuí"]` | Opcional. Busca cada bairro dentro de cada cidade (só na estratégia rápida). |
| `embaralhar_cidades` | sim/não | `false` | Embaralha a ordem das cidades (útil para listas grandes interrompidas no meio). |

Os três primeiros campos podem ser combinados; repetições são removidas. Se um nome não for reconhecido, a mensagem diz qual e
sugere a grafia certa (ex.: *cidade "Campinass - SP" não encontrada (você quis dizer Campinas - SP?)*).

### `pais` — as maiores cidades de qualquer país

Busca nas cidades mais populosas de um país (base GeoNames com ~32 mil cidades de 15 mil+ habitantes, embutida no projeto — não
precisa de internet para escolher). O país do Google (`gl`) é ajustado automaticamente e resultados de outros países ou longe
da cidade são descartados.

```json
"modo_local": "pais",
"pais": { "codigo": "US", "regioes": ["Florida", "Texas"], "max_cidades": 20, "populacao_minima": 50000 }
```

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `pais.codigo` | texto | — (**obrigatório**) | Código ISO de 2 letras (`PT`, `US`, `AR`…) ou nome em português (`"Portugal"`). Também aceita `"pais": "PT"` direto. |
| `pais.regioes` | lista | todas | Estados/províncias/distritos, pelo nome da base (em geral em inglês, ex.: `"Lisbon"`, `"Buenos Aires"`). |
| `pais.max_cidades` | número | `20` | Quantas cidades, das maiores para as menores. `0` = todas. |
| `pais.populacao_minima` | número | `0` | Descarta cidades menores que isso. |

Para descobrir códigos e nomes de regiões:

```bash
node src/cli.js --paises argentina     # códigos dos países
node src/cli.js --regioes US           # estados/províncias de um país
```

Combine com `"idioma": "auto"` para receber categorias e horários no idioma do país.

### `livre` — qualquer lugar digitado

| Campo | Tipo | Exemplo | Descrição |
|---|---|---|---|
| `locais_livres` | lista | `["Lisboa, Portugal", { "descricao": "Copacabana", "lat": -22.97, "lon": -43.18 }]` | Textos ou objetos com coordenada. Texto sem coordenada é localizado automaticamente pelo autocompletar do Maps antes da busca. |
| `raio_km` | número | `5` | Raio da área em volta de cada lugar (só na estratégia grade). |

### `ponto` — ponto + raio

Sempre usa grade. `"ponto": { "lat": -23.5614, "lon": -46.6559, "raio_km": 2 }`.

### `poligono` — área desenhada

`"poligono"`: um GeoJSON (`Polygon`, `MultiPolygon`, `Feature` ou `FeatureCollection`), como objeto ou como texto. Desenhe no
[geojson.io](https://geojson.io) e cole. Sempre usa grade.

### `links` — links do Google Maps

`"links": ["https://www.google.com/maps/search/pizzaria+em+curitiba/@-25.42,-49.27,13z"]`. Links de busca trazem os resultados
daquela busca; links de lugar (`/maps/place/...`) trazem só aquele lugar. `tipos` não é necessário.

## 3. Como buscar (estratégia)

| Campo | Valores | Padrão | Descrição |
|---|---|---|---|
| `estrategia` | `rapida`, `grade` | `rapida` | Veja a tabela abaixo. |
| `max_paginas` | 1–20 | `20` | Rápida: páginas por busca (20 resultados cada; 20 páginas = até 400). |
| `densidade` | `larga`, `media`, `densa`, `muito_densa` | `media` | Grade: espaçamento entre os pontos — 2 km, 1 km, 500 m e 250 m. |
| `paginas_por_ponto` | 1–20 | `2` | Grade: páginas por ponto. |

| | Rápida | Grade |
|---|---|---|
| Como funciona | Uma busca por tipo × cidade | Divide a área em pontos e busca em cada um |
| Limite | ~400 resultados por busca (limite do Google) | Praticamente sem limite |
| Melhor para | Cidades pequenas/médias, muitas cidades de uma vez | Capitais e cidades grandes, áreas desenhadas |
| Área usada | Nome + coordenada da cidade | Fronteira oficial do IBGE (Brasil), círculo proporcional à população (outros países), raio (livre/ponto) ou polígono |
| Tempo | Rápido | 10× a 100× mais buscas |

Use **Calcular plano** (interface) ou `--simular` (CLI) para ver quantas buscas e quanto tempo antes de rodar.

## 4. Precisão: "somente dentro da área"

| Campo | Padrão | Descrição |
|---|---|---|
| `somente_dentro_da_cidade` | `true` | Descarta o que o Google devolver fora da área pedida (aparece como *fora da área* no progresso). |

Como a área é conferida, por modo:

| Modo / estratégia | Regra |
|---|---|
| Brasil, rápida | Cidade **e** UF do endereço batem (rua com o nome da cidade ou homônimo de outro estado não passam) |
| Brasil, grade | Coordenada dentro da fronteira oficial do município (IBGE) |
| País, rápida | País do lugar igual ao escolhido **e** a até 1,5× o raio estimado da cidade |
| País, grade | País igual e coordenada dentro do círculo da cidade |
| Livre (grade), ponto, polígono | Coordenada dentro do círculo/polígono |
| Livre (rápida), links | Sem filtro |

Desmarque só se quiser também empresas da região metropolitana/vizinhança.

## 5. Limites, idioma e país do Google

| Campo | Padrão | Descrição |
|---|---|---|
| `max_resultados_por_consulta` | sem limite | Para cada busca depois de N empresas novas. |
| `max_resultados_total` | sem limite | Para a extração inteira depois de N empresas. |
| `paralelismo` | `2` | Buscas simultâneas (1–6). Mais rápido, mas o ritmo global continua limitado por `INTERVALO_MS`. |
| `idioma` | `pt-BR` | Idioma dos dados (`pt-BR`, `pt-PT`, `en`, `es`, `fr`, `it`, `de`…). `auto` = idioma do país (modo `pais`). |
| `regiao` | `br` (`""` em livre/links; o país escolhido no modo `pais`) | País do Google (`gl`): influencia quais resultados aparecem. `""` = automático. |

## 6. Filtros

Tudo dentro de `"filtros": { ... }`. Campos vazios ou `null` não filtram.

| Campo | Exemplo | Descrição |
|---|---|---|
| `excluir_fechados` | `true` | Ignora fechados temporária ou permanentemente. |
| `min_avaliacoes` / `max_avaliacoes` | `20` / `500` | Número de avaliações. |
| `nota_minima` / `nota_maxima` | `4` / `4.8` | Nota média (0 a 5). |
| `site` | `"com"`, `"sem"`, `""` | Com ou sem site. *Sem site* é ótimo para prospectar quem precisa de um. |
| `telefone` | `"com"`, `"sem"`, `""` | Com ou sem telefone. |
| `categoria_contem` | `"odonto, implante"` | Mantém só quem tem alguma dessas palavras nas categorias (separe por vírgula; sem acento/maiúscula). |
| `categoria_exclui` | `"hospital"` | Descarta quem tem alguma dessas palavras nas categorias. |

## 7. Dados extras

| Bloco | Campos | Descrição |
|---|---|---|
| `detalhes` | `ativo` (padrão `true`) | Descrição, foto de capa, total de fotos, distribuição das notas, palavras-chave, horários de pico e concorrentes (esses dois exigem conta Google). Desative para extrair mais rápido. |
| `fotos` | `ativo`, `maximo` (0 = todas), `baixar`, `street_view` | Links das fotos; com `baixar` os arquivos vão para `saida/tarefas/<id>/fotos/`. |
| `avaliacoes` | `ativo`, `maximo` (0 = todas), `ordenacao` (`mais_recentes`, `mais_relevantes`, `maior_nota`, `menor_nota`), `desde` (`"2026-01-01"`) | Texto, nota, data e autor das avaliações. |
| `contatos` | `ativo`, `paginas_extras` (0–15), `recomendados` (1–3), `verificar`, `verificar_todos`, `servico` (`gratis`, `millionverifier`, `zerobounce`), `chave` | E-mails e redes sociais no site da empresa e verificação dos e-mails. |
| `leads` | `ativo`, `chave`, `maximo`, `cargos`, `localizacoes`, `senioridades`, `status_email` | Decisores do Apollo.io (precisa da sua chave). |

As chaves de API (`contatos.chave`, `leads.chave`) ficam só na memória: o arquivo da tarefa grava `"••••"` no lugar.
Veja todas as opções juntas em [`exemplos/completo.json`](../exemplos/completo.json).

## 8. Variáveis de ambiente (.env)

Copie [`.env.exemplo`](../.env.exemplo) para `.env` na raiz do projeto e ajuste. Variáveis definidas no sistema têm prioridade.

| Variável | Padrão | Efeito |
|---|---|---|
| `PORTA` | `3210` | Porta da interface (o servidor só escuta em `127.0.0.1`). |
| `INTERVALO_MS` | `600` | Intervalo mínimo entre requisições ao Google, somando todas as buscas. Aumente se aparecer erro 429. |
| `ABRIR_NAVEGADOR` | — | Se definida, abre a interface no navegador ao iniciar. |

## Qual modo escolher?

| Quero… | Use |
|---|---|
| Uma ou algumas cidades do Brasil | `brasil` + `municipios`, estratégia `rapida` |
| Uma capital inteira, sem perder nada | `brasil` + o município, estratégia `grade`, densidade `media` ou `densa` |
| Um estado inteiro / o Brasil inteiro | `brasil` + `estados` (`["GO"]` ou `["BR"]`), estratégia `rapida` |
| Só alguns bairros | `brasil` + `bairros` (rápida) ou `poligono` (grade) |
| Outro país inteiro ou alguns estados dele | `pais` + `max_cidades` (e `regioes`) |
| Uma cidade/bairro fora do Brasil em particular | `livre` |
| Tudo em volta de um endereço | `ponto` |
| Exatamente o que eu vi no Google Maps | `links` |
