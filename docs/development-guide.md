# Guia de desenvolvimento

## Requisitos

- Node.js 24 e npm.
- Docker Engine em execução para subir o Supabase local.
- Não é necessário vincular um projeto remoto para iniciar o Next.js.

## Primeira execução

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `NEXT_PUBLIC_SITE_URL` em `.env.local`. Os clientes validam a configuração quando são criados e informam nomes de variáveis ausentes sem imprimir valores. Não use uma chave `service_role` no navegador.

## Supabase local

O Supabase CLI está fixado em `2.121.0` no projeto. Os comandos podem ser executados via npm:

```bash
npm run supabase -- --version
npm run supabase -- start
npm run supabase -- status
npm run supabase -- migration up --local
npm run test:db
```

Copie a API URL e somente a chave pública/anon informadas pelo comando `status` para `.env.local`. O comando pode exibir também uma chave privilegiada; não a copie para variáveis `NEXT_PUBLIC_*` nem para código do navegador. `NEXT_PUBLIC_SITE_URL` deve apontar para a origem local. Signup, login, callback de confirmação e recuperação usam Supabase Auth.

Para parar os serviços locais sem apagar dados:

```bash
npm run supabase -- stop
```

## Projeto remoto de desenvolvimento

Use somente um projeto Supabase criado para desenvolvimento. A URL e a chave pública podem ser obtidas nas configurações de API do projeto e adicionadas ao `.env.local`. Não é necessário fazer `link` para que a aplicação use o projeto.

Para aplicar migrations remotamente, confira o identificador do projeto antes de vincular, confirme que é desenvolvimento e configure `NEXT_PUBLIC_SITE_URL` como uma URL permitida em Auth > URL Configuration:

```bash
npm run supabase -- link --project-ref <DEV_PROJECT_REF>
npm run supabase -- migration list
npm run supabase -- db push
```

`db push` altera o banco remoto. Revise cada migration e o projeto vinculado antes de executá-lo. Nunca use um projeto de produção para este fluxo. Nenhum link remoto foi criado durante esta implementação.

## Migrations

Crie migrations incrementais versionadas; não aplique SQL manualmente como substituto do arquivo versionado:

```bash
npm run supabase -- migration new descricao_curta
npm run supabase -- migration up --local
npm run test:db
```

O modelo de tenant está em `supabase/migrations/20261018000100_multitenant_auth.sql`; o teste RLS pgTAP está em `supabase/tests/rls/tenant_isolation.test.sql`. O teste cria duas empresas e usuários temporários dentro de uma transação, assume `authenticated` com claims JWT de teste e faz rollback. Não usa `service_role`. Não execute `db reset` para aplicar migrations; esse comando apaga o banco local.

## Papéis e permissões

| Papel | Ler empresa e dados do tenant | Alterar nome da empresa | Consultar memberships do tenant | Gerenciar memberships |
| --- | --- | --- | --- | --- |
| `owner` | Sim | Sim | Todas | Adicionar `admin`, `manager` e `agent`; alterar/suspender/remover esses papéis |
| `admin` | Sim | Sim | Todas | Adicionar/alterar/suspender/remover `manager` e `agent` |
| `manager` | Sim | Não | Apenas o próprio vínculo | Não |
| `agent` | Sim | Não | Apenas o próprio vínculo | Não |

Todos os papéis leem e alteram somente seu próprio `profiles` row. Usuários não podem alterar ou remover o vínculo `owner`, promover a si próprios, nem mudar `organization_id` ou `user_id` de um membership. Remoção é `DELETE` do vínculo; suspensão muda `status` para `suspended`. Membership suspenso perde acesso a empresas e dados, mas consegue ler o próprio status. Organizações não podem ser apagadas por clientes nesta etapa.

RLS é a autoridade final: as policies chamam funções `SECURITY DEFINER` pequenas no schema não exposto `private`, com `search_path` vazio e execução revogada para `PUBLIC`/`anon`. Elas leem `memberships` como owner da função para evitar recursão de RLS. A única RPC privilegiada exposta, `create_organization(p_name)`, deriva o usuário de `auth.uid()`, rejeita contas que já tenham qualquer membership e cria organização + owner na mesma transação. Ela não recebe `organization_id`.

## Fluxos de Auth

- `/signup` cria apenas a conta Supabase e o perfil é criado por trigger; confirmação de e-mail segue a configuração Auth do projeto.
- `/login`, `/auth/callback`, `/forgot-password` e `/reset-password` implementam sessão e recuperação.
- `/onboarding/organization` chama a RPC segura; o primeiro responsável não é escolhido pelo navegador.
- `/dashboard` é protegido no `src/proxy.ts` e valida novamente a sessão no servidor com `auth.getUser()` antes de consultar memberships/organizações sob RLS.
- O proxy valida claims e propaga refresh de cookies; autorização de dados nunca depende só do proxy ou de valores de formulário.
- Não há convites por e-mail nem client `service_role`. Owners/admins podem criar memberships apenas para usuários Auth existentes segundo as policies; o fluxo de convite será uma etapa posterior.

## Clientes e segredos

- `src/lib/supabase/browser.ts` cria o cliente para Client Components.
- `src/lib/supabase/server.ts` cria um cliente por chamada no servidor e usa a API pública com cookies do Next.js.
- A validação Zod está em `src/lib/env.ts`; credenciais não são exibidas nos erros.
- Não há cliente privilegiado/service-role nesta etapa. Se necessário no futuro, ele deverá existir apenas em código servidor e com autorização apropriada.
- Renovação de sessão e fluxos de autenticação não fazem parte desta etapa; adicione o proxy de sessão junto com a etapa de autenticação antes de depender de sessões persistentes.

## Qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

O workflow `.github/workflows/ci.yml` executa esses comandos em pull requests e pushes para `main`, sem exigir segredos Supabase.

`npm run test:db` requer Supabase local ativo e migrations aplicadas. O CI inicia a stack local e executa os testes pgTAP antes do build.