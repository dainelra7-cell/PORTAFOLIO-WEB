/* =========================================================
   effects.js — partículas, trazadoras e impactos (con reserva
   de objetos reutilizables para no acumular memoria)
   ========================================================= */
(function () {
  const F = DZ.fx = { parts: [], tracers: [], scene: null, quality: 1 };
  const MAX_PARTS = 320, MAX_TRACERS = 24;
  let partGeo, partMats = {};

  F.init = function (scene) {
    F.scene = scene;
    partGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    for (let i = 0; i < MAX_PARTS; i++) {
      const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
      m.visible = false; scene.add(m); F.parts.push({ mesh: m, vel: new THREE.Vector3(), life: 0, max: 1, grav: 1, active: false });
    }
    const tgeo = new THREE.BufferGeometry(); tgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    for (let i = 0; i < MAX_TRACERS; i++) {
      const g = tgeo.clone(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.8 }));
      l.visible = false; l.frustumCulled = false; scene.add(l); F.tracers.push({ line: l, life: 0 });
    }
  };
  function getPart() { for (const p of F.parts) if (!p.active) return p; return null; }

  F.emit = function (pos, color, vel, life, size, grav) {
    const p = getPart(); if (!p) return;
    p.active = true; p.mesh.visible = true; p.mesh.position.copy(pos); p.vel.copy(vel); p.life = p.max = life; p.grav = grav === undefined ? 1 : grav;
    p.mesh.material.color.setHex(color); p.mesh.material.opacity = 1; p.mesh.scale.setScalar(size || 1);
  };
  F.burst = function (pos, color, n, speed) {
    n = Math.round(n * F.quality);
    for (let i = 0; i < n; i++) F.emit(pos, color, new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed * 0.8, (Math.random() - 0.5) * speed), 0.5 + Math.random() * 0.6, 1 + Math.random() * 1.5, 1);
  };
  F.impact = function (point, dir, kind, level) {
    const n = Math.round((kind === 'flesh' ? 5 : 4) * F.quality);
    const col = kind === 'flesh' ? 0x7dff6a : (level > 0 ? DZ.CONFIG.upgrades[level].glow : 0xffc66b);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3).addScaledVector(dir, kind === 'flesh' ? 1.5 : -2);
      F.emit(point, col, v, 0.25 + Math.random() * 0.3, kind === 'flesh' ? 1.3 : 0.7, 1);
    }
    if (kind === 'wall') F.emit(point, 0x555555, new THREE.Vector3(0, 0.6, 0), 0.6, 2.2, -0.2);
  };
  // explosión de cubos (vóxeles) al eliminar un zombi
  F.voxels = function (pos, colors, n, knock) {
    n = Math.max(4, Math.round(n * F.quality));
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 5, 2 + Math.random() * 4, (Math.random() - 0.5) * 5);
      if (knock) { v.x += knock.x * 0.6; v.z += knock.z * 0.6; }
      const p = pos.clone(); p.y += (Math.random() - 0.3) * 0.8;
      F.emit(p, colors[i % colors.length], v, 0.7 + Math.random() * 0.6, 2.2 + Math.random() * 1.8, 1.1);
    }
  };
  F.spark = function (pos, color) { F.emit(pos, color, new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4), 0.4, 0.8, 0.5); };
  F.purchase = function (pos) { for (let i = 0; i < 16 * F.quality; i++) { const a = i / 16 * Math.PI * 2; F.emit(pos, 0xffe066, new THREE.Vector3(Math.cos(a) * 2, 1.5 + Math.random(), Math.sin(a) * 2), 0.7, 1.2, 0.6); } };
  F.popup = function () { };
  F.tracer = function (from, to, level) {
    const t = F.tracers.find(x => x.life <= 0); if (!t) return;
    const a = t.line.geometry.attributes.position; a.setXYZ(0, from.x, from.y, from.z); a.setXYZ(1, to.x, to.y, to.z); a.needsUpdate = true;
    t.line.material.color.setHex(level > 0 ? DZ.CONFIG.upgrades[level].glow : 0xffe0a0);
    t.life = 0.05; t.line.visible = true;
  };

  F.update = function (dt) {
    for (const p of F.parts) {
      if (!p.active) continue;
      p.life -= dt; if (p.life <= 0) { p.active = false; p.mesh.visible = false; continue; }
      p.vel.y -= 9 * p.grav * dt; p.mesh.position.addScaledVector(p.vel, dt); p.mesh.rotation.x += dt * 7; p.mesh.rotation.y += dt * 5;
      if (p.mesh.position.y < 0.02) { p.mesh.position.y = 0.02; p.vel.multiplyScalar(0.4); p.vel.y = Math.abs(p.vel.y) * 0.3; }
      p.mesh.material.opacity = Math.min(1, p.life / p.max * 2);
    }
    for (const t of F.tracers) if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.line.visible = false; }
  };
  F.clear = function () { F.parts.forEach(p => { p.active = false; p.mesh.visible = false; }); F.tracers.forEach(t => { t.life = 0; t.line.visible = false; }); };
  F.activeCount = () => F.parts.filter(p => p.active).length;
})();
