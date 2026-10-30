/* =========================================================
   economy.js — puntos, recompensas, rachas y estadísticas
   ========================================================= */
(function () {
  const E = DZ.economy = { points: 0, earned: 0, spent: 0, combo: 0, comboT: 0, headshots: 0 };
  const EC = DZ.CONFIG.economy;

  E.reset = function () { E.points = EC.startPoints; E.earned = 0; E.spent = 0; E.combo = 0; E.comboT = 0; E.headshots = 0; DZ.ui.points(E.points); };

  // Multiplicador global: ronda de corredores (×2) y potenciador PUNTOS ×2
  E.mul = () => Math.max(DZ.waves.pointMul(), DZ.powerups.active('double') ? 2 : 1); // los ×2 no se acumulan

  // worldPos: si se indica, el número también salta en el mundo 3D (estilo arcade)
  E.add = function (n, reason, worldPos, noMul) {
    if (!noMul) n *= E.mul();
    n = Math.round(n); if (n <= 0) return;
    E.points += n; E.earned += n; DZ.ui.points(E.points); DZ.ui.pointPopup('+' + n, reason);
    if (worldPos) DZ.ui.worldPopup(worldPos, '+' + n, reason);
  };
  E.can = (cost) => E.points >= cost;
  E.spend = function (cost) {
    if (cost < 0 || E.points < cost) return false;
    E.points -= cost; E.spent += cost; DZ.ui.points(E.points); if (cost > 0) DZ.ui.pointPopup('-' + cost, 'spend'); return true;
  };

  E.onKill = function (z, head, src, point) {
    let base = src && src.kind === 'melee' ? EC.meleeKill : head ? EC.headshotKill : EC.kill;
    if (src && src.kind === 'nuke') base = 50;
    if (head) E.headshots++;
    base *= z.def.points; // pesado ×2, coloso ×10
    // eliminaciones rápidas encadenadas
    if (E.comboT > 0) E.combo++; else E.combo = 0;
    E.comboT = EC.comboWindow;
    const bonus = Math.min(EC.comboBonusMax, E.combo * EC.comboBonusStep);
    E.add(base + bonus, head ? 'head' : src && src.kind === 'melee' ? 'melee' : 'kill', point);
    if (bonus > 0) DZ.ui.combo(E.combo + 1);
  };

  E.update = function (dt) { if (E.comboT > 0) { E.comboT -= dt; if (E.comboT <= 0) E.combo = 0; } };
})();
