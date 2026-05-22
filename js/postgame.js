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

// Upload para Supabase Storage
async function uploadVideoStorage(peladaId, arquivo){
  const ts = Date.now();
  const nomeArquivo = `${ts}_${arquivo.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
  const caminho = `peladas/${peladaId}/${nomeArquivo}`;
  const url = `${SUPABASE_URL}/storage/v1/object/melhores-momentos/${caminho}`;
  const token = await getSupabaseAccessToken();
  const resp = await fetch(url, {
    method:'POST',
    headers:{
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': arquivo.type || 'video/mp4',
    },
    body: arquivo
  });
  if(!resp.ok){
    const err = await resp.text();
    throw new Error('Erro no upload: '+err);
  }
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/melhores-momentos/${caminho}`;
  return { storagePath: caminho, publicUrl };
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
      <span class="artilheiro-gols">${g.quantidade}⚽</span>
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
    el.innerHTML='<div class="empty" style="font-size:12px;">Nenhum vídeo enviado</div>';
    return;
  }
  el.innerHTML = PJ.videos.map(v=>`
    <div class="pj-video-item">
      <i class="ti ti-video" style="font-size:16px;color:var(--text3);flex-shrink:0;"></i>
      <span class="pj-video-nome">${escHtml(v.titulo)}</span>
      <span class="pj-video-tipo-tag">${escHtml(v.tipo||'')}</span>
      <button onclick="pjRemoverVideo('${v.id}')" style="background:none;border:none;cursor:pointer;padding:4px;color:var(--red);"><i class="ti ti-trash" style="font-size:14px;"></i></button>
    </div>`).join('');
}

// Upload de Vídeo
async function pjUploadVideo(){
  const titulo = document.getElementById('pj-video-titulo').value.trim();
  const tipo = document.getElementById('pj-video-tipo').value;
  const fileInput = document.getElementById('pj-video-file');
  const arquivo = fileInput.files && fileInput.files[0];
  if(!titulo){ showToast('Informe o título do vídeo.'); return; }
  if(!arquivo){ showToast('Selecione um arquivo de vídeo.'); return; }
  if(arquivo.size > 50*1024*1024){ showToast('Arquivo muito grande (máx. 50MB).'); return; }
  const btn = document.getElementById('pj-btn-upload');
  const prog = document.getElementById('pj-upload-progress');
  btn.disabled = true;
  prog.style.display = 'block';
  prog.textContent = 'Enviando… aguarde';
  try{
    const { storagePath, publicUrl } = await uploadVideoStorage(G.pelada.id, arquivo);
    const row = await dbSalvarVideo({
      pelada_id: G.pelada.id,
      titulo, tipo,
      storage_path: storagePath,
      video_url: publicUrl,
      ordem: PJ.videos.length
    });
    if(row) PJ.videos.push(row);
    pjRenderVideos();
    document.getElementById('pj-video-titulo').value='';
    fileInput.value='';
    prog.style.display='none';
    btn.disabled=false;
    showToast('Vídeo enviado!');
  }catch(e){
    prog.style.display='none';
    btn.disabled=false;
    showToast('Erro no upload: '+e.message);
  }
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

function abrirVideoPlayer(url, titulo) {
  const vid = document.getElementById('vplayer-video');
  const titEl = document.getElementById('vplayer-titulo');
  if(titEl) titEl.textContent = titulo || 'Vídeo';
  goTo('s-video-player');
  if(vid) {
    vid.pause();
    vid.src = url;
    vid.loop = false;
    vid.load();
  }
}
function fecharVideoPlayer() {
  const vid = document.getElementById('vplayer-video');
  if(vid) { vid.pause(); vid.src = ''; }
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
          <span class="artilheiro-gols">${g.quantidade}⚽</span>
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
      }
    }

    // Publicar automaticamente se ainda não foi publicado
    if(!craque) {
      publicarResultadoVotacao(p).then(() => {
        dbGetEstatisticas(peladaId).then(novasEstats => {
          novasEstats = novasEstats || [];
          const nc = novasEstats.find(e => e.tipo === 'craque');
          const np = novasEstats.find(e => e.tipo === 'pereba');
          if(statsCraque && nc) { statsCraque.style.display = ''; if(statsCraqueNome) statsCraqueNome.textContent = nc.nome_jogador; }
          if(statsPereba && np) { statsPereba.style.display = ''; if(statsPerebaNome) statsPerebaNome.textContent = np.nome_jogador; }
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
      const destaqueVid = document.getElementById('resumo-destaque-player');
      destaqueVid.src = v0.video_url;
      destaqueVid.load();
      document.getElementById('resumo-destaque-titulo').textContent = v0.titulo;
      document.getElementById('resumo-destaque-tipo').textContent   = v0.tipo || '';
    }
    grid.innerHTML = videos.map(v => `
      <div class="resumo-video-grid-item">
        <video src="${v.video_url}" preload="metadata" muted playsinline controls class="resumo-video-grid-thumb"></video>
        <div class="resumo-video-grid-info" onclick="abrirVideoPlayer('${v.video_url.replace(/'/g,"\\'")}','${escHtml(v.titulo).replace(/'/g,"\\'")}')">
          <div class="resumo-video-grid-play"><i class="ti ti-player-play" aria-hidden="true"></i></div>
          <span class="resumo-video-grid-titulo">${escHtml(v.titulo)}</span>
          ${v.tipo ? `<span class="resumo-video-grid-tipo">${escHtml(v.tipo)}</span>` : ''}
        </div>
      </div>`).join('');
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




