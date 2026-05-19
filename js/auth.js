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

    const perfilNome = PERFIL_POR_EMAIL[data.user.email] || 'full';
    G.isAdm  = true;
    G.perfil = perfilNome;
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
    showToast('Login ou senha incorretos.');
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
      redirectTo: APP_BASE_URL + '/?reset=1',
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
  G.isAdm = false; G.perfil = 'full';
  fecharMenu();
  await _sbClient.auth.signOut().catch(()=>{});
  goTo('s-j-lista'); renderJLista();
}
function abrirMenu(){ document.getElementById('adm-menu').classList.add('open'); }
function fecharMenu(e){ if(!e||e.target===document.getElementById('adm-menu')) document.getElementById('adm-menu').classList.remove('open'); }

