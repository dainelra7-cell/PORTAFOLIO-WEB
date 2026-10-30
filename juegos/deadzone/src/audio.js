/* =========================================================
   audio.js — sonidos sintetizados con Web Audio API
   (sin archivos externos). Volumen general/efectos/música.
   ========================================================= */
(function () {
  const A = DZ.audio = { ctx: null, master: null, sfx: null, amb: null, vol: { master: 0.8, sfx: 0.9, amb: 0.5 }, noiseBuf: null };

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = A.ctx = new AC();
    A.master = ctx.createGain(); A.master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(A.master);
    A.sfx = ctx.createGain(); A.sfx.connect(comp);
    A.amb = ctx.createGain(); A.amb.connect(A.master);
    const len = ctx.sampleRate * 1.5; A.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = A.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.applyVolume(); A.startAmbience();
  };
  A.applyVolume = function () {
    if (!A.ctx) return;
    A.master.gain.value = A.vol.master; A.sfx.gain.value = A.vol.sfx; A.amb.gain.value = A.vol.amb * 0.5;
  };
  const now = () => A.ctx.currentTime;
  function noise(dur, filterType, freq, q, gain, dest, startAt) {
    const ctx = A.ctx, t = startAt || now();
    const src = ctx.createBufferSource(); src.buffer = A.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || A.sfx); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    return { f, g };
  }
  function tone(type, f0, f1, dur, gain, dest, startAt) {
    const ctx = A.ctx, t = startAt || now();
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest || A.sfx); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  A.ok = () => !!A.ctx && A.ctx.state === 'running';

  A.shot = function (snd, upgraded) {
    if (!A.ok()) return;
    const p = snd.pitch, b = snd.body, l = snd.len;
    noise(l, 'lowpass', 1800 * p, 0.7, 0.55 * b + 0.25);
    noise(l * 0.5, 'highpass', 2500 * p, 0.5, 0.25);
    tone('sine', 140 * p, 40, l * 1.3, 0.6 * b);
    if (upgraded) tone('sawtooth', 900 * p, 300, 0.12, 0.08);
  };
  A.dry = () => { if (A.ok()) tone('square', 1400, 900, 0.04, 0.08); };
  A.reload = function (dur) {
    if (!A.ok()) return; const t = now();
    noise(0.06, 'bandpass', 2500, 3, 0.35, A.sfx, t + 0.05);
    noise(0.06, 'bandpass', 1800, 3, 0.35, A.sfx, t + dur * 0.55);
    noise(0.08, 'bandpass', 3200, 4, 0.45, A.sfx, t + dur * 0.9);
  };
  A.hit = (head) => { if (A.ok()) { tone('triangle', head ? 1600 : 900, head ? 1200 : 600, 0.06, 0.18); noise(0.05, 'bandpass', 700, 2, 0.25); } };
  A.kill = () => { if (A.ok()) { tone('sine', 220, 70, 0.25, 0.25); noise(0.2, 'lowpass', 500, 1, 0.3); } };
  A.hurt = () => { if (A.ok()) { tone('sawtooth', 160, 60, 0.25, 0.25); noise(0.15, 'lowpass', 900, 1, 0.35); } };
  A.step = (run) => { if (A.ok()) noise(0.07, 'lowpass', run ? 500 : 380, 1, run ? 0.16 : 0.1); };
  A.land = () => { if (A.ok()) noise(0.12, 'lowpass', 300, 1, 0.25); };
  A.buy = () => { if (!A.ok()) return; const t = now(); tone('square', 660, 0, 0.09, 0.12, A.sfx, t); tone('square', 990, 0, 0.12, 0.12, A.sfx, t + 0.09); tone('sine', 1320, 0, 0.25, 0.14, A.sfx, t + 0.18); };
  A.deny = () => { if (!A.ok()) return; const t = now(); tone('square', 220, 0, 0.12, 0.12, A.sfx, t); tone('square', 160, 0, 0.18, 0.12, A.sfx, t + 0.12); };
  A.door = () => { if (!A.ok()) return; noise(1.2, 'lowpass', 260, 1, 0.45); tone('sawtooth', 70, 40, 1.2, 0.15); };
  A.swap = () => { if (A.ok()) noise(0.08, 'bandpass', 1500, 2, 0.25); };
  A.roundStart = function () {
    if (!A.ok()) return; const t = now();
    [0, 0.5, 1.0].forEach((d, i) => { tone('sawtooth', i === 2 ? 98 : 110, i === 2 ? 70 : 104, 0.9, 0.22, A.sfx, t + d); tone('sine', 55, 50, 1.0, 0.3, A.sfx, t + d); });
  };
  A.roundEnd = function () {
    if (!A.ok()) return; const t = now();
    [196, 247, 294, 392].forEach((f, i) => tone('triangle', f, 0, 0.6, 0.14, A.sfx, t + i * 0.12));
  };
  A.groan = function (vol, pitch) {
    if (!A.ok()) return; const ctx = A.ctx, t = now(), dur = 0.8 + Math.random() * 0.6;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; const base = (70 + Math.random() * 40) * (pitch || 1);
    o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * 0.75, t + dur);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6 + Math.random() * 5; const lg = ctx.createGain(); lg.gain.value = 9; lfo.connect(lg); lg.connect(o.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.13 * vol, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(f); f.connect(g); g.connect(A.sfx); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  };
  A.attack = () => { if (A.ok()) { noise(0.2, 'bandpass', 900, 1.5, 0.3); tone('sawtooth', 200, 90, 0.2, 0.12); } };
  A.boss = function () { if (!A.ok()) return; const t = now(); tone('sawtooth', 50, 30, 2.5, 0.35, A.sfx, t); noise(2.0, 'lowpass', 200, 1, 0.5, A.sfx, t); tone('square', 75, 38, 2.0, 0.12, A.sfx, t + 0.3); };
  A.slam = () => { if (A.ok()) { tone('sine', 80, 25, 0.6, 0.7); noise(0.6, 'lowpass', 400, 1, 0.7); } };
  A.forge = function (dur) {
    if (!A.ok()) return; const t = now(); const o = A.ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(900, t + dur);
    const g = A.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.3); g.gain.setValueAtTime(0.12, t + dur - 0.2); g.gain.exponentialRampToValueAtTime(0.0008, t + dur + 0.2);
    o.connect(g); g.connect(A.sfx); o.start(t); o.stop(t + dur + 0.3); A._forgeOsc = o;
    for (let i = 0; i < 6; i++) noise(0.08, 'bandpass', 3000, 4, 0.25, A.sfx, t + i * dur / 6);
    setTimeout(() => A.buy(), dur * 1000);
  };
  A.stopForge = () => { try { if (A._forgeOsc) A._forgeOsc.stop(); } catch (e) { } A._forgeOsc = null; };
  A.power = () => { if (!A.ok()) return; tone('sawtooth', 40, 200, 1.5, 0.2); noise(0.3, 'highpass', 4000, 1, 0.3); };
  A.melee = () => { if (A.ok()) { noise(0.12, 'bandpass', 600, 1.2, 0.45); tone('sine', 120, 50, 0.15, 0.4); } };
  A.powerDrop = () => { if (!A.ok()) return; const t = now(); [523, 659, 784].forEach((f, i) => tone('sine', f, 0, 0.25, 0.12, A.sfx, t + i * 0.07)); };
  A.powerup = function () { if (!A.ok()) return; const t = now(); [392, 523, 659, 784, 1046].forEach((f, i) => { tone('square', f, 0, 0.18, 0.09, A.sfx, t + i * 0.06); tone('sine', f * 2, 0, 0.3, 0.06, A.sfx, t + i * 0.06); }); tone('sawtooth', 60, 220, 0.6, 0.15, A.sfx, t); };
  A.medal = function (tier) {
    if (!A.ok()) return; const t = now();
    const seq = { bronze: [659, 880], silver: [659, 880, 1046], gold: [523, 659, 784, 1046], legend: [392, 523, 659, 784, 1046, 1318] }[tier] || [880];
    seq.forEach((f, i) => { tone('triangle', f, 0, 0.22, 0.13, A.sfx, t + i * 0.06); });
    tone('sine', seq[seq.length - 1] * 2, 0, 0.5, 0.06, A.sfx, t + seq.length * 0.06);
  };
  A.gameOver = function () { if (!A.ok()) return; const t = now();[392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.98, 0.7, 0.16, A.sfx, t + i * 0.35)); tone('sine', 60, 30, 2.5, 0.35, A.sfx, t); };

  // Ambiente: zumbido grave + viento
  A.startAmbience = function () {
    const ctx = A.ctx;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 48;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 48.7;
    const g = ctx.createGain(); g.gain.value = 0.18; o.connect(g); o2.connect(g); g.connect(A.amb); o.start(); o2.start();
    const src = ctx.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    const wg = ctx.createGain(); wg.gain.value = 0.12; src.connect(f); f.connect(wg); wg.connect(A.amb); src.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 250; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
  };
})();
