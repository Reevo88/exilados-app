// Exilados da Bola
// Fluxo do jogador: lista, confirmacao, times e identidade local
// Extraido de app.js para reduzir o monolito mantendo o comportamento global atual.

let _openPeladaSheetRows = [];
let _openPeladaSheetDestino = 'conf';

// ==========================================
// JOGADOR - LISTA
// ==========================================
function renderJLista(){
  initPlayerHomeBottomNavOverride();
  const el = document.getElementById('j-lista');
  if(!G.peladas.length){
    el.innerHTML = '<div class="empty"><i class="ti ti-ball-football"></i>Nenhuma partida cadastrada</div>';
    return;
  }
  const ord = [...G.peladas].sort((a,b) => new Date(b.data+'T'+b.hora) - new Date(a.data+'T'+a.hora));

  // --- 1. PELADAS ABERTAS (todas) ---
  const _abertas = [...G.peladas]
    .filter(p => pelAdaberta(p))
    .sort((a,b) => new Date(a.data+'T'+a.hora) - new Date(b.data+'T'+b.hora));

  let heroHtml = '';
  if(_abertas.length){
    heroHtml = _abertas.map(p => {
      const conf = totalJogadoresConfirmados(p);
      const lotada = peladaLotada(p);
      return `<div class="home-hero home-hero--proximo">
        <div class="home-hero-top">
          <span class="home-hero-eyebrow">PRÓXIMO JOGO</span>
          <span class="home-hero-badge${lotada ? ' home-hero-badge--lotada' : ''}">${lotada ? '<i class="ti ti-lock" style="font-size:9px;"></i> LOTADA' : 'ABERTA'}</span>
        </div>
        <div class="home-hero-nome">${escHtml(p.nome)}</div>
        <div class="home-hero-meta">
          <span><i class="ti ti-calendar"></i> ${fmtData(p.data)}</span>
          <span><i class="ti ti-clock"></i> ${p.hora}</span>
          <span><i class="ti ti-map-pin"></i> ${escHtml(p.local)}</span>
        </div>
        <div class="home-hero-footer">
          <div class="home-hero-pill"><i class="ti ti-users"></i> <b>${conf}/${p.max}</b> confirmados</div>
          ${lotada
            ? `<button class="home-hero-btn home-hero-btn--espera" onclick="abrirJogador('${p.id}')"><i class="ti ti-clock"></i> Lista de espera</button>`
            : `<button class="home-hero-btn" onclick="abrirJogador('${p.id}')">Confirmar agora</button>`
          }
        </div>
      </div>`;
    }).join('');
  } else {
    heroHtml = `<div class="home-hero home-hero--vazio">
      <div class="home-hero-label"><i class="ti ti-ball-football"></i> Próxima pelada</div>
      <div class="home-hero-nome">Aguarde a próxima pelada</div>
      <div class="home-hero-meta">
        <span>Em breve uma nova rodada será marcada.</span>
      </div>
    </div>`;
  }

  // --- 2. RESULTADOS (últimas 3 encerradas que jogaram) ---
  function camisaSvg(cor){
    const src = cor==='azul' ? 'camisa-azul.png?v=2' : 'camisa-vermelha.png?v=2';
    return `<img class="home-shirt-svg" src="${src}" alt="${cor}" />`;
  }
  const encerradas = ord.filter(p => peladaEncerrada(p) && !encerradaAntesDoJogo(p)).slice(0,3);
  const resultadosHtml = encerradas.length ? encerradas.map(p => {
    const golsA = p.resultado ? (Number(p.resultado.gols_azul)||0) : '?';
    const golsB = p.resultado ? (Number(p.resultado.gols_vermelho)||0) : '?';
    const d = p.data ? new Date(p.data+'T12:00:00') : null;
    const dia = d ? String(d.getDate()).padStart(2,'0') : '—';
    const mes = d ? d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','') : '';
    return `<div class="home-result-card home-result-card--premium" onclick="abrirResumoPublico('${p.id}')">
      <div class="home-result-head">
        <div class="home-result-date"><b>${dia}</b><span>${mes}</span></div>
        <div class="home-result-info">
          <div class="home-result-label">RESULTADO ANTERIOR</div>
          <div class="home-result-nome">${escHtml(p.nome)}</div>
          <div class="home-result-local"><i class="ti ti-map-pin"></i> ${escHtml(p.local)}</div>
        </div>
        <button id="home-vot-btn-${p.id}" class="home-vot-btn" style="display:none;"
          onclick="event.stopPropagation();G.pelada=G.peladas.find(x=>String(x.id)==='${p.id}');abrirVotacao()"
          title="Avaliar jogadores">
          <i class="ti ti-star"></i> Votação
        </button>
      </div>
      <div class="home-result-scoreboard">
        <div class="home-result-team">${camisaSvg('azul')}<span>Azul</span></div>
        <div class="home-result-score">
          <span id="home-gols-a-${p.id}">${golsA}</span><span class="home-score-sep">x</span><span id="home-gols-b-${p.id}">${golsB}</span>
        </div>
        <div class="home-result-team">${camisaSvg('vermelho')}<span>Vermelho</span></div>
      </div>
      <div id="home-summary-label-${p.id}" class="home-result-cta">Ver resumo da pelada</div>
    </div>`;
  }).join('') : '<div class="empty" style="padding:12px 0;font-size:13px;">Nenhum resultado ainda</div>';

  // --- 3. ELENCO DE ESTRELAS (carrossel) ---
  const jogAtivos = (G.jogadores||[]).filter(j => j.ativo !== false);
  const chipsFn = () => {
    if(!jogAtivos.length) return '<div style="padding:8px;font-size:12px;color:var(--text2);">Carregando elenco…</div>';
    return jogAtivos.map(j => {
      const apelido = (j.apelido||j.nome||'?').toUpperCase();
      const posRaw = (j.posicao_favorita || '').toUpperCase().trim();
      const posMap = {
        'GOLEIRO':'GOL','GOL':'GOL',
        'ZAGUEIRO':'ZAG','ZAG':'ZAG',
        'LATERAL':'LAT','LAT':'LAT',
        'MEIA':'MEI','MEI':'MEI',
        'ATACANTE':'ATA','ATA':'ATA'
      };
      const pos = posMap[posRaw] || null;
      const posHtml = pos ? `<span class="home-chip-pos pos-${pos}">${pos}</span>` : '<span class="home-chip-pos pos-x" style="visibility:hidden;">—</span>';
      const aniv = isAniversarianteMes(j) ? '<span class="badge-aniv-mini" style="position:absolute;top:0;right:0;font-size:11px;">🎂</span>' : '';
      let avatarHtml;
      if(j.foto_url){
        avatarHtml = `<div class="home-chip-avatar" style="position:relative;"><img src="${escHtml(j.foto_url)}" alt=""/>${aniv}</div>`;
      } else {
        const ini = (apelido.slice(0,2));
        avatarHtml = `<div class="home-chip-avatar home-chip-initials" style="position:relative;">${escHtml(ini)}${aniv}</div>`;
      }
      return `<div class="home-player-chip" onclick="abrirPeladeirosPublico('${escHtml(String(j.id||''))}')">
        ${avatarHtml}
        <span class="home-chip-apelido">${escHtml(apelido)}</span>
        ${posHtml}
      </div>`;
    }).join('') +
    `<div class="home-player-chip home-player-chip--ver-todos" onclick="abrirPeladeirosPublico()">
      <div class="home-chip-avatar home-chip-ver-todos"><i class="ti ti-chevron-right"></i></div>
      <span class="home-chip-apelido" style="color:var(--text2);">Ver todos</span>
      <span style="height:18px;"></span>
    </div>`;
  };

  // --- 4. RESUMO DO CAIXA ---
  const caixaHtml = `<div class="home-sec home-sec-caixa">
    <div class="home-sec-header">
      <span class="home-sec-title">Resumo do Caixa</span>
      <span class="home-sec-link" onclick="abrirJCaixa()">Ver detalhes</span>
    </div>
    <div id="home-caixa-cards" class="home-caixa-card">
      <div class="home-caixa-card-top">
        <div>
          <div class="home-caixa-kicker">CAIXA GERAL</div>
          <div class="home-caixa-title">Situação financeira</div>
        </div>
        <div class="home-caixa-main-icon"><i class="ti ti-cash"></i></div>
      </div>
      <div class="home-caixa-grid">
        <div class="home-caixa-item home-caixa-item--saldo">
          <div class="home-caixa-label">Saldo atual</div>
          <div class="home-caixa-row">
            <div class="home-caixa-val" id="home-caixa-saldo">—</div>
            <div class="home-caixa-icon"><i class="ti ti-wallet"></i></div>
          </div>
        </div>
        <div class="home-caixa-item home-caixa-item--pend">
          <div class="home-caixa-label">A receber</div>
          <div class="home-caixa-row">
            <div class="home-caixa-val" id="home-caixa-pend">—</div>
            <div class="home-caixa-icon"><i class="ti ti-coins"></i></div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  // --- MONTA TUDO ---
  el.innerHTML = `
    ${heroHtml ? `<div class="home-sec">${heroHtml}</div>` : ''}

    <div class="home-sec">
      <div class="home-sec-header">
        <span class="home-sec-title">Resultados anteriores</span>
        <span class="home-sec-link" onclick="abrirHistorico()">Ver todos</span>
      </div>
      ${resultadosHtml}
    </div>

    <div class="home-sec">
      <div class="home-sec-header">
        <span class="home-sec-title">Elenco de Estrelas</span>
        <span class="home-sec-link" onclick="abrirPeladeirosPublico()">Ver completo</span>
      </div>
      <div class="home-carousel-wrap">
        <div class="home-carousel" id="home-elenco-carousel">
          ${chipsFn()}
        </div>
      </div>
    </div>

    ${caixaHtml}
  `;

  // Votação e resultados dos cards encerrados
  encerradas.forEach(p => {
    _atualizarBotaoVotacaoHome(p);
    carregarResultadoCardHome(p.id);
  });

  // Caixa: carregar valores reais
  _homeCarregarCaixa();

  // Elenco: se G.jogadores ainda vazio por algum motivo, tenta carregar
  if(!jogAtivos.length){
    sbFetch('/jogadores?select=id,nome,apelido,foto_url,posicao_favorita,data_nascimento,ativo&order=apelido.asc')
      .then(rows => {
        G.jogadores = rows || [];
        const carousel = document.getElementById('home-elenco-carousel');
        if(carousel) carousel.innerHTML = chipsFn();
      }).catch(()=>{});
  }
}

function initPlayerHomeBottomNavOverride(){
  const nav=document.querySelector('#s-j-lista .bottom-nav');
  if(!nav || nav.dataset.playerHomeNavReady==='1') return;
  nav.dataset.playerHomeNavReady='1';
  const btns=nav.querySelectorAll('.nav-btn');
  const destinos={1:'conf',2:'times'};
  Object.keys(destinos).forEach(idx=>{
    const btn=btns[Number(idx)];
    if(!btn) return;
    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      if(typeof e.stopImmediatePropagation==='function') e.stopImmediatePropagation();
      abrirPeladaEmAbertoJogador(destinos[idx]);
    }, true);
  });
}

function peladasAbertasJogador(){
  return [...(G.peladas||[])]
    .filter(p=>pelAdaberta(p))
    .sort((a,b)=>new Date(a.data+'T'+a.hora) - new Date(b.data+'T'+b.hora));
}

function garantirOpenPeladaSheet(){
  if(document.getElementById('open-pelada-sheet')) return;
  const wrap=document.createElement('div');
  wrap.className='adm-menu';
  wrap.id='open-pelada-sheet';
  wrap.onclick=function(event){ fecharOpenPeladaSheet(event); };
  wrap.innerHTML=`<div class="adm-sheet">
    <div class="adm-sheet-title"><i class="ti ti-ball-football" style="font-size:18px;margin-right:6px;"></i> Escolha a pelada</div>
    <div id="open-pelada-sheet-desc" style="font-size:13px;color:var(--text2);margin-bottom:14px;line-height:1.45;">Ha mais de uma pelada aberta. Escolha qual voce quer abrir.</div>
    <div id="open-pelada-sheet-lista" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;"></div>
    <div class="adm-option" onclick="fecharOpenPeladaSheet()"><i class="ti ti-x"></i><div><div class="adm-option-name">Cancelar</div></div></div>
  </div>`;
  document.body.appendChild(wrap);
}

function abrirSheetEscolhaPeladaJogador(peladas, destino='conf'){
  garantirOpenPeladaSheet();
  const sheet=document.getElementById('open-pelada-sheet');
  const lista=document.getElementById('open-pelada-sheet-lista');
  const desc=document.getElementById('open-pelada-sheet-desc');
  if(!sheet || !lista) return;
  _openPeladaSheetRows=[...(peladas||[])];
  _openPeladaSheetDestino=destino==='times' ? 'times' : 'conf';
  if(desc){
    desc.textContent=_openPeladaSheetDestino==='times'
      ? 'Ha mais de uma pelada aberta. Escolha qual escalacao voce quer ver.'
      : 'Ha mais de uma pelada aberta. Escolha qual confirmacao voce quer abrir.';
  }
  lista.innerHTML=_openPeladaSheetRows.map((p,i)=>{
    const meta=[fmtData(p.data), p.hora||'', p.local||''].filter(Boolean).join(' • ');
    const status=peladaLotada(p) ? 'Lotada' : 'Aberta';
    return `<button class="id-sheet-opt" onclick="_selecionarPeladaAbertaJogador(${i})">
      <span class="id-sheet-nome">${escHtml(p.nome||'Pelada')}</span>
      <span class="id-sheet-mod">${escHtml(meta)} | ${status}</span>
    </button>`;
  }).join('');
  sheet.classList.add('open');
}

function fecharOpenPeladaSheet(event){
  if(event && event.target?.id!=='open-pelada-sheet') return;
  const sheet=document.getElementById('open-pelada-sheet');
  if(sheet) sheet.classList.remove('open');
}

async function _selecionarPeladaAbertaJogador(index){
  const pelada=_openPeladaSheetRows[Number(index)];
  const destino=_openPeladaSheetDestino || 'conf';
  fecharOpenPeladaSheet();
  if(!pelada) return;
  await abrirJogador(pelada.id, destino);
}

async function abrirPeladaEmAbertoJogador(destino='conf'){
  if(typeof carregarBaseAppSeNecessario==='function') await carregarBaseAppSeNecessario(true);
  initPlayerHomeBottomNavOverride();
  const abertas=peladasAbertasJogador();
  if(!abertas.length){
    showToast('Nenhuma pelada aberta no momento.');
    return;
  }
  if(abertas.length===1){
    await abrirJogador(abertas[0].id, destino);
    return;
  }
  abrirSheetEscolhaPeladaJogador(abertas, destino);
}

function abrirTelaJogadorPorDestino(destino='conf'){
  if(destino==='times'){
    renderJTimes();
    goTo('s-j-times');
    return;
  }
  renderJConf();
  goTo('s-j-conf');
}

function abrirHistorico(){
  goTo('s-j-historico');
  renderJHistorico();
}

function renderJHistorico(){
  const el = document.getElementById('j-historico-lista');
  if(!el) return;
  const encerradas = [...G.peladas]
    .filter(p => peladaEncerrada(p) && !encerradaAntesDoJogo(p))
    .sort((a,b) => new Date(b.data+'T'+b.hora) - new Date(a.data+'T'+a.hora));

  if(!encerradas.length){
    el.innerHTML = '<div class="empty"><i class="ti ti-ball-football"></i>Nenhuma partida encerrada</div>';
    return;
  }

  function camisaSvg(cor){
    const src = cor==='azul' ? 'camisa-azul.png?v=2' : 'camisa-vermelha.png?v=2';
    return `<img class="home-shirt-svg" src="${src}" alt="${cor}" />`;
  }

  el.innerHTML = encerradas.map(p => {
    const golsA = p.resultado ? (Number(p.resultado.gols_azul)||0) : '?';
    const golsB = p.resultado ? (Number(p.resultado.gols_vermelho)||0) : '?';
    const d = p.data ? new Date(p.data+'T12:00:00') : null;
    const dia = d ? String(d.getDate()).padStart(2,'0') : '—';
    const mes = d ? d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','') : '';
    return `<div class="home-result-card home-result-card--premium" onclick="abrirResumoPublico('${p.id}')">
      <div class="home-result-head">
        <div class="home-result-date"><b>${dia}</b><span>${mes}</span></div>
        <div class="home-result-info">
          <div class="home-result-label">RESULTADO ANTERIOR</div>
          <div class="home-result-nome">${escHtml(p.nome)}</div>
          <div class="home-result-local"><i class="ti ti-map-pin"></i> ${escHtml(p.local)}</div>
        </div>
      </div>
      <div class="home-result-scoreboard">
        <div class="home-result-team">${camisaSvg('azul')}<span>Azul</span></div>
        <div class="home-result-score">
          <span>${golsA}</span><span class="home-score-sep">x</span><span>${golsB}</span>
        </div>
        <div class="home-result-team">${camisaSvg('vermelho')}<span>Vermelho</span></div>
      </div>
      <div class="home-result-cta">Ver resumo da pelada</div>
    </div>`;
  }).join('');
}

async function _homeCarregarCaixa(){
  try{
    const mov = await dbGetMovimentos();
    const resumo = calcularResumo(mov||[]);
    const pend = _calcPendencias();
    const elS = document.getElementById('home-caixa-saldo');
    const elP = document.getElementById('home-caixa-pend');
    if(elS) elS.textContent = money(resumo.saldo);
    if(elP) elP.textContent = money(pend);
  }catch(e){}
}

function _valorPendenteJogadorHome(p, j){
  if(!p || !j || modalidadeConfirmacaoEhMensalista(j) || j.isento || j.pago) return 0;
  const valorJogo = Number(p.valor||0);
  const valorChurras = Number(G.valorChurras||0);
  if(p.temChurras && j.churras==='churras') return valorChurras;
  if(p.temChurras && j.churras==='jogo_churras') return valorJogo + valorChurras;
  return valorJogo;
}

function _calcPendencias(){
  try{
    let total = 0;
    (G.peladas||[]).forEach(p => {
      (p.confirmados||[]).forEach(j => {
        total += _valorPendenteJogadorHome(p, j);
      });
    });
    return total;
  }catch(e){ return 0; }
}

async function carregarResultadoCardHome(peladaId){
  const p = G.peladas.find(x=>String(x.id)===String(peladaId));
  if(encerradaAntesDoJogo(p)) return;
  try{
    const a   = document.getElementById(`home-gols-a-${peladaId}`);
    const b   = document.getElementById(`home-gols-b-${peladaId}`);
    const label = document.getElementById(`home-summary-label-${peladaId}`);
    if(a && b && p?.resultado){
      a.textContent = Number(p.resultado.gols_azul) || 0;
      b.textContent = Number(p.resultado.gols_vermelho) || 0;
    }
    try{
      const [gols, videos] = await Promise.all([dbGetGols(peladaId), dbGetVideos(peladaId)]);
      const temConteudo = !!p?.resultado || (Array.isArray(gols) && gols.length) || (Array.isArray(videos) && videos.length);
      p.homeResumoDisponivel = temConteudo;
      if(label) label.textContent = 'Olho no lance';
    }catch(e){}
  }catch(e){}
}

function tentarVotarHome(id) {
  const p = G.peladas.find(x => String(x.id) === String(id));
  if(!p) return;
  G.pelada = p;

  const jogadorAtual = jogadorAtualNaPelada(p);
  const escalado  = !!jogadorAtual;

  if(!escalado) {
    showToast('Só quem jogou opina, parceiro! ⚽');
    return;
  }

  abrirVotacao();
}

function _atualizarBotaoVotacaoHome(p) {
  if(!p) return;
  const votBtn   = document.getElementById(`home-vot-btn-${p.id}`);
  const votLabel = document.getElementById(`home-vot-label-${p.id}`);
  const btnWrap  = document.getElementById(`home-btns-${p.id}`);
  if(!votBtn) return;

  if(votacaoEncerrada(p)){
    if(btnWrap) btnWrap.classList.add('vote-ended-shift');
    votBtn.style.display = 'none';
    votBtn.style.visibility = '';
    votBtn.style.pointerEvents = '';
    votBtn.disabled = true;
    votBtn.style.opacity = '';
    votBtn.style.cursor = 'default';
    return;
  }

  if(votacaoAberta(p)){
    if(btnWrap) btnWrap.classList.remove('vote-ended-shift');
    votBtn.style.display = '';
    votBtn.style.visibility = 'visible';
    votBtn.style.pointerEvents = '';
    votBtn.disabled = false;
    votBtn.style.opacity = '';
    votBtn.style.cursor = '';
    if(lsJaVotou(p.id)){
      votBtn.disabled = true;
      votBtn.style.opacity = '.5';
      votBtn.style.cursor = 'default';
      if(votLabel) votLabel.textContent = 'Voto enviado';
    } else {
      if(votLabel) votLabel.textContent = 'Avaliar';
    }
    return;
  }

  votBtn.style.display = 'none';
  votBtn.style.visibility = '';
  votBtn.style.pointerEvents = '';
  if(btnWrap) btnWrap.classList.remove('vote-ended-shift');
}

// ==========================================
// IDENTIDADE DO JOGADOR
// ==========================================
// Nota: fluxo legado por apelido digitado removido.
// Toda confirmação exige login (G.usuario + G.jogadorLogado).

function apelidoJogadorLogado(){
  return (G.jogadorLogado && G.jogadorLogado.apelido ? G.jogadorLogado.apelido : '').trim();
}

function aliasesJogadorLogado(){
  const vals = [
    G.jogadorLogado?.apelido,
    G.jogadorLogado?.nome,
  ].map(v => normNome(v || '')).filter(Boolean);
  return Array.from(new Set(vals));
}

async function exigirLoginParaConfirmacao(){
  if(G.usuario && G.jogadorLogado){
    if(!apelidoJogadorLogado()){
      showToast('Cadastre seu apelido antes de confirmar.');
      await abrirPerfilJogador();
      return false;
    }
    return true;
  }
  showToast('Faça login para confirmar presença.');
  await abrirPerfilJogador(false);
  return false;
}

// O nome de confirmação vem SEMPRE do perfil logado — sem fallback para input manual.
function nomeConfirmacaoEfetivo(){
  return apelidoJogadorLogado();
}

function jogadorAtualNaPelada(pelada){
  if(!pelada) return null;
  const escalados = (pelada.jogadores && pelada.jogadores.length) ? pelada.jogadores : pelada.confirmados || [];
  const jogadorId = G.jogadorLogado?.id || null;
  if(jogadorId){
    const porId = escalados.find(j => String(j.jogador_id || '') === String(jogadorId));
    if(porId) return porId;
  }
  const aliases = aliasesJogadorLogado();
  if(aliases.length){
    const porNome = escalados.find(j => aliases.includes(normNome(j.nome)));
    if(porNome) return porNome;
  }
  return null;
}

function confirmacaoAtualNaPelada(pelada){
  if(!pelada) return null;
  const jogadorId = G.jogadorLogado?.id || null;
  if(jogadorId){
    const porId = (pelada.confirmados || []).find(j => String(j.jogador_id || '') === String(jogadorId));
    if(porId) return porId;
  }
  const aliases = aliasesJogadorLogado();
  if(aliases.length){
    const porNome = (pelada.confirmados || []).find(j => aliases.includes(normNome(j.nome)));
    if(porNome) return porNome;
  }
  return null;
}

// ==========================================
// JOGADOR - PELADEIROS (somente leitura)
// ==========================================
let peladeirosSort = 'apelido';
let peladeirosFiltroPos = 'todos';
let peladeirosStats = { jogos:{}, gols:{}, ultimaPresenca:{}, jogosAnoAtual:{} };
let peladeiroExpandidoId = '';
let peladeiroAutoOpenId = '';
let peladeirosOutsideCloseReady = false;

function peladeiroIniciais(j){
  const base=(j.apelido||j.nome||'?').trim();
  return escHtml((base[0]||'?').toUpperCase());
}

function peladeiroInstagram(v){
  return String(v||'').trim().replace(/^@+/,'').replace(/\s+/g,'');
}

function peladeiroPrimeiroNome(j){
  return String(j.nome||'').trim().split(/\s+/)[0] || 'Exilado';
}

function peladeiroIdade(j){
  const raw=String(j.data_nascimento||'');
  const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return '';
  const nasc=new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
  if(Number.isNaN(nasc.getTime())) return '';
  const hoje=new Date();
  let idade=hoje.getFullYear()-nasc.getFullYear();
  const jaFezAniversario=(hoje.getMonth()>nasc.getMonth()) || (hoje.getMonth()===nasc.getMonth() && hoje.getDate()>=nasc.getDate());
  if(!jaFezAniversario) idade--;
  return idade>0 && idade<120 ? `${idade} anos` : '';
}


function peladeiroPosAbrev(pos){
  const raw=normNome(pos||'');
  if(raw.includes('gol')) return 'GOL';
  if(raw.includes('zag')) return 'ZAG';
  if(raw.includes('mei')) return 'MEI';
  if(raw.includes('ata')) return 'ATA';
  if(raw.includes('lat')) return 'LAT';
  return String(pos||'POS').toUpperCase().slice(0,3);
}

function peladeiroPosClasse(pos){
  const ab=peladeiroPosAbrev(pos).toLowerCase();
  return ['gol','zag','mei','ata','lat'].includes(ab)?ab:'pos';
}

function peladeiroChaves(j){
  return [j.id, j.nome, j.apelido, peladeiroPrimeiroNome(j)].filter(Boolean).map(x=>normNome(String(x)));
}

function peladeiroInstagramUrl(v){
  const insta=peladeiroInstagram(v);
  return insta ? `https://instagram.com/${encodeURIComponent(insta)}` : '';
}

function peladeiroStat(j,tipo){
  const mapa=peladeirosStats && peladeirosStats[tipo] ? peladeirosStats[tipo] : {};
  for(const k of peladeiroChaves(j)){
    if(mapa[k] !== undefined) return mapa[k];
  }
  return 0;
}

function setPeladeirosFiltroPos(pos){
  peladeirosFiltroPos = ['gol','zag','mei','ata','todos'].includes(pos) ? pos : 'todos';
  renderPeladeirosLista();
}

function atualizarPeladeirosFiltroUI(){
  ['todos','gol','zag','mei','ata'].forEach(pos=>{
    const b=document.getElementById(`peladeiros-pos-${pos}`);
    if(b) b.classList.toggle('active', peladeirosFiltroPos===pos);
  });
}

async function carregarStatsPeladeirosPublico(){
  const stats={jogos:{},gols:{},ultimaPresenca:{},jogosAnoAtual:{}};
  try{
    const golRows=await sbFetch('/gols_pelada?select=nome_jogador,quantidade&limit=3000').catch(()=>[]);
    const anoAtual=new Date().getFullYear();
    (G.peladas||[]).forEach(p=>{
      if(!p || !peladaEncerrada(p) || encerradaAntesDoJogo(p)) return;
      const dataPelada=p.data || '';
      const anoPelada=dataPelada ? new Date(`${dataPelada}T12:00:00`).getFullYear() : null;
      const escalados=Array.isArray(p.jogadores) ? p.jogadores : [];
      escalados.forEach(item=>{
        const keys=[];
        if(item?.jogador_id) keys.push(normNome(String(item.jogador_id)));
        if(item?.nome) keys.push(normNome(String(item.nome)));
        [...new Set(keys)].forEach(k=>{
          if(!k) return;
          stats.jogos[k]=(stats.jogos[k]||0)+1;
          if(anoPelada===anoAtual) stats.jogosAnoAtual[k]=(stats.jogosAnoAtual[k]||0)+1;
          if(dataPelada){
            const prev=stats.ultimaPresenca[k];
            if(!prev || String(prev.iso||'')<String(dataPelada)){
              stats.ultimaPresenca[k]={ iso:dataPelada };
            }
          }
        });
      });
    });
    (golRows||[]).forEach(g=>{
      const k=normNome(g.nome_jogador||'');
      if(!k) return;
      stats.gols[k]=(stats.gols[k]||0)+(Number(g.quantidade)||0);
    });
  }catch(e){}
  peladeirosStats=stats;
}

function peladeiroSeloPerfil(j){
  const perfil=String(j.perfil_app||'jogador').toLowerCase();
  if(perfil==='adm') return '<span class="peladeiro-chip peladeiro-chip-role peladeiro-chip-adm"><i class="ti ti-shield"></i> ADM</span>';
  if(perfil==='presidente') return '<span class="peladeiro-chip peladeiro-chip-role peladeiro-chip-presidente"><i class="ti ti-star"></i> Presidente</span>';
  if(perfil==='escalador') return '<span class="peladeiro-chip peladeiro-chip-role peladeiro-chip-escalador"><i class="ti ti-clipboard-list"></i> Escalador</span>';
  return '';
}

function peladeiroStatusLabel(j){
  return j.ativo===false ? 'Inativo' : 'Ativo';
}

function peladeiroPosLabel(pos){
  const ab=peladeiroPosAbrev(pos||'POS');
  return { GOL:'Goleiro', ZAG:'Zagueiro', LAT:'Lateral', MEI:'Meia', ATA:'Atacante' }[ab] || String(pos||'—');
}

function peladeiroModalidadeLabel(mod){
  return mod==='mensalista' ? 'Mensalista' : 'Avulso';
}

function peladeiroPerfilLabel(perfil){
  const val=String(perfil||'jogador').toLowerCase();
  return { jogador:'Jogador', escalador:'Escalador', presidente:'Presidente', adm:'Admin' }[val] || 'Jogador';
}

function peladeiroCampoDetalhe(label, valor, extraClass=''){
  const display=String(valor||'').trim() || '—';
  return `<div class="peladeiro-detail-field${extraClass ? ` ${extraClass}` : ''}">
    <span class="peladeiro-detail-label">${escHtml(label)}</span>
    <span class="peladeiro-detail-value">${escHtml(display)}</span>
  </div>`;
}

function peladeiroCampoIcone(icon, label, valor, extraClass=''){
  const display=String(valor||'').trim() || 'â€”';
  return `<div class="peladeiro-detail-field${extraClass ? ` ${extraClass}` : ''}">
    <span class="peladeiro-detail-label"><i class="ti ${escHtml(icon)}"></i> ${escHtml(label)}</span>
    <span class="peladeiro-detail-value">${escHtml(display)}</span>
  </div>`;
}

function peladeiroUltimaPresencaInfo(j){
  const mapa=peladeirosStats && peladeirosStats.ultimaPresenca ? peladeirosStats.ultimaPresenca : {};
  for(const k of peladeiroChaves(j)){
    if(mapa[k]) return mapa[k];
  }
  return null;
}

function peladeiroFichaExpandida(j){
  if(!j) return '';
  const insta=peladeiroInstagram(j.instagram);
  const instaHandle=insta ? `@${insta}` : '';
  const telefone=formatarTelefone(j.telefone||'');
  const nascimento=dataIsoParaBr(j.data_nascimento||'');
  const foto=j.foto_url
    ? `<img src="${escHtml(j.foto_url)}" alt="" />`
    : escHtml((j.apelido||j.nome||'?').trim().slice(0,1).toUpperCase());
  const apelido=(j.apelido||j.nome||'Peladeiro').toUpperCase();
  const posLabel=peladeiroPosLabel(j.posicao_favorita||'');
  const sub=[instaHandle || `@${(j.apelido||j.nome||'').trim().replace(/\s+/g,'').toLowerCase()}`, posLabel].filter(Boolean).join(' · ');
  const jogos=peladeiroStat(j,'jogos');
  const gols=peladeiroStat(j,'gols');
  const perfil=peladeiroPerfilLabel(j.perfil_app);
  const status=peladeiroStatusLabel(j);
  const instaHtml=insta
    ? `<a class="peladeiro-detail-link" href="${peladeiroInstagramUrl(insta)}" target="_blank" rel="noopener noreferrer"><i class="ti ti-brand-instagram"></i> ${escHtml(instaHandle)}</a>`
    : '<span class="peladeiro-detail-muted">Sem Instagram</span>';
  return `<div class="peladeiro-inline-detail perfil-inline-theme" data-peladeiro-detail="${escHtml(String(j.id||''))}">
    <div class="peladeiro-inline-hero">
      <div class="perfil-hero-card perfil-hero-card--jogador peladeiro-inline-hero-card">
        <div class="perfil-hero-row">
          <div class="perfil-hero-photo-wrap">
            <div class="perfil-hero-avatar">${foto}</div>
          </div>
          <div class="perfil-hero-info">
            <div class="perfil-hero-label">ELENCO DE ESTRELAS</div>
            <div class="perfil-hero-title">${escHtml(apelido)}</div>
            <div class="perfil-hero-nome">${escHtml(j.nome||'—')}</div>
            <div class="perfil-hero-sub">${escHtml(sub || '—')}</div>
            <div class="peladeiro-inline-chips">
              <span class="peladeiro-chip peladeiro-chip-pos">${escHtml(peladeiroPosAbrev(j.posicao_favorita||'POS'))}</span>
              <span class="peladeiro-chip"><i class="ti ti-crown"></i> ${escHtml(peladeiroModalidadeLabel(j.modalidade))}</span>
              <span class="peladeiro-chip"><i class="ti ti-user-check"></i> ${escHtml(status)}</span>
              <span class="peladeiro-chip"><i class="ti ti-shield"></i> ${escHtml(perfil)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="peladeiro-inline-sections">
      <div class="perfil-section">
        <div class="perfil-section-label">CADASTRO</div>
        <div class="perfil-section-title">Dados do jogador</div>
        <div class="perfil-fields-card peladeiro-inline-fields">
          ${peladeiroCampoDetalhe('Nome', j.nome)}
          ${peladeiroCampoDetalhe('Apelido', j.apelido||j.nome)}
          ${peladeiroCampoDetalhe('Email', j.email)}
          ${peladeiroCampoDetalhe('Telefone', telefone)}
          ${peladeiroCampoDetalhe('Nascimento', nascimento)}
          ${peladeiroCampoDetalhe('Posição', posLabel)}
          ${peladeiroCampoDetalhe('Modalidade', peladeiroModalidadeLabel(j.modalidade))}
          ${peladeiroCampoDetalhe('Status', status)}
          ${peladeiroCampoDetalhe('Perfil', perfil, 'peladeiro-detail-field--last')}
        </div>
      </div>
      <div class="perfil-section">
        <div class="perfil-section-label">RESUMO</div>
        <div class="perfil-section-title">Ficha completa</div>
        <div class="peladeiro-inline-summary">
          <div class="perfil-resumo-item">
            <div class="perfil-resumo-label">Instagram</div>
            <div class="peladeiro-inline-summary-main">${instaHtml}</div>
          </div>
          <div class="perfil-resumo-item">
            <div class="perfil-resumo-label">Presenças</div>
            <div class="perfil-resumo-val"><span>${escHtml(String(jogos))}</span> partida${jogos===1?'':'s'}</div>
          </div>
          <div class="perfil-resumo-item">
            <div class="perfil-resumo-label">Gols</div>
            <div class="perfil-resumo-val"><span>${escHtml(String(gols))}</span> no histórico</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function peladeiroCampoIcone(icon, label, valor, extraClass=''){
  const display=String(valor||'').trim() || 'â€”';
  return `<div class="peladeiro-detail-field${extraClass ? ` ${extraClass}` : ''}">
    <span class="peladeiro-detail-label"><i class="ti ${escHtml(icon)}"></i> ${escHtml(label)}</span>
    <span class="peladeiro-detail-value">${escHtml(display)}</span>
  </div>`;
}

function peladeiroUltimaPresencaInfo(j){
  const mapa=peladeirosStats && peladeirosStats.ultimaPresenca ? peladeirosStats.ultimaPresenca : {};
  for(const k of peladeiroChaves(j)){
    if(mapa[k]) return mapa[k];
  }
  return null;
}

function peladeiroFichaExpandidaCard(j){
  if(!j) return '';
  const insta=peladeiroInstagram(j.instagram);
  const instaHandle=insta ? `@${insta}` : '';
  const telefone=formatarTelefone(j.telefone||'');
  const nascimento=dataIsoParaBr(j.data_nascimento||'');
  const foto=j.foto_url
    ? `<img src="${escHtml(j.foto_url)}" alt="" />`
    : escHtml((j.apelido||j.nome||'?').trim().slice(0,1).toUpperCase());
  const apelido=(j.apelido||j.nome||'Peladeiro').toUpperCase();
  const sub=instaHandle || `@${(j.apelido||j.nome||'').trim().replace(/\s+/g,'').toLowerCase()}`;
  const perfil=peladeiroPerfilLabel(j.perfil_app);
  const jogosAnoAtual=peladeiroStat(j,'jogosAnoAtual');
  const ultimaPresenca=peladeiroUltimaPresencaInfo(j);
  const ultimaData=ultimaPresenca?.iso ? new Date(`${ultimaPresenca.iso}T12:00:00`) : null;
  const ultimaFmt=ultimaData && !Number.isNaN(ultimaData.getTime())
    ? ultimaData.toLocaleDateString('pt-BR',{day:'numeric',month:'short'}).replace('.','')
    : 'Sem jogo';
  const posAbrev=peladeiroPosAbrev(j.posicao_favorita||'POS');
  const modalidade=peladeiroModalidadeLabel(j.modalidade);
  const posFlags=['GOL','ZAG','LAT','MEI','ATA'].map(pos=>`<span class="peladeiro-inline-flag${pos===posAbrev ? ' active' : ''}">${pos}</span>`).join('');
  const modFlags=['Avulso','Mensalista'].map(item=>`<span class="peladeiro-inline-flag${item===modalidade ? ' active' : ''}">${item}</span>`).join('');
  return `<div class="peladeiro-inline-detail perfil-inline-theme" data-peladeiro-detail="${escHtml(String(j.id||''))}">
    <div class="peladeiro-inline-hero perfil-hero-card perfil-hero-card--jogador peladeiro-inline-hero-card">
      <div class="perfil-hero-row">
        <div class="perfil-hero-photo-wrap">
          <div class="perfil-hero-avatar">${foto}</div>
          <div class="perfil-hero-cam" aria-hidden="true"><i class="ti ti-camera"></i></div>
        </div>
        <div class="perfil-hero-info">
          <div class="perfil-hero-label">CONTA DO PELADEIRO</div>
          <div class="perfil-hero-title">${escHtml(apelido)}</div>
          <div class="perfil-hero-nome">${escHtml(j.nome||'â€”')}</div>
          <div class="perfil-hero-sub">${escHtml(sub || '-')} <span class="peladeiro-inline-profile-sep">|</span> ${escHtml(perfil)}</div>
        </div>
      </div>
    </div>
    <div class="peladeiro-inline-sections">
      <div class="perfil-section peladeiro-inline-section">
        <div class="perfil-fields-card peladeiro-inline-fields">
          ${peladeiroCampoIcone('ti-user','Nome completo', j.nome)}
          ${peladeiroCampoIcone('ti-shirt','Apelido', j.apelido||j.nome)}
          ${peladeiroCampoIcone('ti-phone','Telefone', telefone)}
          ${peladeiroCampoIcone('ti-calendar','Nascimento', nascimento)}
          ${peladeiroCampoIcone('ti-brand-instagram','Instagram', instaHandle)}
          <div class="peladeiro-detail-field">
            <span class="peladeiro-detail-label">Posicao favorita</span>
            <span class="peladeiro-inline-flags">${posFlags}</span>
          </div>
          <div class="peladeiro-detail-field peladeiro-detail-field--last">
            <span class="peladeiro-detail-label">Modalidade</span>
            <span class="peladeiro-inline-flags">${modFlags}</span>
          </div>
        </div>
      </div>
      <div class="peladeiro-inline-presenca">
        <div class="peladeiro-inline-presenca-left">
          <div class="peladeiro-inline-presenca-date">${escHtml(ultimaFmt)}</div>
          <div class="peladeiro-inline-presenca-label">ULTIMA PRESENCA</div>
        </div>
        <div class="peladeiro-inline-presenca-right">${escHtml(String(jogosAnoAtual))} partida${jogosAnoAtual===1?'':'s'} em ${new Date().getFullYear()}</div>
      </div>
    </div>
  </div>`;
}

function togglePeladeiroExpandido(id){
  const next=String(id||'');
  peladeiroExpandidoId = peladeiroExpandidoId===next ? '' : next;
  renderPeladeirosLista();
}

function fecharPeladeiroExpandido(){
  if(!peladeiroExpandidoId) return;
  peladeiroExpandidoId='';
  renderPeladeirosLista();
}

function garantirFechamentoExternoPeladeiros(){
  if(peladeirosOutsideCloseReady) return;
  document.addEventListener('click', (event)=>{
    if(!peladeiroExpandidoId) return;
    const screen=document.getElementById('s-j-peladeiros');
    if(!screen || !screen.classList.contains('active')) return;
    const target=event.target;
    if(!(target instanceof Element)) return;
    if(target.closest('.peladeiro-card-wrap') || target.closest('.peladeiro-inline-detail')) return;
    fecharPeladeiroExpandido();
  });
  peladeirosOutsideCloseReady = true;
}

function setPeladeirosSort(tipo){
  peladeirosSort = tipo === 'nome' ? 'nome' : 'apelido';
  renderPeladeirosLista();
}

function atualizarPeladeirosSortUI(){
  const btnApelido=document.getElementById('peladeiros-sort-apelido');
  const btnNome=document.getElementById('peladeiros-sort-nome');
  if(btnApelido) btnApelido.classList.toggle('active',peladeirosSort==='apelido');
  if(btnNome) btnNome.classList.toggle('active',peladeirosSort==='nome');
}

function chaveOrdenacaoPeladeiro(j){
  const prim = peladeirosSort === 'nome' ? j.nome : (j.apelido||j.nome);
  const sec = peladeirosSort === 'nome' ? (j.apelido||'') : (j.nome||'');
  return [normNome(prim||''), normNome(sec||'')];
}

async function abrirPeladeirosPublico(jogadorId=''){
  fecharMenuJogador();
  G.pelada = null;
  peladeiroAutoOpenId = String(jogadorId||'');
  peladeiroExpandidoId = '';
  goTo('s-j-peladeiros');
  await carregarPeladeirosPublico();
}

async function carregarPeladeirosPublico(){
  garantirFechamentoExternoPeladeiros();
  const el=document.getElementById('peladeiros-lista');
  if(el) el.innerHTML='<div class="empty"><i class="ti ti-loader" style="animation:spin 1s linear infinite;display:inline-block;"></i>Carregando peladeiros</div>';
  try{
    G.jogadores=await sbFetch('/jogadores?select=id,nome,apelido,instagram,foto_url,posicao_favorita,modalidade,perfil_app,data_nascimento,ativo,telefone,email&order=apelido.asc');
    await carregarStatsPeladeirosPublico();
    renderPeladeirosLista();
  }catch(e){
    if(el) el.innerHTML='<div class="empty"><i class="ti ti-user-x"></i>Nao foi possivel carregar os peladeiros</div>';
  }
}

function renderPeladeirosLista(){
  const el=document.getElementById('peladeiros-lista'); if(!el)return;
  atualizarPeladeirosSortUI();
  atualizarPeladeirosFiltroUI();
  const busca=normNome(document.getElementById('peladeiros-busca')?.value||'');
  const ativos=(G.jogadores||[]).filter(j=>j.ativo!==false);
  const total=document.getElementById('peladeiros-total');
  if(total) total.textContent=ativos.length;
  const arr=ativos.filter(j=>{
    const texto=normNome([j.nome,j.apelido,j.instagram,j.posicao_favorita,j.modalidade].filter(Boolean).join(' '));
    const posOk=peladeirosFiltroPos==='todos' || peladeiroPosClasse(j.posicao_favorita)===peladeirosFiltroPos;
    return posOk && (!busca || texto.includes(busca));
  }).sort((a,b)=>{
    const ka=chaveOrdenacaoPeladeiro(a);
    const kb=chaveOrdenacaoPeladeiro(b);
    return ka[0].localeCompare(kb[0],'pt-BR') || ka[1].localeCompare(kb[1],'pt-BR');
  });
  if(!arr.length){ el.innerHTML='<div class="empty"><i class="ti ti-users"></i>Nenhum peladeiro encontrado</div>'; return; }
  if(peladeiroAutoOpenId && arr.some(j=>String(j.id)===peladeiroAutoOpenId)){
    peladeiroExpandidoId = peladeiroAutoOpenId;
    peladeiroAutoOpenId = '';
  } else if(peladeiroAutoOpenId){
    peladeiroAutoOpenId = '';
  }
  // Pré-calcula tema por id para não quebrar ao expandir cards
  const _temaMap = {};
  arr.forEach((j,i) => { _temaMap[String(j.id)] = i % 2 === 0 ? 'blue' : 'red'; });

  el.innerHTML=arr.map((j,i)=>{
    const insta=peladeiroInstagram(j.instagram);
    const foto=j.foto_url ? `<img src="${escHtml(j.foto_url)}" alt="" />` : peladeiroIniciais(j);
    const apelido=(j.apelido||j.nome||'Peladeiro').toUpperCase();
    const primeiroNome=peladeiroPrimeiroNome(j);
    const idade=peladeiroIdade(j);
    const linhaNome=[escHtml(primeiroNome), idade ? escHtml(idade) : ''].filter(Boolean).join(' <span class="peladeiro-sep">|</span> ');
    const posAbrev=peladeiroPosAbrev(j.posicao_favorita||'POS');
    const posClasse=peladeiroPosClasse(j.posicao_favorita||'POS');
    const modalidade=j.modalidade==='mensalista'?'Mensalista':'Avulso';
    const zoom=j.foto_url?'abrirZoomFotoUrl(this.dataset.url)':'return false';
    const tema=_temaMap[String(j.id)] || 'blue';
    const seloPerfil=peladeiroSeloPerfil(j);
    const apelidoLen=apelido.length;
    const apelidoSize=apelidoLen>13?'xlong':apelidoLen>10?'long':apelidoLen>7?'medium':'short';
    const social=insta ? `<div class="peladeiro-social">
        <a class="peladeiro-social-link peladeiro-social-instagram" href="https://instagram.com/${encodeURIComponent(insta)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir Instagram de ${escHtml(apelido)}"><i class="ti ti-brand-instagram"></i><span>@${escHtml(insta)}</span></a>
      </div>` : '';
    const expandido=String(j.id)===peladeiroExpandidoId;
    const detalhe=expandido ? peladeiroFichaExpandidaCard(j) : '';
    if(expandido){
      return `<div class="peladeiro-card-wrap is-expanded" data-peladeiro-id="${escHtml(String(j.id||''))}">
        ${detalhe}
      </div>`;
    }
    return `<div class="peladeiro-card-wrap" data-peladeiro-id="${escHtml(String(j.id||''))}">
      <button class="peladeiro-card peladeiro-card-${tema} peladeiro-pos-${posClasse} peladeiro-name-${apelidoSize}" type="button" onclick="togglePeladeiroExpandido('${escHtml(String(j.id||''))}')">
      <div class="peladeiro-sash"></div>
      <span class="peladeiro-avatar" data-url="${escHtml(j.foto_url||'')}" onclick="event.stopPropagation();${zoom}" title="${j.foto_url?'Ampliar foto':'Sem foto cadastrada'}">${foto}</span>
      <div class="peladeiro-info">
        <div class="peladeiro-topline">${isAniversarianteMes(j) ? `<span class="peladeiro-birthday-label"><i class="ti ti-crown"></i> ANIVERSARIANTE</span>` : ''}</div>
        <div class="peladeiro-name" title="${escHtml(apelido)}">${escHtml(apelido)}</div>
        <div class="peladeiro-real-name">${linhaNome}</div>
        <div class="peladeiro-meta">
          <span class="peladeiro-chip peladeiro-chip-pos">${posAbrev}</span>
          <span class="peladeiro-chip peladeiro-chip-mod"><i class="ti ti-crown"></i> ${modalidade}</span>
          ${seloPerfil}
        </div>
        ${social}
      </div>
      </button>
    </div>`;
  }).join('');
  if(peladeiroExpandidoId){
    const expandedEl=[...el.querySelectorAll('[data-peladeiro-id]')].find(node => node.getAttribute('data-peladeiro-id')===String(peladeiroExpandidoId));
    if(expandedEl){
      requestAnimationFrame(()=>expandedEl.scrollIntoView({block:'nearest', behavior:'smooth'}));
    }
  }
}

async function abrirJogador(id, destino='conf'){
  if(typeof carregarBaseAppSeNecessario==='function') await carregarBaseAppSeNecessario(true);
  G.pelada=G.peladas.find(p=>String(p.id)===String(id));
  if(!G.pelada){
    showToast('Nao foi possivel localizar a pelada.');
    return;
  }
  if(peladaEncerrada(G.pelada) || deveEncerrarAutomaticamente(G.pelada)){
    if(encerradaAntesDoJogo(G.pelada)){
      abrirTelaJogadorPorDestino('times');
    } else {
      abrirResumoPublico(id);
    }
    return;
  }
  abrirTelaJogadorPorDestino(destino);
}

// ==========================================
// JOGADOR - CONFIRMAR
// ==========================================
async function renderJConf(){
  const p=G.pelada;
  if(!p){ showToast('Selecione uma pelada primeiro!'); voltarLista(); return; }
  p.espera=p.espera||[];
  p.naoVao=p.naoVao||[];
  p.confirmados=p.confirmados||[];

  if(!G.jogadores || !G.jogadores.length) await _buscarJogadoresCadastrados();

  const confJogo = p.temChurras ? p.confirmados.filter(j=>j.churras==='jogo'||j.churras==='jogo_churras') : p.confirmados;
  const confSoChurras = p.temChurras ? p.confirmados.filter(j=>j.churras==='churras') : [];
  const churrasTotal = p.temChurras ? p.confirmados.filter(j=>j.churras==='churras'||j.churras==='jogo_churras').length : 0;
  const foraTotal = p.naoVao.length;
  const confTotal = totalJogadoresConfirmados(p);

  const hero = document.querySelector('#s-j-conf .aconf-hero');
  if(hero){
    const dataObj = p.data ? new Date(p.data+'T12:00:00') : null;
    const dia = dataObj ? dataObj.toLocaleDateString('pt-BR',{day:'2-digit'}) : '--';
    const mes = dataObj ? dataObj.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase() : '---';
    const semana = dataObj ? dataObj.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','').toUpperCase() : '---';
    const aberta = peladaEncerrada(p) ? 'ENCERRADA' : 'ABERTA';
    hero.innerHTML = `
      <div class="conf-hero-card">
        <div class="conf-date-box"><span>${semana}</span><b>${dia}</b><small>${mes}</small></div>
        <div class="conf-event-info">
          <h2>${escHtml(p.nome || 'Pelada')}</h2>
          <div class="conf-event-meta"><span><i class="ti ti-clock"></i>${escHtml(p.hora||'--:--')}</span><span><i class="ti ti-map-pin"></i>${escHtml(p.local||'')}</span></div>
          <span class="conf-status-pill">${aberta}</span>
        </div>
        <div class="conf-total-box"><b>${confTotal}</b><span>/ ${p.max||14}</span></div>
      </div>`;
  }
  const oldHeroName = document.getElementById('jc-nome-hero'); if(oldHeroName) oldHeroName.textContent=p.nome;
  const oldHeroMeta = document.getElementById('jc-meta-hero'); if(oldHeroMeta) oldHeroMeta.innerHTML=`${fmtData(p.data)}<br>${p.hora}<br>${p.local}`;
  const oldConf = document.getElementById('jc-conf'); if(oldConf) oldConf.textContent=confTotal;
  const oldCount = document.getElementById('jc-count'); if(oldCount) oldCount.textContent=p.max||14;

  const inp = document.getElementById('jc-input');
  const btnCancelar = document.getElementById('btn-cancelar');
  const confRemota = await _buscarConfirmacaoExistente(p.id);
  const jaConf = confRemota && confRemota.status === 'confirmado'
    ? {
        ...confRemota,
        pos: confRemota.posicao || confRemota.pos || '?',
        churras: confRemota.churras || null,
      }
    : confirmacaoAtualNaPelada(p);
  const nomeLogado = apelidoJogadorLogado();
  const aliases = aliasesJogadorLogado();
  const jaFora = (confRemota && confRemota.status === 'nao_vai')
    ? confRemota
    : (p.naoVao||[]).find(j =>
    (G.jogadorLogado?.id && String(j.jogador_id||'')===String(G.jogadorLogado.id)) ||
    aliases.includes(normNome(j.nome))
  );
  const estadoAtual = jaConf ? (jaConf.churras || 'jogo') : (jaFora ? 'fora' : null);

  if(inp){
    if(!G.usuario || !G.jogadorLogado){
      inp.value = '';
      inp.placeholder = 'Faça login para confirmar';
      inp.disabled = true;
    } else {
      inp.value = jaConf ? jaConf.nome : nomeLogado;
      inp.disabled = true;
    }
  }

  const card = document.querySelector('#s-j-conf .card');
  if(card){
    const nome = jaConf?.nome || jaFora?.nome || nomeLogado || '—';
    const statusLabel = estadoAtual === 'jogo_churras' ? 'JOGO + CHURRAS' : estadoAtual === 'churras' ? 'SÓ CHURRAS' : estadoAtual === 'jogo' ? 'CONFIRMADO' : estadoAtual === 'fora' ? 'FORA' : 'SEM CONFIRMAÇÃO';
    const statusIcon = estadoAtual === 'jogo_churras' ? '<i class="ti ti-shirt"></i><i class="ti ti-grill"></i>' : estadoAtual === 'churras' ? '<i class="ti ti-grill"></i>' : estadoAtual === 'jogo' ? '<i class="ti ti-shirt"></i>' : estadoAtual === 'fora' ? '<i class="ti ti-circle-minus"></i>' : '<i class="ti ti-user-question"></i>';
    const statusClass = estadoAtual === 'fora' ? 'is-out' : estadoAtual === 'churras' ? 'is-bbq' : estadoAtual ? 'is-in' : 'is-empty';
    card.classList.add('conf-card');
    card.innerHTML = `
      <div class="conf-mini-dashboard">
        <div class="conf-mini-stat is-game"><i class="ti ti-shirt"></i><b>${confTotal}</b><span>JOGO</span></div>
        ${p.temChurras ? `<div class="conf-mini-stat is-bbq"><i class="ti ti-grill"></i><b>${churrasTotal}</b><span>CHURRAS</span></div>` : `<div class="conf-mini-stat is-wait"><i class="ti ti-users"></i><b>${Math.max((p.max||14)-confTotal,0)}</b><span>VAGAS</span></div>`}
        <div class="conf-mini-stat is-out"><i class="ti ti-circle-minus"></i><b>${foraTotal}</b><span>FORA</span></div>
      </div>
      <div class="conf-self-box">
        <div class="conf-self-avatar">${escHtml((nome||'?')[0]).toUpperCase()}</div>
        <div class="conf-self-main">
          <div class="conf-self-kicker">MINHA CONFIRMAÇÃO</div>
          <div class="conf-self-name-row">
            <div class="conf-self-name">${escHtml(nome)}</div>
            <div class="conf-current-pill ${statusClass}">${statusIcon}<span>${statusLabel}</span></div>
          </div>
        </div>
      </div>
      <div class="conf-action-grid ${p.temChurras ? 'has-churras' : ''}">
        <button class="conf-action-btn ${estadoAtual==='jogo' || (!p.temChurras && estadoAtual) ? 'selected' : ''}" onclick="jogadorVai('${p.temChurras ? 'jogo' : ''}')"><i class="ti ti-shirt"></i><span>JOGO</span></button>
        ${p.temChurras ? `<button class="conf-action-btn selected-yellow ${estadoAtual==='jogo_churras' ? 'selected' : ''}" onclick="jogadorVai('jogo_churras')"><span class="dual-icons"><i class="ti ti-shirt"></i><i class="ti ti-grill"></i></span><span>JOGO + CHURRAS</span></button>
        <button class="conf-action-btn is-bbq ${estadoAtual==='churras' ? 'selected' : ''}" onclick="jogadorVai('churras')"><i class="ti ti-grill"></i><span>SÓ CHURRAS</span></button>` : ''}
        <button class="conf-action-btn is-out ${estadoAtual==='fora' ? 'selected' : ''}" onclick="jogadorNaoVai()"><i class="ti ti-circle-minus"></i><span>FORA</span></button>
      </div>
      <button id="btn-cancelar" class="conf-cancel-btn" onclick="jogadorCancelar()"><i class="ti ti-user-x"></i> Cancelar presença / ficar fora</button>`;
  }

  const el=document.getElementById('jc-lista');
  const _jogCad = (j) => (G.jogadores||[]).find(jj=>
    (j.jogador_id && String(jj.id)===String(j.jogador_id)) ||
    normNome(jj.nome)===normNome(j.nome) ||
    normNome(jj.apelido||'')===normNome(j.nome)
  ) || null;
  const posicao = (j) => {
    const pos = _jogCad(j)?.posicao || _jogCad(j)?.pos || j.posicao || j.pos || '';
    return pos === '?' ? 'POS' : escHtml(pos);
  };
  const avatarLetra = (j) => escHtml((j.nome||'?')[0]).toUpperCase();
  const anivBadge = (j) => { const jc=_jogCad(j); return (jc && isAniversarianteMes(jc)) ? '<span class="conf-birthday-badge" title="Aniversariante"><i class="ti ti-crown"></i></span>' : ''; };
  const badgeModalidade = (j) => resolveModalidadeConfirmacao(j, _jogCad(j))==='mensalista'
    ? '<span class="conf-player-badge is-monthly"><i class="ti ti-wallet"></i> MENSALISTA</span>'
    : '<span class="conf-player-badge is-avulso"><i class="ti ti-user"></i> AVULSO</span>';
  const badges = (j, tipo) => {
    if(tipo === 'fora') return badgeModalidade(j)+'<span class="conf-player-badge is-out"><i class="ti ti-x"></i> FORA</span>';
    if(tipo === 'churras') return badgeModalidade(j)+'<span class="conf-player-badge is-bbq"><i class="ti ti-grill"></i> CHURRAS</span>';
    let html = badgeModalidade(j)+'<span class="conf-player-badge is-game"><i class="ti ti-shirt"></i> JOGO</span>';
    if(j.churras === 'jogo_churras') html += '<span class="conf-player-badge is-bbq"><i class="ti ti-grill"></i> CHURRAS</span>';
    return html;
  };
  const precisaQuebrarLinha = (j, tipo='jogo') => p.temChurras && (tipo === 'jogo' || tipo === 'churras') && (
    tipo === 'churras' || j.churras === 'jogo_churras'
  );
  const row = (j, tipo='jogo') => `<div class="conf-player-row${precisaQuebrarLinha(j,tipo) ? ' conf-player-row--stacked' : ''}">
    <div class="conf-player-avatar">${avatarLetra(j)}</div>
    <div class="conf-player-info"><div class="conf-player-name-line"><span class="conf-player-name">${escHtml(j.nome)}</span>${anivBadge(j)}</div>${posicao(j) ? `<div class="conf-player-pos">${posicao(j)}</div>` : ''}</div>
    <div class="conf-player-badges${precisaQuebrarLinha(j,tipo) ? ' conf-player-badges--stacked' : ''}">${badges(j,tipo)}</div>
  </div>`;
  const section = (title, icon, count, cls, rows) => `<div class="conf-list-section ${cls}"><div class="conf-section-title"><i class="ti ${icon}"></i><span>${title} (${count})</span></div><div class="conf-list-card">${rows}</div></div>`;
  let html='';
  if(confJogo.length) html += section('CONFIRMADOS - JOGO','ti-users',confJogo.length,'is-game',confJogo.map(j=>row(j,'jogo')).join(''));
  else html += '<div class="empty conf-empty"><i class="ti ti-users"></i>Nenhuma confirmação ainda</div>';
  if(confSoChurras.length) html += section('SÓ CHURRAS','ti-grill',confSoChurras.length,'is-bbq',confSoChurras.map(j=>row(j,'churras')).join(''));
  if(p.espera.length) html += section('LISTA DE ESPERA','ti-hourglass',p.espera.length,'is-wait',p.espera.map(j=>row(j,'espera')).join(''));
  if(p.naoVao.length) html += section('FORA','ti-circle-minus',p.naoVao.length,'is-out',p.naoVao.map(j=>row(j,'fora')).join(''));
  el.innerHTML=html;
}

// ==========================================
// CONFIRMAÇÃO — lógica central (upsert)
// ==========================================

/**
 * Busca confirmação existente do jogador logado nesta pelada.
 * Prioriza busca por jogador_id, depois por apelido normalizado.
 */
async function _buscarConfirmacaoExistente(peladaId){
  try{
    const rows = await sbFetch(`/confirmacoes?pelada_id=eq.${peladaId}&order=created_at.asc`);
    if(rows && rows.length){
      const jogadorId = G.jogadorLogado?.id || null;
      const aliases = aliasesJogadorLogado();
      if(jogadorId){
        const porId = rows.find(r => String(r.jogador_id || '') === String(jogadorId));
        if(porId) return porId;
      }
      if(aliases.length){
        const porNome = rows.find(r => aliases.includes(normNome(r.nome)));
        if(porNome) return porNome;
      }
    }
  }catch(e){}
  return null;
}

async function jogadorVaiImpl(churrasOpt){
  if(bloquearSeEncerrada('Partida encerrada. Não é mais possível confirmar presença.')) return;
  const p=G.pelada;
  const nome=nomeConfirmacaoEfetivo();
  if(!nome){ showToast('Faça login para confirmar presença.'); return; }

  const churrasVal = p.temChurras ? (churrasOpt||'jogo') : null;

  showToast('Confirmando...');
  try{
    // Upsert: busca se já existe qualquer registro deste jogador nesta pelada
    const existente = await _buscarConfirmacaoExistente(p.id);
    const jaOcupaVaga = !!(existente && existente.status === 'confirmado' && existente.churras !== 'churras');
    const vaiParaEspera = churrasVal !== 'churras' && peladaLotada(p) && !jaOcupaVaga;

    if(existente){
      if(existente.status === 'espera'){
        showToast('Você já está na lista de espera! ⏳');
        renderJConf();
        return;
      }
      if(existente.status === 'confirmado'){
        const churrasAtual = existente.churras || null;
        // Mesma modalidade — bloqueia
        if(churrasAtual === churrasVal){
          showToast('Você já está confirmado nesta modalidade! ✅');
          renderJConf();
          return;
        }
        // Modalidade diferente — pede confirmação
        const labelDe = churrasAtual === 'jogo_churras' ? 'Jogo + Churras' : churrasAtual === 'churras' ? 'Só Churras' : 'Jogo';
        const labelPara = churrasVal === 'jogo_churras' ? 'Jogo + Churras' : churrasVal === 'churras' ? 'Só Churras' : churrasVal === null ? 'Jogo' : 'Jogo';
        const confirmar = confirm(`Você está confirmado como "${labelDe}".\nDeseja mudar para "${labelPara}"?`);
        if(!confirmar){ renderJConf(); return; }
      }
      // Status "nao_vai" ou mudança de modalidade confirmada — atualiza
      const novoStatus = vaiParaEspera ? 'espera' : 'confirmado';
      await dbAtualizar(existente.id, {
        status: novoStatus,
        nome: nome,
        churras: churrasVal,
        jogador_id: G.jogadorLogado?.id || existente.jogador_id || null,
        modalidade: resolveModalidadeConfirmacao({ ...existente, jogador_id: G.jogadorLogado?.id || existente.jogador_id || null, nome }),
        pago: existente.pago || false,
        time: novoStatus === 'confirmado' ? (existente.time || 'pool') : 'pool',
      });

      // Atualiza estado local — remove da posição antiga e coloca na nova
      p.confirmados = p.confirmados.filter(j=>j.id!==existente.id);
      p.jogadores   = p.jogadores.filter(j=>j.id!==existente.id);
      p.espera      = (p.espera||[]).filter(j=>j.id!==existente.id);
      p.naoVao      = (p.naoVao||[]).filter(j=>j.id!==existente.id);

      const atualizado = {
        id: existente.id,
        jogador_id: G.jogadorLogado?.id || null,
        nome, pos: existente.posicao || existente.pos || '?',
        time: novoStatus === 'confirmado' ? (existente.time || 'pool') : 'pool',
        pago: existente.pago || false,
        modalidade: resolveModalidadeConfirmacao({ ...existente, jogador_id: G.jogadorLogado?.id || existente.jogador_id || null, nome }),
        churras: churrasVal,
      };
      if(vaiParaEspera){
        p.espera.push(atualizado);
      } else {
        p.confirmados.push(atualizado);
        if(churrasVal !== 'churras') p.jogadores.push({...atualizado});
      }
    } else {
      // Não existe — insere novo
      const _posIns=G.jogadorLogado?.posicao_favorita||null;
      const row = await dbConfirmar(p.id, nome, churrasVal, vaiParaEspera ? 'espera' : 'confirmado', G.jogadorLogado?.id || null, _posIns);
      const novo = {
        id: row.id,
        jogador_id: G.jogadorLogado?.id || null,
        nome, pos: _posIns||'?', time: 'pool',
        pago: false, modalidade: resolveModalidadeConfirmacao({ jogador_id: G.jogadorLogado?.id || null, nome, modalidade: row.modalidade }), churras: churrasVal,
      };
      if(vaiParaEspera){
        p.espera.push(novo);
      } else {
        p.confirmados.push(novo);
        if(churrasVal !== 'churras') p.jogadores.push({...novo});
      }
    }

    showToast(vaiParaEspera ? 'Você entrou na lista de espera!' : 'Presença confirmada!');
    renderJConf();
  }catch(e){ console.error('Erro ao confirmar presença:', e); showToast('Erro ao confirmar.'); }
}

// ==========================================
// PROMOÇÃO AUTOMÁTICA DA LISTA DE ESPERA
// ==========================================
async function _promoverPrimeiroDaEspera(p){
  p.espera = p.espera || [];
  if(!p.espera.length) return;
  if(peladaLotada(p)) return; // vaga preenchida por outro antes de chegar aqui
  const primeiro = p.espera[0];
  try{
    await dbAtualizar(primeiro.id, { status:'confirmado', time:'pool' });
    p.espera.shift();
    p.confirmados.push(primeiro);
    if(primeiro.churras !== 'churras') p.jogadores.push({...primeiro});
    showToast(`${primeiro.nome} saiu da espera e está confirmado! 🎉`);
  }catch(e){ console.warn('Erro ao promover da espera:', e); }
}

async function jogadorNaoVaiImpl(){
  if(bloquearSeEncerrada('Partida encerrada. Não é mais possível alterar presença.')) return;
  const p=G.pelada; p.naoVao=p.naoVao||[]; p.espera=p.espera||[];
  const nome=nomeConfirmacaoEfetivo();
  if(!nome){ showToast('Faça login para registrar ausência.'); return; }

  try{
    const existente = await _buscarConfirmacaoExistente(p.id);
    if(existente){
      await dbAtualizar(existente.id, {status:'nao_vai', pago:false, time:'pool'});
      const eraConfirmado = existente.status === 'confirmado';
      p.confirmados = p.confirmados.filter(j=>j.id!==existente.id);
      p.jogadores   = p.jogadores.filter(j=>j.id!==existente.id);
      p.espera      = p.espera.filter(j=>j.id!==existente.id);
      p.naoVao      = p.naoVao.filter(j=>j.id!==existente.id);
      p.naoVao.push({id:existente.id, nome});
      if(eraConfirmado) await _promoverPrimeiroDaEspera(p);
    } else {
      // Não existe nenhum registro — cria direto como nao_vai
      const rows = await sbFetch('/confirmacoes', {
        method:'POST',
        body: JSON.stringify({
          pelada_id: p.id, nome,
          jogador_id: G.jogadorLogado?.id || null,
          posicao:'?', time:'pool', pago:false,
          modalidade: resolveModalidadeConfirmacao({ jogador_id: G.jogadorLogado?.id || null, nome }),
          status:'nao_vai',
        }),
      });
      p.naoVao.push({id:rows[0].id, nome});
    }
    showToast('Ausência registrada. Até a próxima!');
    renderJConf();
  }catch(e){ showToast('Erro ao registrar ausência.'); }
}

async function jogadorCancelarImpl(){
  if(bloquearSeEncerrada('Partida encerrada. Não é mais possível cancelar presença.')) return;
  const p=G.pelada; p.espera=p.espera||[];
  const nome=nomeConfirmacaoEfetivo();
  if(!nome){ showToast('Faça login para cancelar presença.'); return; }

  try{
    const existente = await _buscarConfirmacaoExistente(p.id);
    if(!existente || existente.status==='nao_vai'){
      showToast('Você não está na lista de confirmados.');
      return;
    }
    await dbAtualizar(existente.id, {status:'nao_vai', pago:false, time:'pool'});
    const eraConf = existente.status === 'confirmado';
    p.confirmados = p.confirmados.filter(j=>j.id!==existente.id);
    p.jogadores   = p.jogadores.filter(j=>j.id!==existente.id);
    p.espera      = p.espera.filter(j=>j.id!==existente.id);
    p.naoVao      = (p.naoVao||[]).filter(j=>j.id!==existente.id);
    p.naoVao.push({id:existente.id, nome:existente.nome||nome});
    if(eraConf) await _promoverPrimeiroDaEspera(p);
    showToast('Confirmação cancelada');
    renderJConf();
  }catch(e){ showToast('Erro ao cancelar.'); }
}

// Wrappers públicos — todos exigem login
async function jogadorVai(churrasOpt){
  if(!(await exigirLoginParaConfirmacao())) return;
  return jogadorVaiImpl(churrasOpt);
}

async function jogadorNaoVai(){
  if(!(await exigirLoginParaConfirmacao())) return;
  return jogadorNaoVaiImpl();
}

async function jogadorCancelar(){
  if(!(await exigirLoginParaConfirmacao())) return;
  return jogadorCancelarImpl();
}

// ==========================================
// JOGADOR - TIMES (leitura)
// ==========================================
async function renderJTimes(){
  const p=G.pelada;
  if(!p){ showToast('Selecione uma pelada primeiro!'); voltarLista(); return; }
  document.getElementById('jt-nome-header').textContent=p.nome;
  document.getElementById('jt-meta-header').innerHTML=`${fmtData(p.data)}<br>${p.hora}<br>${p.local}`;
  const jtConf=document.getElementById('jt-conf'); if(jtConf) jtConf.textContent=totalJogadoresConfirmados(p);
  const jtCount=document.getElementById('jt-count'); if(jtCount) jtCount.textContent=p.max||14;
  const pool=p.jogadores.filter(j=>j.time==='pool');
  const tA=p.jogadores.filter(j=>j.time==='azul');
  const tB=p.jogadores.filter(j=>j.time==='vermelho');
  document.getElementById('jt-cnt-a').textContent=tA.length+' jog.';
  document.getElementById('jt-cnt-b').textContent=tB.length+' jog.';
  document.getElementById('jt-sem-cnt').textContent=pool.length;
  if(!G.jogadores || !G.jogadores.length) await _buscarJogadoresCadastrados();
  const _jc = (j) => (G.jogadores||[]).find(jj=>
    (j.jogador_id && String(jj.id)===String(j.jogador_id)) ||
    normNome(jj.nome)===normNome(j.nome) ||
    normNome(jj.apelido||'')===normNome(j.nome)
  ) || null;
  const bAnivTime = (j) => { const jc=_jc(j); return (jc && isAniversarianteMes(jc)) ? '<span class="lineup-crown-mini" title="Aniversariante"><i class="ti ti-crown"></i></span>' : ''; };
  const bAnivPool = (j) => { const jc=_jc(j); return (jc && isAniversarianteMes(jc)) ? '<span class="lineup-crown-mini" title="Aniversariante"><i class="ti ti-crown"></i></span>' : ''; };
  const posBadgeLineup = (pos, full=false) => {
    const raw=String(pos||'').toUpperCase().trim();
    const map={GOLEIRO:'GOL',GOL:'GOL',ZAGUEIRO:'ZAG',ZAG:'ZAG',LATERAL:'LAT',LAT:'LAT',MEIA:'MEI',MEI:'MEI',ATACANTE:'ATA',ATA:'ATA'};
    const fullName={GOL:'Goleiro',ZAG:'Zagueiro',LAT:'Lateral',MEI:'Meia',ATA:'Atacante'};
    const abbr=map[raw] || null;
    if(!abbr) return `<span class="pos-badge pos-pending">${full?'Posição':'POS'}</span>`;
    return `<span class="pos-badge pos-${abbr}${full?' pos-badge-full':''}">${full ? fullName[abbr] : abbr}</span>`;
  };
  const slot=(j,t)=>`<div class="team-slot"><div class="slot-av ${t==='azul'?'b':'r'}">${escHtml(j.nome[0]||'?').toUpperCase()}</div><span class="slot-name">${escHtml(j.nome)} ${bAnivTime(j)}</span>${posBadgeLineup(j.pos,false)}</div>`;
  document.getElementById('jt-team-a').innerHTML=tA.length?tA.map(j=>slot(j,'azul')).join(''):'<div class="lineup-empty"><i class="ti ti-users"></i> Nenhum jogador</div>';
  document.getElementById('jt-team-b').innerHTML=tB.length?tB.map(j=>slot(j,'vermelho')).join(''):'<div class="lineup-empty"><i class="ti ti-users"></i> Nenhum jogador</div>';
  document.getElementById('jt-pool').innerHTML=pool.length
    ?pool.map(j=>`<div class="pool-item lineup-pool-item"><div class="pool-av">${escHtml(j.nome[0]||'?').toUpperCase()}</div><div class="lineup-pool-main"><span class="lineup-pool-name">${escHtml(j.nome)}</span>${bAnivPool(j)}</div>${posBadgeLineup(j.pos,true)}</div>`).join('')
    :'<div class="lineup-empty"><i class="ti ti-check"></i> Todos escalados!</div>';
}
