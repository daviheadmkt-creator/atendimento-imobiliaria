# Atendimento Imobiliário

SaaS de atendimento imobiliário com Next.js App Router, TypeScript e Supabase. Esta etapa implementa autenticação e isolamento multiempresa; módulos comerciais ainda não foram criados.

## Desenvolvimento

Requisitos: Node.js 24, npm e, para o Supabase local, Docker.

```bash
npm ci
npm run dev
```

Configure `.env.local` a partir de `.env.example` e use um projeto Supabase local ou de desenvolvimento. Os fluxos de login e cadastro precisam da URL e da chave pública do Supabase. Consulte [docs/development-guide.md](docs/development-guide.md) para setup, roles, Auth e RLS.

## Verificações

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

As migrations ficam em `supabase/migrations`; testes PostgreSQL/RLS ficam em `supabase/tests`. Não há tabelas comerciais nem seed nesta etapa.