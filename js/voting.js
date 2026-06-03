// Exilados da Bola
// Votacao da partida e ranking de votos.

const LS_VOTOS_KEY = 'exilados_votou'; // { peladaId: true }
let _votPollingTimer = null;

// -- Helpers de tempo --------------------
function votacaoAberta(pelada) {
  if(!peladaEncerrada(pelada)) return false;
  if(encerradaAntesDoJogo(pelada)) return false;
  return new Date() < votacaoDeadline(pelada);
}
function votacaoEncerrada(pelada) {
  if(!peladaEncerrada(pelada)) return false;
  return new Date() >= votacaoDeadline(pelada);
}
function lsJaVotou(peladaId) {
  try {
    const v = JSON.parse(localStorage.getItem(LS_VOTOS_KEY) || '{}');
    return !!v[String(peladaId)];
  } catch(e) { return false; }
}
function lsMarcarVotou(peladaId) {
  try {
    const v = JSON.parse(localStorage.getItem(LS_VOTOS_KEY) || '{}');
    v[String(peladaId)] = true;
    localStorage.setItem(LS_VOTOS_KEY, JSON.stringify(v));
  } catch(e) {}
}
function fmtDeadline(pelada) {
  const d = votacaoDeadline(pelada);
  if(!d) return '';
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })
    + ' às ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}

// -- IP do votante ------------------------
async function getIpVotante() {
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    const d = await r.json();
    return d.ip || null;
  } catch(e) { return null; }
}

// -- DB -----------------------------------
async function dbEnviarVotos(peladaId, nomeVotante, votos, escalados) {
  // Valida contra escalados OU confirmados (jogador pode não ter sido escalado)
  const p = G.pelada;
  const confirmados = p?.confirmados || [];
  const todosJogadores = [...(escalados||[]), ...confirmados];
  const nomeValido = todosJogadores.some(j => normNome(j.nome) === normNome(nomeVotante));
  if(!nomeValido) throw new Error('nome_invalido');

  const payload = votos.map(v => ({
    pelada_id: peladaId,
    nome_votante: nomeVotante,
    nome_votado: v.nome_votado,
    nota: v.nota,
  }));

  await sbFetch('/votos_pelada', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify(payload)
  });
}
async function dbGetVotos(peladaId) {
  try {
    const r = await sbFetch(`/votos_pelada?pelada_id=eq.${peladaId}`);
    return r || [];
  } catch(e) { return []; }
}
async function dbGetVotosDoVotante(peladaId, nomeVotante) {
  try {
    const r = await sbFetch(`/votos_pelada?pelada_id=eq.${peladaId}&nome_votante=eq.${encodeURIComponent(nomeVotante)}`);
    return r || [];
  } catch(e) { return []; }
}
async function dbJaVotou(peladaId, nomeVotante) {
  if(!peladaId || !nomeVotante) return false;
  try {
    const r = await sbFetch(`/votos_pelada?pelada_id=eq.${peladaId}&nome_votante=eq.${encodeURIComponent(nomeVotante)}&select=nome_votante&limit=1`);
    return Array.isArray(r) && r.length > 0;
  } catch(e) {
    return lsJaVotou(peladaId);
  }
}

// -- Compilar resultado -------------------
function compilarVotos(votos, jogadores) {
  const validos = new Map((jogadores || []).map(j => [normNome(j.nome), j.nome]));
  const medias = {};
  votos.forEach(v => {
    const chave = normNome(v.nome_votado);
    const nomeCanonico = validos.get(chave);
    if(!nomeCanonico) return;
    if(!medias[nomeCanonico]) medias[nomeCanonico] = { soma: 0, count: 0 };
    medias[nomeCanonico].soma  += Number(v.nota) || 0;
    medias[nomeCanonico].count += 1;
  });
  return Object.entries(medias)
    .filter(([,d]) => d.count > 0)
    .map(([nome, d]) => ({ nome, media: d.soma / d.count, votos: d.count }))
    .sort((a, b) => b.media - a.media || b.votos - a.votos);
}

// -- Publicar resultado automatico --------
function votosPersistidosConferem(votosPersistidos, votosEnviados) {
  if(!Array.isArray(votosPersistidos) || !Array.isArray(votosEnviados)) return false;
  if(votosPersistidos.length !== votosEnviados.length) return false;
  const esperado = votosEnviados
    .map(v => normNome(v.nome_votado) + ':' + (Number(v.nota) || 0))
    .sort();
  const gravado = votosPersistidos
    .map(v => normNome(v.nome_votado) + ':' + (Number(v.nota) || 0))
    .sort();
  return esperado.every((item, idx) => item === gravado[idx]);
}
async function publicarResultadoVotacao(pelada) {
  try {
    const votos = await dbGetVotos(pelada.id);
    if(!votos.length) return null;
    const jogadores = (pelada.jogadores && pelada.jogadores.length)
      ? pelada.jogadores
      : pelada.confirmados;
    const ranking = compilarVotos(votos, jogadores);
    if(!ranking.length) return null;
    const craque = ranking[0];
    const pereba = ranking[ranking.length - 1];
    if(craque && craque.nome) {
      await dbSalvarEstatistica(pelada.id, 'craque', craque.nome);
    }
    if(pereba && pereba.nome && (!craque || craque.nome !== pereba.nome)) {
      await dbSalvarEstatistica(pelada.id, 'pereba', pereba.nome);
    }
    return { craque, pereba, ranking };
  } catch(e) {
    console.warn('Erro ao publicar resultado votacao:', e);
  }
  return null;
}

async function jogadorJaVotouNaPelada(pelada) {
  const jogadorAtual = jogadorAtualNaPelada(pelada);
  const nomeVotante = jogadorAtual?.nome || '';
  if(!nomeVotante) return false;
  try {
    const jaVotou = await dbJaVotou(pelada.id, nomeVotante);
    if(jaVotou) lsMarcarVotou(pelada.id);
    else {
      // Limpa localStorage se banco diz que não votou
      try {
        const v = JSON.parse(localStorage.getItem(LS_VOTOS_KEY) || '{}');
        delete v[String(pelada.id)];
        localStorage.setItem(LS_VOTOS_KEY, JSON.stringify(v));
      } catch(e) {}
    }
    return jaVotou;
  } catch(e) {
    // Só usa localStorage como fallback se banco falhar
    return lsJaVotou(pelada.id);
  }
}

// -- Botao de votacao no resumo publico ---
async function _resumoAtualizarBotaoVotacao(pelada) {
  const wrap  = document.getElementById('resumo-vot-btn-wrap');
  const tempo = document.getElementById('resumo-vot-tempo');
  if(!wrap) return;

  wrap.style.display = 'none';
  if(!pelada || G.appContext === 'admin' || !votacaoAberta(pelada)) return;

  const jogadorAtual = jogadorAtualNaPelada(pelada);
  if(!jogadorAtual) return;

  if(await jogadorJaVotouNaPelada(pelada)) return;

  wrap.style.display = '';
  if(tempo) tempo.textContent = `· até ${fmtDeadline(pelada)}`;
}

async function _atualizarContadorVotos(peladaId, totalJogadores) {
  try {
    const votos = await dbGetVotos(peladaId);
    const votantes = new Set(votos.map(v => v.nome_votante)).size;
    const x = document.getElementById('vot-cnt-x');
    const y = document.getElementById('vot-cnt-y');
    const barra = document.getElementById('vot-cnt-barra');
    const contador = document.getElementById('vot-contador');
    if(x) x.textContent = votantes;
    if(y) y.textContent = totalJogadores;
    if(barra) barra.style.width = totalJogadores > 0 ? `${Math.round(votantes/totalJogadores*100)}%` : '0%';
    if(contador) contador.style.display = '';

    const resumoCnt = document.getElementById('resumo-vot-contador');
    if(resumoCnt) {
      resumoCnt.textContent = `${votantes} de ${totalJogadores} jogadores votaram`;
      resumoCnt.style.display = '';
    }
  } catch(e) {}
}

function _iniciarPollingVotos(peladaId, totalJogadores) {
  _pararPollingVotos();
  _atualizarContadorVotos(peladaId, totalJogadores);
  _votPollingTimer = setInterval(() => {
    _atualizarContadorVotos(peladaId, totalJogadores);
  }, 30000);
}

function _pararPollingVotos() {
  if(_votPollingTimer) { clearInterval(_votPollingTimer); _votPollingTimer = null; }
}

async function abrirVotacao() {
  const p = G.pelada;
  if(!p) return;
  document.getElementById('vot-meta').textContent = `${p.nome} · ${fmtData(p.data)}`;
  ['vot-encerrado','vot-aviso-janela','vot-ja-votou','vot-sem-permissao','vot-form']
    .forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });

  goTo('s-votacao');

  if(votacaoEncerrada(p) || !votacaoAberta(p)) {
    document.getElementById('vot-encerrado').style.display = '';
    return;
  }

  const escalados = (p.jogadores && p.jogadores.length) ? p.jogadores : p.confirmados;
  const jogadorAtual = jogadorAtualNaPelada(p);
  const nomeSalvo = jogadorAtual?.nome || '';
  if(!jogadorAtual) {
    document.getElementById('vot-sem-permissao').style.display = '';
    return;
  }

  if(await jogadorJaVotouNaPelada(p)) {
    document.getElementById('vot-ja-votou').style.display = '';
    _iniciarPollingVotos(p.id, escalados.length);
    return;
  }

  const aviso = document.getElementById('vot-aviso-janela');
  const avisoTxt = document.getElementById('vot-aviso-texto');
  if(aviso && avisoTxt) {
    aviso.style.display = 'flex';
    avisoTxt.textContent = `Votação aberta até ${fmtDeadline(p)}. Os resultados saem em até 12h após o jogo.`;
  }

  const outros = escalados.filter(j => normNome(j.nome) !== normNome(nomeSalvo));
  const lista  = document.getElementById('vot-lista-jogadores');
  lista.innerHTML = outros.map(j => `
    <div class="vot-jogador-row" id="vot-row-${escHtml(j.nome).replace(/\s/g,'_')}">
      <div class="avatar">${escHtml((j.nome[0]||'?').toUpperCase())}</div>
      <span class="vot-jogador-nome">${escHtml(j.nome)}</span>
      <div class="vot-stars" data-nome="${escHtml(j.nome)}">
        ${[1,2,3,4,5].map(n =>
          `<button class="vot-star" data-val="${n}" onclick="votarEstrela(this)" aria-label="${n} estrela">★</button>`
        ).join('')}
      </div>
    </div>`).join('');

  document.getElementById('vot-form').style.display = '';
  _iniciarPollingVotos(p.id, escalados.length);
}

function votarEstrela(btn) {
  const container = btn.closest('.vot-stars');
  const val = parseInt(btn.dataset.val);
  container.querySelectorAll('.vot-star').forEach(s => {
    s.classList.toggle('ativa', parseInt(s.dataset.val) <= val);
  });
  container.dataset.nota = val;
}

function fecharVotacao() {
  _pararPollingVotos();
  if(G.pelada && G.pelada.id) {
    abrirResumoPublico(G.pelada.id);
  } else {
    voltarLista();
  }
}

// -- Ranking de votos na aba Estatisticas -
async function _resumoRenderRanking(peladaId, jogadores) {
  const el = document.getElementById('resumo-stats-ranking');
  if(!el) return;
  try {
    const votos = await dbGetVotos(peladaId);
    if(!votos.length) { el.style.display = 'none'; return; }
    const ranking = compilarVotos(votos, jogadores);
    if(!ranking.length) { el.style.display = 'none'; return; }
    const lista = document.getElementById('resumo-stats-ranking-lista');
    if(lista) {
      lista.innerHTML = ranking.map((r, i) => {
        const estrelas = '★'.repeat(Math.round(r.media)) + '☆'.repeat(5 - Math.round(r.media));
        return `<div class="vot-ranking-row">
          <span class="vot-ranking-pos">${i + 1}º</span>
          <span class="vot-ranking-nome">${escHtml(r.nome)}</span>
          <span class="vot-ranking-stars">${estrelas}</span>
          <span class="vot-ranking-nota">${r.media.toFixed(1)}</span>
        </div>`;
      }).join('');
    }
    el.style.display = '';
  } catch(e) { el.style.display = 'none'; }
}

async function enviarVotos() {
  const p = G.pelada;
  if(!p) return;
  // Busca o jogador em escalados E confirmados
  const escalados = (p.jogadores && p.jogadores.length) ? p.jogadores : p.confirmados;
  const _jogAtual = jogadorAtualNaPelada(p)
    || (G.jogadorLogado?.id ? (p.confirmados||[]).find(j=>String(j.jogador_id||'')===String(G.jogadorLogado.id)) : null)
    || (apelidoJogadorLogado() ? (p.confirmados||[]).find(j=>normNome(j.nome)===normNome(apelidoJogadorLogado())) : null);
  const nomeSalvo = _jogAtual?.nome || '';
  if(!nomeSalvo) return;

  const rows = [...document.querySelectorAll('#vot-lista-jogadores .vot-stars')];
  const votos = [];
  let semNota = false;

  rows.forEach(container => {
    const nota = parseInt(container.dataset.nota || '0');
    if(!nota) { semNota = true; return; }
    votos.push({ nome_votado: container.dataset.nome, nota });
  });

  if(semNota) { showToast('Avalie todos os jogadores antes de enviar.'); return; }
  if(!votos.length) { showToast('Nenhum jogador para votar.'); return; }

  try {
    await dbEnviarVotos(p.id, nomeSalvo, votos, escalados);
    lsMarcarVotou(p.id);
    document.getElementById('vot-form').style.display = 'none';
    document.getElementById('vot-aviso-janela').style.display = 'none';
    document.getElementById('vot-ja-votou').style.display = '';
    showToast('Votos enviados! ★');
    await _atualizarContadorVotos(p.id, escalados.length);
    _resumoAtualizarBotaoVotacao(p);
  } catch(e) {
    const msg = e.message || '';
    console.error('Falha ao enviar votos:', msg, e);
    const isDuplicado = msg.includes('23505') || msg.includes('uq_votos_pelada') || msg.includes('duplicate key');
    if(isDuplicado) {
      // Votos já existem no banco — trata como sucesso
      lsMarcarVotou(p.id);
      document.getElementById('vot-form').style.display = 'none';
      document.getElementById('vot-aviso-janela').style.display = 'none';
      document.getElementById('vot-ja-votou').style.display = '';
      showToast('Votação já registrada! ★');
    } else if(msg === 'nome_invalido') {
      showToastDanger('Seu nome não está na lista desta pelada.');
    } else {
      showToastDanger('Erro ao enviar votos. Tente novamente.');
    }
  }
}



