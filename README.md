# Mitades

Minijuegos para dos MacBook puestos uno pegado al otro. Las dos pantallas forman
una sola: el disco, la pelota o el proyectil pasan de un portátil al otro por
debajo de los marcos, y cada jugador maneja su lado con su teclado y su trackpad.

## Juegos

| Juego | Tipo | Controles |
| --- | --- | --- |
| **Hockey** | Física, trackpad | Mueve el dedo por el trackpad (o flechas). 7 goles. |
| **Voley** | Saltos; la red está en los marcos | ← → moverse, ↑ o espacio saltar. 7 puntos. |
| **Estela** | Motos de luz, reflejos | Flechas girar, espacio turbo. 3 rondas. |
| **Artillería** | Por turnos, con viento y cráteres | ← → ángulo, ↑ ↓ potencia, X arma, espacio disparar. |
| **Duelo** | Nervios: desenfunda a la señal | Espacio cuando salga ¡FUEGO! Si te adelantas, pierdes. 3 rondas. |
| **Torneo** | Los 5 seguidos en orden al azar | Un punto por juego. |

En cualquier juego: **Q** (o Esc / retroceso) pausa, **F** pantalla completa.

## Cómo se juega

1. Arranca el servidor (o usa la versión publicada, si la hay):
   ```bash
   cd /Users/josealbertoaresdiaz/2player && npm run dev
   ```
   Vite enseña dos direcciones: `Local` (solo este Mac) y `Network`
   (por ejemplo `http://192.168.1.20:5190`). **En los dos Mac abrid la de `Network`.**
2. En un Mac pulsa **Crear sala**; en el otro escribe el código de 4 letras y **Entrar**.
3. Pulsad **F** en los dos para la pantalla completa.
4. Si las líneas no cuadran al pasar de una pantalla a otra, entrad en
   **Ajustar pantallas** (menú, flecha abajo):
   - **← →** separación de los marcos (compartida).
   - **↑ ↓** altura y **+ −** tamaño de *tu* pantalla (el Mac más grande baja su tamaño).
   - **X** cambia qué portátil va a la izquierda.

## Cómo funciona

- **Red**: WebRTC con [PeerJS](https://peerjs.com). Su servidor público solo
  presenta a los dos navegadores; después los datos van directos de un Mac a otro
  (en la misma wifi, 2–10 ms). Si la red bloquea la conexión directa, PeerJS usa un TURN.
- **Sincronización**: el Mac que crea la sala simula el mundo entero a 60 Hz con
  los mandos de los dos y manda una foto del estado en cada tick. El otro manda su
  mando y pinta las fotos interpoladas con ~33 ms de colchón. Lo que no cabe en
  una foto (cráteres, giros de la estela, sonidos) viaja como evento pegado a su tick.
- **El mundo** mide 1600 × 1000 por pantalla (16:10, como los MacBook) más una franja
  invisible del ancho de los marcos. Cada Mac pega su mitad al borde que toca con el
  otro, así las bandas negras (si las hay) quedan fuera y no en la costura.
- **El sonido** suena más fuerte en el Mac donde pasa la acción.
- **El duelo** es justo aunque haya retraso: cada Mac mide el tiempo de reacción
  desde que *él* enseña la señal.
- Si se corta la conexión, el invitado vuelve a entrar solo y el anfitrión espera.

## Probar en un solo Mac

`http://localhost:5190/prueba.html` simula los dos portátiles en una ventana.
Izquierda: WASD + espacio · X arma · Q menú. Derecha: flechas + Enter · Shift arma · retroceso menú.

## Archivos

- `src/session.js` — bucle, sincronización anfitrión/invitado, interpolación.
- `src/net.js` — conexión (PeerJS online, BroadcastChannel para pruebas).
- `src/view.js` — qué trozo del mundo pinta cada Mac y calibración.
- `src/overlay.js` — cuenta atrás, pausa, fin de partida.
- `src/games/` — menú, ajuste de pantallas, los 5 juegos y el podio del torneo.
