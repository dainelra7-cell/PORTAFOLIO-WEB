/* =========================================================
   map.js — escenario por cuadrícula, colisiones, zonas,
   puertas, navegación (campo de flujo) y estaciones.
   ========================================================= */
(function () {
  const C = DZ.CONFIG;
  const T = C.TILE;

  // Leyenda:  # muro | . suelo | S aparición | 1-5 puertas | T mesa | o columna
  //           c cajas | h estanterías | R núcleo del reactor
  const LAYOUT = [
    '################################',
    '#S.............#S......#......S#',
    '#..............#.......#.......#',
    '#..............#.hh.hh.#.......#',
    '#...TTT...TTT..#.......4.......#',
    '#...TTT...TTT..#.......4..RRR..#',
    '#..............3.......#..RRR..#',
    '#..............3.......#..RRR..#',
    '#..............#.hh.hh.#.......#',
    '#....o......o..#.......#.......#',
    '#..............#.......#.......#',
    '#...TTT...TTT..#.hh.hh.#.......#',
    '#..............#.......#.......#',
    '#S.............#......S#S......#',
    '######22########################',
    '#S.............#..............S#',
    '#..............#...............#',
    '#..cc......cc..#...cc.....cc...#',
    '#..............#...cc.....cc...#',
    '#..............1...............#',
    '#..............1...............#',
    '#....o....o....#......ccc......#',
    '#..............#...............#',
    '#..cc......cc..#...cc.....cc...#',
    '#S............S#S.............S#',
    '################################'
  ];
  // Corrige la fila 14 para incluir la puerta 5 hacia el reactor (columnas 27-28)
  LAYOUT[14] = LAYOUT[14].substring(0, 27) + '55' + LAYOUT[14].substring(29);

  const W = LAYOUT[0].length, H = LAYOUT.length;

  // Alturas de obstáculos (para balas y visual)
  const HEIGHTS = { '#': C.WALL_H, 'o': C.WALL_H, 'T': 0.95, 'c': 1.5, 'h': 2.4, 'R': C.WALL_H, 'X': 1.9 };

  const ZONES = {
    A: { name: 'PATIO DE CUARENTENA', seed: [7, 19], indoor: false, floor: 'asphalt' },
    B: { name: 'LABORATORIO 3', seed: [7, 7], indoor: true, floor: 'tiles' },
    C: { name: 'MUELLE DE CARGA', seed: [22, 19], indoor: false, floor: 'concrete' },
    D: { name: 'ARMERÍA', seed: [19, 6], indoor: true, floor: 'metal' },
    E: { name: 'SALA DEL REACTOR', seed: [27, 10], indoor: true, floor: 'reactor' }
  };

  // Estaciones de compra (casilla + tipo)
  const STATIONS = [
    { type: 'ammo', tx: 1, tz: 19 },
    { type: 'weapon', weapon: 'smg', tx: 14, tz: 16 },
    { type: 'perk', perk: 'resist', tx: 1, tz: 22 },
    { type: 'weapon', weapon: 'shotgun', tx: 30, tz: 19 },
    { type: 'perk', perk: 'step', tx: 30, tz: 22 },
    { type: 'weapon', weapon: 'rifle', tx: 1, tz: 7 },
    { type: 'perk', perk: 'hands', tx: 14, tz: 2 },
    { type: 'health', tx: 1, tz: 11 },
    { type: 'weapon', weapon: 'lmg', tx: 22, tz: 10 },
    { type: 'ammo', tx: 16, tz: 12 },
    { type: 'perk', perk: 'steady', tx: 22, tz: 7 },
    { type: 'power', tx: 24, tz: 2 },
    { type: 'forge', tx: 30, tz: 6 }
  ];

  const M = DZ.map = {
    W, H, grid: [], zoneOf: [], doors: {}, stations: [], spawns: [], lights: [],
    zones: ZONES, activeZones: new Set(['A']), flow: null, flowFrom: -1,
    group: null, animated: []
  };

  /* ------------------ texturas procedurales ------------------ */
  function canvasTex(size, draw, repeat) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const g = cv.getContext('2d'); draw(g, size);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  function noise(g, s, base, amt, n) {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < n; i++) {
      const v = Math.random();
      g.fillStyle = v > 0.5 ? `rgba(255,255,255,${amt * Math.random()})` : `rgba(0,0,0,${amt * 1.6 * Math.random()})`;
      const r = 1 + Math.random() * 3; g.fillRect(Math.random() * s, Math.random() * s, r, r);
    }
  }
  const TEX = {};
  function buildTextures() {
    TEX.wall = canvasTex(256, (g, s) => {
      noise(g, s, '#4a4d52', 0.12, 2500);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3;
      for (let y = 0; y <= s; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); }
      for (let y = 0; y < s; y += 64) for (let x = (y / 64) % 2 ? 0 : 64; x < s; x += 128) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke(); }
      // manchas de humedad
      for (let i = 0; i < 6; i++) { const gr = g.createRadialGradient(Math.random() * s, s, 0, Math.random() * s, s, 90); gr.addColorStop(0, 'rgba(20,30,20,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
      // franja de peligro inferior
      for (let x = -20; x < s; x += 28) { g.fillStyle = '#c9a227'; g.beginPath(); g.moveTo(x, s - 18); g.lineTo(x + 14, s - 18); g.lineTo(x + 4, s); g.lineTo(x - 10, s); g.fill(); }
      g.fillStyle = 'rgba(10,10,10,0.9)'; g.fillRect(0, s - 22, s, 4);
    }, [1, 1]);
    TEX.asphalt = canvasTex(256, (g, s) => { noise(g, s, '#2c2d2f', 0.18, 6000); g.strokeStyle = 'rgba(210,180,40,0.5)'; g.lineWidth = 6; g.setLineDash([30, 22]); g.beginPath(); g.moveTo(0, s / 2); g.lineTo(s, s / 2); g.stroke(); }, [7, 5]);
    TEX.concrete = canvasTex(256, (g, s) => { noise(g, s, '#3d3b37', 0.16, 5000); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2; g.strokeRect(0, 0, s, s); }, [7, 5]);
    TEX.tiles = canvasTex(256, (g, s) => { noise(g, s, '#8b9297', 0.1, 1500); g.strokeStyle = 'rgba(30,35,40,0.6)'; g.lineWidth = 3; for (let i = 0; i <= s; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); } }, [7, 6]);
    TEX.metal = canvasTex(256, (g, s) => { noise(g, s, '#3a3f45', 0.12, 2000); g.fillStyle = 'rgba(255,255,255,0.08)'; for (let y = 8; y < s; y += 32) for (let x = 8; x < s; x += 32) { g.fillRect(x, y, 14, 4); g.fillRect(x + 16, y + 16, 4, 14); } }, [4, 7]);
    TEX.reactor = canvasTex(256, (g, s) => { noise(g, s, '#23262b', 0.12, 2000); g.strokeStyle = 'rgba(80,255,170,0.25)'; g.lineWidth = 2; for (let i = 0; i <= s; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); } }, [4, 7]);
    TEX.crate = canvasTex(128, (g, s) => { noise(g, s, '#5a4a2c', 0.15, 900); g.strokeStyle = '#2d2314'; g.lineWidth = 8; g.strokeRect(4, 4, s - 8, s - 8); g.beginPath(); g.moveTo(4, 4); g.lineTo(s - 4, s - 4); g.stroke(); }, [1, 1]);
    TEX.door = canvasTex(256, (g, s) => {
      noise(g, s, '#5b2020', 0.15, 1500);
      for (let x = -40; x < s + 40; x += 48) { g.fillStyle = '#d7b021'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 24, 0); g.lineTo(x - 40, s); g.lineTo(x - 64, s); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, s * 0.38, s, s * 0.24);
      g.fillStyle = '#ffdfa0'; g.font = 'bold 34px monospace'; g.textAlign = 'center'; g.fillText('ACCESO', s / 2, s * 0.5 + 4); g.font = 'bold 18px monospace'; g.fillText('RESTRINGIDO', s / 2, s * 0.58);
    }, [1, 1]);
  }

  /* ------------------------ utilidades ------------------------ */
  M.idx = (tx, tz) => tz * W + tx;
  M.tileOf = (x) => Math.floor(x / T);
  M.center = (t) => t * T + T / 2;
  M.inBounds = (tx, tz) => tx >= 0 && tz >= 0 && tx < W && tz < H;
  M.cell = (tx, tz) => M.inBounds(tx, tz) ? M.grid[M.idx(tx, tz)] : '#';
  M.isSolid = (tx, tz) => {
    const c = M.cell(tx, tz);
    if (c === '.' || c === 'S' || c === 'P') return false;
    if (c >= '1' && c <= '9') return !M.doors[c].open;
    return true;
  };
  M.solidHeight = (tx, tz) => {
    const c = M.cell(tx, tz);
    if (c >= '1' && c <= '9') return M.doors[c].open ? 0 : C.WALL_H;
    if (!M.isSolid(tx, tz)) return 0;
    return HEIGHTS[c] !== undefined ? HEIGHTS[c] : C.WALL_H;
  };
  M.zoneAt = (x, z) => { const tx = M.tileOf(x), tz = M.tileOf(z); return M.inBounds(tx, tz) ? M.zoneOf[M.idx(tx, tz)] : null; };

  // Colisión círculo-casillas (resuelve por ejes). Devuelve posición corregida.
  M.collideCircle = function (pos, r) {
    const minTx = M.tileOf(pos.x - r) , maxTx = M.tileOf(pos.x + r);
    const minTz = M.tileOf(pos.z - r), maxTz = M.tileOf(pos.z + r);
    for (let tz = minTz; tz <= maxTz; tz++) for (let tx = minTx; tx <= maxTx; tx++) {
      if (!M.isSolid(tx, tz)) continue;
      const x0 = tx * T, x1 = x0 + T, z0 = tz * T, z1 = z0 + T;
      const cx = Math.max(x0, Math.min(pos.x, x1)), cz = Math.max(z0, Math.min(pos.z, z1));
      let dx = pos.x - cx, dz = pos.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2), push = r - d; pos.x += dx / d * push; pos.z += dz / d * push; }
        else { // centro dentro de la casilla: sacarlo por el lado más cercano
          const l = pos.x - x0, rr = x1 - pos.x, u = pos.z - z0, dd = z1 - pos.z; const m = Math.min(l, rr, u, dd);
          if (m === l) pos.x = x0 - r; else if (m === rr) pos.x = x1 + r; else if (m === u) pos.z = z0 - r; else pos.z = z1 + r;
        }
      }
    }
    return pos;
  };

  // Distancia a la pared para un rayo (marcha por pasos con altura)
  M.rayWall = function (o, d, maxDist) {
    const step = 0.08; let t = 0;
    while (t < maxDist) {
      t += step;
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (y <= 0) return { dist: t, point: new THREE.Vector3(x, 0, z), floor: true };
      if (y >= C.WALL_H) return { dist: t, point: new THREE.Vector3(x, y, z), ceil: true };
      const h = M.solidHeight(M.tileOf(x), M.tileOf(z));
      if (h > 0 && y < h) return { dist: t, point: new THREE.Vector3(x, y, z) };
    }
    return { dist: maxDist, point: null };
  };

  // Línea de visión en el plano (para la IA)
  M.clearLine = function (ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz); const n = Math.ceil(len / 0.4);
    for (let i = 1; i < n; i++) { const t = i / n; if (M.isSolid(M.tileOf(ax + dx * t), M.tileOf(az + dz * t))) return false; }
    return true;
  };

  /* -------------- campo de flujo (BFS desde el jugador) -------------- */
  M.dist = new Int32Array(W * H);
  M.computeFlow = function (px, pz, force) {
    const tx = M.tileOf(px), tz = M.tileOf(pz); const start = M.idx(tx, tz);
    if (!force && start === M.flowFrom) return;
    M.flowFrom = start;
    const dist = M.dist; dist.fill(-1);
    const q = new Int32Array(W * H); let h = 0, t = 0;
    if (M.isSolid(tx, tz)) return;
    dist[start] = 0; q[t++] = start;
    while (h < t) {
      const i = q[h++]; const x = i % W, z = (i / W) | 0; const d = dist[i] + 1;
      for (let k = 0; k < 4; k++) {
        const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), nz = z + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (!M.inBounds(nx, nz)) continue; const ni = M.idx(nx, nz);
        if (dist[ni] !== -1 || M.isSolid(nx, nz)) continue;
        dist[ni] = d; q[t++] = ni;
      }
    }
  };
  // Siguiente punto de ruta para un agente en (x,z): elige el vecino (8 dir, sin cortar esquinas) con menor distancia
  M.nextWaypoint = function (x, z) {
    const tx = M.tileOf(x), tz = M.tileOf(z); const here = M.dist[M.idx(tx, tz)];
    let best = null, bd = here < 0 ? 1e9 : here;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const nx = tx + dx, nz = tz + dz;
      if (!M.inBounds(nx, nz) || M.isSolid(nx, nz)) continue;
      if (dx && dz && (M.isSolid(tx + dx, tz) || M.isSolid(tx, tz + dz))) continue;
      const d = M.dist[M.idx(nx, nz)]; if (d < 0) continue;
      const score = d + (dx && dz ? 0.4 : 0);
      if (score < bd) { bd = score; best = [nx, nz]; }
    }
    return best ? { x: M.center(best[0]), z: M.center(best[1]) } : null;
  };

  /* ------------------------ construcción ------------------------ */
  M.build = function (scene) {
    buildTextures();
    M.grid = []; for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) M.grid.push(LAYOUT[z][x]);

    // puertas
    for (let i = 0; i < M.grid.length; i++) {
      const c = M.grid[i];
      if (c >= '1' && c <= '9') { if (!M.doors[c]) M.doors[c] = { id: c, tiles: [], open: false, cost: C.doors[c].cost, name: C.doors[c].name, zones: [] }; M.doors[c].tiles.push(i); }
    }
    // zonas por relleno (las puertas cuentan como muro)
    M.zoneOf = new Array(W * H).fill(null);
    for (const k in ZONES) {
      const [sx, sz] = ZONES[k].seed; const st = [[sx, sz]];
      while (st.length) {
        const [x, z] = st.pop(); if (!M.inBounds(x, z)) continue; const i = M.idx(x, z);
        const c = M.grid[i];
        if (M.zoneOf[i] || c === '#' || (c >= '1' && c <= '9')) continue;
        M.zoneOf[i] = k;
        st.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
      }
    }
    // zonas que conecta cada puerta
    for (const id in M.doors) {
      const d = M.doors[id]; const zs = new Set();
      d.tiles.forEach(i => { const x = i % W, z = (i / W) | 0;[[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const zz = M.zoneOf[M.idx(x + a, z + b)]; if (zz && M.grid[M.idx(x + a, z + b)] !== '#') zs.add(zz); }); });
      d.zones = [...zs];
      let cx = 0, cz = 0; d.tiles.forEach(i => { cx += M.center(i % W); cz += M.center((i / W) | 0); }); d.x = cx / d.tiles.length; d.z = cz / d.tiles.length;
    }
    // puntos de aparición
    M.spawns = [];
    for (let i = 0; i < M.grid.length; i++) if (M.grid[i] === 'S') M.spawns.push({ x: M.center(i % W), z: M.center((i / W) | 0), zone: M.zoneOf[i] });

    const g = M.group = new THREE.Group(); scene.add(g);

    // ---- suelos y techos por zona (rectángulos de la zona)
    const floorMats = {};
    for (const k in ZONES) {
      let minX = 99, maxX = -1, minZ = 99, maxZ = -1;
      for (let i = 0; i < M.grid.length; i++) if (M.zoneOf[i] === k) { const x = i % W, z = (i / W) | 0; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
      ZONES[k].rect = { minX, maxX, minZ, maxZ };
      const w = (maxX - minX + 1) * T, d = (maxZ - minZ + 1) * T;
      const tex = TEX[ZONES[k].floor].clone(); tex.needsUpdate = true; tex.repeat.set(w / 4, d / 4);
      const mat = floorMats[k] = new THREE.MeshLambertMaterial({ map: tex });
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); fl.rotation.x = -Math.PI / 2;
      fl.position.set(minX * T + w / 2, 0, minZ * T + d / 2); g.add(fl);
      if (ZONES[k].indoor) {
        const ce = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color: 0x15171a })); ce.rotation.x = Math.PI / 2; ce.position.set(fl.position.x, C.WALL_H, fl.position.z); g.add(ce);
        // tubos del techo
        for (let z = minZ * T + 3; z < (maxZ + 1) * T; z += 6) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, w, 6), new THREE.MeshLambertMaterial({ color: 0x3b4148 })); p.rotation.z = Math.PI / 2; p.position.set(fl.position.x, C.WALL_H - 0.3, z); g.add(p); }
      }
    }
    // suelo de puertas
    for (const id in M.doors) M.doors[id].tiles.forEach(i => { const f = new THREE.Mesh(new THREE.PlaneGeometry(T, T), new THREE.MeshLambertMaterial({ color: 0x222222 })); f.rotation.x = -Math.PI / 2; f.position.set(M.center(i % W), 0.005, M.center((i / W) | 0)); g.add(f); });

    // ---- muros (instanciados) y obstáculos
    const wallGeo = new THREE.BoxGeometry(T, C.WALL_H, T);
    const wallMat = new THREE.MeshLambertMaterial({ map: TEX.wall });
    const wallIdx = []; const pillars = [], tables = [], crates = [], shelves = [];
    for (let i = 0; i < M.grid.length; i++) {
      const c = M.grid[i], x = i % W, z = (i / W) | 0;
      if (c === '#') {
        // sólo muros con algún vecino transitable (los demás no se ven)
        let vis = false;[[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const n = M.cell(x + a, z + b); if (n !== '#') vis = true; });
        if (vis) wallIdx.push(i);
      } else if (c === 'o') pillars.push(i); else if (c === 'T') tables.push(i); else if (c === 'c') crates.push(i); else if (c === 'h') shelves.push(i);
    }
    const walls = new THREE.InstancedMesh(wallGeo, wallMat, wallIdx.length);
    const m4 = new THREE.Matrix4();
    wallIdx.forEach((i, n) => { m4.makeTranslation(M.center(i % W), C.WALL_H / 2, M.center((i / W) | 0)); walls.setMatrixAt(n, m4); });
    g.add(walls);
    const place = (list, geo, mat, y, jitter) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((i, n) => { const r = jitter ? (Math.random() - 0.5) * 0.4 : 0; m4.makeRotationY(r); m4.setPosition(M.center(i % W), y, M.center((i / W) | 0)); im.setMatrixAt(n, m4); }); g.add(im); };
    place(pillars, new THREE.BoxGeometry(1.3, C.WALL_H, 1.3), new THREE.MeshLambertMaterial({ map: TEX.wall, color: 0xaaaaaa }), C.WALL_H / 2);
    place(tables, new THREE.BoxGeometry(T, 0.95, T * 0.9), new THREE.MeshLambertMaterial({ color: 0xb8c0c4 }), 0.475);
    place(crates, new THREE.BoxGeometry(T * 0.95, 1.5, T * 0.95), new THREE.MeshLambertMaterial({ map: TEX.crate }), 0.75, true);
    place(shelves, new THREE.BoxGeometry(T, 2.4, T * 0.8), new THREE.MeshLambertMaterial({ color: 0x3d4a3a }), 1.2);
    // material de mesa: equipos de laboratorio encima (pequeños volúmenes)
    tables.forEach((i, n) => { if (n % 2) return; const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.5), new THREE.MeshLambertMaterial({ color: 0x2b3238, emissive: 0x0a3020 })); b.position.set(M.center(i % W), 1.15, M.center((i / W) | 0)); g.add(b); });
    // munición decorativa en estanterías
    shelves.forEach((i, n) => { for (let k = 0; k < 2; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), new THREE.MeshLambertMaterial({ color: 0x4f5a2e })); b.position.set(M.center(i % W) + (k - 0.5) * 0.8, 0.8 + k * 0.8, M.center((i / W) | 0)); g.add(b); } });

    // ---- núcleo del reactor
    let rx = 0, rz = 0, rn = 0; for (let i = 0; i < M.grid.length; i++) if (M.grid[i] === 'R') { rx += M.center(i % W); rz += M.center((i / W) | 0); rn++; }
    if (rn) {
      rx /= rn; rz /= rn;
      const core = new THREE.Group(); core.position.set(rx, 0, rz); g.add(core);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.0, 0.8, 16), new THREE.MeshLambertMaterial({ color: 0x30353b })); base.position.y = 0.4; core.add(base);
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3.0, 16, 1, true), new THREE.MeshLambertMaterial({ color: 0x40ffb0, emissive: 0x0d5a3a, transparent: true, opacity: 0.55, side: THREE.DoubleSide })); glass.position.y = 2.3; core.add(glass);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.2, 10), new THREE.MeshBasicMaterial({ color: 0x7dffcf })); rod.position.y = 2.3; core.add(rod);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.2, 0.4), new THREE.MeshLambertMaterial({ color: 0x23272c })); p.position.set(Math.cos(a) * 2.4, 2.1, Math.sin(a) * 2.4); core.add(p); }
      M.reactor = { group: core, rod, glass };
      M.animated.push(dt => { rod.rotation.y += dt; glass.material.emissiveIntensity = 0.7 + Math.sin(performance.now() * 0.003) * 0.3; });
      M.addLight(0x40ffb0, rx, 3, rz, 18, 16);
    }

    // ---- puertas (paneles con precio)
    for (const id in M.doors) {
      const d = M.doors[id];
      const xs = d.tiles.map(i => i % W), zs = d.tiles.map(i => (i / W) | 0);
      const horiz = new Set(zs).size === 1; // puerta en una fila → panel a lo largo de X
      const len = d.tiles.length * T;
      const geo = horiz ? new THREE.BoxGeometry(len, C.WALL_H, 0.35) : new THREE.BoxGeometry(0.35, C.WALL_H, len);
      const tex = TEX.door.clone(); tex.needsUpdate = true; tex.repeat.set(1, 1);
      const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, emissive: 0x220000 }));
      mesh.position.set(d.x, C.WALL_H / 2, d.z); g.add(mesh); d.mesh = mesh; d.anim = 0;
      // marco
      const frameMat = new THREE.MeshLambertMaterial({ color: 0x1b1d20 });
      const f1 = new THREE.Mesh(horiz ? new THREE.BoxGeometry(len + 0.3, 0.3, 0.6) : new THREE.BoxGeometry(0.6, 0.3, len + 0.3), frameMat); f1.position.set(d.x, C.WALL_H - 0.15, d.z); g.add(f1);
      // luz de aviso
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
      lamp.position.set(d.x, C.WALL_H - 0.45, d.z); g.add(lamp); d.lamp = lamp;
    }

    // ---- estaciones
    STATIONS.forEach(s => M.addStation(g, s));

    // ---- iluminación de emergencia por zona
    M.addLight(0xff4a2a, M.center(7), 3.6, M.center(19), 14, 18, true);
    M.addLight(0xffa860, M.center(7), 3.6, M.center(5), 12, 18, true);
    M.addLight(0xff4a2a, M.center(23), 3.6, M.center(20), 14, 20, true);
    M.addLight(0xffc070, M.center(19), 3.6, M.center(7), 12, 16, true);
    // farolas exteriores
    [[3, 16], [12, 23], [18, 16], [29, 23]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4, 6), new THREE.MeshLambertMaterial({ color: 0x222222 })); p.position.set(M.center(x), 2, M.center(z)); g.add(p); const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.3), new THREE.MeshBasicMaterial({ color: 0xffe2a0 })); b.position.set(M.center(x), 4, M.center(z)); g.add(b); });

    M.computeFlow(M.center(7), M.center(19), true);
  };

  M.addLight = function (color, x, y, z, intensity, distance, flicker) {
    const l = new THREE.PointLight(color, intensity, distance, 1.4); l.position.set(x, y, z); M.group.add(l);
    const rec = { light: l, base: intensity, flicker: !!flicker, phase: Math.random() * 10 };
    M.lights.push(rec); return l;
  };

  /* ----------------------- estaciones ----------------------- */
  function label(text, sub, color) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const g = cv.getContext('2d');
    g.fillStyle = 'rgba(8,10,12,0.85)'; g.fillRect(0, 0, 256, 96); g.strokeStyle = color; g.lineWidth = 4; g.strokeRect(2, 2, 252, 92);
    g.fillStyle = color; g.font = 'bold 26px monospace'; g.textAlign = 'center'; g.fillText(text, 128, 40);
    g.fillStyle = '#ddd'; g.font = '20px monospace'; g.fillText(sub, 128, 74);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  M.addStation = function (g, s) {
    const i = M.idx(s.tx, s.tz); M.grid[i] = 'X';
    const x = M.center(s.tx), z = M.center(s.tz);
    // orientar hacia el lado abierto
    let face = 0; const dirs = [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]];
    let found = false;
    for (const [a, b, r] of dirs) { if (M.cell(s.tx - a, s.tz - b) === '#') { face = r; found = true; break; } } // de espaldas al muro
    if (!found) for (const [a, b, r] of dirs) { const c = M.cell(s.tx + a, s.tz + b); if (c === '.' || c === 'S') { face = r; break; } }
    const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = face; g.add(grp);
    const st = Object.assign({}, s, { x, z, group: grp, zone: M.zoneOf[i] || null });
    // zona: la de la casilla vecina transitable
    for (const [a, b] of dirs) { const zz = M.zoneOf[M.idx(s.tx + a, s.tz + b)]; if (zz) { st.zone = zz; break; } }
    let color = '#ffffff', title = '', sub = '';
    const dark = new THREE.MeshLambertMaterial({ color: 0x1d2024 });
    if (s.type === 'weapon') {
      const w = C.weapons[s.weapon]; color = '#ffcf4a'; title = w.short.toUpperCase(); sub = w.price + ' pts';
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 0.25), dark); board.position.set(0, 1.5, -0.5); grp.add(board);
      const chalk = DZ.buildWeaponModel(s.weapon, 0, true); chalk.scale.setScalar(1.6); chalk.rotation.y = Math.PI / 2; chalk.position.set(0, 1.55, -0.3); grp.add(chalk);
      st.light = glow(grp, 0xffcf4a, 1.55);
    } else if (s.type === 'ammo') {
      color = '#9fe06b'; title = 'MUNICIÓN'; sub = 'arma actual';
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.9), new THREE.MeshLambertMaterial({ color: 0x3f4d22 })); box.position.set(0, 0.45, -0.2); grp.add(box);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.12, 0.95), new THREE.MeshLambertMaterial({ color: 0x9fe06b, emissive: 0x1e3a08 })); lid.position.set(0, 0.95, -0.2); grp.add(lid);
      st.light = glow(grp, 0x9fe06b, 1.0);
    } else if (s.type === 'perk') {
      const p = C.perks[s.perk]; color = p.color; title = p.name; sub = p.cost + ' pts';
      const col = new THREE.Color(p.color);
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.9), new THREE.MeshLambertMaterial({ color: col.clone().multiplyScalar(0.45) })); body.position.set(0, 1.1, -0.3); grp.add(body);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), new THREE.MeshBasicMaterial({ color: col })); panel.position.set(0, 1.35, 0.16); grp.add(panel);
      const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: iconTex(p.icon), transparent: true })); icon.position.set(0, 1.35, 0.17); grp.add(icon);
      st.light = glow(grp, col.getHex(), 1.4);
    } else if (s.type === 'health') {
      const hc = C.health; color = '#ff6b6b'; title = 'BOTIQUÍN'; sub = hc.cost + ' pts';
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.6, 0.6), new THREE.MeshLambertMaterial({ color: 0xdedede })); cab.position.set(0, 1.4, -0.5); grp.add(cab);
      const cr1 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.2), new THREE.MeshBasicMaterial({ color: 0xe5484d })); cr1.position.set(0, 1.4, -0.19); grp.add(cr1);
      const cr2 = cr1.clone(); cr2.rotation.z = Math.PI / 2; cr2.position.z = -0.189; grp.add(cr2);
    } else if (s.type === 'power') {
      color = '#4dffa0'; title = 'ENERGÍA'; sub = 'interruptor';
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 0.4), new THREE.MeshLambertMaterial({ color: 0x4a4f55 })); box.position.set(0, 1.4, -0.6); grp.add(box);
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), new THREE.MeshLambertMaterial({ color: 0xd94a2b })); lever.position.set(0, 1.4, -0.3); lever.rotation.x = 0.7; grp.add(lever); st.lever = lever;
    } else if (s.type === 'forge') {
      color = '#c86bff'; title = 'FORJA OMEGA'; sub = 'mejora de armas';
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 1.5), new THREE.MeshLambertMaterial({ color: 0x2a2140 })); base.position.set(0, 0.3, -0.1); grp.add(base);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.8, 0.5), new THREE.MeshLambertMaterial({ color: 0x241b36 })); back.position.set(0, 1.4, -0.6); grp.add(back);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.08, 8, 24), new THREE.MeshBasicMaterial({ color: 0x6a4a90 })); ring.position.set(0, 1.45, -0.15); grp.add(ring);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), new THREE.MeshBasicMaterial({ color: 0x3a2a55 })); core.position.set(0, 1.45, -0.2); grp.add(core);
      const pistons = []; for (let k = -1; k <= 1; k += 2) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 8), new THREE.MeshLambertMaterial({ color: 0x8a7aa8 })); p.position.set(k * 0.85, 1.7, -0.1); grp.add(p); pistons.push(p); }
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.25, 1.6), new THREE.MeshLambertMaterial({ color: 0x1a1428 })); top.position.set(0, 2.9, -0.1); grp.add(top);
      st.ring = ring; st.core = core; st.pistons = pistons;
      st.light = glow(grp, 0xc86bff, 1.45, 0.6);
      st.slot = new THREE.Group(); st.slot.position.set(0, 1.45, 0.25); grp.add(st.slot);
    }
    // cartel
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: label(title, sub, color), transparent: true }));
    sign.position.set(0, s.type === 'forge' ? 3.4 : (s.type === 'ammo' ? 1.8 : 2.75), s.type === 'forge' ? 0 : -0.25); grp.add(sign); st.sign = sign;
    M.stations.push(st);
  };
  // Halo luminoso barato (sustituye a luces puntuales para rendimiento en móvil)
  let glowTex = null;
  function glow(grp, color, y, intensity) {
    if (!glowTex) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(cv); }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
    sp.scale.setScalar(3.2); sp.position.set(0, y, 0.6); grp.add(sp);
    const obj = { _i: intensity === undefined ? 4 : intensity, sprite: sp };
    Object.defineProperty(obj, 'intensity', { get() { return this._i; }, set(v) { this._i = v; sp.material.opacity = Math.min(1, 0.12 + v / 12); sp.scale.setScalar(2.6 + Math.min(4, v / 6)); } });
    obj.intensity = obj._i; return obj;
  }
  function iconTex(ch) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.font = 'bold 96px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 70);
    const t = new THREE.CanvasTexture(cv); return t;
  }

  /* --------------------- puertas y zonas --------------------- */
  M.openDoor = function (id) {
    const d = M.doors[id]; if (!d || d.open) return false;
    d.open = true; d.anim = 0.0001; d.lamp.material.color.setHex(0x30ff60);
    d.zones.forEach(z => M.activeZones.add(z));
    M.computeFlow(DZ.player.pos.x, DZ.player.pos.z, true);
    return true;
  };
  M.update = function (dt, t) {
    for (const id in M.doors) { const d = M.doors[id]; if (d.anim > 0 && d.anim < 1) { d.anim = Math.min(1, d.anim + dt * 1.3); d.mesh.position.y = C.WALL_H / 2 - d.anim * (C.WALL_H + 0.1); if (d.anim >= 1) d.mesh.visible = false; } }
    M.lights.forEach(r => { if (r.flicker) { const f = Math.sin(t * 2.2 + r.phase) * 0.25 + (Math.random() < 0.015 ? -0.5 : 0); r.light.intensity = r.base * (0.85 + f); } });
    M.animated.forEach(f => f(dt, t));
  };
  M.reset = function () {
    for (const id in M.doors) { const d = M.doors[id]; d.open = false; d.anim = 0; d.mesh.visible = true; d.mesh.position.y = C.WALL_H / 2; d.lamp.material.color.setHex(0xff3020); }
    M.activeZones = new Set(['A']);
    M.powered = false;
    M.stations.forEach(s => { if (s.lever) s.lever.rotation.x = 0.7; if (s.type === 'forge') { s.light.intensity = 0.6; s.ring.material.color.setHex(0x6a4a90); s.core.material.color.setHex(0x3a2a55); } });
  };
})();
