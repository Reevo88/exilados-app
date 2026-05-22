// Exilados da Bola
// Votacao da partida e ranking de votos
// Extraido de app.js para reduzir o monolito mantendo o comportamento global atual.

// ==========================================
// VOTAÇÃO DA PARTIDA
// ==========================================

const LS_VOTOS_KEY = 'exilados_votou'; // { peladaId: true }

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
  const nomeValido = escalados && escalados.some(j => normNome(j.nome) === normNome(nomeVotante));
  if(!nomeValido) throw new Error('nome_invalido');

  const ip = await getIpVotante();
  const votosExistentes = await dbGetVotosDoVotante(peladaId, nomeVotante);
  if(votosExistentes && votosExistentes.length) throw new Error('votante_duplicado');

  for (const v of votos) {
    await sbFetch('/votos_pelada', {
      method: 'POST',
      prefer: 'return=minimal',
      body: JSON.stringify({
        pelada_id: peladaId,
        nome_votante: nomeVotante,
        nome_votado: v.nome_votado,
        nota: v.nota,
        ip_votante: ip || null
      })
    });
  }
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

// -- Compilar resultado -------------------
function compilarVotos(votos, jogadores) {
  const medias = {};
  jogadores.forEach(j => { medias[j.nome] = { soma: 0, count: 0 }; });
  votos.forEach(v => {
    if(!medias[v.nome_votado]) medias[v.nome_votado] = { soma: 0, count: 0 };
    medias[v.nome_votado].soma  += v.nota;
    medias[v.nome_votado].count += 1;
  });
  return Object.entries(medias)
    .filter(([,d]) => d.count > 0)
    .map(([nome, d]) => ({ nome, media: d.soma / d.count, votos: d.count }))
    .sort((a, b) => b.media - a.media || b.votos - a.votos);
}

// -- Publicar resultado automático --------
async function publicarResultadoVotacao(pelada) {
  try {
    const votos = await dbGetVotos(pelada.id);
    if(!votos.length) return;
    const jogadores = (pelada.jogadores && pelada.jogadores.length)
      ? pelada.jogadores
      : pelada.confirmados;
    const ranking = compilarVotos(votos, jogadores);
    if(!ranking.length) return;
    const craque = ranking[0];
    const pereba = ranking[ranking.length - 1];
    if(craque.nome !== pereba.nome) {
      await dbSalvarEstatistica(pelada.id, 'craque', craque.nome);
      await dbSalvarEstatistica(pelada.id, 'pereba', pereba.nome);
    }
  } catch(e) { console.warn('Erro ao publicar resultado votação:', e); }
}

// -- Botão de votação no resumo público ---
function _resumoAtualizarBotaoVotacao(pelada) {
  const wrap  = document.getElementById('resumo-vot-btn-wrap');
  const tempo = document.getElementById('resumo-vot-tempo');
  if(!wrap) return;
  if(!pelada || G.appContext === 'admin' || !votacaoAberta(pelada)) {
    wrap.style.display = 'none';
    return;
  }
  // Verifica se o jogador está escalado - usa nome confirmado nesta pelada específica
  const escalados = (pelada.jogadores && pelada.jogadores.length)
    ? pelada.jogadores : pelada.confirmados;
  const jogadorAtual = jogadorAtualNaPelada(pelada);
  const escalado = !!jogadorAtual;
  if(!escalado) { wrap.style.display = 'none'; return; }
  // Já votou
  if(lsJaVotou(pelada.id)) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  if(tempo) tempo.textContent = `· até ${fmtDeadline(pelada)}`;
}

// -- Abrir tela de votação ----------------
let _votPollingTimer = null;

async function _atualizarContadorVotos(peladaId, totalJogadores) {
  try {
    const votos = await dbGetVotos(peladaId);
    // Conta votantes únicos
    const votantes = new Set(votos.map(v => v.nome_votante)).size;
    const x = document.getElementById('vot-cnt-x');
    const y = document.getElementById('vot-cnt-y');
    const barra = document.getElementById('vot-cnt-barra');
    const contador = document.getElementById('vot-contador');
    if(x) x.textContent = votantes;
    if(y) y.textContent = totalJogadores;
    if(barra) barra.style.width = totalJogadores > 0 ? `${Math.round(votantes/totalJogadores*100)}%` : '0%';
    if(contador) contador.style.display = '';

    // Atualiza também no resumo público se estiver visível
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

function abrirVotacao() {
  const p = G.pelada;
  if(!p) return;
  document.getElementById('vot-meta').textContent =
    `${p.nome} · ${fmtData(p.data)}`;
  // Esconde tudo
  ['vot-encerrado','vot-aviso-janela','vot-ja-votou','vot-sem-permissao','vot-form']
    .forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });

  goTo('s-votacao');

  if(votacaoEncerrada(p)) {
    document.getElementById('vot-encerrado').style.display = '';
    return;
  }
  if(!votacaoAberta(p)) {
    document.getElementById('vot-encerrado').style.display = '';
    return;
  }

  // Verifica se está escalado - usa nome confirmado nesta pelada específica
  const escalados = (p.jogadores && p.jogadores.length) ? p.jogadores : p.confirmados;
  const jogadorAtual = jogadorAtualNaPelada(p);
  const nomeSalvo = jogadorAtual?.nome || '';
  const escalado  = !!jogadorAtual;

  if(!escalado) {
    document.getElementById('vot-sem-permissao').style.display = '';
    return;
  }
  if(lsJaVotou(p.id)) {
    document.getElementById('vot-ja-votou').style.display = '';
    _iniciarPollingVotos(p.id, escalados.length);
    return;
  }

  // Aviso de janela
  const aviso = document.getElementById('vot-aviso-janela');
  const avisoTxt = document.getElementById('vot-aviso-texto');
  if(aviso && avisoTxt) {
    aviso.style.display = 'flex';
    avisoTxt.textContent = `Votação aberta até ${fmtDeadline(p)}. Os resultados saem em até 12h após o jogo.`;
  }

  // Monta formulário
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

  // Inicia polling do contador
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

async function enviarVotosBasico() {
  const p = G.pelada;
  if(!p) return;
  const nomeSalvo = jogadorAtualNaPelada(p)?.nome || '';
  if(!nomeSalvo) return;

  const escalados = (p.jogadores && p.jogadores.length) ? p.jogadores : p.confirmados;

  const rows = [...document.querySelectorAll('#vot-lista-jogadores .vot-stars')];
  const votos = [];
  let semNota = false;
  rows.forEach(container => {
    const nota = parseInt(container.dataset.nota || '0');
    if(!nota) { semNota = true; return; }
    votos.push({ nome_votado: container.dataset.nome, nota });
  });

  if(semNota) {
    showToast('Avalie todos os jogadores antes de enviar.');
    return;
  }
  if(!votos.length) {
    showToast('Nenhum jogador para votar.');
    return;
  }

  try {
    await dbEnviarVotos(p.id, nomeSalvo, votos, escalados);
    lsMarcarVotou(p.id);
    document.getElementById('vot-form').style.display = 'none';
    document.getElementById('vot-aviso-janela').style.display = 'none';
    document.getElementById('vot-ja-votou').style.display = '';
    showToast('Votos enviados! ⭐');
    await _atualizarContadorVotos(p.id, escalados.length);
    _resumoAtualizarBotaoVotacao(p);
  } catch(e) {
    const msg = e.message || '';
    const isDuplicado = msg === 'ip_duplicado' || msg.includes('23505') || msg.includes('uq_votos_pelada') || msg.includes('duplicate key');
    if(msg === 'nome_invalido') {
      showToastDanger('Seu nome não está na lista desta pelada.');
    } else if(isDuplicado) {
      lsMarcarVotou(p.id);
      document.getElementById('vot-form').style.display = 'none';
      document.getElementById('vot-aviso-janela').style.display = 'none';
      document.getElementById('vot-ja-votou').style.display = '';
      showToast('Voto já registrado para este dispositivo! ⭐');
    } else {
      showToast('Erro ao enviar votos. Tente novamente.');
    }
  }
}

function fecharVotacao() {
  _pararPollingVotos();
  goTo('s-resumo');
}

// -- Ranking de votos na aba Estatísticas -
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

async function enviarVotos() {
  const p = G.pelada;
  if(!p) return;
  const nomeSalvo = jogadorAtualNaPelada(p)?.nome || '';
  if(!nomeSalvo) return;

  const escalados = (p.jogadores && p.jogadores.length) ? p.jogadores : p.confirmados;
  const rows = [...document.querySelectorAll('#vot-lista-jogadores .vot-stars')];
  const votos = [];
  let semNota = false;

  rows.forEach(container => {
    const nota = parseInt(container.dataset.nota || '0');
    if(!nota) { semNota = true; return; }
    votos.push({ nome_votado: container.dataset.nome, nota });
  });

  if(semNota) {
    showToast('Avalie todos os jogadores antes de enviar.');
    return;
  }
  if(!votos.length) {
    showToast('Nenhum jogador para votar.');
    return;
  }

  try {
    await dbEnviarVotos(p.id, nomeSalvo, votos, escalados);
    const votosPersistidos = await dbGetVotosDoVotante(p.id, nomeSalvo);
    if(!votosPersistidos.length) throw new Error('persistencia_vazia');
    lsMarcarVotou(p.id);
    document.getElementById('vot-form').style.display = 'none';
    document.getElementById('vot-aviso-janela').style.display = 'none';
    document.getElementById('vot-ja-votou').style.display = '';
    showToast('Votos enviados! ⭐');
    await _atualizarContadorVotos(p.id, escalados.length);
    _resumoAtualizarBotaoVotacao(p);
  } catch(e) {
    const msg = e.message || '';
    const isDuplicado = msg === 'ip_duplicado' || msg.includes('23505') || msg.includes('uq_votos_pelada') || msg.includes('duplicate key');
    console.error('Falha ao enviar votos:', msg, e);
    if(msg === 'nome_invalido') {
      showToastDanger('Seu nome não está na lista desta pelada.');
    } else if(isDuplicado) {
      const votosExistentes = await dbGetVotosDoVotante(p.id, nomeSalvo);
      if(votosExistentes.length) {
        lsMarcarVotou(p.id);
        document.getElementById('vot-form').style.display = 'none';
        document.getElementById('vot-aviso-janela').style.display = 'none';
        document.getElementById('vot-ja-votou').style.display = '';
        showToast('Voto já registrado para este dispositivo! ⭐');
      } else {
        showToastDanger('Seus votos não foram gravados no banco. Tente novamente.');
      }
    } else if(msg === 'persistencia_vazia') {
      showToastDanger('O envio retornou sem gravar os votos. Tente novamente.');
    } else {
      showToast('Erro ao enviar votos. Tente novamente.');
    }
  }
}
