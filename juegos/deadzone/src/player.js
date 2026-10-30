/* =========================================================
   player.js — movimiento FPS, salud, ventajas y daño
   ========================================================= */
(function () {
  const C = DZ.CONFIG, PC = C.player;
  const P = DZ.player = {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, onGround: true,
    health: 100, maxHealth: 100, invuln: 0, sinceHit: 99, stamina: PC.staminaMax, sprinting: false,
    perks: [], alive: true, bob: 0, stepT: 0, kickPitch: 0, kickYaw: 0, shake: 0
  };
  P.has = (k) => P.perks.includes(k);

  P.reset = function () {
    P.pos.set(DZ.map.center(7), 0, DZ.map.center(20)); P.vel.set(0, 0, 0);
    P.yaw = 0; P.pitch = 0; P.onGround = true; P.perks = [];
    P.maxHealth = PC.maxHealth; P.health = P.maxHealth; P.invuln = 0; P.sinceHit = 99; P.alive = true;
    P.stamina = PC.staminaMax; P.kickPitch = P.kickYaw = 0; P.shake = 0;
  };

  P.addPerk = function (k) {
    if (P.has(k)) return false; P.perks.push(k);
    if (k === 'resist') { P.maxHealth = 175; P.health = Math.min(P.maxHealth, P.health + 75); }
    return true;
  };

  P.speedMul = function () {
    let m = P.has('step') ? 1.2 : 1;
    const w = DZ.weapons.current(); if (w) m *= w.def.speedMul;
    if (DZ.input.ads) m *= 0.6;
    return m;
  };

  P.update = function (dt, camera) {
    const I = DZ.input;
    // mirar
    const s = 0.0022 * I.sens * (I.ads ? 0.65 : 1);
    P.yaw -= I.lookX * s; P.pitch -= I.lookY * s * (I.invertY ? -1 : 1); I.lookX = I.lookY = 0;
    P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch));

    // dirección deseada
    let fx = 0, fz = 0;
    if (I.keys.KeyW || I.keys.ArrowUp) fz += 1; if (I.keys.KeyS || I.keys.ArrowDown) fz -= 1;
    if (I.keys.KeyD || I.keys.ArrowRight) fx += 1; if (I.keys.KeyA || I.keys.ArrowLeft) fx -= 1;
    fx += I.moveX; fz += I.moveY;
    let len = Math.hypot(fx, fz); if (len > 1) { fx /= len; fz /= len; len = 1; }
    const sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
    // adelante = (-sin, -cos) ; derecha = (cos, -sin)
    const wx = -sin * fz + cos * fx, wz = -cos * fz - sin * fx;

    const wantSprint = (I.keys.ShiftLeft || I.keys.ShiftRight || I.sprintTouch) && fz > 0.3 && !I.ads;
    const stamMax = PC.staminaMax * (P.has('step') ? 1.6 : 1);
    P.sprinting = wantSprint && P.stamina > 0.05 && len > 0.1;
    if (P.sprinting) P.stamina = Math.max(0, P.stamina - dt); else P.stamina = Math.min(stamMax, P.stamina + dt * PC.staminaRegen);

    const target = (P.sprinting ? PC.sprintSpeed : PC.walkSpeed) * P.speedMul();
    const control = P.onGround ? 1 : PC.airControl;
    const tvx = wx * target, tvz = wz * target;
    const rate = (len > 0.05 ? PC.accel : PC.decel) * control;
    const a = 1 - Math.exp(-rate * dt / 6); // suavizado independiente de los FPS
    P.vel.x += (tvx - P.vel.x) * a;
    P.vel.z += (tvz - P.vel.z) * a;

    // salto y gravedad
    if (I.consume('jump') && P.onGround) { P.vel.y = PC.jumpSpeed; P.onGround = false; }
    P.vel.y -= PC.gravity * dt;

    // integrar con sub-pasos para evitar atravesar paredes a pocos FPS
    const steps = Math.max(1, Math.ceil(Math.hypot(P.vel.x, P.vel.z) * dt / 0.25));
    for (let i = 0; i < steps; i++) {
      P.pos.x += P.vel.x * dt / steps; P.pos.z += P.vel.z * dt / steps;
      DZ.map.collideCircle(P.pos, PC.radius);
    }
    P.pos.y += P.vel.y * dt;
    if (P.pos.y <= 0) { if (!P.onGround && P.vel.y < -6) DZ.audio.land(); P.pos.y = 0; P.vel.y = 0; P.onGround = true; }

    // pasos y balanceo de cámara
    const hs = Math.hypot(P.vel.x, P.vel.z);
    if (P.onGround && hs > 0.5) {
      P.bob += dt * hs * 1.9; P.stepT -= dt * hs;
      if (P.stepT <= 0) { P.stepT = 2.4; DZ.audio.step(P.sprinting); }
    } else P.bob += (Math.round(P.bob / Math.PI) * Math.PI - P.bob) * Math.min(1, dt * 6);

    // salud
    P.invuln = Math.max(0, P.invuln - dt); P.sinceHit += dt;
    if (P.sinceHit > PC.regenDelay && P.health < P.maxHealth * PC.regenCap) P.health = Math.min(P.maxHealth * PC.regenCap, P.health + PC.regenRate * dt);

    // retroceso que vuelve
    P.kickPitch *= Math.pow(0.0001, dt); P.kickYaw *= Math.pow(0.0001, dt);
    P.shake = Math.max(0, P.shake - dt * 2.5);

    // cámara
    const bobAmt = I.ads ? 0.008 : (P.sprinting ? 0.06 : 0.035);
    camera.position.set(P.pos.x, P.pos.y + PC.eyeHeight + Math.abs(Math.sin(P.bob)) * bobAmt, P.pos.z);
    const sh = P.shake * P.shake * 0.04;
    camera.rotation.set(P.pitch + P.kickPitch + (Math.random() - 0.5) * sh, P.yaw + P.kickYaw + (Math.random() - 0.5) * sh, 0, 'YXZ');
  };

  P.damage = function (amount, fromX, fromZ) {
    if (!P.alive || P.invuln > 0) return false;
    P.health -= amount; P.invuln = C.player.invulnTime; P.sinceHit = 0; P.shake = Math.min(1, P.shake + 0.6);
    DZ.audio.hurt(); DZ.ui.damageFlash(amount / P.maxHealth, fromX, fromZ); DZ.medals.onPlayerHit();
    if (P.health <= 0) { P.health = 0; P.alive = false; DZ.game.gameOver(); }
    return true;
  };
  P.heal = function (frac) { P.health = Math.min(P.maxHealth, P.health + P.maxHealth * frac); };
})();
