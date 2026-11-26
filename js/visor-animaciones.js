/* ==========================================================================
   Visor de animaciones 360° — Dainel Ramirez
   Abre una ventana con el personaje animado (esqueleto + animaciones de
   Blender en un .glb). Se elige la animación en la lista, se arrastra para
   girar 360°, rueda o pellizco para acercar.
   Uso: <button data-animaciones="assets/modelos/ryu_animado.glb"
                data-nombre="RYU" data-color="#79C24A" data-raiz="Hips">
   Necesita js/lib/three.min.js y js/visor3d.js (cargados antes).
   ========================================================================== */
(() => {
    'use strict';
    if (!window.THREE || !window.Visor3D) return;
    const T = window.THREE;
    const { leerArchivo, crearEntorno, sombraSuave } = window.Visor3D;

    /* ---------- Lector glTF/GLB: jerarquía, piel, materiales y animaciones ---------- */
    const TIPOS = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array, 5122: Int16Array, 5120: Int8Array };
    const COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
    const limpiarNombre = (n) => T.PropertyBinding.sanitizeNodeName(n || 'nodo');

    async function cargarAnimado(url, onProgreso) {
        const buf = await leerArchivo(url, onProgreso);
        const dv = new DataView(buf);
        if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('El archivo no es GLB');
        const jsonLen = dv.getUint32(12, true);
        const J = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
        const bin = 20 + jsonLen + 8;

        const accesor = (i) => {
            const a = J.accessors[i]; const v = J.bufferViews[a.bufferView];
            const Tipo = TIPOS[a.componentType]; const n = COMPS[a.type];
            const ini = bin + (v.byteOffset || 0) + (a.byteOffset || 0);
            return { datos: new Tipo(buf.slice(ini, ini + a.count * n * Tipo.BYTES_PER_ELEMENT)), n, normalizado: !!a.normalized };
        };

        // Texturas
        const cacheTex = {};
        const textura = (info, color) => {
            const clave = info.index + (color ? 'c' : 'l');
            if (cacheTex[clave]) return cacheTex[clave];
            const img = J.images[J.textures[info.index].source];
            const v = J.bufferViews[img.bufferView];
            const blob = new Blob([new Uint8Array(buf, bin + (v.byteOffset || 0), v.byteLength)], { type: img.mimeType });
            cacheTex[clave] = createImageBitmap(blob, { imageOrientation: 'none' }).then((bm) => {
                const t = new T.Texture(bm);
                t.flipY = false; t.wrapS = t.wrapT = T.RepeatWrapping;
                if (color) t.colorSpace = T.SRGBColorSpace;
                t.needsUpdate = true; return t;
            });
            return cacheTex[clave];
        };
        const tareas = [];
        const materiales = (J.materials || []).map((m) => {
            const p = m.pbrMetallicRoughness || {};
            const mat = new T.MeshStandardMaterial({
                name: m.name || '',
                metalness: p.metallicFactor ?? 1, roughness: p.roughnessFactor ?? 1,
                side: m.doubleSided ? T.DoubleSide : T.FrontSide,
            });
            if (p.baseColorFactor) { mat.color.setRGB(...p.baseColorFactor.slice(0, 3)); }
            if (p.baseColorTexture) tareas.push(textura(p.baseColorTexture, true).then((t) => { mat.map = t; }));
            if (p.metallicRoughnessTexture) tareas.push(textura(p.metallicRoughnessTexture, false).then((t) => { mat.metalnessMap = t; mat.roughnessMap = t; }));
            if (m.normalTexture) tareas.push(textura(m.normalTexture, false).then((t) => {
                mat.normalMap = t; const s = m.normalTexture.scale ?? 1; mat.normalScale.set(s, -s);
            }));
            return mat;
        });
        const matDefecto = new T.MeshStandardMaterial({ color: 0x888888, roughness: 0.6 });

        // Nodos (los huesos como T.Bone)
        const huesos = new Set(); (J.skins || []).forEach((s) => s.joints.forEach((j) => huesos.add(j)));
        const usados = {};
        const nodos = J.nodes.map((n, i) => {
            const o = huesos.has(i) ? new T.Bone() : new T.Object3D();
            let nombre = limpiarNombre(n.name || ('nodo_' + i));
            if (usados[nombre]) nombre += '_' + i;
            usados[nombre] = true;
            o.name = nombre;
            if (n.translation) o.position.fromArray(n.translation);
            if (n.rotation) o.quaternion.fromArray(n.rotation);
            if (n.scale) o.scale.fromArray(n.scale);
            return o;
        });
        J.nodes.forEach((n, i) => (n.children || []).forEach((c) => nodos[i].add(nodos[c])));

        // Mallas
        const geometria = (p) => {
            const g = new T.BufferGeometry();
            const nombres = { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', JOINTS_0: 'skinIndex', WEIGHTS_0: 'skinWeight' };
            for (const [k, ai] of Object.entries(p.attributes)) {
                if (!nombres[k]) continue;
                const a = accesor(ai);
                g.setAttribute(nombres[k], new T.BufferAttribute(a.datos, a.n, a.normalizado));
            }
            if (p.indices !== undefined) g.setIndex(new T.BufferAttribute(accesor(p.indices).datos, 1));
            if (!g.attributes.normal) g.computeVertexNormals();
            return g;
        };
        const pieles = [];
        J.nodes.forEach((n, i) => {
            if (n.mesh === undefined) return;
            const prims = J.meshes[n.mesh].primitives;
            prims.forEach((p) => {
                const g = geometria(p);
                const mat = p.material !== undefined ? materiales[p.material] : matDefecto;
                let m;
                if (n.skin !== undefined) { m = new T.SkinnedMesh(g, mat); pieles.push({ malla: m, skin: J.skins[n.skin] }); }
                else m = new T.Mesh(g, mat);
                m.frustumCulled = false;
                nodos[i].add(m);
            });
        });

        const raiz = new T.Group();
        (J.scenes[J.scene || 0].nodes).forEach((i) => raiz.add(nodos[i]));
        raiz.updateMatrixWorld(true);
        pieles.forEach(({ malla, skin }) => {
            const bones = skin.joints.map((j) => nodos[j]);
            const inv = accesor(skin.inverseBindMatrices).datos;
            const inversas = bones.map((_, k) => new T.Matrix4().fromArray(inv, k * 16));
            // glTF: la transformación del nodo de una malla con piel se ignora → matriz de enlace identidad
            malla.bind(new T.Skeleton(bones, inversas), new T.Matrix4());
        });

        // Animaciones
        const clips = (J.animations || []).map((a) => {
            const pistas = [];
            a.channels.forEach((c) => {
                const s = a.samplers[c.sampler];
                const t = accesor(s.input).datos; const v = accesor(s.output).datos;
                const nombre = nodos[c.target.node].name;
                const interp = s.interpolation === 'STEP' ? T.InterpolateDiscrete : T.InterpolateLinear;
                if (c.target.path === 'rotation') pistas.push(new T.QuaternionKeyframeTrack(nombre + '.quaternion', t, v, interp));
                else if (c.target.path === 'translation') pistas.push(new T.VectorKeyframeTrack(nombre + '.position', t, v, interp));
                else if (c.target.path === 'scale') pistas.push(new T.VectorKeyframeTrack(nombre + '.scale', t, v, interp));
            });
            const clip = new T.AnimationClip(a.name, -1, pistas);
            clip.userData = a.extras || {};
            return clip;
        });

        await Promise.all(tareas);
        const espadaIdx = J.nodes.findIndex((n) => n.name === 'Espada');
        return { raiz, clips, nodos, espada: espadaIdx >= 0 ? nodos[espadaIdx] : null };
    }

    /* ---------- Ventana ---------- */
    let modal = null;
    function crearModal() {
        const d = document.createElement('dialog');
        d.className = 'anim-modal';
        d.setAttribute('aria-labelledby', 'animTitulo');
        d.innerHTML = `
            <div class="anim-panel">
                <header class="anim-cabecera">
                    <div>
                        <p class="anim-kicker">Animaciones · 360°</p>
                        <h2 id="animTitulo"></h2>
                    </div>
                    <button type="button" class="anim-cerrar" aria-label="Cerrar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
                    </button>
                </header>
                <div class="anim-cuerpo">
                    <div class="anim-visor visor3d" tabindex="0">
                        <div class="visor3d-estado"><div class="visor3d-barra"><span></span></div><p>CARGANDO ANIMACIONES</p></div>
                        <span class="visor3d-ayuda">↔ Arrastra para girar</span>
                        <div class="visor3d-controles">
                            <button type="button" data-accion="pausa" aria-label="Pausar o reproducir la animación" aria-pressed="false" title="Pausar animación">
                                <svg class="ico-pausa" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                                <svg class="ico-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z"/></svg>
                            </button>
                            <button type="button" data-accion="vel" aria-label="Cambiar velocidad" title="Velocidad">1×</button>
                            <button type="button" data-accion="giro" aria-label="Activar o pausar el giro automático de la cámara" aria-pressed="false" title="Giro automático">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>
                            </button>
                        </div>
                        <div class="anim-progreso" aria-hidden="true"><span></span></div>
                    </div>
                    <div class="anim-lista" role="listbox" aria-label="Animaciones"></div>
                </div>
            </div>`;
        document.body.appendChild(d);
        d.addEventListener('click', (e) => { if (e.target === d) cerrar(); });
        d.querySelector('.anim-cerrar').addEventListener('click', cerrar);
        d.addEventListener('close', () => { if (estado) estado.activo = false; document.documentElement.classList.remove('anim-abierto'); });
        return d;
    }

    let estado = null;   // visor activo
    const cache = {};    // modelos ya cargados (por url)

    function cerrar() { if (modal && modal.open) modal.close(); }

    function abrir(btn) {
        if (!modal) modal = crearModal();
        const url = btn.dataset.animaciones;
        modal.style.setProperty('--c', btn.dataset.color || 'var(--accent)');
        modal.querySelector('#animTitulo').textContent = btn.dataset.nombre || '';
        const visor = modal.querySelector('.anim-visor');
        const lista = modal.querySelector('.anim-lista');
        lista.innerHTML = '';
        visor.classList.remove('visor3d--listo', 'visor3d--error');
        visor.querySelector('.visor3d-estado p').textContent = 'CARGANDO ANIMACIONES';
        visor.querySelector('.visor3d-barra span').style.width = '0%';
        if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
        document.documentElement.classList.add('anim-abierto');
        if (!estado) estado = iniciarVisor(visor);
        estado.activo = true;
        estado.mostrar(url, btn.dataset.raiz || '', lista);
    }

    function iniciarVisor(el) {
        const lienzo = document.createElement('canvas');
        lienzo.className = 'visor3d-lienzo';
        lienzo.setAttribute('role', 'img');
        lienzo.setAttribute('aria-label', 'Personaje animado, se puede girar arrastrando');
        el.prepend(lienzo);
        const barra = el.querySelector('.visor3d-barra span');
        const progreso = el.querySelector('.anim-progreso span');

        const renderer = new T.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        const escena = new T.Scene();
        escena.environment = crearEntorno(renderer);
        const camara = new T.PerspectiveCamera(32, 1, 0.01, 100);
        const luz = new T.DirectionalLight(0xffffff, 1.6); luz.position.set(2, 4, 3); escena.add(luz);
        const contra = new T.DirectionalLight(0xffffff, 1.1); contra.position.set(-2, 2.5, -3); escena.add(contra);
        escena.add(new T.HemisphereLight(0xffffff, 0x222228, 0.5));
        const sombra = sombraSuave(); sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.001; escena.add(sombra);
        const contenedor = new T.Group(); escena.add(contenedor);   // se desplaza para dejar al personaje en el sitio
        const piso = new T.GridHelper(6, 24, 0x666670, 0x34343a);
        piso.material.transparent = true; piso.material.opacity = 0.35; escena.add(piso);

        const S = {
            activo: true, mixer: null, accion: null, modelo: null, raizHueso: null,
            rotY: 0.5, rotX: 0.14, zoom: 1, radio: 3, centroY: 0.9, velY: 0,
            pausa: false, vel: 1, giro: false, arrastrando: false, ultimoToque: 0,
        };

        const ajustar = () => {
            const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
            renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix();
        };
        new ResizeObserver(ajustar).observe(el); ajustar();

        // Controles de cámara
        let ux = 0, uy = 0; const toques = new Map(); let dist0 = 0, zoom0 = 1;
        lienzo.addEventListener('pointerdown', (e) => {
            S.arrastrando = true; ux = e.clientX; uy = e.clientY; S.velY = 0; S.ultimoToque = performance.now();
            lienzo.setPointerCapture(e.pointerId); el.classList.add('visor3d--arrastrando');
            if (e.pointerType === 'touch') toques.set(e.pointerId, e);
        });
        lienzo.addEventListener('pointermove', (e) => {
            if (toques.has(e.pointerId)) {
                toques.set(e.pointerId, e);
                if (toques.size === 2) {
                    const [a, b] = [...toques.values()];
                    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
                    if (!dist0) { dist0 = d; zoom0 = S.zoom; }
                    S.zoom = Math.max(0.5, Math.min(1.8, zoom0 * dist0 / d)); return;
                }
            }
            if (!S.arrastrando) return;
            const dx = e.clientX - ux, dy = e.clientY - uy; ux = e.clientX; uy = e.clientY;
            S.velY = -dx * 0.008; S.rotY += S.velY;
            S.rotX = Math.max(-0.1, Math.min(0.8, S.rotX + dy * 0.005));
            S.ultimoToque = performance.now();
        });
        const soltar = (e) => { S.arrastrando = false; el.classList.remove('visor3d--arrastrando'); toques.delete(e.pointerId); if (toques.size < 2) dist0 = 0; };
        lienzo.addEventListener('pointerup', soltar);
        lienzo.addEventListener('pointercancel', soltar);
        lienzo.addEventListener('wheel', (e) => {
            e.preventDefault(); S.zoom = Math.max(0.5, Math.min(1.8, S.zoom * (1 + Math.sign(e.deltaY) * 0.08)));
        }, { passive: false });
        lienzo.addEventListener('dblclick', () => { S.rotY = 0.5; S.rotX = 0.14; S.zoom = 1; });
        el.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') S.rotY += 0.2; else if (e.key === 'ArrowRight') S.rotY -= 0.2;
            else if (e.key === ' ') { e.preventDefault(); botones.pausa.click(); return; } else return;
            e.preventDefault();
        });

        const botones = {
            pausa: el.querySelector('[data-accion="pausa"]'),
            vel: el.querySelector('[data-accion="vel"]'),
            giro: el.querySelector('[data-accion="giro"]'),
        };
        botones.pausa.addEventListener('click', () => {
            S.pausa = !S.pausa; botones.pausa.setAttribute('aria-pressed', String(S.pausa));
            botones.pausa.title = S.pausa ? 'Reproducir animación' : 'Pausar animación';
        });
        const velocidades = [1, 0.5, 0.25, 2];
        botones.vel.addEventListener('click', () => {
            S.vel = velocidades[(velocidades.indexOf(S.vel) + 1) % velocidades.length];
            botones.vel.textContent = (S.vel === 0.25 ? '¼' : S.vel === 0.5 ? '½' : S.vel) + '×';
            if (S.mixer) S.mixer.timeScale = S.vel;
        });
        botones.giro.addEventListener('click', () => { S.giro = !S.giro; botones.giro.setAttribute('aria-pressed', String(S.giro)); });

        // Cambiar de animación
        S.reproducir = (clip, boton) => {
            if (!S.mixer) return;
            const nueva = S.mixer.clipAction(clip);
            nueva.reset(); nueva.setLoop(T.LoopRepeat, Infinity); nueva.enabled = true;
            if (S.accion && S.accion !== nueva) nueva.crossFadeFrom(S.accion, 0.25, false);
            nueva.play(); S.accion = nueva;
            if (S.espada) S.espada.visible = !!clip.userData.espada;
            S.lista.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b === boton)));
            if (S.pausa) botones.pausa.click();
        };

        S.mostrar = async (url, nombreRaiz, lista) => {
            S.lista = lista; S.url = url;
            if (S.modelo) { contenedor.remove(S.modelo); S.modelo = null; S.mixer = null; S.accion = null; }
            try {
                if (!cache[url]) cache[url] = cargarAnimado(url, (p) => { barra.style.width = Math.round(p * 100) + '%'; });
                const datos = await cache[url];
                if (S.url !== url) return;
                const modelo = datos.raiz;
                contenedor.position.set(0, 0, 0);
                contenedor.add(modelo); S.modelo = modelo;
                S.espada = datos.espada; if (S.espada) S.espada.visible = false;
                S.mixer = new T.AnimationMixer(modelo); S.mixer.timeScale = S.vel;
                const raizLimpia = limpiarNombre(nombreRaiz);
                S.raizHueso = datos.nodos.find((n) => n.name === raizLimpia || n.name.endsWith(raizLimpia)) || null;

                // Encuadre con la pose de reposo
                modelo.updateMatrixWorld(true);
                const caja = new T.Box3().setFromObject(modelo, true);
                const tam = caja.getSize(new T.Vector3());
                const alto = Math.max(tam.y, 0.3), ancho = Math.max(tam.x, tam.z);
                S.centroY = alto * 0.5; S.alto = alto;
                const fov = T.MathUtils.degToRad(camara.fov / 2);
                S.radio = Math.max((alto * 0.95) / Math.tan(fov), (ancho * 0.9) / Math.tan(fov) / Math.max(camara.aspect, 0.6));
                sombra.scale.set(ancho * 1.3, ancho * 1.3, 1);
                piso.scale.setScalar(Math.max(alto, ancho) / 2);

                lista.innerHTML = '';
                datos.clips.forEach((clip, i) => {
                    const b = document.createElement('button');
                    b.type = 'button'; b.setAttribute('role', 'option');
                    b.innerHTML = `<span class="num">${String(i + 1).padStart(2, '0')}</span><span class="tit">${clip.name}</span><span class="dur">${clip.duration.toFixed(1)} s</span>`;
                    b.addEventListener('click', () => S.reproducir(clip, b));
                    lista.appendChild(b);
                });
                if (datos.clips.length) S.reproducir(datos.clips[0], lista.querySelector('button'));
                el.classList.add('visor3d--listo');
            } catch (err) {
                console.error(err);
                delete cache[url];
                el.classList.add('visor3d--error');
                el.querySelector('.visor3d-estado p').textContent = 'No se pudo cargar las animaciones.';
            }
        };

        const reloj = new T.Clock();
        const pos = new T.Vector3();
        const dibujar = () => {
            requestAnimationFrame(dibujar);
            const dt = Math.min(reloj.getDelta(), 0.05);
            if (!S.activo || !S.modelo) return;
            if (S.mixer && !S.pausa) S.mixer.update(dt);
            // Mantiene al personaje en el centro (quita el avance horizontal de la animación)
            if (S.raizHueso) {
                contenedor.position.set(0, 0, 0); contenedor.updateMatrixWorld(true);
                S.raizHueso.getWorldPosition(pos);
                contenedor.position.set(-pos.x, 0, -pos.z);
            }
            if (!S.arrastrando) {
                S.velY *= 0.92; S.rotY += S.velY;
                if (S.giro && performance.now() - S.ultimoToque > 1500) S.rotY += dt * 0.45;
            }
            const r = S.radio * S.zoom;
            camara.position.set(Math.sin(S.rotY) * Math.cos(S.rotX) * r, S.centroY + Math.sin(S.rotX) * r, Math.cos(S.rotY) * Math.cos(S.rotX) * r);
            camara.lookAt(0, S.centroY, 0);
            if (S.accion && progreso) {
                const c = S.accion.getClip(); progreso.style.width = ((S.accion.time % c.duration) / c.duration * 100) + '%';
            }
            renderer.render(escena, camara);
        };
        requestAnimationFrame(dibujar);
        window.__visorAnimaciones = S; // útil para depurar desde la consola
        return S;
    }

    document.querySelectorAll('[data-animaciones]').forEach((btn) => btn.addEventListener('click', () => abrir(btn)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal && modal.open) cerrar(); });
})();
