# 0006 — IA só explica, nunca calcula

**Status:** Aceito · **Data:** 2026-11-09

## Contexto

Um LLM pode deixar o resumo do mês mais natural, mas também pode inventar valores, arredondar errado ou sugerir decisões financeiras inadequadas. Em um app de dinheiro, um número inventado destrói a confiança.

## Decisão

- O resumo oficial é determinístico: `buildMonthSummary` no `core` monta o texto a partir dos números já calculados.
- A Edge Function `explain` recebe **apenas métricas agregadas** (sem descrição de lançamento), exige usuário autenticado e usa um prompt versionado (`2026-11-09.v1`).
- Antes de devolver, `isSafeExplanation` extrai todos os tokens numéricos do texto e exige que cada um exista no conjunto derivado do payload. Número novo, texto curto demais ou resposta vazia são rejeitados.
- Em qualquer falha (sem configuração, provedor fora, número inventado), a função devolve `text: null` e a UI mantém o resumo calculado.
- Na demo mock o botão de IA não aparece, para não anunciar uma função que não está no ar.

## Consequências

- O LLM pode reescrever, mas não pode criar um valor financeiro.
- A guarda é conservadora: uma paráfrase legítima com um número fora do conjunto é rejeitada; o fallback determinístico cobre o caso.
- O prompt e a função são testados sem chamar o provedor; o deploy real depende de `LLM_API_URL`, `LLM_API_KEY` e `LLM_MODEL` configurados como segredos do Supabase.
- O texto continua sendo informativo, não recomendação de investimento.

## Referências

- `packages/core/src/explain.ts`
- `supabase/functions/explain/explain.ts`
- `supabase/functions/explain/index.ts`
- `apps/web/src/components/MonthSummary.tsx`
