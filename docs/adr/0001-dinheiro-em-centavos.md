# 0001 — Dinheiro em centavos inteiros

**Status:** Aceito · **Data:** 2026-11-09

## Contexto

O app soma receitas, despesas, reservas de imposto e projeções. Valores monetários em ponto flutuante acumulam erro de arredondamento e tornam comparações e testes frágeis.

## Decisão

Todo valor monetário é um inteiro em centavos, representado pelo tipo `Cents` no `packages/core`. `amount` é sempre positivo e o sinal vem de `kind` (`income`/`expense`). No banco, as colunas terminam em `_cents` e usam `bigint` (`amount_cents`, `opening_balance_cents`, `limit_cents`, `pro_labore_cents`). A formatação para reais acontece só na borda de apresentação (`formatBRL`/`formatBRLCompact`).

## Consequências

- Somas e comparações são exatas; os testes não dependem de tolerância de `float`.
- A UI e a importação convertem para centavos uma única vez; o `core` nunca recebe reais fracionados.
- O schema exige `bigint` e checks (`amount_cents > 0`, `limit_cents >= 0`).
- Relatórios externos ou APIs que devolvem reais precisam de conversão explícita.

## Referências

- `packages/core/src/types.ts`
- `packages/core/src/money.ts`
- `supabase/migrations/20261105000000_init.sql`
