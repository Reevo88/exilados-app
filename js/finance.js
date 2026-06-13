// Exilados da Bola
// Caixa geral, movimentos, modais financeiros e integracao de pagamentos
// Extraido de app.js para reduzir o monolito mantendo o comportamento global atual.

// ==========================================
// MÓDULO FINANCEIRO - CAIXA GERAL
// ==========================================

// -- DB: Configurações Financeiras --------
async function dbGetConfig() {
  try {
    const rows = await sbFetch('/configuracoes_financeiras?order=id.desc&limit=1');
    return rows && rows.length ? rows[0] : null;
  } catch(e) { return null; }
}
async function dbSalvarConfig(cfg) {
  const exist = await dbGetConfig();
  if (exist) {
    await sbFetch('/configuracoes_financeiras?id=eq.' + exist.id, {
      method: 'PATCH', prefer: 'return=minimal',
      body: JSON.stringify(cfg)
    });
    return { ...exist, ...cfg };
  } else {
    const rows = await sbFetch('/configuracoes_financeiras', {
      method: 'POST',
      body: JSON.stringify(cfg)
    });
    return rows[0];
  }
}

// -- DB: Movimentos do Caixa ---------------
async function dbGetMovimentos() {
  try {
    const rows = await sbFetch('/caixa_movimentos?order=data.asc,id.asc');
    return rows || [];
  } catch(e) { return []; }
}
async function dbInserirMovimento(mov) {
  const rows = await sbFetch('/caixa_movimentos', {
    method: 'POST',
    body: JSON.stringify(mov)
  });
  return rows[0];
}
async function dbExcluirMovimento(id) {
  await sbFetch('/caixa_movimentos?id=eq.' + id, {
    method: 'DELETE', prefer: 'return=minimal'
  });
}
async function dbGetMovimentoPorRef(origem, refId) {
  try {
    const rows = await sbFetch('/caixa_movimentos?origem=eq.' + origem + '&referencia_id=eq.' + refId + '&limit=1');
    return rows && rows.length ? rows[0] : null;
  } catch(e) { return null; }
}

// -- Cálculo de saldo ---------------------
function calcularResumo(movimentos) {
  let totalEntradas = 0, totalSaidas = 0;
  let mensalidades = 0, avulsos = 0, despesas = 0, saldoInicial = 0;
  movimentos.forEach(m => {
    const v = Number(m.valor) || 0;
    if (m.tipo === 'entrada') {
      totalEntradas += v;
      if (m.origem === 'mensalidade') mensalidades += v;
      else if (m.origem === 'avulso') avulsos += v;
      else if (m.origem === 'saldo_inicial') saldoInicial += v;
    } else if (m.tipo === 'saida') {
      totalSaidas += v;
      if (m.origem === 'despesa_manual') despesas += v;
    } else if (m.tipo === 'estorno') {
      // estornos reduzem entradas
      totalSaidas += v;
    }
  });
  return {
    saldo: totalEntradas - totalSaidas,
    entradas: totalEntradas,
    saidas: totalSaidas,
    mensalidades, avulsos, despesas, saldoInicial
  };
}

// -- Formatar moeda ------------------------
function fmtMoney(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtMoneyShort(v) {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1000) return 'R$' + (n/1000).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}) + 'k';
  return 'R$' + n.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0});
}

// -- Ícone por origem ----------------------
function origemIcon(origem, tipo) {
  if (origem === 'saldo_inicial') return 'ti-wallet';
  if (origem === 'mensalidade')   return 'ti-user-check';
  if (origem === 'avulso')        return 'ti-ball-football';
  if (origem === 'despesa_manual')return 'ti-receipt';
  if (origem === 'estorno')       return 'ti-arrow-back-up';
  return tipo === 'entrada' ? 'ti-arrow-up' : 'ti-arrow-down';
}
function origemLabel(m) {
  if (m.origem === 'saldo_inicial')  return 'Saldo Inicial';
  if (m.origem === 'mensalidade')    return 'Mensalidade';
  if (m.origem === 'avulso') {
    if (m.categoria === 'outros') return 'Outros';
    if (m.categoria === 'avulso') return 'Avulso (manual)';
    return 'Avulso (pelada)';
  }
  if (m.origem === 'despesa_manual') return m.categoria === 'goleiro_app' ? 'Goleiro App' : m.categoria ? m.categoria.charAt(0).toUpperCase() + m.categoria.slice(1) : 'Despesa';
  if (m.origem === 'estorno')        return 'Estorno';
  return m.origem;
}

// -- Variável de filtro do extrato ---------
let _extratoFiltro = 'todos';

const LS_CAIXA_CACHE_KEY = 'exilados_caixa_cache';

function lerCacheCaixa() {
  try {
    const raw = localStorage.getItem(LS_CAIXA_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (!cache || !Array.isArray(cache.movimentos) || !cache.resumo) return null;
    return cache;
  } catch(e) {
    return null;
  }
}

function salvarCacheCaixa(movimentos) {
  window._caixaCache = { movimentos };
  try {
    localStorage.setItem(LS_CAIXA_CACHE_KEY, JSON.stringify({
      movimentos,
      resumo: calcularResumo(movimentos),
      updatedAt: Date.now()
    }));
  } catch(e) {}
}

function atualizarCardSaldoCaixa(prefixo, resumo) {
  const saldoEl = document.getElementById(prefixo + '-saldo-val');
  const entradasEl = document.getElementById(prefixo + '-entradas-val');
  const saidasEl = document.getElementById(prefixo + '-saidas-val');
  const miniSaldoEl = document.getElementById(prefixo + '-mini-saldo-val');
  if (saldoEl) saldoEl.textContent = fmtMoney(resumo?.saldo || 0);
  if (entradasEl) entradasEl.textContent = fmtMoney(resumo?.entradas || 0);
  if (saidasEl) saidasEl.textContent = fmtMoney(resumo?.saidas || 0);
  if (miniSaldoEl) miniSaldoEl.textContent = fmtMoney(resumo?.saldo || 0);
}

function aplicarResumoCaixaNaTela(saldoId, extratoId, isAdm) {
  const cache = lerCacheCaixa();
  if (!cache) return false;
  const prefixo = saldoId.replace('-saldo-val', '');
  atualizarCardSaldoCaixa(prefixo, cache.resumo || calcularResumo(cache.movimentos || []));
  _renderExtratoFiltrado(cache.movimentos || [], extratoId, isAdm);
  return true;
}

function hidratarCaixaCache() {
  aplicarResumoCaixaNaTela('caixa-saldo-val', 'caixa-extrato', true);
  aplicarResumoCaixaNaTela('jcaixa-saldo-val', 'jcaixa-extrato', false);
}

function abrirCaixaGeral() {
  hidratarCaixaCache();
  goTo('s-adm-fin');
  renderCaixaGeral();
}

function abrirJCaixa() {
  hidratarCaixaCache();
  goTo('s-j-caixa');
  renderJCaixa();
}

// -- RENDER: Caixa Geral (ADM) -------------
async function limparEstornos() {
  try {
    const rows = await sbFetch('/caixa_movimentos?tipo=eq.estorno');
    if (rows && rows.length) {
      await Promise.all(rows.map(r => dbExcluirMovimento(r.id)));
    }
  } catch(e) {}
}

async function renderCaixaGeral() {
  await limparEstornos();
  _extratoFiltro = 'todos';
  redefinirFiltroExtratoInterno();
  document.querySelectorAll('.cfiltro').forEach(b => b.classList.remove('active'));
  const btnTodos = document.querySelector('.cfiltro');
  if(btnTodos) btnTodos.classList.add('active');
  aplicarResumoCaixaNaTela('caixa-saldo-val', 'caixa-extrato', true);

  const movimentos = await dbGetMovimentos();
  const res = calcularResumo(movimentos);
  salvarCacheCaixa(movimentos);

  atualizarCardSaldoCaixa('caixa', res);
  _renderExtratoFiltrado(movimentos, 'caixa-extrato', true);
}

// -- RENDER: Caixa Jogador (leitura) ------
async function renderJCaixa() {
  redefinirFiltroExtratoInterno();
  aplicarResumoCaixaNaTela('jcaixa-saldo-val', 'jcaixa-extrato', false);

  const movimentos = await dbGetMovimentos();
  const res = calcularResumo(movimentos);
  salvarCacheCaixa(movimentos);

  atualizarCardSaldoCaixa('jcaixa', res);
  _renderExtratoFiltrado(movimentos, 'jcaixa-extrato', false);

  const aberta = G.pelada && pelAdaberta(G.pelada);
  ['jcaixa-nav-conf','jcaixa-nav-times'].forEach(id => {
    const btn = document.getElementById(id);
    if(btn) btn.classList.toggle('nav-disabled', !aberta);
  });
}

function redefinirFiltroExtratoInterno() {
  const now = new Date();
  _filtroState.mes = { ano: now.getFullYear(), mes: now.getMonth() };
  _filtroState.entradas = true;
  _filtroState.saidas = true;
  _filtroState.ordem = 'asc';
  atualizarResumoFiltroExtrato();
}

function resumoFiltroExtratoTexto() {
  const partes = [];
  const now = new Date();
  const filtroPadraoMesAtual = !!_filtroState.mes
    && _filtroState.mes.ano === now.getFullYear()
    && _filtroState.mes.mes === now.getMonth();
  const semFiltroPadrao = filtroPadraoMesAtual && _filtroState.entradas && _filtroState.saidas && _filtroState.ordem === 'asc';
  if(semFiltroPadrao) return 'Sem filtros';

  if(_filtroState.mes) partes.push(`${_MESES_PT[_filtroState.mes.mes]} ${_filtroState.mes.ano}`);
  else partes.push('Todos os periodos');

  if(!(_filtroState.entradas && _filtroState.saidas)) {
    if(_filtroState.entradas && !_filtroState.saidas) partes.push('Entradas');
    else if(!_filtroState.entradas && _filtroState.saidas) partes.push('Saídas');
    else partes.push('Sem lançamentos');
  }

  if(_filtroState.ordem === 'asc') partes.push('Mais antigos');

  return partes.join(' • ');
}

function atualizarResumoFiltroExtrato() {
  const texto = resumoFiltroExtratoTexto();
  ['caixa-filtro-resumo','jcaixa-filtro-resumo'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      el.textContent = texto;
      el.title = texto;
    }
  });
}

function resumoFiltroExtratoTexto() {
  const partes = [];
  if(_filtroState.mes) partes.push(`${_MESES_PT[_filtroState.mes.mes]} ${_filtroState.mes.ano}`);
  else partes.push('Todos os periodos');

  if(!(_filtroState.entradas && _filtroState.saidas)) {
    if(_filtroState.entradas && !_filtroState.saidas) partes.push('Entradas');
    else if(!_filtroState.entradas && _filtroState.saidas) partes.push('Saidas');
    else partes.push('Sem lancamentos');
  }

  partes.push(_filtroState.ordem === 'asc' ? 'Mais antigos' : 'Mais recentes');
  return partes.join(' • ');
}

// -- RENDER: Extrato -----------------------
function renderExtrato(movimentos, containerId, filtro, isAdm, movimentosBase=null) {
  const el = document.getElementById(containerId);
  if (!el) return;

  let lista = movimentos;
  if (filtro === 'entrada') lista = movimentos.filter(m => m.tipo === 'entrada');
  else if (filtro === 'saida') lista = movimentos.filter(m => m.tipo === 'saida' || m.tipo === 'estorno');

  if (!lista.length) {
    el.innerHTML = '<div class="empty"><i class="ti ti-receipt-off"></i>Nenhuma movimentação</div>';
    return;
  }

  // Calcular saldo acumulado (já vem ordenado do mais antigo ao mais novo)
  let saldoAcum = 0;
  const saldoMap = {};
  const baseSaldo = Array.isArray(movimentosBase) ? movimentosBase : movimentos;
  baseSaldo.forEach(m => {
    const v = Number(m.valor) || 0;
    if (m.tipo === 'entrada') saldoAcum += v;
    else saldoAcum -= v;
    saldoMap[m.id] = saldoAcum;
  });

  el.innerHTML = lista.map(m => {
    const isEntrada = m.tipo === 'entrada';
    const v = Number(m.valor) || 0;
    const saldo = saldoMap[m.id];
    const icone = origemIcon(m.origem, m.tipo);
    const label = origemLabel(m);
    const dtFmt = m.data ? new Date(m.data + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short' }) : '—';
    const catBadge = m.categoria && m.origem === 'despesa_manual'
      ? `<span class="ext-cat">${m.categoria}</span>` : '';
    const estornoClass = m.tipo === 'estorno' ? ' estorno' : '';
    const deleteBtn = isAdm && (m.origem === 'avulso' || m.origem === 'despesa_manual' || m.origem === 'mensalidade' || m.origem === 'entrada')
      ? `<button onclick="excluirMovimentoAdm(${m.id},'${m.origem}','${m.referencia_id||''}')" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:16px;padding:2px 4px;" title="Excluir"><i class="ti ti-trash"></i></button>` : '';
    return `<div class="extrato-row${estornoClass}">
      <div class="extrato-icon ${isEntrada ? 'entrada' : 'saida'}"><i class="ti ${icone}"></i></div>
      <div class="extrato-info">
        <div class="extrato-desc">${escHtml(m.descricao || label)}${catBadge}</div>
        <div class="extrato-meta">${dtFmt} · ${label}</div>
      </div>
      <div class="extrato-vals">
        <div class="extrato-valor ${isEntrada ? 'positivo' : 'negativo'}">${isEntrada ? '+' : '-'}${fmtMoney(v)}</div>
        <div class="extrato-saldo">${fmtMoney(saldo)}</div>
      </div>
      ${deleteBtn}
    </div>`;
  }).join('');
}

// -- Filtrar extrato -----------------------
async function filtrarExtrato(tipo, btn) {
  _extratoFiltro = tipo;
  document.querySelectorAll('.cfiltro').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const movimentos = await dbGetMovimentos();
  renderExtrato(movimentos, 'caixa-extrato', tipo, true);
}

// -- Sheet de confirmação genérico ---------
let _confirmCallback = null;
function abrirConfirmSheet(titulo, desc, labelOk, callback) {
  document.getElementById('confirm-sheet-title').textContent = titulo;
  document.getElementById('confirm-sheet-desc').textContent = desc;
  document.getElementById('confirm-sheet-ok-label').textContent = labelOk;
  _confirmCallback = callback;
  document.getElementById('confirm-sheet-ok').onclick = () => { fecharConfirmSheet(); callback(); };
  document.getElementById('confirm-sheet').classList.add('open');
}
function fecharConfirmSheet(e) {
  if (e && e.target.id !== 'confirm-sheet') return;
  document.getElementById('confirm-sheet').classList.remove('open');
  _confirmCallback = null;
}

// Sobrescreve excluirMovimentoAdm para usar sheet e desmarcar pago na pelada
async function excluirMovimentoAdm(id, origem, refId) {
  const isAvulso = origem === 'avulso' && refId;
  abrirConfirmSheet(
    'Excluir lançamento',
    isAvulso
      ? 'O lançamento será removido do caixa e o jogador voltará como pendente na pelada.'
      : 'Essa movimentação será removida do extrato do caixa. Essa ação não pode ser desfeita.',
    'Excluir lançamento',
    async () => {
      try {
        await dbExcluirMovimento(id);
        // Se for avulso, desmarca pago na pelada
        if (isAvulso) {
          const confId = refId.replace('avulso_', '');
          await dbAtualizar(confId, { pago: false });
          // Atualiza estado local em todas as peladas
          G.peladas.forEach(p => {
            const j = p.confirmados.find(x => String(x.id) === String(confId));
            if (j) j.pago = false;
          });
          if (G.pelada) { renderAdmConf(); renderAdmFin(); }
          renderAdmHome();
        }
        showToast('Lançamento excluído');
        await renderCaixaGeral();
      } catch(e) { showToast('Erro ao excluir'); }
    }
  );
}

// ==========================================
// MODAIS
// ==========================================

function abrirModal(id) { document.getElementById(id).classList.add('open'); }
function fecharModal(id) { document.getElementById(id).classList.remove('open'); }
function fecharModalSe(e, id) { if (e.target.id === id) fecharModal(id); }

// -- Modal: Despesa ------------------------
function abrirModalDespesa() {
  const hoje = new Date().toISOString().slice(0,10);
  document.getElementById('desp-data').value    = hoje;
  document.getElementById('desp-cat').value     = 'quadra';
  document.getElementById('desp-desc').value    = '';
  document.getElementById('desp-valor').value   = '';
  abrirModal('modal-despesa');
  setTimeout(() => document.getElementById('desp-valor').focus(), 100);
}
async function salvarDespesa() {
  const data   = document.getElementById('desp-data').value;
  const cat = document.getElementById('desp-cat').value;
  const desc   = document.getElementById('desp-desc').value.trim();
  const valor  = parseFloat(document.getElementById('desp-valor').value);
  if (!data || !valor || valor <= 0) { showToast('Preencha data e valor'); return; }
  try {
    await dbInserirMovimento({
      data, tipo: 'saida', origem: 'despesa_manual',
      categoria: cat,
      descricao: desc || ('Despesa — ' + cat),
      valor
    });
    fecharModal('modal-despesa');
    showToast('Despesa lançada!');
    await renderCaixaGeral();
  } catch(e) { showToast('Erro ao lançar despesa'); }
}

// -- Modal: Nova Entrada -------------------
function abrirModalEntrada() {
  const hoje = new Date().toISOString().slice(0,10);
  document.getElementById('ent-data').value    = hoje;
  document.getElementById('ent-origem').value  = 'mensalidade';
  document.getElementById('ent-desc').value    = '';
  document.getElementById('ent-valor').value   = '';
  abrirModal('modal-entrada');
  setTimeout(() => document.getElementById('ent-desc').focus(), 100);
}
async function salvarEntrada() {
  const data      = document.getElementById('ent-data').value;
  const origemSel = document.getElementById('ent-origem').value;
  const desc      = document.getElementById('ent-desc').value.trim();
  const valor     = parseFloat(document.getElementById('ent-valor').value);
  if (!data)               { showToast('Informe a data'); return; }
  if (!desc)               { showToast('Informe a descrição'); return; }
  if (!valor || valor <= 0){ showToast('Informe o valor'); return; }
  // Banco aceita só: saldo_inicial, mensalidade, avulso, despesa_manual, estorno
  const origem    = origemSel === 'mensalidade' ? 'mensalidade' : 'avulso';
  const categoria = origemSel;
  try {
    await dbInserirMovimento({
      data, tipo: 'entrada', origem,
      categoria,
      descricao: desc,
      valor
    });
    fecharModal('modal-entrada');
    showToast('Entrada registrada!');
    await renderCaixaGeral();
  } catch(e) { showToast('Erro ao registrar entrada'); }
}

// -- Modal: Configurações ------------------
async function abrirModalSaldoInicial() {
  const cfg = await dbGetConfig();
  document.getElementById('cfg-saldo-inicial').value    = cfg ? (cfg.saldo_inicial || 0) : 0;
  document.getElementById('cfg-valor-mensalidade').value = cfg ? (cfg.valor_mensalidade || '') : '';
  document.getElementById('cfg-valor-avulso').value     = cfg ? (cfg.valor_avulso || '') : '';
  document.getElementById('cfg-valor-churras').value    = cfg ? (cfg.valor_churras || '') : '';
  abrirModal('modal-config');
}
async function salvarConfig() {
  const saldoInicial     = parseFloat(document.getElementById('cfg-saldo-inicial').value) || 0;
  const valorMensalidade = parseFloat(document.getElementById('cfg-valor-mensalidade').value) || 0;
  const valorAvulso      = parseFloat(document.getElementById('cfg-valor-avulso').value) || 0;
  const valorChurras     = parseFloat(document.getElementById('cfg-valor-churras').value) || 0;
  try {
    const cfg = await dbGetConfig();
    const saldoAnterior = cfg ? (Number(cfg.saldo_inicial) || 0) : 0;
    await dbSalvarConfig({ saldo_inicial: saldoInicial, valor_mensalidade: valorMensalidade, valor_avulso: valorAvulso, valor_churras: valorChurras });
    G.valorChurras = valorChurras;

    // Atualizar lançamento de saldo inicial se o valor mudou
    if (saldoInicial !== saldoAnterior) {
      // Remove movimento anterior de saldo_inicial se existir
      try {
        const rows = await sbFetch('/caixa_movimentos?origem=eq.saldo_inicial&limit=10');
        if (rows && rows.length) {
          for (const r of rows) await dbExcluirMovimento(r.id);
        }
      } catch(e) {}
      // Cria novo se > 0
      if (saldoInicial > 0) {
        await dbInserirMovimento({
          data: new Date().toISOString().slice(0,10),
          tipo: 'entrada', origem: 'saldo_inicial',
          categoria: 'saldo_inicial',
          descricao: 'Saldo Inicial',
          valor: saldoInicial
        });
      }
    }
    fecharModal('modal-config');
    showToast('Configurações salvas!');
    await renderCaixaGeral();
  } catch(e) { showToast('Erro ao salvar configurações'); }
}

// ==========================================
// INTEGRAÇÃO: toggle pago -> caixa geral
// ==========================================
// Sobrescreve togglePago para também registrar/estornar no caixa
async function togglePago(i) {
  const j = G.pelada.confirmados[i];
  if (j.modalidade === 'mensalista' || j.isento) { showToast('Jogador não entra na cobrança avulsa.'); return; }
  const pagandoAgora = !j.pago;
  j.pago = pagandoAgora;
  renderAdmConf(); renderAdmFin(); renderAdmHome();

  // Calcula valor real (jogo + churras se aplicável)
  const p = G.pelada;
  const valorChurras = Number(G.valorChurras||0);
  let valorFinal = p.valor;
  if(p.temChurras && j.churras==='jogo_churras') valorFinal += valorChurras;
  if(p.temChurras && j.churras==='churras')      valorFinal  = valorChurras;

  try {
    await dbAtualizar(j.id, { pago: j.pago });
    const refId = 'avulso_' + j.id;
    if (pagandoAgora) {
      const exist = await dbGetMovimentoPorRef('avulso', refId);
      if (!exist) {
        await dbInserirMovimento({
          data: new Date().toISOString().slice(0,10),
          tipo: 'entrada', origem: 'avulso',
          categoria: 'avulso',
          descricao: `${j.nome} — ${p.nome}`,
          valor: valorFinal,
          referencia_id: refId
        });
      }
    } else {
      const exist = await dbGetMovimentoPorRef('avulso', refId);
      if (exist) await dbExcluirMovimento(exist.id);
    }
  } catch(e) {
    j.pago = !j.pago; renderAdmConf(); renderAdmFin(); renderAdmHome(); showToast('Erro ao salvar.');
  }
}

// -- Botão caixa na tela de pelada (home adm) --
// Adiciona opção de ver financeiro da pelada
function verFinanceiroPelada(id) {
  G.pelada = G.peladas.find(x => String(x.id) === String(id));
  if (!G.pelada) return;
  renderAdmFin(); goTo('s-adm-fin-pelada');
}

hidratarCaixaCache();



// ==========================================
// FILTRO DO EXTRATO
// ==========================================
const _filtroState = {
  contexto: 'adm', // 'adm' | 'jog'
  mes: null,        // null = todos | { ano, mes } 0-based
  entradas: true,
  saidas: true,
  ordem: 'asc',
};

const _MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function abrirFiltroExtrato(contexto) {
  _filtroState.contexto = contexto;
  _atualizarLabelMes();
  atualizarResumoFiltroExtrato();
  document.getElementById('filtro-entradas').checked = _filtroState.entradas;
  document.getElementById('filtro-saidas').checked   = _filtroState.saidas;
  document.getElementById(_filtroState.ordem === 'asc' ? 'filtro-ordem-ant' : 'filtro-ordem-rec').checked = true;
  const modal = document.getElementById('modal-filtro-extrato');
  modal.style.display = 'flex';
}

function fecharFiltroExtrato(e) {
  if(e && e.target !== document.getElementById('modal-filtro-extrato')) return;
  document.getElementById('modal-filtro-extrato').style.display = 'none';
}

function _atualizarLabelMes() {
  const el = document.getElementById('filtro-mes-label');
  if(!el) return;
  if(!_filtroState.mes) { el.textContent = 'Todos os períodos'; return; }
  el.textContent = `${_MESES_PT[_filtroState.mes.mes]} ${_filtroState.mes.ano}`;
}

function filtroMesNavegar(delta) {
  if(!_filtroState.mes) {
    const now = new Date();
    _filtroState.mes = { ano: now.getFullYear(), mes: now.getMonth() };
  }
  let { ano, mes } = _filtroState.mes;
  mes += delta;
  if(mes < 0)  { mes = 11; ano--; }
  if(mes > 11) { mes = 0;  ano++; }
  _filtroState.mes = { ano, mes };
  _atualizarLabelMes();
}

function redefinirFiltroExtrato() {
  const now = new Date();
  _filtroState.mes = { ano: now.getFullYear(), mes: now.getMonth() };
  _filtroState.entradas = true;
  _filtroState.saidas   = true;
  _filtroState.ordem    = 'asc';
  _atualizarLabelMes();
  atualizarResumoFiltroExtrato();
  document.getElementById('filtro-entradas').checked = true;
  document.getElementById('filtro-saidas').checked   = true;
  document.getElementById('filtro-ordem-ant').checked = true;
}

function aplicarFiltroExtrato() {
  _filtroState.entradas = document.getElementById('filtro-entradas').checked;
  _filtroState.saidas   = document.getElementById('filtro-saidas').checked;
  _filtroState.ordem    = document.querySelector('input[name="filtro-ordem"]:checked')?.value || 'asc';
  document.getElementById('modal-filtro-extrato').style.display = 'none';
  atualizarResumoFiltroExtrato();

  const cache = window._caixaCache || {};
  const movimentos = cache.movimentos || [];

  if(_filtroState.contexto === 'adm') {
    _renderExtratoFiltrado(movimentos, 'caixa-extrato', true);
  } else {
    _renderExtratoFiltrado(movimentos, 'jcaixa-extrato', false);
  }
}

function _renderExtratoFiltrado(movimentos, containerId, isAdm) {
  let lista = [...movimentos];

  // Filtro de mês
  if(_filtroState.mes) {
    const { ano, mes } = _filtroState.mes;
    lista = lista.filter(m => {
      const d = new Date(m.data + 'T12:00:00');
      return d.getFullYear() === ano && d.getMonth() === mes;
    });
  }

  // Filtro de tipo
  lista = lista.filter(m => {
    const entrada = m.tipo === 'entrada';
    const saida   = m.tipo === 'saida' || m.tipo === 'estorno';
    if(entrada && !_filtroState.entradas) return false;
    if(saida   && !_filtroState.saidas)   return false;
    return true;
  });

  // Ordem
  if(_filtroState.ordem === 'desc') {
    lista = lista.reverse();
  }

  renderExtrato(lista, containerId, 'todos', isAdm, movimentos);
}
