// Ajuste de pantallas: con los portátiles juntos, las líneas tienen que
// seguir rectas al pasar de una pantalla a otra.
// La separación (los marcos) es compartida; el tamaño y la altura son de cada portátil.
import { H, COLORS, makeWorld, clamp } from '../config.js'
import { text, seamText, roundRect, TITLE } from '../draw.js'

export default class Calib {
  static meta = { countdown: false }
  static lerp = null

  constructor(cfg, api) {
    this.api = api
    this.gap = cfg.gap
    this.s = { gap: cfg.gap, winner: null }
    this.saveT = 0
  }

  update(dt, pads) {
    let dx = 0
    for (const p of pads) dx += p.x
    if (dx) {
      this.gap = clamp(this.gap + dx * 70 * dt, 0, 400)
      this.s.gap = Math.round(this.gap)
    }
    for (const p of pads) {
      if (p.pressed('b')) return this.api.swapSides()
      if (p.pressed('a') || p.pressed('menu')) {
        this.api.setGap(this.s.gap)
        this.api.sfx('select')
        return this.api.goto('menu', { sel: 6, gap: this.s.gap })
      }
    }
  }

  // Tamaño y altura de MI pantalla (no se comparten)
  local(dt, pad) {
    const cal = this.api.view.cal
    let changed = false
    const dy = pad.held('down') - pad.held('up')
    if (dy) {
      cal.dy = clamp(cal.dy + dy * 90 * dt, -300, 300)
      changed = true
    }
    const ds = pad.held('plus') - pad.held('minus')
    if (ds) {
      cal.scale = clamp(cal.scale + ds * 0.12 * dt, 0.5, 1)
      changed = true
    }
    if (changed) {
      this.saveT -= dt
      if (this.saveT <= 0) {
        this.api.view.saveCal()
        this.saveT = 0.3
      }
    }
  }

  render(g) {
    const w = makeWorld(this.s.gap)
    const side = this.api.side
    g.fillStyle = '#04040a'
    g.fillRect(0, 0, w.W, H)

    // Rejilla de 100 en 100 (en el mundo, así que salta los marcos)
    g.lineWidth = 2
    g.strokeStyle = 'rgba(255,255,255,0.09)'
    g.beginPath()
    for (let x = 0; x <= w.W; x += 100) {
      g.moveTo(x, 0)
      g.lineTo(x, H)
    }
    for (let y = 0; y <= H; y += 100) {
      g.moveTo(0, y)
      g.lineTo(w.W, y)
    }
    g.stroke()

    // Diagonales y círculos que cruzan la costura
    g.lineWidth = 10
    g.lineCap = 'round'
    g.strokeStyle = COLORS[0]
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(w.W, H)
    g.stroke()
    g.strokeStyle = COLORS[1]
    g.beginPath()
    g.moveTo(0, H)
    g.lineTo(w.W, 0)
    g.stroke()
    g.strokeStyle = '#ffd84a'
    for (const r of [140, 300, 460]) {
      g.beginPath()
      g.arc(w.mid, H / 2, r, 0, Math.PI * 2)
      g.stroke()
    }
    g.strokeStyle = 'rgba(255,255,255,0.7)'
    g.lineWidth = 6
    for (const y of [60, 940]) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(w.W, y)
      g.stroke()
    }

    // Panel de MI pantalla
    const cal = this.api.view.cal
    const cx = w.center[side]
    const px = side === 0 ? cx - 380 : cx + 380
    g.save()
    roundRect(g, px - 250, 260, 500 + 0, 480, 30)
    g.fillStyle = 'rgba(6,6,18,0.88)'
    g.fill()
    g.lineWidth = 3
    g.strokeStyle = COLORS[side]
    g.stroke()
    g.restore()
    const lx = px
    text(g, 'ESTE PORTÁTIL', lx, 310, { size: 34, font: TITLE, color: COLORS[side] })
    text(g, `↑ ↓  altura   ${Math.round(cal.dy)}`, lx, 390, { size: 32, color: '#fff', weight: 600 })
    text(g, `+ −  tamaño   ${Math.round(cal.scale * 100)} %`, lx, 445, { size: 32, color: '#fff', weight: 600 })
    text(g, 'LOS DOS', lx, 530, { size: 30, font: TITLE, color: '#ffd84a' })
    text(g, `← →  marcos   ${this.s.gap}`, lx, 590, { size: 32, color: '#fff', weight: 600 })
    text(g, 'X  cambiar de lado', lx, 645, { size: 28, color: '#b9b6d9', weight: 500 })
    text(g, 'ESPACIO  listo', lx, 700, { size: 28, color: '#b9b6d9', weight: 500 })

    seamText(g, w, 'AJUSTAR', 'PANTALLAS', 170, { size: 64, font: TITLE, color: '#fff', pad: 20 })
    text(g, 'Juntad los portátiles: las líneas tienen que seguir rectas', w.inner[0] - 30, 830, { size: 28, align: 'right', color: '#d0cde8', weight: 500 })
    text(g, 'de una pantalla a otra. El más grande, que baje su tamaño.', w.inner[1] + 30, 830, { size: 28, align: 'left', color: '#d0cde8', weight: 500 })
  }
}
