// Menú compartido: seis tarjetas repartidas entre las dos pantallas.
// Cualquiera de los dos mueve la selección y elige.
import { H, COLORS, makeWorld } from '../config.js'
import { text, seamText, roundRect, glow, rgba, TITLE } from '../draw.js'
import { META, GAMES } from './meta.js'

const ITEMS = [...GAMES, 'tour']
const CARD_W = 440
const CARD_H = 470
const CARD_Y = 300
const CALIB = ITEMS.length

export default class Menu {
  static meta = { countdown: false }
  static lerp = null

  constructor(cfg, api) {
    this.api = api
    this.w = makeWorld(cfg.gap)
    this.s = { sel: cfg.sel ?? 0, back: 0, winner: null }
    this.t = 0
    this.pulse = 0
  }

  cardX(i) {
    const w = this.w
    return i < 3 ? 80 + i * (CARD_W + 60) : w.inner[1] + 80 + (i - 3) * (CARD_W + 60)
  }

  update(dt, pads) {
    const s = this.s
    for (const p of pads) {
      if (s.sel === CALIB) {
        if (p.pressed('up')) {
          s.sel = s.back
          this.api.sfx('tick')
        }
      } else {
        if (p.pressed('left')) {
          s.sel = (s.sel + ITEMS.length - 1) % ITEMS.length
          this.api.sfx('tick', this.cardX(s.sel))
        }
        if (p.pressed('right')) {
          s.sel = (s.sel + 1) % ITEMS.length
          this.api.sfx('tick', this.cardX(s.sel))
        }
        if (p.pressed('down')) {
          s.back = s.sel
          s.sel = CALIB
          this.api.sfx('tick')
        }
      }
      if (p.pressed('a')) {
        this.api.sfx('select')
        if (s.sel === CALIB) this.api.goto('calib')
        else if (ITEMS[s.sel] === 'tour') this.api.startTour()
        else this.api.goto(ITEMS[s.sel])
        return
      }
    }
  }

  local(dt) {
    this.t += dt
  }

  render(g) {
    const w = this.w
    const t = this.t
    const s = this.s

    // Fondo: rejilla que se desliza, continua de una pantalla a otra
    const bg = g.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#0b0820')
    bg.addColorStop(1, '#05040c')
    g.fillStyle = bg
    g.fillRect(0, 0, w.W, H)
    g.strokeStyle = 'rgba(140,120,255,0.07)'
    g.lineWidth = 2
    const off = (t * 25) % 100
    g.beginPath()
    for (let x = -100 + off; x < w.W + 100; x += 100) {
      g.moveTo(x, 0)
      g.lineTo(x - 300, H)
    }
    for (let y = 0; y <= H; y += 100) {
      g.moveTo(0, y)
      g.lineTo(w.W, y)
    }
    g.stroke()
    glow(g, w.inner[0] - 200, 160, 700, COLORS[0], 0.12)
    glow(g, w.inner[1] + 200, 160, 700, COLORS[1], 0.12)

    // Título partido por la costura
    seamText(g, w, 'MITA', 'DES', 150, { size: 170, font: TITLE, colorL: COLORS[0], colorR: COLORS[1], glow: 30, pad: 10 })
    seamText(g, w, 'dos pantallas', 'un solo juego', 245, { size: 34, color: '#b9b3e8', weight: 500, pad: 30 })

    for (let i = 0; i < ITEMS.length; i++) this.card(g, i, s.sel === i)

    // Botón de ajustes, también partido por la costura
    const sel = s.sel === CALIB
    const pw = 460
    g.save()
    roundRect(g, w.mid - pw, 830, pw * 2, 76, 38)
    g.fillStyle = sel ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)'
    g.fill()
    g.lineWidth = sel ? 5 : 2
    g.strokeStyle = sel ? '#fff' : 'rgba(255,255,255,0.25)'
    if (sel) {
      g.shadowColor = '#fff'
      g.shadowBlur = 20
    }
    g.stroke()
    g.restore()
    seamText(g, w, 'AJUSTAR', 'PANTALLAS', 869, { size: 36, color: sel ? '#fff' : '#a9a6c9', weight: 700, pad: 16 })

    // Pistas y nombres abajo
    const names = this.api.cfg.names
    text(g, `◀  ${names[0]}`, 70, 960, { size: 34, align: 'left', color: COLORS[0] })
    text(g, `${names[1]}  ▶`, w.W - 70, 960, { size: 34, align: 'right', color: COLORS[1] })
    text(g, '← →  elegir     ESPACIO  jugar     ↓  ajustes', w.inner[0] - 60, 960, { size: 28, align: 'right', color: '#8c88b5', weight: 500 })
    const rtt = this.api.rtt
    text(g, `F  pantalla completa${rtt ? `     conexión ${Math.round(rtt)} ms` : ''}`, w.inner[1] + 60, 960, { size: 28, align: 'left', color: '#8c88b5', weight: 500 })
  }

  card(g, i, sel) {
    const id = ITEMS[i]
    const m = META[id]
    const x = this.cardX(i)
    const bob = sel ? Math.sin(this.t * 4) * 6 - 10 : 0
    const y = CARD_Y + bob
    g.save()
    if (sel) {
      glow(g, x + CARD_W / 2, y + CARD_H / 2, 420, m.color, 0.25)
    }
    roundRect(g, x, y, CARD_W, CARD_H, 28)
    const bg = g.createLinearGradient(0, y, 0, y + CARD_H)
    bg.addColorStop(0, sel ? rgba(m.color, 0.22) : 'rgba(255,255,255,0.05)')
    bg.addColorStop(1, 'rgba(10,8,30,0.9)')
    g.fillStyle = bg
    g.fill()
    g.lineWidth = sel ? 6 : 2
    g.strokeStyle = sel ? m.color : 'rgba(255,255,255,0.14)'
    if (sel) {
      g.shadowColor = m.color
      g.shadowBlur = 30
    }
    g.stroke()
    g.restore()

    g.save()
    g.translate(x + CARD_W / 2, y + 140)
    ICONS[id](g, m.color, this.t, sel)
    g.restore()

    text(g, m.title, x + CARD_W / 2, y + 300, { size: m.title.length > 8 ? 46 : 58, font: TITLE, color: sel ? '#fff' : '#d8d6f0' })
    text(g, m.tag, x + CARD_W / 2, y + 352, { size: 26, color: m.color, weight: 700 })
    m.desc.forEach((l, k) => text(g, l, x + CARD_W / 2, y + 400 + k * 34, { size: 25, color: '#a9a6c9', weight: 500 }))
  }
}

// Dibujitos de cada tarjeta (centrados en 0,0, unos 200 de ancho)
const ICONS = {
  hockey(g, c, t, sel) {
    g.lineWidth = 6
    g.strokeStyle = 'rgba(255,255,255,0.25)'
    g.beginPath()
    g.arc(0, 0, 90, 0, Math.PI * 2)
    g.stroke()
    const px = sel ? Math.sin(t * 2.2) * 70 : 20
    g.fillStyle = '#fff'
    g.shadowColor = '#fff'
    g.shadowBlur = 20
    g.beginPath()
    g.arc(px, -10, 18, 0, Math.PI * 2)
    g.fill()
    g.shadowBlur = 0
    for (const [mx, col] of [
      [-120, COLORS[0]],
      [120, COLORS[1]],
    ]) {
      g.fillStyle = col
      g.beginPath()
      g.arc(mx, 20, 34, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = 'rgba(0,0,0,0.35)'
      g.beginPath()
      g.arc(mx, 20, 16, 0, Math.PI * 2)
      g.fill()
    }
  },
  volley(g, c, t, sel) {
    g.fillStyle = '#fff'
    g.fillRect(-5, -10, 10, 90)
    const by = sel ? -50 - Math.abs(Math.sin(t * 3)) * 40 : -60
    const bx = sel ? Math.cos(t * 1.5) * 60 : 30
    g.fillStyle = c
    g.shadowColor = c
    g.shadowBlur = 20
    g.beginPath()
    g.arc(bx, by, 20, 0, Math.PI * 2)
    g.fill()
    g.shadowBlur = 0
    for (const [x, col] of [
      [-100, COLORS[0]],
      [100, COLORS[1]],
    ]) {
      g.fillStyle = col
      g.beginPath()
      g.arc(x, 80, 52, Math.PI, 0)
      g.fill()
    }
    g.fillStyle = 'rgba(255,255,255,0.3)'
    g.fillRect(-170, 80, 340, 4)
  },
  trails(g, c, t, sel) {
    const k = sel ? (t * 0.6) % 1 : 0.7
    g.lineCap = 'round'
    g.lineJoin = 'round'
    const paths = [
      [COLORS[0], [[-170, 60], [-60, 60], [-60, -40], [30, -40]]],
      [COLORS[1], [[170, -70], [80, -70], [80, 50], [-10, 50]]],
    ]
    for (const [col, pts] of paths) {
      g.strokeStyle = rgba(col, 0.3)
      g.lineWidth = 18
      g.beginPath()
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
      g.stroke()
      g.strokeStyle = col
      g.lineWidth = 7
      g.stroke()
    }
    g.fillStyle = '#fff'
    g.globalAlpha = 0.5 + 0.5 * Math.sin(k * Math.PI * 2)
    g.beginPath()
    g.arc(30, -40, 10, 0, Math.PI * 2)
    g.arc(-10, 50, 10, 0, Math.PI * 2)
    g.fill()
    g.globalAlpha = 1
  },
  artillery(g, c, t, sel) {
    g.fillStyle = '#1f3b2a'
    g.beginPath()
    g.moveTo(-180, 100)
    g.quadraticCurveTo(0, -60, 180, 100)
    g.fill()
    g.setLineDash([6, 10])
    g.strokeStyle = 'rgba(255,255,255,0.6)'
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(-130, 60)
    g.quadraticCurveTo(0, -200, 130, 60)
    g.stroke()
    g.setLineDash([])
    const k = sel ? (t * 0.5) % 1 : 0.45
    const bx = -130 + 260 * k
    const by = (1 - k) * (1 - k) * 60 + 2 * (1 - k) * k * -200 + k * k * 60
    g.fillStyle = c
    g.shadowColor = c
    g.shadowBlur = 20
    g.beginPath()
    g.arc(bx, by, 10, 0, Math.PI * 2)
    g.fill()
    g.shadowBlur = 0
    for (const [x, col, dir] of [
      [-140, COLORS[0], 1],
      [140, COLORS[1], -1],
    ]) {
      g.fillStyle = col
      g.fillRect(x - 28, 62, 56, 22)
      g.beginPath()
      g.arc(x, 62, 16, Math.PI, 0)
      g.fill()
      g.strokeStyle = col
      g.lineWidth = 6
      g.beginPath()
      g.moveTo(x, 56)
      g.lineTo(x + dir * 30, 30)
      g.stroke()
    }
  },
  duel(g, c, t, sel) {
    g.fillStyle = rgba(c, 0.9)
    g.beginPath()
    g.arc(0, 40, 70, Math.PI, 0)
    g.fill()
    g.fillStyle = '#1a0f12'
    for (const dir of [-1, 1]) {
      const x = dir * 130
      g.fillRect(x - 14, 0, 28, 80)
      g.beginPath()
      g.arc(x, -14, 16, 0, Math.PI * 2)
      g.fill()
      g.fillRect(x - 30, -30, 60, 8)
      g.fillRect(x - 14, -46, 28, 18)
      g.fillRect(x, 20, -dir * 46, 9)
    }
    if (sel && Math.sin(t * 6) > 0.6) text(g, '¡FUEGO!', 0, -60, { size: 40, font: TITLE, color: '#fff' })
  },
  tour(g, c, t, sel) {
    g.fillStyle = c
    g.shadowColor = c
    g.shadowBlur = sel ? 30 : 10
    g.beginPath()
    g.moveTo(-70, -80)
    g.lineTo(70, -80)
    g.quadraticCurveTo(70, 20, 0, 30)
    g.quadraticCurveTo(-70, 20, -70, -80)
    g.fill()
    g.fillRect(-12, 25, 24, 40)
    g.fillRect(-55, 62, 110, 20)
    g.shadowBlur = 0
    g.strokeStyle = c
    g.lineWidth = 10
    g.beginPath()
    g.arc(-70, -45, 28, Math.PI * 0.5, Math.PI * 1.5)
    g.stroke()
    g.beginPath()
    g.arc(70, -45, 28, -Math.PI * 0.5, Math.PI * 0.5)
    g.stroke()
    text(g, '5', 0, -35, { size: 60, font: TITLE, color: '#1a1030' })
  },
}
