/* =========================================================
   ui.js — HUD, avisos, panel de interacción, menús y opciones
   ========================================================= */
(function () {
  const $ = id => document.getElementById(id);
  const U = DZ.ui = {};
  const C = DZ.CONFIG;
  let toastT = 0, lastPoints = -1, lastHUD = {};

  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  U.points = function (n) {
    const el = $('points'); if (n === lastPoints) return; el.textContent = n.toLocaleString('es-ES');
    if (n > lastPoints && lastPoints >= 0) restart(el, 'bump'); lastPoints = n;
  };
  U.pointPopup = function (text, reason) {
    const box = $('popups'); if (box.children.length > 8) box.firstChild.remove();
    const d = document.createElement('div'); d.className = 'pop ' + (reason || ''); d.textContent = text;
    d.style.left = (Math.random() * 30) + 'px'; box.appendChild(d); setTimeout(() => d.remove(), 1150);
  };
  U.hitMarker = function (head) { const el = $('hitmarker'); el.classList.toggle('head', !!head); restart(el, 'on'); };
  U.combo = function (n) { const el = $('combo'); el.textContent = 'ELIMINACIÓN RÁPIDA ×' + n; restart(el, 'on'); };
  U.damageFlash = function (frac, fx, fz) {
    const v = $('dmg-vignette'); v.style.transition = 'none'; v.style.opacity = Math.min(1, 0.45 + frac * 2); void v.offsetWidth; v.style.transition = 'opacity 0.6s'; v.style.opacity = 0;
    if (fx !== undefined) {
      const P = DZ.player; const ang = Math.atan2(fx - P.pos.x, fz - P.pos.z);
      // ángulo relativo a la vista (0 = delante)
      const fwd = Math.atan2(-Math.sin(P.yaw), -Math.cos(P.yaw)); let rel = ang - fwd;
      const el = $('dmg-dir'); el.style.transform = `rotate(${-rel}rad)`; restart(el, 'on');
    }
  };
  U.flash = function (color) { const el = $('flash'); el.style.background = '#' + new THREE.Color(color).getHexString(); restart(el, 'on'); };
  U.toast = function (msg, kind) { const el = $('toast'); el.textContent = msg; el.className = 'on ' + (kind || ''); toastT = 2.2; };
  U.banner = function (top, main, sub, good) {
    $('banner-top').textContent = top; $('banner-main').textContent = main; $('banner-sub').textContent = sub || '';
    $('banner-main').classList.toggle('good', !!good); restart($('banner'), 'on');
  };
  U.roundStart = function (r, special) {
    const rn = $('round-num'); rn.textContent = r; restart(rn, 'pulse');
    const sub = special === 'runners' ? '⚠ OLEADA DE CORREDORES · PUNTOS ×2' : special === 'boss' ? '⚠ SE APROXIMA EL COLOSO' : '';
    U.banner('LA HORDA SE ACERCA', 'RONDA ' + r, sub);
  };
  U.roundEnd = function (r, bonus) { U.banner('SUPERVIVENCIA CONFIRMADA', 'RONDA ' + r + ' SUPERADA', '+' + bonus + ' PUNTOS · PREPÁRATE', true); U.pointPopup('+' + bonus, 'round'); };
  U.breakTimer = function (t) { $('wave-state').textContent = 'SIGUIENTE RONDA EN ' + Math.ceil(t) + ' s'; };
  U.bossBar = function (show, name, frac) {
    const el = $('bossbar'); el.classList.toggle('hidden', !show); if (!show) return;
    if (name) $('bossname').textContent = name; if (frac !== undefined) $('bossfill').style.width = Math.max(0, frac * 100) + '%'; else $('bossfill').style.width = '100%';
  };
  // Números de puntos que saltan en el mundo 3D (arcade)
  const _v = new THREE.Vector3();
  U.worldPopup = function (pos, text, reason) {
    const box = $('wpops'); if (!box || !DZ.game.camera) return;
    _v.copy(pos).project(DZ.game.camera); if (_v.z > 1 || Math.abs(_v.x) > 1.1 || Math.abs(_v.y) > 1.1) return;
    if (box.children.length > 14) box.firstChild.remove();
    const d = document.createElement('div'); d.className = 'wpop ' + (reason || ''); d.textContent = text;
    d.style.left = ((_v.x * 0.5 + 0.5) * innerWidth + (Math.random() - 0.5) * 30) + 'px'; d.style.top = ((-_v.y * 0.5 + 0.5) * innerHeight) + 'px';
    box.appendChild(d); setTimeout(() => d.remove(), 900);
  };
  // Potenciadores
  U.powerBanner = function (name, desc, color) {
    const el = $('power-banner'); $('pb-name').textContent = name; $('pb-desc').textContent = desc; el.style.setProperty('--pc', color); restart(el, 'on');
  };
  let lastTimers = '';
  U.powerTimers = function (timers) {
    const T = DZ.CONFIG.powerups.types; const parts = [];
    for (const k in timers) if (timers[k] > 0) parts.push(`<div class="ptimer ${timers[k] < 4 ? 'ending' : ''}" style="--pc:${T[k].color}"><b>${T[k].glyph}</b><span>${T[k].name}</span><i>${Math.ceil(timers[k])}</i></div>`);
    const html = parts.join(''); if (html !== lastTimers) { lastTimers = html; $('power-timers').innerHTML = html; }
  };
  // Medallas de batalla
  U.medal = function (id, pts) {
    const d = DZ.medals.LIST[id], box = $('medals');
    while (box.children.length >= 3) box.firstChild.remove();
    const el = document.createElement('div'); el.className = 'medal tier-' + d.tier;
    el.innerHTML = DZ.medals.svg(id, 56) + `<div class="mtext"><b>${d.name}</b><span>+${pts}</span></div>`;
    box.appendChild(el); setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3100);
  };
  U.medalGrid = function (counts, showLocked) {
    const L = DZ.medals.LIST;
    return Object.keys(L).filter(id => showLocked || counts[id]).map(id => {
      const n = counts[id] || 0, d = L[id];
      return `<div class="mcell ${n ? '' : 'locked'}" title="${d.desc}">${DZ.medals.svg(id, 54)}<b>${d.name}</b><small>${d.desc}</small><i>×${n}</i></div>`;
    }).join('') || '<p class="nomedals">Sin medallas en esta partida</p>';
  };
  U.perks = function () {
    const box = $('perks'); box.innerHTML = '';
    DZ.player.perks.forEach(k => { const p = C.perks[k]; const d = document.createElement('div'); d.className = 'perk'; d.textContent = p.icon; d.title = p.name; d.style.borderColor = p.color; d.style.color = p.color; box.appendChild(d); });
  };

  let lastInfoKey = '';
  U.interact = function (info) {
    const el = $('interact');
    if (!info) { if (lastInfoKey) { el.classList.add('hidden'); lastInfoKey = ''; } return; }
    const key = JSON.stringify(info); if (key === lastInfoKey) return; lastInfoKey = key;
    el.classList.remove('hidden'); el.style.borderTopColor = info.color;
    $('ia-title').textContent = info.title; $('ia-title').style.color = info.color;
    $('ia-desc').textContent = info.desc || '';
    $('ia-stats').innerHTML = info.stats.map(([a, b]) => `<div><span>${a}</span>${b}</div>`).join('');
    $('ia-cost').textContent = info.cost ? info.cost.toLocaleString('es-ES') + ' pts' : '';
    const st = DZ.input.isTouch ? info.status.replace('Pulsa [E]', 'Toca E') : info.status;
    $('ia-status').textContent = st;
    el.classList.toggle('ok', info.ok); el.classList.toggle('no', !info.ok);
  };

  // HUD por fotograma (sólo toca el DOM si cambia algo)
  function set(id, prop, val) { if (lastHUD[id + prop] === val) return; lastHUD[id + prop] = val; const e = $(id); if (prop === 'text') e.textContent = val; else if (prop === 'html') e.innerHTML = val; else e.style[prop] = val; }
  U.update = function (dt) {
    const P = DZ.player, WP = DZ.weapons, W = DZ.waves, w = WP.current();
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('on'); }
    const hp = Math.ceil(P.health); set('htext', 'text', String(hp));
    set('hfill', 'width', (P.health / P.maxHealth * 100).toFixed(1) + '%');
    set('hregen', 'left', (C.player.regenCap * 100) + '%');
    const low = P.health / P.maxHealth < 0.3 && P.alive;
    $('hfill').classList.toggle('low', low); $('lowhp').classList.toggle('on', low);
    const stamMax = C.player.staminaMax * (P.has('step') ? 1.6 : 1); set('sfill', 'width', (P.stamina / stamMax * 100).toFixed(0) + '%');
    if (w) {
      set('wname', 'text', w.def.name);
      set('wlevel', 'text', w.level ? '◆ ' + C.upgrades[w.level].tag + ' · NIVEL ' + w.level + '/3' : 'NIVEL BASE');
      set('wlevel', 'color', w.level ? '#' + new THREE.Color(C.upgrades[w.level].glow).getHexString() : '#8d8a84');
      set('mag', 'text', w.forging ? '—' : String(w.mag)); set('res', 'text', '/ ' + w.reserve);
      const m = $('mag'); m.classList.toggle('empty', w.mag === 0 && !w.forging); m.classList.toggle('low', w.mag > 0 && w.mag <= Math.ceil(w.s.mag * 0.25));
      const rb = $('reloadbar'); rb.classList.toggle('on', w.reloading > 0); if (w.reloading > 0) $('reloadfill').style.width = ((1 - w.reloading / w.reloadTotal) * 100) + '%';
      set('ammo-warn', 'text', w.forging ? 'ARMA EN LA FORJA' : w.reloading > 0 ? 'RECARGANDO…' : (w.mag === 0 && w.reserve === 0 ? 'SIN MUNICIÓN — COMPRA MÁS' : w.mag === 0 ? 'PULSA R PARA RECARGAR' : ''));
    }
    set('wslots', 'html', WP.slots.map((s, i) => `<div class="wslot ${i === WP.cur ? 'on' : ''}">${i + 1} · ${s.def.short.toUpperCase()}${s.level ? ' ' + C.upgrades[s.level].tag : ''}</div>`).join(''));
    if (W.state === 'active') { set('zleft', 'text', 'ZOMBIS RESTANTES: ' + W.remaining()); set('wave-state', 'text', W.special === 'runners' ? 'PUNTOS ×2' : W.special === 'boss' ? 'RONDA DEL COLOSO' : ''); }
    else if (W.state === 'break') set('zleft', 'text', W.round ? 'RONDA DESPEJADA' : 'PREPÁRATE');
    const zn = DZ.map.zoneAt(P.pos.x, P.pos.z); set('zone-name', 'text', zn ? DZ.map.zones[zn].name : '');
    $('crosshair').classList.toggle('ads', DZ.input.ads && !!w && !w.forging);
    // separación dinámica de la mira
    if (w) {
      const spread = (DZ.input.ads ? w.s.adsSpread : w.s.spread) + WP.spreadNow + (Math.hypot(P.vel.x, P.vel.z) > 1 ? w.def.moveSpread : 0);
      const px = Math.round(6 + spread * 500); if (lastHUD.cx !== px) { lastHUD.cx = px;
        const ch = $('crosshair').children; ch[0].style.top = (-px - 9) + 'px'; ch[1].style.top = px + 'px'; ch[2].style.left = (-px - 9) + 'px'; ch[3].style.left = px + 'px'; }
    }
  };

  /* ------------------------- menús ------------------------- */
  U.show = function (id) { ['menu', 'pause', 'gameover'].forEach(s => $(s).classList.toggle('hidden', s !== id)); $('hud').classList.toggle('hidden', id === 'menu'); document.body.classList.toggle('playing', !id); };

  U.panel = function (id) {
    $('menu-main').classList.toggle('hidden', !!id);
    ['p-help', 'p-options', 'p-credits', 'p-medals'].forEach(p => $(p).classList.toggle('hidden', p !== id));
    if (id === 'p-medals') { const L = DZ.medals.lifetime, n = Object.keys(DZ.medals.LIST).filter(k => L[k]).length; $('medal-grid').innerHTML = U.medalGrid(L, true); $('medal-count').textContent = n + ' / ' + Object.keys(DZ.medals.LIST).length + ' desbloqueadas'; }
  };

  U.records = function () {
    const r = DZ.game.records;
    $('records').innerHTML = r.bestRound ? `MEJOR RONDA: <b style="color:#ffcf4a">${r.bestRound}</b> · ELIMINACIONES TOTALES: <b style="color:#ffcf4a">${r.totalKills}</b> · PARTIDAS: ${r.games}` : 'Sin partidas registradas';
  };
  U.statsHTML = function () {
    const E = DZ.economy;
    return [['Ronda', DZ.waves.round], ['Eliminaciones', DZ.zombies.kills], ['Medallas', DZ.medals.total], ['Potenciadores', DZ.powerups.picked], ['Disparos a la cabeza', E.headshots], ['Puntos obtenidos', E.earned.toLocaleString('es-ES')], ['Puntos gastados', E.spent.toLocaleString('es-ES')], ['Ventajas', DZ.player.perks.length]]
      .map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
  };
  U.gameOver = function (isRecord) {
    $('go-stats').innerHTML = U.statsHTML();
    $('go-medals').innerHTML = U.medalGrid(DZ.medals.session, false);
    $('go-record').textContent = isRecord ? '★ ¡NUEVO RÉCORD PERSONAL! ★' : 'Récord: ronda ' + DZ.game.records.bestRound;
    U.show('gameover');
  };

  // Opciones (guardadas en localStorage)
  U.bindOptions = function () {
    const G = DZ.game, o = G.options;
    const bind = (id, key, fmt, apply) => {
      const el = $(id); el.value = o[key]; const out = el.parentElement.querySelector('span');
      const upd = () => { o[key] = el.type === 'checkbox' ? el.checked : parseFloat(el.value); if (out) out.textContent = fmt(o[key]); apply(); G.saveOptions(); };
      if (el.type === 'checkbox') el.checked = !!o[key];
      el.addEventListener('input', upd); el.addEventListener('change', upd); if (out) out.textContent = fmt(o[key]);
    };
    const pct = v => Math.round(v * 100) + '%';
    bind('o-master', 'master', pct, G.applyOptions); bind('o-sfx', 'sfx', pct, G.applyOptions); bind('o-amb', 'amb', pct, G.applyOptions);
    bind('o-sens', 'sens', v => v.toFixed(2), G.applyOptions); bind('o-fov', 'fov', v => v + '°', G.applyOptions);
    bind('o-quality', 'quality', v => '', G.applyOptions); bind('o-invert', 'invert', v => '', G.applyOptions);
  };
})();
