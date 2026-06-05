// Exilados da Bola
// Autenticacao e recuperacao de senha
// Extraido de app.js para reduzir o monolito mantendo o comportamento global atual.

// ==========================================
// LOGIN
// ==========================================
async function login(){
  const emailVal = (document.getElementById('login-input').value||'').trim().toLowerCase();
  const senhaVal = document.getElementById('senha-input').value;

  // Resolve username curto para email, ou usa o valor digitado como email
  const email = USERNAME_PARA_EMAIL[emailVal] || (emailVal.includes('@') ? emailVal : emailVal + '@exiladosdabola.com');

  const btnLogin = document.querySelector('#s-login .btn-primary');
  if(btnLogin){ btnLogin.disabled = true; btnLogin.textContent = 'Entrando…'; }

  try {
    const { data, error } = await _sbClient.auth.signInWithPassword({ email, password: senhaVal });
    if(error) throw error;

    await restaurarSessaoAdm();
    if(!G.isAdm){
      await _sbClient.auth.signOut().catch(()=>{});
      throw new Error('sem_permissao_adm');
    }
    document.getElementById('login-input').value = '';
    document.getElementById('senha-input').value = '';
    G.appContext = 'admin';
    G.perfilOrigem = 'admin';

    if(G.perfil === 'escalador'){
      atualizarPainelAdministrativo();
      goTo('s-adm-dashboard');
      const btnNova = document.getElementById('btn-nova-pelada');
      if(btnNova) btnNova.style.display = 'none';
      showToast('Acesso escalador liberado!');
    } else {
      const btnNova = document.getElementById('btn-nova-pelada');
      if(btnNova) btnNova.style.display = '';
      atualizarPainelAdministrativo();
      goTo('s-adm-dashboard');
      showToast('Acesso liberado!');
    }
  } catch(e) {
    showToast(e.message==='sem_permissao_adm'?'Usuário sem acesso administrativo.':'Login ou senha incorretos.');
    document.getElementById('senha-input').value = '';
  } finally {
    if(btnLogin){ btnLogin.disabled = false; btnLogin.innerHTML = '<i class="ti ti-lock-open"></i> Entrar'; }
  }
}

async function esqueceuSenha(){
  const emailVal = (document.getElementById('login-input').value||'').trim().toLowerCase();
  if(!emailVal){ showToast('Digite seu login ou e-mail antes.'); return; }
  const email = USERNAME_PARA_EMAIL[emailVal] || (emailVal.includes('@') ? emailVal : emailVal + '@exiladosdabola.com');

  const btn = document.getElementById('btn-esqueci');
  if(btn){ btn.disabled = true; btn.textContent = 'Enviando…'; }

  try {
    const { error } = await _sbClient.auth.resetPasswordForEmail(email, {
      redirectTo: appRootUrl(),
    });
    if(error) throw error;
    showToast('E-mail de redefinição enviado! Verifique a caixa de entrada.');
  } catch(e) {
    showToast('Erro ao enviar. Verifique o login digitado.');
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = 'Esqueci a senha'; }
  }
}

async function sair(){
  G.isAdm = false; G.perfil = 'jogador'; G.perfilApp='jogador'; G.superAdmin=false; G.podeGerirJogadores=false; G.usuario=null; G.jogadorLogado=null; G.appContext='player'; G.perfilOrigem='player';
  fecharMenu();
  await _sbClient.auth.signOut().catch(()=>{});
  await voltarLista();
}
function atualizarOpcaoPerfilAdm(){
  const modoJogador=document.getElementById('adm-player-mode-option');
  if(modoJogador) modoJogador.style.display=G.isAdm?'flex':'none';
}
function abrirMenu(){
  atualizarOpcaoPerfilAdm();
  document.getElementById('adm-menu').classList.add('open');
}
function fecharMenu(e){ if(!e||e.target===document.getElementById('adm-menu')) document.getElementById('adm-menu').classList.remove('open'); }
async function abrirOpcaoPerfilAdm(){
  fecharMenu();
  if(G.podeGerirJogadores) return abrirJogadoresAdm();
  if(G.isAdm && G.appContext==='admin') G.perfilOrigem='admin';
  await abrirPerfilJogador(false);
}
// ==========================================
// PERFIL DO JOGADOR
// ==========================================
function saudacaoPorHora(){
  const h=new Date().getHours();
  if(h>=12 && h<18) return 'Boa tarde';
  if(h>=18 || h<5) return 'Boa noite';
  return 'Bom dia';
}
function nomeExibicaoExilado(){
  const apelidoJogador=(G.jogadorLogado?.apelido||'').trim();
  if(apelidoJogador) return apelidoJogador;
  const nomeJogador=(G.jogadorLogado?.nome||'').trim();
  if(nomeJogador) return nomeJogador;
  return '';
}
function abrirMenuJogador(){
  const title      = document.getElementById('player-menu-title');
  const loginItem  = document.getElementById('player-menu-login');
  const sairItem   = document.getElementById('player-menu-sair');
  const adminBack  = document.getElementById('player-menu-admin-back');
  const verJogador = document.getElementById('player-menu-ver-jogador');
  const nomeExibicao = nomeExibicaoExilado();
  if(title) title.textContent = nomeExibicao ? `${saudacaoPorHora()}, Exilado ${nomeExibicao}!` : `${saudacaoPorHora()}, Exilado!`;
  // Login: só quando não autenticado
  if(loginItem)  loginItem.style.display  = !G.usuario ? 'flex' : 'none';
  // Painel Admin: aparece quando admin está na visão jogador
  if(adminBack)  adminBack.style.display  = (G.isAdm && G.appContext==='player') ? 'flex' : 'none';
  // Ver como jogador: aparece quando admin está na visão admin
  if(verJogador) verJogador.style.display = (G.isAdm && G.appContext==='admin')  ? 'flex' : 'none';
  // Sair: só quando logado
  if(sairItem) sairItem.style.display = G.usuario ? 'flex' : 'none';
  document.getElementById('player-menu').classList.add('open');
}
function fecharMenuJogador(e){ if(!e||e.target===document.getElementById('player-menu')) document.getElementById('player-menu').classList.remove('open'); }

async function entrarModoJogador(){
  fecharMenu();
  G.appContext='player';
  G.perfilOrigem='player';
  await carregarBaseAppSeNecessario();
  renderJLista();
  goTo('s-j-lista');
}

function voltarPainelAdmin(){
  abrirPainelAdministrativo();
}

async function abrirPerfilJogador(redirecionarAdm=false){
  fecharMenuJogador();
  const veioDoAdmin = G.isAdm && G.appContext==='admin';
  G.appContext='player';
  if(redirecionarAdm) G.perfilOrigem='player';
  else if(veioDoAdmin) G.perfilOrigem='admin';
  const abrirEdicaoPerfil = redirecionarAdm && !!G.usuario && !temRetornoPerfilAuth();
  const retornoCadastro=temRetornoPerfilAuth() && !temTokenRecoveryAuth() && !erroRetornoPerfilAuth();
  const retornoAuth=await tratarRetornoPerfilAuth();
  if(retornoAuth?.erro){
    await carregarPerfilJogador({mostrarFormulario:false});
    goTo('s-j-perfil');
    return;
  }
  if(G.redefinindoSenha){
    mostrarResetSenhaPerfil();
    return;
  }
  await restaurarSessaoAdm();
  if(!abrirEdicaoPerfil && redirecionarAdm && !retornoCadastro && !G.redefinindoSenha && abrirDestinoUsuarioLogado()) return;
  await carregarPerfilJogador({mostrarFormulario:abrirEdicaoPerfil || !redirecionarAdm});
  await restaurarSessaoAdm();
  if(!abrirEdicaoPerfil && redirecionarAdm && !retornoCadastro && !G.redefinindoSenha && abrirDestinoPosLogin()) return;
  if(redirecionarAdm) await carregarPerfilJogador({mostrarFormulario:true});
  goTo('s-j-perfil');
}

async function voltarInicioApp(){
  if(G.isAdm && G.appContext==='admin'){
    voltarInicioAdm();
    return;
  }
  await voltarLista();
}

async function voltarInicioPerfil(){
  if(G.isAdm && G.perfilOrigem==='admin'){
    abrirPainelAdministrativo();
    return;
  }
  await voltarInicioApp();
}

function perfilAuthSearch(){
  const snap=window.__exiladosAuthUrlSnapshot;
  return new URLSearchParams((snap?.search || window.location.search || '').replace(/^\?/,''));
}

function perfilAuthHash(){
  const snap=window.__exiladosAuthUrlSnapshot;
  return new URLSearchParams((snap?.hash || window.location.hash || '').replace(/^#/,''));
}

function erroRetornoPerfilAuth(){
  const hash=perfilAuthHash();
  return hash.get('error_code')||hash.get('error')||'';
}

function temRetornoPerfilAuth(){
  const params=perfilAuthSearch();
  const hash=perfilAuthHash();
  return !!(params.get('reset') || params.get('code') || hash.get('access_token') || hash.get('refresh_token') || hash.get('error') || hash.get('error_code') || hash.get('type'));
}

function temTokenRecoveryAuth(){
  const params=perfilAuthSearch();
  const hash=perfilAuthHash();
  return !!(params.get('reset') || hash.get('access_token') || hash.get('refresh_token') || hash.get('type')==='recovery');
}

function appRootUrl(){
  return window.location.origin;
}

function appPerfilUrl(){
  return `${appRootUrl()}?perfil=1`;
}

function appResetUrl(){
  return `${appRootUrl()}?reset=1`;
}

function limparHashVazio(){
  if(window.location.hash==='#' && window.history && window.history.replaceState){
    window.history.replaceState(null,'',window.location.origin + window.location.pathname + window.location.search);
  }
}

function limparUrlPerfil(destino=appRootUrl()){
  window.__exiladosAuthUrlSnapshot = { hash:'', search:'' };
  if(window.history && window.history.replaceState) window.history.replaceState(null,'',destino);
  limparHashVazio();
}

function mostrarLoginPerfil(){
  const loginCard=document.getElementById('perfil-login-card');
  const formCard=document.getElementById('perfil-form-card');
  const resetCard=document.getElementById('perfil-reset-card');
  const btnVoltar=document.getElementById('perfil-btn-voltar-lista');
  if(loginCard) loginCard.style.display='block';
  if(formCard) formCard.style.display='none';
  if(resetCard) resetCard.style.display='none';
  if(btnVoltar) btnVoltar.style.display='';
  goTo('s-j-perfil');
}

function mostrarResetSenhaPerfil(){
  const loginCard=document.getElementById('perfil-login-card');
  const formCard=document.getElementById('perfil-form-card');
  const resetCard=document.getElementById('perfil-reset-card');
  const btnVoltar=document.getElementById('perfil-btn-voltar-lista');
  G.redefinindoSenha=true;
  if(loginCard) loginCard.style.display='none';
  if(formCard) formCard.style.display='none';
  if(resetCard) resetCard.style.display='block';
  if(btnVoltar) btnVoltar.style.display='none';
  goTo('s-j-perfil');
}

let authRecoveryListenerAtivo=false;
function inicializarAuthRecoveryListener(){
  if(authRecoveryListenerAtivo || !_sbClient?.auth?.onAuthStateChange) return;
  authRecoveryListenerAtivo=true;
  _sbClient.auth.onAuthStateChange((event, session)=>{
    if(event==='PASSWORD_RECOVERY'){
      G.usuario=session?.user||null;
      mostrarResetSenhaPerfil();
    }
  });
}

async function tratarRetornoPerfilAuth(){
  const hash=perfilAuthHash();
  const params=perfilAuthSearch();
  const erro=erroRetornoPerfilAuth();
  if(!G.redefinindoSenha) G.redefinindoSenha=false;

  if(erro){
    const msg=erro==='otp_expired'
      ? 'Link de senha expirado ou inválido. Peça um novo link em Esqueci minha senha.'
      : 'Não foi possível validar o link. Peça um novo link em Esqueci minha senha.';
    G.isAdm=false; G.perfil='jogador'; G.perfilApp='jogador'; G.superAdmin=false; G.podeGerirJogadores=false; G.usuario=null; G.jogadorLogado=null;
    await _sbClient.auth.signOut().catch(()=>{});
    limparUrlPerfil();
    await carregarBaseAppSeNecessario();
    mostrarLoginPerfil();
    setTimeout(()=>showToast(msg),80);
    return {erro:true};
  }

  if(G.redefinindoSenha){
    mostrarResetSenhaPerfil();
    return {erro:false, recovery:true};
  }

  const accessToken=hash.get('access_token');
  const refreshToken=hash.get('refresh_token');
  if(accessToken && refreshToken && _sbClient?.auth?.setSession){
    await _sbClient.auth.setSession({access_token:accessToken, refresh_token:refreshToken}).catch(()=>{});
  }

  if(params.get('code') && _sbClient?.auth?.exchangeCodeForSession){
    const { error } = await _sbClient.auth.exchangeCodeForSession(params.get('code')).catch(e=>({error:e}));
    if(error){
      await carregarBaseAppSeNecessario();
      mostrarLoginPerfil();
      showToast('Link inválido ou expirado. Tente entrar ou solicite um novo link.');
      limparUrlPerfil();
      return {erro:true};
    }
    if(!G.redefinindoSenha) limparUrlPerfil();
  }

  if(hash.get('type')==='recovery'){
    mostrarResetSenhaPerfil();
  }
  return {erro:false};
}

async function loginJogadorGoogle(){
  showToast('Login Google ainda não está habilitado no Supabase.');
  return;
  const { error } = await _sbClient.auth.signInWithOAuth({
    provider:'google',
    options:{ redirectTo:appRootUrl() },
  });
  if(error) showToast('Erro ao abrir login Google.');
}

async function loginJogadorEmail(){
  return entrarJogadorSenha();
}

function abrirDestinoUsuarioLogado(){
  if(temRetornoPerfilAuth()) return false;
  if(G.isAdm && G.appContext!=='player'){
    const btnNova=document.getElementById('btn-nova-pelada');
    if(btnNova) btnNova.style.display=G.perfil==='escalador'?'none':'';
    renderAdmHome();
    goTo('s-adm-home');
    return true;
  }
  return false;
}

function perfilJogadorCompleto(j){
  return !!(j && j.nome && j.nome.trim() && j.apelido && j.apelido.trim() && j.telefone && j.data_nascimento);
}

function abrirDestinoPosLogin(){
  if(abrirDestinoUsuarioLogado()) return true;
  if(perfilJogadorCompleto(G.jogadorLogado)){
    voltarLista();
    return true;
  }
  return false;
}

function credenciaisPerfil(){
  const email=(document.getElementById('perfil-email-login').value||'').trim().toLowerCase();
  const password=document.getElementById('perfil-senha-login').value;
  if(!email || !email.includes('@')){ showToast('Digite um e-mail válido.'); return null; }
  if(!password || password.length<6){ showToast('Use uma senha com no mínimo 6 caracteres.'); return null; }
  return {email,password};
}

function msgAuthErro(e){
  const msg = (e?.message || '').toLowerCase();
  const code = (e?.code || e?.name || '').toLowerCase();
  const status = e?.status;
  if(status===429 || code.includes('rate_limit') || msg.includes('rate limit') || msg.includes('email rate'))
    return 'Aguarde antes de tentar de novo.';
  if(code.includes('user_already_exists') || msg.includes('already registered') || msg.includes('already exists'))
    return 'E-mail já cadastrado. Tente entrar.';
  if(msg.includes('invalid email') || msg.includes('unable to validate email'))
    return 'E-mail inválido.';
  return 'Erro ao enviar. Tente novamente.';
}

async function entrarJogadorSenha(){
  const cred=credenciaisPerfil(); if(!cred)return;
  const { error } = await _sbClient.auth.signInWithPassword(cred);
  if(error){ showToast('E-mail ou senha incorretos.'); return; }
  await restaurarSessaoAdm();
  G.appContext='player';
  G.perfilOrigem='player';
  await carregarPerfilJogador({mostrarFormulario:false});
  await restaurarSessaoAdm();
  if(abrirDestinoPosLogin()){
    if(G.isAdm) showToast(G.perfil==='escalador'?'Acesso escalador liberado!':'Acesso administrativo liberado!');
    else showToast('Login realizado!');
    return;
  }
  await carregarPerfilJogador({mostrarFormulario:true});
  goTo('s-j-perfil');
  showToast('Complete seu cadastro para continuar.');
}

async function criarContaJogadorSenha(){
  const cred=credenciaisPerfil(); if(!cred)return;
  const btn=document.querySelector('#perfil-login-card .btn-outline[onclick="criarContaJogadorSenha()"]');
  if(btn){ btn.disabled=true; btn.innerHTML='<i class="ti ti-loader" style="animation:spin 1s linear infinite;display:inline-block;"></i> Enviando...'; }
  let resendOk=false;
  let ultimoErro=null;
  async function reenviarConfirmacaoCadastro(){
    if(!_sbClient?.auth?.resend) return false;
    const { error } = await _sbClient.auth.resend({
      type:'signup',
      email:cred.email,
      options:{ emailRedirectTo:appPerfilUrl() },
    }).catch(err=>({error:err}));
    if(error) ultimoErro=error;
    return !error;
  }
  try{
    const { data, error } = await _sbClient.auth.signUp({
      email:cred.email,
      password:cred.password,
      options:{ emailRedirectTo:appPerfilUrl() },
    });
    if(error) throw error;
    const identities=data?.user?.identities;
    if(Array.isArray(identities) && identities.length===0){
      resendOk=await reenviarConfirmacaoCadastro();
      if(!resendOk) throw (ultimoErro || new Error('Não foi possível reenviar confirmação.'));
    }
  }catch(e){
    ultimoErro=e;
    resendOk=await reenviarConfirmacaoCadastro();
    if(!resendOk){
      showToast(msgAuthErro(ultimoErro));
      console.error('Falha ao enviar/reenviar cadastro:', ultimoErro);
      if(btn){ btn.disabled=false; btn.innerHTML='<i class="ti ti-user-plus"></i> Criar conta'; }
      return;
    }
  }
  await restaurarSessaoAdm();
  await carregarPerfilJogador({mostrarFormulario:false});
  await restaurarSessaoAdm();
  if(!abrirDestinoPosLogin()){
    await carregarPerfilJogador({mostrarFormulario:true});
    goTo('s-j-perfil');
  }
  showToast(resendOk?'E-mail de cadastro enviado. Verifique caixa de entrada e spam.':'Verifique seu e-mail para confirmar o cadastro.');
  if(btn){ btn.disabled=false; btn.innerHTML='<i class="ti ti-user-plus"></i> Criar conta'; }
}

async function recuperarSenhaJogador(){
  const email=(document.getElementById('perfil-email-login').value||'').trim().toLowerCase();
  if(!email || !email.includes('@')){ showToast('Digite seu e-mail antes.'); return; }
  const btn=document.getElementById('perfil-btn-esqueci');
  if(btn){ btn.disabled=true; btn.textContent='Enviando...'; }
  try{
    const { error } = await _sbClient.auth.resetPasswordForEmail(email,{redirectTo:appResetUrl()});
    if(error) throw error;
    showToast('Se o e-mail existir e o envio não estiver limitado, você receberá o link em instantes.');
  }catch(e){
    console.error('Falha ao enviar redefinição:', e);
    showToast(msgAuthErro(e));
  }
  finally{ if(btn){ btn.disabled=false; btn.textContent='Esqueci minha senha'; } }
}

async function carregarPerfilJogador(opts={}){
  const mostrarFormulario = opts.mostrarFormulario !== false;
  const { data } = await _sbClient.auth.getSession();
  const user=data && data.session && data.session.user ? data.session.user : null;
  const loginCard=document.getElementById('perfil-login-card');
  const formCard=document.getElementById('perfil-form-card');
  const resetCard=document.getElementById('perfil-reset-card');
  loginCard.style.display=user?'none':'block';
  formCard.style.display='none';
  if(resetCard) resetCard.style.display='none';
  if(!user) return;

  if(G.redefinindoSenha){
    loginCard.style.display='none';
    formCard.style.display='none';
    if(resetCard) resetCard.style.display='block';
    return;
  }

  let jogador=await dbJogadorPorAuth(user.id);
  if(!jogador && user.email){
    const porEmail=await dbJogadorPorEmail(user.email);
    if(porEmail){
      await dbAtualizarJogador(porEmail.id,{auth_user_id:user.id, updated_at:new Date().toISOString()});
      jogador={...porEmail, auth_user_id:user.id};
    }
  }
  if(!jogador){
    jogador=await dbCriarJogador({
      auth_user_id:user.id,
      email:user.email||null,
      nome:'',
      ativo:true,
      modalidade:'avulso',
      perfil_app:'jogador',
    });
  }
  G.jogadorLogado=jogador;
  preencherMeuPerfil(jogador);
  if(mostrarFormulario) formCard.style.display='block';
}

async function carregarBaseAppSeNecessario(force=false){
  const precisaCarregar = force || !Array.isArray(G.peladas) || !G.peladas.length;
  if(!precisaCarregar) return true;
  const jlista=document.getElementById('j-lista');
  if(jlista) jlista.innerHTML='<div class="empty" style="padding:40px 0;"><i class="ti ti-loader" style="animation:spin 1s linear infinite;display:inline-block;font-size:28px;opacity:.5;"></i></div>';
  try{
    if(!Array.isArray(G.jogadores) || !G.jogadores.length){
      await dbCarregarJogadoresBase().catch(()=>{ G.jogadores = []; });
    }
    await dbCarregarPeladas();
    await aplicarEncerramentoAutomatico();
    const cfg = await dbGetConfig();
    G.valorChurras = cfg ? (Number(cfg.valor_churras)||0) : 0;
    renderJLista();
    return true;
  }catch(e){
    console.error('Erro ao carregar base do app:', e);
    renderJLista();
    showToast('Não foi possível carregar as peladas. Tente atualizar a página.');
    return false;
  }
}

async function salvarNovaSenhaJogador(){
  const senha=(document.getElementById('perfil-nova-senha')?.value||'').trim();
  if(!senha || senha.length<6){ showToast('Use uma senha com no mínimo 6 caracteres.'); return; }
  const { error } = await _sbClient.auth.updateUser({ password:senha });
  if(error){ showToast('Não foi possível salvar a nova senha. Peça outro link.'); return; }
  document.getElementById('perfil-nova-senha').value='';
  G.redefinindoSenha=false;
  limparUrlPerfil();
  await carregarBaseAppSeNecessario();
  await restaurarSessaoAdm();
  await carregarPerfilJogador({mostrarFormulario:false});
  if(!abrirDestinoPosLogin()) voltarLista();
  showToast('Senha alterada com sucesso!');
}

async function voltarLoginPerfil(){
  G.redefinindoSenha=false;
  limparUrlPerfil();
  await _sbClient.auth.signOut().catch(()=>{});
  await carregarBaseAppSeNecessario();
  mostrarLoginPerfil();
}

function preencherMeuPerfil(j){
  document.getElementById('perfil-jogador-id').value=j.id||'';
  document.getElementById('perfil-foto-url').value=j.foto_url||'';
  document.getElementById('perfil-email').value=j.email||G.usuario?.email||'';
  document.getElementById('perfil-nome').value=j.nome||'';
  document.getElementById('perfil-apelido').value=j.apelido||'';
  document.getElementById('perfil-instagram').value=j.instagram?`@${j.instagram}`:'';
  document.getElementById('perfil-telefone').value=formatarTelefone(j.telefone||'');
  document.getElementById('perfil-nascimento').value=dataIsoParaBr(j.data_nascimento||'');
  document.getElementById('perfil-pos').value=j.posicao_favorita||'';
  // Hero
  const apelido=(j.apelido||j.nome||'Peladeiro').toUpperCase();
  const pos=j.posicao_favorita||'';
  const posLabel={'GOL':'Goleiro','ZAG':'Zagueiro','LAT':'Lateral','MEI':'Meia','ATA':'Atacante'}[pos]||pos||'—';
  const el=n=>document.getElementById(n);
  if(el('perfil-hero-apelido')) el('perfil-hero-apelido').textContent=apelido;
  if(el('perfil-hero-nome'))    el('perfil-hero-nome').textContent=j.nome||'—';
  if(el('perfil-hero-sub'))     el('perfil-hero-sub').textContent=`@${j.instagram||j.apelido||'—'} · ${posLabel}`;
  // Flags posição
  perfilFlagSet('pos', j.posicao_favorita||'');
  // Flags modalidade (agora no cadastro)
  perfilFlagSet('mod', j.modalidade||'avulso');
  // Flags perfil (só adm vê)
  const perfilVal = ['jogador','escalador','presidente','adm'].includes(j.perfil_app) ? j.perfil_app : 'jogador';
  perfilFlagSet('perfil', perfilVal);
  // Permissões no perfil do jogador são somente leitura.
  // A alteração de Jogador/Escalador/Presidente/Admin deve ocorrer apenas no painel administrativo próprio.
  const resumoAdm = document.getElementById('perfil-resumo-adm');
  if(resumoAdm) resumoAdm.style.display = G.isAdm ? '' : 'none';
  // Última presença
  _perfilCarregarUltimaPresenca(j.id);
  atualizarPreviewMeuPerfil();
}

function perfilFlagSelect(tipo, btn){
  if(tipo==='perfil') return;
  const map={pos:'perfil-flags-pos', perfil:'perfil-flags-perfil', mod:'perfil-flags-mod'};
  const wrap=document.getElementById(map[tipo]); if(!wrap) return;
  wrap.querySelectorAll('.perfil-flag').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  // Sync hidden select for pos
  if(tipo==='pos'){
    const sel=document.getElementById('perfil-pos');
    if(sel) sel.value=btn.dataset.val;
  }
}

function perfilFlagSet(tipo, val){
  const map={pos:'perfil-flags-pos', perfil:'perfil-flags-perfil', mod:'perfil-flags-mod'};
  const wrap=document.getElementById(map[tipo]); if(!wrap) return;
  wrap.querySelectorAll('.perfil-flag').forEach(b=>{
    b.classList.toggle('active', b.dataset.val===val);
  });
  if(tipo==='pos'){
    const sel=document.getElementById('perfil-pos');
    if(sel) sel.value=val;
  }
}

function perfilFlagValue(tipo, fallback=''){
  const map={pos:'perfil-flags-pos', perfil:'perfil-flags-perfil', mod:'perfil-flags-mod'};
  const wrap=document.getElementById(map[tipo]);
  const activeVal=wrap?.querySelector('.perfil-flag.active')?.dataset.val;
  if(activeVal) return activeVal;
  if(tipo==='pos'){
    const hidden=document.getElementById('perfil-pos');
    if(hidden?.value) return hidden.value;
  }
  return fallback;
}

function sincronizarJogadorNaListaGlobal(jogador){
  if(!jogador || !Array.isArray(G.jogadores)) return;
  const idx=G.jogadores.findIndex(j=>String(j?.id||'')===String(jogador.id||''));
  if(idx>=0) G.jogadores[idx]={...G.jogadores[idx], ...jogador};
}

async function _perfilCarregarUltimaPresenca(jogadorId){
  const el=document.getElementById('perfil-ultima-presenca');
  if(!el||!jogadorId) return;
  try{
    const j=G.jogadorLogado;
    const aliases=[normNome(j?.nome||''), normNome(j?.apelido||'')].filter(Boolean);
    const peladas=(G.peladas||[]).filter(p=>{
      if(!peladaEncerrada(p) || encerradaAntesDoJogo(p)) return false;
      const escalados=Array.isArray(p.jogadores) ? p.jogadores : [];
      return escalados.some(item=>{
        if(String(item?.jogador_id||'')===String(jogadorId)) return true;
        const nomeItem=normNome(item?.nome||'');
        return nomeItem && aliases.includes(nomeItem);
      });
    });
    peladas.sort((a,b)=>new Date(b.data)-new Date(a.data));
    const anoAtual=new Date().getFullYear();
    const noAno=peladas.filter(p=>p.data&&new Date(p.data+'T12:00:00').getFullYear()===anoAtual).length;
    if(!peladas.length){ el.classList.add('perfil-presenca-card'); el.innerHTML='<div class="perfil-presenca-empty">Nenhuma presença registrada</div>'; return; }
    const ultima=peladas[0];
    const d=new Date(ultima.data+'T12:00:00');
    const dataFmt=d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','');
    el.classList.add('perfil-presenca-card');
    el.innerHTML=`
      <div class="perfil-presenca-left">
        <div class="perfil-presenca-data">${dataFmt}</div>
        <div class="perfil-presenca-label">Última presença</div>
      </div>
      <div class="perfil-presenca-right">
        <div class="perfil-presenca-jogos">${noAno} partida${noAno!==1?'s':''} em ${anoAtual}</div>
      </div>`;
  }catch(e){ el.textContent='—'; }
}

function atualizarPreviewMeuPerfil(){
  const box=document.getElementById('perfil-foto-preview'); if(!box)return;
  const url=document.getElementById('perfil-foto-url')?.value.trim();
  const nome=document.getElementById('perfil-nome')?.value.trim()||'?';
  box.innerHTML=url?`<img src="${escHtml(url)}" alt="" />`:escHtml((nome[0]||'?').toUpperCase());
}

async function uploadFotoPerfil(file){
  if(!file) return;
  const { data } = await _sbClient.auth.getSession();
  const user=data && data.session && data.session.user ? data.session.user : null;
  if(!user){ showToast('Entre antes de enviar foto.'); return; }
  showToast('Preparando foto...');
  try{
    const foto=await prepararFotoUpload(file);
    const path=`${user.id}/${Date.now()}.${extensaoFotoUpload(foto)}`;
    showToast('Enviando foto...');
    const { error } = await _sbClient.storage.from('jogador-fotos').upload(path,foto,{upsert:false,contentType:contentTypeFotoUpload(foto)});
    if(error) throw error;
    const { data:pub } = _sbClient.storage.from('jogador-fotos').getPublicUrl(path);
    document.getElementById('perfil-foto-url').value=pub.publicUrl;
    atualizarPreviewMeuPerfil();
    showToast('Foto enviada! Toque em Salvar perfil.');
  }catch(e){
    console.error('Erro ao enviar foto do perfil:', e);
    if(erroStoragePolicy(e)){
      try{
        const dataUrl=await fotoParaDataUrl(file);
        document.getElementById('perfil-foto-url').value=dataUrl;
        atualizarPreviewMeuPerfil();
        showToast('Foto preparada. Toque em Salvar perfil.');
        return;
      }catch(fallbackErr){
        console.error('Erro no fallback da foto do perfil:', fallbackErr);
      }
    }
    showToast(e?.message || 'Erro ao enviar foto.');
  }
}

async function salvarMeuPerfil(){
  const id=document.getElementById('perfil-jogador-id').value;
  const nome=document.getElementById('perfil-nome').value.trim();
  const apelido=document.getElementById('perfil-apelido').value.trim();
  if(!id || !nome){ document.getElementById('perfil-nome').focus(); showToast('Informe seu nome completo.'); return; }
  if(!apelido){ document.getElementById('perfil-apelido').focus(); showToast('Informe seu apelido.'); return; }
  const nascimento=document.getElementById('perfil-nascimento').value.trim();
  if(!nascimento){ document.getElementById('perfil-nascimento').focus(); showToast('Informe sua data de nascimento.'); return; }
  const dataNascimento=dataBrParaIso(nascimento);
  if(!dataNascimento){ document.getElementById('perfil-nascimento').focus(); showToast('Informe a data no formato DD/MM/AAAA.'); return; }
  const telefoneRaw=formatarTelefone(document.getElementById('perfil-telefone').value);
  if(!telefoneRaw){ document.getElementById('perfil-telefone').focus(); showToast('Informe seu telefone (WhatsApp).'); return; }
  const posicaoFavorita=perfilFlagValue('pos');
  if(!posicaoFavorita){
    document.querySelector('#perfil-flags-pos .perfil-flag')?.focus?.();
    showToast('Selecione sua posição favorita.');
    return;
  }
  const fields={
    nome,
    apelido,
    instagram:jogadorInstagram(document.getElementById('perfil-instagram').value)||null,
    telefone:telefoneRaw,
    email:document.getElementById('perfil-email').value.trim()||G.usuario?.email||null,
    foto_url:document.getElementById('perfil-foto-url').value.trim()||null,
    data_nascimento:dataNascimento,
    posicao_favorita:posicaoFavorita,
    modalidade:perfilFlagValue('mod','avulso')||'avulso',
    updated_at:new Date().toISOString(),
  };
  try{
    await dbAtualizarJogador(id,fields);
    const jogadorSalvo=await dbJogadorPorId(id).catch(()=>null);
    G.jogadorLogado=jogadorSalvo || ({...(G.jogadorLogado||{}),...fields,id});
    sincronizarJogadorNaListaGlobal(G.jogadorLogado);
    preencherMeuPerfil(G.jogadorLogado);
    showToast('Perfil salvo!');
  }catch(e){ showToast('Erro ao salvar perfil.'); }
}

async function sairJogador(){
  fecharMenuJogador();
  await _sbClient.auth.signOut().catch(()=>{});
  G.isAdm=false; G.perfil='jogador'; G.perfilApp='jogador'; G.superAdmin=false; G.podeGerirJogadores=false; G.usuario=null; G.jogadorLogado=null; G.appContext='player'; G.perfilOrigem='player';
  showToast('Sessão encerrada.');
  voltarLista();
}


// Painel administrativo modular - Dark Theme
function nomeCurtoAdm(){
  const apelido=(G.jogadorLogado?.apelido||'').trim();
  if(apelido) return apelido.toUpperCase();
  const nome=(G.jogadorLogado?.nome||G.usuario?.email||'EXILADO').trim();
  return nome.split(' ')[0].toUpperCase();
}
function atualizarPainelAdministrativo(){
  const el=document.getElementById('adm-dashboard-nome');
  if(el) el.textContent=nomeCurtoAdm();
  aplicarPermissoesVisuaisAdm();
}
function aplicarPermissoesVisuaisAdm(){
  const isEscalador = G.perfil === 'escalador';
  const dashboard = document.getElementById('s-adm-dashboard');
  if(dashboard){
    const tiles = dashboard.querySelectorAll('.adm-dashboard-grid .adm-tile');
    if(tiles[1]) tiles[1].style.display = isEscalador ? 'none' : '';
    if(tiles[3]) tiles[3].style.display = isEscalador ? 'none' : '';
    if(tiles[4]) tiles[4].style.display = isEscalador ? 'none' : '';
  }
  const btnNova = document.getElementById('btn-nova-pelada');
  if(btnNova) btnNova.style.display = isEscalador ? 'none' : '';

  document.querySelectorAll([
    '#s-adm-dashboard .bottom-nav',
    '#s-adm-home .bottom-nav',
    '#s-adm-jogadores .bottom-nav',
    '#s-adm-criar .bottom-nav',
    '#s-adm-conf .bottom-nav',
    '#s-adm-times .bottom-nav',
    '#s-adm-fin .bottom-nav',
    '#s-adm-fin-pelada .bottom-nav',
    '#s-adm-posjogo .bottom-nav'
  ].join(',')).forEach(nav => {
    const buttons = nav.querySelectorAll('.nav-btn');
    if(buttons[1]) buttons[1].style.display = isEscalador ? 'none' : '';
    if(buttons[3]) buttons[3].style.display = isEscalador ? 'none' : '';
    if(buttons[4]) buttons[4].style.display = isEscalador ? 'none' : '';
  });
}
function abrirPainelAdministrativo(){
  fecharMenu();
  fecharMenuJogador();
  G.appContext='admin';
  G.perfilOrigem='admin';
  atualizarPainelAdministrativo();
  goTo('s-adm-dashboard');
}
function abrirGestaoPeladasAdm(){
  fecharMenu();
  G.appContext='admin';
  G.perfilOrigem='admin';
  aplicarPermissoesVisuaisAdm();
  renderAdmHome();
  goTo('s-adm-home');
}
function abrirModuloAdm(aba){
  fecharMenu();
  G.appContext='admin';
  G.perfilOrigem='admin';
  aplicarPermissoesVisuaisAdm();
  if(aba==='fin') return admNav('fin');
  if(!G.pelada){
    renderAdmHome();
    goTo('s-adm-home');
    showToast('Selecione uma pelada para continuar.');
    return;
  }
  admNav(aba);
}
