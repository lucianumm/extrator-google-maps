<div align="center">

<img src="publico/apoio/cafe-pix.png" width="240" alt="Pix QR code to buy the author a coffee">

### ☕ Buy me a coffee

This project is **free and open source**. If it saved you time, you can chip in any amount via **Pix**
(Brazilian instant payment): open your bank app → **Pix → Scan QR code** → point at the code above → enter the amount and check the
payee (**Lucianum Magnum Inacio P**). Pix is only available to Brazilian bank accounts; a ⭐ on the repository helps just as much.

<details>
<summary>On your phone or prefer to copy? Use Pix copy-and-paste</summary>

<br>

Pix key (random): `9c9afabf-3a30-417d-a9e0-801480ca5796`

```text
00020126580014br.gov.bcb.pix01369c9afabf-3a30-417d-a9e0-801480ca57965204000053039865802BR5924Lucianum Magnum Inacio P6009Sao Paulo62230519daqr1441345083046826304F37E
```

In your bank app: **Pix → Pix Copia e Cola** → paste the code.

</details>

*Giving is optional: the tool stays complete and free for everyone. Thank you! 💛*

---

# Extrator Google Maps

**Extract businesses from Google Maps — name, phone, website, address, hours, reviews, emails and social profiles — right on your own
computer, with a Brazilian-Portuguese UI and an IBGE-based location picker.**

[![CI](https://github.com/lucianumm/extrator-google-maps/actions/workflows/ci.yml/badge.svg)](https://github.com/lucianumm/extrator-google-maps/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js ≥ 20](https://img.shields.io/badge/node-%E2%89%A5%2020-339933.svg)](https://nodejs.org)
[![Latest release](https://img.shields.io/github/v/release/lucianumm/extrator-google-maps)](https://github.com/lucianumm/extrator-google-maps/releases)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**English** · [Português](README.md)

</div>

> [!WARNING]
> **Legal notice — read before use.**
> This project reads internal, undocumented Google Maps endpoints. That may violate the
> [Google Terms of Service](https://policies.google.com/terms), and Google may change or block access at any time.
> It is **not affiliated with Google**. Contact details of people and businesses are personal data: handle them according to the
> **LGPD**/GDPR or your local law and use them only for legitimate purposes. You are solely responsible for how you use it.
> The software is provided "as is", without warranty (see [LICENSE](LICENSE)).

> The interface and error messages are in Brazilian Portuguese. Contributions that add an English UI are very welcome
> (see [Contributing](#contributing)).

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [Command line](#command-line)
- [Configuration](#configuration)
- [Google session and diagnostics](#google-session-and-diagnostics)
- [Security and privacy](#security-and-privacy)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License and credits](#license-and-credits)

## Features

- **Search by business type × location**: whole Brazilian states, mesoregions, municipalities and neighbourhoods (IBGE data), anywhere
  in the world (Maps autocomplete), point + radius, GeoJSON polygon, or pasted Maps links.
- **Two search modes**: *Fast* (up to 400 results per search) and *Grid* (splits the area using the official IBGE boundary and finds far
  more places in big cities).
- **Rich data**: name, categories, rating, review count, phone, website, address, coordinates, opening hours, photos, rating
  distribution, review keywords, amenities and more; with a Google account also popular times and competitors.
- **Contacts**: emails and social profiles (Instagram, Facebook, LinkedIn, WhatsApp, YouTube, TikTok, X) found on the business website,
  with a recommended email and verification (free DNS/SMTP, or MillionVerifier/ZeroBounce with your own key).
- **Decision makers** from Apollo.io (your own key).
- **Filters**: rating, review count, with/without website or phone, category include/exclude, skip closed places.
- **Export** to Excel, CSV (Excel-friendly) and JSON, plus a **command-line** mode.
- **Errors that explain themselves**: every failure shows what happened, what was missing and how to fix it.
- **Fully local**: no account, no license key, no artificial limits, nothing sent to third parties.

## Quick start

Requires [Node.js](https://nodejs.org) 20+.

```bash
git clone https://github.com/lucianumm/extrator-google-maps.git
cd extrator-google-maps
npm install
npm start          # UI at http://localhost:3210
```

Windows: double-click `iniciar.bat`. Linux/macOS: `./iniciar.sh`.

## Command line

```bash
node src/cli.js exemplos/tarefa.json --formato xlsx --saida empresas.xlsx
```

The JSON file is the same payload the UI sends to `POST /api/tarefas` (see [`exemplos/tarefa.json`](exemplos/tarefa.json)).
`--formato` accepts `csv`, `xlsx` or `json`, and `--saida` sets the output path. `Ctrl+C` cancels and keeps what was collected.

## Configuration

| Variable | Default | Effect |
|---|---|---|
| `PORTA` | `3210` | Local server port (listens on `127.0.0.1` only) |
| `INTERVALO_MS` | `600` | Minimum delay between Google requests, across all workers |
| `ABRIR_NAVEGADOR` | — | If set, opens the UI in the default browser on start |

On 429/5xx the client honours `Retry-After` or backs off 30 s, 60 s… The support dialog (Pix) shown on start-up and after each finished
extraction is configured in `dados/apoio.json`; forks can change it or set `"ativo": false`.

## Google session and diagnostics

Under *Avançado* (Advanced) you can sign in to a Google account (opens Edge/Chrome; unlocks the full photo gallery, popular times and
competitors), renew the session when Google asks for verification, and **run the diagnostic**, which checks search, details, reviews,
photos and suggestions. From the terminal: `npm run diagnostico`.

Session cookies are stored in `dados/cache/` as plain text and are git-ignored. Never share or commit them.

## Security and privacy

- The local server listens on `127.0.0.1` only and validates `Host` and `Origin` (CSRF / DNS-rebinding protection). Do not expose it to a network.
- Company websites and photos are fetched with a guard against private/loopback addresses.
- The free email verification opens SMTP (port 25) connections to company mail servers; that can get your IP blocklisted. Prefer a paid verifier for large lists.
- Nothing is sent to project servers. See [SECURITY.md](SECURITY.md) to report a vulnerability.

## Troubleshooting

| Symptom | What to do |
|---|---|
| "O Google pediu verificação" (Google asked for verification) | *Avançado* → **Renovar sessão do Google**, finish the check in the window, lower parallel searches. |
| Few results in a big city | Use **Grade** (Grid) mode instead of *Rápida* (Fast stops at 400 per search). |
| 429 errors | Wait a few minutes and raise `INTERVALO_MS`. |
| Empty fields / something stopped working | Google changed its format. Run the **diagnostic**; if it fails, [open an issue](https://github.com/lucianumm/extrator-google-maps/issues/new/choose) with its output. |
| Email check only says "domain valid" | Your ISP blocks port 25. Use MillionVerifier or ZeroBounce. |
| Port 3210 in use | `PORTA=3300 npm start` (PowerShell: `$env:PORTA=3300; npm start`). |

## Contributing

Contributions of every size are welcome.

- 🐛 **Found a bug?** [Open an issue](https://github.com/lucianumm/extrator-google-maps/issues/new/choose) and paste the *Copiar detalhes* output from the error dialog.
- 🔧 **Google changed its format?** The most valuable kind of contribution — see [CONTRIBUTING.md](CONTRIBUTING.md#o-google-mudou-o-formato) (in Portuguese).
- 💡 **Have an idea?** Open a *feature request* before coding so we can agree on scope.
- 🙋 **Looking for a starting point?** Browse [`good first issue`](https://github.com/lucianumm/extrator-google-maps/labels/good%20first%20issue) and [`help wanted`](https://github.com/lucianumm/extrator-google-maps/labels/help%20wanted).
- 🌍 **Translations (an English UI!), docs and tests** help a lot too.

```bash
git clone https://github.com/<your-user>/extrator-google-maps.git
cd extrator-google-maps
npm install
npm test            # all tests must pass
npm start
```

Create a branch, make your change (with tests when it makes sense), run `npm test` and open a Pull Request using the template.
Please read the [contributing guide](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md). History: [CHANGELOG.md](CHANGELOG.md).

## License and credits

[MIT](LICENSE) © 2026 Lucianum Magnum.

Municipality data and boundaries: [IBGE](https://www.ibge.gov.br). Map tiles: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors via [Leaflet](https://leafletjs.com).
Spreadsheets: [ExcelJS](https://github.com/exceljs/exceljs). Server: [Express](https://expressjs.com).

<div align="center">

☕ Enjoyed it? [Buy me a coffee](#-buy-me-a-coffee) · ⭐ Star the repository

</div>
