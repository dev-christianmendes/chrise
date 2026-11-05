/** PRNG determinístico (mulberry32): mesma seed → mesmos dados → gráficos estáveis na demo. */
export function createRandom(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** Inteiro em [min, max]. */
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    /** Valor em torno de `base` com variação relativa ±`spread`. */
    around: (base: number, spread: number) => Math.round(base * (1 + (next() * 2 - 1) * spread)),
    chance: (p: number) => next() < p,
  };
}

export type Random = ReturnType<typeof createRandom>;
