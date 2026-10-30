/* ==========================================================================
   PIXEL GOL — fútbol 2D estilo Atari 2600
   Canvas 2D + requestAnimationFrame, JavaScript moderno con clases:
   Sound · PixelFont · Records · Input · Joystick · Field · Ball · Player ·
   Goalkeeper · AIController · Game
   Funciona abriendo index.html con doble clic (sin servidor ni internet).
   ========================================================================== */
'use strict';

// Resolución interna "de consola": se dibuja en pequeño y se escala con píxeles nítidos
const W = 320, H = 200;

// Paleta reducida tipo Atari
const PAL = {
  bg: '#0b0b14', hud: '#141428',
  grass1: '#2e8b2e', grass2: '#349b34', line: '#e8f0e0',
  p1: '#f26a1b', p1dark: '#a83c08', p2: '#3d6cf0', p2dark: '#1c3aa0',
  gk1: '#f5d132', gk2: '#c84cff', skin: '#f0b080', shorts: '#202030',
  ball: '#ffffff', net: '#c8d0c0', text: '#f8f8f8', dim: '#8890b0', gold: '#ffd23f'
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const len = (x, y) => Math.hypot(x, y);

/* ---------------------------------------------------------------- SONIDO -- */
class Sound {
  constructor() { this.ctx = null; this.on = true; }
  unlock() {
    if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  beep(freq, dur = 0.06, type = 'square', vol = 0.06, slide = 0, delay = 0) {
    if (!this.on || this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  wall() { this.beep(220, 0.04); }
  kick() { this.beep(440, 0.05, 'square', 0.07); }
  post() { this.beep(880, 0.12, 'square', 0.06, -200); }
  save() { this.beep(330, 0.08, 'triangle', 0.09, 120); }
  whistle() { this.beep(1600, 0.25, 'square', 0.035); this.beep(1700, 0.2, 'square', 0.03, 0, 0.3); }
  goal() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.beep(f, 0.12, 'square', 0.06, 0, i * 0.11)); }
  win() { [392, 523, 659, 784, 1047].forEach((f, i) => this.beep(f, 0.18, 'square', 0.06, 0, i * 0.15)); }
}

/* ------------------------------------------------------ FUENTE DE PÍXELES -- */
// Cada carácter: 5 filas de 3 píxeles ("#" = encendido). Fiel al estilo de los 80.
class PixelFont {
  static G = {
    'A': ['###', '#.#', '###', '#.#', '#.#'], 'B': ['##.', '#.#', '##.', '#.#', '##.'], 'C': ['###', '#..', '#..', '#..', '###'],
    'D': ['##.', '#.#', '#.#', '#.#', '##.'], 'E': ['###', '#..', '##.', '#..', '###'], 'F': ['###', '#..', '##.', '#..', '#..'],
    'G': ['###', '#..', '#.#', '#.#', '###'], 'H': ['#.#', '#.#', '###', '#.#', '#.#'], 'I': ['###', '.#.', '.#.', '.#.', '###'],
    'J': ['..#', '..#', '..#', '#.#', '###'], 'K': ['#.#', '#.#', '##.', '#.#', '#.#'], 'L': ['#..', '#..', '#..', '#..', '###'],
    'M': ['#.#', '###', '###', '#.#', '#.#'], 'N': ['##.', '#.#', '#.#', '#.#', '#.#'], 'O': ['###', '#.#', '#.#', '#.#', '###'],
    'P': ['###', '#.#', '###', '#..', '#..'], 'Q': ['###', '#.#', '#.#', '###', '..#'], 'R': ['###', '#.#', '##.', '#.#', '#.#'],
    'S': ['###', '#..', '###', '..#', '###'], 'T': ['###', '.#.', '.#.', '.#.', '.#.'], 'U': ['#.#', '#.#', '#.#', '#.#', '###'],
    'V': ['#.#', '#.#', '#.#', '#.#', '.#.'], 'W': ['#.#', '#.#', '###', '###', '#.#'], 'X': ['#.#', '#.#', '.#.', '#.#', '#.#'],
    'Y': ['#.#', '#.#', '.#.', '.#.', '.#.'], 'Z': ['###', '..#', '.#.', '#..', '###'],
    '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'],
    '3': ['###', '..#', '.##', '..#', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'],
    '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
    '9': ['###', '#.#', '###', '..#', '###'], ' ': ['...', '...', '...', '...', '...'], ':': ['...', '.#.', '...', '.#.', '...'],
    '-': ['...', '...', '###', '...', '...'], '!': ['.#.', '.#.', '.#.', '...', '.#.'], '.': ['...', '...', '...', '...', '.#.'],
    '/': ['..#', '..#', '.#.', '#..', '#..'], '?': ['###', '..#', '.##', '...', '.#.'], '+': ['...', '.#.', '###', '.#.', '...'],
    '<': ['..#', '.#.', '#..', '.#.', '..#'], '>': ['#..', '.#.', '..#', '.#.', '#..'], '·': ['...', '...', '.#.', '...', '...']
  };
  static width(text, s = 1) { return text.length * 4 * s - s; }
  // Dibuja texto; align: 'left' | 'center' | 'right'
  static draw(ctx, text, x, y, s = 1, color = PAL.text, align = 'left', shadow = true) {
    text = String(text).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const w = PixelFont.width(text, s);
    if (align === 'center') x -= Math.floor(w / 2); else if (align === 'right') x -= w;
    const paint = (ox, oy, c) => {
      ctx.fillStyle = c;
      for (let i = 0; i < text.length; i++) {
        const g = PixelFont.G[text[i]] || PixelFont.G['?'];
        for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r][k] === '#') ctx.fillRect(x + ox + (i * 4 + k) * s, y + oy + r * s, s, s);
      }
    };
    if (shadow) paint(s > 1 ? Math.ceil(s / 2) : 1, s > 1 ? Math.ceil(s / 2) : 1, 'rgba(0,0,0,.55)');
    paint(0, 0, color);
  }
}

/* ------------------------------------------------- RÉCORDS (LocalStorage) -- */
class Records {
  static KEY = 'pixelgol_records';
  static HKEY = 'pixelgol_historial';
  static MAX_HISTORY = 50;
  static blank() {
    return {
      partidos: 0, victoriasVsIA: 0, derrotasVsIA: 0, empatesVsIA: 0,
      victoriasP1: 0, victoriasP2: 0,
      rachaActual: 0, mejorRacha: 0, mayorGoleada: 0, maxGolesPartido: 0,
      golMasRapido: null, golesTotales: 0, ultimaActualizacion: null
    };
  }
  static load() {
    try { return Object.assign(Records.blank(), JSON.parse(localStorage.getItem(Records.KEY) || '{}')); }
    catch { return Records.blank(); }
  }
  static history() {
    try { const h = JSON.parse(localStorage.getItem(Records.HKEY) || '[]'); return Array.isArray(h) ? h : []; }
    catch { return []; }
  }
  static save(rec, hist) {
    try {
      localStorage.setItem(Records.KEY, JSON.stringify(rec));
      if (hist) localStorage.setItem(Records.HKEY, JSON.stringify(hist));
      return true;
    } catch { return false; }
  }
  static reset() {
    try { localStorage.removeItem(Records.KEY); localStorage.removeItem(Records.HKEY); } catch { /* sin almacenamiento */ }
  }
  // Registra un partido terminado y devuelve la lista de récords nuevos
  static register(m) {
    const r = Records.load(), h = Records.history(), news = [];
    r.partidos++;
    const total = m.marcador.p1 + m.marcador.p2;
    r.golesTotales += total;
    if (total > r.maxGolesPartido) { r.maxGolesPartido = total; if (total > 0) news.push('Más goles en un partido: ' + total); }
    const margin = Math.abs(m.marcador.p1 - m.marcador.p2);
    if (margin > r.mayorGoleada) { r.mayorGoleada = margin; news.push('Mayor goleada: +' + margin); }
    if (m.golMasRapido !== null && (r.golMasRapido === null || m.golMasRapido < r.golMasRapido)) {
      r.golMasRapido = m.golMasRapido; news.push('Gol más rápido: ' + m.golMasRapido.toFixed(1) + ' s');
    }
    if (m.modo === '1P') {
      if (m.ganador === 'P1') {
        r.victoriasVsIA++; r.rachaActual++;
        if (r.rachaActual > r.mejorRacha) { r.mejorRacha = r.rachaActual; news.push('Mejor racha vs IA: ' + r.mejorRacha); }
      } else if (m.ganador === 'CPU') { r.derrotasVsIA++; r.rachaActual = 0; }
      else { r.empatesVsIA++; r.rachaActual = 0; }
    } else {
      if (m.ganador === 'P1') r.victoriasP1++; else if (m.ganador === 'P2') r.victoriasP2++;
    }
    r.ultimaActualizacion = m.fecha;
    h.unshift(m); if (h.length > Records.MAX_HISTORY) h.length = Records.MAX_HISTORY;
    Records.save(r, h);
    return news;
  }
}

/* ------------------------------------------------------------- ENTRADA -- */
class Joystick {
  constructor(el) {
    this.el = el; this.knob = el.querySelector('.knob'); this.x = 0; this.y = 0; this.id = null; this.R = 42;
    const start = e => {
      if (this.id !== null) return; e.preventDefault();
      this.id = e.pointerId; el.setPointerCapture(e.pointerId);
      const r = el.getBoundingClientRect(); this.cx = r.left + r.width / 2; this.cy = r.top + r.height / 2; this.move(e);
      window.dispatchEvent(new Event('pg-user'));
    };
    const end = e => { if (e.pointerId !== this.id) return; this.id = null; this.x = this.y = 0; this.knob.style.transform = ''; };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointermove', e => { if (e.pointerId === this.id) { e.preventDefault(); this.move(e); } });
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  move(e) {
    let dx = e.clientX - this.cx, dy = e.clientY - this.cy; const l = Math.hypot(dx, dy);
    if (l > this.R) { dx *= this.R / l; dy *= this.R / l; }
    this.x = dx / this.R; this.y = dy / this.R;
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
}

class Input {
  constructor() {
    this.keys = new Set(); this.pressed = new Set();
    window.addEventListener('keydown', e => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.stick1 = new Joystick(document.getElementById('stick1'));
    this.stick2 = new Joystick(document.getElementById('stick2'));
  }
  // Dirección normalizada de cada jugador
  axis(player, mode) {
    const k = c => this.keys.has(c) ? 1 : 0;
    let x = 0, y = 0;
    if (player === 1) {
      x = k('KeyD') - k('KeyA'); y = k('KeyS') - k('KeyW');
      if (mode === '1P') { x += k('ArrowRight') - k('ArrowLeft'); y += k('ArrowDown') - k('ArrowUp'); }
      x += this.stick1.x; y += this.stick1.y;
    } else {
      x = k('ArrowRight') - k('ArrowLeft'); y = k('ArrowDown') - k('ArrowUp');
      x += this.stick2.x; y += this.stick2.y;
    }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  take(code) { const had = this.pressed.has(code); this.pressed.delete(code); return had; }
  endFrame() { this.pressed.clear(); }
}

/* -------------------------------------------------------------- CANCHA -- */
class Field {
  constructor() {
    this.left = 20; this.right = 300; this.top = 26; this.bottom = 190;
    this.cx = (this.left + this.right) / 2; this.cy = (this.top + this.bottom) / 2;
    this.mouth = 28;                       // media altura de la boca del arco
    this.mTop = this.cy - this.mouth; this.mBot = this.cy + this.mouth;
    this.depth = 12;                       // profundidad del arco
    this.postR = 2;
    this.posts = [
      { x: this.left, y: this.mTop }, { x: this.left, y: this.mBot },
      { x: this.right, y: this.mTop }, { x: this.right, y: this.mBot }
    ];
  }
  // Dibuja un círculo "de píxeles" (algoritmo del punto medio), sin antialiasing
  pixelCircle(ctx, cx, cy, r) {
    let x = r, y = 0, err = 1 - r;
    const plot = (a, b) => ctx.fillRect(cx + a, cy + b, 1, 1);
    while (x >= y) {
      plot(x, y); plot(y, x); plot(-y, x); plot(-x, y); plot(-x, -y); plot(-y, -x); plot(y, -x); plot(x, -y);
      y++; if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
    }
  }
  draw(ctx, flash) {
    const { left: L, right: R, top: T, bottom: B } = this;
    // césped a franjas
    const n = 14, sw = (R - L) / n;
    for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? PAL.grass1 : PAL.grass2; ctx.fillRect(Math.round(L + i * sw), T, Math.ceil(sw), B - T); }
    ctx.fillStyle = PAL.grass1; ctx.fillRect(0, T - 4, W, 4); ctx.fillRect(0, B, W, H - B);
    ctx.fillRect(0, T, L, B - T); ctx.fillRect(R, T, W - R, B - T);
    // líneas
    ctx.fillStyle = flash || PAL.line;
    ctx.fillRect(L, T, R - L, 1); ctx.fillRect(L, B - 1, R - L, 1);
    ctx.fillRect(L, T, 1, this.mTop - T); ctx.fillRect(L, this.mBot, 1, B - this.mBot);
    ctx.fillRect(R - 1, T, 1, this.mTop - T); ctx.fillRect(R - 1, this.mBot, 1, B - this.mBot);
    ctx.fillStyle = PAL.line;
    ctx.fillRect(this.cx, T, 1, B - T);
    this.pixelCircle(ctx, this.cx, this.cy, 22);
    ctx.fillRect(this.cx - 1, this.cy - 1, 3, 3);
    // áreas
    for (const s of [-1, 1]) {
      const gx = s < 0 ? L : R - 1, bw = 34, bh = 50, sw2 = 12, sh2 = 32;
      const x0 = s < 0 ? gx : gx - bw, x1 = s < 0 ? gx : gx - sw2;
      ctx.fillRect(x0, this.cy - bh, bw, 1); ctx.fillRect(x0, this.cy + bh, bw + 1, 1); ctx.fillRect(s < 0 ? gx + bw : gx - bw, this.cy - bh, 1, bh * 2);
      ctx.fillRect(x1, this.cy - sh2, sw2, 1); ctx.fillRect(x1, this.cy + sh2, sw2 + 1, 1); ctx.fillRect(s < 0 ? gx + sw2 : gx - sw2, this.cy - sh2, 1, sh2 * 2);
      ctx.fillRect(s < 0 ? gx + 22 : gx - 22, this.cy, 1, 1);
    }
    // arcos: red (cuadrícula) y postes
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? L - this.depth : R, x1 = s < 0 ? L : R + this.depth;
      ctx.fillStyle = '#1c5a1c'; ctx.fillRect(x0, this.mTop, x1 - x0, this.mBot - this.mTop);
      ctx.fillStyle = PAL.net;
      for (let y = this.mTop; y <= this.mBot; y += 3) ctx.fillRect(x0, y, x1 - x0, 1);
      for (let x = x0; x <= x1; x += 3) ctx.fillRect(x, this.mTop, 1, this.mBot - this.mTop);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x0, this.mTop - 1, x1 - x0 + 1, 2); ctx.fillRect(x0, this.mBot, x1 - x0 + 1, 2);
      ctx.fillRect(s < 0 ? x0 : x1 - 1, this.mTop, 2, this.mBot - this.mTop);
    }
    ctx.fillStyle = '#ffffff';
    for (const p of this.posts) ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
}

/* --------------------------------------------------------------- BALÓN -- */
class Ball {
  static R = 2.5;
  static BASE = 105;          // velocidad inicial (píxeles/s)
  static MAX = 260;           // tope de velocidad
  static RAMP = 1.0;          // aumento por segundo en juego
  static KICK = 3.5;          // aumento por cada toque de un jugador
  constructor(field) { this.f = field; this.reset(); this.trail = []; }
  reset() {
    this.x = this.f.cx; this.y = this.f.cy; this.dx = 0; this.dy = 0; this.speed = Ball.BASE;
    this.moving = false; this.lastTouch = null; this.inGoal = 0; this.trail = [];
  }
  launch(dirX) {
    const a = (Math.random() * 0.9 - 0.45);
    this.dx = Math.cos(a) * dirX; this.dy = Math.sin(a); this.moving = true;
  }
  setDir(x, y) {
    const l = len(x, y) || 1; this.dx = x / l; this.dy = y / l;
    // evita trayectorias casi verticales (el balón quedaría rebotando arriba y abajo)
    if (Math.abs(this.dx) < 0.22) { this.dx = 0.22 * (Math.sign(this.dx) || 1); const k = len(this.dx, this.dy); this.dx /= k; this.dy /= k; }
  }
  // Un subpaso de física; devuelve eventos: 'wall' | 'post' | 'goalL' | 'goalR'
  step(dt, game) {
    if (!this.moving) return null;
    const f = this.f, r = Ball.R;
    this.speed = Math.min(Ball.MAX, this.speed + Ball.RAMP * dt);
    this.x += this.dx * this.speed * dt; this.y += this.dy * this.speed * dt;
    let ev = null;
    const inMouth = this.y > f.mTop + 1 && this.y < f.mBot - 1;
    // ¿dentro del arco? rebota en la red (fondo y lados)
    if (this.x < f.left || this.x > f.right) {
      if (inMouth || this.inGoal) {
        this.inGoal = this.x < f.left ? -1 : 1;
        const back = this.inGoal < 0 ? f.left - f.depth + r : f.right + f.depth - r;
        if (this.inGoal < 0 && this.x < back) { this.x = back; this.dx = Math.abs(this.dx) * 0.4; this.speed *= 0.5; }
        if (this.inGoal > 0 && this.x > back) { this.x = back; this.dx = -Math.abs(this.dx) * 0.4; this.speed *= 0.5; }
        if (this.y < f.mTop + r) { this.y = f.mTop + r; this.dy = Math.abs(this.dy); }
        if (this.y > f.mBot - r) { this.y = f.mBot - r; this.dy = -Math.abs(this.dy); }
        // GOL: el balón cruzó la línea por completo
        if (this.x < f.left - r) ev = 'goalL'; else if (this.x > f.right + r) ev = 'goalR';
      }
    } else this.inGoal = 0;
    // paredes de fondo (fuera de la boca del arco)
    if (!this.inGoal) {
      if (this.x - r < f.left && !inMouth) { this.x = f.left + r; this.dx = Math.abs(this.dx); ev = ev || 'wall'; }
      if (this.x + r > f.right && !inMouth) { this.x = f.right - r; this.dx = -Math.abs(this.dx); ev = ev || 'wall'; }
    }
    // bandas
    if (this.y - r < f.top) { this.y = f.top + r; this.dy = Math.abs(this.dy); ev = ev || 'wall'; }
    if (this.y + r > f.bottom) { this.y = f.bottom - r; this.dy = -Math.abs(this.dy); ev = ev || 'wall'; }
    // postes (círculos)
    for (const p of f.posts) {
      const ox = this.x - p.x, oy = this.y - p.y, d = len(ox, oy), min = r + f.postR;
      if (d < min && d > 0.001) {
        const nx = ox / d, ny = oy / d, dot = this.dx * nx + this.dy * ny;
        if (dot < 0) { this.setDir(this.dx - 2 * dot * nx, this.dy - 2 * dot * ny); ev = 'post'; }
        this.x = p.x + nx * min; this.y = p.y + ny * min;
      }
    }
    return ev;
  }
  draw(ctx) {
    // estela corta cuando va rápido
    const fast = (this.speed - Ball.BASE) / (Ball.MAX - Ball.BASE);
    if (this.moving && fast > 0.35) {
      ctx.fillStyle = `rgba(255,255,255,${0.18 + fast * 0.25})`;
      for (const t of this.trail) ctx.fillRect(Math.round(t[0]) - 1, Math.round(t[1]) - 1, 3, 3);
    }
    this.trail.push([this.x, this.y]); if (this.trail.length > 4) this.trail.shift();
    const x = Math.round(this.x), y = Math.round(this.y);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - 1, y + 2, 4, 2);
    ctx.fillStyle = PAL.ball; ctx.fillRect(x - 2, y - 1, 5, 3); ctx.fillRect(x - 1, y - 2, 3, 5);
    ctx.fillStyle = '#202020'; ctx.fillRect(x, y, 1, 1);
  }
}

/* ------------------------------------------------------------- JUGADOR -- */
// Sprite de 7x11 píxeles: c=camiseta, d=detalle, s=piel, h=pelo, p=pantalón, b=botas
const SPRITE = [
  ['..hhh..', '..sss..', '..sss..', '.ccccc.', 'ccdcdcc', 's.ccc.s', '..ccc..', '..ppp..', '..p.p..', '..p.p..', '.bb.bb.'],
  ['..hhh..', '..sss..', '..sss..', '.ccccc.', 'ccdcdcc', 's.ccc.s', '..ccc..', '..ppp..', '.p...p.', '.p...p.', 'bb...bb']
];

class Player {
  static R = 5;                    // radio de colisión
  constructor(team, color, dark, x, y, speed) {
    Object.assign(this, { team, color, dark, homeX: x, homeY: y, speed });
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.face = team === 1 ? 1 : -1;
    this.anim = 0; this.touchCD = 0;
  }
  reset() { this.x = this.homeX; this.y = this.homeY; this.vx = this.vy = 0; }
  // dir: {x,y} normalizado; aplica aceleración suave
  drive(dir, dt) {
    const tx = dir.x * this.speed, ty = dir.y * this.speed, k = Math.min(1, dt * 14);
    this.vx += (tx - this.vx) * k; this.vy += (ty - this.vy) * k;
  }
  update(dt, f) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.x = clamp(this.x, f.left + 4, f.right - 4); this.y = clamp(this.y, f.top + 6, f.bottom - 3);
    if (Math.abs(this.vx) > 4) this.face = Math.sign(this.vx);
    if (len(this.vx, this.vy) > 8) this.anim += dt * 9; else this.anim = 0;
    this.touchCD = Math.max(0, this.touchCD - dt);
  }
  // Colisión jugador–balón: el balón sale despedido según el punto de contacto y el movimiento del jugador
  collide(ball, game) {
    if (!ball.moving && !game.canKickoffTouch) return false;
    const ox = ball.x - this.x, oy = ball.y - this.y, d = len(ox, oy), min = Player.R + Ball.R;
    if (d >= min) return false;
    const nx = d > 0.001 ? ox / d : this.face, ny = d > 0.001 ? oy / d : 0;
    ball.x = this.x + nx * (min + 0.2); ball.y = this.y + ny * (min + 0.2);
    // nunca empujar el balón fuera de la cancha (solo puede entrar al arco por la boca)
    const f = game.field, r = Ball.R;
    ball.y = clamp(ball.y, f.top + r, f.bottom - r);
    if (ball.y > f.mTop + 1 && ball.y < f.mBot - 1) ball.x = clamp(ball.x, f.left - f.depth + r, f.right + f.depth - r);
    else ball.x = clamp(ball.x, f.left + r, f.right - r);
    const dot = ball.dx * nx + ball.dy * ny;
    let rx = ball.dx, ry = ball.dy;
    if (dot < 0 || !ball.moving) { rx = ball.dx - 2 * dot * nx; ry = ball.dy - 2 * dot * ny; }
    const pv = len(this.vx, this.vy) / Math.max(1, this.speed);
    // mezcla: rebote + dirección del contacto + empuje del jugador
    ball.setDir(rx * 0.45 + nx * 0.9 + (this.vx / Math.max(1, this.speed)) * 0.9 * pv, ry * 0.45 + ny * 0.9 + (this.vy / Math.max(1, this.speed)) * 0.9 * pv);
    if (!ball.moving) { ball.moving = true; ball.speed = Ball.BASE; }
    if (this.touchCD <= 0) { ball.speed = Math.min(Ball.MAX, ball.speed + Ball.KICK); this.touchCD = 0.18; game.sound.kick(); }
    ball.lastTouch = this;
    return true;
  }
  draw(ctx) {
    const fr = SPRITE[Math.floor(this.anim) % 2], x0 = Math.round(this.x) - 3, y0 = Math.round(this.y) - 8;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x0, y0 + 10, 7, 2);
    const col = { c: this.color, d: this.dark, s: PAL.skin, h: '#3a2010', p: PAL.shorts, b: '#101010' };
    for (let r = 0; r < fr.length; r++) for (let k = 0; k < 7; k++) {
      const ch = fr[r][this.face > 0 ? k : 6 - k]; if (ch === '.') continue;
      ctx.fillStyle = col[ch]; ctx.fillRect(x0 + k, y0 + r, 1, 1);
    }
  }
}

/* ------------------------------------------------------------- ARQUERO -- */
class Goalkeeper extends Player {
  constructor(team, color, dark, field, reflex) {
    const x = team === 1 ? field.left + 7 : field.right - 7;
    super(team, color, dark, x, field.cy, 60);
    this.f = field; this.reflex = reflex; this.thinkT = 0; this.targetY = field.cy; this.isGK = true;
  }
  think(dt, ball) {
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = this.reflex;          // tiempo de reacción
      // predice dónde cruzará el balón su línea si viene hacia el arco
      const toward = (this.team === 1 && ball.dx < 0) || (this.team === 2 && ball.dx > 0);
      let ty = this.f.cy;
      if (ball.moving && toward) {
        const t = (this.x - ball.x) / (ball.dx * ball.speed || 1);
        ty = ball.y + ball.dy * ball.speed * Math.max(0, t);
        // reflejar en las bandas
        const top = this.f.top, bot = this.f.bottom;
        for (let i = 0; i < 3; i++) { if (ty < top) ty = 2 * top - ty; if (ty > bot) ty = 2 * bot - ty; }
        // error de cálculo: cuanto más rápido va el balón, peor lo lee (y peor con menos reflejos)
        const fast = clamp((ball.speed - Ball.BASE) / (Ball.MAX - Ball.BASE), 0, 1);
        ty += (Math.random() * 2 - 1) * (5 + 18 * fast) * (this.reflex / 0.16);
      } else ty = this.f.cy + (ball.y - this.f.cy) * 0.4;
      this.targetY = clamp(ty, this.f.mTop + 3, this.f.mBot - 3);
    }
    const dy = this.targetY - this.y;
    // sale un poco del arco cuando el balón está cerca
    const near = Math.abs(ball.x - this.homeX) < 45;
    const tx = this.homeX + (near ? (this.team === 1 ? 6 : -6) : 0);
    const dx = tx - this.x;
    this.drive({ x: clamp(dx / 4, -1, 1) * 0.6, y: clamp(dy / 3, -1, 1) }, dt);
  }
  update(dt, f) {
    super.update(dt, f);
    const lim = this.team === 1 ? [f.left + 3, f.left + 16] : [f.right - 16, f.right - 3];
    this.x = clamp(this.x, lim[0], lim[1]); this.y = clamp(this.y, f.mTop - 4, f.mBot + 4);
  }
  collide(ball, game) {
    const hit = super.collide(ball, game);
    if (hit) {
      // el despeje del arquero siempre sale hacia el campo
      const out = this.team === 1 ? 1 : -1;
      if (Math.sign(ball.dx) !== out) ball.setDir(-ball.dx, ball.dy);
      game.sound.save();
      if (game.state === 'play' && game.lastShooterTeam && game.lastShooterTeam !== this.team) game.flashText('ATAJADA!', this.team);
    }
    return hit;
  }
}

/* ---------------------------------------------------------- IA RIVAL -- */
// Persigue el balón colocándose detrás de él para empujarlo hacia el arco contrario
class AIController {
  static LEVELS = { facil: { speed: 62, think: 0.3, gk: 0.32 }, normal: { speed: 76, think: 0.18, gk: 0.2 }, dificil: { speed: 88, think: 0.1, gk: 0.12 } };
  constructor(player, field, level) {
    this.p = player; this.f = field; this.cfg = AIController.LEVELS[level]; this.t = 0; this.tx = player.x; this.ty = player.y;
    player.speed = this.cfg.speed;
  }
  update(dt, ball) {
    const p = this.p, f = this.f;
    this.t -= dt;
    if (this.t <= 0) {
      this.t = this.cfg.think * (0.7 + Math.random() * 0.6);
      const goalX = p.team === 2 ? f.left : f.right;          // arco al que ataca
      // anticipa un poco la posición del balón
      const lead = ball.moving ? 0.18 : 0;
      const bx = ball.x + ball.dx * ball.speed * lead, by = ball.y + ball.dy * ball.speed * lead;
      const gx = goalX - bx, gy = f.cy - by, gl = len(gx, gy) || 1;
      // punto detrás del balón (en la línea balón–arco)
      let tx = bx - gx / gl * 8, ty = by - gy / gl * 8;
      // si está del lado equivocado, rodea el balón para no empujarlo hacia su propio arco
      const ax = p.x - bx, ay = p.y - by;
      if (ax * gx + ay * gy > 0 && len(ax, ay) < 30) ty += (p.y < by ? -14 : 14);
      // muy cerca: va directo al balón para empujarlo
      if (len(p.x - bx, p.y - by) < 10) { tx = bx - gx / gl * 2; ty = by - gy / gl * 2; }
      this.tx = tx; this.ty = ty;
    }
    const dx = this.tx - p.x, dy = this.ty - p.y, d = len(dx, dy);
    p.drive(d > 1.5 ? { x: dx / d, y: dy / d } : { x: 0, y: 0 }, dt);
  }
}

/* ---------------------------------------------------------------- JUEGO -- */
class Game {
  constructor() {
    this.canvas = document.getElementById('screen');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.field = new Field();
    this.ball = new Ball(this.field);
    this.sound = new Sound();
    this.input = new Input();
    this.state = 'menu';             // menu · kickoff · play · goal · paused · over
    this.settings = this.loadSettings();
    this.messages = [];
    this.time = 0;
    this.bindUI();
    this.setupMatch();
    this.state = 'menu';
    this.last = performance.now();
    requestAnimationFrame(t => this.loop(t));
  }

  loadSettings() {
    const d = { mode: '1P', level: 'normal', target: 5, minutes: 3, sound: true };
    try { return Object.assign(d, JSON.parse(localStorage.getItem('pixelgol_settings') || '{}')); } catch { return d; }
  }
  saveSettings() { try { localStorage.setItem('pixelgol_settings', JSON.stringify(this.settings)); } catch { /* sin almacenamiento */ } }

  setupMatch() {
    const f = this.field, s = this.settings, lvl = AIController.LEVELS[s.level];
    this.p1 = new Player(1, PAL.p1, PAL.p1dark, f.cx - 40, f.cy, 92);
    this.p2 = new Player(2, PAL.p2, PAL.p2dark, f.cx + 40, f.cy, 92);
    this.gk1 = new Goalkeeper(1, PAL.gk1, PAL.p1dark, f, s.mode === '2P' ? 0.16 : 0.16);
    this.gk2 = new Goalkeeper(2, PAL.gk2, PAL.p2dark, f, s.mode === '2P' ? 0.16 : lvl.gk);
    this.players = [this.p1, this.p2, this.gk1, this.gk2];
    this.ai = s.mode === '1P' ? new AIController(this.p2, f, s.level) : null;
    this.score = { 1: 0, 2: 0 };
    this.clock = s.minutes * 60; this.elapsed = 0; this.golden = false;
    this.goals = []; this.lastShooterTeam = null; this.demoAI = null;
    this.kickoff(Math.random() < 0.5 ? 1 : 2);
  }

  kickoff(toward) {
    this.ball.reset();
    for (const p of this.players) p.reset();
    this.kickDir = toward === 1 ? -1 : 1;   // el balón sale hacia el equipo que recibió el gol
    this.state = 'kickoff'; this.stateT = 0;
    this.canKickoffTouch = false;
  }

  start() {
    this.sound.unlock();
    this.sound.on = this.settings.sound;
    this.setupMatch();
    this.hidePanels(); this.sound.whistle();
    document.body.classList.add('playing');
  }

  /* ----------------------------------------------------- BUCLE PRINCIPAL -- */
  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.update(dt);
    this.draw();
    this.input.endFrame();
    requestAnimationFrame(t => this.loop(t));
  }

  update(dt) {
    this.time += dt;
    this.sound.muted = this.state === 'menu';   // la demo del menú no suena
    const inp = this.input;
    if (inp.take('Space')) {
      if (this.state === 'menu' || this.state === 'over') { /* en menú la barra no hace nada */ }
      else this.togglePause();
    }
    for (const m of this.messages) m.t -= dt;
    this.messages = this.messages.filter(m => m.t > 0);
    switch (this.state) {
      case 'menu': this.demo(dt); break;
      case 'kickoff':
        this.stateT += dt; this.movePlayers(dt, true);
        if (this.stateT > 1.2) { this.ball.launch(this.kickDir); this.state = 'play'; this.sound.beep(660, 0.08); }
        break;
      case 'play': this.simulate(dt); break;
      case 'goal':
        this.stateT += dt; this.movePlayers(dt, false, true);
        this.stepBall(dt);
        if (this.stateT > 1.8) { if (this.checkEnd()) return; this.kickoff(this.lastConceded); }
        break;
      case 'paused': case 'over': break;
    }
  }

  // Partido de demostración en el menú: dos IA juegan solas
  demo(dt) {
    if (!this.demoAI) { this.demoAI = [new AIController(this.p1, this.field, 'normal'), new AIController(this.p2, this.field, 'normal')]; }
    if (!this.ball.moving) this.ball.launch(Math.random() < 0.5 ? -1 : 1);
    this.demoAI[0].update(dt, this.ball); this.demoAI[1].update(dt, this.ball);
    this.gk1.think(dt, this.ball); this.gk2.think(dt, this.ball);
    for (const p of this.players) p.update(dt, this.field);
    const ev = this.stepBall(dt, true);
    if (ev === 'goalL' || ev === 'goalR') { this.ball.reset(); for (const p of this.players) p.reset(); }
  }

  movePlayers(dt, kickoff, celebrate) {
    const s = this.settings;
    if (celebrate) {
      // tras el gol: el goleador corre a festejar, el resto se detiene
      for (const p of this.players) p.drive({ x: 0, y: 0 }, dt);
      const sc = this.lastScorerTeam === 1 ? this.p1 : this.p2;
      sc.drive({ x: Math.cos(this.time * 6) * 0.8, y: Math.sin(this.time * 6) * 0.8 }, dt);
    } else {
      this.p1.drive(this.input.axis(1, s.mode), dt);
      if (this.ai) this.ai.update(dt, this.ball); else this.p2.drive(this.input.axis(2, s.mode), dt);
      this.gk1.think(dt, this.ball); this.gk2.think(dt, this.ball);
      if (kickoff) {
        // en el saque nadie invade el círculo central
        for (const p of [this.p1, this.p2]) {
          const ox = p.x - this.field.cx, oy = p.y - this.field.cy, d = len(ox, oy);
          if (d < 24) { p.x = this.field.cx + ox / (d || 1) * 24; p.y = this.field.cy + oy / (d || 1) * 24; }
          if ((p.team === 1 && p.x > this.field.cx - 4) || (p.team === 2 && p.x < this.field.cx + 4)) p.x = this.field.cx + (p.team === 1 ? -4 : 4);
        }
      }
    }
    for (const p of this.players) p.update(dt, this.field);
    this.separatePlayers();
  }

  separatePlayers() {
    const P = this.players;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const a = P[i], b = P[j], dx = b.x - a.x, dy = b.y - a.y, d = len(dx, dy), min = Player.R * 2;
      if (d < min && d > 0.001) { const push = (min - d) / 2; a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push; }
    }
  }

  // Física del balón en subpasos (evita que atraviese jugadores o postes a alta velocidad)
  stepBall(dt, quiet) {
    const steps = Math.ceil(dt * 240); let out = null;
    for (let i = 0; i < steps; i++) {
      const ev = this.ball.step(dt / steps, this);
      for (const p of this.players) if (p.collide(this.ball, this) && !p.isGK) this.lastShooterTeam = p.team;
      if (ev && !quiet && ev !== 'goalL' && ev !== 'goalR') { if (ev === 'post') { this.sound.post(); this.flashText('AL POSTE!', 0); } else this.sound.wall(); }
      if (ev === 'goalL' || ev === 'goalR') { out = ev; break; }
    }
    return out;
  }

  simulate(dt) {
    this.movePlayers(dt);
    const ev = this.stepBall(dt);
    if (ev === 'goalL') this.goal(2); else if (ev === 'goalR') this.goal(1);
    if (this.state !== 'play') return;
    this.elapsed += dt;
    if (!this.golden) {
      this.clock = Math.max(0, this.clock - dt);
      if (this.clock <= 0) {
        if (this.score[1] === this.score[2]) { this.golden = true; this.flashText('GOL DE ORO!', 0, 2.5); this.sound.whistle(); }
        else this.endMatch();
      }
    }
  }

  goal(team) {
    if (this.state !== 'play') return;      // un gol se cuenta una sola vez
    this.score[team]++;
    this.goals.push({ equipo: team === 1 ? 'P1' : (this.settings.mode === '1P' ? 'CPU' : 'P2'), segundo: +this.elapsed.toFixed(1) });
    this.lastScorerTeam = team; this.lastConceded = team === 1 ? 2 : 1;
    this.state = 'goal'; this.stateT = 0;
    this.sound.goal(); this.flashText('GOL!', team, 1.8, 3);
  }

  checkEnd() {
    const t = this.settings.target;
    if (this.score[1] >= t || this.score[2] >= t || this.golden) { this.endMatch(); return true; }
    return false;
  }

  endMatch() {
    this.state = 'over'; document.body.classList.remove('playing');
    const s = this.settings, a = this.score[1], b = this.score[2];
    const p2name = s.mode === '1P' ? 'CPU' : 'P2';
    const winner = a > b ? 'P1' : (b > a ? p2name : 'EMPATE');
    const first = this.goals.length ? this.goals[0].segundo : null;
    const match = {
      fecha: new Date().toISOString(), modo: s.mode, dificultad: s.mode === '1P' ? s.level : null,
      marcador: { p1: a, p2: b }, ganador: winner, duracionSeg: +this.elapsed.toFixed(1),
      golesParaGanar: s.target, golDeOro: this.golden, goles: this.goals, golMasRapido: first
    };
    const news = Records.register(match);
    winner === 'P1' || (s.mode === '2P' && winner === 'P2') ? this.sound.win() : this.sound.whistle();
    UI.showResult(match, news);
  }

  togglePause() {
    if (this.state === 'paused') { this.state = this.pausedFrom; UI.pause(false); }
    else if (['play', 'kickoff', 'goal'].includes(this.state)) { this.pausedFrom = this.state; this.state = 'paused'; UI.pause(true); this.sound.beep(300, 0.06); }
  }

  flashText(text, team, t = 1.2, scale = 2) { this.messages.push({ text, team, t, max: t, scale }); }

  hidePanels() { UI.hideAll(); }

  /* -------------------------------------------------------------- DIBUJO -- */
  draw() {
    const c = this.ctx, f = this.field;
    c.fillStyle = PAL.bg; c.fillRect(0, 0, W, H);
    const flash = this.state === 'goal' && Math.floor(this.stateT * 8) % 2 === 0 ? (this.lastScorerTeam === 1 ? PAL.p1 : PAL.p2) : null;
    f.draw(c, flash);
    // orden por profundidad (y)
    [...this.players].sort((a, b) => a.y - b.y).forEach(p => p.draw(c));
    this.ball.draw(c);
    this.drawHUD(c);
    // mensajes grandes (GOL!, ATAJADA!...)
    for (const m of this.messages) {
      const k = m.t / m.max, col = m.team === 1 ? PAL.p1 : m.team === 2 ? PAL.p2 : PAL.gold;
      if (Math.floor(m.t * 10) % 2 === 0 || k > 0.4) PixelFont.draw(c, m.text, W / 2, f.cy - 30, m.scale, col, 'center');
    }
    if (this.state === 'kickoff') {
      PixelFont.draw(c, this.stateT < 0.6 ? 'LISTOS' : 'YA!', W / 2, f.cy - 34, 2, PAL.gold, 'center');
      this.drawHints(c);
    }
    if (this.state === 'paused') this.drawPause(c);
    if (this.state === 'menu') this.drawTitle(c);
  }

  drawHUD(c) {
    const s = this.settings;
    c.fillStyle = PAL.hud; c.fillRect(0, 0, W, 20);
    c.fillStyle = PAL.p1; c.fillRect(0, 19, W / 2, 1); c.fillStyle = PAL.p2; c.fillRect(W / 2, 19, W / 2, 1);
    PixelFont.draw(c, 'P1', 8, 7, 1, PAL.p1);
    PixelFont.draw(c, s.mode === '1P' ? 'CPU' : 'P2', W - 8, 7, 1, PAL.p2, 'right');
    // marcador grande en tiempo real
    PixelFont.draw(c, String(this.score[1]), W / 2 - 14, 3, 3, PAL.p1, 'right');
    PixelFont.draw(c, '-', W / 2, 5, 2, PAL.text, 'center');
    PixelFont.draw(c, String(this.score[2]), W / 2 + 14, 3, 3, PAL.p2, 'left');
    // reloj
    const sec = Math.ceil(this.clock), txt = this.golden ? 'ORO' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    PixelFont.draw(c, txt, 60, 7, 1, this.golden ? PAL.gold : PAL.text, 'center');
    // velocidad del balón (va subiendo poco a poco)
    const v = (this.ball.speed - Ball.BASE) / (Ball.MAX - Ball.BASE);
    PixelFont.draw(c, 'VEL', 232, 7, 1, PAL.dim, 'right');
    c.fillStyle = '#2a2a48'; c.fillRect(236, 7, 40, 5);
    c.fillStyle = v > 0.7 ? '#ff4040' : v > 0.4 ? PAL.gold : '#5ce05c'; c.fillRect(236, 7, Math.round(40 * clamp(v, 0, 1)), 5);
    PixelFont.draw(c, 'META ' + s.target, 100, 7, 1, PAL.dim, 'center');
  }

  drawHints(c) {
    const s = this.settings, y = this.field.bottom - 12;
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(30, y - 3, W - 60, 11);
    const t = s.mode === '1P' ? 'P1: W A S D O FLECHAS · ESPACIO: PAUSA' : 'P1: W A S D · P2: FLECHAS · ESPACIO: PAUSA';
    PixelFont.draw(c, t, W / 2, y, 1, PAL.text, 'center', false);
  }

  drawPause(c) {
    c.fillStyle = 'rgba(5,5,15,.72)'; c.fillRect(0, 20, W, H - 20);
    PixelFont.draw(c, 'PAUSA', W / 2, 36, 4, PAL.gold, 'center');
    const s = this.settings, lines = [
      'P1 ' + (s.mode === '1P' ? 'MUEVE CON W A S D O FLECHAS' : 'MUEVE CON W A S D'),
      s.mode === '1P' ? 'CPU PERSIGUE EL BALON' : 'P2 MUEVE CON LAS FLECHAS',
      'TOCA EL BALON PARA PATEARLO',
      'CADA TOQUE LO HACE MAS RAPIDO',
      'GANA QUIEN LLEGUE A ' + s.target + ' GOLES',
      'ESPACIO: CONTINUAR'
    ];
    lines.forEach((l, i) => PixelFont.draw(c, l, W / 2, 68 + i * 10, 1, i === lines.length - 1 ? PAL.gold : PAL.text, 'center'));
  }

  drawTitle(c) {
    c.fillStyle = 'rgba(5,5,15,.45)'; c.fillRect(0, 20, W, H - 20);
    const bob = Math.round(Math.sin(this.time * 3) * 2);
    PixelFont.draw(c, 'PIXEL GOL', W / 2, 48 + bob, 5, PAL.gold, 'center');
    if (Math.floor(this.time * 2) % 2 === 0) PixelFont.draw(c, 'ELIGE UN MODO PARA JUGAR', W / 2, 90, 1, PAL.text, 'center');
  }

  /* ---------------------------------------------------- INTERFAZ HTML -- */
  bindUI() {
    UI.init(this);
    window.addEventListener('pg-user', () => this.sound.unlock());
    window.addEventListener('keydown', () => this.sound.unlock(), { once: true });
  }
}

/* ------------------------------------------------- INTERFAZ (DOM) -- */
const UI = {
  init(game) {
    this.g = game;
    const $ = id => document.getElementById(id);
    this.$ = $;
    // selector de opciones
    document.querySelectorAll('[data-set]').forEach(btn => {
      const key = btn.dataset.set, val = btn.dataset.val;
      const sync = () => document.querySelectorAll(`[data-set="${key}"]`).forEach(b => b.classList.toggle('on', String(game.settings[key]) === b.dataset.val));
      btn.addEventListener('click', () => {
        game.settings[key] = isNaN(+val) ? val : +val; game.saveSettings(); sync();
        document.body.classList.toggle('mode2p', game.settings.mode === '2P');
      });
      sync();
    });
    document.body.classList.toggle('mode2p', game.settings.mode === '2P');
    $('btnPlay').addEventListener('click', () => game.start());
    $('btnResume').addEventListener('click', () => game.togglePause());
    $('btnQuit').addEventListener('click', () => this.toMenu());
    $('btnAgain').addEventListener('click', () => game.start());
    $('btnMenu').addEventListener('click', () => this.toMenu());
    $('btnPauseTouch').addEventListener('click', () => game.togglePause());
    $('btnSound').addEventListener('click', () => {
      game.settings.sound = !game.settings.sound; game.sound.on = game.settings.sound; game.saveSettings(); this.syncSound();
    });
    this.syncSound();
    // récords, historial JSON y reinicio
    $('btnJson').addEventListener('click', () => { const b = $('jsonBox'); b.hidden = !b.hidden; this.renderRecords(); });
    $('btnDownload').addEventListener('click', () => this.download());
    $('btnReset').addEventListener('click', () => {
      const b = $('btnReset');
      if (b.dataset.armed) { Records.reset(); delete b.dataset.armed; b.textContent = 'Reiniciar récords'; this.renderRecords(); this.toast('Récords e historial borrados'); }
      else { b.dataset.armed = '1'; b.textContent = '¿Seguro? Pulsa otra vez'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Reiniciar récords'; }, 3000); }
    });
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');
    this.renderRecords();
  },
  syncSound() { this.$('btnSound').textContent = 'Sonido: ' + (this.g.settings.sound ? 'Sí' : 'No'); },
  hideAll() { for (const id of ['menu', 'pause', 'result']) this.$(id).hidden = true; document.body.classList.remove('paused'); },
  pause(on) { this.$('pause').hidden = !on; document.body.classList.toggle('paused', on); },
  toMenu() {
    const g = this.g; this.hideAll(); this.$('menu').hidden = false; document.body.classList.remove('playing');
    g.setupMatch(); g.state = 'menu'; this.renderRecords();
  },
  showResult(m, news) {
    const $ = this.$; this.hideAll(); $('result').hidden = false;
    const p2 = m.modo === '1P' ? 'CPU' : 'P2';
    $('resScore').innerHTML = `<span class="c1">P1 ${m.marcador.p1}</span> - <span class="c2">${m.marcador.p2} ${p2}</span>`;
    $('resTitle').textContent = m.ganador === 'EMPATE' ? 'EMPATE' : (m.ganador === 'P1' ? (m.modo === '1P' ? '¡GANASTE!' : '¡GANA P1!') : (m.modo === '1P' ? 'GANA LA CPU' : '¡GANA P2!'));
    $('resNews').innerHTML = news.length ? news.map(n => `<li>★ Nuevo récord — ${n}</li>`).join('') : '<li class="dim">Sin récords nuevos esta vez</li>';
    this.renderRecords();
  },
  renderRecords() {
    const r = Records.load(), h = Records.history(), $ = this.$;
    const fmt = v => v === null || v === undefined ? '—' : v;
    $('recGrid').innerHTML = [
      ['Partidos', r.partidos], ['Victorias vs IA', r.victoriasVsIA], ['Derrotas vs IA', r.derrotasVsIA],
      ['Mejor racha vs IA', r.mejorRacha], ['Mayor goleada', r.mayorGoleada ? '+' + r.mayorGoleada : '—'], ['Más goles en un partido', r.maxGolesPartido],
      ['Gol más rápido', r.golMasRapido !== null ? r.golMasRapido.toFixed(1) + ' s' : '—'], ['Victorias P1 / P2', `${r.victoriasP1} / ${r.victoriasP2}`], ['Goles totales', r.golesTotales]
    ].map(([k, v]) => `<div class="rec"><b>${fmt(v)}</b><span>${k}</span></div>`).join('');
    $('histList').innerHTML = h.length ? h.slice(0, 8).map(m => {
      const d = new Date(m.fecha), p2 = m.modo === '1P' ? 'CPU' : 'P2';
      return `<li><span>${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><b>P1 ${m.marcador.p1} - ${m.marcador.p2} ${p2}</b><em>${m.modo}${m.dificultad ? ' · ' + m.dificultad : ''}</em></li>`;
    }).join('') : '<li class="dim">Aún no hay partidos jugados</li>';
    $('jsonBox').textContent = JSON.stringify({ records: r, historial: h }, null, 2);
  },
  download() {
    const data = JSON.stringify({ records: Records.load(), historial: Records.history() }, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = 'pixel-gol-historial.json'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  },
  toast(msg) { const t = this.$('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(this._t); this._t = setTimeout(() => t.classList.remove('show'), 1800); }
};

window.addEventListener('DOMContentLoaded', () => { window.game = new Game(); });
