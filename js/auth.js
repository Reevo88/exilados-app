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

    if(G.perfil === 'escalador'){
      goTo('s-adm-home'); renderAdmHome();
      const btnNova = document.getElementById('btn-nova-pelada');
      if(btnNova) btnNova.style.display = 'none';
      showToast('Acesso escalador liberado!');
    } else {
      const btnNova = document.getElementById('btn-nova-pelada');
      if(btnNova) btnNova.style.display = '';
      goTo('s-adm-home'); renderAdmHome(); showToast('Acesso liberado!');
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
  G.isAdm = false; G.perfil = 'jogador'; G.perfilApp='jogador'; G.superAdmin=false; G.usuario=null; G.jogadorLogado=null;
  fecharMenu();
  await _sbClient.auth.signOut().catch(()=>{});
  await voltarLista();
}
function atualizarOpcaoPerfilAdm(){
  const nome=document.getElementById('adm-profile-option-name');
  const desc=document.getElementById('adm-profile-option-desc');
  const icon=document.getElementById('adm-profile-option-icon');
  const geral=!!G.superAdmin;
  if(nome) nome.textContent=geral?'Jogadores':'Meu Perfil';
  if(desc) desc.textContent=geral?'Cadastro, fotos e perfis':'Editar meu perfil';
  if(icon) icon.className=geral?'ti ti-users-group':'ti ti-user-circle';
}
function abrirMenu(){
  atualizarOpcaoPerfilAdm();
  document.getElementById('adm-menu').classList.add('open');
}
function fecharMenu(e){ if(!e||e.target===document.getElementById('adm-menu')) document.getElementById('adm-menu').classList.remove('open'); }
async function abrirOpcaoPerfilAdm(){
  fecharMenu();
  if(G.superAdmin) return abrirJogadoresAdm();
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
function abrirMenuJogador(){
  const title=document.getElementById('player-menu-title');
  const loginName=document.getElementById('player-menu-login-name');
  const sairItem=document.getElementById('player-menu-sair');
  if(title) title.textContent=saudacaoPorHora()+', Exilado!';
  if(loginName) loginName.textContent=G.usuario?'Meu Perfil':'Login';
  if(sairItem) sairItem.style.display=G.usuario?'flex':'none';
  document.getElementById('player-menu').classList.add('open');
}
function fecharMenuJogador(e){ if(!e||e.target===document.getElementById('player-menu')) document.getElementById('player-menu').classList.remove('open'); }

async function abrirPerfilJogador(redirecionarAdm=false){
  fecharMenuJogador();
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
  if(redirecionarAdm && !G.redefinindoSenha && abrirDestinoUsuarioLogado()) return;
  await carregarPerfilJogador({mostrarFormulario:!redirecionarAdm});
  await restaurarSessaoAdm();
  if(redirecionarAdm && !G.redefinindoSenha && abrirDestinoPosLogin()) return;
  goTo('s-j-perfil');
}

function perfilAuthHash(){
  return new URLSearchParams((window.location.hash||'').replace(/^#/,''));
}

function erroRetornoPerfilAuth(){
  const hash=perfilAuthHash();
  return hash.get('error_code')||hash.get('error')||'';
}

function temRetornoPerfilAuth(){
  const params=new URLSearchParams(window.location.search);
  const hash=perfilAuthHash();
  return !!(params.get('reset') || params.get('code') || hash.get('access_token') || hash.get('refresh_token') || hash.get('error') || hash.get('error_code') || hash.get('type'));
}

function temTokenRecoveryAuth(){
  const params=new URLSearchParams(window.location.search);
  const hash=perfilAuthHash();
  return !!(params.get('reset') || params.get('code') || hash.get('access_token') || hash.get('refresh_token') || hash.get('type')==='recovery');
}

function appRootUrl(){
  return window.location.origin;
}

function limparHashVazio(){
  if(window.location.hash==='#' && window.history && window.history.replaceState){
    window.history.replaceState(null,'',window.location.origin + window.location.pathname + window.location.search);
  }
}

function limparUrlPerfil(destino=appRootUrl()){
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
  const params=new URLSearchParams(window.location.search);
  const erro=erroRetornoPerfilAuth();
  if(!G.redefinindoSenha) G.redefinindoSenha=false;

  if(erro){
    const msg=erro==='otp_expired'
      ? 'Link de senha expirado ou invalido. Peca um novo link em Esqueci minha senha.'
      : 'Nao foi possivel validar o link. Peca um novo link em Esqueci minha senha.';
    G.isAdm=false; G.perfil='jogador'; G.perfilApp='jogador'; G.superAdmin=false; G.usuario=null; G.jogadorLogado=null;
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
    await _sbClient.auth.exchangeCodeForSession(params.get('code')).catch(()=>{});
  }

  if(hash.get('type')==='recovery'){
    mostrarResetSenhaPerfil();
  }
  return {erro:false};
}

async function loginJogadorGoogle(){
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
  if(G.isAdm){
    const btnNova=document.getElementById('btn-nova-pelada');
    if(btnNova) btnNova.style.display=G.perfil==='escalador'?'none':'';
    renderAdmHome();
    goTo('s-adm-home');
    return true;
  }
  return false;
}

function perfilJogadorCompleto(j){
  return !!(j && j.nome && j.apelido && j.email);
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
  if(!email || !email.includes('@')){ showToast('Digite um e-mail valido.'); return null; }
  if(!password || password.length<6){ showToast('Use uma senha com no minimo 6 caracteres.'); return null; }
  return {email,password};
}

async function entrarJogadorSenha(){
  const cred=credenciaisPerfil(); if(!cred)return;
  const { error } = await _sbClient.auth.signInWithPassword(cred);
  if(error){ showToast('E-mail ou senha incorretos.'); return; }
  await restaurarSessaoAdm();
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
  const { error } = await _sbClient.auth.signUp({
    email:cred.email,
    password:cred.password,
    options:{ emailRedirectTo:appRootUrl() },
  });
  if(error){ showToast('Erro ao criar conta.'); return; }
  await restaurarSessaoAdm();
  await carregarPerfilJogador({mostrarFormulario:false});
  await restaurarSessaoAdm();
  if(!abrirDestinoPosLogin()){
    await carregarPerfilJogador({mostrarFormulario:true});
    goTo('s-j-perfil');
  }
  showToast('Conta criada. Verifique seu e-mail se solicitado.');
}

async function recuperarSenhaJogador(){
  const email=(document.getElementById('perfil-email-login').value||'').trim().toLowerCase();
  if(!email || !email.includes('@')){ showToast('Digite seu e-mail antes.'); return; }
  const btn=document.getElementById('perfil-btn-esqueci');
  if(btn){ btn.disabled=true; btn.textContent='Enviando...'; }
  try{
    const { error } = await _sbClient.auth.resetPasswordForEmail(email,{redirectTo:appRootUrl()});
    if(error) throw error;
    showToast('E-mail de redefinicao enviado!');
  }catch(e){ showToast('Erro ao enviar redefinicao.'); }
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
      nome:user.user_metadata?.full_name||user.email?.split('@')[0]||'Jogador',
      ativo:true,
      modalidade:'avulso',
      perfil_app:'jogador',
    });
  }
  G.jogadorLogado=jogador;
  preencherMeuPerfil(jogador);
  if(mostrarFormulario) formCard.style.display='block';
}

async function carregarBaseAppSeNecessario(){
  const precisaCarregar = !Array.isArray(G.peladas) || !G.peladas.length;
  if(!precisaCarregar) return true;
  const jlista=document.getElementById('j-lista');
  if(jlista) jlista.innerHTML='<div class="empty" style="padding:40px 0;"><i class="ti ti-loader" style="animation:spin 1s linear infinite;display:inline-block;font-size:28px;opacity:.5;"></i></div>';
  try{
    await dbCarregarPeladas();
    await aplicarEncerramentoAutomatico();
    const cfg = await dbGetConfig();
    G.valorChurras = cfg ? (Number(cfg.valor_churras)||0) : 0;
    renderJLista();
    return true;
  }catch(e){
    console.error('Erro ao carregar base do app:', e);
    renderJLista();
    showToast('Nao foi possivel carregar as peladas. Tente atualizar a pagina.');
    return false;
  }
}

async function salvarNovaSenhaJogador(){
  const senha=(document.getElementById('perfil-nova-senha')?.value||'').trim();
  if(!senha || senha.length<6){ showToast('Use uma senha com no minimo 6 caracteres.'); return; }
  const { error } = await _sbClient.auth.updateUser({ password:senha });
  if(error){ showToast('Nao foi possivel salvar a nova senha. Peca outro link.'); return; }
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
  document.getElementById('perfil-telefone').value=j.telefone||'';
  document.getElementById('perfil-nascimento').value=j.data_nascimento||'';
  document.getElementById('perfil-pos').value=j.posicao_favorita||'';
  atualizarPreviewMeuPerfil();
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
  if(file.size > 3 * 1024 * 1024){ showToast('Use uma foto de ate 3 MB.'); return; }
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
  const path=`${user.id}/${Date.now()}.${ext}`;
  showToast('Enviando foto...');
  const { error } = await _sbClient.storage.from('jogador-fotos').upload(path,file,{upsert:true,contentType:file.type||'image/jpeg'});
  if(error){ showToast('Erro ao enviar foto.'); return; }
  const { data:pub } = _sbClient.storage.from('jogador-fotos').getPublicUrl(path);
  document.getElementById('perfil-foto-url').value=pub.publicUrl;
  atualizarPreviewMeuPerfil();
  showToast('Foto enviada!');
}

async function salvarMeuPerfil(){
  const id=document.getElementById('perfil-jogador-id').value;
  const nome=document.getElementById('perfil-nome').value.trim();
  const apelido=document.getElementById('perfil-apelido').value.trim();
  if(!id || !nome){ showToast('Informe seu nome.'); return; }
  if(!apelido){ document.getElementById('perfil-apelido').focus(); showToast('Informe seu apelido.'); return; }
  const fields={
    nome,
    apelido,
    instagram:jogadorInstagram(document.getElementById('perfil-instagram').value)||null,
    telefone:document.getElementById('perfil-telefone').value.trim()||null,
    email:document.getElementById('perfil-email').value.trim()||G.usuario?.email||null,
    foto_url:document.getElementById('perfil-foto-url').value.trim()||null,
    data_nascimento:document.getElementById('perfil-nascimento').value||null,
    posicao_favorita:document.getElementById('perfil-pos').value||null,
    updated_at:new Date().toISOString(),
  };
  try{
    await dbAtualizarJogador(id,fields);
    G.jogadorLogado={...(G.jogadorLogado||{}),...fields,id};
    showToast('Perfil salvo!');
  }catch(e){ showToast('Erro ao salvar perfil.'); }
}

async function sairJogador(){
  fecharMenuJogador();
  await _sbClient.auth.signOut().catch(()=>{});
  G.isAdm=false; G.perfil='jogador'; G.perfilApp='jogador'; G.superAdmin=false; G.usuario=null; G.jogadorLogado=null;
  showToast('Sessao encerrada.');
  voltarLista();
}

