// Exilados da Bola
// Core: estado, Supabase base, navegacao e utilitarios
// Extraido de app.js para reduzir o monolito mantendo o comportamento global atual.

// ==========================================
// ESTADO
// ==========================================
// -- Supabase -------------------------------------------------------------
const SUPABASE_URL = 'https://ksebcxtuwsdmoykgflmq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2eq7EqQ1WW9auTHIueYecA_zqfwDKmG';
const APP_BASE_URL = 'https://exiladosdabola.com';
const SUPER_ADMIN_EMAIL = 'mr.guima@gmail.com';

let G = {
  isAdm:   false,
  perfil:  'jogador',  // 'jogador' | 'full' | 'escalador'
  perfilApp: 'jogador',
  superAdmin: false,
  podeGerirJogadores: false,
  usuario: null,
  jogadorLogado: null,
  peladas: [],
  jogadores: [],
  pelada:  null,
  meuNome: '',
  editandoPeladaId: null,
  appContext: 'player',
  perfilOrigem: 'player',
};
let uid = 100, drag = null;

async function getSupabaseAccessToken(){
  try{
    const { data } = await _sbClient.auth.getSession();
    return data && data.session && data.session.access_token ? data.session.access_token : SUPABASE_KEY;
  }catch(e){
    return SUPABASE_KEY;
  }
}

async function sbHeaders(opts={}){
  const token = await getSupabaseAccessToken();
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer '+token,
    'Content-Type': 'application/json',
    'Prefer': opts.prefer||'return=representation',
  };
}

async function sbFetch(path, opts={}) {
  const headers = await sbHeaders(opts);
  const r = await fetch(SUPABASE_URL+'/rest/v1'+path, {
    ...opts,
    headers:{...headers, ...(opts.headers||{})},
  });
  if(!r.ok){ const e=await r.text(); console.error('SB erro:',e); throw new Error(e); }
  const txt=await r.text(); return txt?JSON.parse(txt):null;
}

async function dbCarregarPeladas() {
  const rows=await sbFetch('/peladas?order=data.desc');
  G.peladas=rows.map(r=>({
    id:r.id, nome:r.nome, data:r.data, hora:r.hora.slice(0,5),
    local:r.local, valor:Number(r.valor), max:r.max_jogadores,
    status:r.status, reaberta:r.reaberta||false,
    temChurras:r.tem_churras||false, resultado:null, confirmados:[], jogadores:[], naoVao:[], espera:[],
  }));
  if(G.peladas.length){
    const ids=G.peladas.map(p=>p.id).join(',');
    const [confs, resultados]=await Promise.all([
      sbFetch('/confirmacoes?pelada_id=in.('+ids+')&order=ordem.asc,created_at.asc'),
      sbFetch('/resultados_pelada?pelada_id=in.('+ids+')')
    ]);
    (resultados||[]).forEach(r=>{
      const p=G.peladas.find(x=>x.id===r.pelada_id);
      if(!p)return;
      p.resultado={
        id:r.id,
        gols_azul:Number(r.gols_azul)||0,
        gols_vermelho:Number(r.gols_vermelho)||0,
      };
    });
    confs.forEach(c=>{
      const p=G.peladas.find(x=>x.id===c.pelada_id); if(!p)return;
      if(c.status==='nao_vai'){
        p.naoVao.push({id:c.id, nome:c.nome});
        return;
      }
      const _posConf=(c.posicao&&['GOL','ZAG','LAT','MEI','ATA'].includes(c.posicao))?c.posicao:'?';
      const _jogCad=c.jogador_id?(G.jogadores||[]).find(jj=>String(jj.id)===String(c.jogador_id)):null;
      const _posFinal=(_posConf==='?'&&_jogCad&&_jogCad.posicao_favorita&&['GOL','ZAG','LAT','MEI','ATA'].includes(_jogCad.posicao_favorita))?_jogCad.posicao_favorita:_posConf;
      const j={id:c.id,jogador_id:c.jogador_id||null,nome:c.nome,pos:_posFinal,time:c.time||'pool',pago:c.pago||false,modalidade:c.modalidade||'avulso',isento:c.isento||false,ordem:c.ordem||0,churras:c.churras||null};
      if(c.status==='espera'){
        p.espera.push(j);
        return;
      }
      p.confirmados.push(j);
      if(j.churras !== 'churras') p.jogadores.push({...j});
    });
  }
}
async function dbCriarPelada(p) {
  const rows=await sbFetch('/peladas',{method:'POST',body:JSON.stringify({nome:p.nome,data:p.data,hora:p.hora,local:p.local,valor:p.valor,max_jogadores:p.max,status:'aberta',tem_churras:p.temChurras||false})});
  return rows[0];
}
async function dbConfirmar(peladaId,nome,churras,status='confirmado',jogadorId=null,posicao=null) {
  const posVal=(posicao&&['GOL','ZAG','LAT','MEI','ATA'].includes(posicao))?posicao:'?';
  const body={pelada_id:peladaId,nome,posicao:posVal,time:'pool',pago:false,modalidade:'avulso',status};
  if(churras) body.churras=churras;
  if(jogadorId) body.jogador_id=jogadorId;
  const rows=await sbFetch('/confirmacoes',{method:'POST',body:JSON.stringify(body)});
  return rows[0];
}
async function dbAtualizar(id,fields) {
  await sbFetch('/confirmacoes?id=eq.'+id,{method:'PATCH',body:JSON.stringify(fields)});
}
async function dbDeletar(id) {
  await sbFetch('/confirmacoes?id=eq.'+id,{method:'DELETE',prefer:'return=minimal'});
}
async function dbExcluirPelada(id) {
  // Apaga primeiro as confirmações para evitar erro caso o Supabase não esteja com cascade configurado.
  await sbFetch('/votos_pelada?pelada_id=eq.'+id,{method:'DELETE',prefer:'return=minimal'});
  await sbFetch('/confirmacoes?pelada_id=eq.'+id,{method:'DELETE',prefer:'return=minimal'});
  await sbFetch('/peladas?id=eq.'+id,{method:'DELETE',prefer:'return=minimal'});
}
async function dbAtualizarPelada(id,fields) {
  await sbFetch('/peladas?id=eq.'+id,{method:'PATCH',body:JSON.stringify(fields),prefer:'return=minimal'});
}
async function dbListarJogadores() {
  return await sbFetch('/jogadores?order=nome.asc');
}
async function dbAtualizarJogador(id,fields) {
  await sbFetch('/jogadores?id=eq.'+id,{method:'PATCH',body:JSON.stringify(fields),prefer:'return=minimal'});
}
async function dbCriarJogador(fields) {
  const rows=await sbFetch('/jogadores',{method:'POST',body:JSON.stringify(fields)});
  return rows[0];
}
async function dbExcluirJogador(id) {
  await sbFetch('/jogadores?id=eq.'+encodeURIComponent(id),{method:'DELETE',prefer:'return=minimal'});
}
async function dbExcluirVotosDoJogador(nomes=[]) {
  const unicos=[...new Set((nomes||[]).map(v=>String(v||'').trim()).filter(Boolean))];
  for(const nome of unicos){
    await sbFetch('/votos_pelada?nome_votante=eq.'+encodeURIComponent(nome),{method:'DELETE',prefer:'return=minimal'}).catch(()=>{});
    await sbFetch('/votos_pelada?nome_votado=eq.'+encodeURIComponent(nome),{method:'DELETE',prefer:'return=minimal'}).catch(()=>{});
  }
}
async function dbJogadorPorAuth(userId) {
  const rows=await sbFetch('/jogadores?auth_user_id=eq.'+encodeURIComponent(userId)+'&limit=1');
  return rows && rows[0] ? rows[0] : null;
}
async function dbJogadorPorEmail(email) {
  const rows=await sbFetch('/jogadores?email=eq.'+encodeURIComponent(email)+'&limit=1');
  return rows && rows[0] ? rows[0] : null;
}

const POSICOES = ['GOL','ZAG','LAT','MEI','ATA'];

// -- Supabase Auth client --------------------------------------------------
// Carregado via CDN no index.html (supabase-js UMD)
// O app trata manualmente os retornos de OAuth/recovery para não perder o hash antes da rota correta.
const _sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    detectSessionInUrl: false,
    flowType: 'implicit',
  },
});

// Mapeamento email -> perfil (os emails são criados no painel do Supabase)
// Formato: adm@exiladosdabola.com / presidente@exiladosdabola.com / escalador@exiladosdabola.com
const PERFIL_POR_EMAIL = {
  'mr.guima@gmail.com':            'full',
  'luizfelipegarcia25@gmail.com':  'full',
  'tarcisiobregao@gmail.com':      'escalador',
};

const USERNAME_PARA_EMAIL = {
  'adm':        'mr.guima@gmail.com',
  'presidente': 'luizfelipegarcia25@gmail.com',
  'escalador':  'tarcisiobregao@gmail.com',
};

function perfilPorEmail(email){
  return PERFIL_POR_EMAIL[String(email||'').toLowerCase()] || null;
}

function perfilInterno(perfilApp){
  if(perfilApp==='adm' || perfilApp==='presidente') return 'full';
  if(perfilApp==='escalador') return 'escalador';
  return 'jogador';
}

async function restaurarSessaoAdm(){
  try{
    const { data } = await _sbClient.auth.getSession();
    const user = data && data.session && data.session.user ? data.session.user : null;
    const email = String(user?.email||'').toLowerCase();
    let jogador = user ? await dbJogadorPorAuth(user.id).catch(()=>null) : null;
    if(!jogador && user && email){
      const porEmail = await dbJogadorPorEmail(email).catch(()=>null);
      if(porEmail){
        jogador = porEmail;
        if(!porEmail.auth_user_id) await dbAtualizarJogador(porEmail.id,{auth_user_id:user.id, updated_at:new Date().toISOString()}).catch(()=>{});
      }
    }
    let perfilApp = jogador?.perfil_app || 'jogador';
    if(jogador && email === SUPER_ADMIN_EMAIL && perfilApp !== 'adm'){
      await dbAtualizarJogador(jogador.id,{perfil_app:'adm', updated_at:new Date().toISOString()}).catch(()=>{});
      jogador.perfil_app = 'adm';
      perfilApp = 'adm';
    }
    if(email === SUPER_ADMIN_EMAIL && perfilApp === 'jogador') perfilApp = 'adm';
    const perfil = perfilInterno(perfilApp);
    G.isAdm = perfil === 'full' || perfil === 'escalador';
    G.perfil = perfil;
    G.perfilApp = perfilApp;
    G.superAdmin = email === SUPER_ADMIN_EMAIL && perfilApp === 'adm';
    G.podeGerirJogadores = perfilApp === 'adm' || perfilApp === 'presidente';
    G.usuario = user;
    G.jogadorLogado = jogador;
    return G.isAdm;
  }catch(e){
    G.isAdm = false;
    G.perfil = 'jogador';
    G.perfilApp = 'jogador';
    G.superAdmin = false;
    G.podeGerirJogadores = false;
    G.usuario = null;
    G.jogadorLogado = null;
    return false;
  }
}

// Dados carregados do Supabase

// ==========================================
// LOGO
// TODO: ao publicar no Cloudflare Pages, salvar logo.png na raiz e usar src='/logo.png'
// ==========================================

// ==========================================
// NAV
// ==========================================
function goTo(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); document.getElementById(id).classList.add('active'); window.scrollTo(0,0); }

async function voltarLista(){
  G.pelada=null;
  if(typeof carregarBaseAppSeNecessario==='function') await carregarBaseAppSeNecessario();
  renderJLista();
  goTo('s-j-lista');
}

function admNav(aba){
  // Escalador só acessa times
  if(G.perfil==='escalador' && aba!=='times' && aba!=='fin-pelada'){
    showToastDanger('Acesso restrito ao perfil escalador.'); return;
  }
  if(aba==='fin'){
    abrirCaixaGeral(); return;
  }
  if(!G.pelada){ showToast('Selecione uma pelada primeiro'); goTo('s-adm-home'); renderAdmHome(); return; }
  if(aba==='conf')     { renderAdmConf();  goTo('s-adm-conf'); }
  if(aba==='times')    { renderAdmTimes(); goTo('s-adm-times'); }
  if(aba==='fin-pelada'){ renderAdmFin(); goTo('s-adm-fin-pelada'); }
}

// ==========================================
// UTILS
// ==========================================
function fmtData(d){ if(!d)return'—'; return new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}); }
function slug(s){ return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,''); }
function normNome(s){ return (s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' '); }
function escHtml(s){ return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function money(v){ return 'R$ '+Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:0}); }
function showToast(m){ const t=document.getElementById('toast'); t.textContent=m; t.className='toast show'; setTimeout(()=>t.classList.remove('show'),2200); }
function showToastDanger(m){ showToast(m); }
function apenasDigitos(s){ return String(s||'').replace(/\D/g,''); }
function formatarTelefone(v){
  const d=apenasDigitos(v).slice(0,11);
  if(d.length<=2) return d;
  return d.slice(0,2)+'-'+d.slice(2);
}
function mascararTelefoneInput(input){ input.value=formatarTelefone(input.value); }
function dataIsoParaBr(v){
  const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v||'');
}
function dataBrParaIso(v){
  const d=apenasDigitos(v);
  if(d.length!==8) return null;
  const dia=d.slice(0,2), mes=d.slice(2,4), ano=d.slice(4,8);
  const dt=new Date(`${ano}-${mes}-${dia}T12:00:00`);
  if(Number.isNaN(dt.getTime()) || dt.getFullYear()!==Number(ano) || dt.getMonth()+1!==Number(mes) || dt.getDate()!==Number(dia)) return null;
  return `${ano}-${mes}-${dia}`;
}
function formatarDataNascimento(v){
  const d=apenasDigitos(v).slice(0,8);
  if(d.length<=2) return d;
  if(d.length<=4) return d.slice(0,2)+'/'+d.slice(2);
  return d.slice(0,2)+'/'+d.slice(2,4)+'/'+d.slice(4);
}
function mascararDataInput(input){ input.value=formatarDataNascimento(input.value); }
function abrirZoomFotoUrl(url){
  if(!url){ showToast('Nenhuma foto cadastrada.'); return; }
  const modal=document.getElementById('photo-zoom');
  const img=document.getElementById('photo-zoom-img');
  if(!modal||!img)return;
  img.src=url;
  modal.classList.add('open');
}
function abrirZoomFotoPerfil(tipo){
  const input=document.getElementById(tipo==='jog'?'jog-foto':'perfil-foto-url');
  abrirZoomFotoUrl(input?.value?.trim()||'');
}
function fecharZoomFoto(e){
  if(e && e.target?.id !== 'photo-zoom') return;
  const modal=document.getElementById('photo-zoom');
  const img=document.getElementById('photo-zoom-img');
  if(img) img.src='';
  if(modal) modal.classList.remove('open');
}
async function prepararFotoUpload(file){
  if(!file) return null;
  const tipo=String(file.type||'').toLowerCase();
  const nome=String(file.name||'foto').toLowerCase();
  if(tipo.includes('heic') || tipo.includes('heif') || /\.(heic|heif)$/i.test(nome)){
    throw new Error('Formato HEIC/HEIF ainda nao e suportado. Envie JPG ou PNG.');
  }
  if(tipo && !tipo.startsWith('image/')) throw new Error('Envie um arquivo de imagem.');
  if(file.size <= 3 * 1024 * 1024) return file;

  const img=new Image();
  const url=URL.createObjectURL(file);
  try{
    await new Promise((resolve,reject)=>{
      img.onload=resolve;
      img.onerror=()=>reject(new Error('Nao foi possivel ler a imagem.'));
      img.src=url;
    });
  }finally{
    URL.revokeObjectURL(url);
  }

  const maxSide=1200;
  const scale=Math.min(1, maxSide/Math.max(img.naturalWidth||img.width, img.naturalHeight||img.height));
  const w=Math.max(1, Math.round((img.naturalWidth||img.width)*scale));
  const h=Math.max(1, Math.round((img.naturalHeight||img.height)*scale));
  const canvas=document.createElement('canvas');
  canvas.width=w;
  canvas.height=h;
  const ctx=canvas.getContext('2d');
  ctx.drawImage(img,0,0,w,h);

  async function blobJpeg(q){
    return await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',q));
  }
  let blob=await blobJpeg(.86);
  for(const q of [.78,.70,.62]){
    if(blob && blob.size <= 2 * 1024 * 1024) break;
    blob=await blobJpeg(q);
  }
  if(!blob) throw new Error('Nao foi possivel preparar a foto.');
  if(blob.size > 3 * 1024 * 1024) throw new Error('A foto ficou grande demais. Tente uma imagem menor.');
  return new File([blob], 'foto-perfil.jpg', {type:'image/jpeg'});
}
async function fotoParaDataUrl(file){
  if(!file) return '';
  const tipo=String(file.type||'').toLowerCase();
  const nome=String(file.name||'foto').toLowerCase();
  if(tipo.includes('heic') || tipo.includes('heif') || /\.(heic|heif)$/i.test(nome)){
    throw new Error('Formato HEIC/HEIF ainda nao e suportado. Envie JPG ou PNG.');
  }
  const img=new Image();
  const url=URL.createObjectURL(file);
  try{
    await new Promise((resolve,reject)=>{
      img.onload=resolve;
      img.onerror=()=>reject(new Error('Nao foi possivel ler a imagem.'));
      img.src=url;
    });
  }finally{
    URL.revokeObjectURL(url);
  }
  const maxSide=720;
  const scale=Math.min(1, maxSide/Math.max(img.naturalWidth||img.width, img.naturalHeight||img.height));
  const w=Math.max(1, Math.round((img.naturalWidth||img.width)*scale));
  const h=Math.max(1, Math.round((img.naturalHeight||img.height)*scale));
  const canvas=document.createElement('canvas');
  canvas.width=w;
  canvas.height=h;
  const ctx=canvas.getContext('2d');
  ctx.drawImage(img,0,0,w,h);
  return canvas.toDataURL('image/jpeg', .74);
}
function erroStoragePolicy(e){
  const msg=String(e?.message||e?.error_description||e||'').toLowerCase();
  return msg.includes('row-level security') || msg.includes('violates row-level') || msg.includes('rls') || msg.includes('policy');
}
function extensaoFotoUpload(file){
  const tipo=String(file?.type||'').toLowerCase();
  if(tipo.includes('png')) return 'png';
  if(tipo.includes('webp')) return 'webp';
  return 'jpg';
}
function contentTypeFotoUpload(file){
  const tipo=String(file?.type||'').toLowerCase();
  return tipo.startsWith('image/') ? tipo : 'image/jpeg';
}
function copiarLink(btn){ const t=document.getElementById('aconf-link').textContent; if(navigator.clipboard)navigator.clipboard.writeText(t); btn.innerHTML='<i class="ti ti-check" style="color:var(--green);"></i>'; setTimeout(()=>btn.innerHTML='<i class="ti ti-copy"></i>',1500); showToast('Link copiado!'); }
function posBadge(p){ if(!p||p==='?') return `<span class="pos-badge pos-pending">POS</span>`; const c=['GOL','ZAG','LAT','MEI','ATA'].includes(p)?p:'x'; return `<span class="pos-badge pos-${c}">${p}</span>`; }
function posSelect(j){ const vp=j.pos&&['GOL','ZAG','LAT','MEI','ATA'].includes(j.pos)?j.pos:'?'; return `<select class="pos-select" onchange="setPos('${j.id}',this.value)"><option value="?"${vp==='?'?' selected':''}>POS</option><option value="GOL"${vp==='GOL'?' selected':''}>GOL</option><option value="ZAG"${vp==='ZAG'?' selected':''}>ZAG</option><option value="LAT"${vp==='LAT'?' selected':''}>LAT</option><option value="MEI"${vp==='MEI'?' selected':''}>MEI</option><option value="ATA"${vp==='ATA'?' selected':''}>ATA</option></select>`; }
function jogadoresConfirmadosPelada(p){
  if(!p) return [];
  const confirmados = p.confirmados || [];
  return p.temChurras ? confirmados.filter(j=>j.churras!=='churras') : confirmados;
}
function totalJogadoresConfirmados(p){
  return jogadoresConfirmadosPelada(p).length;
}
function peladaLotada(p){
  return !!p && totalJogadoresConfirmados(p) >= p.max;
}
function peladaEncerrada(p){
  return !!p && (p.status === 'encerrada' || p.status === 'fechada');
}
function peladaEhFutura(p){
  if(!p || !p.data) return false;
  const d = new Date(`${p.data}T12:00:00`);
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  d.setHours(0,0,0,0);
  return d > hoje;
}
function encerradaAntesDoJogo(p){
  return peladaEncerrada(p) && peladaEhFutura(p);
}
function limiteEncerramentoPelada(p){
  if(!p || !p.data || !p.hora) return null;
  return new Date(`${p.data}T${p.hora}:00`);
}
function votacaoDeadline(pelada) {
  const limite = limiteEncerramentoPelada(pelada);
  if(!limite) return null;
  return new Date(limite.getTime() + 12 * 60 * 60 * 1000); // +12h
}
function deveEncerrarAutomaticamente(p){
  if(!p || p.status !== 'aberta') return false;
  if(p.reaberta) return false; // ADM reabriu manualmente após o horário - respeita até ele encerrar de novo
  const limite = limiteEncerramentoPelada(p);
  return limite && !Number.isNaN(limite.getTime()) && new Date() >= limite;
}
async function aplicarEncerramentoAutomatico(){
  const alvos = (G.peladas || []).filter(deveEncerrarAutomaticamente);
  for(const p of alvos){
    try{
      await dbAtualizarPelada(p.id,{status:'encerrada'});
      p.status = 'encerrada';
    }catch(e){ console.warn('Não foi possível encerrar automaticamente a pelada', p.id, e); }
  }
  return alvos.length;
}
async function verificarEncerramentoAutomaticoUI(){
  const qtd = await aplicarEncerramentoAutomatico();
  if(!qtd) return;
  if(G.pelada && peladaEncerrada(G.pelada)){
    const ativa = document.querySelector('.screen.active')?.id || '';
    if(['s-j-conf','s-adm-conf','s-adm-times'].includes(ativa)){
      showToast('Partida encerrada automaticamente às 20:30.');
      if(ativa.startsWith('s-j-')) await abrirResumoPublico(G.pelada.id);
      else renderAdmHome(), goTo('s-adm-home');
      return;
    }
  }
  renderJLista();
  if(G.isAdm) renderAdmHome();
}
function pelAdaberta(p){
  if(peladaEncerrada(p)) return false;
  if(deveEncerrarAutomaticamente(p)) return false;
  return p.status === 'aberta';
}
function peladaStatusInfo(p){
  if(peladaEncerrada(p) || deveEncerrarAutomaticamente(p)) return {label:'Encerrada', cls:'badge-yellow', aberta:false};
  return {label:'Aberta', cls:'badge-green', aberta:true, lotada:peladaLotada(p)};
}
function bloquearSeEncerrada(msg='Partida encerrada. Não é possível alterar confirmações ou escalações.'){
  if(peladaEncerrada(G.pelada) || deveEncerrarAutomaticamente(G.pelada)){
    showToast(msg);
    return true;
  }
  return false;
}
function linkPelada(p){ return `${APP_BASE_URL}?p=${encodeURIComponent(String(p.id))}`; }
function setPeladaAdm(id,aba){
  G.pelada=G.peladas.find(x=>String(x.id)===String(id));
  if(!G.pelada) return;
  if(G.perfil === 'escalador' && (peladaEncerrada(G.pelada) || deveEncerrarAutomaticamente(G.pelada))){
    showToast('Partida encerrada. Escalador não pode manipular esta pelada.');
    return;
  }
  if((aba === 'conf' || aba === 'times') && (peladaEncerrada(G.pelada) || deveEncerrarAutomaticamente(G.pelada))){
    // Se a pelada foi encerrada manualmente antes da data do jogo, ela deve seguir exibindo confirmações/escalações.
    // Pós-jogo só faz sentido para partidas já realizadas.
    if(!encerradaAntesDoJogo(G.pelada)){
      abrirPosJogo(id);
      return;
    }
  }
  admNav(aba||'conf');
}
function copiarLinkPelada(id){ const p=G.peladas.find(x=>String(x.id)===String(id)); if(!p)return; const l=linkPelada(p); if(navigator.clipboard) navigator.clipboard.writeText(l); showToast('Link copiado!'); }
function switchTab(show,hide,btnOn,btnOff){
  document.getElementById(show).style.display='block';
  document.getElementById(hide).style.display='none';
  btnOn.classList.add('active'); btnOff.classList.remove('active');
}
function switchTabTimes(show,hide,btnOn){
  document.querySelectorAll('#s-adm-times .tab').forEach(t=>t.classList.remove('active'));
  btnOn.classList.add('active');
  document.getElementById(show).style.display='block';
  document.getElementById(hide).style.display='none';
}

