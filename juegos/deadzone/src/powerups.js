/* =========================================================
   powerups.js — potenciadores que sueltan los zombis:
   MUNICIÓN MÁXIMA, BALA LETAL, PUNTOS ×2, DETONACIÓN, FRENESÍ
   ========================================================= */
(function () {
  const PC = DZ.CONFIG.powerups;
  const PU = DZ.powerups = { nukeQueue: [], drops: [], timers: {}, roundDrops: 0, sinceDrop: 0, scene: null, picked: 0 };
  const WEIGHTS = { ammo: 26, double: 22, insta: 20, frenzy: 17, nuke: 15 };
  const texCache = {};
  let glowTex;

  PU.init = function (scene) {
    PU.scene = scene;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(cv);
  };
  function iconTex(type) {
    if (texCache[type]) return texCache[type];
    const d = PC.types[type], cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#0d0f12'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
    g.lineWidth = 8; g.strokeStyle = d.color; g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.stroke();
    g.fillStyle = d.color; g.strokeStyle = d.color; g.shadowColor = d.color; g.shadowBlur = 12; g.lineJoin = 'round';
    drawIcon(g, type);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; texCache[type] = t; return t;
  }

  // Iconos dibujados a mano (no dependen de las fuentes del dispositivo)
  function drawIcon(g, type) {
    g.save(); g.translate(64, 64);
    if (type === 'ammo') { // tres balas
      [-22, 0, 22].forEach(x => { g.beginPath(); g.moveTo(x - 8, 26); g.lineTo(x - 8, -10); g.quadraticCurveTo(x, -34, x + 8, -10); g.lineTo(x + 8, 26); g.closePath(); g.fill(); });
      g.fillStyle = '#0d0f12'; g.fillRect(-34, 14, 68, 4);
    } else if (type === 'insta') { // calavera
      g.beginPath(); g.arc(0, -8, 30, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(18, 22); g.lineTo(-18, 22); g.closePath(); g.fill();
      g.fillStyle = '#0d0f12'; g.beginPath(); g.arc(-12, -6, 9, 0, Math.PI * 2); g.arc(12, -6, 9, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(0, 6); g.lineTo(-5, 14); g.lineTo(5, 14); g.fill();
      for (let i = -1; i <= 1; i++) g.fillRect(i * 9 - 2, 18, 4, 6);
    } else if (type === 'double') {
      g.font = 'bold 54px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('x2', 0, 4);
    } else if (type === 'nuke') { // estallido
      g.beginPath(); for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, r = i % 2 ? 18 : 40; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
      g.fillStyle = '#0d0f12'; g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.fill();
    } else if (type === 'frenzy') { // rayo
      g.beginPath(); g.moveTo(8, -40); g.lineTo(-20, 6); g.lineTo(-2, 6); g.lineTo(-10, 40); g.lineTo(20, -8); g.lineTo(2, -8); g.closePath(); g.fill();
    }
    g.restore();
  }

  PU.active = (type) => (PU.timers[type] || 0) > 0;

  PU.maybeDrop = function (z) {
    if (DZ.waves.state !== 'active') return;
    PU.sinceDrop++;
    const forced = z.type === 'boss' || PU.sinceDrop >= 32; // garantía: al menos uno cada ~32 bajas
    if (!forced && (PU.roundDrops >= PC.maxPerRound || Math.random() > PC.dropChance)) return;
    if (PU.drops.length >= 3) return;
    let r = Math.random() * 100, type = 'ammo';
    for (const k in WEIGHTS) { r -= WEIGHTS[k]; if (r <= 0) { type = k; break; } }
    PU.spawn(type, z.mesh.position.x, z.mesh.position.z);
  };

  PU.spawn = function (type, x, z) {
    const d = PC.types[type]; const col = new THREE.Color(d.color);
    const grp = new THREE.Group(); grp.position.set(x, 1.1, z);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24), [
      new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.6) }),
      new THREE.MeshBasicMaterial({ map: iconTex(type) }), new THREE.MeshBasicMaterial({ map: iconTex(type) })]);
    disc.rotation.x = Math.PI / 2; grp.add(disc);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
    glow.scale.setScalar(2.4); grp.add(glow);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.25, 6, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.y = 1.9; grp.add(beam);
    PU.scene.add(grp);
    PU.drops.push({ type, grp, disc, t: 0, x, z });
    PU.roundDrops++; PU.sinceDrop = 0;
    DZ.audio.powerDrop();
  };

  PU.pickup = function (drop) {
    const type = drop.type, d = PC.types[type]; PU.picked++;
    DZ.audio.powerup(); DZ.ui.powerBanner(d.name, d.desc, d.color); DZ.ui.flash(new THREE.Color(d.color).getHex());
    DZ.fx.burst(new THREE.Vector3(drop.x, 1.1, drop.z), new THREE.Color(d.color).getHex(), 24, 5);
    if (type === 'ammo') DZ.weapons.slots.forEach(w => { w.reserve = w.s.reserveMax; w.mag = w.s.mag; w.reloading = 0; });
    else if (type === 'nuke') {
      const victims = DZ.zombies.list.filter(z => !z.dead && z.type !== 'boss');
      DZ.player.shake = 1; DZ.audio.slam();
      PU.nukeQueue = victims.map((z, i) => ({ z, t: 0.06 + i * 0.04 })); // explosiones escalonadas (en tiempo de juego)
      DZ.economy.add(400, 'bonus', null, true);
      DZ.medals.onNuke(victims.length);
    } else PU.timers[type] = d.dur;
  };

  PU.update = function (dt, t) {
    const P = DZ.player.pos;
    for (let i = PU.drops.length - 1; i >= 0; i--) {
      const d = PU.drops[i]; d.t += dt;
      d.grp.rotation.y += dt * 2.5; d.grp.position.y = 1.1 + Math.sin(d.t * 3) * 0.15;
      const left = PC.life - d.t; d.grp.visible = left > 6 || Math.floor(d.t * (left < 2.5 ? 10 : 5)) % 2 === 0;
      if (Math.hypot(P.x - d.x, P.z - d.z) < PC.pickRadius && DZ.player.alive) { PU.pickup(d); remove(i); continue; }
      if (left <= 0) remove(i);
    }
    if (PU.nukeQueue.length) {
      PU.nukeQueue.forEach(n => { n.t -= dt; if (n.t <= 0 && !n.z.dead) DZ.zombies.damage(n.z, 1e9, false, n.z.mesh.position.clone().setY(1.5), { kind: 'nuke' }); });
      PU.nukeQueue = PU.nukeQueue.filter(n => n.t > 0 && !n.z.dead);
    }
    for (const k in PU.timers) if (PU.timers[k] > 0) PU.timers[k] = Math.max(0, PU.timers[k] - dt);
    DZ.ui.powerTimers(PU.timers);
  };
  function remove(i) { const d = PU.drops[i]; PU.scene.remove(d.grp); d.grp.traverse(o => { if (o.geometry) o.geometry.dispose(); }); PU.drops.splice(i, 1); }

  PU.onRoundStart = function () { PU.roundDrops = 0; };
  PU.clear = function () { for (let i = PU.drops.length - 1; i >= 0; i--) remove(i); PU.timers = {}; PU.nukeQueue = []; PU.roundDrops = 0; PU.sinceDrop = 0; PU.picked = 0; DZ.ui.powerTimers(PU.timers); };
})();
