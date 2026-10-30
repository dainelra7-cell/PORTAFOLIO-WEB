/* =========================================================
   medals.js — MEDALLAS DE BATALLA
   Se ganan durante la partida por hazañas (rachas, disparos a la
   cabeza, bajas múltiples, rondas perfectas...). Dan puntos extra,
   aparecen en pantalla y se guardan en la colección del jugador.
   ========================================================= */
(function () {
  const TIERS = {
    bronze: { name: 'Bronce', c1: '#f0a868', c2: '#7a3f17', ring: '#ffd0a0' },
    silver: { name: 'Plata', c1: '#f2f6fa', c2: '#6c7a88', ring: '#ffffff' },
    gold:   { name: 'Oro', c1: '#ffe27a', c2: '#a8700a', ring: '#fff3b8' },
    legend: { name: 'Leyenda', c1: '#e7a8ff', c2: '#5a1a8f', ring: '#ffd6ff' }
  };
  // id: nombre, descripción, rango, puntos y símbolo de la insignia
  const LIST = {
    first:       { name: 'PRIMER CONTACTO',    desc: 'Primera baja de la partida',                 tier: 'bronze', pts: 25,   glyph: '1' },
    double:      { name: 'DOBLE BAJA',         desc: '2 bajas encadenadas en un instante',         tier: 'bronze', pts: 20,   glyph: '×2' },
    triple:      { name: 'TRIPLE BAJA',        desc: '3 bajas encadenadas',                        tier: 'silver', pts: 40,  glyph: '×3' },
    massacre:    { name: 'MASACRE',            desc: '5 bajas encadenadas',                        tier: 'gold',   pts: 100,  glyph: '×5' },
    apocalypse:  { name: 'APOCALIPSIS',        desc: '8 bajas encadenadas',                        tier: 'legend', pts: 250,  glyph: '×8' },
    unstoppable: { name: 'IMPARABLE',          desc: '12 bajas encadenadas',                       tier: 'legend', pts: 500, glyph: '×12' },
    collateral:  { name: 'COLATERAL',          desc: '2 bajas con un solo disparo',                tier: 'silver', pts: 50,  glyph: '⇶' },
    skewer:      { name: 'BROCHETA',           desc: '3 o más bajas con un solo disparo',          tier: 'gold',   pts: 120,  glyph: '⇶3' },
    headhunter:  { name: 'CAZACABEZAS',        desc: '5 bajas seguidas a la cabeza',               tier: 'silver', pts: 75,  glyph: '◎' },
    hawkeye:     { name: 'OJO DE HALCÓN',      desc: '10 bajas seguidas a la cabeza',              tier: 'gold',   pts: 200,  glyph: '◉' },
    untouchable: { name: 'INTOCABLE',          desc: '20 bajas sin recibir daño',                  tier: 'silver', pts: 100,  glyph: '✦' },
    ghost:       { name: 'FANTASMA',           desc: '40 bajas sin recibir daño',                  tier: 'gold',   pts: 250,  glyph: '✧' },
    living:      { name: 'LEYENDA VIVA',       desc: '75 bajas sin recibir daño',                  tier: 'legend', pts: 500, glyph: '♛' },
    closecall:   { name: 'POR LOS PELOS',      desc: 'Baja con la salud en estado crítico',        tier: 'bronze', pts: 50,   glyph: '♥' },
    knockout:    { name: 'CULATAZO',           desc: 'Baja cuerpo a cuerpo',                       tier: 'bronze', pts: 30,   glyph: 'KO' },
    brawler:     { name: 'PUÑOS DE ACERO',     desc: '5 bajas cuerpo a cuerpo seguidas',           tier: 'gold',   pts: 150,  glyph: 'KO5' },
    aerial:      { name: 'ACRÓBATA',           desc: 'Baja en pleno salto',                        tier: 'bronze', pts: 30,   glyph: '↑' },
    giant:       { name: 'MATAGIGANTES',       desc: 'Elimina a un zombi Pesado',                  tier: 'silver', pts: 60,  glyph: '▲' },
    colossus:    { name: 'CAÍDA DEL COLOSO',   desc: 'Derrota a EL COLOSO',                        tier: 'legend', pts: 1000, glyph: '♜' },
    lastone:     { name: 'LIMPIEZA',           desc: 'Elimina al último zombi de la ronda',        tier: 'bronze', pts: 30,   glyph: '✓' },
    perfect:     { name: 'RONDA PERFECTA',     desc: 'Supera una ronda sin recibir daño',          tier: 'gold',   pts: 150,  glyph: '★' },
    survivor:    { name: 'SUPERVIVIENTE',      desc: 'Supera cada bloque de 5 rondas',             tier: 'silver', pts: 200,  glyph: 'V' },
    detonator:   { name: 'DETONADOR',          desc: 'Una Detonación elimina a 8 o más zombis',    tier: 'gold',   pts: 100,  glyph: '✹' },
    trigger:     { name: 'GATILLO DE FUEGO',   desc: '15 bajas durante un mismo Frenesí',          tier: 'gold',   pts: 120,  glyph: '⚡' }
  };
  const M = DZ.medals = { LIST, TIERS, session: {}, lifetime: {}, total: 0 };
  try { M.lifetime = JSON.parse(localStorage.getItem('dz_medals') || '{}'); } catch (e) { M.lifetime = {}; }

  /* ----------------------- insignia SVG ----------------------- */
  M.svg = function (id, size) {
    const d = LIST[id], t = TIERS[d.tier], gid = 'g' + id + Math.random().toString(36).slice(2, 6);
    let shape;
    if (d.tier === 'bronze') shape = '<polygon points="50,4 90,27 90,73 50,96 10,73 10,27"/>';
    else if (d.tier === 'silver') shape = '<path d="M50 4 L88 16 L84 58 Q78 82 50 96 Q22 82 16 58 L12 16 Z"/>';
    else if (d.tier === 'gold') { let p = ''; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 38 : 48; p += (50 + Math.cos(a) * r).toFixed(1) + ',' + (50 + Math.sin(a) * r).toFixed(1) + ' '; } shape = '<polygon points="' + p + '"/>'; }
    else shape = '<path d="M50 2 L70 30 L98 22 L80 50 L98 78 L70 70 L50 98 L30 70 L2 78 L20 50 L2 22 L30 30 Z"/>';
    const fs = d.glyph.length > 2 ? 22 : d.glyph.length > 1 ? 28 : 38;
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.c1}"/><stop offset="1" stop-color="${t.c2}"/></linearGradient></defs>
      <g fill="url(#${gid})" stroke="${t.ring}" stroke-width="3">${shape}</g>
      <circle cx="50" cy="50" r="27" fill="#0d0f12" stroke="${t.ring}" stroke-width="2.5"/>
      <text x="50" y="51" text-anchor="middle" dominant-baseline="central" font-family="Impact, Arial Black, sans-serif" font-size="${fs}" fill="${t.c1}">${d.glyph}</text></svg>`;
  };

  /* ----------------------- estado ----------------------- */
  M.reset = function () {
    M.session = {}; M.total = 0; M.chain = 0; M.lastKill = -9; M.chainAwarded = {}; M.shots = new Map();
    M.headStreak = 0; M.noHit = 0; M.meleeStreak = 0; M.roundDamaged = false; M.firstDone = false;
    M.cd = {}; M.frenzyKills = 0;
  };
  M.reset();

  M.award = function (id) {
    const d = LIST[id]; if (!d) return;
    M.session[id] = (M.session[id] || 0) + 1; M.total++;
    M.lifetime[id] = (M.lifetime[id] || 0) + 1;
    try { localStorage.setItem('dz_medals', JSON.stringify(M.lifetime)); } catch (e) { }
    DZ.economy.add(d.pts, 'medal', null, true);
    DZ.ui.medal(id, d.pts);
    DZ.audio.medal(d.tier);
  };
  function cool(id, secs) { const now = DZ.game.time; if (M.cd[id] && now - M.cd[id] < secs) return false; M.cd[id] = now; return true; }

  /* ----------------------- eventos ----------------------- */
  M.onKill = function (z, head, src) {
    const now = DZ.game.time, P = DZ.player;
    if (!M.firstDone) { M.firstDone = true; M.award('first'); }
    if (src.kind === 'nuke') return; // las bajas de la Detonación tienen su propia medalla
    // bajas encadenadas
    if (now - M.lastKill <= 1.8) M.chain++; else { M.chain = 1; M.chainAwarded = {}; }
    M.lastKill = now;
    const tiers = { 2: 'double', 3: 'triple', 5: 'massacre', 8: 'apocalypse', 12: 'unstoppable' };
    if (tiers[M.chain] && !M.chainAwarded[M.chain]) { M.chainAwarded[M.chain] = true; M.award(tiers[M.chain]); }
    // varias bajas con un mismo disparo
    if (src.kind === 'gun') {
      const n = (M.shots.get(src.shot) || 0) + 1; M.shots.set(src.shot, n);
      if (M.shots.size > 50) M.shots.delete(M.shots.keys().next().value);
      if (n === 2) M.award('collateral'); else if (n === 3) M.award('skewer');
      // racha de disparos a la cabeza
      if (head) { M.headStreak++; if (M.headStreak === 5) M.award('headhunter'); if (M.headStreak === 10) { M.award('hawkeye'); M.headStreak = 0; } }
      else M.headStreak = 0;
      M.meleeStreak = 0;
    }
    if (src.kind === 'melee') {
      if (cool('knockout', 2.5)) M.award('knockout');
      M.meleeStreak++; if (M.meleeStreak === 5) { M.award('brawler'); M.meleeStreak = 0; }
    }
    // racha sin recibir daño
    M.noHit++;
    if (M.noHit === 20) M.award('untouchable'); else if (M.noHit === 40) M.award('ghost'); else if (M.noHit === 75) M.award('living');
    if (P.health / P.maxHealth < 0.25 && cool('closecall', 8)) M.award('closecall');
    if (!P.onGround && P.pos.y > 0.25 && cool('aerial', 3)) M.award('aerial');
    if (z.type === 'brute') M.award('giant');
    if (z.type === 'boss') M.award('colossus');
    if (DZ.powerups.active('frenzy')) { M.frenzyKills++; if (M.frenzyKills === 15) M.award('trigger'); } else M.frenzyKills = 0;
  };
  M.onPlayerHit = function () { M.noHit = 0; M.roundDamaged = true; };
  M.onNuke = function (n) { if (n >= 8) M.award('detonator'); };
  M.onRoundStart = function () { M.roundDamaged = false; };
  M.onRoundEnd = function (round) {
    M.award('lastone');
    if (!M.roundDamaged) M.award('perfect');
    if (round % 5 === 0) M.award('survivor');
  };
})();
