// Artillería por turnos: un tanque en cada pantalla y una montaña justo en
// medio. Los proyectiles cruzan de un portátil a otro y abren cráteres.
import { H, COLORS, makeWorld, clamp, rng } from '../config.js'
import { text, glow, Particles, rgba, TITLE, roundRect } from '../draw.js'

const STEP = 5
const G = 620
const TURN_TICKS = 25 * 60
const WEAPONS = [
  { name: 'OBÚS', r: 72, dmg: 34, ammo: Infinity },
  { name: 'TRIPLE', r: 46, dmg: 17, ammo: 2, spread: 4 },
  { name: 'MEGA', r: 130, dmg: 55, ammo: 1, big: true },
]

function terrain(w, seed) {
  const R = rng(seed)
  const n = Math.ceil(w.W / STEP) + 1
  const h = new Float32Array(n)
  const f = [0.0012 + R() * 0.001, 0.003 + R() * 0.003, 0.009 + R() * 0.006]
  const ph = [R() * 6.28, R() * 6.28, R() * 6.28]
  const amp = [80 + R() * 40, 40, 12]
  const hill = 240 + R() * 130
  const hillW = 360 + R() * 220
  for (let i = 0; i < n; i++) {
    const x = i * STEP
    let y = 720
    for (let k = 0; k < 3; k++) y -= amp[k] * Math.sin(x * f[k] + ph[k])
    y -= hill * Math.exp(-(((x - w.mid) / hillW) ** 2))
    h[i] = clamp(y, 250, 920)
  }
  const tx = [w.HALF * (0.15 + R() * 0.25), w.W - w.HALF * (0.15 + R() * 0.25)]
  // Terreno llano bajo cada tanque
  for (const x of tx) {
    const c = Math.round(x / STEP)
    let avg = 0
    for (let k = -8; k <= 8; k++) avg += h[c + k]
    avg /= 17
    for (let k = -18; k <= 18; k++) {
      const t = clamp((Math.abs(k) - 9) / 9, 0, 1)
      h[c + k] = avg * (1 - t) + h[c + k] * t
    }
  }
  // Montañas del fondo (solo decoración)
  const far = []
  const fp = [R() * 6.28, R() * 6.28]
  for (let x = 0; x <= w.W + 40; x += 40) far.push(560 - 110 * Math.sin(x * 0.0021 + fp[0]) - 50 * Math.sin(x * 0.006 + fp[1]))
  const stars = []
  for (let k = 0; k < 220; k++) stars.push([R() * w.W, R() * 600, R() * 2.2 + 0.6, R() * 6.28])
  return { h, tx, far, stars, wind: Math.round((R() * 2 - 1) * 70) }
}

export default class Artillery {
  static meta = { countdown: true }
  static lerp = ['tk', 'pr']

  constructor(cfg, api) {
    this.api = api
    const w = (this.w = makeWorld(cfg.gap))
    const T = terrain(w, cfg.seed)
    this.h = T.h
    this.far = T.far
    this.stars = T.stars
    this.s = {
      tk: T.tx.map((x, i) => ({ x, y: this.groundY(x), hp: 100, a: i === 0 ? 45 : 135, pw: 62 })),
      turn: cfg.seed % 2,
      phase: 'aim',
      timer: TURN_TICKS,
      wind: T.wind,
      pr: [],
      wpn: [0, 0],
      ammo: [WEAPONS.map(wp => (wp.ammo === Infinity ? -1 : wp.ammo)), WEAPONS.map(wp => (wp.ammo === Infinity ? -1 : wp.ammo))],
      shot: 0,
      cut: 0,
      winner: null,
    }
    this.shells = []
    this.hold = 0
    // locales
    this.dirty = true
    this.fx = new Particles()
    this.trace = [[], []]
    this.traceShot = -1
    this.trail = []
    this.shake = 0
    this.pops = []
    this.t = 0
  }

  groundY(x) {
    if (x < 0 || x > this.w.W) return H + 200
    const f = x / STEP
    const i = Math.floor(f)
    const a = this.h[i]
    const b = this.h[Math.min(i + 1, this.h.length - 1)]
    return a + (b - a) * (f - i)
  }

  pivot(tk) {
    return [tk.x, tk.y - 30]
  }

  update(dt, pads) {
    const s = this.s
    for (const tk of s.tk) {
      const gy = this.groundY(tk.x)
      tk.y = tk.y < gy ? Math.min(gy, tk.y + 520 * dt) : gy
    }
    if (s.phase === 'aim') {
      const i = s.turn
      const pad = pads[i]
      const tk = s.tk[i]
      if (pad.x || pad.y) this.hold += dt
      else this.hold = 0
      const rate = Math.min(1, 0.3 + this.hold * 1.1)
      tk.a = clamp(tk.a - pad.x * 60 * rate * dt, 3, 177)
      tk.pw = clamp(tk.pw - pad.y * 40 * rate * dt, 5, 100)
      if (pad.pressed('b')) {
        let k = s.wpn[i]
        for (let n = 0; n < WEAPONS.length; n++) {
          k = (k + 1) % WEAPONS.length
          if (s.ammo[i][k] !== 0) break
        }
        s.wpn[i] = k
        this.api.sfx('tick', tk.x)
      }
      if (pad.pressed('a') || --s.timer <= 0) this.fire()
    } else if (s.phase === 'fly') {
      this.stepShells(dt)
      if (!this.shells.length) {
        s.phase = 'settle'
        s.timer = 80
      }
    } else if (s.phase === 'settle') {
      if (--s.timer <= 0) this.endTurn()
    }
  }

  fire() {
    const s = this.s
    const i = s.turn
    const tk = s.tk[i]
    const k = s.wpn[i]
    const wp = WEAPONS[k]
    if (s.ammo[i][k] > 0) s.ammo[i][k]--
    if (s.ammo[i][k] === 0) s.wpn[i] = 0
    const speed = 300 + tk.pw * 14
    const [px, py] = this.pivot(tk)
    const angles = wp.spread ? [tk.a - wp.spread, tk.a, tk.a + wp.spread] : [tk.a]
    for (const a of angles) {
      const r = (a * Math.PI) / 180
      this.shells.push({ x: px + Math.cos(r) * 58, y: py - Math.sin(r) * 58, vx: Math.cos(r) * speed, vy: -Math.sin(r) * speed, w: k })
    }
    s.pr = this.shells.map(sh => [sh.x, sh.y])
    s.phase = 'fly'
    s.shot++
    this.api.sfx('shoot', px)
    this.api.emit({ e: 'fire', i, x: px + Math.cos((tk.a * Math.PI) / 180) * 58, y: py - Math.sin((tk.a * Math.PI) / 180) * 58 })
  }

  stepShells(dt) {
    const s = this.s
    const w = this.w
    const N = 4
    const h = dt / N
    for (let n = 0; n < N; n++) {
      for (let j = this.shells.length - 1; j >= 0; j--) {
        const sh = this.shells[j]
        sh.vx += s.wind * h
        sh.vy += G * h
        sh.x += sh.vx * h
        sh.y += sh.vy * h
        let hit = sh.x >= 0 && sh.x <= w.W && sh.y >= this.groundY(sh.x)
        for (const tk of s.tk) if (Math.hypot(sh.x - tk.x, sh.y - (tk.y - 20)) < 38) hit = true
        if (hit) {
          this.explode(sh)
          this.shells.splice(j, 1)
        } else if (sh.x < -500 || sh.x > w.W + 500 || sh.y > H + 200) {
          this.shells.splice(j, 1)
          this.api.emit({ e: 'miss', x: clamp(sh.x, 0, w.W) })
        }
      }
    }
    s.pr = this.shells.map(sh => [sh.x, sh.y])
  }

  explode(sh) {
    const s = this.s
    const wp = WEAPONS[sh.w]
    const x = Math.round(sh.x)
    const y = Math.round(Math.min(sh.y, this.groundY(sh.x) + 4))
    this.api.emit({ e: 'crater', x, y, r: wp.r })
    this.api.sfx(wp.big ? 'bigboom' : 'boom', x)
    s.tk.forEach((tk, i) => {
      const d = Math.hypot(x - tk.x, y - (tk.y - 20))
      if (d < wp.r + 28) {
        const f = clamp(1 - Math.max(0, d - 22) / (wp.r + 6), 0.25, 1)
        const dmg = Math.round(wp.dmg * f)
        tk.hp = Math.max(0, tk.hp - dmg)
        this.api.emit({ e: 'dmg', i, n: dmg })
      }
    })
  }

  endTurn() {
    const s = this.s
    const dead = s.tk.map(t => t.hp <= 0)
    if (dead[0] || dead[1]) {
      // Si caen los dos, pierde quien ha disparado
      s.winner = dead[0] && dead[1] ? 1 - s.turn : dead[0] ? 1 : 0
      return
    }
    s.turn = 1 - s.turn
    s.phase = 'aim'
    s.timer = TURN_TICKS
    s.wind = Math.round((Math.random() * 2 - 1) * 90)
    this.hold = 0
    this.api.sfx('select', s.tk[s.turn].x)
  }

  crater(cx, cy, r) {
    const h = this.h
    const i0 = Math.max(0, Math.floor((cx - r) / STEP))
    const i1 = Math.min(h.length - 1, Math.ceil((cx + r) / STEP))
    for (let i = i0; i <= i1; i++) {
      const dx = i * STEP - cx
      if (Math.abs(dx) > r) continue
      const c = Math.sqrt(r * r - dx * dx)
      const top = cy - c
      const bottom = cy + c
      if (h[i] < bottom) h[i] = Math.min(H - 6, h[i] >= top ? bottom : h[i] + (bottom - top))
    }
    this.dirty = true
  }

  onEvent(ev) {
    if (ev.e === 'crater') {
      this.crater(ev.x, ev.y, ev.r)
      const big = ev.r > 100
      this.fx.burst(ev.x, ev.y, '#ffcf5a', big ? 160 : 70, { speed: big ? 1100 : 700, life: big ? 1.3 : 0.9, size: big ? 12 : 9, gravity: 700 })
      this.fx.burst(ev.x, ev.y, '#ff5a2a', big ? 90 : 40, { speed: big ? 700 : 450, life: 1, size: 10, gravity: 300 })
      this.fx.burst(ev.x, ev.y, '#5b6b4a', big ? 70 : 30, { speed: 600, life: 1.2, size: 8, gravity: 1400, spread: Math.PI, dir: -Math.PI / 2 })
      this.shake = Math.max(this.shake, big ? 1 : 0.5)
      this.booms = (this.booms || []).concat([{ x: ev.x, y: ev.y, r: ev.r, t: 0 }])
    } else if (ev.e === 'fire') {
      this.fx.burst(ev.x, ev.y, '#fff2b0', 22, { speed: 380, life: 0.35, size: 7 })
    } else if (ev.e === 'dmg') {
      const tk = this.s.tk[ev.i]
      this.pops.push({ x: tk.x, y: tk.y - 120, n: ev.n, t: 0, i: ev.i })
    }
  }

  local(dt) {
    const s = this.s
    this.t += dt
    this.fx.update(dt)
    this.shake = Math.max(0, this.shake - dt * 2)
    for (const p of this.pops) p.t += dt
    this.pops = this.pops.filter(p => p.t < 1.4)
    if (this.booms) {
      for (const b of this.booms) b.t += dt
      this.booms = this.booms.filter(b => b.t < 0.5)
    }
    // Rastro del último disparo de cada uno, para corregir el tiro
    if (s.phase === 'fly' && s.pr.length) {
      if (this.traceShot !== s.shot) {
        this.traceShot = s.shot
        this.trace[s.turn] = []
      }
      const p = s.pr[Math.floor(s.pr.length / 2)]
      const tr = this.trace[s.turn]
      const last = tr[tr.length - 1]
      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 26) tr.push([p[0], p[1]])
    }
    for (const p of s.pr) this.trail.push([p[0], p[1], 0])
    for (const p of this.trail) p[2] += dt
    this.trail = this.trail.filter(p => p[2] < 0.35)
  }

  render(g) {
    const w = this.w
    const s = this.s
    const names = this.api.cfg.names
    g.save()
    if (this.shake > 0) g.translate((Math.random() - 0.5) * 30 * this.shake, (Math.random() - 0.5) * 30 * this.shake)

    // Cielo de noche
    const sky = g.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, '#05071a')
    sky.addColorStop(0.6, '#1b1440')
    sky.addColorStop(1, '#3a1d4a')
    g.fillStyle = sky
    g.fillRect(-40, -40, w.W + 80, H + 80)
    for (const [x, y, r, ph] of this.stars) {
      g.globalAlpha = 0.5 + 0.5 * Math.sin(this.t * 2 + ph)
      g.fillStyle = '#fff'
      g.fillRect(x, y, r, r)
    }
    g.globalAlpha = 1
    const mx = w.inner[1] + 1180
    glow(g, mx, 170, 260, '#fff4d0', 0.25)
    g.fillStyle = '#fff4d8'
    g.beginPath()
    g.arc(mx, 170, 70, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(200,190,170,0.5)'
    g.beginPath()
    g.arc(mx - 20, 155, 14, 0, Math.PI * 2)
    g.arc(mx + 22, 190, 10, 0, Math.PI * 2)
    g.fill()

    // Montañas lejanas
    g.fillStyle = '#251a46'
    g.beginPath()
    g.moveTo(0, H)
    this.far.forEach((y, k) => g.lineTo(k * 40, y))
    g.lineTo(w.W, H)
    g.closePath()
    g.fill()

    // Terreno
    if (this.dirty) {
      const p = new Path2D()
      const e = new Path2D()
      p.moveTo(0, H + 50)
      this.h.forEach((y, i) => {
        p.lineTo(i * STEP, y)
        if (i) e.lineTo(i * STEP, y)
        else e.moveTo(0, y)
      })
      p.lineTo(w.W, H + 50)
      p.closePath()
      this.path = p
      this.edge = e
      this.dirty = false
    }
    const tg = g.createLinearGradient(0, 300, 0, H)
    tg.addColorStop(0, '#1d4a35')
    tg.addColorStop(1, '#08140f')
    g.fillStyle = tg
    g.fill(this.path)
    g.save()
    g.strokeStyle = '#6dffb0'
    g.shadowColor = '#6dffb0'
    g.shadowBlur = 16
    g.lineWidth = 5
    g.stroke(this.edge)
    g.restore()

    // Rastros de los disparos anteriores
    for (let i = 0; i < 2; i++) {
      g.fillStyle = rgba(COLORS[i], 0.45)
      for (const [x, y] of this.trace[i]) g.fillRect(x - 3, y - 3, 6, 6)
    }

    // Vista previa de la trayectoria (sin viento)
    if (s.phase === 'aim') {
      const tk = s.tk[s.turn]
      const r = (tk.a * Math.PI) / 180
      const sp = 300 + tk.pw * 14
      let [x, y] = this.pivot(tk)
      x += Math.cos(r) * 58
      y -= Math.sin(r) * 58
      let vx = Math.cos(r) * sp
      let vy = -Math.sin(r) * sp
      g.fillStyle = '#ffffff'
      for (let k = 0; k < 22; k++) {
        for (let n = 0; n < 2; n++) {
          vy += G * 0.012
          x += vx * 0.012
          y += vy * 0.012
        }
        g.globalAlpha = 1 - k / 22
        g.beginPath()
        g.arc(x, y, 5, 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
    }

    // Tanques
    s.tk.forEach((tk, i) => this.tank(g, tk, i, names[i], s.turn === i && s.phase === 'aim'))

    // Proyectiles
    g.save()
    g.globalCompositeOperation = 'lighter'
    for (const [x, y, t] of this.trail) {
      g.globalAlpha = (1 - t / 0.35) * 0.5
      g.fillStyle = '#ffb05a'
      g.beginPath()
      g.arc(x, y, 8 * (1 - t / 0.35) + 2, 0, Math.PI * 2)
      g.fill()
    }
    g.restore()
    for (const [x, y] of s.pr) {
      glow(g, x, y, 60, '#ffcf5a', 0.6)
      g.fillStyle = '#fff'
      g.beginPath()
      g.arc(x, y, 9, 0, Math.PI * 2)
      g.fill()
      if (y < -10) {
        g.fillStyle = '#ffcf5a'
        g.beginPath()
        g.moveTo(x, 12)
        g.lineTo(x - 16, 40)
        g.lineTo(x + 16, 40)
        g.fill()
        text(g, `${Math.round(-y)}`, x, 62, { size: 22, color: '#ffcf5a' })
      }
    }
    if (this.booms) {
      for (const b of this.booms) {
        const k = b.t / 0.5
        g.strokeStyle = `rgba(255,230,160,${1 - k})`
        g.lineWidth = 10 * (1 - k) + 2
        g.beginPath()
        g.arc(b.x, b.y, b.r * (0.4 + k * 0.9), 0, Math.PI * 2)
        g.stroke()
        glow(g, b.x, b.y, b.r * 2.2, '#ffb347', (1 - k) * 0.8)
      }
    }
    this.fx.render(g)
    for (const p of this.pops) text(g, `−${p.n}`, p.x, p.y - p.t * 70, { size: 54, font: TITLE, color: '#ff5a5a', alpha: 1 - p.t / 1.4 })
    g.restore()

    this.hud(g)
  }

  tank(g, tk, i, name, active) {
    const c = COLORS[i]
    const { x, y } = tk
    if (active) glow(g, x, y - 30, 160, c, 0.35)
    // cañón
    const r = (tk.a * Math.PI) / 180
    const [px, py] = this.pivot(tk)
    g.strokeStyle = '#e8ecff'
    g.lineWidth = 11
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(px, py)
    g.lineTo(px + Math.cos(r) * 54, py - Math.sin(r) * 54)
    g.stroke()
    // torreta y cuerpo
    g.fillStyle = c
    g.beginPath()
    g.arc(px, py + 4, 24, Math.PI, 0)
    g.fill()
    g.beginPath()
    g.moveTo(x - 46, y - 10)
    g.lineTo(x - 36, y - 28)
    g.lineTo(x + 36, y - 28)
    g.lineTo(x + 46, y - 10)
    g.closePath()
    g.fill()
    g.fillStyle = '#20243a'
    roundRect(g, x - 48, y - 14, 96, 16, 8)
    g.fill()
    g.fillStyle = '#8890b0'
    for (let k = -3; k <= 3; k++) {
      g.beginPath()
      g.arc(x + k * 13, y - 6, 4, 0, Math.PI * 2)
      g.fill()
    }
    // vida
    const bw = 120
    g.fillStyle = 'rgba(0,0,0,0.6)'
    roundRect(g, x - bw / 2, y - 112, bw, 16, 8)
    g.fill()
    g.fillStyle = tk.hp > 50 ? '#6dff8a' : tk.hp > 25 ? '#ffd84a' : '#ff5a5a'
    roundRect(g, x - bw / 2, y - 112, Math.max(8, (bw * tk.hp) / 100), 16, 8)
    g.fill()
    text(g, name, x, y - 138, { size: 28, color: c, weight: 700 })
  }

  hud(g) {
    const w = this.w
    const s = this.s
    const names = this.api.cfg.names
    for (let i = 0; i < 2; i++) {
      const cx = w.center[i]
      // viento
      const wv = s.wind
      text(g, 'VIENTO', cx, 50, { size: 24, color: '#b8b4e0', weight: 600 })
      g.save()
      g.translate(cx, 88)
      g.strokeStyle = 'rgba(255,255,255,0.25)'
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(-110, 0)
      g.lineTo(110, 0)
      g.stroke()
      const L = (wv / 90) * 110
      if (Math.abs(L) > 3) {
        g.strokeStyle = '#9ff0ff'
        g.fillStyle = '#9ff0ff'
        g.lineWidth = 8
        g.beginPath()
        g.moveTo(0, 0)
        g.lineTo(L, 0)
        g.stroke()
        g.beginPath()
        g.moveTo(L + Math.sign(L) * 16, 0)
        g.lineTo(L - Math.sign(L) * 4, -12)
        g.lineTo(L - Math.sign(L) * 4, 12)
        g.fill()
      }
      g.restore()
      text(g, `${Math.abs(wv)}`, cx, 122, { size: 24, color: '#9ff0ff', weight: 600 })

      // turno
      const mine = s.turn === i
      if (s.phase === 'aim') {
        if (mine) {
          text(g, 'TU TURNO', cx, 190, { size: 60, font: TITLE, color: COLORS[i], glow: 20 })
          const secs = Math.ceil(s.timer / 60)
          text(g, `${secs}`, cx, 250, { size: 40, color: secs <= 5 ? '#ff5a5a' : '#fff', weight: 700 })
        } else text(g, `TURNO DE ${names[s.turn]}`, cx, 190, { size: 40, font: TITLE, color: rgba(COLORS[s.turn], 0.7) })
      }
    }
    // Panel del jugador al que le toca, en su pantalla
    if (s.phase === 'aim') {
      const i = s.turn
      const tk = s.tk[i]
      const cx = w.center[i]
      const by = 938
      g.save()
      roundRect(g, cx - 520, by - 44, 1040, 88, 44)
      g.fillStyle = 'rgba(5,6,20,0.82)'
      g.fill()
      g.restore()
      text(g, `${Math.round(tk.a > 90 ? 180 - tk.a : tk.a)}°`, cx - 430, by, { size: 40, color: '#fff', weight: 700 })
      text(g, `${Math.round(tk.pw)}%`, cx - 300, by, { size: 40, color: '#fff', weight: 700 })
      WEAPONS.forEach((wp, k) => {
        const n = s.ammo[i][k]
        const x = cx - 120 + k * 200
        const sel = s.wpn[i] === k
        text(g, `${wp.name}${n < 0 ? '' : ` ×${n}`}`, x, by, { size: 32, color: sel ? COLORS[i] : n === 0 ? '#555a77' : '#b8b4e0', weight: sel ? 700 : 500 })
        if (sel) {
          g.fillStyle = COLORS[i]
          g.fillRect(x - 60, by + 24, 120, 5)
        }
      })
      text(g, 'X arma', cx + 470, by, { size: 26, color: '#8a86b0', weight: 500 })
    }
  }
}
