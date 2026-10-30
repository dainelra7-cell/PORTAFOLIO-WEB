/* =========================================================
   zombies.js — modelos, IA (aparición → persecución → ataque →
   muerte), navegación por campo de flujo y jefe EL COLOSO
   ========================================================= */
(function () {
  const C = DZ.CONFIG;
  const Z = DZ.zombies = { list: [], scene: null, groanT: 2, kills: 0, boss: null };
  const MATS = {};
  const tmp = new THREE.Vector3();

  function mats() {
    if (MATS.ready) return MATS;
    const L = (c, e) => new THREE.MeshLambertMaterial({ color: c, emissive: e || 0x000000 });
    MATS.walker = { skin: L(0x6f7f5e), cloth: L(0x3c4250), pants: L(0x2d2a26), eye: new THREE.MeshBasicMaterial({ color: 0xffe066 }) };
    MATS.runner = { skin: L(0x8a6f63), cloth: L(0x5a2222), pants: L(0x242424), eye: new THREE.MeshBasicMaterial({ color: 0xff7a1a }) };
    MATS.brute = { skin: L(0x5c6a4c), cloth: L(0x3b3f45), pants: L(0x2a2a2a), eye: new THREE.MeshBasicMaterial({ color: 0xc36bff }), plate: L(0x6b6e73) };
    MATS.boss = { skin: L(0x4d3a3a, 0x1a0505), cloth: L(0x2b2b2b), pants: L(0x1c1c1c), eye: new THREE.MeshBasicMaterial({ color: 0xff2a2a }), plate: L(0x7a3a20, 0x200800) };
    MATS.hit = new THREE.MeshBasicMaterial({ color: 0xffffff });
    MATS.hitbox = new THREE.MeshBasicMaterial({ visible: false });
    MATS.ring = new THREE.MeshBasicMaterial({ color: 0xff2a10, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
    MATS.ready = true; return MATS;
  }
  const GEO = {};
  function g(key, f) { return GEO[key] || (GEO[key] = f()); }

  function buildModel(type) {
    const m = mats()[type]; const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
    const B = (w, h, d, mat, x, y, z, key) => { const mesh = new THREE.Mesh(g(key || (w + '_' + h + '_' + d), () => new THREE.BoxGeometry(w, h, d)), mat); mesh.position.set(x, y, z); return mesh; };
    const thin = type === 'runner' ? 0.85 : 1;
    // piernas (pivote en la cadera)
    const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.13, 0.85, 0); legR.position.set(0.13, 0.85, 0);
    legL.add(B(0.17 * thin, 0.85, 0.18, m.pants, 0, -0.42, 0)); legR.add(B(0.17 * thin, 0.85, 0.18, m.pants, 0, -0.42, 0));
    body.add(legL, legR);
    // torso
    const torso = new THREE.Group(); torso.position.set(0, 0.85, 0); body.add(torso);
    const chest = B(0.5 * thin, 0.65, 0.28, m.cloth, 0, 0.33, 0); torso.add(chest);
    // jirones de ropa
    torso.add(B(0.18, 0.2, 0.02, m.skin, 0.1, 0.2, -0.15));
    if (m.plate) { torso.add(B(0.56, 0.3, 0.34, m.plate, 0, 0.45, 0)); torso.add(B(0.2, 0.15, 0.4, m.plate, -0.32, 0.62, 0)); torso.add(B(0.2, 0.15, 0.4, m.plate, 0.32, 0.62, 0)); }
    // cabeza
    const head = new THREE.Group(); head.position.set(0, 0.72, -0.02); torso.add(head);
    head.add(B(0.28, 0.3, 0.28, m.skin, 0, 0.14, 0));
    const eyeL = B(0.06, 0.035, 0.02, m.eye, -0.07, 0.17, -0.145, 'eye'), eyeR = B(0.06, 0.035, 0.02, m.eye, 0.07, 0.17, -0.145, 'eye'); head.add(eyeL, eyeR);
    head.add(B(0.16, 0.05, 0.02, m.pants, 0, 0.05, -0.145, 'mouth'));
    // brazos (pivote en el hombro, extendidos hacia delante)
    const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-0.32 * thin, 0.6, 0); armR.position.set(0.32 * thin, 0.6, 0);
    armL.add(B(0.13, 0.7, 0.14, m.skin, 0, -0.33, 0)); armR.add(B(0.13, 0.7, 0.14, m.skin, 0, -0.33, 0));
    torso.add(armL, armR);
    // cajas de impacto invisibles
    const hbBody = new THREE.Mesh(g('hbb', () => new THREE.BoxGeometry(0.6, 1.45, 0.5)), MATS.hitbox); hbBody.position.set(0, 0.73, 0);
    const hbHead = new THREE.Mesh(g('hbh', () => new THREE.BoxGeometry(0.36, 0.36, 0.36)), MATS.hitbox); hbHead.position.set(0, 1.71, -0.02);
    hbBody.userData.part = 'body'; hbHead.userData.part = 'head';
    root.add(hbBody, hbHead);
    root.userData = { body, legL, legR, armL, armR, torso, head, chest, chestMat: chest.material, hb: [hbBody, hbHead] };
    return root;
  }

  Z.init = function (scene) { Z.scene = scene; mats(); };

  Z.spawn = function (type, opts) {
    opts = opts || {};
    const def = C.zombies[type];
    const sp = opts.at || Z.pickSpawn(); if (!sp) return null;
    const mesh = buildModel(type); const sc = def.scale * (0.95 + Math.random() * 0.1);
    mesh.scale.setScalar(sc); mesh.position.set(sp.x + (Math.random() - 0.5) * 0.6, -1.9 * sc, sp.z + (Math.random() - 0.5) * 0.6);
    Z.scene.add(mesh);
    const r = DZ.waves.round;
    const z = {
      type, def, mesh, ud: mesh.userData, scale: sc,
      hp: def.hp * (opts.hpMul || 1), maxHp: def.hp * (opts.hpMul || 1),
      speed: Math.min(def.speedMax, def.speed + def.speedPerRound * (r - 1)) * (0.9 + Math.random() * 0.2) * (opts.speedMul || 1),
      radius: def.radius * (sc / def.scale), state: 'spawn', t: 0, atkT: 0, cd: 0.5, phase: Math.random() * 6,
      hitRewards: 0, hitFlash: 0, dead: false, rewarded: false, lastProgress: 0, bestDist: 1e9, stuckT: 0, zig: Math.random() * 6,
      vel: new THREE.Vector3()
    };
    mesh.userData.hb.forEach(h => h.userData.zombie = z);
    if (type === 'boss') { z.ability = 3; z.ring = null; Z.boss = z; DZ.ui.bossBar(true, def.name); DZ.audio.boss(); DZ.fx.burst(new THREE.Vector3(sp.x, 0.5, sp.z), 0xff3020, 40, 6); }
    else DZ.fx.burst(new THREE.Vector3(sp.x, 0.2, sp.z), 0x4a3a2a, 10, 2.5);
    Z.list.push(z);
    return z;
  };

  // Punto de aparición en una zona activa, lejos del jugador y preferiblemente fuera de su vista
  Z.pickSpawn = function () {
    const P = DZ.player.pos; const M = DZ.map;
    const cands = M.spawns.filter(s => M.activeZones.has(s.zone));
    if (!cands.length) return null;
    const scored = cands.map(s => {
      const d = Math.hypot(s.x - P.x, s.z - P.z); const vis = M.clearLine(P.x, P.z, s.x, s.z);
      let score = d < 7 ? -100 : (d < 32 ? 10 - Math.abs(d - 16) * 0.3 : 2) - (vis && d < 12 ? 6 : 0) + Math.random() * 4;
      if (M.dist[M.idx(M.tileOf(s.x), M.tileOf(s.z))] < 0) score -= 200; // inalcanzable
      return { s, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0].s;
  };

  Z.hitboxes = function () { const out = []; for (const z of Z.list) if (!z.dead && z.state !== 'spawn-early') out.push(z.ud.hb[0], z.ud.hb[1]); return out; };
  Z.alive = () => Z.list.filter(z => !z.dead).length;

  Z.damage = function (z, dmg, head, point, src) {
    if (z.dead) return;
    if (DZ.powerups.active('insta')) dmg = z.type === 'boss' ? dmg * 3 : z.hp + 1; // BALA LETAL
    z.hp -= dmg; z.hitFlash = 0.07; DZ.audio.hit(head);
    if (z.state === 'spawn') z.t = Math.max(z.t, 0.7);
    if (z.type === 'boss') DZ.ui.bossBar(true, z.def.name, z.hp / z.maxHp);
    if (z.hp <= 0) {
      if (!z.knock && src && src.kind === 'gun') { // retroceso arcade del cuerpo al morir
        const P = DZ.player.pos, dx = z.mesh.position.x - P.x, dz = z.mesh.position.z - P.z, d = Math.hypot(dx, dz) || 1, f = Math.min(9, 3 + dmg / 60);
        z.knock = { x: dx / d * f, z: dz / d * f };
      }
      Z.kill(z, head, src, point);
    } else { // puntos por impacto, con tope por zombi (evita puntos infinitos)
      if (z.hitRewards < C.economy.maxHitRewardsPerZombie) { z.hitRewards++; DZ.economy.add(C.economy.hit, 'hit', point); }
      if (z.type !== 'boss') z.stagger = Math.max(z.stagger || 0, 0.08);
    }
  };

  Z.kill = function (z, head, src, point) {
    if (z.dead) return; z.dead = true; z.state = 'dying'; z.t = 0;
    src = src || { kind: 'other' };
    if (!z.rewarded) { // la recompensa sólo se concede una vez
      z.rewarded = true; Z.kills++;
      DZ.economy.onKill(z, head, src, point || z.mesh.position.clone().setY(1.6 * z.scale));
      DZ.medals.onKill(z, head, src);
      if (src.kind !== 'nuke') DZ.powerups.maybeDrop(z);
    }
    DZ.audio.kill();
    // explosión de vóxeles con los colores del zombi (arcade, sin gore)
    const m = mats()[z.type], c = z.mesh.position;
    DZ.fx.voxels(c.clone().setY(1.0 * z.scale), [m.skin.color.getHex(), m.cloth.color.getHex(), 0x7dff6a], z.type === 'boss' ? 50 : z.type === 'brute' ? 22 : 14, z.knock);
    if (head) DZ.fx.burst(c.clone().setY(1.75 * z.scale), 0x9dff8a, 10, 4);
    if (z.ring) { Z.scene.remove(z.ring); z.ring = null; }
    if (z === Z.boss) { Z.boss = null; DZ.ui.bossBar(false); }
    DZ.waves.onZombieKilled(z);
  };

  Z.alertNoise = function () { };

  Z.clear = function () {
    Z.list.forEach(z => { Z.scene.remove(z.mesh); if (z.ring) Z.scene.remove(z.ring); });
    Z.list = []; Z.boss = null; Z.kills = 0; DZ.ui.bossBar(false);
  };

  /* -------------------------- IA -------------------------- */
  Z.update = function (dt, t) {
    const P = DZ.player, M = DZ.map;
    M.computeFlow(P.pos.x, P.pos.z, false);
    Z.groanT -= dt;
    if (Z.groanT <= 0) {
      const near = Z.list.filter(z => !z.dead).sort((a, b) => a.mesh.position.distanceTo(P.pos) - b.mesh.position.distanceTo(P.pos))[0];
      if (near) { const d = near.mesh.position.distanceTo(P.pos); DZ.audio.groan(Math.max(0.15, 1 - d / 25), near.type === 'brute' || near.type === 'boss' ? 0.6 : near.type === 'runner' ? 1.3 : 1); }
      Z.groanT = 1.2 + Math.random() * 2.5;
    }
    for (let i = Z.list.length - 1; i >= 0; i--) {
      const z = Z.list[i]; const pos = z.mesh.position; const ud = z.ud;
      z.t += dt; z.hitFlash = Math.max(0, z.hitFlash - dt);
      ud.chest.material = z.hitFlash > 0 ? MATS.hit : ud.chestMat;

      if (z.state === 'dying') { // caída no gráfica + hundimiento
        ud.body.rotation.x = Math.min(1.5, z.t * 4) * -1;
        if (z.knock) { pos.x += z.knock.x * dt; pos.z += z.knock.z * dt; z.knock.x *= Math.pow(0.02, dt); z.knock.z *= Math.pow(0.02, dt); DZ.map.collideCircle(pos, z.radius * 0.6); if (z.t < 0.35) pos.y = Math.sin(z.t / 0.35 * Math.PI) * 0.5; }
        if (z.t > 0.7) pos.y -= dt * 1.8;
        if (z.t > 1.9) { Z.scene.remove(z.mesh); Z.list.splice(i, 1); }
        continue;
      }
      if (z.state === 'spawn') { // emerge del suelo
        pos.y = Math.min(0, -1.9 * z.scale + z.t * 1.9 * z.scale / 1.1);
        ud.armL.rotation.x = ud.armR.rotation.x = -2.6 + Math.sin(z.t * 12) * 0.3;
        if (z.t > 1.1) { pos.y = 0; z.state = 'chase'; z.t = 0; z.bestDist = 1e9; }
        z.mesh.updateMatrixWorld(); continue;
      }
      const dx = P.pos.x - pos.x, dz = P.pos.z - pos.z; const dist = Math.hypot(dx, dz);
      z.cd = Math.max(0, z.cd - dt);
      if (z.stagger > 0) z.stagger -= dt;
      if (z.knock) { pos.x += z.knock.x * dt; pos.z += z.knock.z * dt; z.knock.x *= Math.pow(0.005, dt); z.knock.z *= Math.pow(0.005, dt); DZ.map.collideCircle(pos, z.radius); if (Math.hypot(z.knock.x, z.knock.z) < 0.3) z.knock = null; }

      if (z.type === 'boss' && Z.bossAbilities(z, dt, dist, dx, dz)) { z.mesh.updateMatrixWorld(); continue; }

      if (z.state === 'attack') {
        z.atkT += dt;
        const w = z.def.windup;
        const k = Math.min(1, z.atkT / w);
        ud.armL.rotation.x = ud.armR.rotation.x = -1.5 - k * 1.3; // brazos se elevan (señal visual)
        face(z, dx, dz, dt * 8);
        if (z.atkT >= w && !z.struck) {
          z.struck = true; ud.armL.rotation.x = ud.armR.rotation.x = -0.6;
          DZ.audio.attack();
          if (dist < z.def.range + 0.25 && Math.abs(P.pos.y) < 1.3) P.damage(z.def.damage * DZ.waves.dmgMul(), pos.x, pos.z);
        }
        if (z.atkT >= w + 0.3) { z.state = 'chase'; z.cd = z.def.cooldown; }
        z.mesh.updateMatrixWorld(); continue;
      }

      // --- persecución ---
      if (dist < z.def.range && z.cd <= 0 && P.alive) { z.state = 'attack'; z.atkT = 0; z.struck = false; z.mesh.updateMatrixWorld(); continue; }
      let tx, tz;
      const los = dist < 9 && M.clearLine(pos.x, pos.z, P.pos.x, P.pos.z);
      if (los) { tx = P.pos.x; tz = P.pos.z; }
      else { const wp = M.nextWaypoint(pos.x, pos.z); if (wp) { tx = wp.x; tz = wp.z; } else { tx = P.pos.x; tz = P.pos.z; } }
      let mx = tx - pos.x, mz = tz - pos.z; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
      if (z.type === 'runner' && dist > 4) { const s = Math.sin(t * 3 + z.zig) * 0.35; const nx = mx - mz * s, nz = mz + mx * s; const nl = Math.hypot(nx, nz); mx = nx / nl; mz = nz / nl; }
      // separación entre zombis
      for (const o of Z.list) {
        if (o === z || o.dead || o.state === 'spawn') continue;
        const ox = pos.x - o.mesh.position.x, oz = pos.z - o.mesh.position.z; const od = Math.hypot(ox, oz); const min = z.radius + o.radius;
        if (od < min && od > 0.001) { const push = (min - od) / min; mx += ox / od * push * 1.5; mz += oz / od * push * 1.5; }
      }
      let sp = z.speed * (z.stagger > 0 ? 0.25 : 1) * (dist < 2.2 ? 0.7 : 1);
      const vl = Math.hypot(mx, mz) || 1;
      pos.x += mx / vl * sp * dt; pos.z += mz / vl * sp * dt;
      // no atravesar al jugador
      const pd = Math.hypot(P.pos.x - pos.x, P.pos.z - pos.z), pmin = z.radius + C.player.radius;
      if (pd < pmin && pd > 0.001) { pos.x -= (P.pos.x - pos.x) / pd * (pmin - pd); pos.z -= (P.pos.z - pos.z) / pd * (pmin - pd); }
      M.collideCircle(pos, z.radius);
      face(z, mx, mz, dt * 7);
      // animación de caminar
      z.phase += dt * sp * 3.2;
      const sw = Math.sin(z.phase) * (z.type === 'runner' ? 0.9 : 0.55);
      ud.legL.rotation.x = sw; ud.legR.rotation.x = -sw;
      ud.armL.rotation.x = -1.45 + Math.sin(z.phase + 1) * 0.15; ud.armR.rotation.x = -1.45 - Math.sin(z.phase + 1) * 0.15;
      ud.torso.rotation.x = z.type === 'runner' ? 0.35 : 0.12; ud.head.rotation.z = Math.sin(z.phase * 0.5) * 0.15;
      pos.y = Math.abs(Math.sin(z.phase)) * 0.04;
      // detección de atasco: si no progresa en 7 s vuelve a emerger en otro punto (nunca junto al jugador)
      if (dist < z.bestDist - 0.5) { z.bestDist = dist; z.stuckT = 0; } else z.stuckT += dt;
      if (z.stuckT > 7 && dist > 6) Z.relocate(z);
      z.mesh.updateMatrixWorld();
    }
  };
  function face(z, dx, dz, k) {
    const target = Math.atan2(-dx, -dz); let d = target - z.mesh.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    z.mesh.rotation.y += d * Math.min(1, k);
  }
  Z.relocate = function (z) {
    const sp = Z.pickSpawn(); if (!sp) return;
    z.mesh.position.set(sp.x, -1.9 * z.scale, sp.z); z.state = 'spawn'; z.t = 0; z.stuckT = 0; z.bestDist = 1e9;
  };

  /* --------------------- habilidades del Coloso --------------------- */
  Z.bossAbilities = function (z, dt, dist, dx, dz) {
    const P = DZ.player, ud = z.ud, pos = z.mesh.position;
    z.ability -= dt;
    if (z.state === 'slam') {
      z.atkT += dt; const w = 1.1, R = 4.6;
      const k = Math.min(1, z.atkT / w);
      ud.armL.rotation.x = ud.armR.rotation.x = -3.0 * k; ud.torso.rotation.x = -0.3 * k;
      if (z.ring) { z.ring.scale.setScalar(0.2 + k * 0.8); z.ring.material.opacity = 0.25 + 0.4 * k; }
      if (z.atkT >= w && !z.struck) {
        z.struck = true; DZ.audio.slam(); P.shake = 1; ud.armL.rotation.x = ud.armR.rotation.x = 0; ud.torso.rotation.x = 0.4;
        DZ.fx.burst(pos.clone().setY(0.2), 0x9a8060, 30, 6);
        const d = Math.hypot(P.pos.x - pos.x, P.pos.z - pos.z);
        if (d < R && P.pos.y < 0.6) P.damage(45, pos.x, pos.z); // saltar o alejarse lo evita
        if (z.ring) { Z.scene.remove(z.ring); z.ring = null; }
      }
      if (z.atkT > w + 0.6) { z.state = 'chase'; z.ability = 4 + Math.random() * 2; ud.torso.rotation.x = 0; }
      return true;
    }
    if (z.state === 'charge-wind') {
      z.atkT += dt; face(z, z.cdx, z.cdz, dt * 10);
      ud.torso.rotation.x = 0.6; ud.armL.rotation.x = ud.armR.rotation.x = -0.4;
      if (z.ring) z.ring.material.opacity = 0.3 + Math.sin(z.atkT * 30) * 0.2;
      if (z.atkT > 0.9) { z.state = 'charge'; z.atkT = 0; if (z.ring) { Z.scene.remove(z.ring); z.ring = null; } DZ.audio.boss(); }
      return true;
    }
    if (z.state === 'charge') {
      z.atkT += dt; const sp = 15; const ox = pos.x, oz = pos.z;
      pos.x += z.cdx * sp * dt; pos.z += z.cdz * sp * dt; DZ.map.collideCircle(pos, z.radius);
      z.phase += dt * 20; ud.legL.rotation.x = Math.sin(z.phase); ud.legR.rotation.x = -Math.sin(z.phase);
      const d = Math.hypot(P.pos.x - pos.x, P.pos.z - pos.z);
      if (d < z.radius + 0.6 && !z.struck) { z.struck = true; P.damage(50, pos.x, pos.z); P.vel.x += z.cdx * 10; P.vel.z += z.cdz * 10; }
      const moved = Math.hypot(pos.x - ox, pos.z - oz);
      if (z.atkT > 1.3 || moved < sp * dt * 0.3) { z.state = 'chase'; z.ability = 3.5 + Math.random() * 2; ud.torso.rotation.x = 0; if (moved < sp * dt * 0.3) { DZ.audio.slam(); P.shake = Math.max(P.shake, 0.5); } }
      return true;
    }
    if (z.state === 'chase' && z.ability <= 0) {
      if (dist < 5) { // golpe sísmico con telegrafiado
        z.state = 'slam'; z.atkT = 0; z.struck = false;
        z.ring = new THREE.Mesh(new THREE.RingGeometry(4.3, 4.6, 40), MATS.ring.clone()); z.ring.rotation.x = -Math.PI / 2; z.ring.position.set(pos.x, 0.05, pos.z); Z.scene.add(z.ring);
        const fill = new THREE.Mesh(new THREE.CircleGeometry(4.3, 40), new THREE.MeshBasicMaterial({ color: 0xff2a10, transparent: true, opacity: 0.12, depthWrite: false })); z.ring.add(fill);
        return true;
      }
      if (dist > 7 && dist < 22 && DZ.map.clearLine(pos.x, pos.z, P.pos.x, P.pos.z)) { // embestida
        z.state = 'charge-wind'; z.atkT = 0; z.struck = false; z.cdx = dx / dist; z.cdz = dz / dist;
        z.ring = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 18), MATS.ring.clone()); z.ring.rotation.set(-Math.PI / 2, 0, Math.atan2(-z.cdx, -z.cdz));
        z.ring.position.set(pos.x + z.cdx * 9, 0.05, pos.z + z.cdz * 9); Z.scene.add(z.ring);
        return true;
      }
      z.ability = 0.5;
    }
    return false;
  };
})();
