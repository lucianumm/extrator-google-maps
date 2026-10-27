# Como contribuir

Obrigado por querer ajudar! Este guia explica como relatar problemas, sugerir ideias e enviar código.
Ao participar, você concorda com o [Código de Conduta](CODE_OF_CONDUCT.md).

## Formas de ajudar

- **Relatar um bug** — [abra uma issue](https://github.com/lucianumm/extrator-google-maps/issues/new/choose) com o modelo *Bug*.
  Cole o texto do botão **Copiar detalhes** da janela de erro e, se for o caso, o resultado de `npm run diagnostico`.
- **O Google mudou o formato** — veja [abaixo](#o-google-mudou-o-formato). É a contribuição mais valiosa do projeto.
- **Sugerir uma funcionalidade** — abra uma issue com o modelo *Sugestão* **antes** de codar, para alinharmos o escopo.
- **Pegar uma issue** — veja as marcadas com
  [`good first issue`](https://github.com/lucianumm/extrator-google-maps/labels/good%20first%20issue) e
  [`help wanted`](https://github.com/lucianumm/extrator-google-maps/labels/help%20wanted). Comente que vai trabalhar nela.
- **Melhorar a documentação, as traduções e os testes.**

## Preparando o ambiente

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
git clone https://github.com/<seu-usuario>/extrator-google-maps.git
cd extrator-google-maps
npm install
npm test          # testes (node:test nativo, sem dependências extras)
npm start         # interface em http://localhost:3210 (PORTA=3300 npm start para trocar a porta)
npm run diagnostico   # testa os endpoints do Google no terminal
```

## Fluxo de trabalho

1. Faça um fork e crie uma branch a partir da `main`: `git checkout -b feat/minha-ideia`.
2. Faça a mudança, **com testes** quando fizer sentido (há exemplos em [`test/`](test)).
3. Rode `npm test` — tudo deve passar. Em mudanças de interface, abra o programa e teste no navegador.
4. Abra um Pull Request preenchendo o modelo. Explique **o que** mudou e **por quê**.

PRs pequenos e focados são revisados mais rápido. Se a mudança for grande, converse numa issue antes.

### Convenções

- **Idioma**: o código, os comentários, as mensagens da interface e os erros estão em **português**. Mantenha o padrão
  (nomes como `buscarPagina`, `criarTarefa`). Traduções da interface são bem-vindas, mas combine o formato numa issue antes.
- **Estilo**: JavaScript moderno (ES modules, Node ≥ 20), 2 espaços, aspas simples. Siga o estilo do arquivo que estiver editando
  (veja o [`.editorconfig`](.editorconfig)). Comente o *porquê*, não o *quê*.
- **Dependências**: evite adicionar. Se for realmente necessário, justifique no PR.
- **Erros**: mensagens para o usuário devem dizer o que aconteceu, o que faltou e como resolver.
  Veja [`src/erros.js`](src/erros.js) — para um novo tipo de erro, adicione a explicação lá e um teste em `test/erros.test.js`.
- **Commits**: mensagens curtas no imperativo, de preferência no padrão
  [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

## O Google mudou o formato

O programa lê respostas internas do Google em forma de arrays aninhados; os campos são acessados por **índice**
(`pegar(p, 4, 7)` = nota, por exemplo). Quando o Google reorganiza esses arrays, algum campo passa a vir vazio.

1. Rode `npm run diagnostico` (ou **Avançado → Executar diagnóstico** na interface). Ele diz qual etapa quebrou:
   busca, detalhes, avaliações, fotos ou sugestões.
2. Localize o código da etapa:
   - busca e campos do lugar: [`src/maps/busca.js`](src/maps/busca.js) (`montarUrlBusca`, `analisarLugar`);
   - detalhes: [`src/maps/lugar.js`](src/maps/lugar.js);
   - avaliações: [`src/maps/avaliacoes.js`](src/maps/avaliacoes.js); fotos: [`src/maps/fotos.js`](src/maps/fotos.js).
3. Compare a resposta atual com os índices do código e ajuste. Ferramentas como a aba *Rede* do navegador ajudam a ver a resposta.
4. Rode o diagnóstico de novo e abra o PR dizendo **o que mudou no formato** (campo, índice antigo → novo).

> Ao compartilhar respostas do Google em issues e PRs, **remova dados pessoais e cookies**.

## O que não aceitamos

- Dados reais de empresas ou pessoas, cookies, tokens, chaves de API ou o conteúdo de `dados/cache/` e `saida/` em commits.
- Funcionalidades para burlar CAPTCHA ou mecanismos de verificação do Google, ou para disfarçar o tráfego do programa.
- Mudanças que enviem dados do usuário para servidores de terceiros sem ação explícita dele.

## Segurança

Não abra issue pública para vulnerabilidades. Veja [SECURITY.md](SECURITY.md).

## Licença

Ao enviar uma contribuição, você concorda que ela será licenciada sob a [MIT](LICENSE), como o restante do projeto.
