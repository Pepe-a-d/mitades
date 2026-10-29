// Hockey de aire: la mesa ocupa las dos pantallas, cada uno defiende la suya.
// El mazo sigue al trackpad (o se mueve con flechas).
import { H, COLORS, makeWorld, clamp } from '../config.js'
import { text, glow, Particles, rgba, TITLE } from '../draw.js'

const WALL = 34
const GOAL = 175
const PR = 32
const MR = 60
const MAX_V = 2900
const MALLET_V = 3400
const KEY_V = 1300
const GOALS_TO_WIN = 7

export default class Hockey {
  static meta = { countdown: true }
  static lerp = ['p', 'm']

  constructor(cfg, api) {
    this.api = api
    const w = (this.w = makeWorld(cfg.gap))
    const serve = cfg.seed % 2
    this.s = {
      p: [w.inner[serve] + (serve === 0 ? -320 : 320), H / 2],
      m: [
        [WALL + MR + 160, H / 2],
        [w.W - WALL - MR - 160, H / 2],
      ],
      sc: [0, 0],
      freeze: 0,
      cut: 0,
      winner: null,
    }
    this.pv = [0, 0]
    this.mv = [
      [0, 0],
      [0, 0],
    ]
    this.lastHit = 0
    this.lastWall = 0
    this.tick = 0
    // locales
    this.fx = new Particles()
    this.trail = []
    this.pred = null
    this.flash = [0, 0]
  }

  bounds(i) {
    const w = this.w
    return i === 0 ? [WALL + MR, w.inner[0] - MR] : [w.inner[1] + MR, w.W - WALL - MR]
  }

  moveMallet(m, pad, i, dt, vel) {
    const [x0, x1] = this.bounds(i)
    let tx, ty
    if (pad.mouse) [tx, ty] = pad.mouse
    else {
      tx = m[0] + pad.x * KEY_V * dt
      ty = m[1] + pad.y * KEY_V * dt
    }
    tx = clamp(tx, x0, x1)
    ty = clamp(ty, WALL + MR, H - WALL - MR)
    let dx = tx - m[0]
    let dy = ty - m[1]
    const d = Math.hypot(dx, dy)
    const max = MALLET_V * dt
    if (d > max && d > 0) {
      dx *= max / d
      dy *= max / d
    }
    m[0] += dx
    m[1] += dy
    if (vel) {
      vel[0] = dx / dt
      vel[1] = dy / dt
    }
  }

  update(dt, pads) {
    const s = this.s
    const w = this.w
    this.tick++
    for (let i = 0; i < 2; i++) this.moveMallet(s.m[i], pads[i], i, dt, this.mv[i])
    if (s.freeze > 0) {
      s.freeze--
      return
    }
    const p = s.p
    const v = this.pv
    const N = 6
    const h = dt / N
    for (let k = 0; k < N; k++) {
      p[0] += v[0] * h
      p[1] += v[1] * h
      if (p[1] < WALL + PR) {
        p[1] = WALL + PR
        v[1] = Math.abs(v[1]) * 0.92
        this.wallSound()
      } else if (p[1] > H - WALL - PR) {
        p[1] = H - WALL - PR
        v[1] = -Math.abs(v[1]) * 0.92
        this.wallSound()
      }
      const inMouth = Math.abs(p[1] - H / 2) < GOAL - PR * 0.4
      if (!inMouth) {
        if (p[0] < WALL + PR) {
          p[0] = WALL + PR
          v[0] = Math.abs(v[0]) * 0.92
          this.wallSound()
        } else if (p[0] > w.W - WALL - PR) {
          p[0] = w.W - WALL - PR
          v[0] = -Math.abs(v[0]) * 0.92
          this.wallSound()
        }
      }
      if (p[0] < 0) return this.goal(1)
      if (p[0] > w.W) return this.goal(0)

      for (let i = 0; i < 2; i++) {
        const m = s.m[i]
        const mv = this.mv[i]
        let dx = p[0] - m[0]
        let dy = p[1] - m[1]
        const d = Math.hypot(dx, dy)
        if (d < PR + MR) {
          let nx, ny
          if (d > 0.01) {
            nx = dx / d
            ny = dy / d
          } else {
            nx = i === 0 ? 1 : -1
            ny = 0
          }
          p[0] = m[0] + nx * (PR + MR)
          p[1] = m[1] + ny * (PR + MR)
          const rel = (v[0] - mv[0]) * nx + (v[1] - mv[1]) * ny
          if (rel < 0) {
            v[0] -= 1.85 * rel * nx
            v[1] -= 1.85 * rel * ny
            if (this.tick - this.lastHit > 4 && -rel > 120) {
              this.lastHit = this.tick
              this.api.sfx('hit', p[0])
              this.api.emit({ e: 'hit', x: p[0], y: p[1], i, f: Math.min(1, -rel / 2000) })
            }
          }
        }
      }
    }
    // Rozamiento muy bajo, como en una mesa de aire
    const fr = Math.pow(0.82, dt)
    v[0] *= fr
    v[1] *= fr
    const sp = Math.hypot(v[0], v[1])
    if (sp > MAX_V) {
      v[0] *= MAX_V / sp
      v[1] *= MAX_V / sp
    }
    // Si el disco se para dentro de los marcos, nadie llega: un soplido
    if (Math.abs(p[0] - w.mid) < w.gap / 2 + PR + 10 && sp < 220) {
      const dir = p[0] < w.mid ? -1 : p[0] > w.mid ? 1 : this.tick % 2 ? 1 : -1
      v[0] += dir * 900 * dt
    }
  }

  wallSound() {
    if (this.tick - this.lastWall > 5) {
      this.lastWall = this.tick
      this.api.sfx('wall', this.s.p[0])
    }
  }

  goal(scorer) {
    const s = this.s
    const w = this.w
    s.sc[scorer]++
    this.api.sfx('goal', scorer === 0 ? w.W : 0)
    this.api.emit({ e: 'goal', scorer })
    if (s.sc[scorer] >= GOALS_TO_WIN) {
      s.winner = scorer
      s.p = [w.mid, H / 2]
      return
    }
    // Saca quien ha encajado, desde su campo
    const loser = 1 - scorer
    s.p = [w.inner[loser] + (loser === 0 ? -320 : 320), H / 2]
    this.pv = [0, 0]
    s.freeze = 50
    s.cut++
  }

  onEvent(ev) {
    if (ev.e === 'hit') {
      this.fx.burst(ev.x, ev.y, COLORS[ev.i], 10 + Math.round(ev.f * 25), { speed: 300 + ev.f * 700, life: 0.45, size: 7 })
      this.fx.burst(ev.x, ev.y, '#ffffff', 6, { speed: 400, life: 0.3, size: 5 })
    } else if (ev.e === 'goal') {
      const w = this.w
      const x = ev.scorer === 0 ? w.W - 10 : 10
      this.fx.burst(x, H / 2, COLORS[ev.scorer], 120, { speed: 1200, life: 1.1, size: 10, spread: Math.PI, dir: ev.scorer === 0 ? Math.PI : 0 })
      this.flash[ev.scorer] = 1
      this.trail = []
    }
  }

  local(dt, pad) {
    this.fx.update(dt)
    this.flash = this.flash.map(f => Math.max(0, f - dt * 1.5))
    const p = this.s.p
    this.trail.push([p[0], p[1]])
    if (this.trail.length > 14) this.trail.shift()
    // El invitado mueve su mazo en local para no notar el retraso de la red
    const me = this.api.side
    if (!this.api.isHost) {
      const srv = this.s.m[me]
      if (!this.pred) this.pred = srv.slice()
      this.moveMallet(this.pred, pad, me, dt)
      if (!pad.mouse && !pad.x && !pad.y) {
        this.pred[0] += (srv[0] - this.pred[0]) * 0.2
        this.pred[1] += (srv[1] - this.pred[1]) * 0.2
      }
      if (Math.hypot(srv[0] - this.pred[0], srv[1] - this.pred[1]) > 250) this.pred = srv.slice()
    }
  }

  render(g) {
    const w = this.w
    const s = this.s
    const names = this.api.cfg.names

    // Mesa
    const bg = g.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#071a36')
    bg.addColorStop(0.5, '#0a2348')
    bg.addColorStop(1, '#071a36')
    g.fillStyle = bg
    g.fillRect(0, 0, w.W, H)
    // agujeritos del aire
    g.fillStyle = 'rgba(160,210,255,0.08)'
    for (let x = 60; x < w.W; x += 60) for (let y = 60; y < H; y += 60) g.fillRect(x - 2, y - 2, 4, 4)

    // Áreas y círculo central (cortado por los marcos)
    g.lineWidth = 6
    for (let i = 0; i < 2; i++) {
      const gx = i === 0 ? 0 : w.W
      g.strokeStyle = rgba(COLORS[i], 0.45)
      g.beginPath()
      g.arc(gx, H / 2, 230, i === 0 ? -Math.PI / 2 : Math.PI / 2, i === 0 ? Math.PI / 2 : Math.PI * 1.5)
      g.stroke()
      glow(g, gx, H / 2, 300, COLORS[i], 0.12 + this.flash[i === 0 ? 1 : 0] * 0.5)
    }
    g.strokeStyle = 'rgba(255,90,120,0.5)'
    g.beginPath()
    g.arc(w.mid, H / 2, 200, 0, Math.PI * 2)
    g.stroke()
    g.strokeStyle = 'rgba(255,90,120,0.35)'
    g.lineWidth = 10
    g.beginPath()
    g.moveTo(w.inner[0] - 5, 0)
    g.lineTo(w.inner[0] - 5, H)
    g.moveTo(w.inner[1] + 5, 0)
    g.lineTo(w.inner[1] + 5, H)
    g.stroke()

    // Bordes de neón
    g.save()
    g.lineCap = 'round'
    g.shadowBlur = 24
    for (const [col, segs] of [
      ['#9fd8ff', [[0, WALL / 2, w.W, WALL / 2], [0, H - WALL / 2, w.W, H - WALL / 2]]],
      [COLORS[0], [[WALL / 2, WALL / 2, WALL / 2, H / 2 - GOAL], [WALL / 2, H / 2 + GOAL, WALL / 2, H - WALL / 2]]],
      [COLORS[1], [[w.W - WALL / 2, WALL / 2, w.W - WALL / 2, H / 2 - GOAL], [w.W - WALL / 2, H / 2 + GOAL, w.W - WALL / 2, H - WALL / 2]]],
    ]) {
      g.strokeStyle = col
      g.shadowColor = col
      g.lineWidth = 12
      g.beginPath()
      for (const [a, b, c, d] of segs) {
        g.moveTo(a, b)
        g.lineTo(c, d)
      }
      g.stroke()
    }
    g.restore()

    // Marcadores junto a la costura
    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? w.inner[0] - 150 : w.inner[1] + 150
      text(g, String(s.sc[i]), x, 140, { size: 130, font: TITLE, color: rgba(COLORS[i], 0.9), glow: 20 })
      text(g, names[i], x, 230, { size: 32, color: rgba(COLORS[i], 0.7), weight: 600 })
    }

    // Estela y disco
    g.save()
    g.globalCompositeOperation = 'lighter'
    this.trail.forEach(([x, y], k) => {
      g.globalAlpha = (k / this.trail.length) * 0.25
      g.fillStyle = '#bfe8ff'
      g.beginPath()
      g.arc(x, y, PR * (0.4 + (0.6 * k) / this.trail.length), 0, Math.PI * 2)
      g.fill()
    })
    g.restore()
    const [px, py] = s.p
    glow(g, px, py, 110, '#ffffff', 0.35)
    g.fillStyle = '#0d1020'
    g.beginPath()
    g.arc(px, py, PR, 0, Math.PI * 2)
    g.fill()
    g.lineWidth = 8
    g.strokeStyle = s.freeze > 0 && Math.floor(s.freeze / 6) % 2 ? '#ffd84a' : '#ffffff'
    g.stroke()

    // Mazos
    for (let i = 0; i < 2; i++) {
      const [mx, my] = i === this.api.side && this.pred ? this.pred : s.m[i]
      const c = COLORS[i]
      glow(g, mx, my, 150, c, 0.35)
      g.fillStyle = c
      g.beginPath()
      g.arc(mx, my, MR, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = 'rgba(0,0,0,0.3)'
      g.beginPath()
      g.arc(mx, my, MR * 0.72, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = c
      g.beginPath()
      g.arc(mx, my, MR * 0.42, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = 'rgba(255,255,255,0.55)'
      g.beginPath()
      g.arc(mx - 8, my - 10, MR * 0.18, 0, Math.PI * 2)
      g.fill()
    }
    this.fx.render(g)
  }
}
