// Voley: la red está justo donde se juntan los portátiles, así que los marcos
// hacen de red. Cada uno salta y golpea en su pantalla.
import { H, COLORS, makeWorld, clamp } from '../config.js'
import { text, glow, Particles, rgba, TITLE } from '../draw.js'

const FLOOR = 880
const NET_TOP = 630
const POST = 16
const BLOB = 92
const BALL = 36
const G_BALL = 1350
const G_BLOB = 4200
const JUMP = 1480
const SPEED = 720
const MAX_V = 1550
const POINTS_TO_WIN = 7

export default class Volley {
  static meta = { countdown: true }
  static lerp = ['b', 'pl']

  constructor(cfg, api) {
    this.api = api
    const w = (this.w = makeWorld(cfg.gap))
    this.s = { b: [0, 0], pl: [[0, FLOOR], [0, FLOOR]], sc: [0, 0], freeze: 0, cut: 0, winner: null }
    this.netX = [w.inner[0] - POST, w.inner[1] + POST]
    this.serve(cfg.seed % 2)
    this.s.freeze = 40
    this.fx = new Particles()
    this.t = 0
    this.lastBounce = 0
    this.tick = 0
  }

  bounds(i) {
    const w = this.w
    return i === 0 ? [BLOB, this.netX[0] - BLOB] : [this.netX[1] + BLOB, w.W - BLOB]
  }

  serve(i) {
    const w = this.w
    const s = this.s
    s.pl = [
      [w.center[0], FLOOR],
      [w.center[1], FLOOR],
    ]
    s.b = [w.center[i] + (i === 0 ? 60 : -60), 300]
    this.bv = [0, 0]
    this.pv = [
      [0, 0],
      [0, 0],
    ]
  }

  update(dt, pads) {
    const s = this.s
    const w = this.w
    this.tick++
    // Jugadores
    for (let i = 0; i < 2; i++) {
      const p = s.pl[i]
      const v = this.pv[i]
      const pad = pads[i]
      v[0] = pad.x * SPEED
      const onGround = p[1] >= FLOOR - 0.5
      if (onGround && (pad.held('up') || pad.held('a'))) {
        v[1] = -JUMP
        this.api.sfx('jump', p[0])
      }
      v[1] += G_BLOB * dt
      p[0] = clamp(p[0] + v[0] * dt, ...this.bounds(i))
      p[1] += v[1] * dt
      if (p[1] >= FLOOR) {
        p[1] = FLOOR
        v[1] = 0
      }
    }
    if (s.freeze > 0) {
      s.freeze--
      return
    }
    // Pelota en subpasos para que no atraviese nada
    const b = s.b
    const bv = this.bv
    const N = 5
    const h = dt / N
    for (let k = 0; k < N; k++) {
      bv[1] += G_BALL * h
      b[0] += bv[0] * h
      b[1] += bv[1] * h
      if (b[0] < BALL) {
        b[0] = BALL
        bv[0] = Math.abs(bv[0]) * 0.9
      } else if (b[0] > w.W - BALL) {
        b[0] = w.W - BALL
        bv[0] = -Math.abs(bv[0]) * 0.9
      }
      // Red (un rectángulo que va de un poste al otro, por debajo de los marcos)
      const cx = clamp(b[0], this.netX[0], this.netX[1])
      const cy = clamp(b[1], NET_TOP, FLOOR)
      let dx = b[0] - cx
      let dy = b[1] - cy
      const d = Math.hypot(dx, dy)
      if (d < BALL) {
        if (d > 0.01) {
          b[0] = cx + (dx / d) * BALL
          b[1] = cy + (dy / d) * BALL
          if (Math.abs(dx) > Math.abs(dy)) bv[0] = Math.sign(dx) * Math.abs(bv[0]) * 0.8
          else bv[1] = -Math.abs(bv[1]) * 0.8
        } else {
          // Dentro de la red: se saca hacia arriba
          b[1] = NET_TOP - BALL
          bv[1] = -Math.abs(bv[1])
        }
        this.bounceSound()
      }
      // Jugadores (medio círculo apoyado en el suelo)
      for (let i = 0; i < 2; i++) {
        const p = s.pl[i]
        dx = b[0] - p[0]
        dy = b[1] - p[1]
        const dd = Math.hypot(dx, dy)
        if (dd < BLOB + BALL && b[1] < p[1] + 10) {
          let nx = dx / dd
          let ny = dy / dd
          if (ny > -0.15) {
            ny = -0.15
            const l = Math.hypot(nx, ny)
            nx /= l
            ny /= l
          }
          b[0] = p[0] + nx * (BLOB + BALL)
          b[1] = p[1] + ny * (BLOB + BALL)
          const pv = this.pv[i]
          const rx = bv[0] - pv[0]
          const ry = bv[1] - pv[1]
          const dot = rx * nx + ry * ny
          if (dot < 0) {
            bv[0] = pv[0] * 0.6 + rx - 2 * dot * nx
            bv[1] = Math.min(pv[1] * 0.6 + ry - 2 * dot * ny, -520)
            const sp = Math.hypot(bv[0], bv[1])
            if (sp > MAX_V) {
              bv[0] *= MAX_V / sp
              bv[1] *= MAX_V / sp
            }
            if (this.tick - this.lastBounce > 4) {
              this.lastBounce = this.tick
              this.api.sfx('bounce', b[0])
              this.api.emit({ e: 'hit', x: b[0], y: b[1], i })
            }
          }
        }
      }
      // Suelo: punto
      if (b[1] >= FLOOR - BALL) {
        b[1] = FLOOR - BALL
        const landed = b[0] < w.mid ? 0 : 1
        return this.point(1 - landed, b[0])
      }
    }
  }

  bounceSound() {
    if (this.tick - this.lastBounce > 4) {
      this.lastBounce = this.tick
      this.api.sfx('wall', this.s.b[0])
    }
  }

  point(scorer, x) {
    const s = this.s
    s.sc[scorer]++
    this.api.sfx('point', x)
    this.api.emit({ e: 'land', x, scorer })
    if (s.sc[scorer] >= POINTS_TO_WIN) {
      s.winner = scorer
      return
    }
    this.serve(scorer)
    s.freeze = 60
    s.cut++
  }

  onEvent(ev) {
    if (ev.e === 'hit') this.fx.burst(ev.x, ev.y, COLORS[ev.i], 14, { speed: 420, life: 0.4, size: 7 })
    if (ev.e === 'land') this.fx.burst(ev.x, FLOOR, '#ffd88a', 40, { speed: 600, life: 0.8, size: 8, spread: Math.PI, dir: -Math.PI / 2, gravity: 900 })
  }

  local(dt) {
    this.t += dt
    this.fx.update(dt)
  }

  render(g) {
    const w = this.w
    const s = this.s
    const names = this.api.cfg.names

    // Atardecer con el sol justo en la costura
    const sky = g.createLinearGradient(0, 0, 0, FLOOR)
    sky.addColorStop(0, '#120a2e')
    sky.addColorStop(0.55, '#4a1a5c')
    sky.addColorStop(1, '#ff6b4a')
    g.fillStyle = sky
    g.fillRect(0, 0, w.W, FLOOR)
    g.save()
    g.beginPath()
    g.rect(0, 0, w.W, FLOOR)
    g.clip()
    const sun = g.createLinearGradient(0, FLOOR - 520, 0, FLOOR)
    sun.addColorStop(0, '#ffe66b')
    sun.addColorStop(1, '#ff3d7f')
    g.fillStyle = sun
    g.beginPath()
    g.arc(w.mid, FLOOR - 60, 420, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = sky
    for (let k = 0; k < 7; k++) {
      const y = FLOOR - 250 + k * 34
      g.fillRect(w.mid - 450, y, 900, 6 + k * 2.5)
    }
    // Siluetas de palmeras en los extremos
    g.fillStyle = '#1a0b26'
    for (const [x, sc] of [
      [140, 1],
      [380, 0.7],
      [w.W - 140, 1],
      [w.W - 380, 0.7],
    ])
      palm(g, x, FLOOR, sc)
    g.restore()

    // Suelo con rejilla en perspectiva hacia la costura
    const fl = g.createLinearGradient(0, FLOOR, 0, H)
    fl.addColorStop(0, '#2a0d3d')
    fl.addColorStop(1, '#0c0418')
    g.fillStyle = fl
    g.fillRect(0, FLOOR, w.W, H - FLOOR)
    g.strokeStyle = 'rgba(255,90,200,0.35)'
    g.lineWidth = 2
    g.beginPath()
    for (let x = -1600; x <= w.W + 1600; x += 160) {
      g.moveTo(w.mid + (x - w.mid) * 0.35, FLOOR)
      g.lineTo(x, H)
    }
    for (let k = 1; k < 6; k++) {
      const y = FLOOR + (H - FLOOR) * Math.pow(k / 6, 1.6)
      g.moveTo(0, y)
      g.lineTo(w.W, y)
    }
    g.stroke()
    g.strokeStyle = '#ff9be0'
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(0, FLOOR)
    g.lineTo(w.W, FLOOR)
    g.stroke()

    // Red: se ven los dos postes, el resto queda bajo los marcos
    g.save()
    g.fillStyle = 'rgba(255,255,255,0.18)'
    g.fillRect(this.netX[0], NET_TOP, this.netX[1] - this.netX[0], FLOOR - NET_TOP)
    g.strokeStyle = 'rgba(255,255,255,0.35)'
    g.lineWidth = 2
    g.beginPath()
    for (let y = NET_TOP; y < FLOOR; y += 24) {
      g.moveTo(this.netX[0], y)
      g.lineTo(this.netX[1], y)
    }
    g.stroke()
    g.fillStyle = '#ffffff'
    g.shadowColor = '#fff'
    g.shadowBlur = 20
    g.fillRect(this.netX[0], NET_TOP - 8, this.netX[1] - this.netX[0], 14)
    g.fillRect(this.netX[0], NET_TOP, 8, FLOOR - NET_TOP)
    g.fillRect(this.netX[1] - 8, NET_TOP, 8, FLOOR - NET_TOP)
    g.restore()

    // Marcadores
    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? w.inner[0] - 170 : w.inner[1] + 170
      text(g, String(s.sc[i]), x, 130, { size: 120, font: TITLE, color: COLORS[i], glow: 20 })
      text(g, names[i], x, 215, { size: 32, color: rgba(COLORS[i], 0.8), weight: 600 })
    }

    const [bx, by] = s.b
    // Sombra de la pelota en el suelo
    const hgt = clamp((FLOOR - by) / 800, 0, 1)
    g.fillStyle = `rgba(0,0,0,${0.45 - hgt * 0.3})`
    g.beginPath()
    g.ellipse(bx, FLOOR + 6, BALL * (1.3 - hgt * 0.6), 10, 0, 0, Math.PI * 2)
    g.fill()

    // Jugadores con un ojo que sigue a la pelota
    for (let i = 0; i < 2; i++) {
      const [x, y] = s.pl[i]
      const c = COLORS[i]
      glow(g, x, y - 40, 200, c, 0.25)
      const gr = g.createLinearGradient(0, y - BLOB, 0, y)
      gr.addColorStop(0, c)
      gr.addColorStop(1, rgba(c, 0.6))
      g.fillStyle = gr
      g.beginPath()
      g.arc(x, y, BLOB, Math.PI, 0)
      g.closePath()
      g.fill()
      const ex = x + (i === 0 ? 34 : -34)
      const ey = y - 52
      g.fillStyle = '#fff'
      g.beginPath()
      g.arc(ex, ey, 19, 0, Math.PI * 2)
      g.fill()
      const a = Math.atan2(by - ey, bx - ex)
      g.fillStyle = '#111'
      g.beginPath()
      g.arc(ex + Math.cos(a) * 8, ey + Math.sin(a) * 8, 9, 0, Math.PI * 2)
      g.fill()
    }

    // Pelota
    glow(g, bx, by, 120, '#fff3b0', 0.4)
    g.fillStyle = '#fff6d6'
    g.beginPath()
    g.arc(bx, by, BALL, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#ffb340'
    g.lineWidth = 4
    g.beginPath()
    g.arc(bx, by, BALL * 0.7, this.t * 3, this.t * 3 + Math.PI)
    g.stroke()
    // Si se va por arriba, una flechita
    if (by < -BALL) {
      g.fillStyle = '#fff'
      g.beginPath()
      g.moveTo(bx, 14)
      g.lineTo(bx - 18, 44)
      g.lineTo(bx + 18, 44)
      g.fill()
    }
    this.fx.render(g)
  }
}

function palm(g, x, y, s) {
  g.save()
  g.translate(x, y)
  g.scale(s, s)
  g.beginPath()
  g.moveTo(-10, 0)
  g.quadraticCurveTo(10, -200, 40, -380)
  g.lineTo(55, -378)
  g.quadraticCurveTo(28, -200, 12, 0)
  g.fill()
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k - 2.5) * 0.55
    g.beginPath()
    g.moveTo(48, -380)
    g.quadraticCurveTo(48 + Math.cos(a) * 120, -380 + Math.sin(a) * 120 - 40, 48 + Math.cos(a) * 200, -380 + Math.sin(a) * 200 + 40)
    g.quadraticCurveTo(48 + Math.cos(a) * 110, -380 + Math.sin(a) * 110 - 10, 48, -372)
    g.fill()
  }
  g.restore()
}
