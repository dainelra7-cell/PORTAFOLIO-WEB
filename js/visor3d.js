/* ==========================================================================
   Visor 3D del portafolio — Dainel Ramirez
   - Carga modelos .glb (malla + texturas PBR) con Three.js (js/lib/three.min.js).
   - Arrastra para girar 360°, rueda o pellizco para acercar, doble clic para
     reiniciar. Gira solo mientras nadie lo toca.
   - Cada visor se inicia cuando aparece en pantalla (no carga los 3 a la vez).
   Uso:  <div class="visor3d" data-modelo="assets/modelos/ryu.glb"></div>
   ========================================================================== */
(() => {
    'use strict';
    if (!window.THREE) return;
    const T = window.THREE;

    /* ---------- Lector GLB mínimo (malla única + material PBR) ---------- */
    // Abierto con doble clic (file://) el navegador bloquea fetch: se usa la
    // copia en JavaScript del modelo (assets/modelos/*.glb.js).
    function cargarCopiaJS(url) {
        return new Promise((resolve, reject) => {
            const guardado = () => window.MODELOS_3D && window.MODELOS_3D[url];
            const decodificar = () => {
                const b64 = guardado(); const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                resolve(bytes.buffer);
            };
            if (guardado()) return decodificar();
            const s = document.createElement('script');
            s.src = url + '.js';
            s.onload = () => (guardado() ? decodificar() : reject(new Error('Copia vacía: ' + url)));
            s.onerror = () => reject(new Error('No se encontró ' + s.src));
            document.head.appendChild(s);
        });
    }

    async function leerArchivo(url, onProgreso) {
        if (location.protocol === 'file:') return cargarCopiaJS(url);
        try {
            return await descargar(url, onProgreso);
        } catch (e) {
            return cargarCopiaJS(url);
        }
    }

    async function descargar(url, onProgreso) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('No se pudo cargar ' + url);
        const total = Number(resp.headers.get('content-length')) || 0;
        let buf;
        if (resp.body && total && onProgreso) {
            const lector = resp.body.getReader();
            const partes = []; let recibido = 0;
            for (;;) {
                const { done, value } = await lector.read();
                if (done) break;
                partes.push(value); recibido += value.length;
                onProgreso(recibido / total);
            }
            const todo = new Uint8Array(recibido); let o = 0;
            for (const p of partes) { todo.set(p, o); o += p.length; }
            buf = todo.buffer;
        } else {
            buf = await resp.arrayBuffer();
        }
        return buf;
    }

    async function cargarGLB(url, onProgreso) {
        const buf = await leerArchivo(url, onProgreso);
        const dv = new DataView(buf);
        if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('El archivo no es GLB');
        const jsonLen = dv.getUint32(12, true);
        const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
        const binStart = 20 + jsonLen + 8;

        const vista = (i) => {
            const v = json.bufferViews[i];
            return { offset: binStart + (v.byteOffset || 0), length: v.byteLength };
        };
        const TIPOS = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array };
        const COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
        const accesor = (i) => {
            const a = json.accessors[i]; const v = vista(a.bufferView);
            const Tipo = TIPOS[a.componentType];
            return new Tipo(buf.slice(v.offset, v.offset + a.count * COMPS[a.type] * Tipo.BYTES_PER_ELEMENT));
        };

        const textura = async (indice, color) => {
            const img = json.images[json.textures[indice].source];
            const v = vista(img.bufferView);
            const blob = new Blob([new Uint8Array(buf, v.offset, v.length)], { type: img.mimeType });
            const bitmap = await createImageBitmap(blob, { imageOrientation: 'none' });
            const tex = new T.Texture(bitmap);
            tex.flipY = false;
            tex.wrapS = tex.wrapT = T.RepeatWrapping;
            if (color) tex.colorSpace = T.SRGBColorSpace;
            tex.needsUpdate = true;
            return tex;
        };

        const prim = json.meshes[0].primitives[0];
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.BufferAttribute(accesor(prim.attributes.POSITION), 3));
        if (prim.attributes.NORMAL !== undefined)
            geo.setAttribute('normal', new T.BufferAttribute(accesor(prim.attributes.NORMAL), 3));
        geo.setAttribute('uv', new T.BufferAttribute(accesor(prim.attributes.TEXCOORD_0), 2));
        geo.setIndex(new T.BufferAttribute(accesor(prim.indices), 1));
        if (prim.attributes.NORMAL === undefined) geo.computeVertexNormals();

        const def = json.materials[prim.material] || {};
        const pbr = def.pbrMetallicRoughness || {};
        const mat = new T.MeshStandardMaterial({
            metalness: pbr.metallicFactor ?? 1,
            roughness: pbr.roughnessFactor ?? 1,
        });
        const tareas = [];
        if (pbr.baseColorTexture) tareas.push(textura(pbr.baseColorTexture.index, true).then(t => { mat.map = t; }));
        if (pbr.metallicRoughnessTexture) tareas.push(textura(pbr.metallicRoughnessTexture.index, false).then(t => { mat.metalnessMap = t; mat.roughnessMap = t; }));
        if (def.normalTexture) tareas.push(textura(def.normalTexture.index, false).then(t => {
            mat.normalMap = t;
            const s = def.normalTexture.scale ?? 1;
            mat.normalScale.set(s, -s); // sin tangentes: misma convención que GLTFLoader
        }));
        await Promise.all(tareas);
        mat.needsUpdate = true;
        return new T.Mesh(geo, mat);
    }

    /* ---------- Entorno de estudio para los reflejos metálicos ---------- */
    function crearEntorno(renderer) {
        const s = new T.Scene();
        const caja = new T.Mesh(new T.BoxGeometry(10, 10, 10),
            new T.MeshBasicMaterial({ color: 0x2a2a30, side: T.BackSide }));
        s.add(caja);
        const panel = (color, inten, w, h, pos) => {
            const m = new T.Mesh(new T.PlaneGeometry(w, h),
                new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(inten), side: T.DoubleSide }));
            m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
        };
        panel(0xffffff, 3.2, 4, 3, [3, 3, 4]);     // luz principal
        panel(0xdde6ff, 1.6, 4, 3, [-4.5, 1.5, 2]); // relleno
        panel(0xffffff, 2.4, 3, 4, [0, 3, -4.5]);   // contraluz
        panel(0xffffff, 1.2, 8, 8, [0, 4.9, 0]);    // techo
        const pm = new T.PMREMGenerator(renderer);
        const env = pm.fromScene(s, 0.04).texture;
        pm.dispose();
        return env;
    }

    function sombraSuave() {
        const c = document.createElement('canvas'); c.width = c.height = 128;
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, 'rgba(0,0,0,0.55)');
        gr.addColorStop(0.55, 'rgba(0,0,0,0.22)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        const t = new T.CanvasTexture(c);
        return new T.Mesh(new T.PlaneGeometry(1, 1),
            new T.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    }

    /* ---------- Un visor ---------- */
    function iniciarVisor(el) {
        const url = el.dataset.modelo;
        const reducirMov = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const lienzo = document.createElement('canvas');
        lienzo.className = 'visor3d-lienzo';
        lienzo.setAttribute('aria-label', el.dataset.etiqueta || 'Modelo 3D interactivo');
        lienzo.setAttribute('role', 'img');
        el.prepend(lienzo);

        const estado = el.querySelector('.visor3d-estado');
        const barra = el.querySelector('.visor3d-barra span');

        let renderer;
        try {
            renderer = new T.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: 'high-performance' });
        } catch (e) {
            el.classList.add('visor3d--error');
            if (estado) estado.querySelector('p').textContent = 'Tu navegador no tiene WebGL activado.';
            return;
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;

        const escena = new T.Scene();
        escena.environment = crearEntorno(renderer);
        const camara = new T.PerspectiveCamera(32, 1, 0.01, 50);

        const luz = new T.DirectionalLight(0xffffff, 1.6); luz.position.set(2, 4, 3); escena.add(luz);
        const contra = new T.DirectionalLight(0xffffff, 1.1); contra.position.set(-2, 2.5, -3); escena.add(contra);
        escena.add(new T.HemisphereLight(0xffffff, 0x222228, 0.5));

        const pivote = new T.Group(); escena.add(pivote);
        const sombra = sombraSuave(); sombra.rotation.x = -Math.PI / 2; escena.add(sombra);

        // Cámara orbital
        let rotY = parseFloat(el.dataset.giroInicial || '0') * Math.PI / 180;
        let rotX = 0.12, velY = 0, zoom = 1, radioBase = 3, centroY = 0.5;
        let arrastrando = false, ultimoX = 0, ultimoY = 0, ultimoToque = 0;
        let autoGiro = !reducirMov;
        const btnAuto = el.querySelector('[data-accion="auto"]');
        const btnReset = el.querySelector('[data-accion="reiniciar"]');
        const syncAuto = () => {
            if (!btnAuto) return;
            btnAuto.setAttribute('aria-pressed', String(autoGiro));
            btnAuto.title = autoGiro ? 'Pausar giro automático' : 'Activar giro automático';
        };
        syncAuto();

        const reiniciar = () => { rotY = 0; rotX = 0.12; zoom = 1; velY = 0; };

        const ajustar = () => {
            const w = el.clientWidth, h = el.clientHeight;
            if (!w || !h) return;
            renderer.setSize(w, h, false);
            camara.aspect = w / h; camara.updateProjectionMatrix();
        };
        new ResizeObserver(ajustar).observe(el);
        ajustar();

        lienzo.addEventListener('pointerdown', (e) => {
            arrastrando = true; ultimoX = e.clientX; ultimoY = e.clientY; velY = 0;
            ultimoToque = performance.now();
            lienzo.setPointerCapture(e.pointerId);
            el.classList.add('visor3d--arrastrando');
        });
        lienzo.addEventListener('pointermove', (e) => {
            if (!arrastrando) return;
            const dx = e.clientX - ultimoX, dy = e.clientY - ultimoY;
            ultimoX = e.clientX; ultimoY = e.clientY;
            velY = dx * 0.008; rotY += velY;
            rotX = Math.max(-0.15, Math.min(0.75, rotX + dy * 0.005));
            ultimoToque = performance.now();
        });
        const soltar = () => { arrastrando = false; el.classList.remove('visor3d--arrastrando'); };
        lienzo.addEventListener('pointerup', soltar);
        lienzo.addEventListener('pointercancel', soltar);
        lienzo.addEventListener('dblclick', reiniciar);
        lienzo.addEventListener('wheel', (e) => {
            e.preventDefault();
            zoom = Math.max(0.55, Math.min(1.5, zoom * (1 + Math.sign(e.deltaY) * 0.08)));
            ultimoToque = performance.now();
        }, { passive: false });
        // Pellizco en el teléfono
        const toques = new Map(); let distInicial = 0, zoomInicial = 1;
        lienzo.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') toques.set(e.pointerId, e); });
        lienzo.addEventListener('pointermove', (e) => {
            if (!toques.has(e.pointerId)) return;
            toques.set(e.pointerId, e);
            if (toques.size === 2) {
                const [a, b] = [...toques.values()];
                const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
                if (!distInicial) { distInicial = d; zoomInicial = zoom; }
                zoom = Math.max(0.55, Math.min(1.5, zoomInicial * distInicial / d));
            }
        });
        const finToque = (e) => { toques.delete(e.pointerId); if (toques.size < 2) distInicial = 0; };
        lienzo.addEventListener('pointerup', finToque);
        lienzo.addEventListener('pointercancel', finToque);

        if (btnAuto) btnAuto.addEventListener('click', () => { autoGiro = !autoGiro; syncAuto(); });
        if (btnReset) btnReset.addEventListener('click', reiniciar);

        // Teclado: flechas para girar
        el.tabIndex = 0;
        el.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') { rotY -= 0.2; ultimoToque = performance.now(); }
            else if (e.key === 'ArrowRight') { rotY += 0.2; ultimoToque = performance.now(); }
            else return;
            e.preventDefault();
        });

        // Solo dibuja mientras el visor está en pantalla
        let visible = true;
        new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0 }).observe(el);

        let listo = false;
        const reloj = new T.Clock();
        const dibujar = () => {
            requestAnimationFrame(dibujar);
            const dt = Math.min(reloj.getDelta(), 0.05);
            if (!visible || !listo) return;
            if (!arrastrando) {
                velY *= 0.92; rotY += velY;
                if (autoGiro && performance.now() - ultimoToque > 2500) rotY += dt * 0.45;
            }
            const r = radioBase * zoom;
            camara.position.set(
                Math.sin(rotY) * Math.cos(rotX) * r,
                centroY + Math.sin(rotX) * r,
                Math.cos(rotY) * Math.cos(rotX) * r);
            camara.lookAt(0, centroY, 0);
            renderer.render(escena, camara);
        };
        requestAnimationFrame(dibujar);

        cargarGLB(url, (p) => { if (barra) barra.style.width = Math.round(p * 100) + '%'; })
            .then((malla) => {
                const caja = new T.Box3().setFromObject(malla);
                const tam = caja.getSize(new T.Vector3());
                const centro = caja.getCenter(new T.Vector3());
                malla.position.set(-centro.x, -caja.min.y, -centro.z);
                pivote.add(malla);
                const alto = tam.y, ancho = Math.max(tam.x, tam.z);
                centroY = alto * 0.5;
                const ajusteV = (alto * 0.62) / Math.tan(T.MathUtils.degToRad(camara.fov / 2));
                const ajusteH = (ancho * 0.62) / Math.tan(T.MathUtils.degToRad(camara.fov / 2)) / Math.max(camara.aspect, 0.6);
                radioBase = Math.max(ajusteV, ajusteH);
                sombra.scale.set(ancho * 1.25, ancho * 1.25, 1);
                sombra.position.y = 0.001;
                listo = true;
                el.classList.add('visor3d--listo');
            })
            .catch((err) => {
                console.error(err);
                el.classList.add('visor3d--error');
                if (estado) estado.querySelector('p').textContent = 'No se pudo cargar el modelo.';
            });
    }

    // Funciones compartidas con el visor de animaciones (js/visor-animaciones.js)
    window.Visor3D = { leerArchivo, crearEntorno, sombraSuave };

    /* ---------- Arranque perezoso ---------- */
    const visores = document.querySelectorAll('.visor3d[data-modelo]');
    if (!('IntersectionObserver' in window)) { visores.forEach(iniciarVisor); return; }
    const obs = new IntersectionObserver((entradas) => {
        entradas.forEach((en) => {
            if (en.isIntersecting) { obs.unobserve(en.target); iniciarVisor(en.target); }
        });
    }, { rootMargin: '300px 0px' });
    visores.forEach((v) => obs.observe(v));
})();
