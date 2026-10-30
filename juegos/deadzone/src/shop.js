/* =========================================================
   shop.js — interacción con estaciones: armas, munición,
   ventajas, botiquín, puertas, energía y FORJA OMEGA
   ========================================================= */
(function () {
  const C = DZ.CONFIG;
  const S = DZ.shop = { target: null, healUses: 0, healCd: 0, forge: null, lockT: 0 };

  S.reset = function () {
    if (S.forge) S.abortForge();
    S.target = null; S.healUses = 0; S.healCd = 0; S.lockT = 0;
  };

  const fmt = n => n.toLocaleString('es-ES');
  function ammoPrice(w, full) {
    const lvlMul = 1 + w.level * 0.5;
    if (full) return Math.round(w.def.ammoCost * lvlMul / 10) * 10;
    const missing = (w.s.reserveMax - w.reserve) + (w.s.mag - w.mag);
    const frac = missing / (w.s.reserveMax + w.s.mag);
    return Math.max(50, Math.ceil(w.def.ammoCost * lvlMul * frac / 10) * 10);
  }
  const ammoFull = w => w.reserve >= w.s.reserveMax && w.mag >= w.s.mag;

  // Construye la información del panel para un objetivo
  S.describe = function (t) {
    const E = DZ.economy, WP = DZ.weapons, P = DZ.player, cur = WP.current();
    const info = { title: '', desc: '', stats: [], cost: 0, ok: false, status: '', color: '#ffcf4a' };
    const need = c => { info.cost = c; if (E.can(c)) { info.ok = true; info.status = 'Pulsa [E] para comprar'; } else info.status = 'Te faltan ' + fmt(c - E.points) + ' pts'; };
    if (t.kind === 'door') {
      info.title = t.door.name; info.desc = 'Abre el paso a ' + t.door.zones.filter(z => !DZ.map.activeZones.has(z)).map(z => DZ.map.zones[z].name).join(', ');
      info.color = '#ff7a59'; need(t.door.cost); if (info.ok) info.status = 'Pulsa [E] para abrir'; return info;
    }
    const s = t.st;
    if (s.type === 'weapon') {
      const def = C.weapons[s.weapon], owned = WP.owns(s.weapon);
      info.title = def.name; info.desc = def.short + ' — ' + def.desc;
      const st = WP.stats(s.weapon, 0);
      info.stats = [['Daño', st.damage + (def.pellets > 1 ? '×' + def.pellets : '')], ['Cadencia', Math.round(st.rpm) + ' dpm'], ['Cargador', st.mag], ['Recarga', st.reload.toFixed(1) + ' s']];
      if (owned) {
        info.title = 'MUNICIÓN · ' + def.name;
        if (ammoFull(owned)) { info.status = 'Munición completa'; info.cost = ammoPrice(owned, true); }
        else { need(ammoPrice(owned, true)); if (info.ok) info.status = 'Pulsa [E] para reponer munición'; }
        info.stats = [['Cargador', owned.mag + '/' + owned.s.mag], ['Reserva', owned.reserve + '/' + owned.s.reserveMax]];
      } else if (cur && cur.forging && WP.slots.length >= 2) { info.cost = def.price; info.status = 'Espera a que termine la mejora del arma'; }
      else { need(def.price); if (info.ok && WP.slots.length >= 2) info.status = 'Pulsa [E] · sustituye a ' + cur.def.short; }
      return info;
    }
    if (s.type === 'ammo') {
      info.color = '#9fe06b'; info.title = 'CAJA DE MUNICIÓN';
      if (!cur) { info.status = 'Sin arma'; return info; }
      info.desc = 'Repone el arma equipada: ' + WP.displayName(cur);
      info.stats = [['Cargador', cur.mag + '/' + cur.s.mag], ['Reserva', cur.reserve + '/' + cur.s.reserveMax]];
      if (cur.forging) { info.status = 'El arma está en la Forja'; return info; }
      if (ammoFull(cur)) { info.status = 'Munición completa'; info.cost = ammoPrice(cur, true); return info; }
      need(ammoPrice(cur, false)); if (info.ok) info.status = 'Pulsa [E] para reponer'; return info;
    }
    if (s.type === 'perk') {
      const p = C.perks[s.perk]; info.color = p.color; info.title = 'VENTAJA · ' + p.name; info.desc = p.desc;
      info.stats = [['Ventajas', P.perks.length + '/' + C.maxPerks]];
      if (P.has(s.perk)) { info.status = 'ACTIVA'; info.cost = p.cost; return info; }
      if (P.perks.length >= C.maxPerks) { info.status = 'Límite de ventajas alcanzado (' + C.maxPerks + ')'; info.cost = p.cost; return info; }
      need(p.cost); return info;
    }
    if (s.type === 'health') {
      const h = C.health; info.color = '#ff6b6b'; info.title = h.name; info.desc = 'Recupera el ' + Math.round(h.heal * 100) + '% de la salud máxima. Máx. ' + h.usesPerRound + ' usos por ronda.';
      info.stats = [['Salud', Math.ceil(P.health) + '/' + P.maxHealth], ['Usos', S.healUses + '/' + h.usesPerRound]];
      info.cost = h.cost;
      if (P.health >= P.maxHealth) { info.status = 'Salud completa'; return info; }
      if (S.healUses >= h.usesPerRound) { info.status = 'Agotado en esta ronda'; return info; }
      if (S.healCd > 0) { info.status = 'Recargando… ' + Math.ceil(S.healCd) + ' s'; return info; }
      need(h.cost); return info;
    }
    if (s.type === 'power') {
      info.color = '#4dffa0'; info.title = 'ENERGÍA DE EMERGENCIA';
      if (DZ.map.powered) { info.desc = 'La Forja Omega tiene energía.'; info.status = 'ACTIVADA'; return info; }
      info.desc = 'Reactiva el reactor y da energía a la Forja Omega (+' + C.economy.powerSwitchBonus + ' pts).'; info.ok = true; info.status = 'Pulsa [E] para activar'; return info;
    }
    if (s.type === 'forge') {
      info.color = '#c86bff'; info.title = 'FORJA OMEGA';
      if (!DZ.map.powered) { info.desc = 'La máquina no tiene energía.'; info.status = 'Activa el interruptor de energía de esta sala'; return info; }
      if (S.forge) { info.desc = 'Mejorando ' + WP.displayName(S.forge.w) + '…'; info.status = 'Pulsa [E] para recoger al instante'; info.ok = true; info.cost = 0; return info; }
      if (!cur) { info.status = 'Sin arma'; return info; }
      const lvl = cur.level, next = lvl + 1;
      info.desc = 'Arma seleccionada: ' + WP.displayName(cur) + (WP.slots.length > 1 ? '  (cambia con 1/2)' : '');
      if (lvl >= 3) { info.stats = [['Nivel', 'MK-III (máximo)']]; info.status = 'Nivel máximo alcanzado'; return info; }
      const a = WP.stats(cur.type, lvl), b = WP.stats(cur.type, next);
      info.stats = [['Nivel', (lvl ? C.upgrades[lvl].tag : 'BASE') + ' → ' + C.upgrades[next].tag], ['Daño', a.damage + ' → ' + b.damage], ['Cargador', a.mag + ' → ' + b.mag], ['Precisión', '+' + Math.round((1 - C.upgrades[next].spread) * 100) + '%']];
      need(C.upgrades[next].cost); if (info.ok) info.status = 'Pulsa [E] para confirmar ' + fmt(info.cost) + ' pts'; return info;
    }
    return info;
  };

  // Busca el objetivo de interacción más cercano
  S.findTarget = function () {
    const P = DZ.player.pos, M = DZ.map; let best = null, bd = 1e9;
    for (const st of M.stations) {
      if (!M.activeZones.has(st.zone)) continue;
      const d = Math.hypot(st.x - P.x, st.z - P.z); if (d < 2.45 && d < bd) { bd = d; best = { kind: 'station', st }; }
    }
    for (const id in M.doors) {
      const dr = M.doors[id]; if (dr.open) continue;
      const d = Math.min(...dr.tiles.map(i => Math.hypot(M.center(i % M.W) - P.x, M.center((i / M.W) | 0) - P.z)));
      if (d < 2.6 && d < bd) { bd = d; best = { kind: 'door', door: dr }; }
    }
    return best;
  };

  S.update = function (dt) {
    S.healCd = Math.max(0, S.healCd - dt); S.lockT = Math.max(0, S.lockT - dt);
    S.target = S.findTarget();
    const info = S.target ? S.describe(S.target) : null;
    DZ.ui.interact(info);
    if (DZ.input.consume('interact') && S.target && S.lockT <= 0) { S.lockT = 0.25; S.use(S.target); }
    S.updateForge(dt);
  };

  // Ejecuta la compra / interacción
  S.use = function (t) {
    const E = DZ.economy, WP = DZ.weapons, P = DZ.player, A = DZ.audio, cur = WP.current();
    const deny = (msg) => { A.deny(); if (msg) DZ.ui.toast(msg, 'bad'); return false; };
    const ok = (msg) => { A.buy(); if (msg) DZ.ui.toast(msg, 'good'); DZ.fx.purchase(t.st ? new THREE.Vector3(t.st.x, 1.2, t.st.z) : new THREE.Vector3(t.door.x, 1.5, t.door.z)); return true; };
    if (t.kind === 'door') {
      const d = t.door; if (d.open) return false;
      if (!E.spend(d.cost)) return deny('Te faltan ' + fmt(d.cost - E.points) + ' pts');
      DZ.map.openDoor(d.id); A.door(); DZ.ui.toast(d.name + ' abierta', 'good'); return true;
    }
    const s = t.st;
    if (s.type === 'weapon') {
      const def = C.weapons[s.weapon], owned = WP.owns(s.weapon);
      if (owned) {
        if (ammoFull(owned)) return deny('Munición completa');
        const c = ammoPrice(owned, true); if (!E.spend(c)) return deny('Te faltan ' + fmt(c - E.points) + ' pts');
        owned.reserve = owned.s.reserveMax; owned.mag = owned.s.mag; owned.reloading = 0; return ok('Munición repuesta');
      }
      if (cur && cur.forging && WP.slots.length >= 2) return deny('Espera a que termine la mejora');
      if (!E.spend(def.price)) return deny('Te faltan ' + fmt(def.price - E.points) + ' pts');
      WP.give(s.weapon); return ok(def.name + ' adquirida');
    }
    if (s.type === 'ammo') {
      if (!cur || cur.forging) return deny();
      if (ammoFull(cur)) return deny('Munición completa');
      const c = ammoPrice(cur, false); if (!E.spend(c)) return deny('Te faltan ' + fmt(c - E.points) + ' pts');
      cur.reserve = cur.s.reserveMax; cur.mag = Math.max(cur.mag, 0); return ok('Reserva al máximo');
    }
    if (s.type === 'perk') {
      const p = C.perks[s.perk];
      if (P.has(s.perk)) return deny('Ya tienes ' + p.name);
      if (P.perks.length >= C.maxPerks) return deny('Límite de ventajas alcanzado');
      if (!E.spend(p.cost)) return deny('Te faltan ' + fmt(p.cost - E.points) + ' pts');
      P.addPerk(s.perk); DZ.ui.perks(); return ok(p.name + ' activada');
    }
    if (s.type === 'health') {
      const h = C.health;
      if (P.health >= P.maxHealth) return deny('Salud completa');
      if (S.healUses >= h.usesPerRound) return deny('Agotado en esta ronda');
      if (S.healCd > 0) return deny('Recargando');
      if (!E.spend(h.cost)) return deny('Te faltan ' + fmt(h.cost - E.points) + ' pts');
      P.heal(h.heal); S.healUses++; S.healCd = h.cooldown; return ok('Salud recuperada');
    }
    if (s.type === 'power') {
      if (DZ.map.powered) return false;
      DZ.map.powered = true; A.power(); s.lever.rotation.x = -0.7;
      const forge = DZ.map.stations.find(x => x.type === 'forge');
      forge.light.intensity = 6; forge.ring.material.color.setHex(0xd98aff); forge.core.material.color.setHex(0xc86bff);
      DZ.map.lights.forEach(l => { if (l.flicker) l.base *= 1.25; });
      E.add(C.economy.powerSwitchBonus, 'bonus', null, true); DZ.ui.toast('¡Energía restaurada! La Forja Omega está activa', 'good'); return true;
    }
    if (s.type === 'forge') {
      if (!DZ.map.powered) return deny('Sin energía');
      if (S.forge) { S.finishForge(false); return true; } // recoger al instante (interrupción segura)
      if (!cur) return deny();
      if (cur.level >= 3) return deny('Nivel máximo');
      if (cur.reloading > 0) cur.reloading = 0;
      const cost = C.upgrades[cur.level + 1].cost;
      if (!E.spend(cost)) return deny('Te faltan ' + fmt(cost - E.points) + ' pts');
      S.startForge(s, cur); return true;
    }
    return false;
  };

  /* -------------------- secuencia de la Forja -------------------- */
  S.startForge = function (st, w) {
    w.forging = true; S.forge = { st, w, t: 0, dur: C.upgradeDuration, model: DZ.buildWeaponModel(w.type, w.level, false) };
    S.forge.model.scale.setScalar(2.2); st.slot.add(S.forge.model);
    DZ.audio.forge(C.upgradeDuration); DZ.ui.toast('Forjando ' + DZ.weapons.displayName(w) + '…', 'info');
  };
  S.updateForge = function (dt) {
    const f = S.forge;
    // animación de reposo de la máquina
    const st = DZ.map.stations.find(x => x.type === 'forge');
    if (st && DZ.map.powered) { st.ring.rotation.z += dt * (f ? 12 : 1.2); st.core.scale.setScalar(1 + Math.sin(performance.now() * 0.004) * 0.1 + (f ? 0.4 : 0)); }
    if (!f) return;
    f.t += dt; const k = f.t / f.dur;
    f.model.rotation.y += dt * (4 + k * 18); f.model.position.y = Math.sin(f.t * 6) * 0.05;
    f.st.pistons.forEach((p, i) => p.position.y = 1.7 + Math.sin(f.t * 14 + i * Math.PI) * 0.25);
    f.st.light.intensity = 6 + k * 20 + Math.random() * 6;
    if (Math.random() < 0.4) DZ.fx.spark(new THREE.Vector3(f.st.x, 1.45, f.st.z), 0xd98aff);
    if (f.t >= f.dur) S.finishForge(false);
  };
  S.finishForge = function (silent) {
    const f = S.forge; if (!f) return; S.forge = null;
    f.st.slot.remove(f.model); f.st.light.intensity = 6; f.st.pistons.forEach(p => p.position.y = 1.7);
    f.w.forging = false; DZ.audio.stopForge();
    DZ.weapons.applyLevel(f.w, f.w.level + 1);
    if (!silent) {
      DZ.fx.burst(new THREE.Vector3(f.st.x, 1.5, f.st.z), C.upgrades[f.w.level].glow, 40, 5);
      DZ.ui.toast(DZ.weapons.displayName(f.w) + ' — ¡MEJORADA!', 'good'); DZ.ui.flash(C.upgrades[f.w.level].glow);
    }
  };
  S.abortForge = function () { // fin de partida durante la secuencia: limpieza segura
    const f = S.forge; if (!f) return; S.forge = null; f.st.slot.remove(f.model); f.w.forging = false; DZ.audio.stopForge();
  };
})();
