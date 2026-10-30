/* =========================================================
   main.js — inicialización, estados de juego y bucle principal
   ========================================================= */
(function () {
  const $ = id => document.getElementById(id);
  const G = DZ.game = { state: 'menu', baseFov: 75, time: 0, options: null, records: null, paused: false };

  /* ---------------- opciones y récords ---------------- */
  const DEF_OPTS = { master: 0.8, sfx: 0.9, amb: 0.5, sens: 1.0, fov: 75, quality: DZ.input.isTouch ? 0 : 1, invert: false };
  function load(key, def) { try { return Object.assign({}, def, JSON.parse(localStorage.getItem(key) || '{}')); } catch (e) { return Object.assign({}, def); } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { } }
  G.options = load('dz_options', DEF_OPTS);
  G.records = load('dz_records', { bestRound: 0, totalKills: 0, games: 0 });
  G.saveOptions = () => save('dz_options', G.options);

  /* ---------------- render ---------------- */
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080a);
  scene.fog = new THREE.FogExp2(0x0b0c10, 0.045);
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 120);
  scene.add(camera);
  G.renderer = renderer; G.scene = scene; G.camera = camera;

  scene.add(new THREE.HemisphereLight(0x7f8daa, 0x2a2018, 1.9));
  const moon = new THREE.DirectionalLight(0x9fb4d8, 0.9); moon.position.set(-20, 40, 10); scene.add(moon);
  scene.add(new THREE.AmbientLight(0x3a3f4a, 0.6));

  // cielo con estrellas (zonas exteriores)
  (function sky() {
    const n = 400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.1, r = 90; pos[i * 3] = 32 + Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = 26 + Math.sin(a) * Math.cos(e) * r; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const s = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9aa4b8, size: 0.6, fog: false })); scene.add(s);
  })();

  DZ.map.build(scene);
  DZ.fx.init(scene);
  DZ.zombies.init(scene);
  DZ.powerups.init(scene);
  DZ.weapons.init(camera, scene);
  DZ.input.bindCanvas(canvas);
  DZ.input.setupTouch();

  G.applyOptions = function () {
    const o = G.options; const A = DZ.audio;
    A.vol.master = o.master; A.vol.sfx = o.sfx; A.vol.amb = o.amb; A.applyVolume();
    DZ.input.sens = o.sens; DZ.input.invertY = !!o.invert; G.baseFov = o.fov;
    const q = +o.quality; const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(q === 0 ? Math.min(1, dpr) * 0.75 : q === 1 ? Math.min(1.25, dpr) : dpr);
    DZ.fx.quality = q === 0 ? 0.5 : q === 1 ? 0.8 : 1;
    scene.fog.density = q === 0 ? 0.055 : 0.045;
    camera.far = q === 0 ? 60 : 120; camera.updateProjectionMatrix();
    resize();
  };
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  /* ---------------- estados ---------------- */
  G.newGame = function () {
    DZ.zombies.clear(); DZ.fx.clear(); DZ.map.reset(); DZ.shop.reset(); DZ.powerups.clear(); DZ.medals.reset();
    DZ.player.reset(); DZ.weapons.reset(); DZ.economy.reset(); DZ.waves.reset();
    DZ.ui.perks(); DZ.ui.bossBar(false); DZ.input.clear();
    camera.fov = G.baseFov; G.time = 0;
    G.state = 'playing'; DZ.ui.show(null); DZ.input.lock();
    DZ.ui.toast('Sobrevive. Gana puntos. Abre la instalación.', 'info');
  };
  G.pause = function () {
    if (G.state !== 'playing') return;
    G.state = 'paused'; G.pausedAt = performance.now(); DZ.input.clear(); DZ.input.unlock();
    $('pause-stats').innerHTML = DZ.ui.statsHTML(); DZ.ui.show('pause');
  };
  G.resume = function () {
    if (G.state !== 'paused') return;
    G.state = 'playing'; DZ.ui.show(null); DZ.input.clear(); DZ.input.lock(); last = performance.now();
  };
  G.gameOver = function () {
    if (G.state !== 'playing') return;
    G.state = 'dying'; G.dieT = 0; DZ.shop.abortForge(); DZ.input.clear(); DZ.audio.gameOver();
    // guardar progreso global (no se borra al perder)
    const r = G.records; const isRecord = DZ.waves.round > r.bestRound;
    r.bestRound = Math.max(r.bestRound, DZ.waves.round); r.totalKills += DZ.zombies.kills; r.games++; save('dz_records', r);
    G._isRecord = isRecord;
  };
  G.toMenu = function () {
    DZ.shop.abortForge(); DZ.zombies.clear(); DZ.fx.clear(); DZ.powerups.clear(); G.state = 'menu'; DZ.input.unlock(); DZ.ui.records(); DZ.ui.panel(null); DZ.ui.show('menu');
  };

  /* ---------------- botones ---------------- */
  const startAudio = () => DZ.audio.init();
  $('btn-play').onclick = () => { startAudio(); G.applyOptions(); G.newGame(); };
  document.querySelectorAll('[data-panel]').forEach(b => b.onclick = () => { startAudio(); DZ.ui.panel(b.dataset.panel); });
  document.querySelectorAll('.panel .back').forEach(b => b.onclick = () => { DZ.ui.panel(null); if (G.state === 'paused') { DZ.ui.show('pause'); } });
  $('btn-resume').onclick = () => G.resume();
  $('btn-restart').onclick = () => { G.newGame(); };
  $('btn-quit').onclick = () => G.toMenu();
  $('btn-retry').onclick = () => { startAudio(); G.newGame(); };
  $('btn-go-menu').onclick = () => G.toMenu();
  $('btn-pause-opts').onclick = () => { DZ.ui.show('menu'); DZ.ui.panel('p-options'); $('hud').classList.remove('hidden'); };
  $('pause-btn').addEventListener('touchstart', e => { e.preventDefault(); G.pause(); });
  $('pause-btn').onclick = () => G.pause();

  DZ.ui.bindOptions(); G.applyOptions(); DZ.ui.records();
  DZ.player.reset(); DZ.weapons.reset();
  DZ.ui.show('menu');

  /* ---------------- bucle principal ---------------- */
  let last = performance.now(), menuCam = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    dt = Math.min(dt, 0.05); // evita saltos grandes al volver de otra pestaña
    G.step(dt);
    G.render();
  }
  G.step = function (dt) {
    const I = DZ.input;
    if (I.consume('pause')) { if (G.state === 'playing') G.pause(); else if (G.state === 'paused' && performance.now() - G.pausedAt > 400) G.resume(); }
    if (G.state === 'playing') {
      G.time += dt;
      DZ.player.update(dt, camera);
      DZ.weapons.update(dt);
      DZ.waves.update(dt);
      DZ.zombies.update(dt, G.time);
      DZ.powerups.update(dt, G.time);
      DZ.shop.update(dt);
      DZ.economy.update(dt);
      DZ.map.update(dt, G.time);
      DZ.fx.update(dt);
      DZ.ui.update(dt);
      $('click-hint').classList.toggle('hidden', I.locked || I.isTouch);
    } else if (G.state === 'dying') {
      G.dieT += dt; G.time += dt;
      // cámara cae al suelo; los zombis siguen moviéndose pero no hay combate
      camera.position.y = Math.max(0.35, camera.position.y - dt * 2.2); camera.rotation.z = Math.min(1.2, camera.rotation.z + dt * 1.5);
      DZ.zombies.update(dt, G.time); DZ.fx.update(dt); DZ.map.update(dt, G.time);
      if (G.dieT > 2.2) { G.state = 'over'; DZ.input.unlock(); DZ.ui.gameOver(G._isRecord); }
    } else if (G.state === 'menu') {
      // cámara de menú recorriendo el patio
      menuCam += dt * 0.08;
      camera.position.set(14 + Math.cos(menuCam) * 8, 2.4, 38 + Math.sin(menuCam) * 6); camera.lookAt(16, 1.6, 26);
      DZ.map.update(dt, menuCam * 10); DZ.fx.update(dt);
    } else if (G.state === 'over') { DZ.zombies.update(dt, G.time); DZ.map.update(dt, G.time); }
    $('click-hint').classList.toggle('hidden', G.state !== 'playing' || I.locked || I.isTouch);
  };
  G.render = function () {
    renderer.clear();
    renderer.render(scene, camera);
    if (G.state === 'playing' || G.state === 'paused') { renderer.clearDepth(); renderer.render(DZ.weapons.vmScene, DZ.weapons.vmCam); }
  };
  requestAnimationFrame(frame);

  /* ---------------- ganchos de depuración / pruebas ----------------
     Disponibles desde la consola del navegador: DZ.debug.points(5000), etc. */
  DZ.debug = {
    points(n) { DZ.economy.add(n, 'bonus', null, true); },
    skipRound() { DZ.zombies.list.filter(z => !z.dead).forEach(z => DZ.zombies.kill(z, false)); while (DZ.waves.spawned < DZ.waves.total) { DZ.waves.spawned++; DZ.waves.killed++; } if (DZ.waves.state === 'active' && DZ.waves.killed >= DZ.waves.total) DZ.waves.endRound(); },
    goRound(r) { DZ.waves.round = r - 1; DZ.waves.state = 'break'; DZ.waves.timer = 0.1; },
    tp(tx, tz) { DZ.player.pos.set(DZ.map.center(tx), 0, DZ.map.center(tz)); },
    god(on) { DZ.player.invuln = on ? 1e9 : 0; },
    state() { return { state: G.state, round: DZ.waves.round, waveState: DZ.waves.state, alive: DZ.zombies.alive(), objects: DZ.zombies.list.length, particles: DZ.fx.activeCount(), points: DZ.economy.points, hp: DZ.player.health, kills: DZ.zombies.kills, sceneChildren: scene.children.length }; }
  };
})();
