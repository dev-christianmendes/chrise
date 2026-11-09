# ADRs — Chrise

Registro das decisões de arquitetura que sustentam o projeto. Cada ADR é curto e aponta para o código que a implementa.

| ADR | Decisão | Status |
|---|---|---|
| [0001](0001-dinheiro-em-centavos.md) | Dinheiro em centavos inteiros | Aceito |
| [0002](0002-rls-e-fks-compostas.md) | RLS e FKs compostas no banco | Aceito |
| [0003](0003-finance-repository.md) | `FinanceRepository` com adapters mock/Supabase/offline | Aceito |
| [0004](0004-pwa.md) | PWA em vez de app nativo | Aceito |
| [0005](0005-escrita-offline.md) | Escrita offline com outbox IndexedDB | Aceito |
| [0006](0006-ia-so-explica.md) | IA só explica, nunca calcula | Aceito |

## Formato

Cada arquivo segue: **Contexto**, **Decisão**, **Consequências** e, quando necessário, **Limitações**. Uma decisão nova ganha um número novo; um ADR aceito não é reescrito, é substituído por outro que o referencia.
