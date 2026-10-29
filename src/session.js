// La partida compartida.
// El anfitrión simula todo el mundo a 60 Hz con los mandos de los dos y manda
// una foto del estado en cada tick. El invitado manda su mando y pinta las
// fotos interpoladas, con un pequeño retraso para que el movimiento sea suave.
// Lo que no cabe en una foto (cráteres, giros de estela, sonidos) viaja como
// evento pegado a la foto de su tick, y cada portátil lo aplica a la vez que la ve.
import { TICK_MS, DT, HALF, H, COLORS, makeWorld, shuffle, DEFAULT_GAP } from './config.js'
import { Pad, input } from './input.js'
import { sfx, setAudioSide } from './audio.js'
import { SCENES } from './games/index.js'
import { GAMES } from './games/meta.js'
import { drawOverlays, Overlay } from './overlay.js'

const DELAY_TICKS = 2
const LOST_MS = 3500
const GAP_KEY = 'mitades-separacion'

export function loadGap() {
  const v = Number(localStorage.getItem(GAP_KEY))
  return Number.isFinite(v) && v >= 0 && localStorage.getItem(GAP_KEY) !== null ? v : DEFAULT_GAP
}

function lerpDeep(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return b
    return b.map((v, i) => lerpDeep(a[i], v, t))
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const o = {}
    for (const k in b) o[k] = k in a ? lerpDeep(a[k], b[k], t) : b[k]
    return o
  }
  return t < 0.5 ? a : b
}

export class Session {
  constructor({ link, isHost, side, view, names, code, onLost }) {
    this.isHost = isHost
    this.side = side
    this.view = view
    view.side = side
    this.names = names
    this.code = code
    this.onLost = onLost
    this.gap = isHost ? loadGap() : DEFAULT_GAP
    this.tick = 0
    this.acc = 0
    this.pads = [new Pad(), new Pad()]
    this.localPad = new Pad()
    this.events = []
    this.f = { pause: 0, count: 0, go: 0, over: 0, tour: null, wait: 0 }
    this.buf = []
    this.off = null
    this.rtt = 0
    this.frameNow = performance.now()
    this.overlay = new Overlay()
    this.scene = null
    this.attach(link)
    // Latido con temporizador y no con el bucle de dibujo: si una pestaña
    // deja de pintarse un momento, la conexión no se da por perdida
    this.beat = setInterval(() => this.heartbeat(), 500)
    if (isHost) this.goto('menu')
  }

  heartbeat() {
    if (this.isLost || this.link.closed) return
    const now = performance.now()
    if (now - this.lastPing > 1000) {
      this.lastPing = now
      this.link.send({ t: 'ping', c: now })
    }
    if (now - this.lastRecv > LOST_MS) this.lost()
  }

  attach(link) {
    this.link = link
    this.isLost = false
    this.lastRecv = performance.now()
    this.lastPing = 0
    link.onMessage(m => this.onMsg(m))
    link.onClose(() => this.lost())
  }

  lost() {
    if (this.isLost) return
    this.isLost = true
    if (!this.link.closed) this.link.close?.()
    if (this.isHost) {
      // La sala sigue abierta: el otro puede volver a entrar con el mismo código
      this.f.wait = 1
      this.f.pause = 0
    } else clearInterval(this.beat)
    this.onLost?.()
  }

  // El invitado ha vuelto a entrar
  reattach(link, names) {
    this.names = names
    this.attach(link)
    this.f.wait = 0
    this.f.tour = null
    this.goto('menu')
  }

  // ---------- escenas ----------

  makeApi(cfg) {
    const s = this
    return {
      isHost: s.isHost,
      side: s.side,
      cfg,
      view: s.view,
      emit(ev) {
        if (!s.isHost) return
        s.events.push(ev)
        s.applyEvent(ev)
      },
      sfx(name, x) {
        this.emit({ sfx: name, x })
      },
      send(m) {
        if (s.isHost) s.scene.onMessage?.(m, s.side)
        else s.link.send({ t: 'msg', m })
      },
      goto: (id, extra) => s.isHost && s.goto(id, extra),
      startTour: () => s.isHost && s.startTour(),
      setGap: g => s.isHost && s.setGap(g),
      swapSides: () => s.isHost && s.swapSides(),
      now: () => s.frameNow,
      pressTime: btn => input.lastPress(btn),
      localSfx: (name, x) => sfx(name, x),
      get f() {
        return s.f
      },
      get rtt() {
        return s.rtt
      },
    }
  }

  applyEvent(ev) {
    if (ev.sfx) sfx(ev.sfx, ev.x)
    else this.scene?.onEvent?.(ev)
  }

  goto(id, extra = {}) {
    const tour = this.f.tour
    const cfg = {
      id,
      gap: this.gap,
      seed: Math.floor(Math.random() * 2 ** 31),
      names: this.names,
      tour: tour ? { i: tour.i, n: tour.list.length, wins: tour.wins, next: tour.list[tour.i + 1] || null } : null,
      ...extra,
    }
    this.startScene(cfg)
    this.link.send({ t: 'scene', cfg })
  }

  startScene(cfg) {
    const Cls = SCENES[cfg.id]
    this.Cls = Cls
    this.cfg = cfg
    this.names = cfg.names
    this.world = makeWorld(cfg.gap)
    this.view.gap = cfg.gap
    setAudioSide(this.side, cfg.gap)
    this.api = this.makeApi(cfg)
    this.scene = new Cls(cfg, this.api)
    this.sceneId = cfg.id
    if (this.isHost) {
      this.f.count = Cls.meta?.countdown ? 240 : 0
      this.f.go = 0
      this.f.pause = 0
      this.f.over = 0
    }
    for (const p of this.pads) p.sync()
    this.localPad.sync()
    this.buf = []
    this.overlay.reset()
  }

  startTour() {
    this.f.tour = { list: shuffle(GAMES), i: 0, wins: [0, 0] }
    this.goto(this.f.tour.list[0])
  }

  afterGame(winner) {
    const tour = this.f.tour
    if (!tour) return this.goto('menu', { sel: GAMES.indexOf(this.sceneId) })
    if (winner === 0 || winner === 1) tour.wins[winner]++
    tour.i++
    if (tour.i < tour.list.length) this.goto(tour.list[tour.i])
    else {
      const wins = tour.wins
      this.f.tour = null
      this.goto('podium', { wins })
    }
  }

  quitToMenu() {
    this.f.tour = null
    this.goto('menu', { sel: Math.max(0, GAMES.indexOf(this.sceneId)) })
  }

  setGap(g) {
    this.gap = g
    try {
      localStorage.setItem(GAP_KEY, String(g))
    } catch {}
  }

  swapSides() {
    this.side = 1 - this.side
    this.view.side = this.side
    this.names = [this.names[1], this.names[0]]
    this.pads.reverse()
    this.link.send({ t: 'swap' })
    this.goto('calib')
  }

  // ---------- red ----------

  onMsg(m) {
    this.lastRecv = performance.now()
    switch (m.t) {
      case 's':
        if (!this.isHost) this.onSnap(m)
        break
      case 'scene':
        if (!this.isHost) {
          // Lo que quedaba pendiente de la escena anterior se aplica ya
          for (const b of this.buf) if (!b.done) for (const ev of b.ev) if (!ev.sfx) this.applyEvent(ev)
          this.startScene(m.cfg)
        }
        break
      case 'in':
        if (this.isHost) this.pads[1 - this.side].set(m.i)
        break
      case 'msg':
        if (this.isHost) this.scene?.onMessage?.(m.m, 1 - this.side)
        break
      case 'swap':
        this.side = 1 - this.side
        this.view.side = this.side
        break
      case 'ping':
        this.link.send({ t: 'pong', c: m.c })
        break
      case 'pong':
        this.rtt = performance.now() - m.c
        break
    }
  }

  onSnap(m) {
    const now = performance.now()
    const sample = now - m.k * TICK_MS
    if (this.off == null || sample < this.off) this.off = sample
    this.buf.push(m)
    // Pestaña dormida o similar: no dejar que crezca sin fin
    while (this.buf.length > 240) {
      const b = this.buf.shift()
      if (!b.done) for (const ev of b.ev) if (!ev.sfx) this.applyEvent(ev)
    }
  }

  // ---------- bucle ----------

  frame(now) {
    const dt = Math.max(0, Math.min(100, now - (this.last ?? now)))
    this.last = Math.max(now, this.last ?? now)
    this.frameNow = now
    this.myRaw = input.snapshot(this.view)
    this.localPad.set(this.myRaw)
    this.localPad.step()

    if (this.isHost) {
      this.acc += dt
      let n = 0
      while (this.acc >= TICK_MS && n < 5) {
        this.hostTick()
        this.acc -= TICK_MS
        n++
      }
      if (n === 5) this.acc = 0
    } else {
      this.sendInput(now)
      this.guestFrame(now, dt)
    }

    if (this.scene) this.scene.local?.(dt / 1000, this.localPad, this.f)
    this.overlay.update(dt / 1000, this)

    this.render()
  }

  sendInput(now) {
    const str = JSON.stringify(this.myRaw)
    if (str !== this.lastSent || now - (this.lastSentT || 0) > 200) {
      this.link.send({ t: 'in', i: this.myRaw })
      this.lastSent = str
      this.lastSentT = now
    }
  }

  anyPressed(btn) {
    return this.pads[0].pressed(btn) || this.pads[1].pressed(btn)
  }

  hostTick() {
    this.tick++
    this.pads[this.side].set(this.myRaw)
    for (const p of this.pads) p.step()
    const f = this.f
    const sc = this.scene
    const overable = this.sceneId !== 'menu' && this.sceneId !== 'calib' && this.sceneId !== 'podium'

    if (f.wait) {
      // esperando a que vuelva el otro portátil
    } else if (f.pause) {
      if (this.anyPressed('a')) f.pause = 0
      else if (this.anyPressed('menu')) this.quitToMenu()
    } else if (sc.s.winner != null && overable) {
      if (f.over === 0) this.api.sfx('win')
      f.over++
      if (f.over > 70 && this.anyPressed('a')) this.afterGame(sc.s.winner)
    } else if (overable && this.anyPressed('menu')) {
      f.pause = 1
    } else if (f.count > 0) {
      if (f.count === 180 || f.count === 120 || f.count === 60) this.api.sfx('count')
      f.count--
      if (f.count === 0) {
        f.go = 45
        this.api.sfx('go')
      }
    } else {
      if (f.go > 0) f.go--
      sc.update(DT, this.pads)
    }

    this.link.send({ t: 's', k: this.tick, s: this.scene.s, ev: this.events, f: this.f })
    this.events = []
  }

  guestFrame(now, dt) {
    if (this.off == null || !this.buf.length) return
    this.off += dt * 0.004
    const rt = (now - this.off) / TICK_MS - DELAY_TICKS
    const buf = this.buf
    let applied = 0
    for (const b of buf) {
      if (b.k > rt) break
      if (!b.done) {
        b.done = true
        // Si nos hemos quedado muy atrás (pestaña oculta), sin ráfaga de sonidos
        for (const ev of b.ev) if (!(ev.sfx && applied > 6)) this.applyEvent(ev)
        applied++
      }
    }
    while (buf.length >= 2 && buf[1].k <= rt) buf.shift()
    const a = buf[0]
    const b = buf[1]
    let s = a.s
    if (b && a.k <= rt) {
      const t = (rt - a.k) / (b.k - a.k)
      const keys = this.Cls.lerp
      if (keys && a.s.cut === b.s.cut) {
        s = { ...a.s }
        for (const k of keys) s[k] = lerpDeep(a.s[k], b.s[k], t)
      }
    }
    this.scene.s = s
    this.f = a.f
  }

  render() {
    const v = this.view
    const g = v.g
    if (this.scene?.s?.gap != null) v.gap = this.scene.s.gap
    v.update()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.fillStyle = '#000'
    g.fillRect(0, 0, v.canvas.width, v.canvas.height)
    if (!this.scene) return
    v.apply(g)
    g.save()
    g.beginPath()
    g.rect(v.x0, 0, HALF, H)
    g.clip()
    this.scene.render(g, v)
    drawOverlays(g, this)
    g.restore()
  }
}

export { COLORS }
