/* ==========================================================================
   Experiencia AR (A-Frame) — Dainel Ramirez
   Showroom de RYU, ZIPPY y SPECTER:
   - Cursor virtual (raycaster): al hacer clic en un personaje se muestra su
     ficha y pasa a la siguiente animación.
   - Modo cámara: la cámara trasera del celular queda de fondo (WebAR) y la
     escena sigue el giroscopio. Si el equipo soporta WebXR, también se puede
     entrar en una sesión AR inmersiva.
   - Métricas de interacción guardadas con localStorage.
   ========================================================================== */
(() => {
    'use strict';
    if (!window.AFRAME) {
        const ayuda = document.getElementById('arAyuda');
        if (ayuda) ayuda.textContent = 'No se pudo cargar A-Frame. Revisa tu conexión a internet.';
        const carga = document.querySelector('#arCarga p');
        if (carga) carga.textContent = 'A-FRAME NECESITA CONEXIÓN A INTERNET';
        return;
    }

    const PERSONAJES = {
        ryu: {
            nombre: 'RYU', rol: 'Personaje · Héroe', color: '#79C24A',
            desc: 'Experimento bio-cibernético que escapó de HELIX Corp. Criatura anfibia con espíritu ninja y su shuriken de energía.',
        },
        zippy: {
            nombre: 'ZIPPY', rol: 'Personaje · Amigo', color: '#ECB703',
            desc: 'Robot felino cuadrúpedo, compañero leal de laboratorio. Carcasa de metal oscuro con paneles dorados.',
        },
        specter: {
            nombre: 'SPECTER', rol: 'Personaje · Antagonista', color: '#E0302A',
            desc: 'Unidad de cacería de HELIX Corp creada para eliminar “anomalías”. Máscara blanca con óptica roja y espada curva.',
        },
    };

    /* ---------- Métricas (localStorage) ---------- */
    const CLAVE = 'portafolioAR_metricas';
    const vacio = () => ({ total: 0, animaciones: 0, sesionesCamara: 0, porPersonaje: { ryu: 0, zippy: 0, specter: 0 }, historial: [] });
    function leer() {
        try {
            const m = JSON.parse(localStorage.getItem(CLAVE));
            if (m && m.porPersonaje && Array.isArray(m.historial)) return m;
        } catch (e) { /* datos dañados o almacenamiento bloqueado */ }
        return vacio();
    }
    function guardar(m) {
        try { localStorage.setItem(CLAVE, JSON.stringify(m)); } catch (e) { /* modo privado */ }
    }
    function registrar(tipo, detalle, personaje) {
        const m = leer();
        m.total += 1;
        if (tipo === 'animacion') m.animaciones += 1;
        if (tipo === 'camara') m.sesionesCamara += 1;
        if (personaje) m.porPersonaje[personaje] = (m.porPersonaje[personaje] || 0) + 1;
        m.historial.unshift({ detalle, hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) });
        m.historial = m.historial.slice(0, 6);
        guardar(m);
        pintarMetricas();
    }
    const $ = (id) => document.getElementById(id);
    function pintarMetricas() {
        const m = leer();
        $('mTotal').textContent = m.total;
        $('mAnim').textContent = m.animaciones;
        $('mCam').textContent = m.sesionesCamara;
        const max = Math.max(1, ...Object.values(m.porPersonaje));
        $('mBarras').innerHTML = Object.entries(PERSONAJES).map(([k, p]) => `
            <div class="ar-barra" style="--c:${p.color}">
                <span class="n">${p.nombre}</span>
                <span class="pista"><span style="width:${(m.porPersonaje[k] || 0) / max * 100}%"></span></span>
                <span class="v">${m.porPersonaje[k] || 0}</span>
            </div>`).join('');
        $('mHistorial').innerHTML = m.historial.length
            ? m.historial.map((h) => `<li><span>${h.hora}</span>${h.detalle}</li>`).join('')
            : '<li class="vacio">Aún no hay interacciones.</li>';
    }
    $('btnBorrar').addEventListener('click', () => { guardar(vacio()); pintarMetricas(); });
    pintarMetricas();

    /* ---------- Componentes del escenario ---------- */
    AFRAME.registerComponent('rejilla', {
        schema: { tamano: { default: 20 }, divisiones: { default: 40 }, color: { type: 'color', default: '#333' } },
        init() {
            const g = new AFRAME.THREE.GridHelper(this.data.tamano, this.data.divisiones, this.data.color, this.data.color);
            g.material.transparent = true; g.material.opacity = 0.6;
            this.el.setObject3D('mesh', g);
        },
    });
    AFRAME.registerComponent('particulas', {
        schema: { cantidad: { default: 200 }, radio: { default: 7 }, alto: { default: 4.5 } },
        init() {
            const T = AFRAME.THREE, n = this.data.cantidad;
            const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
            const tonos = [new T.Color('#79C24A'), new T.Color('#ECB703'), new T.Color('#E0302A'), new T.Color('#ffffff')];
            for (let i = 0; i < n; i++) {
                const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * this.data.radio;
                pos.set([Math.cos(a) * r, Math.random() * this.data.alto, Math.sin(a) * r], i * 3);
                const c = tonos[i % tonos.length]; col.set([c.r, c.g, c.b], i * 3);
            }
            const g = new T.BufferGeometry();
            g.setAttribute('position', new T.BufferAttribute(pos, 3));
            g.setAttribute('color', new T.BufferAttribute(col, 3));
            const m = new T.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false });
            this.puntos = new T.Points(g, m);
            this.el.setObject3D('mesh', this.puntos);
        },
        tick(t, dt) {
            if (!dt) return;
            const p = this.puntos.geometry.attributes.position;
            for (let i = 0; i < p.count; i++) {
                let y = p.getY(i) + dt * 0.00012 * (1 + (i % 5) * 0.3);
                if (y > this.data.alto) y = 0;
                p.setY(i, y);
            }
            p.needsUpdate = true;
        },
    });

    /* ---------- Componente: giro de pedestal ---------- */
    let giroActivo = false;
    AFRAME.registerComponent('giro-pedestal', {
        schema: { velocidad: { type: 'number', default: 30 } },   // grados por segundo
        tick(t, dt) {
            if (!giroActivo || !dt) return;
            this.el.object3D.rotation.y += AFRAME.THREE.MathUtils.degToRad(this.data.velocidad) * dt / 1000;
        },
    });

    /* ---------- Personajes: animaciones y selección ---------- */
    const estado = {};     // por personaje: { modelo, clips, indice }
    let seleccionado = null;

    function mostrarFicha(clave) {
        const p = PERSONAJES[clave]; const e = estado[clave];
        $('arFicha').style.setProperty('--c', p.color);
        $('fichaRol').textContent = p.rol;
        $('fichaNombre').textContent = p.nombre;
        $('fichaDesc').textContent = p.desc;
        if (e && e.clips.length) {
            $('fichaAnim').hidden = false;
            $('fichaAnimNombre').textContent = e.clips[e.indice];
            $('fichaAnimNum').textContent = `${e.indice + 1} / ${e.clips.length}`;
            $('btnSiguiente').hidden = false;
        }
    }

    function siguienteAnimacion(clave) {
        const e = estado[clave]; if (!e || !e.clips.length) return;
        e.indice = (e.indice + 1) % e.clips.length;
        e.modelo.setAttribute('animation-mixer', { clip: e.clips[e.indice], loop: 'repeat', crossFadeDuration: 0.3 });
        registrar('animacion', `${PERSONAJES[clave].nombre}: ${e.clips[e.indice]}`, clave);
        mostrarFicha(clave);
    }

    function seleccionar(clave) {
        if (seleccionado && seleccionado !== clave) marcar(seleccionado, false);
        seleccionado = clave;
        marcar(clave, true);
        siguienteAnimacion(clave);
    }

    function marcar(clave, activo) {
        const ped = document.querySelector(`.pedestal[data-personaje="${clave}"]`);
        if (!ped) return;
        const aro = ped.querySelector('.aro');
        aro.setAttribute('radius-tubular', activo ? 0.03 : 0.012);
        ped.querySelector('.etiqueta').setAttribute('scale', activo ? '1.25 1.25 1.25' : '1 1 1');
    }

    /* ---------- Carga de modelos ----------
       Con http(s) se descarga el .glb con fetch (y se muestra el progreso).
       Abierto con doble clic (file://) el navegador bloquea fetch, así que se
       usa la copia en JavaScript del modelo (assets/modelos/*.glb.js).      */
    function copiaJS(url) {
        return new Promise((resolve, reject) => {
            const listo = () => window.MODELOS_3D && window.MODELOS_3D[url];
            const convertir = () => {
                const bin = atob(listo()); const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                resolve(bytes.buffer);
            };
            if (listo()) return convertir();
            const sc = document.createElement('script');
            sc.src = url + '.js';
            sc.onload = () => (listo() ? convertir() : reject(new Error('Copia vacía ' + url)));
            sc.onerror = () => reject(new Error('No se encontró ' + sc.src));
            document.head.appendChild(sc);
        });
    }
    async function descargar(url, onProgreso) {
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const total = Number(r.headers.get('content-length')) || 0;
        if (!r.body || !total) return r.arrayBuffer();
        const lector = r.body.getReader(); const partes = []; let n = 0;
        for (;;) {
            const { done, value } = await lector.read();
            if (done) break;
            partes.push(value); n += value.length; onProgreso(n / total);
        }
        const todo = new Uint8Array(n); let o = 0;
        for (const p of partes) { todo.set(p, o); o += p.length; }
        return todo.buffer;
    }
    async function leerModelo(url, onProgreso) {
        if (location.protocol === 'file:') return copiaJS(url);
        try { return await descargar(url, onProgreso); } catch (e) { return copiaJS(url); }
    }

    const progreso = {};
    const pintarProgreso = () => {
        const v = Object.values(progreso);
        $('arBarra').style.width = Math.round(v.reduce((x, y) => x + y, 0) / 3 * 100) + '%';
    };

    let cargados = 0;
    document.querySelectorAll('.pedestal').forEach((ped) => {
        const clave = ped.dataset.personaje;
        const modelo = ped.querySelector('[data-modelo]');
        const zona = ped.querySelector('.clickable');

        modelo.addEventListener('model-loaded', () => {
            const obj = modelo.getObject3D('mesh');
            const clips = (obj && obj.animations ? obj.animations : []).map((c) => c.name);
            const actual = (modelo.getAttribute('animation-mixer') || {}).clip;
            estado[clave] = { modelo, clips, indice: Math.max(0, clips.indexOf(actual)) };
            if (obj) obj.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
            progreso[clave] = 1; pintarProgreso();
            cargados += 1;
            if (cargados === 3) $('arCarga').classList.add('listo');
        });
        modelo.addEventListener('model-error', (e) => {
            console.error('Error al cargar', clave, e.detail);
            $('arCarga').querySelector('p').textContent = 'NO SE PUDO CARGAR ' + PERSONAJES[clave].nombre;
        });

        leerModelo(modelo.dataset.modelo, (p) => { progreso[clave] = p * 0.95; pintarProgreso(); })
            .then((buf) => {
                const urlBlob = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
                modelo.setAttribute('gltf-model', urlBlob);
            })
            .catch((err) => {
                console.error(err);
                $('arCarga').querySelector('p').textContent = 'NO SE PUDO DESCARGAR ' + PERSONAJES[clave].nombre;
            });

        zona.addEventListener('mouseenter', () => { if (seleccionado !== clave) ped.querySelector('.aro').setAttribute('radius-tubular', 0.022); });
        zona.addEventListener('mouseleave', () => { if (seleccionado !== clave) ped.querySelector('.aro').setAttribute('radius-tubular', 0.012); });
        zona.addEventListener('click', () => { if (!huboArrastre) seleccionar(clave); });
    });

    window.__arDemo = { seleccionar };

    $('btnSiguiente').addEventListener('click', () => { if (seleccionado) siguienteAnimacion(seleccionado); });

    /* ---------- Cámara orbital con el mouse o el dedo ---------- */
    let huboArrastre = false;
    (() => {
        const zona = $('arEscena'); const rig = $('arRig'); const pitch = $('arPitch'); const cam = $('arCamara');
        let yaw = 0, inclinacion = -12, distancia = 6, activo = false, x0 = 0, y0 = 0, px = 0, py = 0;
        const toques = new Map(); let dist0 = 0, distancia0 = distancia;
        const aplicar = () => {
            rig.object3D.rotation.y = AFRAME.THREE.MathUtils.degToRad(yaw);
            pitch.object3D.rotation.x = AFRAME.THREE.MathUtils.degToRad(inclinacion);
            cam.object3D.position.z = distancia;
        };
        const esBoton = (e) => e.target.closest && e.target.closest('button');
        zona.addEventListener('pointerdown', (e) => {
            if (esBoton(e)) return;
            activo = true; huboArrastre = false; x0 = px = e.clientX; y0 = py = e.clientY;
            if (e.pointerType === 'touch') toques.set(e.pointerId, e);
        });
        window.addEventListener('pointermove', (e) => {
            if (toques.has(e.pointerId)) {
                toques.set(e.pointerId, e);
                if (toques.size === 2) {
                    const [a, b] = [...toques.values()];
                    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
                    if (!dist0) { dist0 = d; distancia0 = distancia; }
                    distancia = Math.min(9, Math.max(2.5, distancia0 * dist0 / d)); huboArrastre = true; aplicar(); return;
                }
            }
            if (!activo) return;
            const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
            if (Math.hypot(e.clientX - x0, e.clientY - y0) > 6) huboArrastre = true;
            yaw -= dx * 0.35;
            inclinacion = Math.min(10, Math.max(-45, inclinacion - dy * 0.25));
            aplicar();
        });
        const soltar = (e) => { activo = false; toques.delete(e.pointerId); if (toques.size < 2) dist0 = 0; };
        window.addEventListener('pointerup', soltar);
        window.addEventListener('pointercancel', soltar);
        zona.addEventListener('wheel', (e) => {
            e.preventDefault();
            distancia = Math.min(9, Math.max(2.5, distancia * (1 + Math.sign(e.deltaY) * 0.08))); aplicar();
        }, { passive: false });
        zona.addEventListener('dblclick', () => { yaw = 0; inclinacion = -12; distancia = 6; aplicar(); });
        $('arScene').addEventListener('loaded', aplicar);
        window.__arOrbita = {
            aplicar,
            // usado por el modo demo (demo.html)
            girarA: (grados, incl, dist) => { yaw = grados; if (incl !== undefined) inclinacion = incl; if (dist !== undefined) distancia = dist; aplicar(); },
        };
    })();

    /* ---------- Giro de pedestales ---------- */
    $('btnGiro').addEventListener('click', () => {
        giroActivo = !giroActivo;
        $('btnGiro').setAttribute('aria-pressed', String(giroActivo));
        registrar('giro', giroActivo ? 'Giro de pedestales activado' : 'Giro de pedestales detenido');
    });

    /* ---------- Modo cámara (WebAR con la cámara de fondo) ---------- */
    const NIEBLA = 'type: exponential; color: #06060a; density: 0.045';
    const video = $('arVideo');
    const escena = $('arScene');
    let flujo = null;
    async function activarCamara() {
        if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            $('arAyuda').textContent = 'La cámara necesita HTTPS: abre esta página desde GitHub Pages.';
            return;
        }
        try {
            flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
            video.srcObject = flujo;
            await video.play().catch(() => {});
            $('arEscena').classList.add('modo-camara');
            escena.removeAttribute('fog');
            $('arEntorno').setAttribute('visible', false);
            $('btnCamara').setAttribute('aria-pressed', 'true');
            $('btnCamara').querySelector('span').textContent = 'Apagar cámara';
            $('arAyuda').textContent = 'Mueve el teléfono para ver a los personajes en tu espacio';
            registrar('camara', 'Cámara AR activada');
        } catch (err) {
            $('arAyuda').textContent = 'No se dio permiso para usar la cámara.';
        }
    }
    function apagarCamara() {
        if (flujo) flujo.getTracks().forEach((t) => t.stop());
        flujo = null; video.srcObject = null;
        $('arEscena').classList.remove('modo-camara');
        escena.setAttribute('fog', NIEBLA);
        $('arEntorno').setAttribute('visible', true);
        $('btnCamara').setAttribute('aria-pressed', 'false');
        $('btnCamara').querySelector('span').textContent = 'Activar cámara AR';
        $('arAyuda').textContent = 'Arrastra para girar · rueda para acercar · clic en un personaje';
    }
    $('btnCamara').addEventListener('click', () => (flujo ? apagarCamara() : activarCamara()));

    /* ---------- WebXR inmersivo (Android con ARCore) ---------- */
    if (navigator.xr && navigator.xr.isSessionSupported) {
        navigator.xr.isSessionSupported('immersive-ar').then((ok) => {
            if (!ok) return;
            $('btnXR').hidden = false;
            $('btnXR').addEventListener('click', () => {
                if (flujo) apagarCamara();
                registrar('camara', 'Sesión WebXR iniciada');
                escena.enterAR();
            });
        }).catch(() => {});
    }
    escena.addEventListener('enter-vr', () => {
        if (escena.is('ar-mode')) {
            // En WebXR el visor del teléfono controla la cámara: se quita la órbita
            $('arRig').object3D.position.set(0, 0, 0); $('arRig').object3D.rotation.set(0, 0, 0);
            $('arPitch').object3D.position.set(0, 0, 0); $('arPitch').object3D.rotation.set(0, 0, 0);
            $('arCamara').object3D.position.set(0, 0, 0);
            $('arEntorno').setAttribute('visible', false);
            escena.removeAttribute('fog');
            $('arPersonajes').setAttribute('position', '0 -0.6 -2.8');
            $('arPersonajes').setAttribute('scale', '0.5 0.5 0.5');
        }
    });
    escena.addEventListener('exit-vr', () => {
        $('arRig').object3D.position.set(0, 0, -3.2); $('arPitch').object3D.position.set(0, 0.75, 0);
        $('arCamara').object3D.position.set(0, 0.55, 6); window.__arOrbita.aplicar();
        $('arEntorno').setAttribute('visible', true);
        escena.setAttribute('fog', NIEBLA);
        $('arPersonajes').setAttribute('position', '0 0 -3.2');
        $('arPersonajes').setAttribute('scale', '1 1 1');
    });
})();
