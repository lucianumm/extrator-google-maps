// Traduz erros técnicos em mensagens que dizem o que aconteceu, o que provavelmente faltou
// e o que fazer. Usado pela API (respostas de erro), pelas tarefas (status "erro") e pela CLI.
//
// Formato devolvido: { titulo, causa, solucao, tecnico, faltou? }

// Erro de entrada do usuário (algo que faltou ou está inválido). `faltou` lista cada item.
export class ErroValidacao extends Error {
  constructor(mensagem, { faltou = [], solucao } = {}) {
    super(mensagem);
    this.name = 'ErroValidacao';
    this.faltou = faltou;
    this.solucao = solucao;
  }
}

const CODIGOS_DNS = new Set(['ENOTFOUND', 'EAI_AGAIN']);
const CODIGOS_CONEXAO = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET']);
const CODIGOS_ARQUIVO = new Set(['EACCES', 'EPERM', 'ENOSPC', 'EBUSY', 'EROFS', 'EMFILE']);

const ISSUE = 'Se repetir, copie os detalhes técnicos e relate em uma issue no GitHub do projeto.';

function tecnico(e) {
  const partes = [e?.name, e?.message].filter(Boolean).join(': ');
  const causa = e?.cause ? ` (causa: ${[e.cause.code, e.cause.message].filter(Boolean).join(' ')})` : '';
  return (partes || String(e)) + causa;
}

export function explicarErro(e) {
  const msg = String(e?.message ?? e ?? 'erro desconhecido');
  const codigo = e?.cause?.code || e?.code || '';
  const base = { tecnico: tecnico(e) };

  if (e?.name === 'ErroValidacao') {
    return { ...base, titulo: 'Faltam informações', causa: msg, solucao: e.solucao || 'Corrija os itens indicados e inicie de novo.', faltou: e.faltou || [] };
  }
  if (e?.name === 'ErroBloqueio') {
    return {
      ...base,
      titulo: 'O Google pediu verificação',
      causa: 'O Google desconfiou do volume de acessos e mostrou uma página de verificação ("sorry") ou de consentimento.',
      solucao: 'Vá em Avançado → "Renovar sessão do Google", conclua a verificação na janela que abrir e inicie a extração de novo. Diminua "Buscas em paralelo" ou aumente INTERVALO_MS para evitar que volte.',
    };
  }
  if (/playwright-core/i.test(msg)) {
    return { ...base, titulo: 'Navegador automatizado indisponível', causa: 'O pacote playwright-core não está instalado, e ele é necessário para entrar na conta Google ou renovar a sessão.', solucao: 'Abra um terminal na pasta do programa e rode: npm install. Depois reinicie o programa.' };
  }
  if (/Não encontrei Edge nem Chrome/i.test(msg)) {
    return { ...base, titulo: 'Edge ou Chrome não encontrado', causa: 'Para entrar na conta Google ou renovar a sessão o programa abre o Microsoft Edge ou o Google Chrome, e nenhum dos dois foi encontrado neste computador.', solucao: 'Instale o Edge ou o Chrome e tente de novo. As buscas comuns (sem login) continuam funcionando sem navegador.' };
  }
  if (/verificação do Google não foi concluída/i.test(msg)) {
    return { ...base, titulo: 'A verificação do Google não foi concluída', causa: 'A janela do navegador ficou aberta por 3 minutos sem a verificação terminar.', solucao: 'Tente de novo e conclua a verificação (captcha/consentimento) na janela assim que ela abrir.' };
  }
  const http = msg.match(/^HTTP (\d{3})/);
  if (http) {
    const s = Number(http[1]);
    if (s === 429) return { ...base, titulo: 'O Google limitou as requisições (429)', causa: 'Foram feitas requisições demais em pouco tempo.', solucao: 'Aguarde alguns minutos, diminua "Buscas em paralelo" (em Avançado) ou aumente INTERVALO_MS. Se persistir, use "Renovar sessão do Google".' };
    if (s === 403) return { ...base, titulo: 'Acesso negado pelo Google (403)', causa: 'O Google bloqueou este acesso, geralmente por tráfego incomum vindo do seu IP.', solucao: 'Use "Renovar sessão do Google" em Avançado, espere um pouco e tente de novo. Trocar de rede também ajuda.' };
    if (s >= 500) return { ...base, titulo: `O Google está com problema (${s})`, causa: 'O servidor do Google respondeu com erro interno.', solucao: 'Tente de novo em alguns minutos.' };
    return { ...base, titulo: `Resposta inesperada (HTTP ${s})`, causa: 'O servidor devolveu um código que o programa não esperava.', solucao: `Tente de novo. ${ISSUE}` };
  }
  if (/Apollo (\d{3})/.test(msg)) {
    const s = Number(msg.match(/Apollo (\d{3})/)[1]);
    if (s === 401 || s === 403) return { ...base, titulo: 'Chave do Apollo recusada', causa: 'O Apollo.io não aceitou a chave de API informada (ou ela não tem permissão para essa consulta).', solucao: 'Confira a chave em apollo.io → Settings → API, verifique se o plano libera a busca de pessoas e informe de novo.' };
    if (s === 422 || s === 429) return { ...base, titulo: 'Limite ou créditos do Apollo esgotados', causa: 'O Apollo.io recusou a consulta por limite de requisições ou falta de créditos.', solucao: 'Aguarde o limite renovar ou confira os créditos do seu plano no Apollo.' };
  }
  if (CODIGOS_DNS.has(codigo)) {
    return { ...base, titulo: 'Sem acesso à internet (DNS)', causa: 'Não consegui descobrir o endereço do servidor — o computador está sem internet ou o DNS falhou.', solucao: 'Confira a conexão com a internet (e VPN/proxy) e tente de novo.' };
  }
  if (e?.name === 'TimeoutError' || CODIGOS_CONEXAO.has(codigo) || /fetch failed|Tempo esgotado/i.test(msg)) {
    return { ...base, titulo: 'Falha de conexão', causa: 'A conexão com o servidor falhou ou demorou demais para responder.', solucao: 'Confira a internet, firewall, antivírus ou proxy que possam estar bloqueando o programa e tente de novo.' };
  }
  if (/CERT|SSL|TLS|self.signed/i.test(codigo + msg)) {
    return { ...base, titulo: 'Problema de certificado HTTPS', causa: 'O certificado do servidor não pôde ser validado. Antivírus ou proxy que inspecionam HTTPS costumam causar isso.', solucao: 'Desative a inspeção de HTTPS do antivírus/proxy para este programa ou tente em outra rede.' };
  }
  if (/IBGE|malha/i.test(msg)) {
    return { ...base, titulo: 'Não consegui consultar o IBGE', causa: 'A fronteira do município (usada no modo Grade) não pôde ser baixada.', solucao: 'Tente de novo mais tarde ou use a busca "Rápida", que não precisa da fronteira.' };
  }
  if (e?.name === 'SyntaxError' || /JSON/i.test(msg)) {
    return { ...base, titulo: 'Resposta do Google em formato inesperado', causa: 'O Google devolveu algo que o programa não soube interpretar — o formato interno pode ter mudado.', solucao: `Rode "Executar diagnóstico" em Avançado para ver qual etapa quebrou. ${ISSUE}` };
  }
  if (CODIGOS_ARQUIVO.has(codigo)) {
    return { ...base, titulo: 'Não consegui gravar arquivos', causa: `O sistema negou ou não conseguiu a gravação (${codigo}). Pode ser falta de espaço, falta de permissão ou arquivo aberto em outro programa.`, solucao: 'Libere espaço, confira a permissão da pasta "saida" e feche planilhas abertas do mesmo arquivo.' };
  }
  return { ...base, titulo: 'Erro inesperado', causa: msg, solucao: `Veja o log da tarefa. ${ISSUE}` };
}
