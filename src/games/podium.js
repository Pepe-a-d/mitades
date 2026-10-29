// Resultado final del torneo
import { H, COLORS, makeWorld } from '../config.js'
import { text, seamText, bothText, glow, TITLE } from '../draw.js'

export default class Podium {
  static meta = { countdown: false }
  static lerp = null

  constructor(cfg, api) {
    this.api = api
    this.w = makeWorld(cfg.gap)
    const [a, b] = cfg.wins
    this.wins = cfg.wins
    this.s = { winner: a === b ? -1 : a > b ? 0 : 1 }
    this.ticks = 0
    this.t = 0
  }

  update(dt, pads) {
    this.ticks++
    if (this.ticks > 90 && (pads[0].pressed('a') || pads[1].pressed('a'))) this.api.goto('menu', { sel: 5 })
  }

  local(dt) {
    this.t += dt
  }

  render(g) {
    const w = this.w
    const names = this.api.cfg.names
    const win = this.s.winner
    const bg = g.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#120a2a')
    bg.addColorStop(1, '#05040c')
    g.fillStyle = bg
    g.fillRect(0, 0, w.W, H)
    // focos
    for (let i = 0; i < 2; i++) {
      const on = win === i || win === -1
      glow(g, w.center[i], 420, 650, COLORS[i], on ? 0.35 + 0.1 * Math.sin(this.t * 3) : 0.06)
    }
    seamText(g, w, 'TOR', 'NEO', 130, { size: 110, font: TITLE, color: '#c58bff', glow: 20 })
    for (let i = 0; i < 2; i++) {
      const cx = w.center[i]
      if (win === i) {
        trophy(g, cx, 420, COLORS[i], this.t)
        text(g, 'CAMPEÓN', cx, 640, { size: 110, font: TITLE, color: COLORS[i], glow: 30 })
        text(g, names[i], cx, 740, { size: 64, color: '#fff' })
      } else if (win === -1) {
        trophy(g, cx, 420, COLORS[i], this.t)
        text(g, 'EMPATE', cx, 640, { size: 110, font: TITLE, color: '#fff' })
        text(g, names[i], cx, 740, { size: 64, color: COLORS[i] })
      } else {
        text(g, 'SUBCAMPEÓN', cx, 520, { size: 90, font: TITLE, color: '#8a8fb3' })
        text(g, names[i], cx, 620, { size: 60, color: '#8a8fb3' })
      }
    }
    seamText(g, w, `${this.wins[0]}  –`, `  ${this.wins[1]}`, 860, { size: 100, font: TITLE, colorL: COLORS[0], colorR: COLORS[1], pad: 0 })
    if (this.ticks > 90 || !this.api.isHost) bothText(g, w, 'ESPACIO  volver al menú', 960, { size: 34, color: '#b9b3e8', weight: 600, alpha: 0.6 + 0.4 * Math.sin(this.t * 4) })
  }
}

function trophy(g, x, y, c, t) {
  g.save()
  g.translate(x, y + Math.sin(t * 2) * 8)
  g.fillStyle = c
  g.shadowColor = c
  g.shadowBlur = 40
  g.beginPath()
  g.moveTo(-110, -130)
  g.lineTo(110, -130)
  g.quadraticCurveTo(110, 30, 0, 45)
  g.quadraticCurveTo(-110, 30, -110, -130)
  g.fill()
  g.fillRect(-18, 40, 36, 60)
  g.fillRect(-80, 95, 160, 30)
  g.shadowBlur = 0
  g.strokeStyle = c
  g.lineWidth = 16
  g.beginPath()
  g.arc(-110, -75, 44, Math.PI * 0.5, Math.PI * 1.5)
  g.stroke()
  g.beginPath()
  g.arc(110, -75, 44, -Math.PI * 0.5, Math.PI * 0.5)
  g.stroke()
  g.fillStyle = 'rgba(255,255,255,0.35)'
  g.fillRect(-70, -115, 22, 90)
  g.restore()
}
