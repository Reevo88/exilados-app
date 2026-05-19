// Exilados da Bola
// Inicializacao do app
// Extraido de app.js para reduzir o monolito mantendo o comportamento global atual.

// ==========================================
// INIT
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
  inicializarAuthRecoveryListener();
  const params=new URLSearchParams(window.location.search);
  const perfilParam=params.get('perfil');
  const resetParam=params.get('reset');
  const temRetornoAuth=temRetornoPerfilAuth();

  if(erroRetornoPerfilAuth()){
    atualizarSaudacaoLogin();
    G.isAdm=false; G.perfil='jogador'; G.perfilApp='jogador'; G.superAdmin=false; G.usuario=null; G.jogadorLogado=null;
    mostrarLoginPerfil();
    await tratarRetornoPerfilAuth();
    return;
  }

  if(!temRetornoAuth) await restaurarSessaoAdm();
  atualizarSaudacaoLogin();
  prepararNovaPelada();

  if(temRetornoAuth){
    await abrirPerfilJogador(true);
    return;
  }

  // Carregar peladas do Supabase
  const jlista=document.getElementById('j-lista');
  jlista.innerHTML='<div class="empty" style="padding:40px 0;"><i class="ti ti-loader" style="animation:spin 1s linear infinite;display:inline-block;font-size:28px;opacity:.5;"></i></div>';
  try{
    await dbCarregarPeladas();
    await aplicarEncerramentoAutomatico();
    document.querySelectorAll('.db-banner').forEach(b=>b.style.display='none');
    // Carregar valor do churras para usar no financeiro
    const cfg = await dbGetConfig();
    G.valorChurras = cfg ? (Number(cfg.valor_churras)||0) : 0;
  }catch(err){ console.error('Erro Supabase:',err); }

  // Verificar link de convite (?p=slug-shortid)
  const pSlug=params.get('p');
  renderJLista();
  if(G.isAdm) renderAdmHome();
  setInterval(verificarEncerramentoAutomaticoUI, 60 * 1000);

  // Verifica encerramento automático quando o usuário volta para a aba/app
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible') verificarEncerramentoAutomaticoUI();
  });

  if(pSlug){
    const decodedId=decodeURIComponent(pSlug);
    const match=G.peladas.find(p=>String(p.id)===decodedId);
    if(match){
      G.pelada=match;
      if(peladaEncerrada(match) || deveEncerrarAutomaticamente(match)) await abrirResumoPublico(match.id);
      else { renderJConf(); goTo('s-j-conf'); }
    }
  }
});




