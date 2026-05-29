// Exilados da Bola
// Fluxo administrativo: home, criacao, confirmacoes, times e financeiro da pelada
// Extraido de app.js para reduzir o monolito mantendo o comportamento global atual.

// ==========================================
// ADM - HOME
// ==========================================
function renderAdmHome(){
  const el=document.getElementById('adm-lista');
  if(G.perfil==='escalador'){
    if(!G.peladas.length){el.innerHTML='<div class="empty"><i class="ti ti-ball-football"></i>Nenhuma pelada disponível</div>';return;}
    const ord=[...G.peladas].sort((a,b)=>new Date(b.data+'T'+b.hora)-new Date(a.data+'T'+a.hora));
    el.innerHTML=ord.map(p=>{
      const st=peladaStatusInfo(p);
      const confirmadosJogo=totalJogadoresConfirmados(p);
      const clickTop = st.aberta ?`onclick="setPeladaAdm('${p.id}','times')"` : '';
      return `<div class="ahc${peladaEncerrada(p) || deveEncerrarAutomaticamente(p)?' fechada':''}">
        <div class="ahc-top" ${clickTop}>
          <div class="ahc-icon"><img src="icone-1.png" class="pelada-img-icon" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:10px;display:block;"/></div>
          <div class="ahc-info">
            <div class="ahc-nome">${escHtml(p.nome)}</div>
            <div class="ahc-meta">${fmtData(p.data)} · ${p.hora} · ${escHtml(p.local)}</div>
            <div class="ahc-stats">
              <span><i class="ti ti-users" style="font-size:11px;"></i> ${confirmadosJogo}/${p.max}</span>
              <span class="badge ${st.cls}" style="font-size:10px;">${st.label}</span>
              ${st.lotada ?'<span class="badge badge-red" style="font-size:10px;">Lotada</span>' : ''}
            </div>
          </div>
          ${st.aberta ?'<i class="ti ti-chevron-right" style="color:var(--text3);font-size:18px;flex-shrink:0;"></i>' : '<i class="ti ti-lock" style="color:var(--text3);font-size:18px;flex-shrink:0;"></i>'}
        </div>
      </div>`;
    }).join('');
    return;
  }
  if(!G.peladas.length){el.innerHTML='<div class="empty"><i class="ti ti-ball-football"></i>Nenhuma pelada criada</div>';return;}
  const ord=[...G.peladas].sort((a,b)=>new Date(b.data+'T'+b.hora)-new Date(a.data+'T'+a.hora));
  el.innerHTML=ord.map(p=>{
    const st=peladaStatusInfo(p);
    const cobraveis=p.confirmados.filter(j=>j.modalidade!=='mensalista'&&!j.isento);
    const pagos=cobraveis.filter(j=>j.pago).length;
    const arr=pagos*p.valor;
    const previsto=cobraveis.length*p.valor;
    const pend=Math.max(previsto-arr,0);
    const confirmadosJogo=totalJogadoresConfirmados(p);
    const vagas=Math.max(p.max-confirmadosJogo,0);
    const encerrada=peladaEncerrada(p) || deveEncerrarAutomaticamente(p);
    const btnPosJogo=encerrada?`<button class="ahc-sec blue" onclick="abrirPosJogo('${p.id}')"><i class="ti ti-trophy"></i> Pós-jogo</button>`:'';
    const btnEncerrar=encerrada
      ?`<button class="ahc-sec warn" onclick="reabrirPelada('${p.id}')"><i class="ti ti-lock-open"></i> Reabrir</button>`
      :`<button class="ahc-sec warn" onclick="encerrarPelada('${p.id}')"><i class="ti ti-lock"></i> Encerrar</button>`;
    return `<div class="ahc${encerrada?' fechada':''}">
      <div class="ahc-top" onclick="setPeladaAdm('${p.id}','conf')">
        <div class="ahc-icon"><img src="icone-1.png" class="pelada-img-icon" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:10px;display:block;"/></div>
        <div class="ahc-info">
          <div class="ahc-nome">${escHtml(p.nome)}</div>
          <div class="ahc-meta">${fmtData(p.data)} · ${p.hora} · ${escHtml(p.local)}</div>
          <div class="ahc-stats">
            <span><i class="ti ti-users" style="font-size:11px;"></i> ${confirmadosJogo}/${p.max}</span>
            <span><i class="ti ti-door-enter" style="font-size:11px;"></i> ${vagas} vagas</span>
            <span class="badge ${st.cls}" style="font-size:10px;">${st.label}</span>
            ${st.lotada ?'<span class="badge badge-red" style="font-size:10px;">Lotada</span>' : ''}
          </div>
        </div>
        <i class="ti ti-chevron-right" style="color:var(--text3);font-size:18px;flex-shrink:0;"></i>
      </div>
      <div class="ahc-fin">
        <div class="ahc-fin-c"><div class="ahc-fin-n">${money(previsto)}</div><div class="ahc-fin-l">previsto</div></div>
        <div class="ahc-fin-c green"><div class="ahc-fin-n">${money(arr)}</div><div class="ahc-fin-l">recebido</div></div>
        <div class="ahc-fin-c red"><div class="ahc-fin-n">${money(pend)}</div><div class="ahc-fin-l">pendente</div></div>
      </div>
      <div class="ahc-divider"></div>
      <div class="ahc-actions-row">
        <button class="ahc-sec wa" onclick="compartilharWhatsAppPelada('${p.id}')"><i class="ti ti-brand-whatsapp"></i> Compartilhar</button>
        <button class="ahc-sec blue" onclick="verFinanceiroPelada('${p.id}')"><i class="ti ti-cash"></i> Financeiro</button>
        ${!encerrada ?`<button class="ahc-sec" onclick="prepararEditarPelada('${p.id}')"><i class="ti ti-pencil"></i> Editar</button>` : ''}
        ${btnPosJogo}
        ${btnEncerrar}
      </div>
    </div>`;
  }).join('');
}

async function excluirPelada(id){
  abrirConfirmSheet(
    'Excluir pelada',
    'Essa ação apagará a pelada e todas as confirmações. Não pode ser desfeita.',
    'Excluir pelada',
    async () => {
      try{
        await dbExcluirPelada(id);
        G.peladas=G.peladas.filter(p=>String(p.id)!==String(id));
        if(G.pelada&&String(G.pelada.id)===String(id)) G.pelada=null;
        G.editandoPeladaId=null; renderAdmHome(); goTo('s-adm-home'); showToast('Pelada excluída');
      }catch(e){ showToast('Erro ao excluir.'); }
    }
  );
}
async function encerrarPelada(id){
  if(G.perfil === 'escalador'){ showToast('Escalador não pode encerrar partida.'); return; }
  const p=G.peladas.find(x=>String(x.id)===String(id)); if(!p)return;
  abrirConfirmSheet(
    'Encerrar pelada',
    `${p.nome} será encerrada. Jogadores não poderão confirmar presença.`,
    'Encerrar pelada',
    async () => {
      try{ await dbAtualizarPelada(id,{status:'encerrada', reaberta:false}); p.status='encerrada'; p.reaberta=false; renderAdmHome(); showToast('Pelada encerrada.'); }
      catch(e){ showToast('Erro ao encerrar.'); }
    }
  );
}
async function reabrirPelada(id){
  if(G.perfil === 'escalador'){ showToast('Escalador não pode reabrir partida.'); return; }
  const p=G.peladas.find(x=>String(x.id)===String(id)); if(!p)return;
  abrirConfirmSheet(
    'Reabrir pelada',
    `${p.nome} voltará a aceitar confirmações e ajustes de escalação.`,
    'Reabrir pelada',
    async () => {
      try{
        await dbAtualizarPelada(id, {status:'aberta', reaberta:true});
        p.status = 'aberta';
        p.reaberta = true;
        renderAdmHome();
        showToast('Pelada reaberta.');
      }
      catch(e){ showToast('Erro ao reabrir.'); }
    }
  );
}

// ==========================================
// ADM - CRIAR PELADA
// ==========================================
function hojeISO(){
  const d=new Date(); d.setHours(12,0,0,0); return d.toISOString().slice(0,10);
}
function dataIsoParaInput(valor){
  const v=String(valor||'').trim();
  const iso=v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return v;
}
function proximaDataSemanal(dataBase){
  if(!dataBase) return hojeISO();
  const hoje=new Date(); hoje.setHours(12,0,0,0);
  const d=new Date(dataBase+'T12:00:00');
  if(Number.isNaN(d.getTime())) return hojeISO();
  d.setDate(d.getDate()+7);
  while(d<hoje) d.setDate(d.getDate()+7);
  return d.toISOString().slice(0,10);
}

function voltarInicioAdm(){
  G.pelada = null;
  renderAdmHome();
  goTo('s-adm-home');
}
function normalizarDataPelada(valor){
  const v=String(valor||'').trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const br=v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(br) return `${br[3]}-${br[2]}-${br[1]}`;
  return v;
}
function ultimaPeladaBase(){
  return [...G.peladas].sort((a,b)=>new Date(b.data+'T'+b.hora)-new Date(a.data+'T'+a.hora))[0]||null;
}
function limparErrosCriarPelada(){
  ['cp-nome','cp-data','cp-hora','cp-local','cp-valor','cp-max'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.classList.remove('input-error');
  });
}
function setCpChurras(sim){
  const hidden=document.getElementById('cp-churras');
  const btnSim=document.getElementById('cp-churras-sim');
  const btnNao=document.getElementById('cp-churras-nao');
  if(hidden) hidden.value=sim?'true':'false';
  if(btnSim) btnSim.classList.toggle('active',sim);
  if(btnNao) btnNao.classList.toggle('active',!sim);
}
function setAdmChurras(val, btn){
  document.querySelectorAll('#adm-churras-sel .churras-pill').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}
function campoErro(id){
  const el=document.getElementById(id); if(el) el.classList.add('input-error');
}
function configurarFormularioPelada(modo){
  const editando = modo === 'editar';
  const titulo=document.getElementById('cp-titulo');
  const btn=document.getElementById('cp-btn-criar');
  const btnDup=document.getElementById('cp-btn-duplicar');
  const btnDel=document.getElementById('cp-btn-excluir');
  const ajuda=document.getElementById('cp-ajuda');
  if(titulo) titulo.textContent = editando ?'EDITAR PELADA' : 'MARCAR NOVA PELADA';
  if(btn) btn.innerHTML = editando ?'<i class="ti ti-device-floppy"></i> Salvar alterações' : '<i class="ti ti-check"></i> Criar e abrir confirmações';
  if(btnDup) btnDup.style.display = editando ?'none' : 'flex';
  if(btnDel) btnDel.style.display = editando ?'flex' : 'none';
  if(ajuda) ajuda.textContent = editando
    ?'Altere os dados principais da pelada. O limite não pode ficar abaixo do número atual de confirmados.'
    : 'Preencha os dados básicos. Quando existir uma pelada anterior, o app reaproveita local, horário, valor e limite para agilizar o cadastro.';
}
function prepararNovaPelada(){
  G.editandoPeladaId=null;
  configurarFormularioPelada('novo');
  limparErrosCriarPelada();
  const base=ultimaPeladaBase();
  document.getElementById('cp-nome').value=base?.nome||'Pelada das Quintas';
  document.getElementById('cp-data').value=dataIsoParaInput(base?proximaDataSemanal(base.data):hojeISO());
  document.getElementById('cp-hora').value=base?.hora||'20:00';
  document.getElementById('cp-local').value=base?.local||'Arena Gaúcha';
  document.getElementById('cp-valor').value=base?.valor||35;
  document.getElementById('cp-max').value=base?.max||14;
  setCpChurras(false);
  const ajuda=document.getElementById('cp-ajuda');
  if(ajuda) ajuda.textContent=base?'Dados pré-preenchidos com base na última pelada. Revise principalmente a data antes de criar.':'Preencha os dados básicos da primeira pelada.';
}
function prepararEditarPelada(id){
  if(G.perfil==='escalador'){ showToast('Escalador não pode editar pelada.'); return; }
  const p=G.peladas.find(x=>String(x.id)===String(id));
  if(!p){ showToast('Pelada não encontrada.'); return; }
  if(peladaEncerrada(p) || deveEncerrarAutomaticamente(p)){
    showToast('Pelada encerrada não permite editar dados principais.');
    return;
  }
  G.editandoPeladaId=p.id;
  configurarFormularioPelada('editar');
  limparErrosCriarPelada();
  document.getElementById('cp-nome').value=p.nome||'';
  document.getElementById('cp-data').value=dataIsoParaInput(p.data||'');
  document.getElementById('cp-hora').value=p.hora||'';
  document.getElementById('cp-local').value=p.local||'';
  document.getElementById('cp-valor').value=p.valor||35;
  document.getElementById('cp-max').value=p.max||14;
  setCpChurras(p.temChurras||false);
  goTo('s-adm-criar');
}
function duplicarUltimaPelada(){
  const base=ultimaPeladaBase();
  if(!base){ prepararNovaPelada(); showToast('Ainda não existe pelada anterior.'); return; }
  prepararNovaPelada();
  showToast('Última pelada duplicada. Revise a data.');
}
function validarCriarPelada(){
  limparErrosCriarPelada();
  const nome=document.getElementById('cp-nome').value.trim();
  const data=normalizarDataPelada(document.getElementById('cp-data').value);
  const hora=document.getElementById('cp-hora').value;
  const local=document.getElementById('cp-local').value.trim();
  const valor=Number(document.getElementById('cp-valor').value);
  const max=parseInt(document.getElementById('cp-max').value,10);
  const erros=[];
  if(!nome){ erros.push('nome'); campoErro('cp-nome'); }
  if(nome.length>20){ erros.push('nome'); campoErro('cp-nome'); }
  if(!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)){ erros.push('data'); campoErro('cp-data'); }
  if(!hora){ erros.push('horário'); campoErro('cp-hora'); }
  if(!local){ erros.push('local'); campoErro('cp-local'); }
  if(!Number.isFinite(valor)||valor<1){ erros.push('valor'); campoErro('cp-valor'); }
  if(!Number.isFinite(max)||max<2||max>50){ erros.push('limite'); campoErro('cp-max'); }
  if(erros.length){ showToast('Preencha os campos obrigatórios corretamente.'); return null; }
  const temChurras = document.getElementById('cp-churras').value === 'true';
  return {nome,data,hora,local,valor,max,temChurras,status:'aberta',confirmados:[],jogadores:[],naoVao:[],espera:[]};
}
async function criarPelada(){
  const nova=validarCriarPelada(); if(!nova) return;
  const btn=document.getElementById('cp-btn-criar');
  if(btn){ btn.disabled=true; btn.style.opacity='.65'; }
  showToast('Criando...');
  try{
    const row=await dbCriarPelada(nova);
    nova.id=row.id; G.peladas.push(nova); G.pelada=nova;
    G.editandoPeladaId=null;
    showToast('Pelada criada!');
    renderAdmConf(); goTo('s-adm-conf');
  }catch(e){ console.error('Erro ao criar pelada:', e); showToast('Erro ao criar pelada: '+(e.message||'verifique o Supabase.')); }
  finally{ if(btn){ btn.disabled=false; btn.style.opacity='1'; } }
}
async function editarPelada(){
  if(G.perfil==='escalador'){ showToast('Escalador não pode editar pelada.'); return; }
  const id=G.editandoPeladaId;
  const p=G.peladas.find(x=>String(x.id)===String(id));
  if(!p){ showToast('Pelada não encontrada.'); return; }
  if(peladaEncerrada(p) || deveEncerrarAutomaticamente(p)){
    showToast('Pelada encerrada não permite editar dados principais.');
    return;
  }
  const dados=validarCriarPelada(); if(!dados) return;
  const confirmados=(p.confirmados||[]).length;
  if(dados.max < confirmados){
    campoErro('cp-max');
    showToast(`Não é possível reduzir para ${dados.max}. Já existem ${confirmados} confirmados.`);
    return;
  }
  const btn=document.getElementById('cp-btn-criar');
  if(btn){ btn.disabled=true; btn.style.opacity='.65'; }
  showToast('Salvando...');
  try{
    const fields={nome:dados.nome,data:dados.data,hora:dados.hora,local:dados.local,valor:dados.valor,max_jogadores:dados.max,tem_churras:dados.temChurras};
    await dbAtualizarPelada(p.id, fields);
    Object.assign(p,{nome:dados.nome,data:dados.data,hora:dados.hora,local:dados.local,valor:dados.valor,max:dados.max,temChurras:dados.temChurras});
    if(G.pelada && String(G.pelada.id)===String(p.id)) Object.assign(G.pelada,p);
    G.editandoPeladaId=null;
    showToast('Pelada atualizada!');
    renderAdmHome(); goTo('s-adm-home');
  }catch(e){ showToast('Erro ao salvar alterações.'); }
  finally{ if(btn){ btn.disabled=false; btn.style.opacity='1'; } }
}
function salvarFormularioPelada(){
  if(G.editandoPeladaId) return editarPelada();
  return criarPelada();
}
function excluirPeladaEditando(){
  if(!G.editandoPeladaId){ return; }
  const id=G.editandoPeladaId;
  const p=G.peladas.find(x=>String(x.id)===String(id));
  if(!p){ showToast('Pelada não encontrada.'); return; }
  if(peladaEncerrada(p) || deveEncerrarAutomaticamente(p)){
    showToast('Pelada encerrada não permite exclusão por esta tela.');
    return;
  }
  excluirPelada(id);
}

// ==========================================
// ADM - CONFIRMA??ES
// ==========================================
function renderAdmConf(){
  const p=G.pelada; if(!p)return;
  p.naoVao=p.naoVao||[]; p.espera=p.espera||[];
  document.getElementById('aconf-nome').textContent=p.nome.toUpperCase();
  document.getElementById('aconf-meta').textContent=`${fmtData(p.data)} · ${p.hora} · ${p.local}`;
  document.getElementById('aconf-link').textContent=linkPelada(p);
  document.getElementById('aconf-max').textContent=p.max;
  const confirmados=p.confirmados.length;
  const confirmadosJogo=totalJogadoresConfirmados(p);
  const vagas=Math.max(0,p.max-confirmadosJogo);
  const cobraveis=p.confirmados.filter(j=>j.modalidade!=='mensalista'&&!j.isento);
  const recebido=cobraveis.filter(j=>j.pago).length*p.valor;
  const previsto=cobraveis.length*p.valor;
  const pendente=Math.max(0,previsto-recebido);
  document.getElementById('aconf-total').textContent=confirmadosJogo;
  const tabConf=document.querySelector('#s-adm-conf .tabs .tab.active, #s-adm-conf .tabs .tab');
  const tabNao=document.getElementById('aconf-btn-nao');
  if(tabConf) tabConf.textContent=`Confirmados (${confirmados})`;
  if(tabNao) tabNao.textContent=`Não vão (${(p.naoVao||[]).length})`;
  document.getElementById('aconf-caixa').textContent=money(recebido);
  document.getElementById('aconf-pendente').textContent=money(pendente);
  document.getElementById('aconf-previsto').textContent=money(previsto);
  const vagasEl=document.getElementById('aconf-vagas');
  vagasEl.textContent=vagas===0?'Lotada':`${vagas} vaga${vagas===1?'':'s'} restante${vagas===1?'':'s'}`;
  vagasEl.classList.toggle('lotada',vagas===0);
  const admChurrasSel = document.getElementById('adm-churras-sel');
  if(admChurrasSel) admChurrasSel.style.display = p.temChurras ?'' : 'none';
  const el=document.getElementById('aconf-lista');
  const badgeChurrasAdm = (j) => j.churras==='jogo_churras'
    ?' <span style="background:#fef0e0;color:#c46a00;border:1px solid #f5c87a;border-radius:99px;font-size:11px;font-weight:600;padding:2px 8px;white-space:nowrap;">+ churras</span>'
    : '';
  const confJogoAdm = p.temChurras ?p.confirmados.filter(j=>j.churras==='jogo'||j.churras==='jogo_churras') : p.confirmados;
  const confSoChurrasAdm = p.temChurras ?p.confirmados.filter(j=>j.churras==='churras') : [];
  const rowAdm = (j,i) => `<div class="player-row"><div class="avatar">${escHtml(j.nome[0]||'?').toUpperCase()}</div><span class="player-name">${escHtml(j.nome)}</span><span class="badge badge-green" style="font-size:10px;"><i class="ti ti-check" style="font-size:10px;"></i> Jogo</span>${badgeChurrasAdm(j)}<div class="player-actions"><button class="btn-mini btn-danger" onclick="remConf(${i})" title="Remover"><i class="ti ti-trash" style="font-size:13px;"></i></button></div></div>`;
  const rowSoChurrasAdm = (j,i) => `<div class="player-row"><div class="avatar">${escHtml(j.nome[0]||'?').toUpperCase()}</div><span class="player-name">${escHtml(j.nome)}</span><span style="background:#fef0e0;color:#c46a00;border:1px solid #f5c87a;border-radius:99px;font-size:11px;font-weight:600;padding:2px 8px;white-space:nowrap;">Só churras</span><div class="player-actions"><button class="btn-mini btn-danger" onclick="remConf(${i})" title="Remover"><i class="ti ti-trash" style="font-size:13px;"></i></button></div></div>`;

  const confJogoHtml = confJogoAdm.length
    ?confJogoAdm.map(j=>rowAdm(j,p.confirmados.indexOf(j))).join('')
    : '<div class="empty" style="padding:12px 0;"><i class="ti ti-clock"></i>Aguardando confirmações</div>';
  const soChurrasAdmHtml = confSoChurrasAdm.length
    ?`<div style="margin-top:10px;padding-top:10px;border-top:.5px solid var(--border);"><div class="section-title" style="margin-bottom:8px;">Só Churras (${confSoChurrasAdm.length})</div>`
      + confSoChurrasAdm.map(j=>rowSoChurrasAdm(j,p.confirmados.indexOf(j))).join('')
      + `</div>`
    : '';
  const esperaAdmHtml = p.espera.length
    ?`<div style="margin-top:10px;padding-top:10px;border-top:.5px solid var(--border);"><div class="section-title" style="margin-bottom:8px;">Lista de espera (${p.espera.length})</div>`
      + p.espera.map((j,i)=>`<div class="player-row"><div class="avatar" style="background:var(--warn-bg);color:var(--warn-text);">${i+1}</div><span class="player-name">${escHtml(j.nome)}</span><span class="badge badge-gray" style="font-size:10px;">Espera</span>${badgeChurrasAdm(j)}<div class="player-actions"><button class="btn-mini btn-mini-pay" onclick="promoverEspera(${i})"><i class="ti ti-user-plus" style="font-size:12px;"></i> Promover</button><button class="btn-mini btn-danger" onclick="remEspera(${i})" title="Remover"><i class="ti ti-trash" style="font-size:13px;"></i></button></div></div>`).join('')
      + `</div>`
    : '';
  el.innerHTML = confJogoHtml + soChurrasAdmHtml + esperaAdmHtml;
  const nao=document.getElementById('aconf-nao-lista');
  const podeExcluirNaoVai = G.perfil === 'full';
  nao.innerHTML=p.naoVao.length
    ?p.naoVao.map((j,i)=>`<div class="player-row"><div class="avatar">${escHtml(j.nome[0]||'?').toUpperCase()}</div><span class="player-name">${escHtml(j.nome)}</span><span class="badge badge-red" style="font-size:10px;"><i class="ti ti-x" style="font-size:10px;"></i> Não vai</span><div class="player-actions"><button class="btn-mini btn-mini-muted" onclick="voltarNaoVai(${i})"><i class="ti ti-user-plus" style="font-size:12px;"></i> Confirmar</button>${podeExcluirNaoVai?`<button class="btn-mini btn-danger" onclick="remNaoVai(${i})" title="Remover"><i class="ti ti-trash" style="font-size:13px;"></i></button>`:''}</div></div>`).join('')
    :'<div class="empty" style="padding:12px 0;"><i class="ti ti-user-x"></i>Nenhuma recusa registrada</div>';
}
// -- Busca peladeiros cadastrados para lookup de modalidade --
async function _buscarJogadoresCadastrados(){
  if(G.jogadores && G.jogadores.length) return G.jogadores;
  try{
    G.jogadores = await sbFetch('/jogadores?select=id,nome,apelido,modalidade,posicao_favorita&order=apelido.asc');
  }catch(e){ G.jogadores = []; }
  return G.jogadores || [];
}

// -- Encontra matches parciais pelo nome digitado --
function _encontrarMatchesCadastro(nomeDigitado, jogadores){
  const n = normNome(nomeDigitado);
  return jogadores.filter(j => {
    const nomeNorm    = normNome(j.nome   || '');
    const apelidoNorm = normNome(j.apelido|| '');
    return nomeNorm.includes(n) || apelidoNorm.includes(n) || n.includes(nomeNorm) || n.includes(apelidoNorm);
  });
}

// -- Sheet de confirmação de identidade do jogador --
let _admAddPendente = null;
function _abrirSheetIdentidade(matches, nomeDigitado, onConfirm){
  _admAddPendente = { nomeDigitado, onConfirm };
  const lista = document.getElementById('id-sheet-lista');
  const sheet = document.getElementById('id-sheet');
  if(!lista || !sheet) { onConfirm(nomeDigitado, 'avulso', null); return; }

  lista.innerHTML = matches.map((j,i) => {
    const modalLabel = j.modalidade === 'mensalista' ? '🟡 Mensalista' : '🔵 Avulso';
    const apelido = j.apelido ? ` (${escHtml(j.apelido)})` : '';
    return `<button class="id-sheet-opt" onclick="_confirmarIdentidade(${i})">
      <span class="id-sheet-nome">${escHtml(j.nome)}${apelido}</span>
      <span class="id-sheet-mod">${modalLabel}</span>
    </button>`;
  }).join('') +
  `<button class="id-sheet-opt id-sheet-opt-new" onclick="_confirmarIdentidade(-1)">
    <span class="id-sheet-nome">➕ Adicionar "${escHtml(nomeDigitado)}" como novo</span>
    <span class="id-sheet-mod">🔵 Avulso</span>
  </button>`;

  sheet.classList.add('open');
}
function _confirmarIdentidade(idx){
  const sheet = document.getElementById('id-sheet');
  if(sheet) sheet.classList.remove('open');
  if(!_admAddPendente) return;
  const { nomeDigitado, onConfirm } = _admAddPendente;
  _admAddPendente = null;
  const jogadores = G.jogadores || [];
  const matches = _encontrarMatchesCadastro(nomeDigitado, jogadores);
  if(idx >= 0 && matches[idx]){
    const j = matches[idx];
    const nomeUsar = j.apelido || j.nome;
    onConfirm(nomeUsar, j.modalidade || 'avulso', j.id);
  } else {
    onConfirm(nomeDigitado, 'avulso', null);
  }
}
function fecharIdSheet(e){
  if(e && e.target?.id !== 'id-sheet') return;
  const sheet = document.getElementById('id-sheet');
  if(sheet) sheet.classList.remove('open');
  _admAddPendente = null;
}

async function admAdd(){
  if(bloquearSeEncerrada('Partida encerrada. Não é possível adicionar jogadores.')) return;
  const p=G.pelada; const input=document.getElementById('adm-add-nome'); const nome=input.value.trim();
  if(!nome){input.focus();return;}
  const n=normNome(nome);
  if(p.confirmados.find(j=>normNome(j.nome)===n)||(p.naoVao||[]).find(j=>normNome(j.nome)===n)||(p.espera||[]).find(j=>normNome(j.nome)===n)){showToast('Esse nome já está na lista');return;}

  const churras = p.temChurras ?(document.querySelector('#adm-churras-sel .churras-pill.active')?.dataset.val || 'jogo') : null;
  const vaiParaEspera = churras !== 'churras' && peladaLotada(p);

  // Busca matches no cadastro de peladeiros
  const jogadores = await _buscarJogadoresCadastrados();
  const matches = _encontrarMatchesCadastro(nome, jogadores);

  const _executarAdd = async (nomeUsar, modalidade, jogadorId) => {
    try{
      const pos = jogadorId ? (jogadores.find(j=>j.id===jogadorId)?.posicao_favorita || null) : null;
      const row = await dbConfirmar(p.id, nomeUsar, churras, vaiParaEspera?'espera':'confirmado', jogadorId, pos);
      // Persiste modalidade correta no banco
      if(modalidade === 'mensalista'){
        await dbAtualizar(row.id, { modalidade: 'mensalista' });
      }
      const novo={id:row.id, jogador_id:jogadorId||null, nome:nomeUsar, pos:pos||'?', time:'pool', pago:false, modalidade, churras};
      if(vaiParaEspera){
        p.espera.push(novo);
      } else {
        p.confirmados.push(novo);
        if(churras !== 'churras') p.jogadores.push({...novo});
      }
      input.value=''; input.focus(); renderAdmConf(); renderAdmFin();
      showToast(vaiParaEspera?'Jogador adicionado à espera!':'Jogador adicionado!');
    }catch(e){ showToast('Erro ao adicionar jogador.'); }
  };

  // Fluxo 4: nome parecido com alguém já confirmado na pelada → alerta de possível duplicata
  const todosNaPelada = [
    ...(p.confirmados || []),
    ...(p.espera      || []),
    ...(p.naoVao      || []),
  ];
  const similaresNaPelada = todosNaPelada.filter(j => {
    const jn = normNome(j.nome);
    return jn !== n && (jn.includes(n) || n.includes(jn) || _levenshtein(n, jn) <= 2);
  });
  if(similaresNaPelada.length > 0){
    _abrirSheetDuplicataPelada(similaresNaPelada, nome, async (confirmaNovoJogador) => {
      if(!confirmaNovoJogador) return; // ADM cancelou ou era duplicata
      // Segue para os fluxos normais de cadastro
      await _resolverFluxosCadastro(nome, n, matches, jogadores, _executarAdd);
    });
    return;
  }

  // Fluxos 1, 2 e 3: sem similar na pelada, segue para lookup no cadastro
  await _resolverFluxosCadastro(nome, n, matches, jogadores, _executarAdd);
}

// -- Distância de Levenshtein (máx. 2 edições para pegar erros de digitação) --
function _levenshtein(a, b){
  const m = a.length, ln = b.length;
  if(Math.abs(m - ln) > 2) return 99;
  const dp = [];
  for(let i=0;i<=m;i++){ dp[i]=[]; for(let j=0;j<=ln;j++) dp[i][j]=i===0?j:j===0?i:0; }
  for(let i=1;i<=m;i++) for(let j=1;j<=ln;j++)
    dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][ln];
}

// -- Sheet de alerta de duplicata na pelada (Fluxo 4) --
function _abrirSheetDuplicataPelada(similares, nomeDigitado, callback){
  const lista = document.getElementById('id-sheet-lista');
  const sheet = document.getElementById('id-sheet');
  if(!lista || !sheet){ callback(true); return; }

  lista.innerHTML =
    `<div style="background:var(--warn-bg,#fffbe6);border:1px solid var(--warn-border,#f5e07a);border-radius:10px;padding:12px 14px;margin-bottom:4px;">
      <div style="font-size:13px;font-weight:600;color:var(--warn-text,#7a6000);margin-bottom:6px;"><i class="ti ti-alert-triangle"></i> Possível duplicata na pelada</div>
      <div style="font-size:12px;color:var(--warn-text,#7a6000);line-height:1.5;">O nome <strong>"${escHtml(nomeDigitado)}"</strong> é parecido com quem já está na lista:</div>
    </div>` +
    similares.map(j =>
      `<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;">
        <div class="avatar" style="flex-shrink:0;">${escHtml((j.nome[0]||'?').toUpperCase())}</div>
        <span style="font-size:14px;font-weight:600;flex:1;">${escHtml(j.nome)}</span>
      </div>`
    ).join('') +
    `<button class="id-sheet-opt id-sheet-opt-new" onclick="_responderDuplicata(true)">
      <span class="id-sheet-nome">➕ São pessoas diferentes, adicionar mesmo assim</span>
    </button>`;

  // Guarda callback temporariamente
  _admAddPendente = { nomeDigitado, onConfirm: (ok) => { callback(ok); } };

  // Troca o título do sheet
  const titulo = sheet.querySelector('.adm-sheet-title');
  if(titulo) titulo.innerHTML = '<i class="ti ti-user-search" style="font-size:18px;margin-right:6px;"></i> Verificar duplicata';
  const subtitulo = sheet.querySelector('div[style*="font-size:13px"]');
  if(subtitulo) subtitulo.style.display = 'none';

  sheet.classList.add('open');
}
function _responderDuplicata(confirma){
  const sheet = document.getElementById('id-sheet');
  if(sheet) sheet.classList.remove('open');
  // Restaura título padrão do sheet
  const titulo = sheet && sheet.querySelector('.adm-sheet-title');
  if(titulo) titulo.innerHTML = '<i class="ti ti-user-search" style="font-size:18px;margin-right:6px;"></i> Quem é esse jogador?';
  const subtitulo = sheet && sheet.querySelector('div[style*="font-size:13px"]');
  if(subtitulo) subtitulo.style.display = '';
  if(!_admAddPendente) return;
  const { onConfirm } = _admAddPendente;
  _admAddPendente = null;
  onConfirm(confirma);
}

// -- Resolve fluxos 1, 2 e 3 (lookup no cadastro) --
async function _resolverFluxosCadastro(nome, n, matches, jogadores, _executarAdd){
  // Fluxo 1: match exato e único → adiciona direto com modalidade do cadastro
  if(matches.length === 1){
    const j = matches[0];
    const nomeUsar = j.apelido || j.nome;
    if(normNome(nomeUsar) === n){
      await _executarAdd(nomeUsar, j.modalidade || 'avulso', j.id);
      return;
    }
  }

  // Fluxo 2: match(es) encontrado(s) mas não exato → pede confirmação
  if(matches.length > 0){
    _abrirSheetIdentidade(matches, nome, async (nomeUsar, modalidade, jogadorId) => {
      await _executarAdd(nomeUsar, modalidade, jogadorId);
    });
    return;
  }

  // Fluxo 3: nenhum match → avulso direto
  await _executarAdd(nome, 'avulso', null);
}
async function togglePago(i){
  const j=G.pelada.confirmados[i];
  if(j.modalidade==='mensalista'){showToast('Mensalista não entra na cobrança avulsa.');return;}
  j.pago=!j.pago; renderAdmConf(); renderAdmFin(); renderAdmHome();
  try{await dbAtualizar(j.id,{pago:j.pago});}
  catch(e){j.pago=!j.pago;renderAdmConf();renderAdmFin();renderAdmHome();showToast('Erro ao salvar.');}
}
async function toggleModalidade(i){
  if(bloquearSeEncerrada('Partida encerrada. Não é possível alterar modalidade.')) return;
  const j=G.pelada.confirmados[i];
  const anterior={modalidade:j.modalidade,pago:j.pago,isento:!!j.isento};
  j.modalidade=j.modalidade==='mensalista'?'avulso':'mensalista';
  j.pago=false;
  j.isento=false;
  const jj=G.pelada.jogadores.find(x=>x.id===j.id); if(jj){jj.modalidade=j.modalidade; jj.pago=j.pago; jj.isento=j.isento;}
  renderAdmConf(); renderAdmFin(); renderAdmHome();
  try{await dbAtualizar(j.id,{modalidade:j.modalidade,pago:j.pago,isento:j.isento});}
  catch(e){
    j.modalidade=anterior.modalidade;
    j.pago=anterior.pago;
    j.isento=anterior.isento;
    if(jj){jj.modalidade=j.modalidade; jj.pago=j.pago; jj.isento=j.isento;}
    renderAdmConf(); renderAdmFin(); renderAdmHome();
    showToast('Erro ao salvar modalidade.');
  }
}

async function toggleIsento(i){
  if(bloquearSeEncerrada('Partida encerrada. Não é possível alterar isenção.')) return;
  const j=G.pelada.confirmados[i];
  if(j.modalidade!=='avulso'){showToast('Só avulsos podem ser isentos.');return;}
  const anterior={isento:!!j.isento,pago:j.pago};
  j.isento=!j.isento;
  if(j.isento) j.pago=false;
  const jj=G.pelada.jogadores.find(x=>x.id===j.id); if(jj){jj.isento=j.isento; jj.pago=j.pago;}
  renderAdmConf(); renderAdmFin(); renderAdmHome();
  try{await dbAtualizar(j.id,{isento:j.isento,pago:j.pago});}
  catch(e){
    j.isento=anterior.isento;
    j.pago=anterior.pago;
    if(jj){jj.isento=j.isento; jj.pago=j.pago;}
    renderAdmConf(); renderAdmFin(); renderAdmHome();
    showToast('Erro ao salvar.');
  }
}
async function remConf(i){ if(bloquearSeEncerrada('Partida encerrada. Não é possível remover jogadores.')) return; const j=G.pelada.confirmados[i]; try{await dbDeletar(j.id); G.pelada.confirmados.splice(i,1); G.pelada.jogadores=G.pelada.jogadores.filter(jg=>jg.id!==j.id); renderAdmConf(); showToast('Removido');}catch(e){showToast('Erro ao remover.');} }
async function promoverEspera(i){
  if(bloquearSeEncerrada('Partida encerrada. Não é possível alterar confirmações.')) return;
  const p=G.pelada; p.espera=p.espera||[];
  const j=p.espera[i]; if(!j)return;
  if(peladaLotada(p)){showToast('Pelada lotada para jogo!');return;}
  try{
    await dbAtualizar(j.id,{status:'confirmado',time:'pool',posicao:'?'});
    p.espera.splice(i,1);
    p.confirmados.push(j);
    p.jogadores.push({...j});
    renderAdmConf(); renderAdmFin(); renderAdmHome();
    showToast('Jogador promovido!');
  }catch(e){showToast('Erro ao promover jogador.');}
}
async function remEspera(i){
  if(bloquearSeEncerrada('Partida encerrada. Não é possível remover jogadores.')) return;
  const p=G.pelada; p.espera=p.espera||[];
  const j=p.espera[i]; if(!j)return;
  try{
    await dbDeletar(j.id);
    p.espera.splice(i,1);
    renderAdmConf();
    showToast('Removido da espera');
  }catch(e){showToast('Erro ao remover.');}
}
async function remNaoVai(i){
  if(G.perfil !== 'full'){ showToast('Apenas ADM/Presidente pode excluir.'); return; }
  if(bloquearSeEncerrada('Partida encerrada. Não é possível remover jogadores.')) return;
  const p=G.pelada; p.naoVao=p.naoVao||[]; const j=p.naoVao[i]; if(!j)return;
  const ok=confirm(`Excluir ${j.nome} da lista de Não vão?`);
  if(!ok)return;
  try{
    await dbDeletar(j.id);
    p.naoVao.splice(i,1);
    renderAdmConf();
    showToast('Removido');
  }catch(e){
    showToast('Erro ao remover.');
  }
}
async function moverParaNaoVai(i){
  if(bloquearSeEncerrada('Partida encerrada. Não é possível alterar confirmações.')) return;
  const p=G.pelada; p.naoVao=p.naoVao||[]; const j=p.confirmados[i];
  try{
    await dbAtualizar(j.id,{status:'nao_vai',pago:false,time:'pool'});
    p.confirmados.splice(i,1);
    p.jogadores=p.jogadores.filter(jg=>jg.id!==j.id);
    p.naoVao.push({id:j.id, nome:j.nome});
    renderAdmConf(); renderAdmFin(); showToast('Movido para Não vão');
  }catch(e){ showToast('Erro ao mover jogador.'); }
}
async function voltarNaoVai(i){
  if(bloquearSeEncerrada('Partida encerrada. Não é possível alterar confirmações.')) return;
  const p=G.pelada; p.naoVao=p.naoVao||[]; const item=p.naoVao[i]; if(!item)return;
  if(peladaLotada(p)){showToast('Pelada lotada para jogo!');return;}
  if(p.confirmados.find(j=>normNome(j.nome)===normNome(item.nome))){showToast('Esse nome já está confirmado');return;}
  try{
    await dbAtualizar(item.id,{status:'confirmado',time:'pool',posicao:'?'});
    const novo={id:item.id,nome:item.nome,pos:'?',time:'pool',pago:false,modalidade:'avulso',isento:false,ordem:0};
    p.confirmados.push(novo); p.jogadores.push({...novo});
    p.naoVao.splice(i,1);
    renderAdmConf(); renderAdmFin(); showToast('Jogador confirmado!');
  }catch(e){ showToast('Erro ao confirmar jogador.'); }
}
function compartilharWhatsAppPelada(id){
  const p=G.peladas.find(x=>String(x.id)===String(id)); if(!p)return;
  const msg=`⚽ ${p.nome}\n${fmtData(p.data)} · ${p.hora} · ${p.local}\n\nConfirme presença aqui:\n${linkPelada(p)}`;
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}
function compartilharWhatsApp(){
  const p=G.pelada; if(!p)return;
  const msg=`⚽ ${p.nome}\n${fmtData(p.data)} · ${p.hora} · ${p.local}\n\nConfirme presença aqui:\n${linkPelada(p)}`;
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}

function compartilharConviteCadastroApp(){
  const msg=`Fala, Exilado! ⚽

Agora o cadastro dos jogadores está sendo feito pelo app oficial do Exilados da Bola.

Acesse o link abaixo, crie sua conta e complete seu perfil com nome, apelido, posição e foto:

${appPerfilUrl()}

Depois do cadastro, você já consegue confirmar presença nas próximas peladas com seu usuário identificado.

Bora!`;
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}

// ==========================================
// ADM - JOGADORES
// ==========================================
function jogadorIniciais(j){
  const base=(j.apelido||j.nome||'?').trim();
  return escHtml((base[0]||'?').toUpperCase());
}
function jogadorInstagram(v){
  return String(v||'').trim().replace(/^@+/,'').replace(/\s+/g,'');
}
function jogadorBadge(j){
  const mod=j.modalidade==='mensalista'?'Mensalista':'Avulso';
  const cls=j.modalidade==='mensalista'?'badge-green':'badge-gray';
  const perfil=j.perfil_app&&j.perfil_app!=='jogador'?` <span class="badge badge-red" style="font-size:10px;">${escHtml(j.perfil_app)}</span>`:'';
  return `<span class="badge ${cls}" style="font-size:10px;">${mod}</span>${perfil}${j.ativo===false?' <span class="badge badge-red" style="font-size:10px;">Inativo</span>':''}`;
}
let jogadoresSort='apelido';
function setJogadoresSort(tipo){
  jogadoresSort = tipo === 'nome' ?'nome' : 'apelido';
  renderJogadoresLista();
}
function atualizarJogadoresSortUI(){
  const btnApelido=document.getElementById('jog-sort-apelido');
  const btnNome=document.getElementById('jog-sort-nome');
  if(btnApelido) btnApelido.classList.toggle('active',jogadoresSort==='apelido');
  if(btnNome) btnNome.classList.toggle('active',jogadoresSort==='nome');
}
function chaveOrdenacaoJogador(j){
  const prim = jogadoresSort === 'nome' ?j.nome : (j.apelido||j.nome);
  const sec = jogadoresSort === 'nome' ?(j.apelido||'') : (j.nome||'');
  return [normNome(prim||''), normNome(sec||'')];
}
async function abrirJogadoresAdm(){
  fecharMenu();
  if(!G.podeGerirJogadores){ showToast('Acesso restrito ao ADM/Presidente.'); return; }
  G.pelada = null;
  goTo('s-adm-jogadores');
  await carregarJogadoresAdm();
}
async function carregarJogadoresAdm(){
  const el=document.getElementById('jog-lista');
  if(el) el.innerHTML='<div class="empty"><i class="ti ti-loader" style="animation:spin 1s linear infinite;display:inline-block;"></i>Carregando jogadores</div>';
  try{
    G.jogadores=await dbListarJogadores();
    renderJogadoresLista();
  }catch(e){
    if(el) el.innerHTML='<div class="empty"><i class="ti ti-user-x"></i>Erro ao carregar jogadores</div>';
  }
}
function renderJogadoresLista(){
  const el=document.getElementById('jog-lista'); if(!el)return;
  atualizarJogadoresSortUI();
  const busca=normNome(document.getElementById('jog-busca')?.value||'');
  const arr=(G.jogadores||[]).filter(j=>{
    const texto=normNome([j.nome,j.apelido,j.instagram,j.email,j.telefone].filter(Boolean).join(' '));
    return !busca || texto.includes(busca);
  }).sort((a,b)=>{
    const ka=chaveOrdenacaoJogador(a);
    const kb=chaveOrdenacaoJogador(b);
    return ka[0].localeCompare(kb[0],'pt-BR') || ka[1].localeCompare(kb[1],'pt-BR');
  });
  if(!arr.length){ el.innerHTML='<div class="empty"><i class="ti ti-users"></i>Nenhum jogador encontrado</div>'; return; }
  el.innerHTML=arr.map(j=>{
    const insta=j.instagram?`<span><i class="ti ti-brand-instagram" style="font-size:11px;"></i> @${escHtml(j.instagram)}</span>`:'';
    const pos=j.posicao_favorita?`<span>${posBadge(j.posicao_favorita)}</span>`:'';
    const contato=j.telefone?`<span><i class="ti ti-brand-whatsapp" style="font-size:11px;"></i> ${escHtml(j.telefone)}</span>`:'';
    const foto=j.foto_url ?`<img src="${escHtml(j.foto_url)}" alt="" />` : jogadorIniciais(j);
    const nomePrincipal=j.apelido||j.nome||'Jogador';
    const nomeCompleto=j.apelido&&j.nome&&normNome(j.nome)!==normNome(j.apelido)?` <span>${escHtml(j.nome)}</span>`:'';
    return `<div class="jog-row" onclick="editarJogadorAdm('${j.id}')">
      <div class="jog-avatar">${foto}</div>
      <div class="jog-info">
        <div class="jog-name">${escHtml(nomePrincipal)}${nomeCompleto}</div>
        <div class="jog-meta">${[insta,contato,pos].filter(Boolean).join('')}</div>
      </div>
      <div class="jog-badges">${jogadorBadge(j)}</div>
    </div>`;
  }).join('');
}
function preencherFormJogador(j){
  document.getElementById('jog-id').value=j?.id||'';
  document.getElementById('jog-nome').value=j?.nome||'';
  document.getElementById('jog-apelido').value=j?.apelido||'';
  document.getElementById('jog-instagram').value=j?.instagram?`@${j.instagram}`:'';
  document.getElementById('jog-email').value=j?.email||'';
  document.getElementById('jog-telefone').value=formatarTelefone(j?.telefone||'');
  document.getElementById('jog-foto').value=j?.foto_url||'';
  document.getElementById('jog-nascimento').value=dataIsoParaBr(j?.data_nascimento||'');
  document.getElementById('jog-pos').value=j?.posicao_favorita||'';
  document.getElementById('jog-modalidade').value=j?.modalidade||'avulso';
  document.getElementById('jog-ativo').value=String(j?.ativo!==false);
  document.getElementById('jog-perfil-app').value=j?.perfil_app||'jogador';
  document.getElementById('jog-perfil-wrap').style.display=G.superAdmin?'block':'none';
  document.getElementById('jog-form-title').textContent=j?.id?'Editar jogador':'Novo jogador';
  const excluirBtn=document.getElementById('jog-excluir-btn');
  if(excluirBtn) excluirBtn.style.display=j?.id?'flex':'none';
  atualizarPreviewJogador();
}
function atualizarPreviewJogador(){
  const box=document.getElementById('jog-foto-preview'); if(!box)return;
  const url=document.getElementById('jog-foto')?.value.trim();
  const nome=document.getElementById('jog-nome')?.value.trim()||'?';
  box.innerHTML=url?`<img src="${escHtml(url)}" alt="" />`:escHtml((nome[0]||'?').toUpperCase());
}
async function uploadFotoJogadorAdm(file){
  if(!file) return;
  if(!G.podeGerirJogadores){ showToast('Acesso restrito ao ADM/Presidente.'); return; }
  const id=document.getElementById('jog-id').value || 'novo';
  const nome=document.getElementById('jog-nome').value.trim() || 'jogador';
  const slug=normNome(nome).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'jogador';
  const owner=G.usuario?.id || 'adm';
  showToast('Preparando foto...');
  try{
    const foto=await prepararFotoUpload(file);
    const path=`${owner}/adm-${id}-${slug}-${Date.now()}.${extensaoFotoUpload(foto)}`;
    showToast('Enviando foto...');
    const { error } = await _sbClient.storage.from('jogador-fotos').upload(path,foto,{upsert:false,contentType:contentTypeFotoUpload(foto)});
    if(error) throw error;
    const { data:pub } = _sbClient.storage.from('jogador-fotos').getPublicUrl(path);
    document.getElementById('jog-foto').value=pub.publicUrl;
    atualizarPreviewJogador();
    showToast('Foto enviada. Salve o jogador para gravar.');
  }catch(e){
    console.error('Erro ao enviar foto do jogador:', e);
    if(erroStoragePolicy(e)){
      try{
        const dataUrl=await fotoParaDataUrl(file);
        document.getElementById('jog-foto').value=dataUrl;
        atualizarPreviewJogador();
        showToast('Foto preparada. Salve o jogador para gravar.');
        return;
      }catch(fallbackErr){
        console.error('Erro no fallback da foto do jogador:', fallbackErr);
      }
    }
    showToast(e?.message || 'Erro ao enviar foto.');
  }
}
function novoJogadorAdm(){
  preencherFormJogador(null);
  document.getElementById('jog-form-card').style.display='block';
  document.getElementById('jog-nome').focus();
}
function editarJogadorAdm(id){
  const j=(G.jogadores||[]).find(x=>String(x.id)===String(id));
  if(!j)return;
  preencherFormJogador(j);
  document.getElementById('jog-form-card').style.display='block';
  document.getElementById('jog-form-card').scrollIntoView({behavior:'smooth',block:'start'});
}
function fecharFormJogador(){
  document.getElementById('jog-form-card').style.display='none';
}
async function salvarJogadorAdm(){
  if(!G.podeGerirJogadores){ showToast('Acesso restrito ao ADM/Presidente.'); return; }
  const id=document.getElementById('jog-id').value;
  const nome=document.getElementById('jog-nome').value.trim();
  const apelido=document.getElementById('jog-apelido').value.trim();
  const nascimento=document.getElementById('jog-nascimento').value.trim();
  const dataNascimento=nascimento?dataBrParaIso(nascimento):null;
  if(!nome){ document.getElementById('jog-nome').focus(); showToast('Informe o nome do jogador.'); return; }
  if(!apelido){ document.getElementById('jog-apelido').focus(); showToast('Informe o apelido do jogador.'); return; }
  if(nascimento && !dataNascimento){ document.getElementById('jog-nascimento').focus(); showToast('Informe a data no formato DD/MM/AAAA.'); return; }
  const fields={
    nome,
    apelido,
    instagram:jogadorInstagram(document.getElementById('jog-instagram').value)||null,
    email:document.getElementById('jog-email').value.trim()||null,
    telefone:formatarTelefone(document.getElementById('jog-telefone').value)||null,
    foto_url:document.getElementById('jog-foto').value.trim()||null,
    data_nascimento:dataNascimento,
    posicao_favorita:document.getElementById('jog-pos').value||null,
    modalidade:document.getElementById('jog-modalidade').value||'avulso',
    ativo:document.getElementById('jog-ativo').value==='true',
    updated_at:new Date().toISOString(),
  };
  if(G.superAdmin) fields.perfil_app=document.getElementById('jog-perfil-app').value||'jogador';
  showToast('Salvando...');
  try{
    if(id) await dbAtualizarJogador(id,fields);
    else await dbCriarJogador(fields);
    await carregarJogadoresAdm();
    fecharFormJogador();
    showToast('Jogador salvo!');
  }catch(e){
    showToast('Erro ao salvar jogador.');
  }
}
async function excluirJogadorAdm(){
  if(!G.podeGerirJogadores){ showToast('Acesso restrito ao ADM/Presidente.'); return; }
  const id=document.getElementById('jog-id')?.value;
  if(!id){ showToast('Selecione um jogador para excluir.'); return; }
  const j=(G.jogadores||[]).find(x=>String(x.id)===String(id));
  const nome=j?.nome||document.getElementById('jog-nome')?.value.trim()||'este jogador';
  const apelido=j?.apelido||document.getElementById('jog-apelido')?.value.trim()||'';
  if(!confirm(`Excluir ${nome} da base de jogadores?Essa ação não pode ser desfeita.`)) return;
  showToast('Excluindo jogador...');
  try{
    await dbExcluirVotosDoJogador([nome, apelido]);
    await dbExcluirJogador(id);
    await carregarJogadoresAdm();
    fecharFormJogador();
    showToast('Jogador excluído!');
  }catch(e){
    console.error('Erro ao excluir jogador', e);
    showToast('Erro ao excluir jogador.');
  }
}

// ==========================================
// ADM - TIMES
// ==========================================
function renderAdmTimes(){
  const p=G.pelada; if(!p)return;
  // Reseta estilo de todos os botões do nav
  document.querySelectorAll('#s-adm-times .nav-btn').forEach(btn=>{
    btn.style.opacity=''; btn.style.pointerEvents='';
  });
  document.getElementById('atimes-nome').textContent=p.nome.toUpperCase();
  document.getElementById('atimes-meta').textContent=`${fmtData(p.data)} · ${p.hora} · ${p.local}`;
  const pool=p.jogadores.filter(j=>j.time==='pool');
  const tA=p.jogadores.filter(j=>j.time==='azul');
  const tB=p.jogadores.filter(j=>j.time==='vermelho');
  document.getElementById('at-cnt-a').textContent=tA.length+' jog.';
  document.getElementById('at-cnt-b').textContent=tB.length+' jog.';
  document.getElementById('at-pool-cnt').textContent=pool.length;
  renderAtTeam('at-team-a',tA,'azul','at-dz-a');
  renderAtTeam('at-team-b',tB,'vermelho','at-dz-b');
  renderAtPool(pool);
  const alerta=document.getElementById('at-gol-alert');
  if(alerta){
    const faltaA=tA.length>0 && !tA.some(j=>j.pos==='GOL');
    const faltaB=tB.length>0 && !tB.some(j=>j.pos==='GOL');
    if(faltaA||faltaB){ alerta.style.display='flex'; alerta.querySelector('span').textContent='Atenção: '+[faltaA?'Time Azul sem goleiro':null,faltaB?'Time Vermelho sem goleiro':null].filter(Boolean).join(' · '); }
    else alerta.style.display='none';
  }
}
function renderAtTeam(cid,list,t,dz){
  document.getElementById(cid).innerHTML=list.map((j,i)=>`<div class="team-slot editable"><div class="slot-av ${t==='azul'?'b':'r'}">${escHtml(j.nome[0]||'?').toUpperCase()}</div><span class="slot-name">${escHtml(j.nome)}</span><div class="slot-controls">${posSelect(j)}<div class="slot-order-btns"><button class="btn-order" onclick="moverOrdem('${j.id}','${t}',-1)" title="Subir" ${i===0?'disabled':''}>↑</button><button class="btn-order" onclick="moverOrdem('${j.id}','${t}',1)" title="Descer" ${i===list.length-1?'disabled':''}>↓</button></div><button class="btn-rm-time" onclick="rmTime('${j.id}')" title="Devolver para sem time"><i class="ti ti-trash" style="font-size:13px;"></i></button></div></div>`).join('');
}
function renderAtPool(list){
  const el=document.getElementById('at-pool');
  el.innerHTML=list.length?list.map(j=>`<div class="pool-item"><div class="pool-av drag-handle" draggable="true" ondragstart="ds(event,'${j.id}')" ondragend="de()" title="Arraste para o time">${escHtml(j.nome[0]||'?').toUpperCase()}</div><span style="flex:1;min-width:0;font-size:13px;font-weight:500;">${escHtml(j.nome)}</span>${posSelect(j)}<div class="assign-btns"><button class="assign-btn ab-blue" onclick="moverJogadorTime('${j.id}','azul')">Azul</button><button class="assign-btn ab-red" onclick="moverJogadorTime('${j.id}','vermelho')">Verm.</button></div></div>`).join('')
    :'<div style="padding:8px;font-size:12px;color:var(--text3);">Todos escalados!</div>';
}
function renderAtAll(){
  const p=G.pelada;
  document.getElementById('at-all').innerHTML=p.jogadores.length?p.jogadores.map(j=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:var(--surface2);margin-bottom:6px;"><div class="pool-av" style="width:26px;height:26px;font-size:10px;">${escHtml(j.nome[0]||'?').toUpperCase()}</div><span style="flex:1;font-size:13px;font-weight:500;">${escHtml(j.nome)}</span>${posSelect(j)}<span style="font-size:11px;color:var(--text2);min-width:50px;text-align:right;">${j.time==='pool'?'sem time':j.time==='azul'?'Azul':'Verm.'}</span><button class="btn-sm btn-danger" onclick="rmJog('${j.id}')" style="padding:4px 7px;"><i class="ti ti-trash" style="font-size:12px;"></i></button></div>`).join('')
    :'<div class="empty" style="padding:12px 0;">Nenhum jogador</div>';
}
async function setPos(id,pos){ if(bloquearSeEncerrada('Partida encerrada. Não é possível alterar posições.')) return; const p=G.pelada; [p.jogadores,p.confirmados].forEach(arr=>{const j=arr.find(x=>x.id===id);if(j)j.pos=pos;}); renderAdmTimes(); try{await dbAtualizar(id,{posicao:pos});}catch(e){showToast('Erro ao salvar posição.');} }

async function moverJogadorTime(id,time){
  if(bloquearSeEncerrada('Partida encerrada. Não é possível alterar escalações.')) return;
  const p=G.pelada;
  if(!p)return;
  const timeValido = ['azul','vermelho','pool'].includes(time) ?time : 'pool';
  let achou=false;
  [p.jogadores,p.confirmados].forEach(arr=>{
    const j=arr.find(x=>String(x.id)===String(id));
    if(j){
      j.time=timeValido;
      if(timeValido==='pool') j.ordem=0;
      achou=true;
    }
  });
  if(!achou){ showToast('Jogador não encontrado.'); return; }
  renderAdmTimes();
  try{
    await dbAtualizar(id,{time:timeValido, ...(timeValido==='pool'?{ordem:0}:{})});
  }catch(e){
    showToast('Erro ao salvar a alteração do time.');
  }
}

async function rmTime(id){ await moverJogadorTime(id,'pool'); }
async function removerDoTime(id){ await moverJogadorTime(id,'pool'); }
async function moverOrdem(id,time,dir){
  if(bloquearSeEncerrada('Partida encerrada. Não é possível alterar escalações.')) return;
  const p=G.pelada; if(!p)return;
  const doTime=p.jogadores.filter(j=>j.time===time);
  const idx=doTime.findIndex(j=>j.id===id);
  const novoIdx=idx+dir;
  if(novoIdx<0||novoIdx>=doTime.length)return;
  [doTime[idx],doTime[novoIdx]]=[doTime[novoIdx],doTime[idx]];
  doTime.forEach((j,i)=>j.ordem=i);
  const outros=p.jogadores.filter(j=>j.time!==time);
  p.jogadores.length=0; p.jogadores.push(...outros,...doTime);
  p.jogadores.forEach(jg=>{ const c=p.confirmados.find(x=>x.id===jg.id); if(c)c.ordem=jg.ordem; });
  renderAdmTimes();
  try{
    await Promise.all([
      dbAtualizar(doTime[idx].id,{ordem:doTime[idx].ordem}),
      dbAtualizar(doTime[novoIdx].id,{ordem:doTime[novoIdx].ordem}),
    ]);
  }catch(e){showToast('Erro ao salvar ordem.');}
}
async function mvTo(id,t){ await moverJogadorTime(id,t); }
async function rmJog(id){ if(bloquearSeEncerrada('Partida encerrada. Não é possível remover jogadores.')) return; const p=G.pelada; try{await dbDeletar(id); p.jogadores=p.jogadores.filter(j=>j.id!==id); p.confirmados=p.confirmados.filter(j=>j.id!==id); renderAdmTimes(); showToast('Removido');}catch(e){showToast('Erro ao remover.');} }
async function atAdd(){ if(bloquearSeEncerrada('Partida encerrada. Não é possível adicionar jogadores.')) return; const p=G.pelada; const nome=document.getElementById('at-add-nome').value.trim(); if(!nome)return; const pos=document.getElementById('at-add-pos').value; const time=document.getElementById('at-add-time').value;
  try{ const row=await sbFetch('/confirmacoes',{method:'POST',body:JSON.stringify({pelada_id:p.id,nome,posicao:pos,time,pago:false,modalidade:'avulso'})}); const novo={id:row[0].id,nome,pos,time,pago:false,modalidade:'avulso'}; p.jogadores.push({...novo}); p.confirmados.push(novo); document.getElementById('at-add-nome').value=''; renderAdmTimes(); showToast('Adicionado!');
  }catch(e){ showToast('Erro ao adicionar.'); }
}

async function limparTimes(){
  if(bloquearSeEncerrada('Partida encerrada. Não é possível limpar times.')) return;
  const p=G.pelada; if(!p)return;
  abrirConfirmSheet(
    'Limpar times',
    'Todos os jogadores voltarão para "sem time". Essa ação não pode ser desfeita.',
    'Limpar times',
    async () => {
      p.jogadores.forEach(j=>j.time='pool'); p.confirmados.forEach(j=>j.time='pool');
      renderAdmTimes();
      try{ await Promise.all(p.jogadores.map(j=>dbAtualizar(j.id,{time:'pool'}))); showToast('Times limpos.'); }
      catch(e){ showToast('Times limpos na tela, mas houve erro ao salvar.'); }
    }
  );
}
function compartilharTimes(){
  const p=G.pelada; if(!p)return;
  const tA=p.jogadores.filter(j=>j.time==='azul');
  const tB=p.jogadores.filter(j=>j.time==='vermelho');
  const pool=p.jogadores.filter(j=>j.time==='pool');
  const lista=arr=>arr.length?arr.map(j=>`- ${j.nome}${j.pos&&j.pos!=='?'?' ('+j.pos+')':''}`).join('\n'):'- nenhum';
  const msg=`⚽ ${p.nome}\n${fmtData(p.data)} · ${p.hora} · ${p.local}\n\n🔵 Time Azul\n${lista(tA)}\n\n🔴 Time Vermelho\n${lista(tB)}${pool.length?`\n\n⏳ Sem time\n${lista(pool)}`:''}`;
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}

// Drag & drop
function ds(e,id){drag=id;e.dataTransfer.effectAllowed='move';}
function de(){document.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));}
function allowDrop(e){e.preventDefault();e.currentTarget.classList.add('drag-over');}
async function dropTo(e,t){e.preventDefault();e.stopPropagation();document.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));if(bloquearSeEncerrada('Partida encerrada. Não é possível alterar escalações.')){drag=null;return;}if(drag){const id=drag;drag=null;await moverJogadorTime(id,t);}}

// ==========================================
// ADM - FINANCEIRO
// ==========================================
function renderAdmFin(){
  const p=G.pelada; if(!p)return;
  document.getElementById('afin-meta').textContent=`${fmtData(p.data)} · ${p.hora} · ${p.local||''}`;

  // Valor do churras para avulsos (lido da config global; fallback 0)
  const valorChurras = Number(G.valorChurras||0);

  // Função que retorna o valor total que um jogador deve pagar
  function valorJogador(j){
    if(j.modalidade==='mensalista'||j.isento) return 0;
    let v = p.valor;
    if(p.temChurras && j.churras==='jogo_churras') v += valorChurras;
    if(p.temChurras && j.churras==='churras')      v  = valorChurras;
    return v;
  }

  // Separar grupos
  const mensalistas = p.confirmados.filter(j=>j.modalidade==='mensalista');
  const isentos     = p.confirmados.filter(j=>j.modalidade==='avulso'&&j.isento);
  // Avulsos do jogo (jogo | jogo_churras | null quando não tem churras)
  const avulsosJogo = p.confirmados.filter(j=>j.modalidade!=='mensalista'&&!j.isento&&(j.churras!=='churras'));
  // Só churras
  const soChurras   = p.temChurras ?p.confirmados.filter(j=>j.churras==='churras'&&j.modalidade!=='mensalista'&&!j.isento) : [];

  const cobraveis   = [...avulsosJogo, ...soChurras];
  const pagos       = cobraveis.filter(j=>j.pago);
  const pendentes   = cobraveis.filter(j=>!j.pago);

  const arr     = pagos.reduce((s,j)=>s+valorJogador(j),0);
  const pend    = pendentes.reduce((s,j)=>s+valorJogador(j),0);
  const tot     = cobraveis.reduce((s,j)=>s+valorJogador(j),0);
  const perc    = tot?Math.round((arr/tot)*100):0;

  document.getElementById('fin-arr').textContent=money(arr);
  document.getElementById('fin-pend').textContent=money(pend);
  document.getElementById('fin-tot').textContent=money(tot);
  document.getElementById('fin-resumo-titulo').textContent=pendentes.length?`${pendentes.length} pendente${pendentes.length===1?'':'s'}`:'Tudo certo por aqui';
  document.getElementById('fin-resumo-sub').textContent=`${pagos.length}/${cobraveis.length} avulsos pagos · ${mensalistas.length} mensalista${mensalistas.length===1?'':'s'} · ${isentos.length} isento${isentos.length===1?'':'s'}`;
  document.getElementById('fin-status-pill').textContent=`${perc}% recebido`;
  document.getElementById('fin-status-pill').className='fin-pill'+(pendentes.length?' warn':'');
  document.getElementById('fin-progress').style.width=perc+'%';
  document.getElementById('fin-progress-left').textContent=`Recebido ${money(arr)}`;
  document.getElementById('fin-progress-right').textContent=`Falta ${money(pend)}`;

  const el=document.getElementById('fin-lista');
  if(!p.confirmados.length){el.innerHTML='<div class="empty"><i class="ti ti-cash"></i>Nenhum jogador confirmado</div>';return;}

  const modLabel=(j)=>{
    if(j.modalidade==='mensalista') return 'Mensalista · não entra no rateio avulso';
    if(j.isento)                    return 'Isento desta rodada';
    const v = valorJogador(j);
    const temC = p.temChurras && (j.churras==='jogo_churras'||j.churras==='churras');
    return (temC?'Avulso 🍖':'Avulso')+' · '+money(v);
  };
  const btnAvulsoLabel=(j)=>{
    if(p.temChurras && (j.churras==='jogo_churras'||j.churras==='churras')) return 'Avulso 🍖';
    return 'Avulso';
  };
  const pagoDisabled=(j)=>j.modalidade!=='avulso'||j.isento;

  const row=(j,i)=>`<div class="fin-row">
    <div class="avatar">${escHtml(j.nome[0]||'?').toUpperCase()}</div>
    <div class="fin-person">
      <div class="fin-name">${escHtml(j.nome)}</div>
      <div class="fin-meta">${modLabel(j)}</div>
    </div>
    <div class="fin-row-actions">
      <button class="btn-mini btn-mini-muted" onclick="toggleModalidade(${i})">${j.modalidade==='mensalista'?'Mensalista':btnAvulsoLabel(j)}</button>
      ${j.modalidade==='avulso'?`<button class="btn-mini ${j.isento?'btn-mini-muted':''}" onclick="toggleIsento(${i})" style="${j.isento?'background:var(--surface2);color:var(--text2);':''}">Isento</button>`:''}
      <button class="btn-mini ${j.pago?'btn-mini-pay':'btn-mini-pend'}" onclick="togglePago(${i})" ${pagoDisabled(j)?'disabled style="opacity:.45;cursor:not-allowed;"':''}>${pagoDisabled(j)?'—':(j.pago?'✓ Pago':'Pendente')}</button>
    </div>
  </div>`;

  const pendHtml    = pendentes.length?pendentes.map(j=>row(j,p.confirmados.indexOf(j))).join(''):'<div class="empty" style="padding:12px 0;">Nenhum avulso pendente</div>';
  const soChurrasPagos = soChurras.filter(j=>j.pago);
  const soChurHtml  = soChurrasPagos.length?soChurrasPagos.map(j=>row(j,p.confirmados.indexOf(j))).join(''):'<div class="empty" style="padding:12px 0;">Nenhum jogador</div>';
  const pagosHtml   = pagos.length?pagos.map(j=>row(j,p.confirmados.indexOf(j))).join(''):'<div class="empty" style="padding:12px 0;">Nenhum avulso pago ainda</div>';
  const mensHtml    = mensalistas.length?mensalistas.map(j=>row(j,p.confirmados.indexOf(j))).join(''):'<div class="empty" style="padding:12px 0;">Nenhum mensalista</div>';
  const isentosHtml = isentos.length?isentos.map(j=>row(j,p.confirmados.indexOf(j))).join(''):'';

  const soChurSection = p.temChurras&&soChurrasPagos.length
    ?`<div class="fin-section"><div class="section-title">Só Churras 🍖 (${soChurrasPagos.length})</div>${soChurHtml}</div>`
    : '';

  el.innerHTML=`<div class="fin-section"><div class="section-title">Pendentes (${pendentes.length})</div>${pendHtml}</div>
  ${soChurSection}
  <div class="fin-section"><div class="section-title">Pagos (${pagos.length})</div>${pagosHtml}</div>
  <div class="fin-section"><div class="section-title">Mensalistas (${mensalistas.length})</div>${mensHtml}</div>
  ${isentos.length?`<div class="fin-section"><div class="section-title">Isentos (${isentos.length})</div>${isentosHtml}</div>`:''}`;
}

async function marcarTodosPagos(){
  const p=G.pelada; if(!p)return;
  const pendentes=p.confirmados.filter(j=>j.modalidade!=='mensalista'&&!j.isento&&!j.pago);
  if(!pendentes.length){showToast('Nenhum pendente.');return;}
  abrirConfirmSheet(
    'Marcar todos como pagos',
    `${pendentes.length} jogador${pendentes.length===1?'':'es'} pendente${pendentes.length===1?'':'s'} será${pendentes.length===1?'':'ão'} marcado${pendentes.length===1?'':'s'} como pago.`,
    'Confirmar pagamentos',
    async () => {
      pendentes.forEach(j=>j.pago=true);
      renderAdmFin(); renderAdmConf(); renderAdmHome();
      try{
        await Promise.all(pendentes.map(j=>dbAtualizar(j.id,{pago:true})));
        const valorChurrasM = Number(G.valorChurras||0);
        function valorJogadorM(j){
          if(j.modalidade==='mensalista'||j.isento) return 0;
          let v = p.valor;
          if(p.temChurras && j.churras==='jogo_churras') v += valorChurrasM;
          if(p.temChurras && j.churras==='churras')      v  = valorChurrasM;
          return v;
        }
        await Promise.all(pendentes.map(async j=>{
          const refId='avulso_'+j.id;
          const exist=await dbGetMovimentoPorRef('avulso',refId);
          if(!exist){
            await dbInserirMovimento({
              data:new Date().toISOString().slice(0,10),
              tipo:'entrada',origem:'avulso',
              categoria:'avulso',
              descricao:`${j.nome} — ${p.nome}`,
              valor:valorJogadorM(j),
              referencia_id:refId
            });
          }
        }));
        showToast('Pagamentos atualizados.');
      }catch(e){ showToast('Atualizado na tela, mas houve erro ao salvar.'); }
    }
  );
}

function cobrarPendentes(){
  const p=G.pelada; if(!p)return;
  const pendentes=p.confirmados.filter(j=>j.modalidade!=='mensalista'&&!j.isento&&!j.pago);
  if(!pendentes.length){showToast('Sem pendências para cobrar.');return;}
  const nomes=pendentes.map(j=>`- ${j.nome}`).join('\n');
  const msg=`⚽ ${p.nome}\n${fmtData(p.data)} · ${p.hora} · ${p.local}\n\nPendências de pagamento:\n${nomes}\n\nValor avulso: ${money(p.valor)}\nPor favor, regularizem o pagamento da rodada.`;
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}

function atualizarSaudacaoLogin(){
  const h = new Date().getHours();
  let saudacao = 'Bom dia';
  if(h >= 12 && h < 18) saudacao = 'Boa tarde';
  else if(h >= 18 || h < 5) saudacao = 'Boa noite';
  const el = document.getElementById('login-sauda');
  if(el) el.textContent = `${saudacao}, Exilado!`;
}



