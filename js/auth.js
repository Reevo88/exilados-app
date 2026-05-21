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
  G.isAdm = false; G.perfil = 'jogador'; G.perfilApp='jogador'; G.superAdmin=false; G.podeGerirJogadores=false; G.usuario=null; G.jogadorLogado=null;
  fecharMenu();
  await _sbClient.auth.signOut().catch(()=>{});
  await voltarLista();
}
function atualizarOpcaoPerfilAdm(){
  const nome=document.getElementById('adm-profile-option-name');
  const desc=document.getElementById('adm-profile-option-desc');
  const icon=document.getElementById('adm-profile-option-icon');
  const geral=!!G.podeGerirJogadores;
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
  if(G.podeGerirJogadores) return abrirJogadoresAdm();
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
  const title=document.getElementById('player-menu-title');
  const loginName=document.getElementById('player-menu-login-name');
  const loginDesc=document.getElementById('player-menu-login-desc');
  const sairItem=document.getElementById('player-menu-sair');
  const nomeExibicao=nomeExibicaoExilado();
  if(title) title.textContent=nomeExibicao ? `${saudacaoPorHora()}, Exilado ${nomeExibicao}!` : `${saudacaoPorHora()}, Exilado!`;
  if(loginName) loginName.textContent=G.usuario?'Meu Perfil':'Login';
  if(loginDesc) loginDesc.textContent=G.usuario?'Gerenciar informações pessoais':'Entrar na sua conta';
  if(sairItem) sairItem.style.display=G.usuario?'flex':'none';
  document.getElementById('player-menu').classList.add('open');
}
function fecharMenuJogador(e){ if(!e||e.target===document.getElementById('player-menu')) document.getElementById('player-menu').classList.remove('open'); }

async function abrirPerfilJogador(redirecionarAdm=false){
  fecharMenuJogador();
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
  if(!email || !email.includes('@')){ showToast('Digite um e-mail válido.'); return null; }
  if(!password || password.length<6){ showToast('Use uma senha com no mínimo 6 caracteres.'); return null; }
  return {email,password};
}

function msgAuthErro(e){
  return [e?.status, e?.code || e?.name, e?.message].filter(Boolean).join(' - ') || 'erro desconhecido';
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
      showToast('Falha ao enviar cadastro: '+msgAuthErro(ultimoErro));
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
    showToast('Falha ao enviar redefinição: '+msgAuthErro(e));
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
  if(!id || !nome){ showToast('Informe seu nome.'); return; }
  if(!apelido){ document.getElementById('perfil-apelido').focus(); showToast('Informe seu apelido.'); return; }
  const nascimento=document.getElementById('perfil-nascimento').value.trim();
  const dataNascimento=nascimento?dataBrParaIso(nascimento):null;
  if(nascimento && !dataNascimento){ document.getElementById('perfil-nascimento').focus(); showToast('Informe a data no formato DD/MM/AAAA.'); return; }
  const fields={
    nome,
    apelido,
    instagram:jogadorInstagram(document.getElementById('perfil-instagram').value)||null,
    telefone:formatarTelefone(document.getElementById('perfil-telefone').value)||null,
    email:document.getElementById('perfil-email').value.trim()||G.usuario?.email||null,
    foto_url:document.getElementById('perfil-foto-url').value.trim()||null,
    data_nascimento:dataNascimento,
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
  G.isAdm=false; G.perfil='jogador'; G.perfilApp='jogador'; G.superAdmin=false; G.podeGerirJogadores=false; G.usuario=null; G.jogadorLogado=null;
  showToast('Sessão encerrada.');
  voltarLista();
}

