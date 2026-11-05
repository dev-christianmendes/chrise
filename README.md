<div align="center">
  <img src="apps/web/public/pwa-192.png" width="96" alt="Chrise" />
  <h1>Chrise</h1>
  <p><strong>finanças sem crise</strong>: controle financeiro preditivo para quem trabalha como PJ.</p>
  <p>
    <a href="https://github.com/dev-christianmendes/chrise/actions/workflows/ci.yml"><img src="https://github.com/dev-christianmendes/chrise/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="https://github.com/dev-christianmendes/chrise/actions/workflows/deploy-demo.yml"><img src="https://github.com/dev-christianmendes/chrise/actions/workflows/deploy-demo.yml/badge.svg" alt="Deploy demo" /></a>
  </p>
  <p>
    <a href="#demo">Demo</a> ·
    <a href="#arquitetura">Arquitetura</a> ·
    <a href="#a-ia-básica">Previsões</a> ·
    <a href="#impostos-pj">Impostos PJ</a> ·
    <a href="#rodando-localmente">Rodando</a>
  </p>
</div>

---

Dev PJ tem uma vida financeira com duas camadas: a da empresa (nota fiscal, DAS, Fator R, pró-labore, INSS) e a da pessoa (aluguel, mercado, pets, lazer). O Chrise junta as duas e responde três perguntas:

1. **Quanto eu preciso separar de imposto este mês?**
2. **Para onde está indo meu dinheiro, e o que está fora do padrão?**
3. **Como vai estar meu saldo daqui a 6 ou 12 meses, no ritmo atual?**

## Demo

**[dev-christianmendes.github.io/chrise](https://dev-christianmendes.github.io/chrise/)**

A demo pública roda **100% no navegador**, com 24 meses de dados fictícios de um dev PJ que mora sozinho com dois pets. Tudo o que você lançar fica só no seu dispositivo, e *Ajustes → Restaurar demo* volta ao estado original.

> Instale como app: no celular, abra a demo e use "Adicionar à tela inicial".

## Funcionalidades

| | |
|---|---|
| **Visão geral** | Saldo, receitas e despesas do mês, taxa de poupança, insights priorizados, gráfico de 12 meses com previsão de 6 |
| **Lançamentos** | Lista agrupada por mês, busca e filtros, lançamento rápido com botão flutuante (atalho do PWA: "Novo lançamento") |
| **Previsões** | Saldo projetado em 12 meses com faixa de 80%, previsão por categoria com tendência, simulador de juros compostos e meta |
| **Impostos PJ** | DAS do mês, RBT12, alíquota efetiva, Fator R, simulador de pró-labore (Anexo III × V) e histórico |
| **Orçamentos** | Limites por categoria com alerta em 80% e 100% |
| **Ajustes** | Reserva extra sobre o faturamento, backup em JSON |

## Arquitetura

```
chrise/
├── apps/web            PWA: Vite + React + TS + Tailwind/shadcn + Recharts
├── packages/core       regras de negócio PURAS: dinheiro, métricas, previsão, impostos, insights
├── packages/data       interface FinanceRepository + adapters
│   ├── mock/           gerador determinístico + edições no localStorage   → demo
│   └── supabase/       Postgres + Auth + RLS                              → produção
└── supabase/migrations schema, RLS e seed de categorias por usuário
```

**Uma base de código, duas fontes de dados.** A UI só conhece `FinanceRepository`, e `VITE_DATA_SOURCE=mock|supabase` escolhe o adapter. A demo nunca baixa o `supabase-js` (import dinâmico): o bundle inicial fica em torno de 220 kB gzip.

**Decisões que valem explicar:**

- **Dinheiro em centavos inteiros.** Nada de `float` para valor monetário, nem no banco (`bigint`).
- **O `core` não depende de nada.** Funções puras e testadas (`npm test`), reaproveitáveis numa Edge Function, numa CLI ou num app nativo.
- **Segurança no banco, não no front.** RLS em todas as tabelas e FKs compostas `(id, user_id)`, para ninguém conseguir lançar na conta de outro usuário nem conhecendo o UUID. A anon key é pública por design.
- **Dados mock determinísticos.** PRNG com seed por mês: os gráficos da demo são estáveis e reproduzíveis nos testes. O próprio gerador usa o `core` para calcular o DAS, então a demo é fiscalmente coerente.

### Por que PWA e não app nativo?

Eu sou o principal usuário. Um PWA instalável me dá ícone na tela inicial, tela cheia, funcionamento offline (service worker com cache *network-first* das leituras) e atalhos, **sem loja, sem taxa de desenvolvedor e com uma stack só**. O que se perde (widgets nativos, ler notificação do banco) não justifica dobrar a manutenção agora. Se um dia justificar, o mesmo código pode ser empacotado com Capacitor.

## A "IA básica"

Tudo determinístico, explicável e testado em [`packages/core/src/forecast.ts`](packages/core/src/forecast.ts):

| Técnica | Uso |
|---|---|
| Regressão linear (mínimos quadrados) + R² | Tendência por categoria; a inclinação é amortecida pelo R² (tendência fraca → quase plana) |
| Média móvel ponderada | Nível recente da série |
| Índices sazonais multiplicativos | Dezembro, vacinas dos pets, conta de luz no verão (com 2 ou mais ciclos de histórico) |
| Banda de confiança | σ dos resíduos × √passos; no saldo acumulado, soma de variâncias |
| z-score modificado (mediana/MAD) | Gastos atípicos, robusto a outliers; com fallback para gasto fixo (MAD = 0) |
| Juros compostos | Valor futuro com aportes e meses até a meta |

> **O LLM, quando entrar, só explica, nunca calcula.** Os números vêm das funções acima; um modelo de linguagem pode, no máximo, transformar os insights em texto.

## Impostos PJ

[`packages/core/src/tax/simples.ts`](packages/core/src/tax/simples.ts) implementa o Simples Nacional para TI com Fator R:

- **RBT12** com a regra de proporcionalização do início de atividade
- **Fator R** = folha ÷ RBT12; ≥ 28% → Anexo III, senão Anexo V
- **Alíquota efetiva** = (RBT12 × nominal − dedução) ÷ RBT12
- **INSS** de 11% sobre o pró-labore, limitado ao teto
- **Pró-labore mínimo** para chegar ao Anexo III

As tabelas são dados versionados (LC 123/2006 com redação da LC 155/2016). Os parâmetros do INSS mudam todo ano e ficam em `INSS_PARAMS`. **É uma estimativa: confirme com seu contador.**

## Rodando localmente

Requisitos: Node 22 ou mais recente.

```bash
npm install
npm run dev          # demo com dados mock em http://localhost:8080
npm test             # testes do core e do gerador mock
npm run typecheck
npm run build:demo   # build estático da demo (GitHub Pages)
```

### Produção com Supabase

1. Crie um projeto no Supabase e aplique `supabase/migrations` (`supabase db push`).
2. Em *Auth → URL Configuration*, adicione a URL do app aos redirects (login por link mágico).
3. Crie `apps/web/.env.production-data` a partir de `.env.example` com `VITE_DATA_SOURCE=supabase`.
4. `npm run dev:prod` para testar localmente, ou faça deploy (Vercel/Netlify) com as mesmas variáveis.

## Roadmap

- [x] Monorepo, `core` testado, demo mock, PWA
- [x] Impostos PJ (DAS, Fator R, simulador de pró-labore)
- [x] Previsões, anomalias, simulador de longo prazo
- [ ] Importação de extrato OFX/CSV com regras de categorização
- [ ] Lançamento offline com fila de sincronização (IndexedDB)
- [ ] Web Push: vencimento do DAS e alerta de orçamento
- [ ] Resumo mensal em linguagem natural (LLM recebendo só métricas agregadas)
- [ ] Calendário fiscal (DAS, DEFIS, IRPF)

## Licença

MIT © Christian Mendes
