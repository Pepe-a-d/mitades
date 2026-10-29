// Medidas del mundo. Cada portátil enseña una mitad de 1600 × 1000 unidades
// (16:10, como las pantallas de los MacBook) y entre las dos hay una franja
// invisible del ancho de los marcos, para que lo que cruza no "salte".
export const HALF = 1600
export const H = 1000
export const TICK_MS = 1000 / 60
export const DT = 1 / 60
export const DEFAULT_GAP = 80

export const COLORS = ['#3fd7ff', '#ff4f86']
export const COLOR_NAMES = ['AZUL', 'ROSA']

export function makeWorld(gap) {
  return {
    HALF,
    H,
    gap,
    W: HALF * 2 + gap,
    mid: HALF + gap / 2,
    // Borde izquierdo de cada pantalla en el mundo
    x0: [0, HALF + gap],
    // Borde de cada pantalla que toca con la otra
    inner: [HALF, HALF + gap],
    // Centro de cada pantalla
    center: [HALF / 2, HALF + gap + HALF / 2],
  }
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
export const lerp = (a, b, t) => a + (b - a) * t

// Aleatorio con semilla: los dos portátiles generan lo mismo a partir de ella
export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle(list) {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
