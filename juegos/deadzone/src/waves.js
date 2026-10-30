/* =========================================================
   waves.js — rondas, aparición de enemigos, dificultad
   progresiva y rondas especiales
   ========================================================= */
(function () {
  const C = DZ.CONFIG, D = DZ.DIFF;
  const W = DZ.waves = { round: 0, state: 'idle', timer: 0, toSpawn: 0, spawned: 0, killed: 0, total: 0, spawnT: 0, special: null, bossPending: false, queue: [] };

  W.reset = function () { W.round = 0; W.state = 'break'; W.timer = C.waves.firstDelay; W.special = null; W.queue = []; W.total = W.killed = W.spawned = 0; };

  W.pointMul = () => W.special === 'runners' ? 2 : 1;
  W.dmgMul = () => W.round <= 12 ? 1 : 1 + (W.round - 12) * 0.05;
  W.remaining = () => Math.max(0, W.total - W.killed);

  W.startRound = function () {
    W.round++; W.special = D.special(W.round);
    let count = D.count(W.round);
    W.queue = [];
    if (W.special === 'runners') { count = Math.round(count * 0.85); for (let i = 0; i < count; i++) W.queue.push(Math.random() < 0.12 ? 'walker' : 'runner'); }
    else {
      if (W.special === 'boss') count = Math.round(count * 0.6);
      for (let i = 0; i < count; i++) {
        const r = Math.random();
        W.queue.push(r < D.bruteChance(W.round) ? 'brute' : r < D.bruteChance(W.round) + D.runnerChance(W.round) ? 'runner' : 'walker');
      }
      if (W.special === 'boss') W.queue.splice(Math.min(4, W.queue.length), 0, 'boss');
    }
    W.total = W.queue.length; W.spawned = 0; W.killed = 0; W.spawnT = 1.0; W.state = 'active';
    DZ.ui.roundStart(W.round, W.special); DZ.powerups.onRoundStart(); DZ.medals.onRoundStart();
    DZ.audio.roundStart();
    DZ.shop.healUses = 0;
  };

  W.onZombieKilled = function () {
    if (W.state !== 'active') return;
    W.killed++;
    if (W.killed >= W.total && W.spawned >= W.total) W.endRound();
  };

  W.endRound = function () {
    W.state = 'break'; W.timer = C.waves.breakTime + (W.special === 'boss' ? 4 : 0);
    const bonus = C.economy.roundBonusPerRound * W.round * (W.special ? 2 : 1);
    DZ.economy.add(bonus, 'round', null, true);
    DZ.ui.roundEnd(W.round, bonus); DZ.medals.onRoundEnd(W.round);
    DZ.audio.roundEnd();
    DZ.shop.healUses = 0;
    W.special = null;
  };

  W.update = function (dt) {
    if (W.state === 'break') {
      W.timer -= dt; DZ.ui.breakTimer(Math.max(0, W.timer));
      if (W.timer <= 0) W.startRound();
      return;
    }
    if (W.state !== 'active') return;
    W.spawnT -= dt;
    const alive = DZ.zombies.alive();
    if (W.spawned < W.total && W.spawnT <= 0 && alive < D.maxAlive(W.round)) {
      const type = W.queue[W.spawned];
      const hpMul = D.hpMul(W.round) * (type === 'boss' ? 1 + (W.round / 10 - 1) * 0.6 : 1);
      const z = DZ.zombies.spawn(type, { hpMul });
      if (z) { W.spawned++; W.spawnT = D.spawnInterval(W.round) * (W.special === 'runners' ? 0.6 : 1) * (0.6 + Math.random() * 0.8); }
      else W.spawnT = 0.5;
    }
  };
})();
