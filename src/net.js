// Conexión entre los dos portátiles.
// Online: WebRTC con PeerJS (su servidor público solo presenta a los dos
// navegadores; después los datos van directos de un Mac al otro).
// Local: BroadcastChannel, para probar con dos pestañas del mismo navegador.
import { Peer } from 'peerjs'

const PREFIX = 'mitades-v1-'
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

export function randomCode() {
  let c = ''
  for (let i = 0; i < 4; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)]
  return c
}

class Link {
  constructor(kind) {
    this.kind = kind
    this.closed = false
    this._msg = () => {}
    this._close = () => {}
  }
  onMessage(fn) {
    this._msg = fn
  }
  onClose(fn) {
    this._close = fn
  }
  deliver(m) {
    if (!this.closed) this._msg(m)
  }
  end() {
    if (this.closed) return
    this.closed = true
    this._close()
  }
}

const PEER_ERRORS = {
  'peer-unavailable': 'No hay ninguna sala con ese código. ¿Está abierta en el otro portátil?',
  network: 'No se puede llegar al servidor de conexión. Revisa el wifi.',
  'server-error': 'El servidor de conexión no responde. Prueba otra vez en un momento.',
  'browser-incompatible': 'Este navegador no permite conexiones WebRTC.',
  'socket-error': 'Se cortó la conexión con el servidor.',
}
const peerError = err => PEER_ERRORS[err?.type] || err?.message || 'Error de conexión'

function wrapConn(conn) {
  const link = new Link('online')
  link.send = m => {
    if (conn.open) conn.send(m)
  }
  link.close = () => {
    conn.close()
    link.end()
  }
  conn.on('data', d => link.deliver(d))
  conn.on('close', () => link.end())
  conn.on('error', () => link.end())
  return link
}

export function hostOnline(code, { onReady, onLink, onError }) {
  let peer
  let current = null
  const start = c => {
    peer = new Peer(PREFIX + c)
    peer.on('open', () => onReady(c))
    peer.on('connection', conn => {
      conn.on('open', () => {
        // Solo caben dos: si ya hay alguien conectado, fuera
        if (current && !current.closed) return conn.close()
        current = wrapConn(conn)
        onLink(current)
      })
    })
    peer.on('error', err => {
      if (err.type === 'unavailable-id') {
        peer.destroy()
        start(randomCode())
      } else if (err.type !== 'peer-unavailable') onError(peerError(err))
    })
    // Si se cae el servidor de presentación, la sala tiene que seguir viva
    // para que el otro pueda volver a entrar
    peer.on('disconnected', () => {
      if (!peer.destroyed) peer.reconnect()
    })
  }
  start(code)
  return { close: () => peer?.destroy() }
}

export function joinOnline(code, { onLink, onError }) {
  const peer = new Peer()
  let done = false
  peer.on('open', () => {
    const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' })
    conn.on('open', () => {
      done = true
      onLink(wrapConn(conn))
    })
  })
  peer.on('error', err => {
    if (!done) onError(peerError(err))
  })
  return { close: () => peer.destroy() }
}

export function hostLocal(code, { onReady, onLink }) {
  const ch = new BroadcastChannel('mitades-local-' + code)
  const me = Math.random().toString(36).slice(2)
  let link = null
  let other = null
  ch.onmessage = e => {
    const m = e.data
    if (m.k === 'join' && (!link || link.closed)) {
      other = m.from
      link = new Link('local')
      link.send = d => ch.postMessage({ k: 'm', from: me, to: other, d })
      link.close = () => {
        ch.postMessage({ k: 'bye', from: me, to: other })
        link.end()
      }
      ch.postMessage({ k: 'welcome', from: me, to: other })
      onLink(link)
    } else if (link && m.to === me && m.from === other) {
      if (m.k === 'm') link.deliver(m.d)
      else if (m.k === 'bye') link.end()
    }
  }
  setTimeout(() => onReady(code))
  return { close: () => ch.close() }
}

export function joinLocal(code, { onLink }) {
  const ch = new BroadcastChannel('mitades-local-' + code)
  const me = Math.random().toString(36).slice(2)
  let link = null
  let host = null
  const knock = () => ch.postMessage({ k: 'join', from: me })
  const timer = setInterval(knock, 400)
  knock()
  ch.onmessage = e => {
    const m = e.data
    if (m.to !== me) return
    if (m.k === 'welcome' && !link) {
      clearInterval(timer)
      host = m.from
      link = new Link('local')
      link.send = d => ch.postMessage({ k: 'm', from: me, to: host, d })
      link.close = () => {
        ch.postMessage({ k: 'bye', from: me, to: host })
        link.end()
      }
      onLink(link)
    } else if (link && m.from === host) {
      if (m.k === 'm') link.deliver(m.d)
      else if (m.k === 'bye') link.end()
    }
  }
  return {
    close: () => {
      clearInterval(timer)
      ch.close()
    },
  }
}
