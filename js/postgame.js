// Exilados da Bola
// Pos-jogo, placar, gols, videos e resumo publico
// Extraido de app.js para reduzir o monolito mantendo o comportamento global atual.

// ==========================================
// PÓS-JOGO - DB HELPERS
// ==========================================

async function dbGetResultado(peladaId){
  const r = await sbFetch(`/resultados_pelada?pelada_id=eq.${peladaId}&limit=1`);
  return Array.isArray(r) && r.length ? r[0] : null;
}

async function dbSalvarResultado(peladaId, azul, verm){
  const existe = await dbGetResultado(peladaId);
  if(existe){
    await sbFetch(`/resultados_pelada?id=eq.${existe.id}`,{
      method:'PATCH',
      body:JSON.stringify({gols_azul:azul, gols_vermelho:verm, updated_at:new Date().toISOString()})
    });
  } else {
    await sbFetch('/resultados_pelada',{
      method:'POST',
      body:JSON.stringify({pelada_id:peladaId, gols_azul:azul, gols_vermelho:verm})
    });
  }
}

async function dbGetGols(peladaId){
  return await sbFetch(`/gols_pelada?pelada_id=eq.${peladaId}&order=quantidade.desc`);
}

async function dbAdicionarGol(data){
  const r = await sbFetch('/gols_pelada',{method:'POST', body:JSON.stringify(data)});
  return Array.isArray(r) ? r[0] : r;
}

async function dbRemoverGol(id){
  await sbFetch(`/gols_pelada?id=eq.${id}`,{method:'DELETE'});
}

async function dbGetVideos(peladaId){
  return await sbFetch(`/videos_pelada?pelada_id=eq.${peladaId}&order=ordem.asc,created_at.asc`);
}

async function dbSalvarVideo(data){
  const r = await sbFetch('/videos_pelada',{method:'POST', body:JSON.stringify(data)});
  return Array.isArray(r) ? r[0] : r;
}

async function dbRemoverVideo(id){
  await sbFetch(`/videos_pelada?id=eq.${id}`,{method:'DELETE'});
}

// Extrai o ID do YouTube a partir de qualquer formato de URL válido
function extrairYoutubeId(url) {
  try {
    const u = new URL(url.trim());
    // youtu.be/ID
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    // youtube.com/watch?v=ID  ou  youtube.com/shorts/ID  ou  youtube.com/embed/ID
    if (u.hostname.includes('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/\/(?:shorts|embed|v)\/([^/?&]+)/);
      if (m) return m[1];
    }
  } catch(e) {}
  return null;
}

// Monta URL de embed com parâmetros que evitam vazamento para o YouTube
function ytEmbedUrl(videoId, autoplay = false) {
  const params = new URLSearchParams({
    autoplay:        autoplay ? '1' : '0',
    loop:            '0',
    rel:             '0',   // sem vídeos relacionados de outros canais
    modestbranding:  '1',   // logo mínima do YouTube
    controls:        '1',
    playsinline:     '1',
    fs:              '0',   // sem botão fullscreen (evita sair do app)
    iv_load_policy:  '3',   // sem anotações
    disablekb:       '0',
  });
  if (autoplay) params.set('mute', '1'); // autoplay exige muted
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

// ==========================================
// PÓS-JOGO - ESTADO LOCAL
// ==========================================
async function dbGetEstatisticas(peladaId){
  try{
    const r = await sbFetch(`/estatisticas_pelada?pelada_id=eq.${peladaId}`);
    return r || [];
  }catch(e){ return []; }
}
async function dbSalvarEstatistica(peladaId, tipo, nomeJogador){
  // Remove anterior do mesmo tipo se existir
  const exist = await sbFetch(`/estatisticas_pelada?pelada_id=eq.${peladaId}&tipo=eq.${tipo}&limit=1`);
  if(exist && exist.length){
    await sbFetch(`/estatisticas_pelada?id=eq.${exist[0].id}`,{method:'DELETE',prefer:'return=minimal'});
  }
  const r = await sbFetch('/estatisticas_pelada',{method:'POST',body:JSON.stringify({pelada_id:peladaId,tipo,nome_jogador:nomeJogador})});
  return Array.isArray(r) ? r[0] : r;
}
async function dbRemoverEstatistica(peladaId, tipo){
  await sbFetch(`/estatisticas_pelada?pelada_id=eq.${peladaId}&tipo=eq.${tipo}`,{method:'DELETE',prefer:'return=minimal'});
}

let PJ = { resultado:null, gols:[], videos:[], estatisticas:[] };

// ==========================================
// PÓS-JOGO - ABRIR TELA ADM
// ==========================================
async function abrirPosJogo(id){
  const p = G.peladas.find(x=>String(x.id)===String(id));
  if(!p) return;
  G.pelada = p;
  document.getElementById('pj-nome-header').textContent = p.nome;
  document.getElementById('pj-meta-header').textContent = `${fmtData(p.data)} · ${p.hora} · ${p.local}`;
  goTo('s-adm-posjogo');
  const _tituloEl=document.getElementById('pj-video-titulo');
  if(_tituloEl) _tituloEl.value='Melhores Momentos';
  try{
    const [res, gols, videos, estats] = await Promise.all([
      dbGetResultado(p.id),
      dbGetGols(p.id),
      dbGetVideos(p.id),
      dbGetEstatisticas(p.id)
    ]);
    PJ.resultado = res;
    PJ.gols = gols || [];
    PJ.videos = videos || [];
    PJ.estatisticas = estats || [];
    if(res){
      document.getElementById('pj-gols-azul').value = res.gols_azul || 0;
      document.getElementById('pj-gols-verm').value = res.gols_vermelho || 0;
    }
    pjPopularSelect();
    pjRenderGols();
    pjRenderVideos();
    pjRenderEstatisticas();
  }catch(e){ showToast('Erro ao carregar pós-jogo.'); }
}

// Popular selects de jogadores (artilharia, craque, pereba)
function pjPopularSelect(){
  const p = G.pelada;
  const opts = p
    ? '<option value="">Selecione o jogador…</option>' +
      [...p.confirmados].sort((a,b)=>a.nome.localeCompare(b.nome))
        .map(j=>`<option value="${escHtml(j.nome)}">${escHtml(j.nome)}</option>`).join('')
    : '<option value="">Sem pelada selecionada</option>';
  ['pj-gol-jogador','pj-craque-jogador','pj-pereba-jogador'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.innerHTML = opts;
  });
}

// Salvar Placar
async function pjSalvarPlacar(){
  const azul = parseInt(document.getElementById('pj-gols-azul').value)||0;
  const verm = parseInt(document.getElementById('pj-gols-verm').value)||0;
  try{
    await dbSalvarResultado(G.pelada.id, azul, verm);
    PJ.resultado = { ...(PJ.resultado||{}), gols_azul:azul, gols_vermelho:verm };
    if(G.pelada) G.pelada.resultado = { ...(G.pelada.resultado||{}), gols_azul:azul, gols_vermelho:verm };
    const peladaMemoria = (G.peladas||[]).find(p=>String(p.id)===String(G.pelada?.id));
    if(peladaMemoria) peladaMemoria.resultado = { ...(peladaMemoria.resultado||{}), gols_azul:azul, gols_vermelho:verm };
    showToast('Placar salvo!');
  }catch(e){ showToast('Erro ao salvar placar.'); }
}

// Render lista de gols no ADM
function pjRenderGols(){
  const el = document.getElementById('pj-gols-lista');
  if(!PJ.gols.length){
    el.innerHTML='<div class="empty" style="font-size:12px;">Nenhum gol cadastrado</div>';
    return;
  }
  el.innerHTML = PJ.gols.map(g=>`
    <div class="artilheiro-row">
      <span class="artilheiro-nome">${escHtml(g.nome_jogador)}</span>
      <span class="artilheiro-gols">${g.quantidade}<img src="bola-icon.png" alt="" class="artilheiro-gols-icon"/></span>
      <button onclick="pjRemoverGol('${g.id}')" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--red);"><i class="ti ti-x" style="font-size:14px;"></i></button>
    </div>`).join('');
}

// Adicionar Gol
async function pjAdicionarGol(){
  const sel = document.getElementById('pj-gol-jogador');
  const nome = sel.value.trim();
  const qtd = parseInt(document.getElementById('pj-gol-qtd').value)||1;
  if(!nome){ showToast('Selecione um jogador.'); return; }
  try{
    const row = await dbAdicionarGol({ pelada_id:G.pelada.id, nome_jogador:nome, time:'', quantidade:qtd });
    if(row) PJ.gols.push(row);
    PJ.gols.sort((a,b)=>b.quantidade-a.quantidade);
    pjRenderGols();
    sel.value='';
    document.getElementById('pj-gol-qtd').value='1';
    showToast('Gol adicionado!');
  }catch(e){ showToast('Erro ao adicionar gol.'); }
}

// Remover Gol
async function pjRemoverGol(id){
  try{
    await dbRemoverGol(id);
    PJ.gols = PJ.gols.filter(g=>String(g.id)!==String(id));
    pjRenderGols();
    showToast('Removido.');
  }catch(e){ showToast('Erro ao remover.'); }
}

// Render lista de vídeos no ADM
function pjRenderVideos(){
  const el = document.getElementById('pj-videos-lista');
  if(!PJ.videos.length){
    el.innerHTML='<div class="empty" style="font-size:12px;">Nenhum vídeo adicionado</div>';
    return;
  }
  el.innerHTML = PJ.videos.map(v=>`
    <div class="pj-video-item">
      <i class="ti ti-brand-youtube" style="font-size:16px;color:#ff0000;flex-shrink:0;"></i>
      <span class="pj-video-nome">${escHtml(v.titulo)}</span>
      <button data-vid-id="${escHtml(String(v.id))}" class="pj-remover-video-btn" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--red);margin-left:auto;"><i class="ti ti-trash" style="font-size:14px;"></i></button>
    </div>`).join('');
  el.querySelectorAll('.pj-remover-video-btn').forEach(btn => {
    btn.addEventListener('click', () => pjRemoverVideo(btn.dataset.vidId));
  });
}

// Adicionar Vídeo por link do YouTube
async function pjAdicionarVideoYoutube(){
  const titulo = document.getElementById('pj-video-titulo').value.trim();
  const linkRaw = document.getElementById('pj-video-link').value.trim();
  if(!titulo){ showToast('Informe o título do vídeo.'); return; }
  if(!linkRaw){ showToast('Cole o link do YouTube.'); return; }
  const ytId = extrairYoutubeId(linkRaw);
  if(!ytId){ showToast('Link do YouTube inválido.'); return; }
  const btn = document.getElementById('pj-btn-upload');
  btn.disabled = true;
  try{
    const row = await dbSalvarVideo({
      pelada_id: G.pelada.id,
      titulo,
      video_url: linkRaw,
      ordem: PJ.videos.length
    });
    if(row) PJ.videos.push(row);
    pjRenderVideos();
    document.getElementById('pj-video-titulo').value='Melhores Momentos';
    document.getElementById('pj-video-link').value='';
    showToast('Vídeo adicionado!');
  }catch(e){
    showToast('Erro ao salvar vídeo.');
  }
  btn.disabled = false;
}

// Remover Vídeo
async function pjRemoverVideo(id){
  try{
    await dbRemoverVideo(id);
    PJ.videos = PJ.videos.filter(v=>String(v.id)!==String(id));
    pjRenderVideos();
    showToast('Vídeo removido.');
  }catch(e){ showToast('Erro ao remover.'); }
}

// Abrir Olho no lance (ADM -> s-resumo)
// Render Craque e Pereba no ADM
function pjRenderEstatisticas(){
  ['craque','pereba'].forEach(tipo => {
    const item = PJ.estatisticas.find(e => e.tipo === tipo);
    const display = document.getElementById(`pj-${tipo}-display`);
    const nomeEl  = document.getElementById(`pj-${tipo}-nome`);
    const sel     = document.getElementById(`pj-${tipo}-jogador`);
    if(item){
      if(display) display.style.display = 'flex';
      if(nomeEl)  nomeEl.textContent = item.nome_jogador;
      if(sel)     sel.value = item.nome_jogador;
    } else {
      if(display) display.style.display = 'none';
      if(sel)     sel.value = '';
    }
  });
}

// Salvar Craque ou Pereba
async function pjSalvarEstat(tipo){
  const sel = document.getElementById(`pj-${tipo}-jogador`);
  const nome = sel ? sel.value.trim() : '';
  if(!nome){ showToast('Selecione um jogador.'); return; }
  try{
    const row = await dbSalvarEstatistica(G.pelada.id, tipo, nome);
    PJ.estatisticas = PJ.estatisticas.filter(e => e.tipo !== tipo);
    if(row) PJ.estatisticas.push(row);
    pjRenderEstatisticas();
    showToast(tipo === 'craque' ? 'Craque salvo!' : 'Pereba salvo!');
  }catch(e){ showToast('Erro ao salvar.'); }
}

// Remover Craque ou Pereba
async function pjRemoverEstat(tipo){
  try{
    await dbRemoverEstatistica(G.pelada.id, tipo);
    PJ.estatisticas = PJ.estatisticas.filter(e => e.tipo !== tipo);
    pjRenderEstatisticas();
    showToast('Removido.');
  }catch(e){ showToast('Erro ao remover.'); }
}

function pjVerResumo(){
  renderResumo(G.pelada.id, PJ);
  goTo('s-resumo');
}

// ==========================================
// RESUMO PÚBLICO
// ==========================================
// ==========================================
// RESUMO PÚBLICO - ABAS E NAVEGAÇÃO
// ==========================================

function resumoSwitchTab(aba, btn) {
  ['resumo','escalacoes','videos','estatisticas'].forEach(t => {
    const el = document.getElementById('resumo-tab-' + t);
    if(el) el.style.display = (t === aba) ? '' : 'none';
  });
  document.querySelectorAll('#s-resumo .resumo-tab').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}

function _resumoNavAtualizar() {
  const aberta = G.pelada && pelAdaberta(G.pelada);
  ['resumo-nav-conf','resumo-nav-times'].forEach(id => {
    const btn = document.getElementById(id);
    if(btn) btn.classList.toggle('nav-disabled', !aberta);
  });
}

function resumoNavConf() {
  if(!G.pelada || !pelAdaberta(G.pelada)) {
    showToastDanger('Não há partida aberta no momento. Aguarde o presidente abrir a próxima pelada.');
    return;
  }
  renderJConf(); goTo('s-j-conf');
}
function resumoNavTimes() {
  if(!G.pelada || !pelAdaberta(G.pelada)) {
    showToastDanger('Não há partida aberta no momento. Aguarde o presidente abrir a próxima pelada.');
    return;
  }
  renderJTimes(); goTo('s-j-times');
}
function resumoNavCaixa() {
  abrirJCaixa();
}

function abrirVideoPlayer(videoId, titulo) {
  const frame = document.getElementById('vplayer-iframe');
  const titEl = document.getElementById('vplayer-titulo');
  if(titEl) titEl.textContent = titulo || 'Vídeo';
  if(frame) frame.src = ytEmbedUrl(videoId, true);
  goTo('s-video-player');
}
function fecharVideoPlayer() {
  const frame = document.getElementById('vplayer-iframe');
  if(frame) frame.src = '';
  goTo('s-resumo');
}

async function renderResumo(peladaId, pjCache){
  const p = G.peladas.find(x=>String(x.id)===String(peladaId));
  if(!p) return;

  document.getElementById('resumo-titulo').textContent = p.nome.toUpperCase();
  document.getElementById('resumo-data-local').textContent = `${fmtData(p.data)} · ${p.hora} · ${p.local}`;

  // Volta para a aba Resumo e atualiza botões do nav
  resumoSwitchTab('resumo', document.querySelector('#s-resumo .resumo-tab'));
  _resumoNavAtualizar();

  // Botão flutuante ADM
  const admBack = document.getElementById('resumo-adm-back');
  if(admBack) admBack.style.display = 'none';

  // Botão de votação (só para jogadores escalados durante janela aberta)
  _resumoAtualizarBotaoVotacao(p);

  // Busca dados (ou usa cache vindo do ADM)
  let resultado, gols, videos, estats;
  if(pjCache){
    resultado = pjCache.resultado;
    gols      = pjCache.gols;
    videos    = pjCache.videos;
    estats    = pjCache.estatisticas;
  } else {
    try{
      [resultado, gols, videos, estats] = await Promise.all([
        dbGetResultado(peladaId),
        dbGetGols(peladaId),
        dbGetVideos(peladaId),
        dbGetEstatisticas(peladaId)
      ]);
    }catch(e){ resultado=null; gols=[]; videos=[]; estats=[]; }
  }
  gols   = gols   || [];
  videos = videos || [];
  estats = estats || [];

  // -- Placar ------------------------------
  document.getElementById('resumo-gols-azul').textContent = resultado ? (resultado.gols_azul ?? 0) : '\u2013';
  document.getElementById('resumo-gols-verm').textContent = resultado ? (resultado.gols_vermelho ?? 0) : '\u2013';

  // -- Escalações --------------------------
  // Usa p.jogadores (fonte que o ADM atualiza com times e posições)
  // Fallback para p.confirmados se jogadores estiver vazio
  const fonte = (p.jogadores && p.jogadores.length) ? p.jogadores : p.confirmados;
  const timeA = fonte.filter(j => j.time === 'azul');
  const timeB = fonte.filter(j => j.time === 'vermelho');
  const pool  = fonte.filter(j => j.time !== 'azul' && j.time !== 'vermelho');

  function slotJog(j, time) {
    const cor = time === 'azul' ? 'b' : 'r';
    const ini = escHtml((j.nome[0] || '?').toUpperCase());
    const pos = j.pos || '?';
    return `<div class="team-slot"><div class="slot-av ${cor}">${ini}</div><span class="slot-name">${escHtml(j.nome)}</span>${posBadge(pos)}</div>`;
  }
  function slotPool(j) {
    const ini = escHtml((j.nome[0] || '?').toUpperCase());
    return `<div class="pool-item"><div class="pool-av">${ini}</div><span style="flex:1;font-size:13px;font-weight:500;">${escHtml(j.nome)}</span>${posBadge(j.pos||'?')}</div>`;
  }
  function semJogador() {
    return '<div style="padding:8px;font-size:12px;color:var(--text3);">Nenhum jogador</div>';
  }

  // Aba Resumo - escalações (mesmo estilo slot)
  document.getElementById('resumo-team-a').innerHTML = timeA.length ? timeA.map(j => slotJog(j,'azul')).join('') : semJogador();
  document.getElementById('resumo-team-b').innerHTML = timeB.length ? timeB.map(j => slotJog(j,'vermelho')).join('') : semJogador();
  const pw = document.getElementById('resumo-pool-wrap');
  pw.style.display = pool.length ? '' : 'none';
  if(pool.length) document.getElementById('resumo-pool').innerHTML = pool.map(slotPool).join('');

  // Contadores dos cards na aba Resumo
  const resumoCntA = document.getElementById('resumo-cnt-a');
  const resumoCntB = document.getElementById('resumo-cnt-b');
  if(resumoCntA) resumoCntA.textContent = timeA.length + ' jog.';
  if(resumoCntB) resumoCntB.textContent = timeB.length + ' jog.';

  // Aba Escalações - mesma estrutura
  document.getElementById('resumo-esc-a').innerHTML = timeA.length ? timeA.map(j => slotJog(j,'azul')).join('') : semJogador();
  document.getElementById('resumo-esc-b').innerHTML = timeB.length ? timeB.map(j => slotJog(j,'vermelho')).join('') : semJogador();
  const cntA = document.getElementById('resumo-esc-cnt-a');
  const cntB = document.getElementById('resumo-esc-cnt-b');
  if(cntA) cntA.textContent = timeA.length + ' jog.';
  if(cntB) cntB.textContent = timeB.length + ' jog.';
  const escPoolWrap = document.getElementById('resumo-esc-pool-wrap');
  const cntPool = document.getElementById('resumo-esc-cnt-pool');
  if(pool.length) {
    escPoolWrap.style.display = '';
    if(cntPool) cntPool.textContent = pool.length;
    document.getElementById('resumo-esc-pool').innerHTML = pool.map(slotPool).join('');
  } else {
    escPoolWrap.style.display = 'none';
  }

  // -- Artilharia (aba Resumo + aba Estatísticas) --
  const golsCard  = document.getElementById('resumo-gols-card');
  const golsLista = document.getElementById('resumo-gols-lista');
  const statsGols = document.getElementById('resumo-stats-gols');
  const statsLista= document.getElementById('resumo-stats-gols-lista');
  const statsEmpty= document.getElementById('resumo-stats-empty');

  // Top 5 para aba pública
  const top5 = gols.slice(0,5);
  const golsHtml = top5.length
    ? top5.map(g => `
        <div class="artilheiro-row">
          <span class="artilheiro-nome">${escHtml(g.nome_jogador)}</span>
          <span class="artilheiro-gols">${g.quantidade}<img src="bola-icon.png" alt="" class="artilheiro-gols-icon"/></span>
        </div>`).join('')
    : '';

  // Aba Resumo - artilharia
  if(gols.length) {
    golsCard.style.display = '';
    golsLista.innerHTML    = golsHtml;
  } else {
    golsCard.style.display = 'none';
  }

  // -- Aba Estatísticas - lógica por estado da votação --
  let craque = estats.find(e => e.tipo === 'craque');
  let pereba = estats.find(e => e.tipo === 'pereba');

  const statsCraque     = document.getElementById('resumo-stats-craque');
  const statsCraqueNome = document.getElementById('resumo-stats-craque-nome');
  const statsPereba     = document.getElementById('resumo-stats-pereba');
  const statsPerebaNome = document.getElementById('resumo-stats-pereba-nome');
  const statsVotCard    = document.getElementById('resumo-stats-vot-andamento');
  const statsRanking    = document.getElementById('resumo-stats-ranking');
  const rankingLabel    = document.getElementById('resumo-stats-ranking-label');

  // Artilharia - sempre
  if(statsGols) {
    statsGols.style.display = top5.length ? '' : 'none';
    if(top5.length && statsLista) statsLista.innerHTML = golsHtml;
  }

  const jogadores = (p.jogadores && p.jogadores.length) ? p.jogadores : p.confirmados;
  const nomesValidosJogadores = new Set((jogadores || []).map(j => normNome(j.nome)));
  const estatisticaValida = (item) => !!(item && item.nome_jogador && nomesValidosJogadores.has(normNome(item.nome_jogador)));
  if(!estatisticaValida(craque)) craque = null;
  if(!estatisticaValida(pereba)) pereba = null;

  if(votacaoAberta(p)) {
    // DURANTE VOTAÇÃO: card de andamento + ranking parcial + artilharia
    if(statsVotCard) {
      statsVotCard.style.display = '';
      const deadline = document.getElementById('resumo-stats-vot-deadline');
      if(deadline) deadline.textContent = fmtDeadline(p);
    }
    if(statsCraque) statsCraque.style.display = 'none';
    if(statsPereba) statsPereba.style.display = 'none';
    if(statsEmpty)  statsEmpty.style.display  = 'none';
    // Busca votos e atualiza contador + ranking parcial
    dbGetVotos(peladaId).then(votos => {
      votos = votos || [];
      const votantes = new Set(votos.map(v => v.nome_votante)).size;
      const total    = jogadores.length;
      const faltam   = Math.max(0, total - votantes);
      const elX      = document.getElementById('resumo-stats-vot-x');
      const elY      = document.getElementById('resumo-stats-vot-y');
      const elF      = document.getElementById('resumo-stats-vot-faltam');
      const elBarra  = document.getElementById('resumo-stats-vot-barra');
      if(elX) elX.textContent = votantes;
      if(elY) elY.textContent = total;
      if(elF) elF.textContent = faltam;
      if(elBarra) elBarra.style.width = total > 0 ? `${Math.round(votantes/total*100)}%` : '0%';
      // Ranking parcial
      const ranking = compilarVotos(votos, jogadores);
      if(ranking.length && statsRanking) {
        statsRanking.style.display = '';
        if(rankingLabel) rankingLabel.style.display = '';
        const lista = document.getElementById('resumo-stats-ranking-lista');
        if(lista) lista.innerHTML = ranking.map((r,i) => {
          const estrelas = '★'.repeat(Math.round(r.media)) + '☆'.repeat(5-Math.round(r.media));
          return `<div class="vot-ranking-row">
            <span class="vot-ranking-pos">${i+1}º</span>
            <span class="vot-ranking-nome">${escHtml(r.nome)}</span>
            <span class="vot-ranking-stars">${estrelas}</span>
            <span class="vot-ranking-nota">${r.media.toFixed(1)}</span>
          </div>`;
        }).join('');
      } else if(statsRanking) {
        statsRanking.style.display = 'none';
      }
    });

  } else if(votacaoEncerrada(p)) {
    // APÓS ENCERRAMENTO: craque + pereba + artilharia
    if(statsVotCard) statsVotCard.style.display = 'none';
    if(rankingLabel) rankingLabel.style.display = 'none';
    if(!craque || !pereba) {
      await publicarResultadoVotacao(p);
      const novasEstatsPublicadas = await dbGetEstatisticas(peladaId);
      if(novasEstatsPublicadas && novasEstatsPublicadas.length) {
        estats = novasEstatsPublicadas;
        craque = estats.find(e => e.tipo === 'craque');
        pereba = estats.find(e => e.tipo === 'pereba');
        if(!estatisticaValida(craque)) craque = null;
        if(!estatisticaValida(pereba)) pereba = null;
      }
    }

    // Publicar automaticamente se ainda não foi publicado
    if(!craque) {
      publicarResultadoVotacao(p).then(() => {
        dbGetEstatisticas(peladaId).then(novasEstats => {
          novasEstats = novasEstats || [];
          const nc = novasEstats.find(e => e.tipo === 'craque');
          const np = novasEstats.find(e => e.tipo === 'pereba');
          if(statsCraque && estatisticaValida(nc)) { statsCraque.style.display = ''; if(statsCraqueNome) statsCraqueNome.textContent = nc.nome_jogador; }
          if(statsPereba && estatisticaValida(np)) { statsPereba.style.display = ''; if(statsPerebaNome) statsPerebaNome.textContent = np.nome_jogador; }
        });
      });
    } else {
      if(statsCraque) { statsCraque.style.display = ''; if(statsCraqueNome) statsCraqueNome.textContent = craque.nome_jogador; }
      if(statsPereba) { statsPereba.style.display = pereba ? '' : 'none'; if(pereba && statsPerebaNome) statsPerebaNome.textContent = pereba.nome_jogador; }
    }

    // Ranking oficial (sem label Prévia)
    _resumoRenderRanking(peladaId, jogadores);

    if(statsEmpty) statsEmpty.style.display = (craque || top5.length) ? 'none' : '';

  } else {
    // SEM VOTAÇÃO (pelada encerrada antes do jogo ou sem votos)
    if(statsVotCard) statsVotCard.style.display = 'none';
    if(statsCraque) { statsCraque.style.display = craque ? '' : 'none'; if(craque && statsCraqueNome) statsCraqueNome.textContent = craque.nome_jogador; }
    if(statsPereba) { statsPereba.style.display = pereba ? '' : 'none'; if(pereba && statsPerebaNome) statsPerebaNome.textContent = pereba.nome_jogador; }
    if(statsRanking) statsRanking.style.display = 'none';
    if(statsEmpty) statsEmpty.style.display = (craque || pereba || top5.length) ? 'none' : '';
  }

  // -- Vídeos ------------------------------
  const grid      = document.getElementById('resumo-videos-grid');
  const vEmpty    = document.getElementById('resumo-videos-empty');
  const destaque  = document.getElementById('resumo-destaque-video');

  if(videos.length) {
    if(vEmpty)   vEmpty.style.display   = 'none';
    if(destaque) {
      destaque.style.display = '';
      const v0 = videos[0];
      const ytId0 = extrairYoutubeId(v0.video_url);
      const frame0 = document.getElementById('resumo-destaque-player');
      if(frame0 && ytId0) frame0.src = ytEmbedUrl(ytId0, true);
      document.getElementById('resumo-destaque-titulo').textContent = v0.titulo;
    }
    grid.innerHTML = '';
    videos.forEach(v => {
      const ytId = extrairYoutubeId(v.video_url);
      if(!ytId) return;
      const item = document.createElement('div');
      item.className = 'resumo-video-list-item';
      item.innerHTML = `
        <div class="resumo-video-thumb-wrap">
          <img src="https://i.ytimg.com/vi/${ytId}/mqdefault.jpg" alt="" class="resumo-video-thumb" loading="lazy">
          <div class="resumo-video-play-btn"><i class="ti ti-player-play-filled"></i></div>
        </div>
        <div class="resumo-video-list-info">
          <span class="resumo-video-list-titulo">${escHtml(v.titulo)}</span>
        </div>`;
      item.addEventListener('click', () => abrirVideoPlayer(ytId, v.titulo));
      grid.appendChild(item);
    });
  } else {
    grid.innerHTML = '';
    if(vEmpty)   vEmpty.style.display   = '';
    if(destaque) destaque.style.display = 'none';
  }
}

// Abrir escalações públicas
function abrirTimesPublico(id){
  const p = G.peladas.find(x=>String(x.id)===String(id));
  if(!p) return;
  G.pelada = p;
  renderJTimes();
  goTo('s-j-times');
}

// Abrir resumo público
async function abrirResumoPublico(id){
  const p = G.peladas.find(x=>String(x.id)===String(id));
  if(!p) return;
  G.pelada = p;
  goTo('s-resumo');
  await renderResumo(id, null);
}

// Voltar para lista
async function voltarLista(){
  G.pelada = null;
  const admBack = document.getElementById('resumo-adm-back');
  if(admBack) admBack.style.display = 'none';
  if(typeof carregarBaseAppSeNecessario==='function') await carregarBaseAppSeNecessario();
  renderJLista();
  goTo('s-j-lista');
}




