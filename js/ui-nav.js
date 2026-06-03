(function(){
  if(window.__exiladosUiNavLoaded) return;
  window.__exiladosUiNavLoaded = true;

  var navRefreshRaf = 0;

  function setIndicator(nav, btn, soft){
    if(!nav || !btn) return;
    var navRect = nav.getBoundingClientRect();
    var btnRect = btn.getBoundingClientRect();
    if(!navRect.width || !btnRect.width) return;

    var isTouching = nav.classList.contains('nav-touching');
    var width = Math.max(50, Math.min(78, btnRect.width - (isTouching ? 6 : 10)));
    var x = (btnRect.left - navRect.left) + ((btnRect.width - width) / 2);
    var centerPct = Math.max(0, Math.min(100, ((x + width / 2) / navRect.width) * 100));

    nav.style.setProperty('--nav-indicator-x', x.toFixed(1) + 'px');
    nav.style.setProperty('--nav-indicator-w', width.toFixed(1) + 'px');
    nav.style.setProperty('--nav-indicator-opacity', '1');
    nav.style.setProperty('--nav-glow-x', centerPct.toFixed(1) + '%');

    nav.querySelectorAll('.nav-btn.nav-hover').forEach(function(b){ b.classList.remove('nav-hover'); });
    if(soft) btn.classList.add('nav-hover');
  }

  function getActiveButton(nav){
    return nav.querySelector('.nav-btn.active:not(.nav-disabled)') || nav.querySelector('.nav-btn:not(.nav-disabled)');
  }

  function nearestButtonFromPoint(nav, x, y){
    var buttons = Array.prototype.slice.call(nav.querySelectorAll('.nav-btn:not(.nav-disabled)'));
    var best = null;
    var bestDist = Infinity;
    buttons.forEach(function(btn){
      var r = btn.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var dist = Math.hypot(cx - x, cy - y);
      if(dist < bestDist){ bestDist = dist; best = btn; }
    });
    return best;
  }

  function handleNavTap(e){
    var btn = e.currentTarget;
    if(btn.classList.contains('nav-disabled') || btn.disabled) return;
    var nav = btn.closest('.bottom-nav');
    if(navigator.vibrate) navigator.vibrate(8);
    setIndicator(nav, btn, true);

    var ring = document.createElement('span');
    ring.className = 'nav-ripple';
    ring.style.cssText = 'position:absolute;top:50%;left:50%;width:46px;height:46px;border-radius:50%;background:radial-gradient(circle, rgba(255,255,255,.22), rgba(255,255,255,.06) 58%, rgba(255,255,255,0) 74%);transform:translate(-50%,-50%) scale(.22);pointer-events:none;z-index:0;';
    btn.appendChild(ring);
    ring.animate([
      {transform:'translate(-50%,-50%) scale(.25)',opacity:.58},
      {transform:'translate(-50%,-50%) scale(1.45)',opacity:.15},
      {transform:'translate(-50%,-50%) scale(1.75)',opacity:0}
    ],{duration:360,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'}).onfinish=function(){ring.remove();};
  }

  function navKeyForScreen(id){
    if(!id) return null;
    if(id === 's-adm-dashboard' || id === 's-adm-home' || id === 's-adm-criar') return 'home';
    if(id === 's-adm-conf') return 'conf';
    if(id === 's-adm-times') return 'times';
    if(id === 's-adm-fin' || id === 's-adm-fin-pelada') return 'caixa';
    if(id === 's-adm-jogadores') return 'peladeiros';
    if(id === 's-j-lista' || id === 's-j-historico') return 'home';
    if(id === 's-j-conf') return 'conf';
    if(id === 's-j-times') return 'times';
    if(id === 's-j-caixa') return 'caixa';
    if(id === 's-j-perfil' || id === 's-j-peladeiros') return 'perfil';
    return null;
  }

  function keyForButton(btn){
    var txt = (btn && btn.textContent || '').trim().toLowerCase();
    var icon = btn && btn.querySelector('i');
    var cls = icon ? icon.className : '';
    if(txt.indexOf('início') !== -1 || txt.indexOf('inÃ­cio') !== -1 || cls.indexOf('ti-home') !== -1) return 'home';
    if(txt.indexOf('confirma') !== -1 || cls.indexOf('ti-users') !== -1) return 'conf';
    if(txt.indexOf('escala') !== -1 || cls.indexOf('ti-shirt') !== -1) return 'times';
    if(txt.indexOf('caixa') !== -1 || cls.indexOf('ti-cash') !== -1) return 'caixa';
    if(txt.indexOf('peladeiros') !== -1) return 'peladeiros';
    if(txt.indexOf('perfil') !== -1 || cls.indexOf('ti-user-circle') !== -1) return 'perfil';
    return null;
  }

  window.syncBottomNavForScreen = function(id){
    var screen = id ? document.getElementById(id) : document.querySelector('.screen.active');
    if(!screen) return;
    var key = navKeyForScreen(screen.id);
    var nav = screen.querySelector('.bottom-nav');
    if(!nav) return;
    nav.querySelectorAll('.nav-btn').forEach(function(btn){ btn.classList.remove('nav-hover'); });
    if(key){
      nav.querySelectorAll('.nav-btn').forEach(function(btn){ btn.classList.toggle('active', keyForButton(btn) === key); });
    }
    requestAnimationFrame(function(){ setIndicator(nav, getActiveButton(nav), false); });
  };

  function refreshActiveNavs(){
    navRefreshRaf = 0;
    document.querySelectorAll('.screen.active .bottom-nav').forEach(function(nav){
      setIndicator(nav, getActiveButton(nav), false);
    });
    if(window.syncBottomNavForScreen) window.syncBottomNavForScreen();
  }

  function scheduleNavRefresh(){
    if(navRefreshRaf) return;
    navRefreshRaf = requestAnimationFrame(refreshActiveNavs);
  }

  function initNav(nav){
    if(!nav || nav.dataset.rappiNavReady === '1') return;
    nav.dataset.rappiNavReady = '1';

    nav.querySelectorAll('.nav-btn').forEach(function(btn){
      btn.setAttribute('data-haptic','1');
      btn.addEventListener('click', handleNavTap);
      btn.addEventListener('pointerenter', function(){ setIndicator(nav, btn, true); });
      btn.addEventListener('focus', function(){ setIndicator(nav, btn, true); });
    });

    nav.addEventListener('pointermove', function(e){
      if(e.pointerType && e.pointerType !== 'mouse') return;
      var btn = nearestButtonFromPoint(nav, e.clientX, e.clientY);
      if(btn){
        var r = nav.getBoundingClientRect();
        var pct = ((e.clientX - r.left) / Math.max(1, r.width));
        nav.style.setProperty('--nav-tilt', ((pct - .5) * 1.2).toFixed(2) + 'deg');
        nav.classList.add('nav-touching');
        setIndicator(nav, btn, true);
      }
    }, {passive:true});

    ['pointerleave','blur'].forEach(function(evt){
      nav.addEventListener(evt, function(){
        nav.classList.remove('nav-touching');
        nav.style.setProperty('--nav-tilt', '0deg');
        nav.querySelectorAll('.nav-btn.nav-hover').forEach(function(b){ b.classList.remove('nav-hover'); });
        setIndicator(nav, getActiveButton(nav), false);
      }, true);
    });

    requestAnimationFrame(function(){ setIndicator(nav, getActiveButton(nav), false); });
  }

  function initAllNavs(){
    document.querySelectorAll('.bottom-nav').forEach(initNav);
    scheduleNavRefresh();
  }

  document.addEventListener('DOMContentLoaded', function(){
    initAllNavs();
  });

  window.addEventListener('resize', scheduleNavRefresh, {passive:true});
  window.addEventListener('orientationchange', function(){ setTimeout(scheduleNavRefresh, 250); }, {passive:true});
})();
