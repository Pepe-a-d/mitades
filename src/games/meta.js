// Datos de cada minijuego para el menú y la pantalla de "preparados"
export const GAMES = ['hockey', 'volley', 'trails', 'artillery', 'duel']

export const META = {
  hockey: {
    title: 'HOCKEY',
    split: ['HOC', 'KEY'],
    color: '#3fd7ff',
    tag: 'TRACKPAD',
    desc: ['Disco de aire de punta a punta.', 'Mete 7 goles en la portería rival.'],
    how: ['Mueve el dedo por el trackpad: tu mazo lo sigue', '(o flechas / WASD)', 'Gana quien llegue a 7 goles'],
  },
  volley: {
    title: 'VOLEY',
    split: ['VO', 'LEY'],
    color: '#ffb340',
    tag: 'SALTOS',
    desc: ['La red está justo en los marcos.', 'Que no caiga en tu campo.'],
    how: ['← →  moverse', '↑ o ESPACIO  saltar', 'Gana quien llegue a 7 puntos'],
  },
  trails: {
    title: 'ESTELA',
    split: ['ESTE', 'LA'],
    color: '#7dff6a',
    tag: 'REFLEJOS',
    desc: ['Tu moto deja un muro de luz.', 'Encierra al otro sin chocar.'],
    how: ['Flechas  girar', 'ESPACIO  turbo (se recarga)', 'Gana quien gane 3 rondas'],
  },
  artillery: {
    title: 'ARTILLERÍA',
    split: ['ARTI', 'LLERÍA'],
    color: '#ff7a3c',
    tag: 'POR TURNOS',
    desc: ['Calcula el tiro por encima', 'de la montaña. Ojo al viento.'],
    how: ['← →  ángulo     ↑ ↓  potencia', 'X  cambiar arma     ESPACIO  disparar', 'Gana quien deje al otro sin vida'],
  },
  duel: {
    title: 'DUELO',
    split: ['DUE', 'LO'],
    color: '#ffd84a',
    tag: 'NERVIOS',
    desc: ['Espera a la señal y desenfunda.', 'Si te adelantas, pierdes.'],
    how: ['Pulsa ESPACIO cuando salga ¡FUEGO!', 'Si disparas antes de tiempo, pierdes la ronda', 'Gana quien gane 3 rondas'],
  },
  tour: {
    title: 'TORNEO',
    color: '#c58bff',
    tag: 'LOS 5 SEGUIDOS',
    desc: ['Todos los juegos en orden', 'al azar. Un punto por juego.'],
  },
}
