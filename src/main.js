// Arranque: sala de espera, conexión entre los dos portátiles y bucle de dibujo
import './style.css'
import { View } from './view.js'
import { input, bindPointer } from './input.js'
import { unlockAudio } from './audio.js'
import { Session } from './session.js'
import { hostOnline, joinOnline, hostLocal, joinLocal, randomCode } from './net.js'

const params = new URLSearchParams(location.search)
// ?local=CÓDIGO usa BroadcastChannel (dos pestañas del mismo navegador)
const localMode = params.has('local')
const inFrame = window !== window.top
const $ = id => document.getElementById(id)

const canvas = $('c')
const view = new View(canvas)
bindPointer(canvas)

const lobby = $('lobby')
const status = $('status')
const nameInput = $('name')
const codeInput = $('code')

let session = null
let room = null
let hostSide = 0
let code = ''

nameInput.value = params.get('nombre') || localStorage.getItem('mitades-nombre') || ''
if (params.get('sala')) codeInput.value = params.get('sala').toUpperCase().slice(0, 4)

const cleanName = n =>
  String(n || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12)
    .toUpperCase()

function myName(fallback) {
  const n = cleanName(nameInput.value)
  try {
    localStorage.setItem('mitades-nombre', nameInput.value.trim())
  } catch {}
  return n || fallback
}

function say(msg, error = false) {
  status.textContent = msg
  status.classList.toggle('error', error)
}

function fullscreen(on = true) {
  if (inFrame) return
  const el = document.documentElement
  const isFs = document.fullscreenElement || document.webkitFullscreenElement
  if (on && !isFs) {
    const req = el.requestFullscreen || el.webkitRequestFullscreen
    try {
      const p = req?.call(el)
      p?.catch?.(() => {})
    } catch {}
  } else if (!on && isFs) {
    ;(document.exitFullscreen || document.webkitExitFullscreen)?.call(document)
  }
}

function closeRoom() {
  room?.close()
  room = null
}

// ---------- anfitrión ----------

function createRoom() {
  unlockAudio()
  fullscreen()
  closeRoom()
  const name = myName('JUGADOR 1')
  $('start').hidden = true
  $('hostbox').hidden = false
  $('codeShow').textContent = '····'
  say('Creando sala…')
  const handlers = {
    onReady: c => {
      code = c
      $('codeShow').textContent = c
      const url = new URL(location.href)
      url.search = ''
      url.searchParams.set('sala', c)
      if (localMode) url.searchParams.set('local', '')
      $('shareLink').textContent = url.href
      $('shareLink').href = url.href
      $('lanHint').hidden = localMode || !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
      say('')
    },
    onLink: link => greetGuest(link, name),
    onError: msg => say(msg, true),
  }
  code = localMode ? params.get('local') || 'PRUE' : randomCode()
  room = localMode ? hostLocal(code, handlers) : hostOnline(code, handlers)
}

function greetGuest(link, name) {
  link.onMessage(m => {
    if (m.t !== 'hello') return
    const guest = cleanName(m.name) || 'JUGADOR 2'
    const side = session ? session.side : hostSide
    const names = side === 0 ? [name, guest] : [guest, name]
    link.send({ t: 'welcome', side: 1 - side, names, code })
    if (session) session.reattach(link, names)
    else {
      session = new Session({ link, isHost: true, side, view, names, code })
      enterGame()
    }
  })
}

// ---------- invitado ----------

function joinRoom(auto = false) {
  if (auto !== true) retries = 0
  const c = codeInput.value.trim().toUpperCase()
  if (!localMode && !/^[A-Z]{4}$/.test(c)) {
    say('El código son 4 letras.', true)
    codeInput.focus()
    return
  }
  unlockAudio()
  fullscreen()
  closeRoom()
  code = c
  const name = myName('JUGADOR 2')
  say('Conectando con el otro portátil…')
  $('join').disabled = true
  const handlers = {
    onLink: link => {
      link.onMessage(m => {
        if (m.t !== 'welcome') return
        session = new Session({ link, isHost: false, side: m.side, view, names: m.names, code, onLost: guestLost })
        retries = 0
        enterGame()
      })
      link.send({ t: 'hello', name })
    },
    onError: msg => {
      $('join').disabled = false
      if (retries > 0 && retries < 6) guestLost()
      else say(msg, true)
    },
  }
  room = localMode ? joinLocal(c, handlers) : joinOnline(c, handlers)
}

let retries = 0
function guestLost() {
  session = null
  closeRoom()
  leaveGame()
  codeInput.value = code
  // Volver a entrar solo, unas cuantas veces
  if (retries < 6) {
    retries++
    say(`Se ha perdido la conexión. Reintentando (${retries})…`, true)
    setTimeout(() => {
      if (!session) joinRoom(true)
    }, 1500)
  } else say('Se ha perdido la conexión con el otro portátil. Pulsa Entrar para volver.', true)
}

// ---------- pantalla de juego ----------

function enterGame() {
  document.activeElement?.blur?.()
  lobby.hidden = true
  say('')
  $('join').disabled = false
}

function leaveGame() {
  lobby.hidden = false
  $('start').hidden = false
  $('hostbox').hidden = true
}

$('create').addEventListener('click', createRoom)
$('join').addEventListener('click', joinRoom)
codeInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') joinRoom()
})
codeInput.addEventListener('input', () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, '')
})
$('cancel').addEventListener('click', () => {
  closeRoom()
  leaveGame()
  say('')
})
for (const b of document.querySelectorAll('.side')) {
  b.addEventListener('click', () => {
    hostSide = Number(b.dataset.side)
    for (const o of document.querySelectorAll('.side')) o.classList.toggle('on', o === b)
  })
}

input.onKey(codeKey => {
  unlockAudio()
  if (codeKey === 'KeyF' && session) {
    fullscreen(!(document.fullscreenElement || document.webkitFullscreenElement))
  }
})
addEventListener('pointerdown', () => unlockAudio())
addEventListener('pagehide', () => session?.link?.close?.())

function loop(now) {
  if (session) session.frame(now)
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

// Arranque automático (para la página de prueba)
const auto = params.get('auto')
if (auto === 'host') createRoom()
else if (auto === 'join') {
  codeInput.value = params.get('local') || params.get('sala') || ''
  joinRoom()
}

// Acceso para depurar desde la consola
window.__mitades = {
  get session() {
    return session
  },
  input,
  view,
}
