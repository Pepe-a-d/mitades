// Estela: dos motos de luz en una cuadrícula que cruza las dos pantallas.
// Choca con un muro (o con el borde) y pierdes la ronda.
import { H, COLORS, makeWorld, rng } from '../config.js'
import { text, glow, Particles, rgba, TITLE } from '../draw.js'

const CELL = 20
const DX = [1, 0, -1, 0]
const DY = [0, 1, 0, -1]
const BASE_SPEED = 15
const ACCEL = 0.45
const MAX_SPEED = 28
const BOOST = 1.75
const ROUNDS_TO_WIN = 3
const DIRS = ['right', 'down', 'left', 'up']

export default class Trails {
  static meta = { countdown: true }
  static lerp = ['h']

  constructor(cfg, api) {
    this.api = api
    const w = (this.w = makeWorld(cfg.gap))
    this.cols = Math.floor(w.W / CELL)
    this.rows = Math.floor(H / CELL)
    this.ox = (w.W - this.cols * CELL) / 2
    this.rand = rng(cfg.seed)
    this.s = { h: [[0, 0], [0, 0]], d: [0, 2], alive: [1, 1], sc: [0, 0], bst: [1, 1], on: [0, 0], phase: 'ready', timer: 50, rw: -1, round: 0, cut: 0, winner: null }
    this.paths = [[], []]
    this.fx = new Particles()
    this.t = 0
    this.newRound(true)
  }

  // Posición de una casilla en el mundo (centro)
  px(x) {
    return this.ox + (x + 0.5) * CELL
  }
  py(y) {
    return (y + 0.5) * CELL
  }

  newRound(first = false) {
    const s = this.s
    const r = this.rand
    const y0 = 8 + Math.floor(r() * (this.rows - 16))
    const y1 = 8 + Math.floor(r() * (this.rows - 16))
    this.pos = [
      [10, y0],
      [this.cols - 11, y1],
    ]
    s.d = [0, 2]
    s.h = this.pos.map(p => p.slice())
    s.alive = [1, 1]
    s.bst = [1, 1]
    s.on = [0, 0]
    s.phase = 'ready'
    s.timer = 60
    s.rw = -1
    s.round++
    s.cut++
    this.grid = new Uint8Array(this.cols * this.rows)
    for (const [x, y] of this.pos) this.grid[y * this.cols + x] = 1
    this.queue = [[], []]
    this.prog = [0, 0]
    this.elapsed = 0
    // La primera ronda sale igual en los dos portátiles (misma semilla);
    // las siguientes las anuncia el anfitrión
    const ev = { e: 'start', p: this.pos.map(p => p.slice()) }
    if (first) this.onEvent(ev)
    else this.api.emit(ev)
  }

  update(dt, pads) {
    const s = this.s
    if (s.phase === 'ready') {
      for (let i = 0; i < 2; i++) this.readTurns(pads[i], i)
      if (--s.timer <= 0) s.phase = 'play'
      return
    }
    if (s.phase === 'end') {
      if (--s.timer <= 0) {
        if (s.sc[0] >= ROUNDS_TO_WIN || s.sc[1] >= ROUNDS_TO_WIN) s.winner = s.sc[0] > s.sc[1] ? 0 : 1
        else this.newRound()
      }
      return
    }
    this.elapsed += dt
    const speed = Math.min(MAX_SPEED, BASE_SPEED + this.elapsed * ACCEL)
    for (let i = 0; i < 2; i++) {
      const pad = pads[i]
      this.readTurns(pad, i)
      const boosting = pad.held('a') && s.bst[i] > 0.02
      if (boosting && !s.on[i]) this.api.sfx('boost', this.px(this.pos[i][0]))
      s.on[i] = boosting ? 1 : 0
      s.bst[i] = Math.max(0, Math.min(1, s.bst[i] + (boosting ? -dt / 1.4 : dt / 7)))
      this.prog[i] += speed * (boosting ? BOOST : 1) * dt
    }
    // Avanzan casilla a casilla, a la vez, para que los choques sean justos
    let guard = 0
    while ((this.prog[0] >= 1 || this.prog[1] >= 1) && guard++ < 10) {
      const moving = [this.prog[0] >= 1 && s.alive[0], this.prog[1] >= 1 && s.alive[1]]
      const next = [null, null]
      for (let i = 0; i < 2; i++) {
        if (!moving[i]) continue
        this.prog[i] -= 1
        const q = this.queue[i]
        if (q.length) {
          const nd = q.shift()
          if (nd !== s.d[i] && nd !== (s.d[i] + 2) % 4) {
            s.d[i] = nd
            this.api.emit({ e: 'turn', i, x: this.pos[i][0], y: this.pos[i][1] })
          }
        }
        next[i] = [this.pos[i][0] + DX[s.d[i]], this.pos[i][1] + DY[s.d[i]]]
      }
      const dead = [false, false]
      for (let i = 0; i < 2; i++) {
        const n = next[i]
        if (!n) continue
        if (n[0] < 0 || n[1] < 0 || n[0] >= this.cols || n[1] >= this.rows || this.grid[n[1] * this.cols + n[0]]) dead[i] = true
      }
      if (next[0] && next[1] && next[0][0] === next[1][0] && next[0][1] === next[1][1]) dead[0] = dead[1] = true
      for (let i = 0; i < 2; i++) {
        if (!next[i]) continue
        if (dead[i]) {
          s.alive[i] = 0
          this.prog[i] = 0
          this.api.sfx('die', this.px(this.pos[i][0]))
          this.api.emit({ e: 'crash', i, x: this.pos[i][0], y: this.pos[i][1] })
        } else {
          this.pos[i] = next[i]
          this.grid[next[i][1] * this.cols + next[i][0]] = 1
        }
      }
      if (!s.alive[0] || !s.alive[1]) break
    }
    for (let i = 0; i < 2; i++) {
      const f = s.alive[i] ? Math.min(this.prog[i], 0.999) : 0
      s.h[i] = [this.pos[i][0] + DX[s.d[i]] * f, this.pos[i][1] + DY[s.d[i]] * f]
    }
    if (!s.alive[0] || !s.alive[1]) {
      s.phase = 'end'
      s.timer = 130
      s.rw = s.alive[0] ? 0 : s.alive[1] ? 1 : -1
      if (s.rw >= 0) s.sc[s.rw]++
      this.api.sfx(s.rw >= 0 ? 'point' : 'wall')
    }
  }

  readTurns(pad, i) {
    const q = this.queue[i]
    for (let d = 0; d < 4; d++) {
      if (pad.pressed(DIRS[d]) && q.length < 3) {
        const last = q.length ? q[q.length - 1] : this.s.d[i]
        if (d !== last && d !== (last + 2) % 4) q.push(d)
      }
    }
  }

  onEvent(ev) {
    if (ev.e === 'start') {
      this.paths = ev.p.map(p => [p.slice()])
    } else if (ev.e === 'turn') {
      this.paths[ev.i].push([ev.x, ev.y])
    } else if (ev.e === 'crash') {
      const x = this.px(ev.x)
      const y = this.py(ev.y)
      this.fx.burst(x, y, COLORS[ev.i], 90, { speed: 900, life: 1, size: 9 })
      this.fx.burst(x, y, '#ffffff', 30, { speed: 500, life: 0.6, size: 6 })
    }
  }

  local(dt) {
    this.t += dt
    this.fx.update(dt)
  }

  render(g) {
    const w = this.w
    const s = this.s
    const names = this.api.cfg.names
    const x0 = this.ox
    const x1 = x0 + this.cols * CELL
    const y1 = this.rows * CELL

    g.fillStyle = '#04050d'
    g.fillRect(0, 0, w.W, H)
    g.lineWidth = 1.5
    g.strokeStyle = 'rgba(120,255,160,0.05)'
    g.beginPath()
    for (let c = 0; c <= this.cols; c++) {
      g.moveTo(x0 + c * CELL, 0)
      g.lineTo(x0 + c * CELL, y1)
    }
    for (let r = 0; r <= this.rows; r++) {
      g.moveTo(x0, r * CELL)
      g.lineTo(x1, r * CELL)
    }
    g.stroke()
    g.strokeStyle = 'rgba(120,255,160,0.1)'
    g.beginPath()
    for (let c = 0; c <= this.cols; c += 5) {
      g.moveTo(x0 + c * CELL, 0)
      g.lineTo(x0 + c * CELL, y1)
    }
    for (let r = 0; r <= this.rows; r += 5) {
      g.moveTo(x0, r * CELL)
      g.lineTo(x1, r * CELL)
    }
    g.stroke()
    g.save()
    g.strokeStyle = '#7dff6a'
    g.shadowColor = '#7dff6a'
    g.shadowBlur = 20
    g.lineWidth = 6
    g.strokeRect(x0 + 3, 3, x1 - x0 - 6, y1 - 6)
    g.restore()

    // Marcador de rondas y turbo, junto a la costura
    for (let i = 0; i < 2; i++) {
      const cx = i === 0 ? w.inner[0] - 200 : w.inner[1] + 200
      text(g, names[i], cx, 70, { size: 34, color: rgba(COLORS[i], 0.85), weight: 700 })
      for (let k = 0; k < ROUNDS_TO_WIN; k++) {
        const px = cx + (k - 1) * 46
        g.beginPath()
        g.arc(px, 125, 15, 0, Math.PI * 2)
        g.fillStyle = k < s.sc[i] ? COLORS[i] : 'rgba(255,255,255,0.12)'
        g.fill()
      }
      g.fillStyle = 'rgba(255,255,255,0.12)'
      g.fillRect(cx - 90, 160, 180, 10)
      g.fillStyle = s.on[i] ? '#fff' : COLORS[i]
      g.fillRect(cx - 90, 160, 180 * s.bst[i], 10)
    }

    // Estelas: polilínea de esquinas hasta la cabeza
    g.save()
    g.lineCap = 'round'
    g.lineJoin = 'round'
    for (let i = 0; i < 2; i++) {
      const pts = this.paths[i]
      if (!pts.length) continue
      const head = s.h[i]
      g.beginPath()
      g.moveTo(this.px(pts[0][0]), this.py(pts[0][1]))
      for (let k = 1; k < pts.length; k++) g.lineTo(this.px(pts[k][0]), this.py(pts[k][1]))
      g.lineTo(this.px(head[0]), this.py(head[1]))
      const c = COLORS[i]
      g.strokeStyle = rgba(c, 0.18)
      g.lineWidth = 22
      g.stroke()
      g.strokeStyle = c
      g.lineWidth = 8
      g.stroke()
      g.strokeStyle = 'rgba(255,255,255,0.7)'
      g.lineWidth = 2.5
      g.stroke()
    }
    g.restore()

    // Motos
    for (let i = 0; i < 2; i++) {
      if (!s.alive[i]) continue
      const hx = this.px(s.h[i][0])
      const hy = this.py(s.h[i][1])
      const c = COLORS[i]
      const blink = s.phase === 'ready' ? 0.5 + 0.5 * Math.sin(this.t * 14) : 1
      glow(g, hx, hy, s.on[i] ? 130 : 90, c, 0.5 * blink)
      g.save()
      g.translate(hx, hy)
      g.rotate((s.d[i] * Math.PI) / 2)
      g.fillStyle = '#fff'
      g.globalAlpha = blink
      g.fillRect(-14, -9, 28, 18)
      g.fillStyle = c
      g.fillRect(-10, -6, 16, 12)
      g.restore()
      if (s.phase === 'ready') {
        // Flecha de la dirección de salida
        g.save()
        g.translate(hx, hy)
        g.rotate((s.d[i] * Math.PI) / 2)
        g.fillStyle = rgba(c, blink)
        g.beginPath()
        g.moveTo(60, 0)
        g.lineTo(36, -16)
        g.lineTo(36, 16)
        g.fill()
        g.restore()
      }
    }
    this.fx.render(g)

    if (s.phase === 'end' && s.winner == null) {
      for (let i = 0; i < 2; i++) {
        const cx = w.center[i]
        if (s.rw === -1) text(g, 'CHOQUE DOBLE', cx, 480, { size: 90, font: TITLE, color: '#fff' })
        else if (s.rw === i) text(g, 'RONDA PARA TI', cx, 480, { size: 90, font: TITLE, color: COLORS[i], glow: 30 })
        else text(g, `RONDA PARA ${names[s.rw]}`, cx, 480, { size: 70, font: TITLE, color: '#9aa0c0' })
      }
    }
    if (s.phase === 'ready' && s.round > 1) {
      text(g, `RONDA ${s.round}`, w.center[0], 480, { size: 80, font: TITLE, color: '#fff', alpha: 0.8 })
      text(g, `RONDA ${s.round}`, w.center[1], 480, { size: 80, font: TITLE, color: '#fff', alpha: 0.8 })
    }
  }
}
