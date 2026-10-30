/* =========================================================
   input.js — teclado, ratón (Pointer Lock) y controles táctiles
   ========================================================= */
(function () {
  const I = DZ.input = {
    keys: {}, events: new Set(), lookX: 0, lookY: 0, fire: false, ads: false,
    moveX: 0, moveY: 0, sprintTouch: false, locked: false, isTouch: false, sens: 1.0, invertY: false
  };
  I.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches);

  I.consume = (name) => { if (I.events.has(name)) { I.events.delete(name); return true; } return false; };
  I.clear = () => { I.keys = {}; I.events.clear(); I.fire = false; I.ads = false; I.lookX = I.lookY = 0; I.moveX = I.moveY = 0; I.sprintTouch = false; };

  const KEYMAP = { KeyR: 'reload', KeyE: 'interact', Digit1: 'slot1', Digit2: 'slot2', Space: 'jump', KeyQ: 'swap', KeyV: 'melee', KeyF: 'melee' };
  addEventListener('keydown', e => {
    if (e.code === 'Escape' || e.code === 'KeyP') { I.events.add('pause'); return; }
    if (e.repeat) { I.keys[e.code] = true; return; }
    I.keys[e.code] = true;
    if (KEYMAP[e.code]) I.events.add(KEYMAP[e.code]);
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', e => { I.keys[e.code] = false; });
  addEventListener('blur', () => { I.keys = {}; I.fire = false; I.ads = false; });

  I.bindCanvas = function (canvas) {
    I.canvas = canvas;
    canvas.addEventListener('mousedown', e => {
      if (I.isTouch) return;
      if (!I.locked) { if (DZ.game && DZ.game.state === 'playing') I.lock(); return; }
      if (e.button === 0) I.fire = true; if (e.button === 2) I.ads = true; if (e.button === 1 || e.button === 3 || e.button === 4) I.events.add('melee');
    });
    addEventListener('mouseup', e => { if (e.button === 0) I.fire = false; if (e.button === 2) I.ads = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => { if (!I.locked) return; I.lookX += e.movementX || 0; I.lookY += e.movementY || 0; });
    addEventListener('wheel', e => { if (I.locked) I.events.add('swap'); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      I.locked = document.pointerLockElement === canvas;
      if (!I.locked) { I.fire = false; I.ads = false; if (DZ.game && DZ.game.state === 'playing' && !I.isTouch) DZ.game.pause(); }
    });
  };
  I.lock = function () { if (I.isTouch || !I.canvas) return; try { const p = I.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } };
  I.unlock = function () { if (document.pointerLockElement) document.exitPointerLock(); };

  /* ---------------------- controles táctiles ---------------------- */
  I.setupTouch = function () {
    const root = document.getElementById('touch'); if (!I.isTouch) { root.remove(); return; }
    document.body.classList.add('is-touch');
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    let stickId = null, sx = 0, sy = 0; const R = 55;
    const lookIds = new Map();
    const stickStart = (t) => { stickId = t.identifier; sx = t.clientX; sy = t.clientY; stick.style.left = (sx - 70) + 'px'; stick.style.top = (sy - 70) + 'px'; stick.classList.add('on'); };
    root.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        const btn = t.target.closest && t.target.closest('[data-btn]');
        if (btn) { const b = btn.dataset.btn; btn.classList.add('down'); btn._tid = t.identifier;
          if (b === 'fire') I.fire = true; else if (b === 'ads') I.ads = !I.ads; else if (b === 'sprint') I.sprintTouch = !I.sprintTouch; else I.events.add(b);
          if (b === 'fire') lookIds.set(t.identifier, { x: t.clientX, y: t.clientY, fire: btn });
          continue; }
        if (t.clientX < innerWidth * 0.42 && stickId === null) stickStart(t);
        else lookIds.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      e.preventDefault();
    }, { passive: false });
    root.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          let dx = t.clientX - sx, dy = t.clientY - sy; const d = Math.hypot(dx, dy);
          if (d > R) { dx *= R / d; dy *= R / d; }
          knob.style.transform = `translate(${dx}px,${dy}px)`; I.moveX = dx / R; I.moveY = -dy / R;
          if (d > R * 1.6) I.sprintTouch = true;
        } else if (lookIds.has(t.identifier)) {
          const l = lookIds.get(t.identifier); I.lookX += (t.clientX - l.x) * 2.2; I.lookY += (t.clientY - l.y) * 2.2; l.x = t.clientX; l.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) { stickId = null; I.moveX = I.moveY = 0; knob.style.transform = ''; stick.classList.remove('on'); I.sprintTouch = false; }
        const l = lookIds.get(t.identifier); if (l) { if (l.fire) { I.fire = false; } lookIds.delete(t.identifier); }
        root.querySelectorAll('[data-btn]').forEach(b => { if (b._tid === t.identifier) { b.classList.remove('down'); if (b.dataset.btn === 'fire') I.fire = false; } });
      }
    };
    root.addEventListener('touchend', end); root.addEventListener('touchcancel', end);
  };
})();
