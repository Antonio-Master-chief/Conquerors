/* ============ CONQUERORS — procedural audio (WebAudio) ============
   Deep battle score: war drums, low drone, horn swells. All synthesized. */
'use strict';

const Audio2 = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let musicTimer = null, bar = 0, intensity = 1.0, started = false;
  let mood = 'battle';            // 'peace' | 'battle' — crossfades at bar boundaries
  let ambStarted = false, birdTimer = null;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
      // soft reverb via feedback delay (cheap, mobile-friendly)
      const del = ctx.createDelay(0.5); del.delayTime.value = 0.23;
      const fb = ctx.createGain(); fb.gain.value = 0.32;
      const wet = ctx.createGain(); wet.gain.value = 0.25;
      del.connect(fb); fb.connect(del); del.connect(wet); wet.connect(master);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.7; musicGain.connect(master); musicGain.connect(del);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
      return true;
    } catch (e) { return false; }
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  /* ---------- synth helpers ---------- */
  function env(g, t, a, peak, d, sus = 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + d);
  }
  function osc(type, f, t0, dur, gainNode) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0);
    o.connect(gainNode); o.start(t0); o.stop(t0 + dur + 0.1); return o;
  }
  function noise(t0, dur, gainNode, lp = 4000, hp = 100) {
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f1 = ctx.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.value = lp;
    const f2 = ctx.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = hp;
    src.connect(f1); f1.connect(f2); f2.connect(gainNode);
    src.start(t0); src.stop(t0 + dur); return src;
  }

  /* ---------- drums ---------- */
  function warDrum(t, vol = 1) { // deep taiko boom
    const g = ctx.createGain(); g.connect(musicGain);
    env(g, t, 0.004, 0.85 * vol * intensity, 0.45);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    o.connect(g); o.start(t); o.stop(t + 0.6);
    const ng = ctx.createGain(); ng.connect(musicGain); env(ng, t, 0.002, 0.18 * vol * intensity, 0.12);
    noise(t, 0.14, ng, 900);
  }
  function tom(t, f, vol = 0.5) {
    const g = ctx.createGain(); g.connect(musicGain);
    env(g, t, 0.003, vol * intensity, 0.22);
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.16);
    o.connect(g); o.start(t); o.stop(t + 0.35);
  }

  /* ---------- drone & horns ---------- */
  const PROG = [[55.0, 82.4], [43.65, 65.4], [49.0, 73.4], [55.0, 82.4]]; // A1+E2, F1+C2, G1+D2, A1+E2
  function droneChord(t, dur, freqs) {
    for (const f of freqs) {
      for (const det of [-3, 0, 3]) {
        const g = ctx.createGain();
        const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 320;
        g.connect(flt); flt.connect(musicGain);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.05 * intensity, t + dur * 0.3);
        g.gain.linearRampToValueAtTime(0.035 * intensity, t + dur * 0.8);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = f; o.detune.value = det;
        o.connect(g); o.start(t); o.stop(t + dur + 0.1);
      }
    }
  }
  function hornSwell(t, f) {
    const g = ctx.createGain();
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.setValueAtTime(500, t);
    flt.frequency.linearRampToValueAtTime(1600, t + 1.2);
    g.connect(flt); flt.connect(musicGain);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16 * intensity, t + 1.0);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    for (const [mult, det] of [[1, 0], [1, 7], [2, -5]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = f * mult; o.detune.value = det;
      o.connect(g); o.start(t); o.stop(t + 2.8);
    }
  }
  function choirPad(t, dur, f) {
    const g = ctx.createGain();
    const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = f * 4; flt.Q.value = 1.6;
    g.connect(flt); flt.connect(musicGain);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045 * intensity, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
    const lg = ctx.createGain(); lg.gain.value = 3.5; lfo.connect(lg);
    for (const det of [0, 5]) {
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.value = f * 2; o.detune.value = det;
      lg.connect(o.detune); o.connect(g); o.start(t); o.stop(t + dur + 0.1);
    }
    lfo.start(t); lfo.stop(t + dur + 0.1);
  }

  /* ---------- peaceful instruments ---------- */
  function pluck(t, f, vol = 0.10) { // harp-like
    const g = ctx.createGain(); g.connect(musicGain);
    env(g, t, 0.004, vol * intensity, 0.55);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    o.connect(g); o.start(t); o.stop(t + 0.7);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2; o2.detune.value = 3;
    const g2b = ctx.createGain(); g2b.connect(musicGain); env(g2b, t, 0.004, vol * 0.35 * intensity, 0.4);
    o2.connect(g2b); o2.start(t); o2.stop(t + 0.5);
  }
  function flute(t, f, dur) {
    const g = ctx.createGain(); g.connect(musicGain);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.075 * intensity, t + 0.25);
    g.gain.linearRampToValueAtTime(0.05 * intensity, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
    const lg = ctx.createGain(); lg.gain.value = f * 0.012;
    lfo.connect(lg); lg.connect(o.frequency);
    o.connect(g); o.start(t); o.stop(t + dur + .1); lfo.start(t); lfo.stop(t + dur + .1);
  }
  // minor pentatonic over the chord root
  const PENT = [1, 1.2, 1.333, 1.5, 1.8, 2];

  /* one 4-beat bar, ~2.2s */
  function scheduleBar(t) {
    const B = 0.55; // beat length
    const chord = PROG[bar % 4];
    if (mood === 'battle') {
      droneChord(t, B * 4 + 0.1, chord);
      if (bar % 2 === 0) choirPad(t, B * 4, chord[0]);
      warDrum(t, 1); warDrum(t + B * 2, 0.8);
      tom(t + B * 1, 160, 0.3); tom(t + B * 1.5, 130, 0.25);
      tom(t + B * 3, 160, 0.3); tom(t + B * 3.5, 190, 0.35);
      if (bar % 4 === 3) { warDrum(t + B * 3, 0.9); tom(t + B * 3.25, 220, 0.4); }
      if (bar % 8 === 4) hornSwell(t, chord[0] * 2);
    } else {
      // peace: soft drone, harp arpeggios, occasional flute phrase, gentle pulse
      droneChord(t, B * 4 + 0.1, [chord[0]]);
      if (bar % 2 === 1) choirPad(t, B * 4, chord[0]);
      tom(t + B * 1, 110, 0.10); tom(t + B * 3, 95, 0.10);
      const root = chord[0] * 4;
      const seq = [0, 2, 4, 5, 3, 1];
      for (let i = 0; i < 6; i++) {
        if ((bar + i) % 7 === 6) continue; // breathing room
        pluck(t + i * B * 0.66, root * PENT[seq[(i + bar) % 6]], 0.085);
      }
      if (bar % 4 === 2) {
        const m = chord[0] * 8;
        flute(t, m * PENT[(bar / 4 | 0) % 5], B * 2.4);
        flute(t + B * 2.5, m * PENT[((bar / 4 | 0) + 2) % 5], B * 1.4);
      }
    }
    bar++;
  }

  function startMusic(level) {
    if (!ensure()) return;
    resume();
    intensity = level;
    if (started) return;
    started = true;
    let next = ctx.currentTime + 0.1;
    scheduleBar(next);
    musicTimer = setInterval(() => {
      while (next < ctx.currentTime + 2.4) { next += 2.2; scheduleBar(next); }
    }, 500);
  }
  function setIntensity(v) { intensity = v; }
  function setMood(m) { mood = m; }
  function stopMusic() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; started = false; }

  /* ---------- ambience: wind + birdsong ---------- */
  function startAmbient() {
    if (!ensure() || ambStarted) return;
    ambStarted = true;
    // looping wind
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 330;
    const g = ctx.createGain(); g.gain.value = 0.035;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
    const lg = ctx.createGain(); lg.gain.value = 0.02;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(); lfo.start();
    // birds (peace-time only)
    birdTimer = setInterval(() => {
      if (mood !== 'peace' || !started || Math.random() < 0.4) return;
      const t = ctx.currentTime + Math.random() * 0.5;
      const n = 2 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) {
        const bg = ctx.createGain(); bg.connect(master);
        env(bg, t + i * 0.14, 0.01, 0.035, 0.09);
        const o = ctx.createOscillator(); o.type = 'sine';
        const f0 = 2500 + Math.random() * 1300;
        o.frequency.setValueAtTime(f0, t + i * 0.14);
        o.frequency.linearRampToValueAtTime(f0 * (0.8 + Math.random() * 0.45), t + i * 0.14 + 0.09);
        o.connect(bg); o.start(t + i * 0.14); o.stop(t + i * 0.14 + 0.15);
      }
    }, 4200);
  }

  /* ---------- unit vocal acknowledgments (synthesized) ---------- */
  function ack(kind, big) {
    if (!ctx || !started) return;
    if (throttled('ack', 160)) return;
    const t = ctx.currentTime;
    const base = (big ? 85 : 120) + Math.random() * 25;
    const g = ctx.createGain(); g.connect(sfxGain);
    env(g, t, 0.02, 0.55, kind === 'attack' ? 0.22 : 0.13);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 600; f1.Q.value = 3.5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 4.5;
    f1.connect(g); f2.connect(g);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(base * 0.9, t);
    o.frequency.linearRampToValueAtTime(base * (kind === 'attack' ? 1.5 : 1.2), t + 0.06);
    o.frequency.linearRampToValueAtTime(base * 0.78, t + 0.2);
    o.connect(f1); o.connect(f2);
    o.start(t); o.stop(t + 0.3);
    const ng = ctx.createGain(); ng.connect(sfxGain); env(ng, t, 0.004, 0.05, 0.05);
    noise(t, 0.05, ng, 2400, 500); // breath consonant
  }

  /* ---------- event voice-overs (speech synthesis, zero assets) ---------- */
  const saidAt = {};
  function say(text, prio) {
    if (!started || typeof speechSynthesis === 'undefined') return;
    const now = performance.now();
    if (saidAt[text] && now - saidAt[text] < 9000) return;
    saidAt[text] = now;
    try {
      if (speechSynthesis.speaking) {
        if (!prio) return;
        speechSynthesis.cancel();
      }
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95; u.pitch = 0.7; u.volume = 0.85;
      speechSynthesis.speak(u);
    } catch (e) { /* no voice support — silent fallback */ }
  }

  /* ---------- SFX ---------- */
  const lastSfx = {};
  function throttled(name, ms) { const n = performance.now(); if (lastSfx[name] && n - lastSfx[name] < ms) return true; lastSfx[name] = n; return false; }
  function sfx(name) {
    if (!ctx || !started) return;
    const t = ctx.currentTime;
    switch (name) {
      case 'click': { if (throttled('click', 60)) return;
        const g = ctx.createGain(); g.connect(sfxGain); env(g, t, 0.002, 0.15, 0.06);
        osc('square', 660, t, 0.07, g); break; }
      case 'clang': { if (throttled('clang', 90)) return;
        const g = ctx.createGain(); g.connect(sfxGain); env(g, t, 0.002, 0.12, 0.12);
        osc('square', 1900 + Math.random() * 700, t, 0.1, g);
        const ng = ctx.createGain(); ng.connect(sfxGain); env(ng, t, 0.001, 0.08, 0.08);
        noise(t, 0.08, ng, 6000, 1800); break; }
      case 'sword': { // bright steel ring with a shimmer tail
        if (throttled('sword', 110)) return;
        const f0 = 2100 + Math.random() * 500;
        for (const [mult, vol, dur] of [[1, 0.10, 0.22], [1.51, 0.06, 0.16], [2.26, 0.035, 0.1]]) {
          const g = ctx.createGain(); g.connect(sfxGain); env(g, t, 0.001, vol, dur);
          osc('triangle', f0 * mult, t, dur + 0.05, g).detune.value = Math.random() * 14 - 7;
        }
        const ng = ctx.createGain(); ng.connect(sfxGain); env(ng, t, 0.001, 0.07, 0.04);
        noise(t, 0.04, ng, 9000, 3000); break; }
      case 'spear': { // shaft whoosh into a dull body thud
        if (throttled('spear', 110)) return;
        const wg = ctx.createGain(); wg.connect(sfxGain); env(wg, t, 0.012, 0.09, 0.07);
        noise(t, 0.09, wg, 1400, 350);
        const g = ctx.createGain(); g.connect(sfxGain); env(g, t + 0.05, 0.003, 0.16, 0.1);
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(190, t + 0.05); o.frequency.exponentialRampToValueAtTime(70, t + 0.13);
        o.connect(g); o.start(t + 0.05); o.stop(t + 0.2); break; }
      case 'stomp': { // elephant: ground-shaking impact
        if (throttled('stomp', 160)) return;
        const g = ctx.createGain(); g.connect(sfxGain); env(g, t, 0.004, 0.3, 0.3);
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.22);
        o.connect(g); o.start(t); o.stop(t + 0.4);
        const ng = ctx.createGain(); ng.connect(sfxGain); env(ng, t, 0.002, 0.1, 0.12);
        noise(t, 0.12, ng, 700, 60); break; }
      case 'crossbow': { // mechanical clack + bolt hiss
        if (throttled('crossbow', 80)) return;
        const g = ctx.createGain(); g.connect(sfxGain); env(g, t, 0.001, 0.12, 0.05);
        osc('square', 820, t, 0.05, g);
        const ng = ctx.createGain(); ng.connect(sfxGain); env(ng, t + 0.015, 0.004, 0.09, 0.1);
        noise(t + 0.015, 0.1, ng, 4200, 1400); break; }
      case 'bowstring': { // string release twang (layered with arrow whoosh)
        if (throttled('bowstring', 80)) return;
        const g = ctx.createGain(); g.connect(sfxGain); env(g, t, 0.001, 0.07, 0.08);
        const o = ctx.createOscillator(); o.type = 'triangle';
        o.frequency.setValueAtTime(640, t); o.frequency.exponentialRampToValueAtTime(310, t + 0.07);
        o.connect(g); o.start(t); o.stop(t + 0.12); break; }
      case 'die': { // short falling cry
        if (throttled('die', 280)) return;
        const base = 150 + Math.random() * 60;
        const g = ctx.createGain(); g.connect(sfxGain); env(g, t, 0.02, 0.32, 0.3);
        const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 580; f1.Q.value = 3;
        const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1300; f2.Q.value = 4;
        f1.connect(g); f2.connect(g);
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(base, t);
        o.frequency.linearRampToValueAtTime(base * 0.55, t + 0.28);
        o.connect(f1); o.connect(f2); o.start(t); o.stop(t + 0.32); break; }
      case 'arrow': { if (throttled('arrow', 90)) return;
        const ng = ctx.createGain(); ng.connect(sfxGain); env(ng, t, 0.005, 0.1, 0.12);
        noise(t, 0.13, ng, 3200, 900); break; }
      case 'chop': { if (throttled('chop', 120)) return;
        const ng = ctx.createGain(); ng.connect(sfxGain); env(ng, t, 0.001, 0.14, 0.07);
        noise(t, 0.07, ng, 1300, 250); break; }
      case 'build': { if (throttled('build', 200)) return;
        const ng = ctx.createGain(); ng.connect(sfxGain); env(ng, t, 0.001, 0.12, 0.09);
        noise(t, 0.09, ng, 2000, 500);
        const g = ctx.createGain(); g.connect(sfxGain); env(g, t + 0.01, 0.002, 0.07, 0.05);
        osc('square', 440, t + 0.01, 0.05, g); break; }
      case 'trumpet': { // elephant
        const g = ctx.createGain(); g.connect(sfxGain); env(g, t, 0.04, 0.2, 0.5);
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(280, t); o.frequency.linearRampToValueAtTime(480, t + 0.18);
        o.frequency.linearRampToValueAtTime(330, t + 0.45);
        o.connect(g); o.start(t); o.stop(t + 0.7); break; }
      case 'boom': { if (throttled('boom', 150)) return;
        const g = ctx.createGain(); g.connect(sfxGain); env(g, t, 0.004, 0.3, 0.4);
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.3);
        o.connect(g); o.start(t); o.stop(t + 0.55);
        const ng = ctx.createGain(); ng.connect(sfxGain); env(ng, t, 0.002, 0.16, 0.3);
        noise(t, 0.3, ng, 1500); break; }
      case 'capture': case 'age': {
        const notes = name === 'age' ? [261, 329, 392, 523] : [329, 415, 494];
        notes.forEach((f, i) => {
          const g = ctx.createGain(); g.connect(sfxGain);
          env(g, t + i * 0.13, 0.01, 0.14, 0.4);
          osc('triangle', f, t + i * 0.13, 0.5, g);
          osc('sawtooth', f / 2, t + i * 0.13, 0.5, g).detune.value = 4;
        }); break; }
      case 'train': {
        const g = ctx.createGain(); g.connect(sfxGain); env(g, t, 0.01, 0.12, 0.2);
        osc('triangle', 523, t, 0.12, g); osc('triangle', 659, t + 0.1, 0.15, g); break; }
      case 'alert': { if (throttled('alert', 1800)) return;
        for (let i = 0; i < 2; i++) {
          const g = ctx.createGain(); g.connect(sfxGain); env(g, t + i * 0.22, 0.01, 0.16, 0.18);
          osc('square', 392, t + i * 0.22, 0.16, g);
        } break; }
      case 'victory': {
        [261, 329, 392, 523, 659].forEach((f, i) => {
          const g = ctx.createGain(); g.connect(sfxGain); env(g, t + i * 0.16, 0.01, 0.16, 0.6);
          osc('sawtooth', f, t + i * 0.16, 0.7, g); osc('triangle', f * 2, t + i * 0.16, 0.7, g);
        }); break; }
      case 'defeat': {
        [392, 349, 311, 261].forEach((f, i) => {
          const g = ctx.createGain(); g.connect(sfxGain); env(g, t + i * 0.3, 0.02, 0.15, 0.7);
          osc('sawtooth', f, t + i * 0.3, 0.8, g);
        }); break; }
    }
  }

  return { startMusic, stopMusic, setIntensity, setMood, startAmbient, ack, say, sfx, resume, ensure };
})();
