/* =========================================================
   weapons.js — modelos de armas, estadísticas, disparo
   (raycast desde la cámara), recarga, mejoras y vista en 1ª persona
   ========================================================= */
(function () {
  const C = DZ.CONFIG;
  const WP = DZ.weapons = { shotId: 0, meleeT: 0, meleeCd: 0, slots: [], cur: 0, view: null, swapT: 0, fireCd: 0, flashT: 0, spreadNow: 0, recoilAnim: 0, adsT: 0, triggerHeld: false };

  /* ---------------------- modelos de armas ---------------------- */
  function box(w, h, d, mat, x, y, z, rx) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); if (rx) m.rotation.x = rx; return m; }
  function cyl(r, l, mat, x, y, z) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 10), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m; }

  DZ.buildWeaponModel = function (type, level, chalk) {
    const def = C.weapons[type]; const g = new THREE.Group();
    const Mat = chalk ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
    const body = new Mat({ color: chalk ? 0xe8e8e8 : def.color });
    const dark = new Mat({ color: chalk ? 0xbbbbbb : 0x15171a });
    const glowCol = level > 0 ? C.upgrades[level].glow : def.accent;
    const accent = chalk ? new Mat({ color: 0xffffff }) : new THREE.MeshLambertMaterial({ color: level > 0 ? glowCol : new THREE.Color(def.accent).multiplyScalar(0.55), emissive: level > 0 ? glowCol : 0x000000, emissiveIntensity: level > 0 ? 0.9 : 0 });
    const wood = new Mat({ color: chalk ? 0xcccccc : 0x5a3a20 });
    let muzzleZ = -0.3, sight = { top: 0.06, z: -0.03, s: 1 };
    if (type === 'pistol') {
      g.add(box(0.05, 0.06, 0.24, body, 0, 0.03, -0.08));
      g.add(box(0.045, 0.12, 0.06, dark, 0, -0.05, 0.02, -0.25));
      g.add(box(0.052, 0.012, 0.18, accent, 0, 0.065, -0.08));
      muzzleZ = -0.21; sight = { top: 0.06, z: -0.03, s: 0.85 };
    } else if (type === 'smg') {
      g.add(box(0.06, 0.08, 0.34, body, 0, 0.02, -0.1));
      g.add(cyl(0.017, 0.14, dark, 0, 0.03, -0.33));
      g.add(box(0.04, 0.18, 0.05, dark, 0, -0.1, -0.12));
      g.add(box(0.045, 0.1, 0.05, dark, 0, -0.06, 0.03, -0.3));
      g.add(box(0.03, 0.03, 0.2, dark, 0, 0.02, 0.15));
      g.add(box(0.064, 0.015, 0.25, accent, 0, 0.068, -0.1));
      muzzleZ = -0.41; sight = { top: 0.068, z: -0.02, s: 1 };
    } else if (type === 'shotgun') {
      g.add(box(0.07, 0.08, 0.3, body, 0, 0.02, -0.05));
      g.add(cyl(0.024, 0.55, dark, 0, 0.045, -0.45));
      g.add(cyl(0.022, 0.45, dark, 0, 0.0, -0.4));
      g.add(box(0.07, 0.07, 0.18, wood, 0, 0.0, -0.38));
      g.add(box(0.06, 0.1, 0.28, wood, 0, -0.02, 0.22, 0.12));
      g.add(box(0.074, 0.012, 0.3, accent, 0, 0.065, -0.05));
      muzzleZ = -0.73; sight = { top: 0.07, z: -0.07, s: 1.15 };
    } else if (type === 'rifle') {
      g.add(box(0.065, 0.09, 0.42, body, 0, 0.02, -0.1));
      g.add(cyl(0.016, 0.3, dark, 0, 0.035, -0.45));
      g.add(box(0.05, 0.07, 0.2, dark, 0, 0.02, -0.38));
      g.add(box(0.045, 0.16, 0.07, dark, 0, -0.1, -0.12, 0.25));
      g.add(box(0.05, 0.1, 0.06, dark, 0, -0.07, 0.04, -0.3));
      g.add(box(0.055, 0.1, 0.22, body, 0, 0.0, 0.24));
      g.add(box(0.069, 0.012, 0.36, accent, 0, 0.064, -0.12));
      muzzleZ = -0.61; sight = { top: 0.07, z: -0.06, s: 1.05 };
    } else if (type === 'lmg') {
      g.add(box(0.11, 0.13, 0.5, body, 0, 0.02, -0.08));
      g.add(cyl(0.04, 0.42, dark, 0, 0.04, -0.52));
      g.add(cyl(0.02, 0.15, dark, 0, 0.04, -0.78));
      g.add(box(0.14, 0.14, 0.14, dark, 0.03, -0.1, -0.1));
      g.add(box(0.05, 0.1, 0.06, dark, 0, -0.08, 0.1, -0.3));
      g.add(box(0.08, 0.12, 0.24, body, 0, 0.0, 0.3));
      g.add(box(0.115, 0.014, 0.44, accent, 0, 0.088, -0.08));
      muzzleZ = -0.86; sight = { top: 0.095, z: -0.08, s: 1.25 };
    }
    if (level >= 3 && !chalk) { // bobinas brillantes MK-III
      for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.026 + (type === 'lmg' ? 0.02 : type === 'shotgun' ? 0.008 : 0), 0.005, 6, 14), new THREE.MeshBasicMaterial({ color: glowCol })); r.position.set(0, type === 'shotgun' ? 0.045 : type === 'lmg' ? 0.04 : 0.035, muzzleZ + 0.05 + i * 0.045); g.add(r); }
    }
    // ---- mira holográfica ----
    let sightY = sight.top + 0.03 * sight.s;
    if (!chalk) {
      const holo = buildHolo(type, level, sight.s); holo.position.set(0, sight.top, sight.z); g.add(holo);
    } else g.add(box(0.045 * sight.s, 0.045 * sight.s, 0.05, dark, 0, sight.top + 0.022 * sight.s, sight.z));
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.04, muzzleZ); g.add(muzzle);
    g.userData = { muzzle, sightY, muzzleZ };
    return g;
  };

  /* ---------------------- miras holográficas ---------------------- */
  // Cada arma tiene su propia retícula; las mejoras cambian su color.
  const RETICLE = { pistol: 'dot', smg: 'circle', shotgun: 'ring', rifle: 'chevron', lmg: 'cross' };
  const reticleCache = {};
  function reticleTex(style, color) {
    const key = style + color; if (reticleCache[key]) return reticleCache[key];
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
    g.translate(S / 2, S / 2); g.strokeStyle = g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 14; g.lineCap = 'round';
    const dot = (r) => { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); };
    const circ = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
    const line = (x1, y1, x2, y2, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    for (let pass = 0; pass < 2; pass++) { // doble pasada = brillo más intenso
      if (style === 'dot') { dot(9); circ(46, 4); }
      else if (style === 'circle') { dot(7); circ(62, 6); [0, 1, 2, 3].forEach(i => { const a = i * Math.PI / 2; line(Math.cos(a) * 62, Math.sin(a) * 62, Math.cos(a) * 82, Math.sin(a) * 82, 6); }); }
      else if (style === 'ring') { dot(8); circ(96, 7); circ(60, 3); }
      else if (style === 'chevron') { g.lineWidth = 7; g.beginPath(); g.moveTo(-34, 30); g.lineTo(0, 2); g.lineTo(34, 30); g.stroke(); dot(6); line(-90, 0, -60, 0, 5); line(60, 0, 90, 0, 5); }
      else if (style === 'cross') { dot(7); line(-80, 0, -24, 0, 6); line(24, 0, 80, 0, 6); line(0, 24, 0, 80, 6); line(0, -80, 0, -24, 6); circ(100, 3); }
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.userData.keep = true; reticleCache[key] = t; return t;
  }
  WP.reticleColor = (level) => level > 0 ? '#' + new THREE.Color(C.upgrades[level].glow).getHexString() : '#ff3a2e';
  function buildHolo(type, level, s) {
    const g = new THREE.Group(); g.scale.setScalar(s);
    const frame = new THREE.MeshLambertMaterial({ color: 0x1b1e22 });
    const accent = new THREE.MeshLambertMaterial({ color: level > 0 ? C.upgrades[level].glow : 0x3a3f46, emissive: level > 0 ? C.upgrades[level].glow : 0, emissiveIntensity: level > 0 ? 0.6 : 0 });
    const B = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); };
    B(0.05, 0.012, 0.075, frame, 0, 0.006, 0);            // base
    B(0.006, 0.05, 0.03, frame, -0.025, 0.035, -0.015);  // postes de la ventana
    B(0.006, 0.05, 0.03, frame, 0.025, 0.035, -0.015);
    B(0.056, 0.007, 0.034, frame, 0, 0.061, -0.015);     // capota
    B(0.05, 0.016, 0.03, accent, 0, 0.018, 0.022);       // carcasa trasera (batería)
    B(0.012, 0.012, 0.012, accent, 0.03, 0.02, 0.02);    // botón
    // cristal tintado
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.044, 0.042), new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }));
    glass.position.set(0, 0.035, -0.02); g.add(glass);
    // retícula proyectada (aditiva para que brille)
    const ret = new THREE.Mesh(new THREE.PlaneGeometry(0.042, 0.042), new THREE.MeshBasicMaterial({ map: reticleTex(RETICLE[type], WP.reticleColor(level)), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    ret.position.set(0, 0.03, -0.021); ret.renderOrder = 10; g.add(ret);
    g.userData.reticle = ret;
    return g;
  }

  /* ---------------------- estadísticas ---------------------- */
  WP.stats = function (type, level) {
    const d = C.weapons[type], u = C.upgrades[level] || { damage: 1, mag: 1, reserve: 1, spread: 1, recoil: 1, rpm: 1, reload: 1 };
    return {
      damage: Math.round(d.damage * u.damage), mag: Math.round(d.mag * u.mag), reserveMax: Math.round(d.reserveMax * u.reserve),
      spread: d.spread * u.spread, adsSpread: d.adsSpread * u.spread, recoil: d.recoil * u.recoil, rpm: d.rpm * u.rpm, reload: d.reload * u.reload
    };
  };
  WP.make = function (type) { const s = WP.stats(type, 0); return { type, def: C.weapons[type], level: 0, s, mag: s.mag, reserve: s.reserveMax, forging: false, reloading: 0 }; };
  WP.current = () => WP.slots[WP.cur] || null;
  WP.owns = (type) => WP.slots.find(w => w.type === type) || null;
  WP.displayName = (w) => w.def.name + (w.level ? ' ' + C.upgrades[w.level].tag : '');

  WP.applyLevel = function (w, level) {
    w.level = level; w.s = WP.stats(w.type, level);
    w.mag = w.s.mag; w.reserve = w.s.reserveMax; w.reloading = 0; // la mejora rellena la munición
    if (w === WP.current()) WP.refreshView();
  };

  /* ---------------------- vista en primera persona ---------------------- */
  WP.init = function (camera, scene) {
    WP.camera = camera;
    // El arma se dibuja en una escena propia (no atraviesa paredes)
    WP.vmScene = new THREE.Scene(); WP.vmCam = new THREE.PerspectiveCamera(60, 1, 0.01, 10); WP.vmScene.add(WP.vmCam);
    WP.vmScene.add(new THREE.HemisphereLight(0xb8c4d0, 0x302820, 1.6));
    const dl = new THREE.DirectionalLight(0xffe8d0, 1.4); dl.position.set(1, 2, 1); WP.vmScene.add(dl);
    WP.vmLight = new THREE.PointLight(0xffc070, 0, 3, 1); WP.vmLight.position.set(0.1, -0.05, -0.8); WP.vmScene.add(WP.vmLight);
    WP.holder = new THREE.Group(); WP.vmCam.add(WP.holder);
    WP.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: flashTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    WP.flashLight = new THREE.PointLight(0xffc070, 0, 9, 1.5); scene.add(WP.flashLight);
    WP.raycaster = new THREE.Raycaster();
  };
  function flashTex() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,220,1)'); gr.addColorStop(0.3, 'rgba(255,190,80,0.9)'); gr.addColorStop(1, 'rgba(255,120,0,0)');
    g.fillStyle = gr; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? 14 : 32; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.fill();
    return new THREE.CanvasTexture(cv);
  }
  WP.refreshView = function () {
    if (WP.view) { WP.holder.remove(WP.view); disposeTree(WP.view); }
    const w = WP.current(); if (!w) { WP.view = null; return; }
    const m = DZ.buildWeaponModel(w.type, w.level, false);
    // brazo/mano
    const skin = new THREE.MeshLambertMaterial({ color: 0x8a6a52 }), sleeve = new THREE.MeshLambertMaterial({ color: 0x2c3326 });
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.08), skin); hand.position.set(0.0, -0.06, 0.03); m.add(hand);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.26), sleeve); arm.position.set(0.03, -0.13, 0.16); arm.rotation.x = 0.55; m.add(arm);
    if (w.type !== 'pistol') {
      const hand2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.08), skin); hand2.position.set(-0.01, -0.035, m.userData.muzzleZ * 0.5); m.add(hand2);
      const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.26), sleeve); arm2.position.set(-0.08, -0.12, hand2.position.z + 0.13); arm2.rotation.set(0.5, -0.55, 0); m.add(arm2);
    }
    m.userData.muzzle.add(WP.flash); WP.flash.visible = false;
    WP.view = m; WP.holder.add(m);
  };
  function disposeTree(o) { o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material && c !== WP.flash) { if (c.material.map && c.material.map !== WP.flash.material.map && !c.material.map.userData.keep) c.material.map.dispose(); c.material.dispose(); } }); if (WP.flash.parent) WP.flash.parent.remove(WP.flash); }

  /* ---------------------- inventario ---------------------- */
  WP.reset = function () {
    WP.slots = [WP.make('pistol')]; WP.cur = 0; WP.fireCd = 0; WP.swapT = 0; WP.triggerHeld = false; WP.refreshView();
  };
  WP.give = function (type) {
    const w = WP.make(type);
    if (WP.slots.length < 2) { WP.slots.push(w); WP.cur = WP.slots.length - 1; }
    else { const old = WP.slots[WP.cur]; if (old.forging) DZ.shop.finishForge(true); WP.slots[WP.cur] = w; }
    WP.swapT = 0.35; WP.refreshView(); DZ.audio.swap();
  };
  WP.select = function (i) {
    if (i === WP.cur || !WP.slots[i]) return;
    const c = WP.current(); if (c) c.reloading = 0;
    WP.cur = i; WP.swapT = 0.35; WP.refreshView(); DZ.audio.swap();
  };
  WP.reload = function () {
    const w = WP.current(); if (!w || w.forging || w.reloading > 0 || w.mag >= w.s.mag || w.reserve <= 0) return false;
    w.reloading = w.s.reload * (DZ.player.has('hands') ? 0.55 : 1); w.reloadTotal = w.reloading; DZ.audio.reload(w.reloading); return true;
  };

  /* ---------------------- disparo ---------------------- */
  const tmpV = new THREE.Vector3(), tmpO = new THREE.Vector3();
  WP.fire = function () {
    const w = WP.current(); const P = DZ.player;
    if (!w || w.forging || w.reloading > 0 || WP.swapT > 0 || WP.fireCd > 0) return false;
    if (WP.meleeT > 0) return false;
    const frenzy = DZ.powerups.active('frenzy');
    if (w.mag <= 0 && !frenzy) { DZ.audio.dry(); WP.fireCd = 0.25; if (w.reserve > 0) WP.reload(); return false; }
    if (!frenzy) w.mag--; WP.fireCd = 60 / (w.s.rpm * (frenzy ? 1.5 : 1));
    const src = { kind: 'gun', shot: ++WP.shotId, pellets: w.def.pellets };
    const steady = P.has('steady') ? 0.55 : 1;
    const moving = Math.hypot(P.vel.x, P.vel.z) > 1 ? w.def.moveSpread : 0;
    const base = (DZ.input.ads ? w.s.adsSpread : w.s.spread + moving + (P.onGround ? 0 : 0.04)) * steady;
    const spread = base + WP.spreadNow;
    const cam = WP.camera; cam.getWorldPosition(tmpO);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const muzzleW = WP.muzzleWorld(new THREE.Vector3());
    const hitsThisShot = new Map();
    const pellets = w.def.pellets; const hitboxes = DZ.zombies.hitboxes();
    for (let p = 0; p < pellets; p++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
      const dir = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      const wall = DZ.map.rayWall(tmpO, dir, w.def.range);
      WP.raycaster.set(tmpO, dir); WP.raycaster.far = wall.dist;
      const hits = WP.raycaster.intersectObjects(hitboxes, false);
      let end;
      if (hits.length) {
        const h = hits[0]; const z = h.object.userData.zombie; const head = h.object.userData.part === 'head';
        let fall = 1; const d = h.distance;
        if (d > w.def.falloffStart) fall = Math.max(w.def.minFalloff, 1 - (d - w.def.falloffStart) / (w.def.falloffEnd - w.def.falloffStart) * (1 - w.def.minFalloff));
        const dmg = w.s.damage * fall * (head ? (pellets > 1 ? 1.5 : 2.2) : 1);
        const rec = hitsThisShot.get(z) || { dmg: 0, head: false, point: h.point }; rec.dmg += dmg; rec.head = rec.head || head; hitsThisShot.set(z, rec);
        DZ.fx.impact(h.point, dir, 'flesh', w.level);
        end = h.point;
      } else {
        end = wall.point || tmpO.clone().addScaledVector(dir, w.def.range);
        if (wall.point) DZ.fx.impact(wall.point, dir, 'wall', w.level);
      }
      if (p < 3) DZ.fx.tracer(muzzleW, end, w.level);
    }
    // aplicar daño agrupado por zombi (los puntos por impacto se conceden una vez por disparo)
    hitsThisShot.forEach((rec, z) => DZ.zombies.damage(z, rec.dmg, rec.head, rec.point, src));
    if (hitsThisShot.size) DZ.ui.hitMarker([...hitsThisShot.values()].some(r => r.head));
    // retroceso
    const rec = w.s.recoil * steady * (DZ.input.ads ? 0.7 : 1);
    P.kickPitch += rec * (0.8 + Math.random() * 0.4); P.kickYaw += (Math.random() - 0.5) * rec * 0.8;
    P.pitch += rec * 0.35; // parte del retroceso es permanente
    WP.spreadNow = Math.min(0.06, WP.spreadNow + rec * 0.4);
    WP.recoilAnim = 1; WP.flashT = 0.05;
    DZ.audio.shot(w.def.sound, w.level > 0);
    DZ.zombies.alertNoise();
    if (w.mag === 0 && w.reserve > 0) setTimeout(() => { if (WP.current() === w) WP.reload(); }, 120);
    return true;
  };

  /* ---------------------- culatazo (cuerpo a cuerpo) ---------------------- */
  WP.melee = function () {
    const P = DZ.player, w = WP.current();
    if (WP.meleeCd > 0 || WP.swapT > 0) return false;
    if (w) w.reloading = 0; // el culatazo cancela la recarga (estilo arcade)
    WP.meleeT = 0.32; WP.meleeCd = 0.55; DZ.audio.melee();
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); let hit = false;
    const src = { kind: 'melee', shot: ++WP.shotId };
    DZ.zombies.list.forEach(z => {
      if (z.dead || z.state === 'spawn') return;
      const dx = z.mesh.position.x - P.pos.x, dz = z.mesh.position.z - P.pos.z, d = Math.hypot(dx, dz);
      if (d > 2.1 + z.radius || (dx * fx + dz * fz) / (d || 1) < 0.45) return;
      hit = true; z.knock = { x: dx / (d || 1) * 7, z: dz / (d || 1) * 7 };
      DZ.zombies.damage(z, 160 + DZ.waves.round * 10, false, z.mesh.position.clone().setY(1.3 * z.scale), src);
      z.stagger = 0.5;
    });
    if (hit) { DZ.ui.hitMarker(false); P.shake = Math.min(1, P.shake + 0.35); }
    return hit;
  };

  // posición mundial del cañón (convierte desde la escena del arma)
  WP.muzzleWorld = function (out) {
    if (!WP.view) return WP.camera.getWorldPosition(out);
    WP.vmCam.updateMatrixWorld(true); WP.view.userData.muzzle.getWorldPosition(out);
    WP.camera.updateMatrixWorld(); return out.applyMatrix4(WP.camera.matrixWorld);
  };

  /* ---------------------- actualización ---------------------- */
  WP.update = function (dt) {
    const I = DZ.input, w = WP.current();
    WP.fireCd = Math.max(0, WP.fireCd - dt); WP.swapT = Math.max(0, WP.swapT - dt); WP.flashT = Math.max(0, WP.flashT - dt);
    WP.spreadNow = Math.max(0, WP.spreadNow - dt * 0.12);
    if (I.consume('slot1')) WP.select(0); if (I.consume('slot2')) WP.select(1);
    if (I.consume('swap') && WP.slots.length > 1) WP.select(1 - WP.cur);
    if (I.consume('reload')) WP.reload();
    if (I.consume('melee')) WP.melee();
    WP.meleeT = Math.max(0, WP.meleeT - dt); WP.meleeCd = Math.max(0, WP.meleeCd - dt);
    if (w) {
      if (w.reloading > 0) {
        w.reloading -= dt;
        if (w.reloading <= 0) { const need = w.s.mag - w.mag, take = Math.min(need, w.reserve); w.mag += take; w.reserve -= take; w.reloading = 0; }
      }
      if (I.fire) {
        if (w.def.auto || !WP.triggerHeld) WP.fire();
        WP.triggerHeld = true;
      } else WP.triggerHeld = false;
    }
    // animación del arma
    if (WP.view) {
      const P = DZ.player; const ads = I.ads && w && !w.forging && w.reloading <= 0;
      WP.adsT += ((ads ? 1 : 0) - WP.adsT) * Math.min(1, dt * 14);
      WP.recoilAnim = Math.max(0, WP.recoilAnim - dt * 9);
      const t = WP.adsT, sy = WP.view.userData.sightY;
      const hip = { x: 0.15, y: -0.155, z: -0.42 }, aim = { x: 0, y: -sy, z: -0.34 };
      let x = hip.x + (aim.x - hip.x) * t, y = hip.y + (aim.y - hip.y) * t, z = hip.z + (aim.z - hip.z) * t;
      const bob = (1 - t * 0.85);
      x += Math.cos(P.bob) * 0.012 * bob; y += Math.abs(Math.sin(P.bob)) * 0.014 * bob;
      z += WP.recoilAnim * 0.06; let rx = WP.recoilAnim * 0.12;
      if (P.sprinting) { y -= 0.04; x -= 0.03; WP.view.rotation.y = 0.5; } else WP.view.rotation.y *= 0.8;
      if (w && w.reloading > 0) { const k = Math.sin((1 - w.reloading / w.reloadTotal) * Math.PI); y -= k * 0.12; rx -= k * 0.6; WP.view.rotation.z = k * 0.4; } else WP.view.rotation.z = 0;
      if (WP.swapT > 0) y -= WP.swapT * 0.6;
      if (WP.meleeT > 0) { const k = Math.sin((1 - WP.meleeT / 0.32) * Math.PI); x -= k * 0.16; z -= k * 0.18; y += k * 0.03; WP.view.rotation.z = k * 0.9; }
      if (w && w.forging) y -= 0.5;
      WP.view.position.set(x, y, z); WP.view.rotation.x = rx;
      WP.flash.visible = WP.flashT > 0; if (WP.flash.visible) WP.flash.rotation.z = Math.random() * 6;
      WP.camera.fov += ((ads ? 52 : DZ.game.baseFov) - WP.camera.fov) * Math.min(1, dt * 12); WP.camera.updateProjectionMatrix();
      WP.vmCam.fov = 58 - t * 8; WP.vmCam.aspect = WP.camera.aspect; WP.vmCam.updateProjectionMatrix();
    }
    if (WP.flashT > 0 && WP.view) { WP.muzzleWorld(WP.flashLight.position); WP.flashLight.intensity = 6; WP.vmLight.intensity = 4; } else { WP.flashLight.intensity = 0; WP.vmLight.intensity = 0; }
  };
})();
