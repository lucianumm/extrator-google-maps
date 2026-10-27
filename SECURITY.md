# Política de segurança

## Versões com suporte

Somente a versão mais recente (branch `main` e a última *release*) recebe correções de segurança.

## Como relatar uma vulnerabilidade

**Não abra uma issue pública.** Use o relato privado do GitHub:

1. Acesse a aba [**Security**](https://github.com/lucianumm/extrator-google-maps/security) do repositório.
2. Clique em **Report a vulnerability** e descreva o problema, como reproduzir e o impacto.

Respondemos assim que possível e, confirmada a falha, publicamos a correção e damos o crédito a quem relatou (se desejar).

## O que está no escopo

Este programa roda **localmente** e escuta apenas em `127.0.0.1`. Exemplos de falhas relevantes:

- um site aberto no navegador conseguir ler dados ou controlar o servidor local (CSRF, DNS rebinding, XSS);
- o programa ser induzido a acessar a rede interna (SSRF) por dados vindos do Google ou de sites de terceiros;
- vazamento de cookies da sessão do Google ou de chaves de API informadas pelo usuário;
- execução de código ou acesso a arquivos fora das pastas do programa.

Mudanças no formato interno do Google, bloqueios do Google e o uso do programa em desacordo com os termos de terceiros **não** são
vulnerabilidades — veja o [aviso legal](README.md).

## Boas práticas para quem usa

- Não exponha a porta do programa na rede nem a encaminhe para a internet.
- Nunca compartilhe `dados/cache/` (cookies e perfil do navegador) nem `saida/` (resultados com dados pessoais).
- Use chaves de API com o menor privilégio possível e revogue-as se suspeitar de vazamento.
