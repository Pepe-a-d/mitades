// Utilidades de dibujo en coordenadas del mundo
export const FONT = '"Chakra Petch", system-ui, sans-serif'
export const TITLE = '"Bungee", "Chakra Petch", system-ui, sans-serif'

export function text(g, str, x, y, o = {}) {
  const { size = 40, color = '#fff', align = 'center', base = 'middle', font = FONT, weight = 700, glow = 0, alpha = 1 } = o
  g.save()
  g.globalAlpha *= alpha
  g.font = `${weight} ${size}px ${font}`
  g.textAlign = align
  g.textBaseline = base
  if (glow) {
    g.shadowColor = o.glowColor || color
    g.shadowBlur = glow
  }
  g.fillStyle = color
  g.fillText(str, x, y)
  g.restore()
}

// Texto partido por la costura: la primera parte acaba justo antes del borde
// de la pantalla izquierda y la segunda empieza al otro lado, como si fuera
// una sola palabra que pasa por debajo de los marcos.
export function seamText(g, w, left, right, y, o = {}) {
  const pad = o.pad ?? 6
  text(g, left, w.inner[0] - pad, y, { ...o, align: 'right', color: o.colorL || o.color })
  text(g, right, w.inner[1] + pad, y, { ...o, align: 'left', color: o.colorR || o.color })
}

// Lo mismo en las dos mitades, centrado en cada una
export function bothText(g, w, str, y, o = {}) {
  text(g, str, w.center[0], y, o)
  text(g, str, w.center[1], y, o)
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

// Halo de luz suave (se suma a lo que haya debajo)
export function glow(g, x, y, r, color, a = 0.5) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r)
  gr.addColorStop(0, rgba(color, a))
  gr.addColorStop(1, rgba(color, 0))
  g.save()
  g.globalCompositeOperation = 'lighter'
  g.fillStyle = gr
  g.fillRect(x - r, y - r, r * 2, r * 2)
  g.restore()
}

export function dim(g, w, a = 0.6) {
  g.fillStyle = `rgba(3,4,12,${a})`
  g.fillRect(-10, -10, w.W + 20, w.H + 20)
}

// Partículas locales: cada portátil las genera a partir de los eventos
export class Particles {
  constructor() {
    this.list = []
  }
  burst(x, y, color, n = 20, { speed = 400, life = 0.7, size = 6, gravity = 0, spread = Math.PI * 2, dir = 0, drag = 1.5 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * spread
      const v = speed * (0.3 + Math.random() * 0.7)
      const l = life * (0.5 + Math.random() * 0.5)
      this.list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: l, max: l, color, size: size * (0.5 + Math.random()), gravity, drag })
    }
    if (this.list.length > 1500) this.list.splice(0, this.list.length - 1500)
  }
  update(dt) {
    const l = this.list
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i]
      p.life -= dt
      if (p.life <= 0) {
        l[i] = l[l.length - 1]
        l.pop()
        continue
      }
      const f = Math.exp(-p.drag * dt)
      p.vx *= f
      p.vy = p.vy * f + p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
    }
  }
  render(g) {
    if (!this.list.length) return
    g.save()
    g.globalCompositeOperation = 'lighter'
    for (const p of this.list) {
      g.globalAlpha = Math.min(1, (p.life / p.max) * 1.5)
      g.fillStyle = p.color
      const s = p.size
      g.fillRect(p.x - s / 2, p.y - s / 2, s, s)
    }
    g.restore()
  }
}

// Confeti para quien gana (con gravedad y giro)
export class Confetti {
  constructor() {
    this.list = []
  }
  rain(x0, x1, colors, n = 140) {
    for (let i = 0; i < n; i++) {
      this.list.push({
        x: x0 + Math.random() * (x1 - x0),
        y: -40 - Math.random() * 600,
        vx: (Math.random() - 0.5) * 160,
        vy: 150 + Math.random() * 250,
        r: Math.random() * 6,
        vr: (Math.random() - 0.5) * 10,
        c: colors[i % colors.length],
        w: 10 + Math.random() * 10,
      })
    }
  }
  update(dt) {
    for (const p of this.list) {
      p.x += p.vx * dt + Math.sin(p.y / 60) * 40 * dt
      p.y += p.vy * dt
      p.r += p.vr * dt
    }
    this.list = this.list.filter(p => p.y < 1100)
  }
  render(g) {
    for (const p of this.list) {
      g.save()
      g.translate(p.x, p.y)
      g.rotate(p.r)
      g.fillStyle = p.c
      g.fillRect(-p.w / 2, -4, p.w, 8 * Math.abs(Math.cos(p.r * 1.7)) + 1)
      g.restore()
    }
  }
}
