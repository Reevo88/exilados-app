// Exilados da Bola
// Fluxo do jogador: lista, confirmacao, times e identidade local
// Extraido de app.js para reduzir o monolito mantendo o comportamento global atual.

// ==========================================
// JOGADOR - LISTA
// ==========================================
function renderJLista(){
  const el=document.getElementById('j-lista');
  if(!G.peladas.length){ el.innerHTML='<div class="empty"><i class="ti ti-ball-football"></i>Nenhuma partida cadastrada</div>'; return; }
  const ord=[...G.peladas].sort((a,b)=>new Date(b.data+'T'+b.hora)-new Date(a.data+'T'+a.hora));

  function camisaSvg(cor){
    if(cor==='azul'){
      return `<svg class="home-shirt-svg" viewBox="0 0 100 110" aria-hidden="true"><defs><clipPath id="clipHomeAzul"><polygon points="0,22 22,0 50,12 78,0 100,22 84,34 84,110 16,110 16,34"/></clipPath></defs><polygon points="0,22 22,0 50,12 78,0 100,22 84,34 84,110 16,110 16,34" fill="#185FA5" stroke="#0C447C" stroke-width="2"/><ellipse cx="50" cy="13" rx="14" ry="9" fill="#FAC775" stroke="#0C447C" stroke-width="1.5"/><rect x="0" y="38" width="100" height="14" fill="#FAC775" clip-path="url(#clipHomeAzul)"/><polygon points="0,22 22,0 28,0 8,26" fill="#FAC775" clip-path="url(#clipHomeAzul)"/><polygon points="78,0 100,22 92,26 72,0" fill="#FAC775" clip-path="url(#clipHomeAzul)"/><text x="50" y="90" text-anchor="middle" font-size="28" font-weight="700" fill="white" font-family="sans-serif">10</text></svg>`;
    }
    return `<svg class="home-shirt-svg" viewBox="0 0 100 110" aria-hidden="true"><defs><clipPath id="clipHomeVerm"><polygon points="0,22 22,0 50,12 78,0 100,22 84,34 84,110 16,110 16,34"/></clipPath></defs><polygon points="0,22 22,0 50,12 78,0 100,22 84,34 84,110 16,110 16,34" fill="#A32D2D" stroke="#791F1F" stroke-width="2"/><ellipse cx="50" cy="13" rx="14" ry="9" fill="#2C2C2A" stroke="#444441" stroke-width="1.5"/><polygon points="16,34 0,34 0,110 28,110 28,34" fill="#2C2C2A" clip-path="url(#clipHomeVerm)"/><polygon points="84,34 100,34 100,110 72,110 72,34" fill="#2C2C2A" clip-path="url(#clipHomeVerm)"/><polygon points="0,22 22,0 28,0 8,26" fill="#2C2C2A" clip-path="url(#clipHomeVerm)"/><polygon points="78,0 100,22 92,26 72,0" fill="#2C2C2A" clip-path="url(#clipHomeVerm)"/><text x="50" y="90" text-anchor="middle" font-size="28" font-weight="700" fill="white" font-family="sans-serif">10</text></svg>`;
  }

  el.innerHTML=ord.map(p=>{
    const ab=pelAdaberta(p);
    const encerrada=!ab;
    const antesDoJogo = encerradaAntesDoJogo(p);
    if(encerrada){
      if(antesDoJogo){
        return `<div class="pelada-card card-encerrada" style="cursor:default;">
          <div class="closed-card-top">
            <div class="closed-left">
              <div class="pelada-icon fechada-icon">
                <img src="icone-1.png" class="pelada-img-icon" alt="" />
              </div>
              <div class="closed-info">
                <div class="pelada-nome closed-title">${escHtml(p.nome)}</div>
                <div class="closed-meta"><i class="ti ti-calendar"></i> ${fmtData(p.data)} · ${p.hora}</div>
                <div class="closed-meta"><i class="ti ti-map-pin"></i> ${escHtml(p.local)}</div>
              </div>
            </div>
            <div class="closed-result">
              <div class="closed-result-title"><i class="ti ti-users"></i> Pelada fechada</div>
              <div style="font-size:12px;color:var(--text2);line-height:1.35;text-align:center;padding:8px 4px;">
                Lista completa. Escalações disponíveis.
              </div>
            </div>
          </div>
          <button id="home-summary-btn-${p.id}" class="closed-highlights-btn" onclick="event.stopPropagation();abrirTimesPublico('${p.id}')"><i class="ti ti-shirt"></i> Ver escalações</button>
        </div>`;
      }
      return `<div class="pelada-card card-encerrada" style="cursor:default;">
        <div class="closed-card-top">
          <div class="closed-left">
            <div class="pelada-icon fechada-icon">
              <img src="icone-1.png" class="pelada-img-icon" alt="" />
            </div>
            <div class="closed-info">
              <div class="pelada-nome closed-title">${escHtml(p.nome)}</div>
              <div class="closed-meta"><i class="ti ti-calendar"></i> ${fmtData(p.data)} · ${p.hora}</div>
              <div class="closed-meta"><i class="ti ti-map-pin"></i> ${escHtml(p.local)}</div>
            </div>
          </div>
          <div class="closed-result">
            <div class="closed-result-title"><i class="ti ti-trophy"></i> Resultado</div>
            <div class="closed-score-line">
              <div class="closed-team closed-team-blue">${camisaSvg('azul')}<span>Azul</span></div>
              <div class="closed-score"><span id="home-gols-a-${p.id}">?</span><b>x</b><span id="home-gols-b-${p.id}">?</span></div>
              <div class="closed-team closed-team-red">${camisaSvg('verm')}<span>Vermelho</span></div>
            </div>
          </div>
        </div>
        <div id="home-btns-${p.id}" class="closed-btns-wrap">
          <button id="home-summary-btn-${p.id}" class="closed-highlights-btn" onclick="event.stopPropagation();abrirResumoPublico('${p.id}')"><i class="ti ti-trophy"></i> Ver resumo</button>
          <button id="home-vot-btn-${p.id}" class="closed-highlights-btn closed-vot-btn" style="display:none;" onclick="event.stopPropagation();tentarVotarHome('${p.id}')"><i class="ti ti-star"></i> <span id="home-vot-label-${p.id}">Avaliar</span></button>
        </div>
      </div>`;
    }
    return `<div class="pelada-card" onclick="abrirJogador('${p.id}')">
      <div style="display:flex;align-items:center;gap:12px;width:100%;">
        <div class="pelada-icon">
          <img src="icone-1.png" class="pelada-img-icon" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:10px;display:block;"/>
        </div>
        <div class="pelada-info" style="flex:1;">
          <div class="pelada-nome">${escHtml(p.nome)}</div>
          <div class="pelada-meta">${fmtData(p.data)} · ${p.hora} · ${escHtml(p.local)}</div>
          <div class="pelada-stats">
            <span class="p-stat"><i class="ti ti-users" style="font-size:11px;"></i> ${p.confirmados.length}/${p.max}</span>
            <span class="badge badge-green" style="font-size:10px;">Aberta</span>
          </div>
        </div>
        <i class="ti ti-chevron-right" style="color:var(--text3);font-size:18px;"></i>
      </div>
    </div>`;
  }).join('');

  ord.filter(p=>!pelAdaberta(p)).forEach(p=>{
    _atualizarBotaoVotacaoHome(p);      // síncrono - não depende do banco
    carregarResultadoCardHome(p.id);    // async - placar/vídeos em background
  });
}

async function carregarResultadoCardHome(peladaId){
  const p = G.peladas.find(x=>String(x.id)===String(peladaId));
  if(encerradaAntesDoJogo(p)) return;
  try{
    const r = await dbGetResultado(peladaId);
    const a   = document.getElementById(`home-gols-a-${peladaId}`);
    const b   = document.getElementById(`home-gols-b-${peladaId}`);
    const btn = document.getElementById(`home-summary-btn-${peladaId}`);
    if(a && b && r){
      a.textContent = r.gols_azul ?? 0;
      b.textContent = r.gols_vermelho ?? 0;
    }
    try{
      const [gols, videos] = await Promise.all([dbGetGols(peladaId), dbGetVideos(peladaId)]);
      const temConteudo = !!r || (Array.isArray(gols) && gols.length) || (Array.isArray(videos) && videos.length);
      if(btn && temConteudo) btn.innerHTML = '<i class="ti ti-trophy"></i> Olho no lance';
    }catch(e){}
  }catch(e){}
}


function tentarVotarHome(id) {
  const p = G.peladas.find(x => String(x.id) === String(id));
  if(!p) return;
  G.pelada = p;

  const nomeSalvo = lsNomeConfirmadoNaPelada(p.id) || lsGetNome();
  const escalados = (p.jogadores && p.jogadores.length) ? p.jogadores : p.confirmados;
  const escalado  = nomeSalvo && escalados.some(j => normNome(j.nome) === normNome(nomeSalvo));

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
  if(!votBtn) return;

  if(votacaoEncerrada(p)){
    // Votação encerrada - mostra botão desabilitado
    votBtn.style.display = '';
    votBtn.disabled = true;
    votBtn.style.opacity = '.5';
    votBtn.style.cursor = 'default';
    if(votLabel) votLabel.textContent = 'Votação encerrada';
    return;
  }

  if(votacaoAberta(p)){
    votBtn.style.display = '';
    votBtn.disabled = false;
    votBtn.style.opacity = '';
    votBtn.style.cursor = '';
    if(lsJaVotou(p.id)){
      votBtn.disabled = true;
      votBtn.style.opacity = '.5';
      votBtn.style.cursor = 'default';
      if(votLabel) votLabel.textContent = 'Já votei';
    } else {
      if(votLabel) votLabel.textContent = 'Avaliar';
    }
    return;
  }

  // Fora da janela - esconde
  votBtn.style.display = 'none';
}

// ==========================================
// IDENTIDADE DO JOGADOR (localStorage)
// ==========================================
const LS_NOME_KEY     = 'exilados_nome';          // nome salvo do dispositivo
const LS_CONF_KEY     = 'exilados_confs';          // { peladaId: nomeConfirmado }

function lsGetNome() {
  return localStorage.getItem(LS_NOME_KEY) || '';
}
function lsSetNome(nome) {
  localStorage.setItem(LS_NOME_KEY, nome);
}
function lsGetConfs() {
  try { return JSON.parse(localStorage.getItem(LS_CONF_KEY) || '{}'); }
  catch(e) { return {}; }
}
function lsRegistrarConf(peladaId, nome) {
  const confs = lsGetConfs();
  confs[String(peladaId)] = nome;
  localStorage.setItem(LS_CONF_KEY, JSON.stringify(confs));
}
function lsLimparConf(peladaId) {
  const confs = lsGetConfs();
  delete confs[String(peladaId)];
  localStorage.setItem(LS_CONF_KEY, JSON.stringify(confs));
}
function lsNomeConfirmadoNaPelada(peladaId) {
  return lsGetConfs()[String(peladaId)] || null;
}

function abrirJogador(id){
  G.pelada=G.peladas.find(p=>String(p.id)===String(id));
  if(peladaEncerrada(G.pelada) || deveEncerrarAutomaticamente(G.pelada)){
    if(encerradaAntesDoJogo(G.pelada)){
      renderJTimes();
      goTo('s-j-times');
    } else {
      abrirResumoPublico(id);
    }
    return;
  }
  renderJConf();
  goTo('s-j-conf');
}

// ==========================================
// JOGADOR - CONFIRMAR
// ==========================================
function renderJConf(){
  const p=G.pelada;
  if(!p){ showToast('Selecione uma pelada primeiro!'); goTo('s-j-lista'); renderJLista(); return; }
  document.getElementById('jc-nome-hero').textContent=p.nome;
  document.getElementById('jc-meta-hero').innerHTML=`${fmtData(p.data)}<br>${p.hora}<br>${p.local}`;
  document.getElementById('jc-conf').textContent=p.confirmados.length;
  document.getElementById('jc-count').textContent=p.max||14;

  const inp = document.getElementById('jc-input');

  // Prioridade: já confirmado nesta pelada > nome do localStorage > G.meuNome
  const nomeConfirmado = lsNomeConfirmadoNaPelada(p.id);
  const jaConf = nomeConfirmado && p.confirmados.find(j=>normNome(j.nome)===normNome(nomeConfirmado));

  if(jaConf){
    G.meuNome = jaConf.nome;
    inp.value = jaConf.nome;
  } else {
    const nomeSalvo = G.isAdm ? (G.meuNome || '') : (lsGetNome() || G.meuNome || '');
    inp.value = nomeSalvo;
  }
  inp.disabled = false;

  const el=document.getElementById('jc-lista');
  const confJogo = p.temChurras ? p.confirmados.filter(j=>j.churras==='jogo'||j.churras==='jogo_churras') : p.confirmados;
  const confSoChurras = p.temChurras ? p.confirmados.filter(j=>j.churras==='churras') : [];

  const badgeChurras = (j) => j.churras==='jogo_churras'
    ? ' <span style="background:#fef0e0;color:#c46a00;border:1px solid #f5c87a;border-radius:99px;font-size:11px;font-weight:600;padding:2px 8px;white-space:nowrap;">+ churras</span>'
    : '';
  const confHtml=confJogo.length
    ?confJogo.map(j=>`<div class="player-row"><div class="avatar">${escHtml(j.nome[0]||'?').toUpperCase()}</div><span class="player-name">${escHtml(j.nome)}</span><span class="badge badge-green" style="font-size:10px;"><i class="ti ti-check" style="font-size:10px;"></i> Jogo</span>${badgeChurras(j)}</div>`).join('')
    :'<div class="empty"><i class="ti ti-users"></i>Nenhuma confirmação ainda</div>';

  const soChurrasHtml = confSoChurras.length
    ? `<div style="margin-top:12px;padding-top:10px;border-top:.5px solid var(--border);">
        <div class="section-title" style="margin-bottom:8px;">Só Churras 🍖 (${confSoChurras.length})</div>`
      + confSoChurras.map(j=>`<div class="player-row"><div class="avatar">${escHtml(j.nome[0]||'?').toUpperCase()}</div><span class="player-name">${escHtml(j.nome)}</span><span class="badge badge-green" style="font-size:10px;">🍖 Churras</span></div>`).join('')
      + `</div>` : '';

  const naoVao=p.naoVao||[];
  const naoVaoHtml=naoVao.length
    ?`<div style="margin-top:10px;padding-top:10px;border-top:.5px solid var(--border);">`
    +naoVao.map(j=>`<div class="player-row"><div class="avatar" style="background:var(--danger-bg);color:var(--danger-text);">${escHtml(j.nome[0]||'?').toUpperCase()}</div><span class="player-name">${escHtml(j.nome)}</span><span class="badge badge-red" style="font-size:10px;"><i class="ti ti-x" style="font-size:10px;"></i> Não vai</span></div>`).join('')
    +`</div>`
    :'';
  el.innerHTML=confHtml+soChurrasHtml+naoVaoHtml;

  // Botões de confirmação: redesenhar se tem churras
  const btnArea = document.querySelector('#s-j-conf .card');
  if(btnArea && p.temChurras){
    const btnDiv = btnArea.querySelector('div[style*="display:flex;gap:8px"]');
    if(btnDiv){
      btnDiv.innerHTML=`
        <button class="btn" style="flex:1;background:#111;color:#fff;margin:0;font-weight:700;font-size:13px;" onclick="jogadorVai('jogo')"><i class="ti ti-ball-football"></i> Jogo</button>
        <button class="btn" style="flex:1;background:#1a3ecf;color:#fff;margin:0;font-weight:700;font-size:13px;" onclick="jogadorVai('jogo_churras')"><i class="ti ti-fire"></i> Jogo+🍖</button>
        <button class="btn" style="flex:1;background:#fef0e0;color:#c46a00;border:1px solid #f5c87a;margin:0;font-weight:700;font-size:13px;" onclick="jogadorVai('churras')">Só 🍖</button>
        <button class="btn" style="flex:1;background:#fde8e8;color:#c0392b;border:1px solid #f5c6c6;margin:0;font-weight:700;font-size:13px;" onclick="jogadorNaoVai()"><i class="ti ti-x"></i> Fora</button>`;
    }
  } else if(btnArea && !p.temChurras){
    const btnDiv = btnArea.querySelector('div[style*="display:flex;gap:8px"]');
    if(btnDiv){
      btnDiv.innerHTML=`
        <button class="btn" style="flex:1;background:#111;color:#fff;margin:0;font-weight:700;" onclick="jogadorVai(null)"><i class="ti ti-check"></i> TÔ DENTRO</button>
        <button class="btn" style="flex:1;background:#fde8e8;color:#c0392b;border:1px solid #f5c6c6;margin:0;font-weight:700;" onclick="jogadorNaoVai()"><i class="ti ti-x"></i> TÔ FORA</button>`;
    }
  }
}

async function jogadorVai(churrasOpt){
  if(bloquearSeEncerrada('Partida encerrada. Não é mais possível confirmar presença.')) return;
  const p=G.pelada;
  const nome=document.getElementById('jc-input').value.trim();
  if(!nome){ document.getElementById('jc-input').focus(); return; }

  // Bloqueio: dispositivo já confirmou outro nome nesta pelada (ignora se ADM)
  if(!G.isAdm){
    const nomeConf = lsNomeConfirmadoNaPelada(p.id);
    if(nomeConf && normNome(nomeConf) !== normNome(nome)){
      showToast(`Este dispositivo já confirmou "${nomeConf}" nesta pelada.`);
      document.getElementById('jc-input').value = nomeConf;
      return;
    }
  }

  if(p.confirmados.find(j=>normNome(j.nome)===normNome(nome))){ showToast('Você já está confirmado!'); return; }
  if(p.confirmados.length>=p.max){ showToast('Pelada lotada!'); return; }
  const churrasVal = p.temChurras ? (churrasOpt||'jogo') : null;
  showToast('Confirmando...');
  try{
    const row=await dbConfirmar(p.id,nome,churrasVal);
    const novo={id:row.id,nome,pos:'?',time:'pool',pago:false,modalidade:'avulso',churras:churrasVal};
    p.confirmados.push(novo); p.jogadores.push({...novo});
    G.meuNome=nome;
    // Salva identidade no dispositivo
    if(!G.isAdm){
      lsSetNome(nome);
      lsRegistrarConf(p.id, nome);
    }
    showToast('Presença confirmada! ⚽');
    renderJConf();
  }catch(e){ showToast('Erro ao confirmar.'); }
}

async function jogadorNaoVai(){
  if(bloquearSeEncerrada('Partida encerrada. Não é mais possível alterar presença.')) return;
  const p=G.pelada; p.naoVao=p.naoVao||[];
  const nome=document.getElementById('jc-input').value.trim();
  if(!nome){ document.getElementById('jc-input').focus(); return; }
  if(p.naoVao.find(j=>normNome(j.nome)===normNome(nome))){ showToast('Ausência já registrada!'); return; }
  const conf=p.confirmados.find(j=>normNome(j.nome)===normNome(nome));
  if(conf){
    try{
      await dbAtualizar(conf.id,{status:'nao_vai',pago:false,time:'pool'});
      p.confirmados=p.confirmados.filter(j=>j.id!==conf.id);
      p.jogadores=p.jogadores.filter(j=>j.id!==conf.id);
      p.naoVao.push({id:conf.id,nome});
      if(!G.isAdm) lsLimparConf(p.id);
    }catch(e){}
  } else {
    try{
      const rows=await sbFetch('/confirmacoes',{method:'POST',body:JSON.stringify({pelada_id:p.id,nome,posicao:'?',time:'pool',pago:false,modalidade:'avulso',status:'nao_vai'})});
      p.naoVao.push({id:rows[0].id,nome});
    }catch(e){}
  }
  showToast('Ausência registrada. Até a próxima!');
  renderJConf();
}

async function jogadorCancelar(){
  if(bloquearSeEncerrada('Partida encerrada. Não é mais possível cancelar presença.')) return;
  const p=G.pelada;
  const nome=G.meuNome||document.getElementById('jc-input').value.trim();
  if(!nome){ document.getElementById('jc-input').focus(); showToast('Digite seu nome primeiro para cancelar.'); return; }
  const conf=p.confirmados.find(j=>normNome(j.nome)===normNome(nome));
  if(!conf){ showToast('Esse nome não está na lista de confirmados.'); return; }
  try{
    await dbAtualizar(conf.id,{status:'nao_vai',pago:false,time:'pool'});
    p.confirmados=p.confirmados.filter(j=>j.nome!==conf.nome);
    p.jogadores=p.jogadores.filter(j=>j.nome!==conf.nome);
    p.naoVao.push({id:conf.id,nome:conf.nome});
    G.meuNome='';
    document.getElementById('jc-input').value=lsGetNome(); // mantém nome salvo, limpa só o bloqueio da pelada
    document.getElementById('jc-input').disabled=false;
    if(!G.isAdm) lsLimparConf(p.id);
    showToast('Confirmação cancelada');
    renderJConf();
  }catch(e){ showToast('Erro ao cancelar.'); }
}


// ==========================================
// JOGADOR - TIMES (leitura)
// ==========================================
function renderJTimes(){
  const p=G.pelada;
  if(!p){ showToast('Selecione uma pelada primeiro!'); goTo('s-j-lista'); renderJLista(); return; }
  document.getElementById('jt-nome-header').textContent=p.nome;
  document.getElementById('jt-meta-header').innerHTML=`${fmtData(p.data)}<br>${p.hora}<br>${p.local}`;
  const pool=p.jogadores.filter(j=>j.time==='pool');
  const tA=p.jogadores.filter(j=>j.time==='azul');
  const tB=p.jogadores.filter(j=>j.time==='vermelho');
  document.getElementById('jt-cnt-a').textContent=tA.length+' jog.';
  document.getElementById('jt-cnt-b').textContent=tB.length+' jog.';
  document.getElementById('jt-sem-cnt').textContent=pool.length;
  const slot=(j,t)=>`<div class="team-slot"><div class="slot-av ${t==='azul'?'b':'r'}">${escHtml(j.nome[0]||'?').toUpperCase()}</div><span class="slot-name">${escHtml(j.nome)}</span>${posBadge(j.pos)}</div>`;
  document.getElementById('jt-team-a').innerHTML=tA.length?tA.map(j=>slot(j,'azul')).join(''):'<div style="padding:8px;font-size:12px;color:var(--text3);">Nenhum jogador</div>';
  document.getElementById('jt-team-b').innerHTML=tB.length?tB.map(j=>slot(j,'vermelho')).join(''):'<div style="padding:8px;font-size:12px;color:var(--text3);">Nenhum jogador</div>';
  document.getElementById('jt-pool').innerHTML=pool.length
    ?pool.map(j=>`<div class="pool-item"><div class="pool-av">${escHtml(j.nome[0]||'?').toUpperCase()}</div><span style="flex:1;font-size:13px;font-weight:500;">${escHtml(j.nome)}</span>${posBadge(j.pos)}</div>`).join('')
    :'<div style="padding:8px;font-size:12px;color:var(--text3);">Todos escalados!</div>';
}

