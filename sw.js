// ==========================================
// EXILADOS DA BOLA - Service Worker (PWA)
// ==========================================

const CACHE_NAME = 'exilados-v12-caixa-nav-fix';

// Arquivos que ficam no cache para funcionar offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css?v=20260613-caixa-nav-fix-1',
  '/css/header.css?v=20260613-caixa-nav-fix-1',
  '/css/bottom-nav.css?v=20260613-caixa-nav-fix-1',
  '/js/core.js',
  '/js/auth.js',
  '/js/player.js',
  '/js/admin.js',
  '/js/finance.js',
  '/js/postgame.js',
  '/js/voting.js',
  '/js/bootstrap.js',
  '/js/ui-nav.js?v=20260601-header-adm-fix-2',
  '/logo-exilados.png',
  '/boi-mono.png',
  '/bola-icon.png',
  '/logo.png',
  '/camisa-azul.png?v=2',
  '/camisa-vermelha.png?v=2',
  '/boi-blue.png',
  '/boi-red.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css',
];

// -- Install: pré-cacheia os assets estáticos --
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Adiciona um a um para não falhar tudo se um asset externo der erro
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// -- Activate: limpa caches antigos --
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// -- Fetch: estratégia híbrida --
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Requisições ao Supabase: sempre vai pra rede (dados em tempo real)
  if (url.hostname.includes('supabase.co')) {
    return; // deixa o browser tratar normalmente
  }

  // YouTube precisa receber Referer/Origin intactos para o player embutido.
  // Não interceptamos embeds nem thumbnails para evitar erro 153.
  if (
    url.hostname.includes('youtube.com') ||
    url.hostname.includes('youtube-nocookie.com') ||
    url.hostname.includes('ytimg.com') ||
    url.hostname.includes('googlevideo.com')
  ) {
    return;
  }

  // Google Fonts e CDNs externos: cache-first (raramente mudam)
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdn.jsdelivr.net')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        });
      })
    );
    return;
  }

  // Assets locais (HTML, CSS, JS, imagens): network-first com fallback para cache
  // Assim o app sempre tenta pegar a versão mais recente,
  // mas funciona offline se não houver rede.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Salva cópia no cache se for uma resposta válida
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => {
        // Offline: tenta servir do cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback final: retorna o index.html para rotas não cacheadas
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return Response.error();
        });
      })
  );
});
