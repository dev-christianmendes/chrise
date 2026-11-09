# 0003 — `FinanceRepository` com adapters mock/Supabase/offline

**Status:** Aceito · **Data:** 2026-11-09

## Contexto

A demo pública precisa rodar sem backend, enquanto a produção usa Supabase com RLS. Se a UI conhecesse os dois caminhos, cada tela repetiria regras de origem de dados e ficaria difícil testar os fluxos críticos.

## Decisão

Existe um contrato único, `FinanceRepository`, com operações de categorias, contas, lançamentos, orçamentos e perfil fiscal. A UI depende só dele. Há três implementações: `MockRepository` (demo determinística), `SupabaseRepository` (produção) e `OfflineRepository`, um decorator que envolve o repositório remoto com fila e cache. A escolha acontece em um único arquivo (`apps/web/src/lib/repository.ts`), a partir de `VITE_DATA_SOURCE`.

## Consequências

- A demo e a produção exercitam a mesma interface e os mesmos componentes.
- Testes de UI podem usar o mock; testes de produção usam um dublê do cliente Supabase.
- Toda operação nova precisa ser implementada nos três adapters e testada no contrato.
- O `OfflineRepository` pode ser combinado com qualquer backend que implemente o contrato.

## Referências

- `packages/data/src/repository.ts`
- `packages/data/src/mock/mock-repository.ts`
- `packages/data/src/supabase/supabase-repository.ts`
- `packages/data/src/offline/offline-repository.ts`
- `apps/web/src/lib/repository.ts`
