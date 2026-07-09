// Deterministic seeded PRNG (mulberry32) shared by every fixture generator so a full
// regen with the same SEED reproduces byte-identical fixture JSON.
export const SEED = 190719;

export function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);

export function randFloat(min, max) {
  return min + rand() * (max - min);
}

export function randInt(min, max) {
  // inclusive
  return Math.floor(randFloat(min, max + 1));
}

export function randBool(pTrue = 0.5) {
  return rand() < pTrue;
}

export function randChoice(arr) {
  return arr[randInt(0, arr.length - 1)];
}

export function maybe(pPresent, factory) {
  return rand() < pPresent ? factory() : undefined;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    ;[a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
