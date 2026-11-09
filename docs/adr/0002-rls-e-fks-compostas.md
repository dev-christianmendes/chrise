# 0002 — RLS e FKs compostas no banco

**Status:** Aceito · **Data:** 2026-11-09

## Contexto

O app roda no navegador com a anon key pública do Supabase. Autorização feita só no front pode ser contornada, e um UUID conhecido não pode ser suficiente para acessar dados de outra pessoa.

## Decisão

Toda tabela de domínio tem `user_id` e Row Level Security habilitada com política de dono (`user_id = auth.uid()`) para leitura e escrita. As tabelas usam `user_id` com default `auth.uid()`. As relações entre dados do mesmo dono usam FKs compostas `(id, user_id)` e `(user_id, slug)`, impedindo apontar para conta ou categoria de outro usuário mesmo conhecendo o identificador.

## Consequências

- A segurança não depende do cliente: consultas e mutações são filtradas no banco.
- Índices e FKs crescem um pouco; em troca, inconsistências entre donos viram erro de integridade.
- Testes de RLS precisam de um usuário autenticado real ou de um dublê que reproduza o erro.
- A service role continua sendo um segredo de servidor e nunca vai para o bundle.

## Referências

- `supabase/migrations/20261105000000_init.sql`
- `packages/data/src/supabase/supabase-repository.test.ts`
