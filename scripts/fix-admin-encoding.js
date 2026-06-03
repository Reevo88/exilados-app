const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'js', 'admin.js');
let text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');

// First-pass recovery for mojibake produced by UTF-8 read as Latin-1.
text = Buffer.from(text, 'latin1').toString('utf8');

const fixes = [
  [/Nenhuma pelada dispon[^\n']*/g, 'Nenhuma pelada disponível'],
  [/ Â· /g, ' · '],
  [/P[^\n'`]*s-jogo/g, 'Pós-jogo'],
  [/Essa a[^\n']*o apagar[^\n']* a pelada e todas as confirma[^\n']*es\. N[^\n']*o pode ser desfeita\./g, 'Essa ação apagará a pelada e todas as confirmações. Não pode ser desfeita.'],
  [/Pelada exclu[^\n']*da/g, 'Pelada excluída'],
  [/Escalador n[^\n']*o pode encerrar partida\./g, 'Escalador não pode encerrar partida.'],
  [/ser[^\n']* encerrada\. Jogadores n[^\n']*o poder[^\n']*o confirmar presen[^\n']*\./g, 'será encerrada. Jogadores não poderão confirmar presença.'],
  [/Escalador n[^\n']*o pode reabrir partida\./g, 'Escalador não pode reabrir partida.'],
  [/voltar[^\n']* a aceitar confirma[^\n']*es e ajustes de escala[^\n']*\./g, 'voltará a aceitar confirmações e ajustes de escalação.'],
  [/Salvar altera[^\n']*es/g, 'Salvar alterações'],
  [/Criar e abrir confirma[^\n']*es/g, 'Criar e abrir confirmações'],
  [/limite n[^\n']*o pode ficar abaixo do n[^\n']*mero atual de confirmados\./g, 'limite não pode ficar abaixo do número atual de confirmados.'],
  [/dados b[^\n']*sicos\. Quando existir uma pelada anterior, o app reaproveita local, hor[^\n']*rio, valor e limite para agilizar o cadastro\./g, 'dados básicos. Quando existir uma pelada anterior, o app reaproveita local, horário, valor e limite para agilizar o cadastro.'],
  [/Arena Ga[^\n']*cha/g, 'Arena Gaúcha'],
  [/Dados pr[^\n']*-preenchidos com base na [^\n']*ltima pelada\. Revise principalmente a data antes de criar\./g, 'Dados pré-preenchidos com base na última pelada. Revise principalmente a data antes de criar.'],
  [/Ainda n[^\n']*o existe pelada anterior\./g, 'Ainda não existe pelada anterior.'],
  [/Última pelada duplicada\. Revise a data\./g, 'Última pelada duplicada. Revise a data.'],
  [/hor[^\n']*rio/g, 'horário'],
  [/campos obrigat[^\n']*rios corretamente\./g, 'campos obrigatórios corretamente.'],
  [/Pelada n[^\n']*o encontrada\./g, 'Pelada não encontrada.'],
  [/Pelada encerrada n[^\n']*o permite editar dados principais\./g, 'Pelada encerrada não permite editar dados principais.'],
  [/N[^\n']*o [^\n']* poss[^\n']*vel reduzir para /g, 'Não é possível reduzir para '],
  [/J[^\n']* existem /g, 'Já existem '],
  [/Aguardando confirma[^\n']*es/g, 'Aguardando confirmações'],
  [/S[^\n']* CHURRAS/g, 'SÓ CHURRAS'],
  [/Sheet de confirma[^\n']*o de identidade do jogador/g, 'Sheet de confirmação de identidade do jogador'],
  [/🟡 Mensalista|ðŸŸ¡ Mensalista/g, '🟡 Mensalista'],
  [/🔵 Avulso|ðŸ”µ Avulso/g, '🔵 Avulso'],
  [/➕ Adicionar|âž• Adicionar/g, '➕ Adicionar'],
  [/match exato e [^\n]*modalidade do cadastro/g, 'match exato e único -> adiciona direto com modalidade do cadastro'],
  [/S[^\n]*pula a confirma[^\n]*o se o nome bater exatamente/g, 'Só pula a confirmação se o nome bater exatamente'],
  [/match\(es\) encontrado\(s\) mas n[^\n]*o exato [^\n]*/g, 'match(es) encontrado(s) mas não exato -> pede confirmação'],
  [/nenhum match [^\n]* avulso direto/g, 'nenhum match -> avulso direto'],
  [/Mensalista n[^\n']*o entra na cobran[^\n']*a avulsa\./g, 'Mensalista não entra na cobrança avulsa.'],
  [/S[^\n']* avulsos podem ser isentos\./g, 'Só avulsos podem ser isentos.'],
  [/Partida encerrada\. N[^\n']*o [^\n']* poss[^\n']*vel/g, 'Partida encerrada. Não é possível'],
  [/Excluir \$\{j\.nome\} da lista de N[^\n`]*o v[^\n`]*o\?/g, 'Excluir ${j.nome} da lista de Não vão?'],
  [/Movido para N[^\n']*o v[^\n']*o/g, 'Movido para Não vão'],
  [/Esse nome j[^\n']* est[^\n']* confirmado/g, 'Esse nome já está confirmado'],
  [/⚽|âš½/g, '⚽'],
  [/Confirme presen[^\n:]*(?=:)/g, 'Confirme presença aqui'],
  [/est[^\n]* sendo feito pelo app oficial/g, 'está sendo feito pelo app oficial'],
  [/posi[^\n]*o e foto:/g, 'posição e foto:'],
  [/voc[^\n]* j[^\n]* consegue confirmar presen[^\n]* nas pr[^\n]*ximas peladas com seu usu[^\n]*rio identificado\./g, 'você já consegue confirmar presença nas próximas peladas com seu usuário identificado.'],
  [/â€”/g, '—'],
  [/â†‘/g, '↑'],
  [/â†“/g, '↓'],
  [/🔵 Time Azul|ðŸ”µ Time Azul/g, '🔵 Time Azul'],
  [/🔴 Time Vermelho|ðŸ”´ Time Vermelho/g, '🔴 Time Vermelho'],
  [/descri[cç][aã]o:`\$\{j\.nome\} [^\n`]* \$\{p\.nome\}`/g, 'descricao:`${j.nome} — ${p.nome}`'],
  [/Sem pend[^\n']*ncias para cobrar\./g, 'Sem pendências para cobrar.'],
  [/Pend[^\n:]*ncias de pagamento:/g, 'Pendências de pagamento:'],
  [/Aniversariante do m[^\n']*s/g, 'Aniversariante do mês'],
  [/Posi[^\n']*o/g, 'Posição'],
  [/Aten[^\n']*o:/g, 'Atenção:'],
  [/S[^\n']* Churras/g, 'Só Churras'],
  [/n[^\n']*o entra no rateio avulso/g, 'não entra no rateio avulso'],
];

for (const [pattern, replacement] of fixes) {
  text = text.replace(pattern, replacement);
}

fs.writeFileSync(file, text, 'utf8');
console.log('admin.js encoding fixed');
