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
    const src=cor==='azul'?'camisa-azul.png?v=2':'camisa-vermelha.png?v=2';
    const alt=cor==='azul'?'Camisa azul':'Camisa vermelha';
    return `<img class="home-shirt-svg" src="${src}" alt="${alt}" />`;
  }
  function labelResumoHome(p){
    if(p?.resultado) return 'Olho no lance';
    if(p?.homeResumoDisponivel === true) return 'Olho no lance';
    return 'Olho no lance';
  }

  el.innerHTML=ord.map(p=>{
    const ab=pelAdaberta(p);
    const encerrada=!ab;
    const antesDoJogo = encerradaAntesDoJogo(p);
    const confirmadosJogo = totalJogadoresConfirmados(p);
    const lotada = peladaLotada(p);
    const golsAzul = p.resultado ? (Number(p.resultado.gols_azul)||0) : '?';
    const golsVermelho = p.resultado ? (Number(p.resultado.gols_vermelho)||0) : '?';
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
              <div class="closed-score"><span id="home-gols-a-${p.id}">${golsAzul}</span><b>x</b><span id="home-gols-b-${p.id}">${golsVermelho}</span></div>
              <div class="closed-team closed-team-red">${camisaSvg('verm')}<span>Vermelho</span></div>
            </div>
          </div>
        </div>
        <div id="home-btns-${p.id}" class="closed-btns-wrap">
          <button id="home-summary-btn-${p.id}" class="closed-highlights-btn" onclick="event.stopPropagation();abrirResumoPublico('${p.id}')"><i class="ti ti-trophy"></i> <span id="home-summary-label-${p.id}">${labelResumoHome(p)}</span></button>
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
            <span class="p-stat"><i class="ti ti-users" style="font-size:11px;"></i> ${confirmadosJogo}/${p.max}</span>
            <span class="badge badge-green" style="font-size:10px;">Aberta</span>
            ${lotada ? '<span class="badge badge-red" style="font-size:10px;">Lotada</span>' : ''}
          </div>
        </div>
        <i class="ti ti-chevron-right" style="color:var(--text3);font-size:18px;"></i>
      </div>
    </div>`;
  }).join('');

  ord.filter(p=>!pelAdaberta(p)).forEach(p=>{
    _atualizarBotaoVotacaoHome(p);
    carregarResultadoCardHome(p.id);
  });
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
  const apelido = apelidoJogadorLogado();
  if(apelido){
    const porNome = escalados.find(j => normNome(j.nome) === normNome(apelido));
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
  const apelido = apelidoJogadorLogado();
  if(apelido){
    const porNome = (pelada.confirmados || []).find(j => normNome(j.nome) === normNome(apelido));
    if(porNome) return porNome;
  }
  return null;
}

// ==========================================
// JOGADOR - PELADEIROS (somente leitura)
// ==========================================
let peladeirosSort = 'apelido';

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

function peladeiroSeloPerfil(j){
  const perfil=String(j.perfil_app||'jogador').toLowerCase();
  if(perfil==='adm') return '<span class="peladeiro-chip peladeiro-chip-role peladeiro-chip-adm"><i class="ti ti-shield"></i> ADM</span>';
  if(perfil==='presidente') return '<span class="peladeiro-chip peladeiro-chip-role peladeiro-chip-presidente"><i class="ti ti-star"></i> Presidente</span>';
  if(perfil==='escalador') return '<span class="peladeiro-chip peladeiro-chip-role peladeiro-chip-escalador"><i class="ti ti-clipboard-list"></i> Escalador</span>';
  return '';
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

async function abrirPeladeirosPublico(){
  fecharMenuJogador();
  G.pelada = null;
  goTo('s-j-peladeiros');
  await carregarPeladeirosPublico();
}

async function carregarPeladeirosPublico(){
  const el=document.getElementById('peladeiros-lista');
  if(el) el.innerHTML='<div class="empty"><i class="ti ti-loader" style="animation:spin 1s linear infinite;display:inline-block;"></i>Carregando peladeiros</div>';
  try{
    G.jogadores=await sbFetch('/jogadores?select=id,nome,apelido,instagram,foto_url,posicao_favorita,modalidade,perfil_app,data_nascimento,ativo&order=apelido.asc');
    renderPeladeirosLista();
  }catch(e){
    if(el) el.innerHTML='<div class="empty"><i class="ti ti-user-x"></i>Nao foi possivel carregar os peladeiros</div>';
  }
}

function renderPeladeirosLista(){
  const el=document.getElementById('peladeiros-lista'); if(!el)return;
  atualizarPeladeirosSortUI();
  const busca=normNome(document.getElementById('peladeiros-busca')?.value||'');
  const ativos=(G.jogadores||[]).filter(j=>j.ativo!==false);
  const total=document.getElementById('peladeiros-total');
  if(total) total.textContent=ativos.length;
  const arr=ativos.filter(j=>{
    const texto=normNome([j.nome,j.apelido,j.instagram,j.posicao_favorita,j.modalidade].filter(Boolean).join(' '));
    return !busca || texto.includes(busca);
  }).sort((a,b)=>{
    const ka=chaveOrdenacaoPeladeiro(a);
    const kb=chaveOrdenacaoPeladeiro(b);
    return ka[0].localeCompare(kb[0],'pt-BR') || ka[1].localeCompare(kb[1],'pt-BR');
  });
  if(!arr.length){ el.innerHTML='<div class="empty"><i class="ti ti-users"></i>Nenhum peladeiro encontrado</div>'; return; }
  el.innerHTML=arr.map((j,i)=>{
    const insta=peladeiroInstagram(j.instagram);
    const foto=j.foto_url ? `<img src="${escHtml(j.foto_url)}" alt="" />` : peladeiroIniciais(j);
    const apelido=(j.apelido||j.nome||'Peladeiro').toUpperCase();
    const primeiroNome=peladeiroPrimeiroNome(j);
    const idade=peladeiroIdade(j);
    const linhaNome=[escHtml(primeiroNome), idade ? escHtml(idade) : ''].filter(Boolean).join(' <span class="peladeiro-sep">|</span> ');
    const pos=escHtml(j.posicao_favorita||'POS');
    const modalidade=j.modalidade==='mensalista'?'Mensalista':'Avulso';
    const zoom=j.foto_url?'abrirZoomFotoUrl(this.dataset.url)':'return false';
    const tema=i%2===0?'blue':'red';
    const seloPerfil=peladeiroSeloPerfil(j);
    const apelidoLen=apelido.length;
    const apelidoSize=apelidoLen>13?'xlong':apelidoLen>10?'long':apelidoLen>7?'medium':'short';
    const social=insta ? `<div class="peladeiro-social">
        <a class="peladeiro-social-link peladeiro-social-instagram" href="https://instagram.com/${encodeURIComponent(insta)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir Instagram de ${escHtml(apelido)}"><i class="ti ti-brand-instagram"></i><span>@${escHtml(insta)}</span></a>
      </div>` : '';
    return `<div class="peladeiro-card peladeiro-card-${tema} peladeiro-name-${apelidoSize}">
      <div class="peladeiro-sash"></div>
      <div class="peladeiro-field" aria-hidden="true"><span></span><span></span><span></span></div>
      <button class="peladeiro-avatar" type="button" data-url="${escHtml(j.foto_url||'')}" onclick="${zoom}" title="${j.foto_url?'Ampliar foto':'Sem foto cadastrada'}">${foto}</button>
      <div class="peladeiro-info">
        <div class="peladeiro-brand">EXILADOS DA BOLA</div>
        <div class="peladeiro-name" title="${escHtml(apelido)}">${escHtml(apelido)}</div>
        <div class="peladeiro-real-name">${linhaNome}</div>
        <div class="peladeiro-meta">
          <span class="peladeiro-chip peladeiro-chip-pos">${pos}</span>
          <span class="peladeiro-chip peladeiro-chip-mod"><i class="ti ti-crown"></i> ${modalidade}</span>
          ${seloPerfil}
        </div>
        ${social}
      </div>
      <img class="peladeiro-logo" src="logo.png" alt="Exilados da Bola"/>
      ${isAniversarianteMes(j) ? `<div class="peladeiro-birthday" title="Aniversariante do mês! 🎂">🎂</div>` : ""}
    </div>`;
  }).join('');
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
async function renderJConf(){
  const p=G.pelada;
  if(!p){ showToast('Selecione uma pelada primeiro!'); voltarLista(); return; }
  p.espera=p.espera||[];
  document.getElementById('jc-nome-hero').textContent=p.nome;
  document.getElementById('jc-meta-hero').innerHTML=`${fmtData(p.data)}<br>${p.hora}<br>${p.local}`;
  document.getElementById('jc-conf').textContent=totalJogadoresConfirmados(p);
  document.getElementById('jc-count').textContent=p.max||14;

  // Campo de nome: SEMPRE desabilitado — confirmação exige login
  const inp = document.getElementById('jc-input');
  const btnCancelar = document.getElementById('btn-cancelar');

  if(!G.usuario || !G.jogadorLogado){
    // Não logado: mostra placeholder orientando ao login, input desabilitado
    inp.value = '';
    inp.placeholder = 'Faça login para confirmar';
    inp.disabled = true;
  } else {
    const jaConf = confirmacaoAtualNaPelada(p);
    inp.value = jaConf ? jaConf.nome : apelidoJogadorLogado();
    inp.disabled = true;
  }

  if(btnCancelar){
    btnCancelar.disabled = false;
    btnCancelar.classList.remove('disabled');
  }

  p.espera=p.espera||[];
  const el=document.getElementById('jc-lista');
  const confJogo = p.temChurras ? p.confirmados.filter(j=>j.churras==='jogo'||j.churras==='jogo_churras') : p.confirmados;
  const confSoChurras = p.temChurras ? p.confirmados.filter(j=>j.churras==='churras') : [];

  const badgeChurras = (j) => j.churras==='jogo_churras'
    ? ' <span style="background:#fef0e0;color:#c46a00;border:1px solid #f5c87a;border-radius:99px;font-size:11px;font-weight:600;padding:2px 8px;white-space:nowrap;">+ churras</span>'
    : '';
  if(!G.jogadores || !G.jogadores.length) await _buscarJogadoresCadastrados();
  const _jogCad = (j) => (G.jogadores||[]).find(jj=>
    (j.jogador_id && String(jj.id)===String(j.jogador_id)) ||
    normNome(jj.nome)===normNome(j.nome) ||
    normNome(jj.apelido||'')===normNome(j.nome)
  ) || null;
  const badgeAniv = (j) => { const jc=_jogCad(j); return (jc && isAniversarianteMes(jc)) ? ' <span class="badge-aniv-mini" title="Aniversariante do mês">🎂</span>' : ''; };
  const confHtml=confJogo.length
    ?confJogo.map(j=>`<div class="player-row"><div class="avatar">${escHtml(j.nome[0]||'?').toUpperCase()}</div><span class="player-name">${escHtml(j.nome)} ${badgeAniv(j)}</span><span class="badge badge-green" style="font-size:10px;"><i class="ti ti-check" style="font-size:10px;"></i> Jogo</span>${badgeChurras(j)}</div>`).join('')
    :'<div class="empty"><i class="ti ti-users"></i>Nenhuma confirmação ainda</div>';

  const soChurrasHtml = confSoChurras.length
    ? `<div style="margin-top:12px;padding-top:10px;border-top:.5px solid var(--border);">
        <div class="section-title" style="margin-bottom:8px;">Só Churras 🍖 (${confSoChurras.length})</div>`
      + confSoChurras.map(j=>`<div class="player-row"><div class="avatar">${escHtml(j.nome[0]||'?').toUpperCase()}</div><span class="player-name">${escHtml(j.nome)} ${badgeAniv(j)}</span><span class="badge badge-green" style="font-size:10px;">🍖 Churras</span></div>`).join('')
      + `</div>` : '';

  const esperaHtml = p.espera.length
    ? `<div style="margin-top:12px;padding-top:10px;border-top:.5px solid var(--border);"><div class="section-title" style="margin-bottom:8px;">Lista de espera (${p.espera.length})</div>`
      + p.espera.map((j,i)=>`<div class="player-row"><div class="avatar" style="background:var(--warn-bg);color:var(--warn-text);">${i+1}</div><span class="player-name">${escHtml(j.nome)}</span><span class="badge badge-gray" style="font-size:10px;">Espera</span>${badgeChurras(j)}</div>`).join('')
      + `</div>` : '';

  const naoVao=p.naoVao||[];
  const naoVaoHtml=naoVao.length
    ?`<div style="margin-top:10px;padding-top:10px;border-top:.5px solid var(--border);">`
    +naoVao.map(j=>`<div class="player-row"><div class="avatar" style="background:var(--danger-bg);color:var(--danger-text);">${escHtml(j.nome[0]||'?').toUpperCase()}</div><span class="player-name">${escHtml(j.nome)}</span><span class="badge badge-red" style="font-size:10px;"><i class="ti ti-x" style="font-size:10px;"></i> Não vai</span></div>`).join('')
    +`</div>`
    :'';
  el.innerHTML=confHtml+soChurrasHtml+esperaHtml+naoVaoHtml;

  // Botões de confirmação
  const btnArea = document.querySelector('#s-j-conf .card');
  if(btnArea && p.temChurras){
    const btnDiv = btnArea.querySelector('div[style*="display:flex;gap:8px"]');
    if(btnDiv){
      btnDiv.innerHTML=`
        <button class="btn" data-confirm-action="vai" style="flex:1;background:#111;color:#fff;margin:0;font-weight:700;font-size:13px;" onclick="jogadorVai('jogo')"><i class="ti ti-ball-football"></i> Jogo</button>
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

// ==========================================
// CONFIRMAÇÃO — lógica central (upsert)
// ==========================================

/**
 * Busca confirmação existente do jogador logado nesta pelada.
 * Prioriza busca por jogador_id, depois por apelido normalizado.
 */
async function _buscarConfirmacaoExistente(peladaId){
  const jogadorId = G.jogadorLogado?.id || null;
  if(jogadorId){
    try{
      const rows = await sbFetch(`/confirmacoes?pelada_id=eq.${peladaId}&jogador_id=eq.${encodeURIComponent(jogadorId)}&limit=1`);
      if(rows && rows.length) return rows[0];
    }catch(e){}
  }
  const apelido = apelidoJogadorLogado();
  if(apelido){
    try{
      const rows = await sbFetch(`/confirmacoes?pelada_id=eq.${peladaId}&order=created_at.asc`);
      if(rows && rows.length){
        const match = rows.find(r => normNome(r.nome) === normNome(apelido));
        if(match) return match;
      }
    }catch(e){}
  }
  return null;
}

async function jogadorVaiImpl(churrasOpt){
  if(bloquearSeEncerrada('Partida encerrada. Não é mais possível confirmar presença.')) return;
  const p=G.pelada;
  const nome=nomeConfirmacaoEfetivo();
  if(!nome){ showToast('Faça login para confirmar presença.'); return; }

  const churrasVal = p.temChurras ? (churrasOpt||'jogo') : null;
  const vaiParaEspera = churrasVal !== 'churras' && peladaLotada(p);

  showToast('Confirmando...');
  try{
    // Upsert: busca se já existe qualquer registro deste jogador nesta pelada
    const existente = await _buscarConfirmacaoExistente(p.id);

    if(existente){
      // Já existe — atualiza status ao invés de inserir novo
      const novoStatus = vaiParaEspera ? 'espera' : 'confirmado';
      await dbAtualizar(existente.id, {
        status: novoStatus,
        nome: nome,
        churras: churrasVal,
        jogador_id: G.jogadorLogado?.id || existente.jogador_id || null,
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
        modalidade: existente.modalidade || 'avulso',
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
        nome, pos: '?', time: 'pool',
        pago: false, modalidade: 'avulso', churras: churrasVal,
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

async function jogadorNaoVaiImpl(){
  if(bloquearSeEncerrada('Partida encerrada. Não é mais possível alterar presença.')) return;
  const p=G.pelada; p.naoVao=p.naoVao||[]; p.espera=p.espera||[];
  const nome=nomeConfirmacaoEfetivo();
  if(!nome){ showToast('Faça login para registrar ausência.'); return; }

  try{
    const existente = await _buscarConfirmacaoExistente(p.id);
    if(existente){
      await dbAtualizar(existente.id, {status:'nao_vai', pago:false, time:'pool'});
      p.confirmados = p.confirmados.filter(j=>j.id!==existente.id);
      p.jogadores   = p.jogadores.filter(j=>j.id!==existente.id);
      p.espera      = p.espera.filter(j=>j.id!==existente.id);
      p.naoVao      = p.naoVao.filter(j=>j.id!==existente.id);
      p.naoVao.push({id:existente.id, nome});
    } else {
      // Não existe nenhum registro — cria direto como nao_vai
      const rows = await sbFetch('/confirmacoes', {
        method:'POST',
        body: JSON.stringify({
          pelada_id: p.id, nome,
          jogador_id: G.jogadorLogado?.id || null,
          posicao:'?', time:'pool', pago:false, modalidade:'avulso', status:'nao_vai',
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
    p.confirmados = p.confirmados.filter(j=>j.id!==existente.id);
    p.jogadores   = p.jogadores.filter(j=>j.id!==existente.id);
    p.espera      = p.espera.filter(j=>j.id!==existente.id);
    p.naoVao      = (p.naoVao||[]).filter(j=>j.id!==existente.id);
    p.naoVao.push({id:existente.id, nome:existente.nome||nome});
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
  const bAniv = (j) => { const jc=_jc(j); return (jc && isAniversarianteMes(jc)) ? ' <span class="badge-aniv-mini" title="Aniversariante do mês">🎂</span>' : ''; };
  const slot=(j,t)=>`<div class="team-slot"><div class="slot-av ${t==='azul'?'b':'r'}">${escHtml(j.nome[0]||'?').toUpperCase()}</div><span class="slot-name">${escHtml(j.nome)} ${bAniv(j)}</span>${posBadge(j.pos)}</div>`;
  document.getElementById('jt-team-a').innerHTML=tA.length?tA.map(j=>slot(j,'azul')).join(''):'<div style="padding:8px;font-size:12px;color:var(--text3);">Nenhum jogador</div>';
  document.getElementById('jt-team-b').innerHTML=tB.length?tB.map(j=>slot(j,'vermelho')).join(''):'<div style="padding:8px;font-size:12px;color:var(--text3);">Nenhum jogador</div>';
  document.getElementById('jt-pool').innerHTML=pool.length
    ?pool.map(j=>`<div class="pool-item"><div class="pool-av">${escHtml(j.nome[0]||'?').toUpperCase()}</div><span style="flex:1;font-size:13px;font-weight:500;">${escHtml(j.nome)} ${bAniv(j)}</span>${posBadge(j.pos)}</div>`).join('')
    :'<div style="padding:8px;font-size:12px;color:var(--text3);">Todos escalados!</div>';
}
