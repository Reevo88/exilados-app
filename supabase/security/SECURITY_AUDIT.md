# Auditoria frontend -> Supabase

Data da auditoria: 2026-07-13.

## Escopo e método

Foram inspecionados o frontend estático, todas as chamadas REST diretas, os uploads para Storage e as quatro Edge Functions versionadas. Também foi feito um teste externo somente leitura com a chave pública do próprio frontend; nenhum registro foi exibido ou alterado.

O repositório não contém migrations/schema SQL anteriores. Por isso, o estado exato de `relrowsecurity` e o texto das policies só pode ser obtido no banco executando `00_audit_rls.sql`. A resposta HTTP pública permite comprovar exposição anônima, mas não permite distinguir entre RLS desligado e uma policy RLS permissiva.

## Achados críticos

### 1. Dados retornados para a role anônima

O teste `GET ...?select=id&limit=1`, usando somente a chave `sb_publishable`, retornou pelo menos uma linha em:

- `peladas`
- `confirmacoes`
- `jogadores`
- `resultados_pelada`
- `votos_pelada`
- `gols_pelada`
- `videos_pelada`
- `estatisticas_pelada`
- `configuracoes_financeiras`
- `caixa_movimentos`

`push_subscriptions` respondeu HTTP 200 sem linha visível. Isso não prova que a tabela esteja segura: RLS pode filtrar as linhas, a tabela pode estar vazia ou pode haver outra combinação de policy/grant. Confirme no catálogo com o SQL de auditoria.

A consulta ao catálogo confirmou posteriormente que todas as 11 tabelas possuem RLS habilitado, mas nenhuma possui `FORCE ROW LEVEL SECURITY`. Portanto, a exposição observada não era causada por RLS desligado; era causada pelas policies permissivas abaixo.

Policies críticas confirmadas no schema `public`:

- `caixa_movimentos`: leitura anônima com `USING true`;
- `configuracoes_financeiras`: leitura anônima com `USING true`;
- `confirmacoes`: INSERT para anônimo, SELECT com `USING true` e uma policy `ALL` para `public` com `USING true`;
- `estatisticas_pelada`: leitura anônima com `USING true`;
- `gols_pelada`: leitura anônima com `USING true`;
- `jogadores`: leitura anônima com `USING true`;
- `peladas`: leitura anônima e policy `ALL` para `public` com `USING true`;
- `push_subscriptions`: policy `ALL` atribuída a `public`, embora condicionada por `auth.uid() = user_id`;
- `resultados_pelada`: leitura anônima com `USING true`;
- `videos_pelada`: leitura anônima com `USING true`;
- `votos_pelada`: INSERT anônimo e leitura anônima com `USING true`.

As policies administrativas que chamam `exilados_is_full_admin()` e a policy de escalação que chama `exilados_is_escalador()` precisam ser avaliadas pelas definições dessas funções. O uso de `ALL` não é, sozinho, uma vulnerabilidade quando a função de autorização é segura.

A cadeia de autorização foi posteriormente confirmada: `exilados_is_full_admin()` aceita `adm`/`presidente`, `exilados_is_escalador()` aceita `escalador`, e ambas consultam `exilados_current_perfil_app()`. Essa função lê `jogadores.perfil_app` por `auth_user_id = auth.uid()` e mantém um fallback de superadministrador para o e-mail assinado `mr.guima@gmail.com`.

O problema crítico estava na policy `jogador update proprio perfil`: embora restringisse a linha por `auth_user_id`, ela não restringia colunas. Um usuário podia tentar alterar o próprio `perfil_app` para `adm`, fazendo a função administrativa passar a reconhecê-lo. O novo trigger bloqueia alterações de `perfil_app` e `auth_user_id` por usuários comuns. O papel `escalador` conserva somente SELECT/UPDATE global em `confirmacoes`.

Impactos observáveis:

- exposição de dados financeiros em `configuracoes_financeiras` e `caixa_movimentos`;
- exposição de e-mail, telefone, perfil e `auth_user_id` porque o frontend consulta esses campos de `jogadores`;
- exposição de votos individuais (`nome_votante`, `nome_votado`, `nota`);
- identificação de confirmações, ausências, pagamentos e resultados.

### 2. O frontend não envia propriedade em quase todas as gravações

As inserções em `peladas`, `confirmacoes`, `resultados_pelada`, `gols_pelada`, `videos_pelada`, `estatisticas_pelada`, `votos_pelada`, `configuracoes_financeiras` e `caixa_movimentos` não enviam `owner_id` ou `user_id`. Somente `push_subscriptions` envia `user_id`.

O hardening proposto resolve novas linhas com um trigger que preenche `owner_id = auth.uid()`. Operações anônimas deixam de funcionar. Linhas históricas são atribuídas a um usuário legado explicitamente configurado, exceto quando já existe `auth_user_id`/`user_id` válido.

### 3. Autorização administrativa está no cliente

O frontend calcula perfis administrativos por e-mail e por `jogadores.perfil_app`. Isso serve para interface, não para segurança: qualquer usuário pode chamar a API REST diretamente e ignorar `G.isAdm`, `G.podeGerirJogadores` e botões escondidos.

O SQL mantém `owner_id = auth.uid()` para usuários comuns, mas cria uma exceção controlada para `perfil_app in ('adm', 'presidente')`. Essa condição é consultada no banco por uma função sem parâmetros; o frontend não decide quem é administrador.

O trigger também impede autoelevação: um usuário comum não pode alterar `perfil_app`, trocar `auth_user_id` ou inserir seu perfil já como administrador. Administradores podem editar dados de terceiros, mas não podem trocar silenciosamente o `owner_id` de uma linha existente.

### 4. Service role não está exposta no frontend, mas há uso privilegiado sem autorização

Não foi encontrado valor de `service_role`, `service_rolling_key` ou `SUPABASE_SERVICE_ROLE_KEY` no HTML/JavaScript. A chave presente no frontend é `sb_publishable`, que é pública por definição e depende de RLS.

As Edge Functions obtêm `SUPABASE_SERVICE_ROLE_KEY` por `Deno.env`, que é o local correto. Porém:

- `send-push` não valida JWT nem perfil e aceita título, texto e URL arbitrários; um anônimo pode disparar push para todas as inscrições;
- `notify-pelada-aberta` não valida JWT nem perfil e pode enviar e-mail a toda a base de Auth;
- `notify-admin-pelada-change` não valida JWT nem garante que a confirmação pertença ao chamador; pode ser usada para spam dos administradores;
- `email-unsubscribe` usa apenas Base64 do e-mail, sem assinatura ou expiração; o token é forjável;
- todas usam `Access-Control-Allow-Origin: *`. CORS não é autorização e chamadas fora do navegador continuam possíveis.

Isso não vaza diretamente a chave, mas transforma as funções em intermediários públicos com poderes de `service_role`. RLS não protege operações feitas por `service_role`, pois essa role ignora RLS.

### 5. Policies de Storage confirmadas no banco

A execução de `00_audit_rls.sql` confirmou policies críticas em `storage.objects`:

- upload anônimo no bucket `melhores-momentos`;
- leitura pública/anônima duplicada nos dois buckets;
- qualquer autenticado podia excluir arquivos de `jogador-fotos`, validando apenas o `bucket_id`;
- qualquer autenticado podia inserir e atualizar em `jogador-fotos`, também com policies que validavam apenas o `bucket_id`;
- policies antigas mais restritas coexistiam com policies abertas e não ofereciam proteção, pois policies permissivas são combinadas por `OR`.

O script `02_storage_hardening.sql` foi atualizado para tratar `jogador-fotos` e `melhores-momentos`: leitura compartilhada somente após login, gestão global para `adm`/`presidente` e escrita estrita no próprio objeto/pasta para usuários comuns.

## Efeito funcional do modelo estrito solicitado

Aplicar `01_strict_owner_rls.sql` muda deliberadamente o produto:

- visitantes anônimos deixam de listar peladas, jogadores, resultados e ranking;
- confirmação e votação sem login deixam de funcionar;
- `adm` e `presidente` continuam podendo ler, editar e excluir dados pertencentes a outros usuários;
- usuários autenticados continuam vendo peladas, confirmações, placares, gols, vídeos, estatísticas e ranking;
- `escalador` conserva leitura e atualização global somente de confirmações;
- financeiro fica restrito a `adm`/`presidente`, exceto `valor_churras`, exposto por uma view autenticada de coluna única;
- dados completos de `jogadores` ficam restritos ao próprio jogador/ADM; listagens usam `jogadores_publicos`, sem e-mail, telefone, `auth_user_id` ou `perfil_app`. `data_nascimento` é exposto por decisão de produto (coroa de aniversariante do mês e idade nos cards de peladeiro);
- Edge Functions com `service_role` continuam capazes de ignorar RLS;
- fotos deixam de ser públicas após `02_storage_hardening.sql`; o frontend deve trocar `getPublicUrl()` por URLs assinadas.

O modelo final é relacional e específico por domínio: leitura esportiva compartilhada após login, escrita por dono quando aplicável e escrita administrativa nas tabelas gerenciais.

## Ordem de execução

1. Fazer backup e executar `00_audit_rls.sql`; salvar os resultados.
2. Executar `00b_prepare_authenticated_views.sql`; ele não remove policies.
3. Publicar o frontend que consulta as novas views.
4. Revisar o e-mail `legacy_owner` e testar `01_strict_owner_rls.sql` com `ROLLBACK`.
5. Executar `01_strict_owner_rls.sql` com `COMMIT` em homologação/produção controlada.
6. Executar `03_verify_hardening.sql`; as consultas marcadas como falha devem retornar zero linhas.
7. Executar `02_storage_hardening.sql` somente depois de preparar URLs assinadas no frontend.
8. Testar com dois jogadores, um escalador e um ADM: leitura esportiva compartilhada deve funcionar; escritas cruzadas devem falhar fora das exceções documentadas.

Não aplique diretamente em produção sem homologação: o frontend atual depende de leitura pública e de dados compartilhados.
