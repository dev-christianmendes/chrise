# 0005 — Escrita offline com outbox IndexedDB

**Status:** Aceito · **Data:** 2026-11-09

## Contexto

Lançar um gasto costuma acontecer na rua, com rede instável. Perder um lançamento é pior do que atrasar a sincronização. Ao mesmo tempo, o servidor continua sendo a fonte de verdade e as regras de RLS não podem ser ignoradas.

## Decisão

O `OfflineRepository` envolve o repositório remoto:

- Escritas tentam o servidor; se a falha for de rede, entram numa fila persistente no IndexedDB (`Outbox`), com fallback em memória para ambientes sem IndexedDB.
- A fila preserva a ordem de criação (`order`) e drena em `sync()`, parando no primeiro erro de rede.
- Erros de regra (RLS, validação) são descartados da fila e reportados; erros de rede mantêm a operação.
- Lançamentos pendentes recebem ids `pending:<op>`/`pending:<op>:<índice>` e são mesclados ao último extrato conhecido.
- A UI aplica updates otimistas com rollback e usa `networkMode: "always"` no React Query, para a fila rodar mesmo com `navigator.onLine === false`.
- A drenagem acontece ao abrir o app e no evento `online`.
- Editar um lançamento já sincronizado exige conexão; editar um pendente altera a própria operação da fila.

## Consequências

- Criar, importar e excluir continuam funcionando sem rede, e o lançamento sobrevive a reload.
- O extrato pode ficar temporariamente diferente do servidor até a fila drenar.
- **Limitação conhecida:** não há chave de idempotência. Se o servidor confirmar a escrita mas a resposta se perder, o `sync()` pode criar um duplicado. Uma evolução possível é enviar um `client_operation_id` e tornar a inserção idempotente no banco.
- Orçamentos e perfil fiscal continuam exigindo rede.

## Referências

- `packages/data/src/offline/offline-repository.ts`
- `packages/data/src/offline/outbox.ts`
- `apps/web/src/hooks/use-sync.ts`
- `apps/web/src/hooks/use-finance.ts`
