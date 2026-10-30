# DEADZONE — UNDEAD PROTOCOL

Shooter arcade **frenético** en primera persona de supervivencia por rondas contra zombis, con **miras holográficas**, **potenciadores** y **medallas de batalla**, hecho con **HTML5 + CSS + JavaScript + Three.js (r158)**. Todo el contenido (mapa, armas, nombres, modelos, sonidos e interfaz) es original y se genera por código: no necesita modelos, imágenes ni audios externos.

## Cómo ejecutarlo

**Opción 1 — sin instalar nada (recomendada):** descomprime la carpeta y abre `index.html` con doble clic (Chrome, Edge o Firefox). Funciona sin internet porque Three.js va incluido en `lib/`.

**Opción 2 — con servidor de desarrollo (opcional):**

```bash
cd deadzone
npm install          # instala Vite (sólo la primera vez)
npm run dev          # abre http://localhost:5173
```

También vale cualquier servidor estático: `npx http-server . -p 8080 -o`.

> En el teléfono: copia la carpeta y abre `index.html`, o sírvela desde el ordenador con la opción 2 y entra desde el móvil por la IP local. Juega en horizontal.

## Estructura

```
deadzone/
├── index.html          estructura, HUD, menús y carga de scripts
├── style.css           HUD, tienda, menús, controles táctiles
├── package.json        scripts opcionales (Vite / http-server)
├── lib/three.min.js    Three.js r158 (MIT) incluido para jugar sin conexión
└── src/
    ├── config.js       ⚙ TODOS los precios, armas, ventajas, enemigos y fórmulas de dificultad
    ├── audio.js        sonidos sintetizados con Web Audio API + volúmenes
    ├── input.js        teclado, ratón (Pointer Lock) y controles táctiles
    ├── map.js          mapa por casillas, colisiones, zonas, puertas, estaciones, navegación
    ├── effects.js      partículas, trazadoras e impactos (reserva reutilizable)
    ├── player.js       movimiento FPS, salto, gravedad, salud, ventajas
    ├── weapons.js      modelos de armas, disparo por raycast, recarga, mejoras, vista 1ª persona
    ├── zombies.js      3 tipos de zombi + jefe EL COLOSO, IA y animaciones
    ├── economy.js      puntos, recompensas, rachas
    ├── waves.js        rondas, aparición y rondas especiales
    ├── shop.js         estaciones de compra, puertas, botiquín, energía y Forja Omega
    ├── ui.js           HUD, avisos, panel de compra, menús y opciones
    └── main.js         renderizado, estados de juego y bucle principal
```

Los scripts son clásicos (no módulos ES) a propósito: así el juego funciona con doble clic, porque los navegadores bloquean los módulos ES abiertos como `file://`.

## Controles

| Teclado / ratón | Acción |
|---|---|
| W A S D | Moverse |
| Ratón | Mirar / apuntar |
| Clic izquierdo | Disparar |
| Clic derecho | Apuntar con la mira |
| R | Recargar |
| Shift | Correr (consume aguante) |
| Espacio | Saltar |
| E | Comprar, abrir puertas, usar máquinas |
| 1 · 2 · Q · rueda | Cambiar de arma |
| V · F · botón central del ratón | Culatazo (cuerpo a cuerpo) |
| Esc · P | Pausa (libera el ratón) |

**Táctil:** joystick a la izquierda (a fondo = correr), arrastrar a la derecha para mirar (también sobre el botón de disparo), botones de disparo, mira, recarga, salto, E, cambio de arma, culatazo (✊) y correr. Botón de pausa arriba a la derecha.

## Mecánicas implementadas

### Novedades de la versión 2 (arcade)

- **Ritmo frenético:** jugador más rápido (5,6 m/s andando, 8,8 m/s corriendo, el doble de aguante), zombis más rápidos, rondas más grandes (r1 = 11 zombis, hasta 28 a la vez), descansos de 6 s, cargadores más grandes y recargas más cortas.
- **Miras holográficas** en las 5 armas, cada una con su retícula brillante (punto, círculo, anillo, chevrón y cruz). Al apuntar con clic derecho la retícula queda exactamente en el centro; al mejorar el arma en la Forja cambia de color (azul, violeta, magenta).
- **Muertes arcade:** los zombis salen despedidos en la dirección del disparo y estallan en cubos de colores (sin gore); los puntos saltan en el mundo 3D sobre cada impacto.
- **Culatazo (V):** golpe cuerpo a cuerpo que empuja, aturde y da 130 puntos por baja.
- **Potenciadores** que sueltan los zombis (4 % por baja, máx. 4 por ronda y como mínimo uno cada ~32 bajas; duran 25 s en el suelo):
  - **Munición Máxima**: recarga todas tus armas.
  - **Bala Letal** (20 s): cualquier impacto elimina (×3 de daño contra el Coloso).
  - **Puntos ×2** (20 s).
  - **Detonación**: elimina a todos los zombis presentes y da 400 puntos.
  - **Frenesí** (15 s): +50 % de cadencia y no gasta cargador.
- **Medallas de batalla** (24 distintas, de bronce, plata, oro y leyenda). Cada una aparece en pantalla con su insignia y sonido, da puntos extra y se guarda en tu colección (menú **MEDALLAS**). Al morir ves las medallas de la partida.

| Medalla | Cómo se gana |
|---|---|
| Doble Baja · Triple Baja · Masacre · Apocalipsis · Imparable | 2 · 3 · 5 · 8 · 12 bajas encadenadas (menos de 1,8 s entre cada una) |
| Colateral · Brocheta | 2 · 3 bajas con un solo disparo |
| Cazacabezas · Ojo de Halcón | 5 · 10 bajas seguidas a la cabeza |
| Intocable · Fantasma · Leyenda Viva | 20 · 40 · 75 bajas sin recibir daño |
| Culatazo · Puños de Acero | baja cuerpo a cuerpo · 5 seguidas |
| Por los Pelos | baja con la salud por debajo del 25 % |
| Acróbata | baja en pleno salto |
| Matagigantes · Caída del Coloso | eliminar a un Pesado · derrotar al Coloso |
| Limpieza · Ronda Perfecta · Superviviente | último zombi de la ronda · ronda sin daño · cada 5 rondas |
| Detonador · Gatillo de Fuego | Detonación con 8+ bajas · 15 bajas en un Frenesí |
| Primer Contacto | primera baja de la partida |

### Base del juego

**Mapa (5 zonas, 5 puertas de pago):**

| Zona | Acceso | Qué aporta |
|---|---|---|
| Patio de Cuarentena (inicio) | — | Munición, Subfusil, ventaja Resistencia, coberturas |
| Muelle de Carga (exterior) | Portón 750 | Espacio abierto para maniobrar, Escopeta, Paso Ligero |
| Laboratorio 3 (interior) | Esclusa 1.000 | Pasillos estrechos entre mesas, Rifle, Manos Rápidas, Botiquín |
| Armería | Puerta 1.250 (desde el Laboratorio) | Ametralladora pesada, munición, Pulso Firme |
| Sala del Reactor | 1.500 (desde Armería o Muelle) | Interruptor de energía y **Forja Omega** |

**Armas:** P-17 Guardiana (pistola inicial), VX-9 Avispa (subfusil, 1.000), RT-8 Rompepuertas (escopeta de 8 perdigones, 1.500), Centinela AR-4 (rifle, 1.750) y Martillo M-75 (pesada, 3.500). Cada una tiene daño, cadencia, cargador, reserva, recarga, dispersión, retroceso, caída de daño por distancia, precio, coste de munición, sonido y modelo propios. Disparos por raycast desde la cámara; disparos a la cabeza ×2,2. Dos huecos de arma: comprar una tercera sustituye a la equipada; comprar en la pared un arma que ya tienes repone su munición.

**Economía:** 500 puntos iniciales. +10 por impacto (máx. 8 recompensas por zombi, evita puntos infinitos), +60 por eliminación, +100 por eliminación a la cabeza, +130 por culatazo, puntos de medallas, bonificación por eliminaciones rápidas encadenadas (hasta +50), bonificación por ronda (50 × ronda, doble en especiales) y +250 al activar la energía. Todo se ajusta en `src/config.js`.

**Ventajas (máx. 3 de 4):** Resistencia (salud 100→175, 2.500), Manos Rápidas (recarga −45 %, 2.000), Paso Ligero (+20 % velocidad y más aguante, 2.000), Pulso Firme (−45 % retroceso y dispersión, 1.500).

**Botiquín:** 500 puntos, cura el 60 %, 2 usos por ronda y 20 s de enfriamiento. La salud se regenera sola sólo hasta el 60 %.

**Forja Omega:** necesita energía (interruptor de la misma sala). Mejora el arma equipada a MK-I (1.500), MK-II (3.000) y MK-III (5.000): más daño, cargador y reserva, menos retroceso y dispersión, más cadencia, recarga más rápida y nuevos colores/brillo en el arma y las trazadoras. Muestra nivel actual → siguiente y el coste antes de confirmar. La secuencia (2,6 s) no bloquea al jugador: puede moverse y usar su otra arma; pulsar E de nuevo la recoge al instante; si mueres, se cancela de forma segura.

**Zombis:** Errante (equilibrado), Corredor (rápido, zigzaguea), Pesado (blindado, mucha vida, golpe fuerte). Estados: emergen del suelo → persiguen (campo de flujo BFS por el mapa + línea de visión) → atacan con señal visible (levantan los brazos) → reciben daño (destello) → mueren (se desploman y se hunden, sin gore). Se separan entre sí, chocan con paredes y nunca aparecen junto al jugador; si uno se atasca 7 s, vuelve a emerger en otro punto lejano.

**Rondas:** número de zombis, vida, velocidad y probabilidad de variantes crecen de forma escalonada (r1 = 11 zombis, r10 = 51, máx. 28 a la vez). Descanso de 6 s entre rondas. Cada 5 rondas hay una especial: ronda 5, 15, 25… **oleada de corredores con puntos ×2**; ronda 10, 20… **EL COLOSO**, jefe con barra de vida, golpe sísmico telegrafiado con un círculo rojo (se esquiva saltando o alejándose) y embestida telegrafiada con una franja (se esquiva apartándose), recompensa ×10.

**Derrota y récords:** al morir la cámara cae, se muestran ronda, eliminaciones, disparos a la cabeza y puntos, y se ofrece reintentar. El mejor récord, las eliminaciones totales y las opciones se guardan en el navegador y no se pierden al perder.

**Interfaz:** HUD con ronda, zombis restantes, zona actual, salud (con marca de regeneración), aguante, ventajas, puntos con ventanas emergentes, arma, nivel de mejora, munición, barra de recarga, mira dinámica, marcador de impacto, indicador de dirección del daño, viñeta de salud baja, avisos de ronda y panel de compra al acercarse a cada estación. Menús de inicio (Jugar, Instrucciones, Opciones, Créditos), pausa y derrota. Opciones: volumen general/efectos/ambiente, sensibilidad, campo de visión, calidad visual (baja/media/alta) e invertir eje Y.

## Dependencias

- Three.js r158 (incluido en `lib/`, licencia MIT).
- Vite 5 sólo si quieres usar `npm run dev` (opcional).

## Ajustar el equilibrio

Abre `src/config.js`: precios de puertas, armas, munición, ventajas, botiquín y Forja; estadísticas de armas y zombis; tiempos de descanso, máximo de zombis simultáneos y fórmulas de dificultad (`DZ.DIFF`).

## Herramientas de prueba

Desde la consola del navegador (F12): `DZ.debug.points(5000)`, `DZ.debug.goRound(10)`, `DZ.debug.skipRound()`, `DZ.debug.god(true)`, `DZ.debug.state()`.

## Limitaciones conocidas

- Los modelos son geometría simple (cajas) por diseño: no hay recursos externos.
- Los zombis no tienen animaciones esqueléticas, sólo movimiento procedural de extremidades.
- No hay granadas en esta versión (sí culatazo).
- La ronda especial del Coloso usa un único jefe; no hay más tipos de élite.
- En móviles modestos conviene la calidad «Baja» (se activa por defecto en pantallas táctiles).
- El rendimiento real no se pudo medir en una GPU física (ver abajo).

## Resultados de las pruebas

Ejecutadas en Chromium sin interfaz (WebGL por software), abriendo `index.html` como archivo y simulando la entrada del jugador fotograma a fotograma: **66 de 66 comprobaciones superadas, sin errores de JavaScript.**

| # | Comprobación | Resultado |
|---|---|---|
| 1 | El juego arranca | ✔ |
| 2 | Moverse (4,6 m/s), mirar con el ratón, saltar sin doble salto | ✔ |
| 3 | Las colisiones impiden atravesar muros y puertas cerradas, también a 20 FPS | ✔ |
| 4 | Disparo consume munición, no se dispara recargando, recarga correcta, no recarga con cargador lleno | ✔ |
| 5 | Los zombis emergen, persiguen (12,5 → 8,9 m en 2 s) y atacan | ✔ |
| 6 | Una eliminación da puntos una sola vez; impactos con tope por zombi | ✔ |
| 7 | La ronda termina cuando no quedan enemigos | ✔ |
| 8 | Dificultad creciente (r1 = 11, r2 = 14, r10 = 51 zombis; vida ×2 en r10) | ✔ |
| 9 | Puertas, armas, munición, ventajas y botiquín descuentan los puntos exactos | ✔ |
| 10 | Compras sin puntos o con munición llena fallan sin cobrar | ✔ |
| 11 | La Forja exige energía, cobra, sube daño/cargador (34→54, 8→10), se puede recoger al instante y no pasa de MK-III | ✔ |
| 12 | Tras abrir una puerta se puede cruzar a la zona nueva | ✔ |
| 13 | La muerte detiene el combate, muestra la derrota y guarda el récord | ✔ |
| 14 | Reiniciar limpia zombis, puntos, armas, ventajas, puertas, energía y Forja | ✔ |
| 15 | Tras 5 rondas seguidas no quedan zombis, partículas ni objetos acumulados en la escena | ✔ |
| — | Zombis navegan entre zonas hasta el jugador sin quedar dentro de muros | ✔ |
| — | Ronda 10 con EL COLOSO usando golpe sísmico y embestida | ✔ |
| — | Disparo real por raycast: impacto de 34 de daño y +10 puntos | ✔ |
| — | Controles táctiles (joystick y botón de disparo) en emulación de móvil | ✔ |
| v2 | Las 5 armas tienen mira holográfica y al apuntar la retícula queda en el centro de la pantalla | ✔ |
| v2 | El culatazo elimina, da 130 puntos y la medalla Culatazo | ✔ |
| v2 | Munición Máxima, Puntos ×2, Bala Letal, Frenesí y Detonación funcionan; los zombis los sueltan con tope por ronda | ✔ |
| v2 | Medallas: Doble/Triple Baja, Masacre, Colateral, Cazacabezas, Detonador, Ronda Perfecta y Limpieza; se ven en pantalla y se guardan en la colección | ✔ |

Prueba de equilibrio: un bot que sólo usa la pistola inicial (sin comprar armas ni ventajas) llega a las rondas 4-7 con 11.000-22.000 puntos; comprar todo (puertas, armas, ventajas y Forja) cuesta unos 30.000.

**No verificado:** los FPS reales en una GPU física y en teléfonos (el entorno de pruebas renderiza por software), ni el sonido de forma audible.
