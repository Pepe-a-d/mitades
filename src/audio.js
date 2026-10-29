// Sonidos sintetizados (sin archivos). Cada portátil suena más fuerte cuando
// lo que pasa está en su mitad: con los dos juntos, el sonido "viaja".
import { HALF } from './config.js'

let ac = null
let master = null
let noiseBuf = null
let side = 0
let gap = 80

export function unlockAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ac = new AC()
    master = ac.createGain()
    master.gain.value = 0.45
    const comp = ac.createDynamicsCompressor()
    master.connect(comp)
    comp.connect(ac.destination)
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  if (ac.state === 'suspended') ac.resume()
}

export function setAudioSide(s, g) {
  side = s
  gap = g
}

function out(vol, pan) {
  const g = ac.createGain()
  g.gain.value = vol
  if (ac.createStereoPanner) {
    const p = ac.createStereoPanner()
    p.pan.value = pan
    g.connect(p)
    p.connect(master)
  } else g.connect(master)
  return g
}

function tone(freq, dur, { type = 'square', vol = 0.3, to = null, delay = 0, attack = 0.005, dest }) {
  const t = ac.currentTime + delay
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + dur)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g)
  g.connect(dest)
  o.start(t)
  o.stop(t + dur + 0.05)
}

function noise(dur, { vol = 0.3, freq = 1000, q = 0.8, kind = 'lowpass', delay = 0, to = null, dest }) {
  const t = ac.currentTime + delay
  const s = ac.createBufferSource()
  s.buffer = noiseBuf
  s.loop = true
  const f = ac.createBiquadFilter()
  f.type = kind
  f.frequency.setValueAtTime(freq, t)
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur)
  f.Q.value = q
  const g = ac.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(f)
  f.connect(g)
  g.connect(dest)
  s.start(t, Math.random() * 0.5)
  s.stop(t + dur + 0.05)
}

const SOUNDS = {
  tick: d => tone(880, 0.04, { type: 'triangle', vol: 0.25, dest: d }),
  select: d => {
    tone(660, 0.08, { type: 'square', vol: 0.18, dest: d })
    tone(990, 0.14, { type: 'square', vol: 0.18, delay: 0.07, dest: d })
  },
  count: d => tone(440, 0.16, { type: 'square', vol: 0.22, dest: d }),
  go: d => tone(880, 0.4, { type: 'square', vol: 0.25, dest: d }),
  hit: d => {
    tone(420, 0.09, { type: 'triangle', vol: 0.5, to: 220, dest: d })
    noise(0.04, { vol: 0.3, freq: 3000, kind: 'bandpass', dest: d })
  },
  wall: d => tone(240, 0.06, { type: 'square', vol: 0.12, to: 180, dest: d }),
  goal: d => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, { type: 'square', vol: 0.2, delay: i * 0.08, dest: d })),
  point: d => {
    tone(700, 0.1, { type: 'square', vol: 0.2, dest: d })
    tone(1050, 0.2, { type: 'square', vol: 0.2, delay: 0.09, dest: d })
  },
  jump: d => tone(300, 0.12, { type: 'square', vol: 0.12, to: 620, dest: d }),
  bounce: d => tone(200, 0.1, { type: 'sine', vol: 0.5, to: 120, dest: d }),
  shoot: d => {
    noise(0.25, { vol: 0.5, freq: 1400, to: 300, dest: d })
    tone(140, 0.2, { type: 'sine', vol: 0.5, to: 50, dest: d })
  },
  boom: d => {
    noise(0.9, { vol: 0.9, freq: 900, to: 120, dest: d })
    tone(90, 0.7, { type: 'sine', vol: 0.7, to: 28, dest: d })
  },
  bigboom: d => {
    noise(1.5, { vol: 1, freq: 700, to: 60, dest: d })
    tone(70, 1.2, { type: 'sine', vol: 0.9, to: 20, dest: d })
  },
  die: d => {
    tone(620, 0.5, { type: 'sawtooth', vol: 0.2, to: 60, dest: d })
    noise(0.4, { vol: 0.35, freq: 2000, to: 200, dest: d })
  },
  boost: d => noise(0.35, { vol: 0.25, freq: 600, to: 3000, kind: 'bandpass', q: 3, dest: d }),
  bell: d => {
    tone(1318, 1.4, { type: 'sine', vol: 0.5, dest: d })
    tone(2636, 0.9, { type: 'sine', vol: 0.2, dest: d })
    tone(1975, 1.1, { type: 'triangle', vol: 0.12, dest: d })
  },
  bang: d => {
    noise(0.35, { vol: 1, freq: 2500, to: 400, dest: d })
    tone(160, 0.25, { type: 'sine', vol: 0.8, to: 40, dest: d })
  },
  heart: d => {
    tone(60, 0.12, { type: 'sine', vol: 0.6, dest: d })
    tone(55, 0.12, { type: 'sine', vol: 0.5, delay: 0.16, dest: d })
  },
  caw: d => {
    tone(900, 0.18, { type: 'sawtooth', vol: 0.12, to: 500, dest: d })
    tone(850, 0.2, { type: 'sawtooth', vol: 0.12, to: 450, delay: 0.25, dest: d })
  },
  hic: d => tone(500, 0.12, { type: 'triangle', vol: 0.3, to: 1100, dest: d }),
  foul: d => tone(200, 0.5, { type: 'sawtooth', vol: 0.25, to: 90, dest: d }),
  win: d => {
    const n = [523, 659, 784, 1046, 784, 1046, 1318]
    n.forEach((f, i) => tone(f, i === n.length - 1 ? 0.6 : 0.14, { type: 'square', vol: 0.2, delay: i * 0.11, dest: d }))
  },
  lose: d => [392, 349, 311, 262].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.25, delay: i * 0.18, dest: d })),
  whoosh: d => noise(0.5, { vol: 0.3, freq: 300, to: 2000, kind: 'bandpass', q: 2, dest: d }),
}

export function sfx(name, x) {
  if (!ac || !SOUNDS[name]) return
  let vol = 1
  let pan = 0
  if (x != null) {
    const x0 = side === 0 ? 0 : HALF + gap
    const u = (x - x0) / HALF
    if (u < 0 || u > 1) {
      const far = u < 0 ? -u : u - 1
      vol = Math.max(0.12, 0.45 - far * 0.5)
      pan = u < 0 ? -0.9 : 0.9
    } else pan = (u * 2 - 1) * 0.7
  }
  SOUNDS[name](out(vol, pan))
}
