// Gravação atômica: escreve num arquivo temporário e renomeia, para uma queda no meio da
// gravação nunca deixar o arquivo de destino pela metade.

import fs from 'node:fs';

export function escreverAtomico(destino, conteudo, { modo } = {}) {
  const temporario = `${destino}.${process.pid}.tmp`;
  fs.writeFileSync(temporario, conteudo, modo ? { mode: modo } : undefined);
  fs.renameSync(temporario, destino);
}
