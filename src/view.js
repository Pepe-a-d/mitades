// Qué trozo del mundo pinta este portátil y cómo lo encaja en su pantalla.
// La mitad se pega al borde que toca con el otro portátil: si sobran bandas
// negras, quedan en el lado de fuera y no en la costura.
import { HALF, H, DEFAULT_GAP } from './config.js'

const KEY = 'mitades-calibracion'

function loadCal() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY))
    if (c && typeof c.scale === 'number') return { scale: c.scale, dy: c.dy || 0 }
  } catch {}
  return { scale: 1, dy: 0 }
}

export class View {
  constructor(canvas) {
    this.canvas = canvas
    this.g = canvas.getContext('2d')
    this.side = 0
    this.gap = DEFAULT_GAP
    this.cal = loadCal()
    this.resize()
    addEventListener('resize', () => this.resize())
  }

  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 2)
    this.cw = innerWidth
    this.ch = innerHeight
    this.canvas.width = Math.round(this.cw * this.dpr)
    this.canvas.height = Math.round(this.ch * this.dpr)
  }

  update() {
    const k = Math.min(this.cw / HALF, this.ch / H) * this.cal.scale
    this.k = k
    this.x0 = this.side === 0 ? 0 : HALF + this.gap
    this.ox = this.side === 0 ? this.cw - HALF * k : 0
    this.oy = (this.ch - H * k) / 2 + this.cal.dy
  }

  apply(g) {
    const d = this.dpr
    g.setTransform(this.k * d, 0, 0, this.k * d, (this.ox - this.x0 * this.k) * d, this.oy * d)
  }

  toWorld(px, py) {
    return [this.x0 + (px - this.ox) / this.k, (py - this.oy) / this.k]
  }

  saveCal() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.cal))
    } catch {}
  }
}
