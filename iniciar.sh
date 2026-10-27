#!/usr/bin/env sh
# Linux / macOS: instala as dependências na primeira vez e abre a interface no navegador.
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Node.js não encontrado. Instale em https://nodejs.org (versão 20 ou mais nova)."; exit 1; }
[ -d node_modules ] || npm install --no-fund --no-audit
ABRIR_NAVEGADOR=1 exec node src/servidor.js
