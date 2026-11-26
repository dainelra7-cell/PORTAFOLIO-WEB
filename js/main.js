/* ==========================================================================
   js/main.js · Clase 08 – Mi Primer Script Interactivo
   Al hacer clic en "Modo interactivo":
     1) El título principal va cambiando de palabra con una transición.
     2) La sección de inicio recibe la clase CSS dinámica .hero-activo.
     3) Todo el sitio recibe .modo-interactivo → animaciones en cada cuadro.
   ========================================================================== */

// const: referencias al DOM que no cambian
const boton = document.querySelector('#btnInteractivo');
const titulo = document.querySelector('#tituloDestacado');
const eyebrow = document.querySelector('#eyebrowHero');
const seccionInicio = document.querySelector('#inicio');
const tarjetasTilt = document.querySelectorAll('.brand-card, .about-card');

// const: configuración (Array de Strings y Number)
const PALABRAS = ['Dainel.', 'creativo.', 'multimedia.', 'motion.', 'animador.', 'diseñador.'];
const EYEBROW_ORIGINAL = 'DISEÑO · ANIMACIÓN · CREATIVIDAD';
const EYEBROW_ACTIVO = 'MODO INTERACTIVO · JAVASCRIPT · DOM';
const INTERVALO_MS = 2200;
const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// let: estado que cambia en el tiempo
let indice = 0;            // Number
let modoActivo = false;    // Boolean
let totalClics = 0;        // Number
let temporizador = null;   // id del setInterval

console.log('main.js cargado correctamente ✔');

// Cambia la palabra del título con animación de salida y entrada
function cambiarPalabra(nuevaPalabra) {
    if (reducirMovimiento) {
        titulo.textContent = nuevaPalabra;
        return;
    }
    titulo.classList.remove('entra');
    titulo.classList.add('sale');

    titulo.addEventListener('animationend', function alSalir() {
        titulo.removeEventListener('animationend', alSalir);
        titulo.textContent = nuevaPalabra;
        titulo.classList.remove('sale');
        void titulo.offsetWidth;          // reinicia la animación
        titulo.classList.add('entra');
    });
}

function siguientePalabra() {
    indice = (indice + 1) % PALABRAS.length;
    cambiarPalabra(PALABRAS[indice]);
    console.log(`Palabra #${indice}: "${PALABRAS[indice]}"`);
}

// Efecto de onda en el botón
function crearOnda(evento) {
    const rect = boton.getBoundingClientRect();
    const onda = document.createElement('span');
    const tam = Math.max(rect.width, rect.height);
    onda.className = 'btn-onda';
    onda.style.width = onda.style.height = `${tam}px`;
    onda.style.left = `${(evento.clientX || rect.left + rect.width / 2) - rect.left - tam / 2}px`;
    onda.style.top = `${(evento.clientY || rect.top + rect.height / 2) - rect.top - tam / 2}px`;
    // Estilos en línea: la onda nunca ocupa espacio dentro del botón
    Object.assign(onda.style, { position: 'absolute', pointerEvents: 'none', borderRadius: '50%' });
    boton.appendChild(onda);
    // Se elimina siempre, aunque la animación no se ejecute (caché o movimiento reducido)
    setTimeout(() => onda.remove(), 750);
}

function activarModo() {
    seccionInicio.classList.add('hero-activo');
    document.body.classList.add('modo-interactivo');
    if (eyebrow) eyebrow.textContent = EYEBROW_ACTIVO;
    boton.firstChild.textContent = 'Modo normal ';
    siguientePalabra();                                   // cambio inmediato
    temporizador = setInterval(siguientePalabra, INTERVALO_MS);
}

function desactivarModo() {
    clearInterval(temporizador);
    temporizador = null;
    seccionInicio.classList.remove('hero-activo');
    document.body.classList.remove('modo-interactivo');
    if (eyebrow) eyebrow.textContent = EYEBROW_ORIGINAL;
    boton.firstChild.textContent = 'Modo interactivo ';
    indice = 0;
    cambiarPalabra(PALABRAS[0]);                          // vuelve a "Dainel."
    tarjetasTilt.forEach(t => { t.style.removeProperty('--rx'); t.style.removeProperty('--ry'); });
}

// Verificación: evita referencias nulas si falta un elemento
if (boton && titulo && seccionInicio) {

    boton.addEventListener('click', (evento) => {
        totalClics++;
        modoActivo = !modoActivo;
        crearOnda(evento);
        boton.setAttribute('aria-pressed', String(modoActivo));

        if (modoActivo) {
            activarModo();
        } else {
            desactivarModo();
        }

        console.log(`Clic #${totalClics} → modo interactivo: ${modoActivo} | clase hero-activo: ${seccionInicio.classList.contains('hero-activo')}`);
    });

    // Inclinación 3D de las tarjetas al mover el mouse (solo en modo interactivo)
    tarjetasTilt.forEach((tarjeta) => {
        tarjeta.addEventListener('pointermove', (e) => {
            if (!modoActivo || e.pointerType !== 'mouse') return;
            const r = tarjeta.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            tarjeta.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
            tarjeta.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
        });
        tarjeta.addEventListener('pointerleave', () => {
            tarjeta.style.setProperty('--rx', '0deg');
            tarjeta.style.setProperty('--ry', '0deg');
        });
    });

} else {
    console.warn('main.js: no se encontraron los elementos del hero en esta página.');
}


/* ==========================================================================
   Sección Software: barras de carga que se llenan al aparecer en pantalla
   ========================================================================== */
const tarjetasSoftware = document.querySelectorAll('.software-card');

// Anima el número desde 0 hasta el porcentaje
function contarHasta(elemento, meta, duracion) {
    const inicio = performance.now();
    function paso(ahora) {
        const t = Math.min((ahora - inicio) / duracion, 1);
        const suavizado = 1 - Math.pow(1 - t, 3);          // easeOutCubic
        elemento.textContent = Math.round(meta * suavizado);
        if (t < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
}

function cargarTarjeta(tarjeta) {
    if (tarjeta.classList.contains('cargado')) return;
    const nivel = Number(tarjeta.dataset.nivel);         // 70, 65, 80, 70, 25
    const indiceTarjeta = Number(tarjeta.style.getPropertyValue('--i')) || 0;
    tarjeta.classList.add('cargado');
    setTimeout(() => {
        tarjeta.querySelector('.software-relleno').style.width = `${nivel}%`;
        contarHasta(tarjeta.querySelector('.software-num'), nivel, 1600);
    }, 250 + indiceTarjeta * 150);                       // una tras otra
}

if (tarjetasSoftware.length) {
    if ('IntersectionObserver' in window) {
        const observador = new IntersectionObserver((entradas) => {
            entradas.forEach((entrada) => {
                if (entrada.isIntersecting) {
                    cargarTarjeta(entrada.target);
                    observador.unobserve(entrada.target);
                }
            });
        }, { threshold: 0.35 });
        tarjetasSoftware.forEach(t => observador.observe(t));
    } else {
        tarjetasSoftware.forEach(cargarTarjeta);
    }
    console.log(`Software: ${tarjetasSoftware.length} programas listos`);
}
