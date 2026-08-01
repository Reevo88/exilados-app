# Exilados App — v2.0.1

PWA de gestão de peladas amador. Controla confirmações, escalações, caixa, pós-jogo, ranking de performance e artilharia.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5 + CSS3 + JavaScript vanilla (sem framework) |
| Backend / DB | Supabase (PostgreSQL via PostgREST REST API) |
| Auth | Supabase Auth |
| Edge Functions | Deno (notificações email + push) |
| PWA | Service Worker com cache offline (`sw.js`) |
| Tipografia | Inter + Barlow Condensed (Google Fonts) |
| Ícones | Tabler Icons (webfont) |

---

## Estrutura de arquivos

```
ExiladosApp/
├── index.html              # Único HTML — todas as telas como <div class="screen">
├── style.css               # Estilos globais + temas de todas as telas
├── sw.js                   # Service Worker (cache offline)
├── manifest.json           # PWA manifest
│
├── css/
│   ├── bottom-nav.css      # Nav bar flutuante (glassmorphism, indicador animado)
│   └── header.css          # Header global
│
├── js/
│   ├── core.js             # Estado global (G), sbFetch, utilitários, navegação (goTo), reloadApp()
│   ├── auth.js             # Login, sessão, menu hambúrguer, perfis adm/jogador
│   ├── bootstrap.js        # Init do app, carregamento inicial de dados
│   ├── player.js           # Telas do jogador: home, histórico, peladeiros, ranking
│   ├── admin.js            # Painel admin: criar/editar pelada, gestão de jogadores
│   ├── finance.js          # Módulo financeiro (caixa, entradas, saídas)
│   ├── postgame.js         # Resumo pós-jogo: placar, escalações, vídeos, estatísticas
│   ├── voting.js           # Votação de MVP e destaques
│   └── ui-nav.js           # Bottom nav: indicador deslizante, keyForButton, syncBottomNavForScreen
│
├── supabase/
│   └── functions/
│       ├── notify-admin-pelada-change/
│       │   └── index.ts    # Edge Function: email de alteração de pelada para admins
│       ├── notify-pelada-aberta/
│       │   └── index.ts    # Edge Function: email para todos os atletas quando pelada abre
│       ├── email-unsubscribe/
│       │   └── index.ts    # Edge Function: descadastro de emails via token
│       └── send-push/
│           └── index.ts    # Edge Function: envia Web Push para todos os dispositivos cadastrados
│
└── img / assets (raiz)
    ├── ranking.jpg           # Hero bg — cards de ranking (home + tela ranking)
    ├── peladas.jpg           # Hero bg — próxima pelada + resultados anteriores
    ├── caixa.jpg             # Hero bg — card do caixa (home + tela caixa)
    ├── placar.jpg            # Hero bg — card de placar no pós-jogo
    ├── exilado.jpg           # Hero bg — cards de apresentação dos Exilados (tela peladeiros)
    ├── camisa-azul.png       # Camisa time azul
    ├── camisa-vermelha.png   # Camisa time vermelho
    ├── logo-exilados.png     # Logotipo "ExiladosApp" (texto com coroa) — header de todas as telas
    ├── boi-mono.png          # Mascote boi — header (via CSS ::before), otimizado 200px/21KB
    ├── boi-blue.png          # Boi decorativo time azul (tela de escalações)
    ├── boi-red.png           # Boi decorativo time vermelho (tela de escalações)
    ├── favicon.png           # Favicon 32×32 — aba do navegador
    ├── apple-touch-icon.png  # Ícone iOS 180×180 — atalho na tela inicial (PWA)
    ├── og-image.png          # Open Graph 1200×630 — preview do link no WhatsApp
    └── icon-192/512.png      # Ícones PWA manifest (gerados do boi-mono)
```

---

## Estado global

Tudo passa pelo objeto `G` definido em `core.js`:

```js
G = {
  isAdm, perfil, superAdmin,   // permissões
  usuario, jogadorLogado,       // auth
  peladas[], jogadores[],       // dados carregados
  pelada,                       // pelada ativa/selecionada
  appContext,                   // 'player' | 'admin'
}
```

---

## Navegação

- `goTo('screen-id')` — ativa uma tela e chama `syncBottomNavForScreen`
- Cada `<div class="screen" id="s-*">` é uma tela completa com header + `page-body` + `bottom-nav`
- `syncBottomNavForScreen(id)` em `ui-nav.js` sincroniza o indicador da nav com a tela ativa
- Logo do boi na home chama `reloadApp()` — limpa cache do Service Worker e força reload completo

### Mapeamento telas → nav key

| Tela | Nav key |
|---|---|
| `s-j-lista`, `s-j-historico`, `s-j-ranking` | `home` |
| `s-j-conf` | `conf` |
| `s-j-times` | `times` |
| `s-j-caixa` | `caixa` |
| `s-j-peladeiros` | `peladeiros` |
| `s-j-perfil` | _(sem marcação)_ |
| `s-adm-dashboard/home/criar` | `home` |
| `s-adm-conf` | `conf` |
| `s-adm-times` | `times` |
| `s-adm-fin` | `caixa` |
| `s-adm-jogadores` | `peladeiros` |

---

## Acesso ao banco

```js
sbFetch('/tabela?filtros')          // GET/POST/PATCH/DELETE via PostgREST
sbInvokeFunction('nome', payload)   // Edge Function Supabase
```

URL base: `https://ksebcxtuwsdmoykgflmq.supabase.co`

---

## Dual-matching de jogadores

Jogadores podem estar vinculados por `jogador_id` (FK) ou por nome/apelido quando cadastrados manualmente pelo admin. O padrão de matching duplo em `player.js` e `_calcularRanking`:

1. Tenta `item.jogador_id === jogador.id`
2. Fallback: `normNome(item.nome)` compara com `normNome(jogador.nome)` e aliases/apelidos

---

## Módulo de Ranking

Localizado em `player.js` (funções `abrirRanking`, `renderRanking`, etc.).

### Performance

```
Aproveitamento = (3×V + E) ÷ (3×J)
Presença       = jogos_atleta ÷ total_peladas_período
Score          = Aproveitamento × Presença
```

- **Mensal**: mínimo 1 jogo no período
- **Anual**: mínimo 10% das peladas encerradas no ano
- **Desempate**: mais jogos → maior aproveitamento → mais vitórias

### Artilharia

- `SUM(gols)` agrupado por jogador no período
- Média gols/jogo exibida como coluna secundária
- Desempate pela maior média
- Gols buscados via `sbFetch('/gols_pelada?pelada_id=in.(...)`)` com cache por conjunto de IDs

---

## Fotos de jogadores (lazy loading)

Fotos no ranking usam `IntersectionObserver` via `data-rlazy` attribute:

```js
_rankingLazyFotos(container)  // observa imgs[data-rlazy], seta src ao entrar na viewport
_rankingFotoHtml(jogador)     // gera <img data-rlazy="url"> sem src inicial
```

---

## Bottom Nav

Sistema em `css/bottom-nav.css` + `js/ui-nav.js`:

- **Glassmorphism**: `backdrop-filter: blur(24px) saturate(1.6)` com fundo `rgba(8,8,8,.25)` — efeito de vidro fosco transparente, padrão iOS
- Fallback para browsers sem suporte: `rgba(8,8,8,.92)` via `@supports not`
- Indicador deslizante via `::before` com CSS custom properties (`--nav-indicator-x`, `--nav-indicator-w`)
- **Snap instantâneo** na troca de tela (classe `nav-instant` desabilita `transition`)
- **Animação suave** no hover/tap do usuário
- `keyForButton(btn)` — texto tem prioridade sobre ícone (evita falso-positivo de `ti-users`)
- `pointermove` throttled via `requestAnimationFrame`

---

## Badges de confirmação (auto-shrink)

Quando um jogador acumula os três badges (MENSALISTA + JOGO + CHURRAS), o conjunto pode ultrapassar a largura disponível na linha. As funções `fitConfBadges(container)` em `player.js` e `admin.js` resolvem isso dinamicamente:

- Executada via duplo `requestAnimationFrame` após render do `innerHTML` (garante layout estabilizado)
- Detecta overflow via `name.scrollWidth > name.clientWidth`
- Reduz progressivamente `font-size`, `padding` e `gap` dos badges até a linha caber (mínimo 5.5px)
- Mesma lógica aplicada aos badges financeiros via `fitFinBadges(container)`
- Na aba **NÃO VÃO** (adm), o botão CONFIRMAR é ícone-only (sem texto) — o texto "CONFIRMAR" não cabe ao lado do badge de modalidade; `title="Confirmar"` preserva a usabilidade

---

## Cards de Exilados (tela peladeiros)

Todos os cards usam `exilado.jpg` como fundo via `::before` pseudo-elemento:

- Gradiente `linear-gradient(90deg, rgba(0,0,0,.88) → rgba(0,0,0,.25))` sobre a imagem — deixa lado esquerdo (texto) legível
- `background-position: 65% top` — ancora o topo da imagem para preservar a silhueta do atleta
- Cores unificadas: destaque em amarelo `#F5E400` para ambos os times (removida alternância vermelho/azul)
- Intro text da tela: "Consulta rápida dos **Exilados** inscritos."

---

## Imagens de fundo (hero backgrounds)

Todas as imagens de fundo são JPG otimizados (~20–40 KB cada), aplicados via CSS `::before` pseudo-elemento para garantir clipping correto com `border-radius` em todos os browsers:

```css
.card {
  overflow: hidden;
  isolation: isolate;
}
.card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;   /* herda o border-radius do pai — evita vazamento em media queries */
  background: linear-gradient(overlay), url('imagem.jpg') center/cover;
}
```

As 3 imagens da home (`peladas.jpg`, `caixa.jpg`, `ranking.jpg`) têm `<link rel="preload">` no `<head>` para eliminar pop-in no primeiro carregamento.

---

## Otimização de assets

Todos os assets de imagem foram otimizados com `sharp` (Node.js). Tamanhos finais:

| Arquivo | Tamanho | Observação |
|---|---|---|
| `boi-mono.png` | 21 KB | Redimensionado para 200px (era 1.483 KB) |
| `logo-exilados.png` | 55 KB | Redimensionado para 800px (era 861 KB) |
| `icon-192.png` | 16 KB | Gerado do boi-mono |
| `icon-512.png` | 70 KB | Gerado do boi-mono |
| `favicon.png` | 1 KB | 32×32, gerado do boi-mono |
| `apple-touch-icon.png` | 13 KB | 180×180, gerado do boi-mono |
| `og-image.png` | 75 KB | 1200×630, preview WhatsApp |

### PWA / Open Graph

- `favicon.png` — referenciado via `<link rel="icon">` no `<head>`
- `apple-touch-icon.png` — referenciado via `<link rel="apple-touch-icon">`, aparece como ícone ao adicionar à tela inicial do iPhone
- `og-image.png` — referenciado via `<meta property="og:image">`, controla o preview de imagem quando o link do app é compartilhado no WhatsApp

---

## Consistência financeira — card vs. tela

O card de pelada no dashboard admin e a tela de financeiro usam a mesma função de cálculo (`valorJogadorCard`):

```
valor = p.valor                          // jogo (avulso)
      + valorChurras  (se jogo_churras)  // jogo + churras
      = valorChurras  (se só churras)    // só churras
```

Mensalistas e isentos retornam 0. O `previsto` é a soma individual de cada cobravelável — não `count × p.valor`.

---

## PWA / Offline

O Service Worker (`sw.js`) faz cache de todos os assets estáticos na instalação. Dados dinâmicos (peladas, jogadores, gols) sempre buscam do Supabase em tempo real. Em caso de falha de rede, o app exibe a última versão cacheada da interface.

A função `reloadApp()` em `core.js` limpa todos os caches do SW via `caches.keys()` + `caches.delete()` antes de forçar o reload — útil para garantir que uma nova versão seja carregada.

---

## Perfis e permissões

| Perfil | Acesso |
|---|---|
| Visitante | Resumo público do pós-jogo |
| Jogador | Home, confirmações, escalações, caixa, exilados, ranking, perfil |
| Admin (`perfil: 'full'`) | Tudo acima + painel administrativo |
| Super Admin | Admin + configurações avançadas |

---

## Notificações

### Email (Resend)

Dois fluxos de email via Edge Functions:

| Função | Gatilho | Destinatários |
|---|---|---|
| `notify-admin-pelada-change` | Confirmação/cancelamento de jogador | Admins cadastrados |
| `notify-pelada-aberta` | Abertura de pelada pelo admin | Todos os atletas (opt-out disponível) |

- Header com `boi-mono.png` + `logo-exilados.png` centralizados em fundo escuro
- CTA amarelo com `bola-icon.png` linkando direto para a pelada via `?p=<id>`
- Rodapé com link de descadastro personalizado por atleta (`btoa(email)` como token)
- `notify-pelada-aberta` dispara também o push após enviar os emails

### Descadastro (`email-unsubscribe`)

- Recebe `?token=<base64_email>`, decodifica com `atob(token)`
- Atualiza `user_metadata.email_notifications = false` no Supabase Auth
- Retorna página HTML de confirmação com boi-mono
- Atletas com `email_notifications === false` são excluídos dos envios futuros

### Push Notifications (Web Push / VAPID)

- Suportado em Chrome (desktop e Android) e Safari iOS 16.4+ (somente PWA na tela inicial)
- Na primeira abertura após login, `registrarPush()` solicita permissão ao usuário
- Subscription (`endpoint`, `p256dh`, `auth`) salva na tabela `push_subscriptions` via RLS
- `send-push` Edge Function lê todas as subscriptions e envia via protocolo Web Push (VAPID)
- Subscriptions expiradas (HTTP 404/410) são removidas automaticamente do banco
- Clique na notificação abre o app na URL correta via `notificationclick` no Service Worker

---

## Versão

`v2.0.1` — exibida no `<title>` da página e no rodapé do menu hambúrguer.
