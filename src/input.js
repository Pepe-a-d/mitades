// Teclado y ratón de ESTE portátil. Cada jugador usa el suyo, así que los dos
// usan las mismas teclas (flechas o WASD, espacio...).
export const BUTTONS = ['left', 'right', 'up', 'down', 'a', 'b', 'menu', 'plus', 'minus']
const IDX = Object.fromEntries(BUTTONS.map((b, i) => [b, i]))

const CODES = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'a',
  Enter: 'a',
  NumpadEnter: 'a',
  KeyX: 'b',
  KeyZ: 'b',
  ShiftLeft: 'b',
  ShiftRight: 'b',
  KeyQ: 'menu',
  Backspace: 'menu',
  Escape: 'menu',
  NumpadAdd: 'plus',
  NumpadSubtract: 'minus',
}
// + y − dependen de la distribución del teclado: mejor por el carácter
const KEYS = { '+': 'plus', '=': 'plus', '-': 'minus', _: 'minus' }

const held = new Set()
const counts = BUTTONS.map(() => 0)
const pressTime = BUTTONS.map(() => 0)
let mouse = null
let mouseT = -1e9
let mouseDown = false
const keyListeners = []

function down(btn, time) {
  if (held.has(btn)) return
  held.add(btn)
  counts[IDX[btn]]++
  pressTime[IDX[btn]] = time
}
function up(btn) {
  held.delete(btn)
}

const typing = e => {
  const t = e.target
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}

function handleKey(code, key, isDown, time, e) {
  const btn = CODES[code] || KEYS[key]
  if (isDown) for (const fn of keyListeners) fn(code, key)
  if (!btn) return false
  if (isDown) down(btn, time)
  else up(btn)
  return true
}

addEventListener('keydown', e => {
  if (typing(e) || e.metaKey || e.ctrlKey) return
  if (e.repeat) {
    if (CODES[e.code] || KEYS[e.key]) e.preventDefault()
    return
  }
  // timeStamp es más preciso, pero algún navegador antiguo lo da en otra escala
  const now = performance.now()
  const t = Math.abs(e.timeStamp - now) < 2000 ? e.timeStamp : now
  if (handleKey(e.code, e.key, true, t, e)) e.preventDefault()
})
addEventListener('keyup', e => {
  handleKey(e.code, e.key, false, e.timeStamp, e)
})
addEventListener('blur', () => held.clear())

// La página de prueba (dos pantallas en una ventana) reenvía teclas a cada mitad
addEventListener('message', e => {
  const m = e.data
  if (m && m.mitadesKey) handleKey(m.mitadesKey, m.key, m.down, performance.now())
})

export function bindPointer(el) {
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect()
    mouse = { x: e.clientX - r.left, y: e.clientY - r.top }
    mouseT = performance.now()
  })
  el.addEventListener('pointerdown', () => {
    mouseDown = true
    mouseT = performance.now()
  })
  addEventListener('pointerup', () => (mouseDown = false))
  el.addEventListener('pointerleave', () => (mouseT = -1e9))
}

export const input = {
  onKey(fn) {
    keyListeners.push(fn)
  },
  // Estado compacto para mandarlo por la red
  snapshot(view) {
    let h = 0
    for (const b of held) h |= 1 << IDX[b]
    const now = performance.now()
    let m = null
    if (mouse && now - mouseT < 3000) {
      const [x, y] = view.toWorld(mouse.x, mouse.y)
      m = [Math.round(x), Math.round(y)]
    }
    return { h, c: counts.slice(), m, md: mouseDown ? 1 : 0 }
  },
  lastPress(btn) {
    return pressTime[IDX[btn]]
  },
  // Para las pruebas automáticas
  press(btn, ms = 80) {
    down(btn, performance.now())
    setTimeout(() => up(btn), ms)
  },
  hold(btn, on) {
    if (on) down(btn, performance.now())
    else up(btn)
  },
  setMouse(x, y) {
    mouse = { x, y }
    mouseT = performance.now()
  },
}

// Mando de un jugador visto desde el anfitrión, que es quien simula.
// "pressed" compara contadores entre ticks, así no se pierde ninguna pulsación.
export class Pad {
  constructor() {
    this.raw = { h: 0, c: BUTTONS.map(() => 0), m: null, md: 0 }
    this.cur = this.raw.c.slice()
    this.prev = this.cur.slice()
  }
  set(raw) {
    if (raw) this.raw = raw
  }
  step() {
    this.prev = this.cur
    this.cur = this.raw.c.slice()
  }
  sync() {
    this.cur = this.raw.c.slice()
    this.prev = this.cur.slice()
  }
  held(b) {
    return (this.raw.h >> IDX[b]) & 1
  }
  pressed(b) {
    return this.cur[IDX[b]] > this.prev[IDX[b]]
  }
  get x() {
    return this.held('right') - this.held('left')
  }
  get y() {
    return this.held('down') - this.held('up')
  }
  get mouse() {
    return this.raw.m
  }
}
