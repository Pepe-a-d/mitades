// Duelo del oeste: cada vaquero en su pantalla, mirándose a través de los marcos.
// Para que sea justo, cada portátil mide el tiempo de reacción desde que ÉL
// enseña la señal, así el retraso de la red no le da ventaja a nadie.
import { H, COLORS, makeWorld, rng, TICK_MS } from '../config.js'
import { text, seamText, bothText, glow, Particles, rgba, TITLE } from '../draw.js'

const ROUNDS_TO_WIN = 3
const GROUND = 770

export default class Duel {
  static meta = { countdown: true }
  static lerp = null

  constructor(cfg, api) {
    this.api = api
    const w = (this.w = makeWorld(cfg.gap))
    this.s = { phase: 'ready', sc: [0, 0], round: 1, res: [null, null], rw: -1, timer: 110, winner: null, cut: 0 }
    this.res = [null, null]
    this.cx = [w.center[0] + 140, w.center[1] - 140]
    // decorado con semilla
    const R = rng(cfg.seed)
    this.mesas = []
    for (let k = 0; k < 7; k++) {
      const x = R() * w.W
      this.mesas.push([x, 120 + R() * 220, 80 + R() * 120])
    }
    this.cacti = [
      [180 + R() * 200, 0.9],
      [w.W - 180 - R() * 200, 1],
      [w.inner[0] - 260 - R() * 200, 0.6],
      [w.inner[1] + 260 + R() * 200, 0.65],
    ]
    // locales
    this.fx = new Particles()
    this.armed = false
    this.signalAt = 0
    this.shownAt = 0
    this.mine = null
    this.flash = 0
    this.heart = 0
    this.anim = null
    this.props = []
    this.t = 0
  }

  // ---------- anfitrión ----------

  update(dt) {
    const s = this.s
    if (s.phase === 'ready') {
      if (--s.timer <= 0) {
        s.phase = 'wait'
        const delay = Math.round(2200 + Math.random() * 3800)
        this.delay = delay
        this.wt = 0
        this.decideAt = 0
        this.res = [null, null]
        this.api.emit({ e: 'arm', delay })
        // Distracciones antes de la señal
        this.fakes = []
        const n = Math.floor(Math.random() * 3)
        for (let k = 0; k < n; k++) {
          const at = 500 + Math.random() * (delay - 1300)
          if (at > 400) this.fakes.push({ tick: Math.round(at / TICK_MS), kind: Math.random() < 0.55 ? 'bird' : 'weed', dir: Math.random() < 0.5 ? 1 : -1 })
        }
      }
      return
    }
    if (s.phase === 'wait') {
      this.wt++
      for (const f of this.fakes) {
        if (f.tick === this.wt) {
          this.api.emit({ e: 'fake', kind: f.kind, dir: f.dir })
          this.api.sfx(f.kind === 'bird' ? 'caw' : 'whoosh', f.dir > 0 ? 0 : this.w.W)
        }
      }
      const [a, b] = this.res
      const foul = (a && a.foul) || (b && b.foul)
      if ((a && b) || (foul && !(a && !a.foul) && !(b && !b.foul)) || (this.decideAt && this.wt >= this.decideAt)) this.decide()
      else if (this.wt * TICK_MS > this.delay + 3500) this.decide()
      return
    }
    // result / void
    if (--s.timer <= 0) {
      if (s.sc[0] >= ROUNDS_TO_WIN || s.sc[1] >= ROUNDS_TO_WIN) {
        s.winner = s.sc[0] > s.sc[1] ? 0 : 1
        return
      }
      s.phase = 'ready'
      s.timer = 100
      s.round++
      s.res = [null, null]
      s.rw = -1
      this.api.emit({ e: 'reset' })
    }
  }

  // Resultado que manda cada portátil: { ms } o { foul: true }
  onMessage(m, side) {
    if (this.s.phase !== 'wait' || this.res[side]) return
    this.res[side] = m.foul ? { foul: true } : { ms: m.ms }
    if (!m.foul && !this.decideAt) this.decideAt = this.wt + 25
  }

  decide() {
    const s = this.s
    const r = this.res
    const ok = i => r[i] && !r[i].foul
    let rw
    if (ok(0) && ok(1)) rw = r[0].ms <= r[1].ms ? 0 : 1
    else if (ok(0)) rw = 0
    else if (ok(1)) rw = 1
    else if (r[0] && r[1]) rw = -1
    else if (r[0]) rw = 1
    else if (r[1]) rw = 0
    else rw = -1
    s.res = r.map(x => (x ? (x.foul ? -1 : x.ms) : null))
    s.rw = rw
    s.phase = rw === -1 ? 'void' : 'result'
    s.timer = 180
    if (rw >= 0) {
      s.sc[rw]++
      this.api.sfx('bang', this.cx[rw])
    }
    this.api.emit({ e: 'result', rw })
  }

  // ---------- los dos portátiles ----------

  onEvent(ev) {
    const now = this.api.now()
    if (ev.e === 'arm') {
      this.armed = true
      this.signalAt = now + ev.delay
      this.shownAt = 0
      this.mine = null
      this.heart = 0.4
    } else if (ev.e === 'fake') {
      const w = this.w
      if (ev.kind === 'bird') this.props.push({ kind: 'bird', x: ev.dir > 0 ? -100 : w.W + 100, y: 180 + Math.random() * 200, v: ev.dir * 1300, t: 0 })
      else this.props.push({ kind: 'weed', x: ev.dir > 0 ? -80 : w.W + 80, y: GROUND + 60, v: ev.dir * 900, t: 0 })
    } else if (ev.e === 'result') {
      this.armed = false
      this.anim = { rw: ev.rw, t: 0 }
      if (ev.rw >= 0) {
        const x = this.cx[ev.rw] + (ev.rw === 0 ? 120 : -120)
        this.fx.burst(x, GROUND - 175, '#fff2a0', 40, { speed: 700, life: 0.4, size: 8, spread: 0.8, dir: ev.rw === 0 ? 0 : Math.PI })
      }
    } else if (ev.e === 'reset') {
      this.armed = false
      this.anim = null
      this.mine = null
      this.shownAt = 0
    }
  }

  local(dt, pad, f) {
    const now = this.api.now()
    this.t += dt
    this.fx.update(dt)
    this.flash = Math.max(0, this.flash - dt * 2.5)
    if (this.anim) this.anim.t += dt
    for (const p of this.props) {
      p.t += dt
      p.x += p.v * dt
    }
    this.props = this.props.filter(p => p.t < 6)

    if (this.armed && !this.shownAt && now >= this.signalAt) {
      this.shownAt = now
      this.flash = 1
      this.api.localSfx('bell')
    }
    if (this.armed && !this.shownAt) {
      this.heart -= dt
      if (this.heart <= 0) {
        this.heart = 0.8
        this.api.localSfx('heart')
      }
    }
    if (this.armed && !this.mine && f.count === 0 && pad.pressed('a')) {
      const t = this.api.pressTime('a')
      const me = this.api.side
      this.mine = !this.shownAt || t < this.shownAt ? { foul: true } : { ms: Math.max(1, Math.round(t - this.shownAt)) }
      this.api.localSfx(this.mine.foul ? 'foul' : 'bang', this.cx[me])
      this.api.send(this.mine)
    }
  }

  render(g) {
    const w = this.w
    const s = this.s
    const names = this.api.cfg.names
    const me = this.api.side

    // Cielo y sol poniéndose justo en la costura
    const sky = g.createLinearGradient(0, 0, 0, GROUND)
    sky.addColorStop(0, '#2a0f2e')
    sky.addColorStop(0.5, '#a3324a')
    sky.addColorStop(1, '#ffad5a')
    g.fillStyle = sky
    g.fillRect(0, 0, w.W, GROUND)
    glow(g, w.mid, GROUND - 40, 700, '#ffd27a', 0.45)
    g.fillStyle = '#ffe7a3'
    g.beginPath()
    g.arc(w.mid, GROUND - 30, 260, Math.PI, 0)
    g.fill()
    // mesetas lejanas
    g.fillStyle = '#6e2a3a'
    for (const [x, hgt, wd] of this.mesas) {
      g.beginPath()
      g.moveTo(x - wd * 1.6, GROUND)
      g.lineTo(x - wd, GROUND - hgt)
      g.lineTo(x + wd, GROUND - hgt)
      g.lineTo(x + wd * 1.6, GROUND)
      g.fill()
    }
    // suelo
    const gr = g.createLinearGradient(0, GROUND, 0, H)
    gr.addColorStop(0, '#5a2a24')
    gr.addColorStop(1, '#1e0c0e')
    g.fillStyle = gr
    g.fillRect(0, GROUND, w.W, H - GROUND)
    g.fillStyle = '#2a1014'
    for (const [x, sc] of this.cacti) cactus(g, x, GROUND + 40, sc)

    // distracciones
    for (const p of this.props) {
      if (p.kind === 'bird') {
        const flap = Math.sin(p.t * 14) * 22
        g.strokeStyle = '#1a0a10'
        g.lineWidth = 7
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(p.x - 34, p.y - flap)
        g.lineTo(p.x, p.y)
        g.lineTo(p.x + 34, p.y - flap)
        g.stroke()
      } else {
        g.save()
        g.translate(p.x, p.y - Math.abs(Math.sin(p.t * 6)) * 50)
        g.rotate(p.t * 8 * Math.sign(p.v))
        g.strokeStyle = '#8a5a2e'
        g.lineWidth = 4
        for (let k = 0; k < 6; k++) {
          g.beginPath()
          g.arc(0, 0, 30 + (k % 3) * 6, k, k + 2.4)
          g.stroke()
        }
        g.restore()
      }
    }

    // vaqueros
    for (let i = 0; i < 2; i++) {
      const a = this.anim
      let pose = 'wait'
      if (a && a.rw === i) pose = 'fire'
      else if (a && a.rw === 1 - i) pose = 'fall'
      cowboy(g, this.cx[i], GROUND + 30, i === 0 ? 1 : -1, COLORS[i], pose, a ? a.t : 0)
    }
    this.fx.render(g)

    // rondas
    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? 200 : w.W - 200
      text(g, names[i], x, 70, { size: 34, color: COLORS[i], weight: 700 })
      for (let k = 0; k < ROUNDS_TO_WIN; k++) {
        g.beginPath()
        g.arc(x + (k - 1) * 46, 122, 15, 0, Math.PI * 2)
        g.fillStyle = k < s.sc[i] ? COLORS[i] : 'rgba(255,255,255,0.15)'
        g.fill()
      }
    }

    // textos según la fase
    if (s.phase === 'ready') {
      seamText(g, w, 'MANOS', 'QUIETAS', 210, { size: 110, font: TITLE, color: '#fff', glow: 20, glowColor: '#ff7a3c', pad: 24 })
      bothText(g, w, `Ronda ${s.round} · dispara cuando salga ¡FUEGO!`, 315, { size: 36, color: '#ffe2c0', weight: 600 })
    }
    const showSignal = this.shownAt && (s.phase === 'wait' || (this.anim && this.anim.t < 0.6))
    if (showSignal) {
      seamText(g, w, '¡FUE', 'GO!', 200, { size: 190, font: TITLE, color: '#fff', glow: 40, glowColor: '#ffd84a', pad: 10 })
    }
    if (this.mine && s.phase === 'wait') {
      text(g, this.mine.foul ? '¡DEMASIADO PRONTO!' : `${this.mine.ms} ms`, w.center[me], 330, { size: 60, font: TITLE, color: this.mine.foul ? '#ff5a5a' : '#fff' })
    }
    if (s.phase === 'result' || s.phase === 'void') {
      for (let i = 0; i < 2; i++) {
        const r = s.res[i]
        const label = r === -1 ? '¡FALTA!' : r == null ? '—' : `${r} ms`
        text(g, label, this.cx[i], GROUND + 150, { size: 54, font: TITLE, color: r === -1 ? '#ff5a5a' : '#fff' })
        const cx = w.center[i]
        if (s.phase === 'void') text(g, s.res[0] === -1 && s.res[1] === -1 ? 'LOS DOS OS ADELANTASTEIS' : 'NADIE HA DISPARADO', cx, 300, { size: 58, font: TITLE, color: '#ffe2c0' })
        else if (s.rw === i) text(g, 'RONDA PARA TI', cx, 300, { size: 80, font: TITLE, color: COLORS[i], glow: 30 })
        else text(g, r === -1 ? 'TE HAS PRECIPITADO' : 'TE HAN DADO', cx, 300, { size: 66, font: TITLE, color: '#c9b3b8' })
      }
    }
    if (this.flash > 0) {
      g.fillStyle = `rgba(255,250,230,${this.flash * 0.55})`
      g.fillRect(0, 0, w.W, H)
    }
  }
}

function cactus(g, x, y, s) {
  g.save()
  g.translate(x, y)
  g.scale(s, s)
  g.fillRect(-18, -260, 36, 260)
  g.fillRect(-80, -170, 26, 90)
  g.fillRect(-80, -100, 70, 26)
  g.fillRect(54, -210, 26, 100)
  g.fillRect(10, -136, 70, 26)
  g.restore()
}

// Vaquero en silueta: dir 1 mira a la derecha, -1 a la izquierda
function cowboy(g, x, y, dir, color, pose, t) {
  g.save()
  g.translate(x, y)
  if (pose === 'fall') {
    const k = Math.min(1, t / 0.7)
    g.translate(-dir * 60 * k, 0)
    g.rotate(-dir * k * 1.45)
  }
  g.scale(dir, 1)
  const ink = '#140810'
  g.fillStyle = ink
  // piernas
  g.fillRect(-34, -150, 26, 150)
  g.fillRect(8, -150, 26, 150)
  // cuerpo
  g.beginPath()
  g.moveTo(-46, -150)
  g.lineTo(-40, -300)
  g.lineTo(40, -300)
  g.lineTo(46, -150)
  g.fill()
  // cinturón y pañuelo de color
  g.fillStyle = color
  g.fillRect(-46, -168, 92, 14)
  g.beginPath()
  g.moveTo(-28, -300)
  g.lineTo(28, -300)
  g.lineTo(0, -270)
  g.fill()
  // cabeza y sombrero
  g.fillStyle = ink
  g.beginPath()
  g.arc(0, -330, 30, 0, Math.PI * 2)
  g.fill()
  g.fillRect(-70, -362, 140, 12)
  g.beginPath()
  g.moveTo(-36, -360)
  g.lineTo(-30, -410)
  g.lineTo(30, -410)
  g.lineTo(36, -360)
  g.fill()
  g.fillStyle = color
  g.fillRect(-33, -378, 66, 9)
  // brazo con el revólver
  g.fillStyle = ink
  if (pose === 'fire') {
    g.save()
    g.translate(30, -280)
    g.rotate(-Math.PI / 2 + Math.min(1, t / 0.08) * (Math.PI / 2 - 0.05))
    g.fillRect(0, -10, 110, 22)
    g.fillRect(100, -16, 44, 14)
    g.fillRect(104, -4, 14, 26)
    g.restore()
  } else {
    g.fillRect(30, -290, 22, 120)
    g.fillRect(36, -180, 30, 50)
  }
  g.fillRect(-52, -290, 22, 120)
  g.restore()
}

export { rgba }
