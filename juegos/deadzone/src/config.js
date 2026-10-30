/* =========================================================
   DEADZONE — UNDEAD PROTOCOL
   config.js — configuración centralizada (precios, armas,
   ventajas, rondas, enemigos). Ajusta aquí el equilibrio.
   ========================================================= */
window.DZ = window.DZ || {};

DZ.CONFIG = {
  TILE: 2,              // metros por casilla del mapa
  WALL_H: 4.2,

  player: {
    radius: 0.38,
    eyeHeight: 1.65,
    walkSpeed: 5.6,
    sprintSpeed: 8.8,
    accel: 48,
    decel: 30,
    airControl: 0.5,
    jumpSpeed: 6.4,
    gravity: 17,
    maxHealth: 100,
    invulnTime: 0.75,      // invulnerabilidad tras recibir un golpe
    regenDelay: 3.0,      // segundos sin daño antes de regenerar
    regenRate: 16,         // salud por segundo
    regenCap: 0.7,        // regenera sólo hasta el 70% de la salud máxima
    staminaMax: 6,        // segundos de carrera
    staminaRegen: 2.2
  },

  economy: {
    startPoints: 500,
    hit: 10,              // por impacto que no mata
    maxHitRewardsPerZombie: 8, // tope de recompensas por impacto en un mismo zombi
    kill: 60,
    headshotKill: 100,
    comboWindow: 1.8,     // segundos para encadenar eliminaciones rápidas
    comboBonusStep: 10,
    comboBonusMax: 30,
    roundBonusPerRound: 50,
    powerSwitchBonus: 250,
    meleeKill: 130
  },

  doors: {
    // id: { coste, nombre }
    '1': { cost: 750,  name: 'Portón del Muelle' },
    '2': { cost: 1000, name: 'Esclusa del Laboratorio' },
    '3': { cost: 1250, name: 'Puerta de la Armería' },
    '4': { cost: 1500, name: 'Acceso al Reactor (Armería)' },
    '5': { cost: 1500, name: 'Acceso al Reactor (Muelle)' }
  },

  /* ----------------------- ARMAS ------------------------ */
  weapons: {
    pistol: {
      name: 'P-17 GUARDIANA', short: 'Pistola', desc: 'Pistola de servicio fiable. Disparo semiautomático.',
      damage: 36, rpm: 380, auto: false, pellets: 1, mag: 12, reserveMax: 96,
      reload: 1.1, spread: 0.010, adsSpread: 0.002, moveSpread: 0.03, recoil: 0.022,
      range: 80, falloffStart: 30, falloffEnd: 70, minFalloff: 0.6,
      price: 0, ammoCost: 150, speedMul: 1.0, color: 0x3a3f46, accent: 0xc9a227,
      sound: { pitch: 1.4, body: 0.6, len: 0.12 }
    },
    smg: {
      name: 'VX-9 AVISPA', short: 'Subfusil', desc: 'Cadencia altísima, retroceso nervioso. Gasta mucha munición.',
      damage: 28, rpm: 900, auto: true, pellets: 1, mag: 40, reserveMax: 280,
      reload: 1.6, spread: 0.032, adsSpread: 0.012, moveSpread: 0.03, recoil: 0.013,
      range: 60, falloffStart: 15, falloffEnd: 45, minFalloff: 0.55,
      price: 1000, ammoCost: 500, speedMul: 1.05, color: 0x2b3a2e, accent: 0xe0c341,
      sound: { pitch: 1.7, body: 0.45, len: 0.08 }
    },
    shotgun: {
      name: 'RT-8 ROMPEPUERTAS', short: 'Escopeta', desc: '8 perdigones. Devastadora de cerca, inútil de lejos.',
      damage: 26, rpm: 95, auto: false, pellets: 8, mag: 8, reserveMax: 64,
      reload: 2.0, spread: 0.085, adsSpread: 0.06, moveSpread: 0.02, recoil: 0.07,
      range: 30, falloffStart: 5, falloffEnd: 18, minFalloff: 0.15,
      price: 1500, ammoCost: 750, speedMul: 0.97, color: 0x4a2e1e, accent: 0xb5651d,
      sound: { pitch: 0.7, body: 1.0, len: 0.3 }
    },
    rifle: {
      name: 'CENTINELA AR-4', short: 'Rifle', desc: 'Rifle automático preciso y versátil.',
      damage: 42, rpm: 680, auto: true, pellets: 1, mag: 36, reserveMax: 252,
      reload: 1.8, spread: 0.016, adsSpread: 0.003, moveSpread: 0.025, recoil: 0.015,
      range: 90, falloffStart: 35, falloffEnd: 80, minFalloff: 0.7,
      price: 1750, ammoCost: 875, speedMul: 1.0, color: 0x22272e, accent: 0x5fb3d9,
      sound: { pitch: 1.1, body: 0.75, len: 0.13 }
    },
    lmg: {
      name: 'MARTILLO M-75', short: 'Ametralladora pesada', desc: 'Potencia brutal, cargador enorme y recarga muy lenta.',
      damage: 72, rpm: 620, auto: true, pellets: 1, mag: 100, reserveMax: 300,
      reload: 3.6, spread: 0.03, adsSpread: 0.01, moveSpread: 0.03, recoil: 0.02,
      range: 100, falloffStart: 40, falloffEnd: 90, minFalloff: 0.75,
      price: 3500, ammoCost: 1750, speedMul: 0.88, color: 0x2f2f2f, accent: 0xd94a2b,
      sound: { pitch: 0.85, body: 1.0, len: 0.16 }
    }
  },

  // Niveles de la FORJA OMEGA (máquina de mejora). Multiplicadores sobre el arma base.
  upgrades: [
    null,
    { cost: 1500, tag: 'MK-I',   damage: 1.6, mag: 1.25, reserve: 1.2, spread: 0.9,  recoil: 0.9,  rpm: 1.0,  reload: 0.95, glow: 0x3fd0ff },
    { cost: 3000, tag: 'MK-II',  damage: 2.4, mag: 1.5,  reserve: 1.4, spread: 0.75, recoil: 0.75, rpm: 1.05, reload: 0.9,  glow: 0x9b5bff },
    { cost: 5000, tag: 'MK-III', damage: 3.6, mag: 1.75, reserve: 1.6, spread: 0.6,  recoil: 0.6,  rpm: 1.12, reload: 0.85, glow: 0xff3df0 }
  ],
  upgradeDuration: 2.2,

  /* ---------------------- VENTAJAS ---------------------- */
  maxPerks: 3,
  perks: {
    resist: { name: 'RESISTENCIA',   cost: 2500, icon: '✚', color: '#e5484d', desc: 'Salud máxima 100 → 175.' },
    hands:  { name: 'MANOS RÁPIDAS', cost: 2000, icon: '⟳', color: '#3fb950', desc: 'Recarga un 45% más rápido.' },
    step:   { name: 'PASO LIGERO',   cost: 2000, icon: '»', color: '#58a6ff', desc: '+20% velocidad y más aguante al correr.' },
    steady: { name: 'PULSO FIRME',   cost: 1500, icon: '◎', color: '#d29922', desc: '-45% retroceso y dispersión.' }
  },

  health: { cost: 500, heal: 0.6, cooldown: 20, usesPerRound: 2, name: 'BOTIQUÍN DE CAMPO' },

  /* ---------------------- ZOMBIS ------------------------ */
  zombies: {
    walker: { name: 'Errante', hp: 110, speed: 2.7, speedPerRound: 0.1, speedMax: 4.3, damage: 20, range: 1.55, windup: 0.7, cooldown: 1.1, radius: 0.42, scale: 1.0, points: 1 },
    runner: { name: 'Corredor', hp: 70, speed: 5.2, speedPerRound: 0.07, speedMax: 6.6, damage: 14, range: 1.45, windup: 0.45, cooldown: 0.8, radius: 0.36, scale: 0.92, points: 1 },
    brute:  { name: 'Pesado', hp: 520, speed: 2.1, speedPerRound: 0.05, speedMax: 3.0, damage: 38, range: 1.9, windup: 0.95, cooldown: 1.6, radius: 0.65, scale: 1.35, points: 2 },
    boss:   { name: 'EL COLOSO', hp: 5200, speed: 2.5, speedPerRound: 0.03, speedMax: 3.2, damage: 35, range: 2.4, windup: 0.8, cooldown: 1.4, radius: 1.0, scale: 2.1, points: 10 }
  },

  waves: {
    maxAlive: 28,
    breakTime: 6,          // descanso entre rondas (segundos)
    firstDelay: 2,
    specialEvery: 5,       // ronda especial cada 5 rondas
    spawnInterval: 1.3,    // segundos entre apariciones (baja con las rondas)
    spawnIntervalMin: 0.28
  }
};

// Fórmulas de dificultad (separadas para poder ajustarlas sin tocar la lógica)
/* ------------------ POTENCIADORES (caen al eliminar zombis) ------------------ */
DZ.CONFIG.powerups = {
  dropChance: 0.04, maxPerRound: 4, life: 25, pickRadius: 1.5,
  types: {
    ammo:   { name: 'MUNICIÓN MÁXIMA', glyph: 'M',  color: '#7dff6a', dur: 0,  desc: 'Recarga todas tus armas' },
    insta:  { name: 'BALA LETAL',      glyph: '☠', color: '#ff4a3a', dur: 20, desc: 'Cualquier impacto elimina' },
    double: { name: 'PUNTOS ×2',       glyph: '×2', color: '#ffcf4a', dur: 20, desc: 'Puntos dobles' },
    nuke:   { name: 'DETONACIÓN',      glyph: '✹', color: '#ff9a2a', dur: 0,  desc: 'Elimina a todos los zombis' },
    frenzy: { name: 'FRENESÍ',         glyph: '⚡', color: '#3fd0ff', dur: 15, desc: 'Disparo rápido sin recargar' }
  }
};

DZ.DIFF = {
  count(r) { return Math.floor(8 + 3 * r + 0.13 * r * r); },
  hpMul(r) { return r <= 10 ? 1 + 0.11 * (r - 1) : (1 + 0.11 * 9) * Math.pow(1.09, r - 10); },
  runnerChance(r) { return r < 2 ? 0 : Math.min(0.38, 0.07 * (r - 1)); },
  bruteChance(r) { return r < 4 ? 0 : Math.min(0.16, 0.035 * (r - 3)); },
  spawnInterval(r) { const c = DZ.CONFIG.waves; return Math.max(c.spawnIntervalMin, c.spawnInterval - 0.1 * (r - 1)); },
  maxAlive(r) { return Math.min(DZ.CONFIG.waves.maxAlive, 8 + r * 2); },
  // Tipo de ronda especial
  special(r) {
    const e = DZ.CONFIG.waves.specialEvery;
    if (r % e !== 0) return null;
    return (r / e) % 2 === 1 ? 'runners' : 'boss';
  }
};
