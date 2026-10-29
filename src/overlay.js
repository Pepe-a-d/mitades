// Capas comunes a todos los minijuegos: cuenta atrás, pausa, fin de partida
// y espera de reconexión. Se pintan encima, en coordenadas del mundo.
import { COLORS } from './config.js'
import { text, seamText, bothText, dim, Confetti, TITLE, rgba } from './draw.js'
import { META } from './games/meta.js'

export class Overlay {
  constructor() {
    this.confetti = new Confetti()
    this.reset()
  }
  reset() {
    this.confetti.list = []
    this.celebrated = false
    this.t = 0
  }
  update(dt, ses) {
    this.t += dt
    const w = ses.world
    const winner = ses.scene?.s?.winner
    const overable = !['menu', 'calib'].includes(ses.sceneId)
    if (overable && (winner === 0 || winner === 1) && !this.celebrated) {
      this.celebrated = true
      this.confetti.rain(w.x0[winner], w.x0[winner] + w.HALF, [COLORS[winner], '#ffffff', '#ffd84a'], ses.sceneId === 'podium' ? 260 : 160)
    }
    this.confetti.update(dt)
  }
}

export function drawOverlays(g, ses) {
  const f = ses.f
  const w = ses.world
  const ov = ses.overlay
  const id = ses.sceneId
  const names = ses.names
  ov.confetti.render(g)
  const blink = Math.sin(ov.t * 5) > -0.2

  if (f.wait) {
    dim(g, w, 0.82)
    seamText(g, w, 'ESPE', 'RANDO', 380, { size: 120, font: TITLE, colorL: COLORS[0], colorR: COLORS[1] })
    bothText(g, w, 'El otro portátil se ha desconectado.', 520, { size: 40, color: '#cfd3ff', weight: 500 })
    bothText(g, w, 'Que vuelva a entrar con el código', 590, { size: 40, color: '#cfd3ff', weight: 500 })
    bothText(g, w, ses.code || '', 720, { size: 110, font: TITLE, color: '#fff' })
    return
  }

  const meta = META[id]
  if (f.count > 0 && meta) {
    dim(g, w, 0.55)
    seamText(g, w, meta.split[0], meta.split[1], 200, { size: 150, font: TITLE, color: meta.color, glow: 30 })
    const tour = ses.cfg.tour
    if (tour) bothText(g, w, `TORNEO · JUEGO ${tour.i + 1} DE ${tour.n}`, 320, { size: 34, color: '#c58bff', weight: 600 })
    meta.how.forEach((line, i) => bothText(g, w, line, 400 + i * 58, { size: 38, color: '#e8eaff', weight: 500 }))
    if (f.count <= 180) {
      const n = Math.ceil(f.count / 60)
      const k = (f.count % 60) / 60
      bothText(g, w, String(n), 760, { size: 200 + k * 60, font: TITLE, color: '#fff', alpha: 0.4 + k * 0.6, glow: 40, glowColor: meta.color })
    } else {
      bothText(g, w, 'Preparados…', 760, { size: 60, color: '#ffffff99', weight: 600 })
    }
    return
  }
  if (f.go > 0 && meta) {
    const a = f.go / 45
    bothText(g, w, '¡YA!', 500, { size: 220 + (1 - a) * 120, font: TITLE, color: '#fff', alpha: a, glow: 40, glowColor: meta.color })
  }

  if (f.pause) {
    dim(g, w, 0.7)
    seamText(g, w, 'PAU', 'SA', 400, { size: 170, font: TITLE, color: '#fff' })
    bothText(g, w, 'ESPACIO  seguir jugando', 600, { size: 44, color: '#e8eaff', weight: 600 })
    bothText(g, w, 'Q  salir al menú', 670, { size: 44, color: '#e8eaff', weight: 600 })
    return
  }

  const s = ses.scene?.s
  if (id === 'podium' || !s || s.winner == null || id === 'menu' || id === 'calib') return
  dim(g, w, 0.55)
  const win = s.winner
  for (let i = 0; i < 2; i++) {
    const cx = w.center[i]
    if (win === -1) {
      text(g, 'EMPATE', cx, 380, { size: 150, font: TITLE, color: '#fff' })
    } else if (win === i) {
      text(g, '¡VICTORIA!', cx, 360, { size: 150, font: TITLE, color: COLORS[i], glow: 40 })
      text(g, names[i], cx, 480, { size: 70, color: '#fff', weight: 700 })
    } else {
      text(g, 'DERROTA', cx, 360, { size: 130, font: TITLE, color: '#8a8fb3' })
      text(g, names[i], cx, 480, { size: 60, color: '#8a8fb3', weight: 600 })
    }
  }
  if (Array.isArray(s.sc)) {
    seamText(g, w, `${s.sc[0]}  –`, `  ${s.sc[1]}`, 640, { size: 110, font: TITLE, colorL: COLORS[0], colorR: COLORS[1], pad: 0 })
  }
  const tour = ses.cfg.tour
  if (tour) {
    const wins = tour.wins.slice()
    if (win === 0 || win === 1) wins[win]++
    bothText(g, w, `TORNEO  ${wins[0]} – ${wins[1]}`, 770, { size: 46, color: '#c58bff', weight: 700 })
  }
  if (f.over > 70 && blink) {
    const next = tour ? (tour.next ? `ESPACIO  siguiente: ${META[tour.next].title}` : 'ESPACIO  resultado del torneo') : 'ESPACIO  volver al menú'
    bothText(g, w, next, 880, { size: 42, color: '#fff', weight: 600 })
  }
}

export { rgba }
