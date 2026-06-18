/* ============ CONQUERORS — procedural sprite factory ============
   Everything is drawn in code and cached: terrain, units (4 facings,
   walk/attack frames), buildings per-civ, icons. No external assets. */
'use strict';

const Sprites = (() => {
  const cache = new Map();
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function g2(c) { const g = c.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round'; return g; }

  /* ---------------- terrain tiles (64x32 diamonds) ---------------- */
  function bakeTile(t, variant) {
    const key = `tile${t}_${variant}`;
    if (cache.has(key)) return cache.get(key);
    const c = mk(64, 32), g = g2(c);
    const rnd = RNG(t * 97 + variant * 13 + 7);
    g.beginPath(); g.moveTo(32, 0); g.lineTo(64, 16); g.lineTo(32, 32); g.lineTo(0, 16); g.closePath();
    let base, det;
    if (t === TERRAIN.DEEP)      { base = ['#16345c', '#102849']; det = 'wave'; }
    else if (t === TERRAIN.SHALLOW){ base = ['#2e6e96', '#27608a']; det = 'wave'; }
    else if (t === TERRAIN.SAND) { base = ['#cdb279', '#c2a76e']; det = 'speck'; }
    else if (t === TERRAIN.DIRT) { base = ['#8a7148', '#7d663f']; det = 'speck'; }
    else if (t === TERRAIN.HILL) { base = ['#93a05a', '#7a8a4a']; det = 'hill'; }
    else if (t === TERRAIN.MOUNTAIN) { base = ['#8b8479', '#5e574e']; det = 'mountain'; }
    else { // grass: three palettes so meadows don't tile visibly
      base = [['#5d8a3c', '#527c33'], ['#587f37', '#4e7530'], ['#649144', '#578139']][variant % 3];
      det = 'grass';
    }
    const grad = g.createLinearGradient(0, 0, 0, 32);
    grad.addColorStop(0, base[0]); grad.addColorStop(1, base[1]);
    g.fillStyle = grad; g.fill();
    g.save(); g.clip();
    if (det === 'grass') {
      for (let i = 0; i < 26; i++) {
        const x = 4 + rnd() * 56, y = 3 + rnd() * 26;
        g.strokeStyle = rnd() > .5 ? 'rgba(120,170,80,.5)' : 'rgba(60,95,40,.45)';
        g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd() * 2 - 1, y - 2 - rnd() * 2); g.stroke();
      }
    } else if (det === 'speck') {
      for (let i = 0; i < 22; i++) {
        g.fillStyle = rnd() > .5 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.12)';
        g.fillRect(4 + rnd() * 56, 3 + rnd() * 26, 1.5, 1.5);
      }
    } else if (det === 'hill') {
      // rocky highland with relief shading
      for (let i = 0; i < 9; i++) {
        const x = 8 + rnd() * 48, y = 5 + rnd() * 22;
        g.fillStyle = rnd() > .5 ? 'rgba(160,158,140,.45)' : 'rgba(80,86,52,.4)';
        g.beginPath(); g.ellipse(x, y, 2.5 + rnd() * 2, 1.5 + rnd(), rnd(), 0, 7); g.fill();
      }
      g.strokeStyle = 'rgba(235,240,210,.35)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(2, 15); g.lineTo(32, 1); g.lineTo(62, 15); g.stroke(); // sunlit ridge
      g.strokeStyle = 'rgba(30,35,15,.30)'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(2, 17); g.lineTo(32, 31); g.lineTo(62, 17); g.stroke(); // shaded base
    } else if (det === 'mountain') {
      // craggy impassable rock — boulders & sharp crags
      for (let i = 0; i < 11; i++) {
        const x = 7 + rnd() * 50, y = 4 + rnd() * 24;
        g.fillStyle = rnd() > .5 ? 'rgba(184,180,170,.5)' : 'rgba(55,50,44,.5)';
        g.beginPath(); g.ellipse(x, y, 3 + rnd() * 3, 2 + rnd() * 2, rnd() * 3, 0, 7); g.fill();
      }
      g.fillStyle = '#9a9388'; g.strokeStyle = 'rgba(20,16,10,.45)'; g.lineWidth = .8;
      for (let i = 0; i < 3; i++) { const x = 12 + rnd() * 38, y = 11 + rnd() * 9;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y - 7 - rnd() * 4); g.lineTo(x + 9, y); g.closePath(); g.fill(); g.stroke(); }
    } else if (det === 'wave') {
      g.strokeStyle = t === TERRAIN.DEEP ? 'rgba(120,170,220,.18)' : 'rgba(200,235,255,.30)';
      g.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const y = 7 + i * 8 + rnd() * 4, x = 6 + rnd() * 20;
        g.beginPath(); g.moveTo(x, y);
        g.quadraticCurveTo(x + 7, y - 2.5, x + 14, y); g.quadraticCurveTo(x + 21, y + 2.5, x + 28, y);
        g.stroke();
      }
      if (t === TERRAIN.SHALLOW) { // sandy glow through shallow water
        g.fillStyle = 'rgba(205,178,121,.18)'; g.beginPath();
        g.ellipse(32, 18, 22, 9, 0, 0, 7); g.fill();
      }
    }
    // (no per-tile edge stroke — keeps meadows seamless instead of a visible grid)
    g.restore();
    cache.set(key, c); return c;
  }

  /* ---------------- world objects ---------------- */
  function bakeObj(kind, variant) {
    const key = `obj_${kind}_${variant}`;
    if (cache.has(key)) return cache.get(key);
    let c, g, rnd = RNG(kind.length * 31 + variant * 7 + 3);
    const shadow = (g, x, y, rx, ry) => { g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
    if (kind === 'tree') {
      c = mk(64, 84); g = g2(c); shadow(g, 32, 78, 16, 6);
      if (variant % 4 === 2) { // birch — pale bark, airy light foliage
        g.fillStyle = '#e3ded2'; g.strokeStyle = '#9a948a'; g.lineWidth = 1;
        g.fillRect(29.5, 44, 5, 34); g.strokeRect(29.5, 44, 5, 34);
        g.fillStyle = '#3a352c';
        for (let i = 0; i < 6; i++) g.fillRect(29.5 + (i % 2) * 2.4, 48 + i * 5, 2.4, 1.6);
        for (const [x, y, r] of [[32, 30, 15], [22, 38, 10], [42, 37, 10]]) {
          const gr2 = g.createRadialGradient(x - r * .4, y - r * .4, r * .2, x, y, r);
          gr2.addColorStop(0, '#9fc25a'); gr2.addColorStop(1, '#5d8a3c');
          g.fillStyle = gr2; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        }
        for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(230,245,180,.5)'; g.fillRect(20 + rnd() * 24, 24 + rnd() * 20, 2, 2); }
        cache.set(key, { cv: c, ax: 32, ay: 78 }); return cache.get(key);
      }
      if (variant % 2 === 0) { // oak
        g.fillStyle = '#5d4426'; g.strokeStyle = '#3a2a16'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(29, 78); g.quadraticCurveTo(30, 58, 27, 48); g.lineTo(36, 48);
        g.quadraticCurveTo(34, 60, 35, 78); g.closePath(); g.fill(); g.stroke();
        const blobs = [[32, 32, 19], [20, 42, 13], [45, 41, 13], [32, 47, 14]];
        for (const [x, y, r] of blobs) {
          const gr = g.createRadialGradient(x - r * .4, y - r * .4, r * .2, x, y, r);
          gr.addColorStop(0, '#6fa343'); gr.addColorStop(1, '#3c6323');
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        }
        for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(190,225,130,.35)'; g.fillRect(16 + rnd() * 30, 22 + rnd() * 24, 2, 2); }
      } else { // pine
        g.fillStyle = '#54391f'; g.fillRect(29, 58, 6, 20);
        for (let i = 0; i < 3; i++) {
          const w = 26 - i * 6, y = 62 - i * 16;
          const gr = g.createLinearGradient(32 - w, y, 32 + w, y);
          gr.addColorStop(0, '#2e5526'); gr.addColorStop(.5, '#477d36'); gr.addColorStop(1, '#24441e');
          g.fillStyle = gr; g.beginPath();
          g.moveTo(32, y - 22); g.lineTo(32 + w, y); g.lineTo(32 - w, y); g.closePath(); g.fill();
        }
      }
      cache.set(key, { cv: c, ax: 32, ay: 78 }); return cache.get(key);
    }
    if (kind === 'bush') {
      c = mk(48, 40); g = g2(c); shadow(g, 24, 35, 14, 5);
      for (const [x, y, r] of [[24, 24, 13], [14, 28, 9], [34, 28, 9]]) {
        const gr = g.createRadialGradient(x - 3, y - 3, 2, x, y, r);
        gr.addColorStop(0, '#4f8a35'); gr.addColorStop(1, '#2f5520');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
      for (let i = 0; i < 9; i++) { g.fillStyle = '#c92f4c'; g.beginPath(); g.arc(10 + rnd() * 28, 18 + rnd() * 14, 1.8, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(9.6 + rnd() * 0, 0, 0, 0); }
      cache.set(key, { cv: c, ax: 24, ay: 35 }); return cache.get(key);
    }
    if (kind === 'gold' || kind === 'stone' || kind === 'iron') {
      c = mk(60, 44); g = g2(c); shadow(g, 30, 39, 20, 6);
      const P = kind === 'gold' ? { rl: '#8a8068', rd: '#5d553f', vein: '#ffd24a', glow: 'rgba(255,210,80,.45)', nug: '#ffe07a', glint: '#fff7d6' }
              : kind === 'iron' ? { rl: '#726a60', rd: '#433d35', vein: '#c2603a', glow: 'rgba(180,90,50,.4)', nug: '#9a5236', glint: '#d98b63' }
              :                    { rl: '#a39c90', rd: '#6f6a60', vein: null, glow: null, nug: '#c2bcae', glint: '#e8e2d4' };
      // ---- clustered rocky ore deposit: overlapping faceted boulders ----
      for (const [x, y, r] of [[21, 28, 12], [39, 30, 10], [30, 20, 11], [30, 34, 7]]) {
        const gr = g.createLinearGradient(x, y - r, x, y + r);
        gr.addColorStop(0, P.rl); gr.addColorStop(1, P.rd);
        g.fillStyle = gr; g.strokeStyle = 'rgba(15,12,8,.5)'; g.lineWidth = 1.1;
        g.beginPath();
        g.moveTo(x - r, y + r * .4); g.lineTo(x - r * .6, y - r * .8); g.lineTo(x + r * .5, y - r);
        g.lineTo(x + r, y + r * .2); g.lineTo(x + r * .4, y + r * .7); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.10)'; // top facet highlight
        g.beginPath(); g.moveTo(x - r * .6, y - r * .8); g.lineTo(x + r * .5, y - r); g.lineTo(x + r * .1, y - r * .2); g.closePath(); g.fill();
      }
      // ---- ore veins + glinting nuggets ----
      if (P.vein) {
        const rv = RNG(kind === 'gold' ? 7 : 9); g.lineCap = 'round';
        for (let i = 0; i < 5; i++) { const x0 = 16 + rv() * 30, y0 = 18 + rv() * 16, x1 = x0 + 6 - rv() * 12, y1 = y0 + 5 + rv() * 4;
          g.strokeStyle = P.glow; g.lineWidth = 3.4; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
          g.strokeStyle = P.vein; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
        for (let i = 0; i < 8; i++) { const x = 15 + rv() * 30, y = 17 + rv() * 18;
          g.fillStyle = P.nug; g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill();
          g.fillStyle = P.glint; g.fillRect(x - 1.2, y - 1.4, 1.3, 1.3); }
      } else { // stone: pale chips
        const rv = RNG(5); for (let i = 0; i < 6; i++) { g.fillStyle = P.glint; g.fillRect(16 + rv() * 28, 20 + rv() * 14, 2, 2); }
      }
      // a loose ore chunk at the foot of the deposit
      g.fillStyle = P.rd; g.strokeStyle = 'rgba(15,12,8,.5)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(45, 38, 4, 2.6, .3, 0, 7); g.fill(); g.stroke();
      if (P.vein) { g.fillStyle = P.vein; g.beginPath(); g.arc(45, 37.4, 1.2, 0, 7); g.fill(); }
      cache.set(key, { cv: c, ax: 30, ay: 38 }); return cache.get(key);
    }
    if (kind === 'fish') {
      // More visible fish — bright silver-blue body with orange dorsal, visible tail
      c = mk(64, 36); g = g2(c);
      const v2 = (variant || 0) % 3;
      const bodyCol = v2 === 0 ? '#a8d4e8' : v2 === 1 ? '#7ec8a0' : '#e8b870';
      const finCol  = v2 === 0 ? '#e86030' : v2 === 1 ? '#e07030' : '#c03820';
      const shimmer = v2 === 0 ? '#d0eef8' : v2 === 1 ? '#b0e4c8' : '#f8d890';
      // body shadow
      g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(32, 29, 16, 4, .2, 0, 7); g.fill();
      // tail fin
      g.fillStyle = finCol;
      g.beginPath(); g.moveTo(10, 18); g.lineTo(4, 11); g.lineTo(4, 25); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(20,12,6,.3)'; g.lineWidth = 1; g.stroke();
      // body
      const bg = g.createLinearGradient(12, 12, 12, 26);
      bg.addColorStop(0, shimmer); bg.addColorStop(0.5, bodyCol); bg.addColorStop(1, bodyCol + 'bb');
      g.fillStyle = bg;
      g.beginPath(); g.ellipse(30, 19, 20, 9, .12, 0, 7); g.fill();
      g.strokeStyle = 'rgba(20,12,6,.28)'; g.lineWidth = 1; g.stroke();
      // dorsal fin
      g.fillStyle = finCol;
      g.beginPath(); g.moveTo(24, 11); g.quadraticCurveTo(32, 5, 40, 11); g.lineTo(40, 14); g.quadraticCurveTo(32, 12, 24, 14); g.closePath(); g.fill();
      // scales (3 arcs)
      g.strokeStyle = 'rgba(80,120,160,.35)'; g.lineWidth = 1;
      for (const [sx, sy] of [[22, 19], [30, 18], [38, 20]]) {
        g.beginPath(); g.arc(sx, sy + 4, 5, Math.PI * 1.1, Math.PI * 0.1); g.stroke();
      }
      // eye
      g.fillStyle = '#1a1209'; g.beginPath(); g.arc(46, 18, 2.6, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(47, 17, 1, 0, 7); g.fill();
      // mouth
      g.strokeStyle = 'rgba(20,12,6,.4)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(50, 19); g.lineTo(52, 18); g.stroke();
      // pectoral fin
      g.fillStyle = finCol + 'cc';
      g.beginPath(); g.moveTo(40, 20); g.quadraticCurveTo(46, 24, 44, 28); g.lineTo(38, 23); g.closePath(); g.fill();
      cache.set(key, { cv: c, ax: 32, ay: 22 }); return cache.get(key);
    }
    if (kind === 'palm') {
      c = mk(72, 92); g = g2(c); shadow(g, 36, 86, 17, 6);
      // curved trunk
      g.strokeStyle = '#9c7e54'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(30, 86); g.quadraticCurveTo(34, 56, 44, 36); g.stroke();
      g.strokeStyle = 'rgba(90,66,38,.5)'; g.lineWidth = 1.4;
      for (let i = 0; i < 6; i++) { const t2 = i / 6;
        const x = 30 + (34 - 30) * t2 * 2 + (44 - 34) * t2 * t2, y = 86 - 50 * t2;
        g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + 3, y - 1); g.stroke(); }
      // fronds
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI * 0.95 + i * Math.PI * 0.38;
        const fx = 44 + Math.cos(a) * 22, fy = 34 + Math.sin(a) * 13;
        const gr2 = g.createLinearGradient(44, 34, fx, fy);
        gr2.addColorStop(0, '#4f8a35'); gr2.addColorStop(1, '#2f5520');
        g.strokeStyle = gr2; g.lineWidth = 4.2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(44, 35); g.quadraticCurveTo(44 + Math.cos(a) * 13, 33 + Math.sin(a) * 6 - 5, fx, fy + 5); g.stroke();
      }
      g.fillStyle = '#6e5638'; // coconuts
      for (const [cx2, cy2] of [[41, 38], [47, 39]]) { g.beginPath(); g.arc(cx2, cy2, 3, 0, 7); g.fill(); }
      cache.set(key, { cv: c, ax: 34, ay: 86 }); return cache.get(key);
    }
    if (kind === 'flower') {
      c = mk(26, 22); g = g2(c);
      const cols = [['#e85f5f', '#ffd34d'], ['#ffd34d', '#fff'], ['#b58cff', '#fff'], ['#ff9d4d', '#ffe9b0']][variant % 4];
      g.strokeStyle = '#4e7530'; g.lineWidth = 1;
      for (let i = 0; i < 4; i++) { const x = 4 + rnd() * 18, y = 16;
        g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x + rnd() * 2 - 1, y - 3); g.stroke();
        g.fillStyle = cols[0];
        for (let p2 = 0; p2 < 5; p2++) { const a = p2 / 5 * 7;
          g.beginPath(); g.ellipse(x + Math.cos(a) * 2, y - 4 + Math.sin(a) * 2, 1.5, 1, a, 0, 7); g.fill(); }
        g.fillStyle = cols[1]; g.beginPath(); g.arc(x, y - 4, 1.2, 0, 7); g.fill();
      }
      cache.set(key, { cv: c, ax: 13, ay: 19 }); return cache.get(key);
    }
    if (kind === 'rock') {
      c = mk(30, 20); g = g2(c); shadow(g, 15, 16, 9, 3);
      for (const [x, y, r] of [[11, 11, 6], [20, 13, 4]]) {
        const gr2 = g.createLinearGradient(x - r, y - r, x + r, y + r);
        gr2.addColorStop(0, '#b3aca0'); gr2.addColorStop(1, '#7a746a');
        g.fillStyle = gr2; g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x - r, y + r * .4); g.lineTo(x - r * .4, y - r); g.lineTo(x + r * .6, y - r * .7); g.lineTo(x + r, y + r * .4); g.closePath();
        g.fill(); g.stroke();
      }
      cache.set(key, { cv: c, ax: 15, ay: 16 }); return cache.get(key);
    }
    if (kind === 'reed') {
      c = mk(26, 36); g = g2(c);
      for (let i = 0; i < 5; i++) {
        const x = 4 + i * 4.5 + rnd() * 2, lean = rnd() * 4 - 2;
        g.strokeStyle = i % 2 ? '#6b8a3f' : '#8aa050'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x, 33); g.quadraticCurveTo(x + lean, 20, x + lean * 1.6, 8 + rnd() * 5); g.stroke();
        if (i % 2 === 0) { g.fillStyle = '#6e5638';
          g.beginPath(); g.ellipse(x + lean * 1.6, 8 + rnd() * 4, 1.6, 4, lean * .1, 0, 7); g.fill(); }
      }
      cache.set(key, { cv: c, ax: 13, ay: 33 }); return cache.get(key);
    }
    if (kind === 'mushroom') {
      c = mk(20, 16); g = g2(c);
      for (const [x, y, r, col] of [[7, 10, 4, '#c0392b'], [14, 12, 3, '#b08968']]) {
        g.fillStyle = '#e8e0ce'; g.fillRect(x - 1.2, y - 1, 2.4, 5);
        g.fillStyle = col; g.beginPath(); g.arc(x, y - 1, r, Math.PI, 0); g.fill();
        if (col === '#c0392b') { g.fillStyle = '#fff';
          g.fillRect(x - 2, y - 3.4, 1.4, 1.4); g.fillRect(x + 1, y - 2.8, 1.2, 1.2); }
      }
      cache.set(key, { cv: c, ax: 10, ay: 15 }); return cache.get(key);
    }
    if (kind === 'carcass') {
      c = mk(40, 28); g = g2(c); shadow(g, 20, 22, 13, 4);
      // a side of meat with ribs + a rising scent wisp
      const gr = g.createRadialGradient(18, 14, 2, 20, 16, 12);
      gr.addColorStop(0, '#b5523f'); gr.addColorStop(1, '#7a2f24');
      g.fillStyle = gr; g.strokeStyle = 'rgba(40,12,8,.5)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(20, 16, 12, 7, .15, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = '#e7d8b8'; g.lineWidth = 1.2; // exposed ribs
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(15 + i * 4, 11); g.quadraticCurveTo(16 + i * 4, 18, 14 + i * 4, 21); g.stroke(); }
      g.fillStyle = '#caa27a'; g.beginPath(); g.ellipse(31, 14, 3.5, 2.4, .4, 0, 7); g.fill(); // hide scrap
      cache.set(key, { cv: c, ax: 20, ay: 22 }); return cache.get(key);
    }
    if (kind === 'ruin') {
      c = mk(64, 56); g = g2(c); shadow(g, 32, 50, 20, 6);
      g.fillStyle = '#b5ad9c'; g.strokeStyle = '#6e6757'; g.lineWidth = 1;
      for (const [x, h] of [[18, 26], [30, 14], [44, 32]]) {
        g.fillRect(x - 4, 48 - h, 8, h); g.strokeRect(x - 4, 48 - h, 8, h);
        g.fillRect(x - 6, 48 - h - 4, 12, 4);
      }
      g.fillStyle = '#9a9384'; g.fillRect(10, 48, 44, 4);
      cache.set(key, { cv: c, ax: 32, ay: 50 }); return cache.get(key);
    }
    return null;
  }

  /* ---------------- humanoid painter ----------------
     dir: 0 front, 1 left(side), 2 back.  anim: idle|walk|attack. */
  const SKIN = { rome: '#d9a878', china: '#e0b184', india: '#a8714a', none: '#caa27a' };
  function teamCols(idx) { return idx < 0 ? GAIA_COLOR : PLAYER_COLORS[idx]; }

  const UNIT_VIS = {
    settler:  { tunic: '#9a7b54', helmet: 'straw', weapon: 'axe',     shield: 'none'  },
    spearman: { tunic: 'team',    helmet: 'cap',   weapon: 'spear',   shield: 'round' },
    archer:   { tunic: '#5d6e46', helmet: 'hood',  weapon: 'bow',     shield: 'none'  },
    crossbow: { tunic: '#6a5a3a', helmet: 'metal', weapon: 'crossbow',shield: 'none'  },
    longbow:  { tunic: '#3f6b3a', helmet: 'hood',  weapon: 'bow',     shield: 'none'  },
    sword:    { tunic: 'team',    helmet: 'metal', weapon: 'sword',   shield: 'kite'  },
    legionary:{ tunic: 'team',    helmet: 'galea', weapon: 'sword',   shield: 'scutum'},
    centurion:{ tunic: 'team',    helmet: 'crest', weapon: 'sword',   shield: 'scutum', cape: '#a32626' },
    chukonu:  { tunic: 'team',    helmet: 'cone',  weapon: 'crossbow',shield: 'none'  },
    trader:   { tunic: '#7a5d8a', helmet: 'turban',weapon: 'staff',   shield: 'none', pack: true },
  };

  // Civilization-specific visual overrides — applied over UNIT_VIS when civ matches
  const CIV_UNIT_VIS = {
    china: {
      settler:  { tunic: '#7a6840', helmet: 'cone',  weapon: 'axe',     shield: 'none' },
      spearman: { tunic: '#1e4272', helmet: 'cone',  weapon: 'spear',   shield: 'round' },
      archer:   { tunic: '#1a3854', helmet: 'cone',  weapon: 'bow',     shield: 'none' },
      crossbow: { tunic: '#223050', helmet: 'cone',  weapon: 'crossbow',shield: 'none' },
      longbow:  { tunic: '#162a40', helmet: 'cone',  weapon: 'bow',     shield: 'none' },
      sword:    { tunic: '#2a204e', helmet: 'metal', weapon: 'sword',   shield: 'kite' },
    },
    india: {
      settler:  { tunic: '#a07848', helmet: 'straw', weapon: 'axe',     shield: 'none' },
      spearman: { tunic: '#7a3c16', helmet: 'metal', weapon: 'spear',   shield: 'round' },
      archer:   { tunic: '#5c2e14', helmet: 'hood',  weapon: 'bow',     shield: 'none' },
      crossbow: { tunic: '#5a2e10', helmet: 'metal', weapon: 'crossbow',shield: 'none' },
      longbow:  { tunic: '#4a2410', helmet: 'hood',  weapon: 'bow',     shield: 'none' },
      sword:    { tunic: '#6e3a16', helmet: 'turban',weapon: 'sword',   shield: 'kite' },
    },
  };

  /* The humanoid is drawn parametrically from a facing vector:
     fx: -1 = facing screen-left … 0 = frontal … +1 = screen-right
     fy: +1 = toward the viewer (front) … -1 = away (back).
     unit() drives this from any of 24 directions (right-facing ones are mirrored). */
  function drawHumanoid(g, type, colorIdx, civ, fx, fy, anim, fr, tool) {
    const baseV = UNIT_VIS[type] || UNIT_VIS.spearman;
    const civV = (CIV_UNIT_VIS[civ] || {})[type];
    const v = civV || baseV;
    const weapon = tool || v.weapon;       // settlers swap tools by task
    const tc = teamCols(colorIdx);
    const skin = SKIN[civ] || SKIN.none;
    const tunic = v.tunic === 'team' ? tc.main : v.tunic;
    const tunicD = v.tunic === 'team' ? tc.dark : null;
    const away = fy < -0.3;                // facing away from the viewer
    const sideAmt = Math.abs(fx);          // 0 frontal .. 1 full profile
    const prof = sideAmt >= 0.5;           // profile-ish: use side-style weapons
    // facing direction in screen space (iso vertical is half scale)
    let dnx = fx, dny = fy * 0.5;
    const dl = Math.hypot(dnx, dny) || 1; dnx /= dl; dny /= dl;

    // pose params ('work' = gather/build, swings like a softer attack)
    let swing = 0, lunge = 0, raise = 0, atkStep = 0;
    if (anim === 'walk') swing = Math.sin(fr / 4 * Math.PI * 2) * 0.7;
    if (anim === 'attack' || anim === 'work') {
      const amp = anim === 'work' ? 0.7 : 1;
      // wind up (fr0) → drive through (fr1) → recover (fr2): bigger, snappier than before
      lunge = (fr === 1 ? 5.2 : fr === 0 ? -2.6 : 1) * amp;
      raise = (fr === 0 ? 1.35 : fr === 1 ? -0.95 : 0.3) * amp;
      if (anim === 'attack') atkStep = (fr === 1 ? 4 : fr === 0 ? -1.5 : 1.5); // lead foot drives forward on the blow
    }
    const GY = 52, hipY = 36;
    const hipX = 24 + dnx * lunge;         // attack lunge leans toward the facing
    const shY = hipY - 13;
    const armY = shY + 2.5;
    const tw = 6.5 - sideAmt;              // torso half-width (narrower in profile)
    // weapon hand: leading hand in profile, right hand when frontal
    const wx = hipX + fx * 8 + (1 - sideAmt) * 6.5;
    const wy = armY + 5 - raise * 3;

    g.save();
    // shadow
    g.fillStyle = 'rgba(0,0,0,.30)'; g.beginPath(); g.ellipse(24, GY, 9, 3.4, 0, 0, 7); g.fill();

    // ----- legs: stride along the facing axis, stance across it -----
    for (const s of [-1, 1]) {
      const a = swing * s;
      const stepX = dnx * Math.sin(a) * 9, stepY = dny * Math.sin(a) * 4.5;
      const stanceX = -dny * s * 3.4 * (1 - sideAmt * 0.55);
      const stanceY = dnx * s * 1.4;
      const stepF = (atkStep && s > 0) ? atkStep : 0;   // lead foot lunges forward on the swing
      const fx2 = hipX + stanceX + stepX + dnx * stepF;
      const fy2 = GY - 1.2 + stanceY + stepY + dny * stepF;
      g.strokeStyle = s < 0 ? '#332a1e' : '#46392a';
      g.lineWidth = 3.6;
      g.beginPath(); g.moveTo(hipX + stanceX * 0.4, hipY); g.lineTo(fx2, fy2); g.stroke();
      g.fillStyle = s < 0 ? '#241c12' : '#33281a';
      g.beginPath(); g.roundRect(fx2 - 2.8 + dnx * 1.4, fy2 - 2.2, 5.6, 2.8, 1.1); g.fill();
    }

    // ----- cape & pack: hang on the side away from the facing -----
    if (v.cape && !away && sideAmt > 0.2) { // trailing behind the body
      g.fillStyle = v.cape; g.beginPath();
      g.moveTo(hipX - fx * 2, shY + 1); g.quadraticCurveTo(hipX - fx * 9, hipY - 2, hipX - fx * 7, hipY + 6);
      g.lineTo(hipX - fx * 2, hipY + 4); g.closePath(); g.fill();
    }
    if (v.pack && !away) { g.fillStyle = '#6e5638';
      g.beginPath(); g.ellipse(hipX - fx * 5.5, hipY - 12, 5.5, 7.5, -fx * .3, 0, 7); g.fill(); }

    // ----- torso -----
    let grd = g.createLinearGradient(hipX - tw, shY, hipX + tw, hipY);
    grd.addColorStop(0, tunic); grd.addColorStop(1, tunicD || tunic);
    g.fillStyle = grd; g.strokeStyle = 'rgba(20,12,6,.55)'; g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(hipX - tw, shY); g.lineTo(hipX + tw, shY);
    g.lineTo(hipX + tw - 1.4, hipY + 2); g.lineTo(hipX - tw + 1.4, hipY + 2);
    g.closePath(); g.fill(); g.stroke();
    if (away) { // shaded back
      g.fillStyle = 'rgba(20,12,6,.18)';
      g.beginPath(); g.moveTo(hipX - tw + 1, shY + 1); g.lineTo(hipX + tw - 1, shY + 1);
      g.lineTo(hipX + tw - 2.2, hipY); g.lineTo(hipX - tw + 2.2, hipY); g.closePath(); g.fill();
    }
    if (v.tunic === 'team' && tunicD) { // belt + shoulder pauldron
      g.fillStyle = '#8a6420'; g.fillRect(hipX - tw + 1, hipY - 2.5, tw * 2 - 2, 2.2);
      g.fillStyle = tc.light; g.strokeStyle = 'rgba(20,12,6,.5)'; g.lineWidth = 1;
      g.beginPath(); g.arc(hipX + (fx !== 0 ? fx : 1) * (tw - 0.8), shY + 1.2, 2.4, 0, 7); g.fill(); g.stroke();
    }
    // pteruges skirt for legion types
    if (v.helmet === 'galea' || v.helmet === 'crest') {
      g.fillStyle = '#7d6235';
      for (let i = -2; i <= 2; i++) g.fillRect(hipX + i * 2.4 - 1, hipY, 2, 4.5);
    }
    // cape / pack seen from behind: drape over the torso
    if (v.cape && away) {
      g.fillStyle = v.cape; g.beginPath();
      g.moveTo(hipX - tw + .5, shY + .5); g.lineTo(hipX + tw - .5, shY + .5);
      g.quadraticCurveTo(hipX + tw, hipY + 4, hipX + 1, hipY + 7);
      g.quadraticCurveTo(hipX - tw, hipY + 4, hipX - tw + .5, shY + .5);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(20,12,6,.4)'; g.stroke();
    }
    if (v.pack && away) { g.fillStyle = '#6e5638';
      g.beginPath(); g.ellipse(hipX, hipY - 11, 5.8, 7.5, 0, 0, 7); g.fill();
      g.strokeStyle = '#4e3c24'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(hipX - 5, hipY - 15); g.lineTo(hipX + 5, hipY - 8); g.stroke(); }

    // ----- head -----
    const hx = hipX + fx * 2.5, hy = shY - 7;
    g.fillStyle = skin; g.beginPath(); g.arc(hx, hy, 5.4, 0, 7); g.fill();
    if (fy > 0.25) { // eyes shift toward the facing
      g.fillStyle = '#241a10';
      g.fillRect(hx - 2.6 + fx * 1.4, hy - 1, 1.6, 1.8);
      g.fillRect(hx + 1.2 + fx * 1.4, hy - 1, 1.6, 1.8);
    }
    // helmet
    g.lineWidth = 1.1;
    switch (v.helmet) {
      case 'straw': g.fillStyle = '#cdb279'; g.beginPath(); g.ellipse(hx, hy - 3, 7.5, 2.6, 0, 0, 7); g.fill();
        g.beginPath(); g.arc(hx, hy - 4, 4, Math.PI, 0); g.fill(); break;
      case 'cap': g.fillStyle = '#6e5638'; g.beginPath(); g.arc(hx, hy - 1.5, 5.6, Math.PI, 0); g.fill(); break;
      case 'metal': g.fillStyle = '#9aa2ad'; g.beginPath(); g.arc(hx, hy - 1.5, 5.7, Math.PI, 0); g.fill();
        g.fillRect(hx - 5.7, hy - 1.8, 11.4, 1.6); break;
      case 'galea': case 'crest': {
        g.fillStyle = '#aab3bf'; g.beginPath(); g.arc(hx, hy - 1, 5.8, Math.PI * .95, Math.PI * 0.05); g.fill();
        g.fillRect(hx - 5.8, hy - 1.4, 11.6, 2.2);
        if (prof) g.fillRect(hx + fx * 6.5 - 1.2, hy - .5, 2.4, 4.5); // cheek guard, leading side
        if (away) { g.fillStyle = '#8d96a3'; g.fillRect(hx - 4.5, hy - .8, 9, 3.6); } // neck guard
        if (v.helmet === 'crest' || type === 'centurion') { g.fillStyle = '#c22020';
          if (prof) g.fillRect(hx - 6, hy - 9.5, 12, 3.4);
          else { g.beginPath(); g.ellipse(hx, hy - 8.5, 7, 2.8, 0, 0, 7); g.fill(); } }
        else { g.fillStyle = tc.main; // galea plume sweeps back, away from the facing
          g.beginPath(); g.moveTo(hx - fx * 1.2, hy - 6);
          g.quadraticCurveTo(hx - fx * 6, hy - 12, hx - fx * 7 + (fx === 0 ? 1.2 : 0), hy - 6);
          g.closePath(); g.fill(); }
        break; }
      case 'hood': g.fillStyle = '#46552f'; g.beginPath(); g.arc(hx, hy - 1, 6, Math.PI * .9, Math.PI * .1); g.fill();
        g.beginPath(); g.moveTo(hx - 5.5, hy); g.lineTo(hx + 5.5, hy); g.lineTo(hx + 3, hy + 4); g.lineTo(hx - 3, hy + 4); g.closePath(); g.fill(); break;
      case 'cone': g.fillStyle = '#b8924a'; g.beginPath(); g.moveTo(hx - 7, hy - 2); g.lineTo(hx + 7, hy - 2); g.lineTo(hx, hy - 9); g.closePath(); g.fill(); break;
      case 'turban': g.fillStyle = '#e8e0ce'; g.beginPath(); g.ellipse(hx, hy - 3, 6, 4.4, 0, 0, 7); g.fill();
        g.strokeStyle = '#b8a784'; g.beginPath(); g.moveTo(hx - 5, hy - 4); g.quadraticCurveTo(hx, hy - 1, hx + 5, hy - 4); g.stroke(); break;
    }
    // civ-specific helmet accents
    if (civ === 'china' && v.helmet === 'cone') {
      g.fillStyle = '#c82828'; // lacquer-red band
      g.fillRect(hx - 7, hy - 3.5, 14, 2.2);
      g.strokeStyle = '#8a1a1a'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(hx - 7, hy - 3.5); g.lineTo(hx + 7, hy - 3.5); g.stroke();
    }
    if (civ === 'china') { // red sash accent on torso
      g.fillStyle = '#c82828'; g.fillRect(hipX - tw + 1, hipY - 4, tw * 2 - 2, 2);
    }
    if (civ === 'india' && v.helmet === 'turban') {
      g.fillStyle = '#e8c84a'; g.beginPath(); g.arc(hx, hy - 6.5, 2, 0, 7); g.fill(); // gem
      g.fillStyle = '#2ab8d8'; g.beginPath(); g.arc(hx, hy - 6.5, 1.1, 0, 7); g.fill(); // gem facet
    }
    if (civ === 'india' && v.helmet === 'metal') {
      g.strokeStyle = '#e8c84a'; g.lineWidth = 1.1; // gold trim on helmet
      g.beginPath(); g.arc(hx, hy - 1.5, 5.7, Math.PI, 0); g.stroke();
    }
    if (civ === 'india') { // saffron sash
      g.fillStyle = '#e87a1a'; g.fillRect(hipX - tw + 1, hipY - 4, tw * 2 - 2, 2);
    }

    // ----- weapon & arms -----
    g.strokeStyle = skin; g.lineWidth = 3;
    // support arm (opposite the weapon)
    if (!prof || v.shield === 'none') {
      g.beginPath(); g.moveTo(hipX - fx * 3 - (1 - sideAmt) * 6, armY);
      g.lineTo(hipX - fx * 5 - (1 - sideAmt) * 8, armY + 7); g.stroke();
    }
    // weapon arm
    g.beginPath(); g.moveTo(hipX + fx * 3 + (1 - sideAmt) * 6, armY); g.lineTo(wx, wy); g.stroke();

    const side = prof; // weapon renderers below use profile styling when true
    g.lineWidth = 2;
    switch (weapon) {
      case 'pick': { // miner's pickaxe — angled twin head
        const a = side ? (-2.3 + raise * 2.8) : (-1.2 + raise * 2.4);
        g.save(); g.translate(wx, wy); g.rotate(a);
        g.strokeStyle = '#6e5638'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 3); g.lineTo(0, -12); g.stroke();
        g.strokeStyle = '#9aa3ad'; g.lineWidth = 2.6;
        g.beginPath(); g.moveTo(-7, -15); g.quadraticCurveTo(0, -11, 7, -15); g.stroke();
        g.restore(); break; }
      case 'hammer': { // builder's mallet
        const a = side ? (-2.1 + raise * 2.6) : (-1.1 + raise * 2.2);
        g.save(); g.translate(wx, wy); g.rotate(a);
        g.strokeStyle = '#6e5638'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 3); g.lineTo(0, -11); g.stroke();
        g.fillStyle = '#8a8e95'; g.fillRect(-4.5, -15, 9, 5); g.strokeStyle = 'rgba(20,12,6,.5)'; g.lineWidth = 1; g.strokeRect(-4.5, -15, 9, 5);
        g.restore(); break; }
      case 'knife': { // hunter's skinning knife (point-blank on a boar)
        const a = side ? (-1.8 + raise * 1.6) : (-1.0 + raise * 1.4);
        g.save(); g.translate(wx, wy); g.rotate(a);
        g.fillStyle = '#d7dde4'; g.beginPath(); g.moveTo(-1.2, 0); g.lineTo(1.2, 0); g.lineTo(0.4, -8); g.lineTo(-0.4, -8); g.closePath(); g.fill();
        g.fillStyle = '#5d4426'; g.fillRect(-1.6, 0, 3.2, 3);
        g.restore(); break; }
      case 'forage': { // bare-handed berry/crop picking — reach down to a basket
        const reach = 6 + raise * 4;
        g.strokeStyle = skin; g.lineWidth = 2.6; // hand reaching toward the ground
        g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + fx * 2, wy + reach); g.stroke();
        g.fillStyle = '#9c7e54'; g.strokeStyle = '#5d4426'; g.lineWidth = 1; // wicker basket
        g.beginPath(); g.ellipse(hipX + fx * 5, hipY + 9, 5, 3.2, 0, 0, 7); g.fill(); g.stroke();
        g.strokeStyle = '#7d6342'; g.beginPath(); g.arc(hipX + fx * 5, hipY + 7, 5, Math.PI, 0); g.stroke();
        g.fillStyle = '#c92f4c'; for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(hipX + fx * 5 + i * 2.2, hipY + 7.5, 1.1, 0, 7); g.fill(); }
        break; }
      case 'hoe': { // farmer tilling — long handle swung down into the soil in front
        const a = side ? (-2.5 + raise * 1.7) : (-1.8 + raise * 1.5); // down-chop arc
        g.save(); g.translate(wx, wy); g.rotate(a);
        g.strokeStyle = '#7d5a2e'; g.lineWidth = 2.2; // wooden handle
        g.beginPath(); g.moveTo(0, 2); g.lineTo(0, -17); g.stroke();
        g.fillStyle = '#8a8f98'; g.strokeStyle = 'rgba(20,12,6,.5)'; g.lineWidth = .8; // iron head, bent forward
        g.beginPath(); g.moveTo(-1.4, -17); g.lineTo(6, -16); g.lineTo(6, -13); g.lineTo(-1.4, -13.5); g.closePath(); g.fill(); g.stroke();
        g.restore(); break; }
      case 'spear': {
        g.strokeStyle = '#6e5638'; g.lineWidth = 2.2;
        const ext = anim === 'attack' ? (fr === 1 ? 13 : fr === 0 ? -3 : 4) : 0; // thrust!
        if (side) { g.beginPath(); g.moveTo(wx + 12, wy + 3); g.lineTo(wx - 14 - ext, wy - 4); g.stroke();
          g.fillStyle = '#cfd6dd'; g.beginPath(); g.moveTo(wx - 14 - ext, wy - 4); g.lineTo(wx - 20 - ext, wy - 6.2); g.lineTo(wx - 13.4 - ext, wy - 1); g.closePath(); g.fill(); }
        else { g.beginPath(); g.moveTo(wx, wy + 9); g.lineTo(wx, wy - 16 - ext); g.stroke();
          g.fillStyle = '#cfd6dd'; g.beginPath(); g.moveTo(wx - 2.4, wy - 16 - ext); g.lineTo(wx + 2.4, wy - 16 - ext); g.lineTo(wx, wy - 23 - ext); g.closePath(); g.fill(); }
        break; }
      case 'sword': {
        const a = side ? (-2.5 + raise * 2.6) : (-1.4 + raise * 2.2); // big readable swing
        g.save(); g.translate(wx, wy); g.rotate(a);
        g.fillStyle = '#d7dde4'; g.fillRect(-1.4, -15, 2.8, 15);
        g.fillStyle = '#9aa3ad'; g.fillRect(0.2, -15, 1.2, 15); // blade edge shading
        g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(-1.1, -13.5, 1, 3.5); // glint
        g.fillStyle = '#8a6420'; g.fillRect(-3.4, -1.5, 6.8, 2.4);
        g.fillStyle = '#5d4426'; g.beginPath(); g.arc(0, 1.6, 1.4, 0, 7); g.fill(); // pommel
        g.restore(); break; }
      case 'axe': {
        const a = side ? (-2.3 + raise * 2.8) : (-1.2 + raise * 2.4); // full chop arc
        g.save(); g.translate(wx, wy); g.rotate(a);
        g.strokeStyle = '#6e5638'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 2); g.lineTo(0, -12); g.stroke();
        g.fillStyle = '#aab3bf'; g.beginPath(); g.moveTo(0, -12); g.quadraticCurveTo(7, -12, 7, -6); g.lineTo(0, -8); g.closePath(); g.fill();
        g.restore(); break; }
      case 'bow': {
        const px = side ? wx - 3 : wx + 1;
        g.strokeStyle = '#7d5a2e'; g.lineWidth = 2;
        g.beginPath(); g.arc(px, wy, 11, Math.PI * .6, Math.PI * 1.4); g.stroke();
        g.strokeStyle = '#ddd'; g.lineWidth = .8;
        const pull = anim === 'attack' && fr === 0 ? 5 : 0;
        g.beginPath(); g.moveTo(px - Math.sin(Math.PI * .4) * 11, wy - Math.cos(Math.PI * .4) * 11 - 2);
        g.lineTo(px + pull, wy); g.lineTo(px - Math.sin(Math.PI * .4) * 11, wy + Math.cos(Math.PI * .4) * 11 + 2); g.stroke();
        if (pull) { g.strokeStyle = '#9a7b54'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(px + pull, wy); g.lineTo(px - 12, wy); g.stroke(); }
        break; }
      case 'crossbow': {
        g.save(); g.translate(wx, wy); if (!side) g.rotate(-.5);
        g.fillStyle = '#6e5638'; g.fillRect(-3, -1.4, 16 * (side ? -1 : 1), 2.8);
        g.strokeStyle = '#7d5a2e'; g.lineWidth = 2;
        const tipX = side ? -13 : 13;
        g.beginPath(); g.arc(tipX, 0, 7, side ? Math.PI * .5 : Math.PI * 1.5, side ? Math.PI * 1.5 : Math.PI * .5); g.stroke();
        g.restore(); break; }
      case 'staff': g.strokeStyle = '#6e5638'; g.lineWidth = 2; g.beginPath(); g.moveTo(wx, wy + 8); g.lineTo(wx, wy - 12); g.stroke(); break;
    }

    // ----- shield -----
    // facing the viewer: carried on the leading arm. Facing away: slung across the back.
    const shScale = away ? 0.8 : 1;
    const sx2 = away ? hipX + 0.5 : (prof ? hipX + fx * 7.5 : hipX - 7.5);
    const sy2 = away ? armY + 4 : armY + 3;
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(20,12,6,.6)';
    if (v.shield === 'round') {
      const r = 6 * shScale;
      const gr = g.createRadialGradient(sx2 - 1.5, sy2 - 1.5, 1, sx2, sy2, r);
      gr.addColorStop(0, tc.light); gr.addColorStop(1, tc.dark);
      g.fillStyle = gr; g.beginPath(); g.arc(sx2, sy2, r, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#e7cf8e'; g.beginPath(); g.arc(sx2, sy2, 1.7 * shScale, 0, 7); g.fill();
    } else if (v.shield === 'scutum') {
      const hw2 = 5 * shScale, hh2 = 8.5 * shScale;
      const gr = g.createLinearGradient(sx2 - hw2, 0, sx2 + hw2, 0);
      gr.addColorStop(0, tc.main); gr.addColorStop(1, tc.dark);
      g.fillStyle = gr;
      g.beginPath(); g.roundRect(sx2 - hw2, sy2 - hh2, hw2 * 2, hh2 * 2, 3); g.fill(); g.stroke();
      g.strokeStyle = '#e7cf8e'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(sx2, sy2 - hh2 + 2.5); g.lineTo(sx2, sy2 + hh2 - 2.5); g.stroke();
      g.fillStyle = '#e7cf8e'; g.beginPath(); g.arc(sx2, sy2, 2 * shScale, 0, 7); g.fill();
    } else if (v.shield === 'kite') {
      const s2 = shScale;
      g.fillStyle = tc.main; g.beginPath();
      g.moveTo(sx2 - 5 * s2, sy2 - 6 * s2); g.quadraticCurveTo(sx2, sy2 - 9 * s2, sx2 + 5 * s2, sy2 - 6 * s2);
      g.quadraticCurveTo(sx2 + 4 * s2, sy2 + 4 * s2, sx2, sy2 + 9 * s2);
      g.quadraticCurveTo(sx2 - 4 * s2, sy2 + 4 * s2, sx2 - 5 * s2, sy2 - 6 * s2);
      g.closePath(); g.fill(); g.stroke();
    }
    g.restore();
  }

  /* ---------------- mounted / large unit painters (side view) ---------------- */
  function drawHorse(g, x, y, colorIdx, swing, col = '#8a6a48', colD = '#5f4830') {
    const tc = teamCols(colorIdx);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, y + 1, 17, 4.5, 0, 0, 7); g.fill();
    // legs
    g.lineWidth = 3;
    for (const [ox, ph] of [[-10, 0], [-6, Math.PI], [7, Math.PI], [11, 0]]) {
      const a = Math.sin(ph) * 0 + Math.sin(ph + swing * Math.PI) * 0.55 * (swing ? 1 : 0);
      g.strokeStyle = ox < 0 ? colD : col;
      g.beginPath(); g.moveTo(x + ox, y - 12); g.lineTo(x + ox + Math.sin(a) * 8, y); g.stroke();
    }
    // body
    const gr = g.createLinearGradient(x, y - 24, x, y - 8);
    gr.addColorStop(0, col); gr.addColorStop(1, colD);
    g.fillStyle = gr; g.strokeStyle = 'rgba(20,12,6,.55)'; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(x, y - 15, 16, 7.5, 0, 0, 7); g.fill(); g.stroke();
    // neck + head
    g.beginPath(); g.moveTo(x - 12, y - 18); g.quadraticCurveTo(x - 20, y - 26, x - 21, y - 29);
    g.lineTo(x - 16, y - 31); g.quadraticCurveTo(x - 12, y - 24, x - 7, y - 20); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(x - 21.5, y - 29, 5, 3, -.4, 0, 7); g.fill(); g.stroke();
    // mane & tail
    g.strokeStyle = '#3a2c1c'; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(x - 14, y - 22); g.quadraticCurveTo(x - 10, y - 26, x - 8, y - 21); g.stroke();
    g.beginPath(); g.moveTo(x + 15, y - 17); g.quadraticCurveTo(x + 22, y - 12, x + 20, y - 5); g.stroke();
    // saddle cloth
    g.fillStyle = tc.main; g.fillRect(x - 5, y - 21, 11, 6);
  }

  function drawRiderTorso(g, x, y, colorIdx, civ, weapon, raise) {
    const tc = teamCols(colorIdx), skin = SKIN[civ] || SKIN.none;
    g.fillStyle = tc.main; g.strokeStyle = 'rgba(20,12,6,.55)'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(x - 4.5, y); g.lineTo(x + 4.5, y); g.lineTo(x + 3.5, y + 10); g.lineTo(x - 3.5, y + 10); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = skin; g.beginPath(); g.arc(x, y - 5, 4.6, 0, 7); g.fill();
    g.fillStyle = '#6e5638'; g.beginPath(); g.arc(x, y - 6.5, 4.8, Math.PI, 0); g.fill();
    g.strokeStyle = skin; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(x - 3, y + 3); g.lineTo(x - 9, y + 5 - raise * 4); g.stroke();
    if (weapon === 'spear') {
      g.strokeStyle = '#6e5638'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + 2, y + 8 - raise * 2); g.lineTo(x - 16 - raise * 6, y - 2 - raise * 3); g.stroke();
      g.fillStyle = '#cfd6dd'; g.beginPath();
      const tx = x - 16 - raise * 6, ty = y - 2 - raise * 3;
      g.moveTo(tx, ty); g.lineTo(tx - 5, ty - 2.4); g.lineTo(tx + .8, ty + 2.4); g.closePath(); g.fill();
    }
  }

  /* ---- wild animals: side-view quadrupeds with a galloping gait (face left) ---- */
  const ANIMALS = {
    deer:  { body: '#a07a4e', belly: '#caa676', dark: '#6e5028', leg: 2.4, bodyW: 14, bodyH: 7, headR: 4.2, neck: 13, tall: 1.6, legLen: 14, stride: 5.6, lift: 4.6, bob: 3.0, antlers: true, tail: 'flag' },
    boar:  { body: '#52412f', belly: '#3a2c1e', dark: '#2a2016', leg: 3.2, bodyW: 17, bodyH: 9, headR: 6, neck: 7, tall: 0.2, legLen: 7, stride: 3.6, lift: 1.6, bob: 0.6, tusks: true, bristle: true, snout: 1, tail: 'curl' },
    wolf:  { body: '#7a756e', belly: '#9a958c', dark: '#4e4a44', leg: 2.6, bodyW: 15, bodyH: 6.5, headR: 4.6, neck: 9, tall: 0.8, legLen: 11, stride: 5.0, lift: 3.0, bob: 1.4, ears: 'point', fangs: true, tail: 'bush' },
    sheep: { body: '#e6e0d4', belly: '#f3eee4', dark: '#3a342c', leg: 2.6, bodyW: 13, bodyH: 8.5, headR: 4, neck: 5, tall: 0.5, legLen: 7, stride: 2.6, lift: 1.5, bob: 0.6, wool: true, tail: 'stub' },
  };
  function drawAnimal(g, type, anim, fr) {
    const A = ANIMALS[type] || ANIMALS.deer;
    const cx2 = 48, gy = 60;
    const gallop = anim === 'walk' ? Math.sin(fr / 4 * Math.PI * 2) : 0;   // body bob + leg cycle
    const lunge = anim === 'attack' ? (fr === 1 ? 5 : fr === 0 ? -1 : 2) : 0; // head thrust
    const moving = anim === 'walk';
    const legLen = A.legLen || 11;
    const STR = A.stride || 4.5, LFT = A.lift || 3.2, BOB = A.bob != null ? A.bob : 1.5; // per-species gait
    const hipY = gy - legLen + Math.abs(gallop) * BOB;     // shoulder/hip line (bobs while moving)
    const by = hipY - A.bodyH * 0.35;                      // body center sits just above the hips
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(cx2, gy + 1, A.bodyW + 1, 3.6, 0, 0, 7); g.fill();
    // ---- legs: a readable stepping gait — diagonal pairs swing forward & lift in turn ----
    g.lineWidth = A.leg; g.lineCap = 'round';
    const legs = [[-A.bodyW * .60, 0.0], [-A.bodyW * .38, 0.5], [A.bodyW * .38, 0.0], [A.bodyW * .60, 0.5]];
    for (const [ox, off] of legs) {
      const cyc = moving ? (fr / 4 + off) * Math.PI * 2 : 0;
      const swing = moving ? Math.sin(cyc) * STR : ox * 0.12;        // fore-aft step (idle: slight splay)
      const lift  = moving ? Math.max(0, Math.sin(cyc)) * LFT : 0;   // foot lifts as it swings forward
      const footX = cx2 + ox + swing, footY = gy + 1 - lift;
      g.strokeStyle = ox < 0 ? A.body : A.dark;                     // front legs lighter, hind darker for depth
      g.beginPath(); g.moveTo(cx2 + ox * 0.6, hipY); g.lineTo(footX, footY); g.stroke();
      g.fillStyle = A.dark; g.beginPath(); g.ellipse(footX, footY, 1.6, 1.2, 0, 0, 7); g.fill(); // hoof/paw
    }
    // ---- body ----
    const grd = g.createLinearGradient(0, by - A.bodyH, 0, by + A.bodyH);
    grd.addColorStop(0, A.body); grd.addColorStop(1, A.belly);
    g.fillStyle = grd; g.strokeStyle = 'rgba(20,12,6,.5)'; g.lineWidth = 1.1;
    g.beginPath(); g.ellipse(cx2, by, A.bodyW, A.bodyH, 0, 0, 7); g.fill(); g.stroke();
    if (A.wool) { // fluffy sheep wool: scalloped top
      g.fillStyle = '#f3eee4';
      for (let i = -4; i <= 4; i++) { g.beginPath(); g.arc(cx2 + i * 3.2, by - A.bodyH * .5, 3, 0, 7); g.fill(); }
    }
    if (A.bristle) { g.strokeStyle = '#1d160e'; g.lineWidth = 1.4; // boar back bristles
      for (let i = -4; i <= 3; i++) { const bx = cx2 + i * 4; g.beginPath(); g.moveTo(bx, by - A.bodyH + 1); g.lineTo(bx + 1, by - A.bodyH - 4); g.stroke(); } }
    // ---- tail ----
    g.strokeStyle = A.dark; g.lineWidth = 2;
    const tx = cx2 + A.bodyW - 1, ty2 = by - 2;
    if (A.tail === 'flag') { g.fillStyle = '#e9e2d2'; g.beginPath(); g.ellipse(tx + 2, ty2, 2.4, 4, .3, 0, 7); g.fill(); }
    else if (A.tail === 'curl') { g.beginPath(); g.arc(tx + 2, ty2, 2.6, Math.PI * .4, Math.PI * 2); g.stroke(); }
    else if (A.tail === 'bush') { g.lineWidth = 4; g.beginPath(); g.moveTo(tx, ty2); g.quadraticCurveTo(tx + 7, ty2 + 1, tx + 8, ty2 + 7); g.stroke(); }
    else { g.fillStyle = A.belly; g.beginPath(); g.arc(tx + 1, ty2, 2, 0, 7); g.fill(); }
    // ---- neck + head (left, lunges on attack) ----
    const hx = cx2 - A.bodyW - A.neck * .4 - lunge, hy = by - A.tall * 6 + (A.snout ? 4 : 0) + lunge * .3;
    g.strokeStyle = A.body; g.lineWidth = A.bodyH * 1.1; g.lineCap = 'round'; // neck as a thick stroke
    g.beginPath(); g.moveTo(cx2 - A.bodyW * .7, by - 2); g.lineTo(hx + A.headR * .6, hy + 1); g.stroke();
    const hg = g.createLinearGradient(hx - A.headR, hy, hx + A.headR, hy);
    hg.addColorStop(0, A.belly); hg.addColorStop(1, A.body);
    g.fillStyle = hg; g.strokeStyle = 'rgba(20,12,6,.5)'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(hx, hy, A.headR, A.headR * .8, -.2, 0, 7); g.fill(); g.stroke(); // head
    if (A.snout) { g.fillStyle = A.dark; g.beginPath(); g.ellipse(hx - A.headR + 1, hy + 1, 2.6, 2, 0, 0, 7); g.fill(); } // boar snout
    else { g.fillStyle = A.body; g.beginPath(); g.ellipse(hx - A.headR + 1, hy, 2.4, 1.8, 0, 0, 7); g.fill(); } // muzzle
    g.fillStyle = '#15110b'; g.beginPath(); g.arc(hx + .5, hy - 1, 1.1, 0, 7); g.fill(); // eye
    // ears
    if (A.ears === 'point') { g.fillStyle = A.body; // wolf ears
      g.beginPath(); g.moveTo(hx, hy - A.headR); g.lineTo(hx - 2, hy - A.headR - 4); g.lineTo(hx + 2, hy - A.headR - 1); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(hx + 3, hy - A.headR + 1); g.lineTo(hx + 2, hy - A.headR - 3); g.lineTo(hx + 5, hy - A.headR); g.closePath(); g.fill(); }
    else if (!A.wool) { g.fillStyle = A.dark; g.beginPath(); g.ellipse(hx + 2, hy - A.headR + 1, 1.6, 2.6, .4, 0, 7); g.fill(); } // soft ear
    if (A.wool) { g.fillStyle = A.dark; g.beginPath(); g.ellipse(hx, hy, A.headR * .9, A.headR * .8, -.2, 0, 7); g.fill(); // sheep black face
      g.fillStyle = '#15110b'; g.beginPath(); g.arc(hx + 1, hy - 1, 1, 0, 7); g.fill(); }
    if (A.antlers) { g.strokeStyle = '#8a6e44'; g.lineWidth = 1.4; // deer antlers
      for (const s of [-1, 1]) { const bx = hx + s * 1.5, byy = hy - A.headR;
        g.beginPath(); g.moveTo(bx, byy); g.lineTo(bx + s * 2, byy - 6);
        g.moveTo(bx + s * 1.2, byy - 3); g.lineTo(bx + s * 4, byy - 4);
        g.moveTo(bx + s * 2, byy - 6); g.lineTo(bx + s * 4.5, byy - 8); g.stroke(); } }
    if (A.tusks) { g.strokeStyle = '#ece4d2'; g.lineWidth = 1.6; // boar tusks
      g.beginPath(); g.moveTo(hx - A.headR + 1, hy + 2); g.quadraticCurveTo(hx - A.headR - 3, hy - 1, hx - A.headR - 1, hy - 3); g.stroke(); }
    if (A.fangs && anim === 'attack') { g.fillStyle = '#fff'; // wolf bared fangs when lunging
      g.beginPath(); g.moveTo(hx - A.headR, hy + 1); g.lineTo(hx - A.headR - 1, hy + 4); g.lineTo(hx - A.headR + 1.5, hy + 1.5); g.closePath(); g.fill(); }
  }

  function drawBig(type, colorIdx, civ, anim, fr) {
    const w = type === 'elephant' ? 100 : 92, h = type === 'elephant' ? 84 : 72;
    const c = mk(w, h), g = g2(c);
    const tc = teamCols(colorIdx);
    const swing = anim === 'walk' ? Math.sin(fr / 4 * Math.PI * 2) : 0;
    const raise = anim === 'attack' ? (fr === 1 ? 1 : .3) : 0;
    if (type === 'scout') {
      drawHorse(g, 46, 64, colorIdx, swing);
      drawRiderTorso(g, 46, 36, colorIdx, civ, 'none', 0);
      return { cv: c, ax: 46, ay: 66 };
    }
    if (type === 'deer' || type === 'boar' || type === 'wolf' || type === 'sheep') {
      drawAnimal(g, type, anim, fr);
      return { cv: c, ax: 48, ay: 60 };
    }
    if (type === 'cart') { // ox-drawn supply cart (side view, ox faces left)
      const cx2 = 56;
      // ox
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(28, 66, 15, 4, 0, 0, 7); g.fill();
      g.lineWidth = 3;
      for (const [ox, ph] of [[18, 0], [22, Math.PI], [34, Math.PI], [38, 0]]) {
        const a = Math.sin(ph + swing * Math.PI) * 0.4;
        g.strokeStyle = ox < 26 ? '#6e5a44' : '#8a7256';
        g.beginPath(); g.moveTo(ox, 54); g.lineTo(ox + Math.sin(a) * 6, 66); g.stroke();
      }
      const gr = g.createLinearGradient(0, 44, 0, 58);
      gr.addColorStop(0, '#9a8260'); gr.addColorStop(1, '#6e5a44');
      g.fillStyle = gr; g.strokeStyle = 'rgba(20,12,6,.55)'; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(28, 52, 16, 8, 0, 0, 7); g.fill(); g.stroke();        // body
      g.beginPath(); g.moveTo(16, 50); g.quadraticCurveTo(6, 50, 8, 44); g.lineTo(15, 44); g.quadraticCurveTo(16, 48, 18, 49); g.closePath(); g.fill(); g.stroke(); // head
      g.strokeStyle = '#e8e0ce'; g.lineWidth = 2; // horns
      g.beginPath(); g.moveTo(11, 44); g.quadraticCurveTo(8, 40, 11, 39); g.stroke();
      g.beginPath(); g.moveTo(14, 44); g.quadraticCurveTo(13, 40, 16, 40); g.stroke();
      g.fillStyle = '#1d1812'; g.beginPath(); g.arc(11, 47, 1.2, 0, 7); g.fill();
      // yoke + cart
      g.strokeStyle = '#4e3f2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(40, 50); g.lineTo(48, 50); g.stroke();
      g.fillStyle = '#7d5a2e'; g.strokeStyle = '#3a2a16'; g.lineWidth = 1.2;
      g.beginPath(); g.roundRect(48, 40, 30, 16, 2); g.fill(); g.stroke();           // cart box
      // sacks of goods
      for (const [sx3, sy3, col] of [[56, 40, '#c8a24a'], [64, 39, '#9c7e54'], [71, 41, '#b3895a']]) {
        g.fillStyle = col; g.beginPath(); g.ellipse(sx3, sy3, 4, 5, 0, 0, 7); g.fill();
        g.strokeStyle = 'rgba(20,12,6,.4)'; g.stroke();
      }
      g.fillStyle = '#4e3f2a'; g.beginPath(); g.arc(cx2 + 6, 58, 8, 0, 7); g.fill();  // wheel
      g.fillStyle = '#2e2418'; g.beginPath(); g.arc(cx2 + 6, 58, 3, 0, 7); g.fill();
      g.strokeStyle = '#8a7148'; g.lineWidth = 1.3;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4 + swing; g.beginPath(); g.moveTo(cx2 + 6 - Math.cos(a) * 7, 58 - Math.sin(a) * 7); g.lineTo(cx2 + 6 + Math.cos(a) * 7, 58 + Math.sin(a) * 7); g.stroke(); }
      const tcb = teamCols(colorIdx); g.fillStyle = tcb.main; g.fillRect(48, 53, 30, 3); // team trim
      return { cv: c, ax: 44, ay: 64 };
    }
    if (type === 'chariot') {
      // cart wheel + platform behind horse
      drawHorse(g, 36, 62, colorIdx, swing, '#9c7e54', '#6e583a');
      g.strokeStyle = '#5d4426'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(52, 52); g.lineTo(40, 48); g.stroke(); // yoke
      g.fillStyle = tc.main; g.strokeStyle = 'rgba(20,12,6,.6)';
      g.beginPath(); g.roundRect(54, 40, 22, 12, 3); g.fill(); g.stroke(); // cart
      g.fillStyle = '#4e3f2a'; g.beginPath(); g.arc(65, 58, 8, 0, 7); g.fill();
      g.fillStyle = '#2e2418'; g.beginPath(); g.arc(65, 58, 3, 0, 7); g.fill();
      g.strokeStyle = '#8a7148'; g.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4 + swing; g.beginPath(); g.moveTo(65 - Math.cos(a) * 7, 58 - Math.sin(a) * 7); g.lineTo(65 + Math.cos(a) * 7, 58 + Math.sin(a) * 7); g.stroke(); }
      drawRiderTorso(g, 64, 26, colorIdx, civ, 'spear', raise);
      return { cv: c, ax: 50, ay: 66 };
    }
    if (type === 'horseman' || type === 'equites' || type === 'keshik' || type === 'ashva') {
      const horseCol = type === 'ashva' ? '#6a5444' : type === 'equites' ? '#7a6a54' : '#8a6a48';
      const horseD   = type === 'ashva' ? '#3e3026' : type === 'equites' ? '#5a4a38' : '#5f4830';
      drawHorse(g, 46, 64, colorIdx, swing, horseCol, horseD);
      if (type === 'equites') {
        // Roman heavy lancer: metal helm + red crest, long lance, kite shield
        g.fillStyle = '#b4bec4'; g.strokeStyle = 'rgba(20,12,6,.4)'; g.lineWidth = 1;
        g.beginPath(); g.arc(46, 27, 5.5, 0, 7); g.fill(); g.stroke();
        g.fillStyle = '#cc3b2e';
        g.beginPath(); g.moveTo(41, 23); g.quadraticCurveTo(46, 13, 51, 23); g.closePath(); g.fill();
        g.fillStyle = tc.main; g.strokeStyle = tc.dark; g.lineWidth = 1;
        g.beginPath(); g.roundRect(41, 33, 10, 14, 2); g.fill(); g.stroke();
        g.strokeStyle = '#cfd6dd'; g.lineWidth = 2.6;
        g.beginPath(); g.moveTo(46, 33); g.lineTo(24, 18); g.stroke();
        g.fillStyle = '#cfd6dd';
        g.beginPath(); g.moveTo(24, 18); g.lineTo(20, 15); g.lineTo(26, 14); g.closePath(); g.fill();
        g.fillStyle = tc.main; g.strokeStyle = tc.dark; g.lineWidth = 1;
        g.beginPath(); g.moveTo(53, 36); g.lineTo(59, 43); g.quadraticCurveTo(57, 51, 55, 49); g.lineTo(50, 43); g.closePath(); g.fill(); g.stroke();
      } else if (type === 'keshik') {
        // Chinese horse archer: conical hat, lamellar armor, bow drawn
        g.fillStyle = '#a08858'; g.strokeStyle = 'rgba(20,12,6,.35)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(39, 28); g.lineTo(46, 16); g.lineTo(53, 28); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = tc.main; g.strokeStyle = tc.dark; g.lineWidth = 1;
        g.beginPath(); g.roundRect(42, 31, 9, 12, 2); g.fill(); g.stroke();
        g.strokeStyle = '#6e5638'; g.lineWidth = 2.2;
        g.beginPath(); g.arc(59, 34, 11, Math.PI * 0.55, Math.PI * 1.45); g.stroke();
        g.strokeStyle = '#c8b07a'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(57, 27); g.quadraticCurveTo(49, 34, 57, 41); g.stroke();
        g.strokeStyle = '#8a6448'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(59, 34); g.lineTo(47, 34); g.stroke();
        g.fillStyle = '#cfd6dd';
        g.beginPath(); g.moveTo(47, 34); g.lineTo(44, 32); g.lineTo(44, 36); g.closePath(); g.fill();
      } else if (type === 'ashva') {
        // Indian Ashvaroha: turban + gem, curved talwar, horse barding
        g.fillStyle = tc.main; g.strokeStyle = 'rgba(20,12,6,.3)'; g.lineWidth = 1;
        g.beginPath(); g.ellipse(46, 24, 7, 5, 0, 0, 7); g.fill(); g.stroke();
        g.fillStyle = '#f0c040'; g.beginPath(); g.arc(46, 21, 2, 0, 7); g.fill();
        g.fillStyle = tc.main; g.strokeStyle = tc.dark; g.lineWidth = 1;
        g.beginPath(); g.roundRect(41, 29, 10, 14, 2); g.fill(); g.stroke();
        g.strokeStyle = '#cfd6dd'; g.lineWidth = 2.6;
        g.beginPath(); g.moveTo(44, 40); g.quadraticCurveTo(38, 30, 34, 21); g.stroke();
        g.fillStyle = '#8a6a48'; g.beginPath(); g.arc(44, 41, 2.5, 0, 7); g.fill();
        g.fillStyle = tc.dark; g.strokeStyle = '#f0c040'; g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(46, 54, 17, 7, 0, 0, 7); g.fill(); g.stroke();
      } else { // horseman: nasal helm, broadsword raised, round shield
        g.fillStyle = '#8a9498'; g.strokeStyle = 'rgba(20,12,6,.4)'; g.lineWidth = 1;
        g.beginPath(); g.arc(46, 28, 5.5, 0, 7); g.fill(); g.stroke();
        g.fillStyle = '#cfd6dd'; g.fillRect(43, 30, 8, 1.8);
        g.fillStyle = tc.main; g.strokeStyle = tc.dark; g.lineWidth = 1;
        g.beginPath(); g.roundRect(41, 32, 10, 14, 2); g.fill(); g.stroke();
        g.strokeStyle = '#cfd6dd'; g.lineWidth = 2.8;
        g.beginPath(); g.moveTo(46, 38); g.lineTo(40, 20); g.stroke();
        g.fillStyle = '#8a6a48'; g.beginPath(); g.arc(46, 39, 2.5, 0, 7); g.fill();
        g.fillStyle = tc.main; g.strokeStyle = tc.dark; g.lineWidth = 1;
        g.beginPath(); g.arc(53, 39, 5.5, 0, 7); g.fill(); g.stroke();
        g.strokeStyle = tc.dark; g.beginPath(); g.arc(53, 39, 3, 0, 7); g.stroke();
      }
      return { cv: c, ax: 46, ay: 66 };
    }
    if (type === 'elephant') {
      g.fillStyle = 'rgba(0,0,0,.32)'; g.beginPath(); g.ellipse(50, 76, 28, 7, 0, 0, 7); g.fill();
      // legs
      for (const [ox, ph] of [[-16, 0], [-8, Math.PI], [10, Math.PI], [18, 0]]) {
        const a = Math.sin(ph + swing * Math.PI) * 0.35;
        g.fillStyle = ox < 0 ? '#6b6660' : '#7d7872';
        g.save(); g.translate(50 + ox, 56); g.rotate(a); g.fillRect(-4.5, 0, 9, 20); g.restore();
      }
      // body
      const gr = g.createLinearGradient(50, 24, 50, 62);
      gr.addColorStop(0, '#8d8880'); gr.addColorStop(1, '#5f5a54');
      g.fillStyle = gr; g.strokeStyle = 'rgba(20,12,6,.55)'; g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(50, 44, 28, 19, 0, 0, 7); g.fill(); g.stroke();
      // head + trunk (raise on attack)
      g.beginPath(); g.arc(20, 38, 13, 0, 7); g.fill(); g.stroke();
      g.beginPath();
      const t = raise; // trunk
      g.moveTo(13, 42); g.quadraticCurveTo(5 - t * 6, 52 - t * 22, 11 - t * 10, 64 - t * 26);
      g.quadraticCurveTo(14 - t * 10, 66 - t * 26, 16 - t * 8, 62 - t * 24);
      g.quadraticCurveTo(11, 52 - t * 10, 19, 44); g.closePath(); g.fill(); g.stroke();
      // ear, eye, tusks
      g.fillStyle = '#6b6660'; g.beginPath(); g.ellipse(26, 36, 7, 9, .2, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#1d1812'; g.beginPath(); g.arc(15, 34, 1.6, 0, 7); g.fill();
      g.strokeStyle = '#e8e0ce'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(14, 46); g.quadraticCurveTo(6, 50, 3, 47); g.stroke();
      // team caparison + mahout
      g.fillStyle = tc.main; g.strokeStyle = tc.dark; g.lineWidth = 1;
      g.beginPath(); g.roundRect(36, 26, 26, 14, 3); g.fill(); g.stroke();
      g.fillStyle = '#e7cf8e'; g.fillRect(36, 38, 26, 2.4);
      drawRiderTorso(g, 49, 12, colorIdx, civ, 'none', 0);
      return { cv: c, ax: 50, ay: 76 };
    }
    /* ---------- ships (side view, waterline at ay) ---------- */
    if (UNITS[type] && UNITS[type].naval) {
      const tc2 = teamCols(colorIdx);
      const WL = 56; // waterline y
      function hull(len, ht, col, colD) {
        g.fillStyle = 'rgba(8,20,40,.35)';
        g.beginPath(); g.ellipse(48, WL + 3, len * .55, 4.5, 0, 0, 7); g.fill();
        const gr = g.createLinearGradient(0, WL - ht, 0, WL + 4);
        gr.addColorStop(0, col); gr.addColorStop(1, colD);
        g.fillStyle = gr; g.strokeStyle = 'rgba(20,12,6,.6)'; g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(48 - len / 2, WL - ht - 5);                       // raised bow (left)
        g.quadraticCurveTo(48 - len / 2 + 3, WL, 48 - len / 2 + 9, WL + 3);
        g.lineTo(48 + len / 2 - 8, WL + 3);
        g.quadraticCurveTo(48 + len / 2 + 1, WL, 48 + len / 2 - 2, WL - ht - 2);
        g.lineTo(48 - len / 2 + 5, WL - ht - 2);
        g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(40,26,12,.4)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(48 - len / 2 + 6, WL - ht / 2); g.lineTo(48 + len / 2 - 5, WL - ht / 2); g.stroke();
        g.fillStyle = 'rgba(235,248,255,.55)';
        g.beginPath(); g.ellipse(48 - len / 2 + 1, WL + 2, 5, 2, 0, 0, 7); g.fill();
      }
      function sail(mx, hgt, wid, furl) {
        g.strokeStyle = '#4e3f2a'; g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(mx, WL - 4); g.lineTo(mx, WL - 4 - hgt); g.stroke();
        if (furl) { g.fillStyle = '#cdbb96'; g.fillRect(mx - wid / 2, WL - 4 - hgt + 2, wid, 4); return; }
        const gr = g.createLinearGradient(mx - wid / 2, 0, mx + wid / 2, 0);
        gr.addColorStop(0, tc2.light); gr.addColorStop(.5, tc2.main); gr.addColorStop(1, tc2.dark);
        g.fillStyle = gr; g.strokeStyle = 'rgba(20,12,6,.5)'; g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(mx - wid / 2, WL - hgt - 2);
        g.quadraticCurveTo(mx - wid / 2 - 4, WL - hgt / 2 - 6, mx - wid / 2, WL - 10);
        g.lineTo(mx + wid / 2, WL - 10);
        g.quadraticCurveTo(mx + wid / 2 + 4, WL - hgt / 2 - 6, mx + wid / 2, WL - hgt - 2);
        g.closePath(); g.fill(); g.stroke();
        g.fillStyle = tc2.dark; g.beginPath();
        g.moveTo(mx, WL - 4 - hgt); g.lineTo(mx + 10, WL - 2 - hgt); g.lineTo(mx, WL - hgt); g.closePath(); g.fill();
      }
      function oars(n, y0, ph) {
        g.strokeStyle = '#7d5a2e'; g.lineWidth = 1.8;
        for (let i = 0; i < n; i++) {
          const ox = 48 - (n - 1) * 5 + i * 10;
          const a = 0.5 + Math.sin(ph * Math.PI + i * .9) * 0.25;
          g.beginPath(); g.moveTo(ox, y0); g.lineTo(ox - 6, y0 + 10 * a + 2); g.stroke();
        }
      }
      const ph = anim === 'walk' ? fr / 4 : 0;
      if (type === 'fishboat') {
        hull(38, 9, '#9c7e54', '#6e583a');
        drawRiderTorso(g, 50, 36, colorIdx, civ, 'none', 0);
        // fishing rod, jiggling while gathering
        const dip = (anim === 'attack' || anim === 'work') ? Math.sin(fr * 2.1) * 3 : 0;
        g.strokeStyle = '#6e5638'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(52, 42); g.lineTo(30, 30 + dip); g.stroke();
        g.strokeStyle = 'rgba(220,235,250,.8)'; g.lineWidth = 0.9;
        g.beginPath(); g.moveTo(30, 30 + dip); g.lineTo(28, WL + 2); g.stroke();
        return { cv: c, ax: 48, ay: WL };
      }
      if (type === 'transport') {
        hull(62, 13, '#8a6a48', '#5d4426');
        sail(54, 30, 18, true); // furled — it's a workhorse
        g.fillStyle = '#9c7e54'; g.strokeStyle = 'rgba(20,12,6,.5)';
        g.fillRect(30, WL - 22, 10, 9); g.strokeRect(30, WL - 22, 10, 9);
        g.fillRect(42, WL - 20, 8, 7); g.strokeRect(42, WL - 20, 8, 7);
        drawRiderTorso(g, 66, 32, colorIdx, civ, 'none', 0);
        return { cv: c, ax: 48, ay: WL };
      }
      if (type === 'galley') {
        hull(68, 11, '#9c7e54', '#6e583a');
        // bronze ram
        g.fillStyle = '#b8924a'; g.beginPath();
        g.moveTo(14, WL - 2); g.lineTo(6, WL + 1); g.lineTo(15, WL + 3); g.closePath(); g.fill();
        oars(4, WL - 1, ph);
        sail(50, 34, 22, false);
        drawRiderTorso(g, 70, 34, colorIdx, civ, 'none', 0);
        return { cv: c, ax: 48, ay: WL };
      }
      if (type === 'quinquereme') {
        hull(78, 15, '#a8895c', '#6e583a');
        g.fillStyle = '#c9a34f'; g.beginPath();
        g.moveTo(10, WL - 3); g.lineTo(1, WL + 1); g.lineTo(11, WL + 4); g.closePath(); g.fill();
        oars(6, WL, ph); oars(5, WL - 5, ph + .4);
        sail(46, 40, 26, false);
        // stern tower with archer
        g.fillStyle = '#cfc7b4'; g.strokeStyle = 'rgba(20,12,6,.5)';
        g.fillRect(68, WL - 32, 16, 16); g.strokeRect(68, WL - 32, 16, 16);
        g.fillStyle = '#a89f8a'; for (let i = 0; i < 3; i++) g.fillRect(69 + i * 5.4, WL - 35, 3.4, 4);
        drawRiderTorso(g, 76, WL - 44, colorIdx, civ, 'spear', 0);
        return { cv: c, ax: 48, ay: WL };
      }
      if (type === 'fireship') {
        hull(52, 10, '#5d4426', '#3a2a16');
        // barrels + flames (flicker with frame)
        for (const bx of [38, 50, 60]) {
          g.fillStyle = '#8a6a48'; g.strokeStyle = '#3a2a16'; g.lineWidth = 1;
          g.fillRect(bx - 4, WL - 18, 8, 10); g.strokeRect(bx - 4, WL - 18, 8, 10);
          const fl = 6 + ((bx + fr * 7) % 5);
          g.fillStyle = '#ff7a30'; g.beginPath();
          g.moveTo(bx - 4, WL - 18); g.quadraticCurveTo(bx, WL - 26 - fl, bx + 1, WL - 19);
          g.closePath(); g.fill();
          g.fillStyle = '#ffc14d'; g.beginPath();
          g.moveTo(bx - 1, WL - 19); g.quadraticCurveTo(bx + 1, WL - 23 - fl * .5, bx + 3, WL - 18); g.closePath(); g.fill();
        }
        g.fillStyle = 'rgba(90,80,70,.45)';
        for (let i = 0; i < 3; i++) g.beginPath(), g.arc(44 + i * 7, WL - 32 - i * 5, 3 + i, 0, 7), g.fill();
        return { cv: c, ax: 48, ay: WL };
      }
      if (type === 'catamaran') {
        // twin hulls + deck
        g.fillStyle = 'rgba(8,20,40,.35)'; g.beginPath(); g.ellipse(48, WL + 4, 30, 4, 0, 0, 7); g.fill();
        for (const hy of [0, 7]) {
          g.fillStyle = hy ? '#9c7e54' : '#b39468'; g.strokeStyle = 'rgba(20,12,6,.55)'; g.lineWidth = 1.2;
          g.beginPath();
          g.moveTo(20, WL - 8 + hy); g.quadraticCurveTo(16, WL - 2 + hy, 24, WL + hy);
          g.lineTo(72, WL + hy); g.quadraticCurveTo(80, WL - 3 + hy, 76, WL - 8 + hy);
          g.closePath(); g.fill(); g.stroke();
        }
        g.fillStyle = '#cdb279'; g.fillRect(34, WL - 12, 28, 5);
        sail(48, 32, 16, false);
        drawRiderTorso(g, 60, 34, colorIdx, civ, 'none', 0);
        return { cv: c, ax: 48, ay: WL };
      }
    }

    if (type === 'catapult') {
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(46, 64, 26, 6, 0, 0, 7); g.fill();
      // wheels
      for (const wx of [26, 66]) {
        g.fillStyle = '#4e3f2a'; g.beginPath(); g.arc(wx, 58, 9, 0, 7); g.fill();
        g.strokeStyle = '#8a7148'; g.lineWidth = 1.6;
        for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(wx - Math.cos(a) * 8, 58 - Math.sin(a) * 8); g.lineTo(wx + Math.cos(a) * 8, 58 + Math.sin(a) * 8); g.stroke(); }
      }
      // base
      g.fillStyle = '#6e5638'; g.strokeStyle = '#3a2a16'; g.lineWidth = 1.4;
      g.beginPath(); g.roundRect(18, 48, 56, 8, 2); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(30, 48); g.lineTo(46, 28); g.lineTo(62, 48); g.closePath(); g.fill(); g.stroke();
      // arm: cocked when idle, released when attack fr1
      const armA = anim === 'attack' && fr >= 1 ? -1.9 : -0.45;
      g.save(); g.translate(46, 46); g.rotate(armA);
      g.fillStyle = '#7d5a2e'; g.fillRect(0, -3, 34, 6); g.strokeRect(0, -3, 34, 6);
      g.fillStyle = '#57534a'; g.beginPath(); g.arc(34, 0, 5, 0, 7); g.fill();
      g.restore();
      return { cv: c, ax: 46, ay: 64 };
    }
    return null;
  }

  /* dark outline pass: makes units pop against any terrain (AoE2 readability) */
  function outlined(c, px) {
    const sil = mk(c.width, c.height), sg = sil.getContext('2d');
    for (const [ox, oy] of [[px, 0], [-px, 0], [0, px], [0, -px], [px, px], [-px, -px], [px, -px], [-px, px]])
      sg.drawImage(c, ox, oy);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = 'rgba(24,15,8,0.8)';
    sg.fillRect(0, 0, c.width, c.height);
    const out = mk(c.width, c.height), og = out.getContext('2d');
    og.drawImage(sil, 0, 0);
    og.drawImage(c, 0, 0);
    return out;
  }

  /* ---------- front / back views for mounted, siege & naval units ---------- */
  function drawBigFB(type, colorIdx, civ, dir, anim, fr) {
    const away = dir === 4;
    const tc = teamCols(colorIdx);
    const swing = anim === 'walk' ? Math.sin(fr / 4 * Math.PI * 2) : 0;
    const raise = anim === 'attack' ? (fr === 1 ? 1 : .3) : 0;
    const W2 = type === 'elephant' ? 100 : 92, H2 = type === 'elephant' ? 84 : 78;
    const c = mk(W2, H2), g = g2(c);
    const cx = W2 / 2;

    function horseFB(gy) {
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx, gy, 12, 4.5, 0, 0, 7); g.fill();
      // two visible legs, alternating
      for (const s of [-1, 1]) {
        g.strokeStyle = s < 0 ? '#5f4830' : '#6e583a'; g.lineWidth = 3.4;
        g.beginPath(); g.moveTo(cx + s * 6, gy - 22);
        g.lineTo(cx + s * 6 + Math.sin(swing * Math.PI * s) * 3, gy - 1); g.stroke();
      }
      const gr = g.createLinearGradient(cx - 11, 0, cx + 11, 0);
      gr.addColorStop(0, '#6e583a'); gr.addColorStop(.5, '#8a6a48'); gr.addColorStop(1, '#5f4830');
      g.fillStyle = gr; g.strokeStyle = 'rgba(20,12,6,.55)'; g.lineWidth = 1.3;
      g.beginPath(); g.ellipse(cx, gy - 26, 10.5, 13, 0, 0, 7); g.fill(); g.stroke(); // chest / rump
      if (away) { // tail
        g.strokeStyle = '#3a2c1c'; g.lineWidth = 2.6;
        g.beginPath(); g.moveTo(cx, gy - 30); g.quadraticCurveTo(cx + 2, gy - 18, cx - 1, gy - 8); g.stroke();
      }
      // head (small over the body when seen from behind)
      g.fillStyle = '#8a6a48';
      g.beginPath(); g.ellipse(cx, gy - 42, 5.5, 8, 0, 0, 7); g.fill(); g.stroke();
      if (!away) { g.fillStyle = '#6e583a'; g.beginPath(); g.ellipse(cx, gy - 36, 3.6, 4.5, 0, 0, 7); g.fill();
        g.fillStyle = '#241a10'; g.fillRect(cx - 3.4, gy - 45, 1.8, 2); g.fillRect(cx + 1.6, gy - 45, 1.8, 2); }
      g.fillStyle = '#6e583a'; // ears
      g.beginPath(); g.moveTo(cx - 5, gy - 47); g.lineTo(cx - 3, gy - 53); g.lineTo(cx - 1, gy - 48); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(cx + 5, gy - 47); g.lineTo(cx + 3, gy - 53); g.lineTo(cx + 1, gy - 48); g.closePath(); g.fill();
      g.fillStyle = tc.main; g.fillRect(cx - 9, gy - 32, 18, 5); // saddle cloth
    }

    if (type === 'scout') {
      horseFB(72);
      drawRiderTorso(g, cx, 22, colorIdx, civ, 'none', 0);
      return { cv: c, ax: cx, ay: 73 };
    }
    if (type === 'cart') { // ox cart head-on / from behind
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx, 70, 16, 5, 0, 0, 7); g.fill();
      if (!away) { // ox facing the viewer in front of the cart
        for (const s of [-1, 1]) { g.fillStyle = '#7d6450'; g.fillRect(cx + s * 7 - 2, 50, 4, 14); }
        const gr = g.createLinearGradient(cx - 10, 0, cx + 10, 0);
        gr.addColorStop(0, '#6e5a44'); gr.addColorStop(.5, '#9a8260'); gr.addColorStop(1, '#6e5a44');
        g.fillStyle = gr; g.strokeStyle = 'rgba(20,12,6,.55)'; g.lineWidth = 1.3;
        g.beginPath(); g.ellipse(cx, 46, 11, 12, 0, 0, 7); g.fill(); g.stroke();
        g.beginPath(); g.ellipse(cx, 38, 7, 6, 0, 0, 7); g.fill(); g.stroke(); // head
        g.strokeStyle = '#e8e0ce'; g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(cx - 6, 34); g.quadraticCurveTo(cx - 11, 31, cx - 9, 36); g.stroke();
        g.beginPath(); g.moveTo(cx + 6, 34); g.quadraticCurveTo(cx + 11, 31, cx + 9, 36); g.stroke();
        g.fillStyle = '#1d1812'; g.fillRect(cx - 3.5, 36, 1.8, 2.2); g.fillRect(cx + 1.7, 36, 1.8, 2.2);
      } else { // cart box + sacks dominate, ox head peeks over
        g.fillStyle = '#7d5a2e'; g.strokeStyle = '#3a2a16'; g.lineWidth = 1.3;
        g.beginPath(); g.roundRect(cx - 13, 40, 26, 18, 2); g.fill(); g.stroke();
        for (const [sx3, sy3, col] of [[cx - 6, 40, '#c8a24a'], [cx + 4, 39, '#9c7e54'], [cx, 42, '#b3895a']]) {
          g.fillStyle = col; g.beginPath(); g.ellipse(sx3, sy3, 4.5, 5, 0, 0, 7); g.fill(); }
        g.fillStyle = teamCols(colorIdx).main; g.fillRect(cx - 13, 55, 26, 3);
      }
      for (const s of [-1, 1]) { // wheels
        g.fillStyle = '#4e3f2a'; g.beginPath(); g.arc(cx + s * 14, 60, 7, 0, 7); g.fill();
        g.fillStyle = '#2e2418'; g.beginPath(); g.arc(cx + s * 14, 60, 2.6, 0, 7); g.fill();
      }
      return { cv: c, ax: cx, ay: 66 };
    }
    if (type === 'chariot') {
      if (!away) { // horse hides the cart; wheels peek out at the sides
        horseFB(72);
        g.fillStyle = '#4e3f2a';
        for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 17, 64, 7.5, 0, 7); g.fill();
          g.strokeStyle = '#8a7148'; g.lineWidth = 1.3;
          g.beginPath(); g.arc(cx + s * 17, 64, 4.5, 0, 7); g.stroke(); }
        drawRiderTorso(g, cx, 22, colorIdx, civ, 'none', raise);
      } else { // cart dominates from behind
        g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx, 72, 20, 5, 0, 0, 7); g.fill();
        g.fillStyle = '#6e583a'; // horse head + ears above the cart
        g.beginPath(); g.ellipse(cx, 26, 5, 7, 0, 0, 7); g.fill();
        g.beginPath(); g.moveTo(cx - 4, 21); g.lineTo(cx - 2, 15); g.lineTo(cx, 20); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(cx + 4, 21); g.lineTo(cx + 2, 15); g.lineTo(cx, 20); g.closePath(); g.fill();
        for (const s of [-1, 1]) { // wheels
          g.fillStyle = '#4e3f2a'; g.beginPath(); g.arc(cx + s * 16, 62, 8.5, 0, 7); g.fill();
          g.strokeStyle = '#8a7148'; g.lineWidth = 1.5;
          for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3 + swing;
            g.beginPath(); g.moveTo(cx + s * 16 - Math.cos(a) * 7, 62 - Math.sin(a) * 7);
            g.lineTo(cx + s * 16 + Math.cos(a) * 7, 62 + Math.sin(a) * 7); g.stroke(); }
        }
        g.fillStyle = tc.main; g.strokeStyle = 'rgba(20,12,6,.6)'; g.lineWidth = 1.3;
        g.beginPath(); g.roundRect(cx - 13, 40, 26, 18, 3); g.fill(); g.stroke();
        g.fillStyle = '#e7cf8e'; g.fillRect(cx - 13, 46, 26, 2);
        drawRiderTorso(g, cx, 28, colorIdx, civ, 'none', raise);
      }
      return { cv: c, ax: cx, ay: 73 };
    }
    if (type === 'horseman' || type === 'equites' || type === 'keshik' || type === 'ashva') {
      horseFB(72);
      if (type === 'equites') {
        g.fillStyle = '#b4bec4'; g.strokeStyle = 'rgba(20,12,6,.4)'; g.lineWidth = 1;
        g.beginPath(); g.arc(cx, 25, 6, 0, 7); g.fill(); g.stroke();
        g.fillStyle = '#cc3b2e';
        g.beginPath(); g.moveTo(cx - 5, 21); g.quadraticCurveTo(cx, 12, cx + 5, 21); g.closePath(); g.fill();
        if (!away) { // lance tip toward viewer
          g.strokeStyle = '#cfd6dd'; g.lineWidth = 2.5;
          g.beginPath(); g.moveTo(cx, 36); g.lineTo(cx, 8); g.stroke();
          g.fillStyle = '#cfd6dd';
          g.beginPath(); g.moveTo(cx - 3, 8); g.lineTo(cx + 3, 8); g.lineTo(cx, 2); g.closePath(); g.fill();
        }
        drawRiderTorso(g, cx, 18, colorIdx, civ, 'none', raise);
      } else if (type === 'keshik') {
        g.fillStyle = '#a08858';
        g.beginPath(); g.moveTo(cx - 8, 27); g.lineTo(cx, 14); g.lineTo(cx + 8, 27); g.closePath(); g.fill();
        drawRiderTorso(g, cx, 20, colorIdx, civ, 'none', raise);
      } else if (type === 'ashva') {
        g.fillStyle = tc.main;
        g.beginPath(); g.ellipse(cx, 22, 7, 5, 0, 0, 7); g.fill();
        g.fillStyle = '#f0c040'; g.beginPath(); g.arc(cx, 20, 1.8, 0, 7); g.fill();
        drawRiderTorso(g, cx, 19, colorIdx, civ, 'none', raise);
      } else { // horseman
        drawRiderTorso(g, cx, 20, colorIdx, civ, 'none', raise);
      }
      return { cv: c, ax: cx, ay: 73 };
    }
    if (type === 'elephant') {
      g.fillStyle = 'rgba(0,0,0,.32)'; g.beginPath(); g.ellipse(cx, 76, 20, 6.5, 0, 0, 7); g.fill();
      for (const s of [-1, 1]) { // two thick legs
        g.fillStyle = s < 0 ? '#6b6660' : '#7d7872';
        g.save(); g.translate(cx + s * 11, 56); g.rotate(Math.sin(swing * Math.PI * s) * 0.18);
        g.fillRect(-4.5, 0, 9, 20); g.restore();
      }
      const gr = g.createLinearGradient(cx - 24, 0, cx + 24, 0);
      gr.addColorStop(0, '#5f5a54'); gr.addColorStop(.5, '#8d8880'); gr.addColorStop(1, '#5f5a54');
      g.fillStyle = gr; g.strokeStyle = 'rgba(20,12,6,.55)'; g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(cx, 44, 24, 21, 0, 0, 7); g.fill(); g.stroke(); // bulk
      // ears flank the head
      g.fillStyle = '#6b6660';
      g.beginPath(); g.ellipse(cx - 17, 34, 8.5, 11.5, -.15, 0, 7); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(cx + 17, 34, 8.5, 11.5, .15, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#827d76';
      g.beginPath(); g.ellipse(cx, 36, 12.5, 13, 0, 0, 7); g.fill(); g.stroke(); // head
      if (!away) {
        // trunk down the middle (lifts when attacking)
        const t = raise;
        g.fillStyle = '#827d76';
        g.beginPath();
        g.moveTo(cx - 3.4, 42); g.quadraticCurveTo(cx - 4, 56 - t * 14, cx - 2 + t * 8, 66 - t * 22);
        g.lineTo(cx + 2 + t * 9, 64 - t * 22); g.quadraticCurveTo(cx + 4, 54 - t * 12, cx + 3.4, 42);
        g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = '#e8e0ce'; g.lineWidth = 3.2; // tusks
        g.beginPath(); g.moveTo(cx - 7, 44); g.quadraticCurveTo(cx - 10, 52, cx - 8, 58); g.stroke();
        g.beginPath(); g.moveTo(cx + 7, 44); g.quadraticCurveTo(cx + 10, 52, cx + 8, 58); g.stroke();
        g.fillStyle = '#1d1812'; g.fillRect(cx - 6.5, 31, 2.2, 2.6); g.fillRect(cx + 4.3, 31, 2.2, 2.6);
        g.fillStyle = tc.main; g.fillRect(cx - 9, 24, 18, 4.5); // headdress band
      } else {
        g.strokeStyle = '#6b6660'; g.lineWidth = 2.4; // tail
        g.beginPath(); g.moveTo(cx, 60); g.quadraticCurveTo(cx + 2, 68, cx, 74); g.stroke();
        g.fillStyle = tc.main; g.strokeStyle = tc.dark; g.lineWidth = 1;
        g.beginPath(); g.roundRect(cx - 13, 30, 26, 16, 3); g.fill(); g.stroke(); // caparison
        g.fillStyle = '#e7cf8e'; g.fillRect(cx - 13, 43, 26, 2.4);
      }
      drawRiderTorso(g, cx, 10, colorIdx, civ, 'none', 0);
      return { cv: c, ax: cx, ay: 76 };
    }
    if (type === 'catapult') { // symmetric head-on view
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx, 66, 24, 5.5, 0, 0, 7); g.fill();
      for (const s of [-1, 1]) {
        g.fillStyle = '#4e3f2a'; g.beginPath(); g.arc(cx + s * 22, 58, 9, 0, 7); g.fill();
        g.strokeStyle = '#8a7148'; g.lineWidth = 1.6;
        for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3;
          g.beginPath(); g.moveTo(cx + s * 22 - Math.cos(a) * 8, 58 - Math.sin(a) * 8);
          g.lineTo(cx + s * 22 + Math.cos(a) * 8, 58 + Math.sin(a) * 8); g.stroke(); }
      }
      g.fillStyle = '#6e5638'; g.strokeStyle = '#3a2a16'; g.lineWidth = 1.4;
      g.beginPath(); g.roundRect(cx - 22, 50, 44, 8, 2); g.fill(); g.stroke(); // axle beam
      g.beginPath(); g.moveTo(cx - 14, 50); g.lineTo(cx, 26); g.lineTo(cx + 14, 50); g.closePath(); g.fill(); g.stroke();
      const armUp = anim === 'attack' && fr >= 1 ? 16 : 0; // throwing arm rises
      g.fillStyle = '#7d5a2e'; g.fillRect(cx - 2.5, 18 - armUp, 5, 34); g.strokeRect(cx - 2.5, 18 - armUp, 5, 34);
      g.fillStyle = '#57534a'; g.beginPath(); g.arc(cx, 16 - armUp, 5, 0, 7); g.fill();
      return { cv: c, ax: cx, ay: 66 };
    }
    /* ---- ships bow-on / stern-on ---- */
    const WL = 56;
    function hullFB(hw, ht, col, colD) {
      g.fillStyle = 'rgba(8,20,40,.35)';
      g.beginPath(); g.ellipse(cx, WL + 3, hw + 4, 4.5, 0, 0, 7); g.fill();
      const gr = g.createLinearGradient(cx - hw, 0, cx + hw, 0);
      gr.addColorStop(0, colD); gr.addColorStop(.5, col); gr.addColorStop(1, colD);
      g.fillStyle = gr; g.strokeStyle = 'rgba(20,12,6,.6)'; g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(cx - hw, WL + 1); g.quadraticCurveTo(cx - hw, WL - ht, cx, WL - ht - 4);
      g.quadraticCurveTo(cx + hw, WL - ht, cx + hw, WL + 1);
      g.quadraticCurveTo(cx, WL + 5, cx - hw, WL + 1);
      g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(40,26,12,.45)'; g.lineWidth = 1; // keel line
      g.beginPath(); g.moveTo(cx, WL - ht - 3); g.lineTo(cx, WL + 3); g.stroke();
      if (!away) { g.fillStyle = 'rgba(235,248,255,.55)'; // bow wash
        g.beginPath(); g.ellipse(cx, WL + 3.5, hw * .7, 2.2, 0, 0, 7); g.fill(); }
    }
    function sailFB(hgt, wid) {
      g.strokeStyle = '#4e3f2a'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(cx, WL - 6); g.lineTo(cx, WL - 6 - hgt); g.stroke();
      const gr = g.createLinearGradient(cx - wid / 2, 0, cx + wid / 2, 0);
      gr.addColorStop(0, tc2.dark); gr.addColorStop(.5, tc2.main); gr.addColorStop(1, tc2.dark);
      g.fillStyle = gr; g.strokeStyle = 'rgba(20,12,6,.5)'; g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(cx - wid / 2, WL - 4 - hgt);
      g.quadraticCurveTo(cx, WL - hgt + 2, cx + wid / 2, WL - 4 - hgt); // wind-bellied foot
      g.lineTo(cx + wid / 2 - 2, WL - 12); g.quadraticCurveTo(cx, WL - 18, cx - wid / 2 + 2, WL - 12);
      g.closePath(); g.fill(); g.stroke();
    }
    const tc2 = teamCols(colorIdx);
    if (type === 'fishboat') {
      hullFB(8, 8, '#9c7e54', '#6e583a');
      drawRiderTorso(g, cx, WL - 22, colorIdx, civ, 'none', 0);
      return { cv: c, ax: cx, ay: WL };
    }
    if (type === 'catamaran') {
      for (const s of [-1, 1]) {
        g.fillStyle = s < 0 ? '#9c7e54' : '#b39468'; g.strokeStyle = 'rgba(20,12,6,.55)'; g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(cx + s * 11, WL - 3, 5, 7.5, 0, 0, 7); g.fill(); g.stroke();
      }
      g.fillStyle = '#cdb279'; g.fillRect(cx - 13, WL - 11, 26, 4);
      sailFB(26, 16);
      return { cv: c, ax: cx, ay: WL };
    }
    const cfg = { transport: [13, 12, 0, 0], galley: [10, 10, 30, 20],
                  quinquereme: [13, 14, 36, 26], fireship: [9, 9, 0, 0] }[type] || [10, 10, 26, 18];
    hullFB(cfg[0], cfg[1], type === 'fireship' ? '#5d4426' : '#9c7e54', type === 'fireship' ? '#3a2a16' : '#6e583a');
    if (cfg[2]) sailFB(cfg[2], cfg[3]);
    if (type === 'transport') { // furled yard + crate
      g.strokeStyle = '#4e3f2a'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(cx, WL - 6); g.lineTo(cx, WL - 32); g.stroke();
      g.fillStyle = '#cdbb96'; g.fillRect(cx - 9, WL - 31, 18, 4);
      g.fillStyle = '#9c7e54'; g.fillRect(cx - 5, WL - 19, 10, 8); g.strokeRect(cx - 5, WL - 19, 10, 8);
    }
    if (type === 'fireship') {
      for (const bx of [cx - 7, cx, cx + 7]) {
        g.fillStyle = '#8a6a48'; g.strokeStyle = '#3a2a16'; g.lineWidth = 1;
        g.fillRect(bx - 3.4, WL - 18, 6.8, 9); g.strokeRect(bx - 3.4, WL - 18, 6.8, 9);
        const fl = 6 + ((bx + fr * 7) % 5);
        g.fillStyle = '#ff7a30'; g.beginPath();
        g.moveTo(bx - 3.4, WL - 18); g.quadraticCurveTo(bx, WL - 26 - fl, bx + 1, WL - 19); g.closePath(); g.fill();
        g.fillStyle = '#ffc14d'; g.beginPath();
        g.moveTo(bx - 1, WL - 19); g.quadraticCurveTo(bx + 1, WL - 23 - fl * .5, bx + 3, WL - 18); g.closePath(); g.fill();
      }
    }
    if (type === 'quinquereme' && away) { // stern tower
      g.fillStyle = '#cfc7b4'; g.strokeStyle = 'rgba(20,12,6,.5)'; g.lineWidth = 1.2;
      g.fillRect(cx - 8, WL - 20, 16, 14); g.strokeRect(cx - 8, WL - 20, 16, 14);
      g.fillStyle = '#a89f8a'; for (let i = 0; i < 3; i++) g.fillRect(cx - 7 + i * 5.4, WL - 23, 3.4, 4);
    }
    return { cv: c, ax: cx, ay: WL };
  }

  /* public: unit sprite in 24 directions for smooth turning.
     dir 0=E, 6=S(toward viewer), 12=W, 18=N(away); increasing clockwise.
     Humanoids render parametrically — the 12 right-facing dirs are mirrored from
     the 13 left-facing baked poses. Big units quantize to front / side / back. */
  const NDIR = 24;
  const BIG_TYPES = { scout: 1, chariot: 1, horseman: 1, equites: 1, keshik: 1, ashva: 1,
    elephant: 1, catapult: 1, cart: 1,
    deer: 1, boar: 1, wolf: 1, sheep: 1,
    fishboat: 1, transport: 1, galley: 1, quinquereme: 1, fireship: 1, catamaran: 1 };
  const ANIMAL_TYPES = { deer: 1, boar: 1, wolf: 1, sheep: 1 };
  function unit(type, colorIdx, civ, dir, anim, fr, tool) {
    dir = ((dir % NDIR) + NDIR) % NDIR;
    const ang = dir / NDIR * Math.PI * 2;          // screen-space facing angle
    const cosA = Math.cos(ang), sinA = Math.sin(ang);
    tool = tool || '';

    if (BIG_TYPES[type]) {
      // coarse: front (toward viewer) / back (away) / profile (mirrored for east).
      // animals only have a profile sprite, so they always use the side view.
      let bake = ANIMAL_TYPES[type] ? 2 : sinA > 0.38 ? 0 : sinA < -0.38 ? 4 : 2;
      const mirror = bake === 2 && cosA > 1e-3;
      const key = `u_${type}_${colorIdx}_${civ}_B${bake}_${mirror ? 1 : 0}_${anim}_${fr}`;
      if (cache.has(key)) return cache.get(key);
      let s;
      if (mirror) {
        const L = unit(type, colorIdx, civ, 12, anim, fr); // dir 12 = W = side, unmirrored
        const c = mk(L.cv.width, L.cv.height), g = g2(c);
        g.translate(L.cv.width, 0); g.scale(-1, 1); g.drawImage(L.cv, 0, 0);
        s = { cv: c, ax: L.cv.width / (L.k || 1) - L.ax, ay: L.ay, k: L.k };
      } else {
        const raw = (bake === 0 || bake === 4)
          ? drawBigFB(type, colorIdx, civ, bake, anim, fr)
          : drawBig(type, colorIdx, civ, anim, fr);
        s = { cv: outlined(raw.cv, 1), ax: raw.ax, ay: raw.ay, k: raw.k };
      }
      cache.set(key, s); return s;
    }

    // humanoid: bake the left-facing half, mirror for right-facing dirs
    let bakeDir = dir, mirror = false;
    if (cosA > 1e-3) { mirror = true; bakeDir = (12 - dir + NDIR) % NDIR; }
    const key = `u_${type}_${colorIdx}_${civ}_D${bakeDir}_${mirror ? 1 : 0}_${anim}_${fr}_${tool}`;
    if (cache.has(key)) return cache.get(key);
    let s;
    if (mirror) {
      const L = unit(type, colorIdx, civ, bakeDir, anim, fr, tool);
      const c = mk(L.cv.width, L.cv.height), g = g2(c);
      g.translate(L.cv.width, 0); g.scale(-1, 1); g.drawImage(L.cv, 0, 0);
      s = { cv: c, ax: L.cv.width / (L.k || 1) - L.ax, ay: L.ay, k: L.k };
    } else {
      const a2 = bakeDir / NDIR * Math.PI * 2;
      const c = mk(96, 112), g = g2(c);
      g.scale(2, 2); // supersample
      drawHumanoid(g, type, colorIdx, civ, Math.cos(a2), Math.sin(a2), anim, fr, tool);
      s = { cv: outlined(c, 1.5), ax: 24, ay: 52, k: 2 };
    }
    cache.set(key, s); return s;
  }

  /* ---------------- buildings ---------------- */
  function isoBox(g, cx, cy, s, wallH, top, left, right) {
    const hw = s * 32, hh = s * 16;
    // left wall
    g.fillStyle = left; g.beginPath();
    g.moveTo(cx - hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx, cy + hh - wallH); g.lineTo(cx - hw, cy - wallH); g.closePath(); g.fill();
    // right wall
    g.fillStyle = right; g.beginPath();
    g.moveTo(cx + hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx, cy + hh - wallH); g.lineTo(cx + hw, cy - wallH); g.closePath(); g.fill();
    // top
    g.fillStyle = top; g.beginPath();
    g.moveTo(cx, cy - hh - wallH); g.lineTo(cx + hw, cy - wallH); g.lineTo(cx, cy + hh - wallH); g.lineTo(cx - hw, cy - wallH); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(20,12,6,.45)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(cx - hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx + hw, cy);
    g.moveTo(cx - hw, cy); g.lineTo(cx - hw, cy - wallH); g.moveTo(cx + hw, cy); g.lineTo(cx + hw, cy - wallH);
    g.moveTo(cx, cy + hh); g.lineTo(cx, cy + hh - wallH); g.stroke();
  }
  const CIV_PAL = {
    rome:  { wallL: '#cfc7b4', wallR: '#a89f8a', top: '#e3dccb', roof: '#b3543b', roofD: '#8a3f2c' },
    china: { wallL: '#8a6a48', wallR: '#6b513a', top: '#9c7e54', roof: '#2e6b5e', roofD: '#1f4a41' },
    india: { wallL: '#d4b88a', wallR: '#b3976a', top: '#e0c79a', roof: '#e8e0ce', roofD: '#b8a784' },
    none:  { wallL: '#9a948a', wallR: '#736e64', top: '#b5ad9c', roof: '#6b6557', roofD: '#4e4a40' },
  };
  function flag(g, x, y, colorIdx) {
    const tc = teamCols(colorIdx);
    g.strokeStyle = '#3a2a16'; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 22); g.stroke();
    g.fillStyle = tc.main; g.strokeStyle = tc.dark; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y - 22); g.lineTo(x + 14, y - 18.5); g.lineTo(x, y - 15); g.closePath(); g.fill(); g.stroke();
  }
  function roofFor(g, style, cx, topY, s) {
    const hw = s * 32, hh = s * 16, p = CIV_PAL[style] || CIV_PAL.none;
    if (style === 'rome') { // gabled prism
      g.fillStyle = p.roof; g.beginPath();
      g.moveTo(cx - hw, topY); g.lineTo(cx, topY - hh - 14); g.lineTo(cx + hw, topY); g.lineTo(cx, topY + hh); g.closePath(); g.fill();
      g.fillStyle = p.roofD; g.beginPath();
      g.moveTo(cx + hw, topY); g.lineTo(cx, topY - hh - 14); g.lineTo(cx, topY + hh); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(20,12,6,.4)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(cx - hw, topY); g.lineTo(cx, topY - hh - 14); g.lineTo(cx + hw, topY); g.stroke();
    } else if (style === 'china') { // tiered pagoda
      for (let i = 0; i < 2; i++) {
        const w = hw * (1 - i * .34), y = topY - i * 16, lift = 6;
        g.fillStyle = i ? p.roof : p.roofD; g.beginPath();
        g.moveTo(cx - w - 6, y + 2); g.quadraticCurveTo(cx - w, y - lift, cx - w * .5, y - lift - 2);
        g.lineTo(cx, y - lift - 5); g.lineTo(cx + w * .5, y - lift - 2);
        g.quadraticCurveTo(cx + w, y - lift, cx + w + 6, y + 2);
        g.quadraticCurveTo(cx, y + 10, cx - w - 6, y + 2); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(20,12,6,.4)'; g.stroke();
      }
      g.fillStyle = '#e7cf8e'; g.beginPath(); g.arc(cx, topY - 38, 2.6, 0, 7); g.fill();
      g.fillRect(cx - 1, topY - 36, 2, 8);
    } else if (style === 'india') { // dome
      g.fillStyle = p.roof; g.beginPath(); g.ellipse(cx, topY - 4, hw * .55, hw * .5, 0, Math.PI, 0); g.fill();
      g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(cx + hw * .18, topY - 4, hw * .3, hw * .42, 0, Math.PI * 1.5, 0); g.fill();
      g.strokeStyle = 'rgba(20,12,6,.35)'; g.beginPath(); g.ellipse(cx, topY - 4, hw * .55, hw * .5, 0, Math.PI, 0); g.stroke();
      g.fillStyle = '#d4a647'; g.fillRect(cx - 1.2, topY - 4 - hw * .5 - 8, 2.4, 9);
      g.beginPath(); g.arc(cx, topY - 4 - hw * .5 - 9, 2.4, 0, 7); g.fill();
    } else { // flat crenellated (neutral keep / tower)
      g.fillStyle = p.top; g.beginPath();
      g.moveTo(cx, topY - hh); g.lineTo(cx + hw, topY); g.lineTo(cx, topY + hh); g.lineTo(cx - hw, topY); g.closePath(); g.fill();
      g.fillStyle = p.wallR;
      for (let i = -2; i <= 2; i++) g.fillRect(cx + i * (hw / 2.6) - 3, topY - hh / 2 - 3 + Math.abs(i) * 2, 6, 6);
    }
  }

  /* ---- per-age dressing: makes a building's age readable at a glance ----
     age 1 = bare;  2 = stone footing;  3 = + corner buttresses & pennants;
     4 = + gilded roofline, apex finial & lit braziers (imperial). Anchored to
     the isometric footprint diamond so it frames any hall/tower/depot. */
  function ageDress(g, cx, cy, hw, hh, wallH, age, colorIdx) {
    if (age <= 1) return;
    const tc = teamCols(colorIdx);
    const topY = cy - wallH;
    // ---- age 2+: reinforced stone footing along the two front base edges ----
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = '#d8d0bd'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(cx - hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx + hw, cy); g.stroke();
    g.strokeStyle = 'rgba(70,60,44,.5)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx - hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx + hw, cy); g.stroke();
    g.fillStyle = 'rgba(70,60,44,.45)';              // course joints
    for (let i = 1; i < 5; i++) { const t = i / 5;
      g.fillRect(cx - hw + hw * t - 0.5, cy + hh * t - 1, 1, 2);
      g.fillRect(cx + hw - hw * t - 0.5, cy + hh * t - 1, 1, 2); }
    if (age < 3) return;
    // ---- age 3+: stone corner buttresses topped with team pennants ----
    for (const sgn of [-1, 1]) {
      const bx = cx + sgn * hw;
      g.fillStyle = sgn < 0 ? '#c2bba8' : '#a89f8a'; g.strokeStyle = 'rgba(20,12,6,.45)'; g.lineWidth = 1;
      g.fillRect(bx - 3, topY, 6, cy - topY); g.strokeRect(bx - 3, topY, 6, cy - topY);
      g.strokeStyle = '#3a2a16'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(bx, topY); g.lineTo(bx, topY - 13); g.stroke();
      g.fillStyle = tc.main; g.strokeStyle = tc.dark; g.lineWidth = 1;
      g.beginPath(); g.moveTo(bx, topY - 13); g.lineTo(bx + sgn * 9, topY - 10); g.lineTo(bx, topY - 7); g.closePath(); g.fill(); g.stroke();
    }
    if (age < 4) return;
    // ---- age 4: imperial gilding — eaves trim, apex finial, lit braziers ----
    g.strokeStyle = '#f0d35e'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - hw, topY); g.lineTo(cx, topY + hh); g.lineTo(cx + hw, topY); g.stroke();
    g.fillStyle = '#3a2a16'; g.fillRect(cx - 1, topY - hh - 18, 2, 14);   // finial pole
    g.fillStyle = '#f0d35e'; g.strokeStyle = '#8a6420'; g.lineWidth = 1;
    g.beginPath(); g.arc(cx, topY - hh - 20, 3.2, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#fff7d8'; g.beginPath(); g.arc(cx - 1, topY - hh - 21, 1, 0, 7); g.fill();
    for (const sgn of [-1, 1]) {                                          // flanking braziers
      const bx = cx + sgn * (hw - 2), by = cy + 1;
      g.fillStyle = '#3f3a33'; g.fillRect(bx - 2.5, by - 6, 5, 6);
      const fg = g.createRadialGradient(bx, by - 8, 0.5, bx, by - 8, 5.5);
      fg.addColorStop(0, '#ffe27a'); fg.addColorStop(.5, '#ff8a2e'); fg.addColorStop(1, 'rgba(180,60,30,0)');
      g.fillStyle = fg; g.beginPath();
      g.moveTo(bx - 3, by - 6); g.quadraticCurveTo(bx, by - 17, bx + 3, by - 6); g.closePath(); g.fill();
    }
  }

  function building(type, style, colorIdx, built, variant, age) {
    variant = variant || '';
    age = age || 1;
    const key = `b_${type}_${style}_${colorIdx}_${built ? 1 : 0}_${variant}_a${age}`;
    if (cache.has(key)) return cache.get(key);
    const B = BUILDINGS[type], s = B.size;
    const W = s * 64 + 24, H = s * 32 + 86;
    const c = mk(W * 2, H * 2), g = g2(c); // 2x supersample for crisp detail
    g.scale(2, 2);
    const cx = W / 2, cy = H - s * 16 - 4; // footprint center (logical coords)
    const p = CIV_PAL[type === 'town' ? 'none' : style] || CIV_PAL.none;

    // ground pad + shadow
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath();
    g.moveTo(cx, cy - s * 16 - 2); g.lineTo(cx + s * 32 + 4, cy); g.lineTo(cx, cy + s * 16 + 3); g.lineTo(cx - s * 32 - 4, cy); g.closePath(); g.fill();

    if (!built) { // construction site: frame + scaffold
      g.strokeStyle = '#8a6a48'; g.lineWidth = 3;
      const hw = s * 32, hh = s * 16, wh = 18;
      for (const [x, y] of [[cx - hw, cy], [cx + hw, cy], [cx, cy + hh], [cx, cy - hh]]) {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - wh - 14); g.stroke();
      }
      g.strokeStyle = '#6e5638'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx - hw, cy - wh); g.lineTo(cx, cy + hh - wh); g.lineTo(cx + hw, cy - wh); g.stroke();
      g.fillStyle = '#9c7e54';
      g.fillRect(cx - 16, cy - 4, 32, 6); g.fillRect(cx - 8, cy - 12, 22, 5);
      const out = { cv: c, ax: cx, ay: cy, k: 2 };
      cache.set(key, out); return out;
    }

    if (type === 'farm') {
      const dry = variant === 'dry';
      const hw = s * 32, hh = s * 16;
      g.save();
      g.beginPath(); g.moveTo(cx, cy - hh); g.lineTo(cx + hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx - hw, cy); g.closePath(); g.clip();
      // rich tilled soil base
      const soil = g.createLinearGradient(0, cy - hh, 0, cy + hh);
      if (dry) { soil.addColorStop(0, '#a48d62'); soil.addColorStop(1, '#8a7350'); }
      else { soil.addColorStop(0, '#7a6038'); soil.addColorStop(1, '#5e4a2b'); }
      g.fillStyle = soil; g.fill();
      // furrows running along the field, each lined with a crop row
      const R = 11;
      for (let r = 0; r <= R; r++) {
        const t = r / R;
        const Sx = cx - hw + t * hw, Sy = cy + t * hh;          // on the left→bottom edge
        const Ex = cx + t * hw, Ey = cy - hh + t * hh;          // on the top→right edge
        g.strokeStyle = dry ? '#b69c6a' : '#54421f'; g.lineWidth = 2.4;  // ploughed ridge
        g.beginPath(); g.moveTo(Sx, Sy); g.lineTo(Ex, Ey); g.stroke();
        if (dry || r >= R) continue;
        // dense crop tufts sitting on the ridge
        const n = 10;
        for (let u = 1; u < n; u++) {
          const f = u / n, px = Sx + (Ex - Sx) * f + hw / (R * 2), py = Sy + (Ey - Sy) * f + hh / (R * 2);
          const ripe = (r + u) % 3 === 0;
          g.strokeStyle = ripe ? '#c9b256' : '#6f9e39'; g.lineWidth = 1.3; // leafy crop (some ripe & golden)
          g.beginPath();
          g.moveTo(px, py); g.lineTo(px - 1.6, py - 4.4);
          g.moveTo(px, py); g.lineTo(px + 1.6, py - 4.4);
          g.moveTo(px, py); g.lineTo(px, py - 5.2); g.stroke();
          if (ripe) { g.fillStyle = '#e6c860'; g.beginPath(); g.arc(px, py - 5.4, 1, 0, 7); g.fill(); } // grain head
        }
      }
      if (dry) { // cracked, parched earth
        g.strokeStyle = 'rgba(80,62,38,.8)'; g.lineWidth = 1; const rc = RNG(11);
        for (let i = 0; i < 9; i++) { const x0 = cx - s * 18 + rc() * s * 36, y0 = cy - 8 + rc() * 16;
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + 6 - rc() * 12, y0 + 3 + rc() * 4); g.stroke(); }
      }
      g.restore();
      // low wooden fence around the field rim — reads as a managed plot
      const corners = [[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]];
      g.strokeStyle = '#6e5331'; g.lineWidth = 1.6; g.fillStyle = '#7d5f38';
      for (let e = 0; e < 4; e++) {
        const a = corners[e], b = corners[(e + 1) % 4];
        g.strokeStyle = '#5d4626'; g.lineWidth = 1.4; // top rail
        g.beginPath(); g.moveTo(a[0], a[1] - 4); g.lineTo(b[0], b[1] - 4); g.stroke();
        for (let p = 0; p <= 4; p++) { const px = a[0] + (b[0] - a[0]) * p / 4, py = a[1] + (b[1] - a[1]) * p / 4;
          g.strokeStyle = '#6e5331'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(px, py); g.lineTo(px, py - 6); g.stroke(); }
      }
      if (dry) { // red water-warning droplet
        g.fillStyle = '#d04a35'; g.beginPath();
        g.moveTo(cx, cy - 26); g.quadraticCurveTo(cx + 7, cy - 16, cx, cy - 11);
        g.quadraticCurveTo(cx - 7, cy - 16, cx, cy - 26); g.closePath(); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 8, cy - 10); g.lineTo(cx + 8, cy - 26); g.stroke();
      }
      // scarecrow on a corner — farms read instantly
      const scx = cx - s * 18, scy = cy - s * 2;
      g.strokeStyle = '#6e5638'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(scx, scy); g.lineTo(scx, scy - 17); g.stroke();
      g.beginPath(); g.moveTo(scx - 7, scy - 12); g.lineTo(scx + 7, scy - 12); g.stroke();
      g.fillStyle = '#9a7b54'; g.fillRect(scx - 4, scy - 12, 8, 6);
      g.fillStyle = '#cdb279'; g.beginPath(); g.arc(scx, scy - 18.5, 3.4, 0, 7); g.fill();
      g.fillStyle = '#8a6a48'; g.beginPath(); g.ellipse(scx, scy - 21, 5, 1.6, 0, 0, 7); g.fill();
      const out = { cv: c, ax: cx, ay: cy, k: 2 }; cache.set(key, out); return out;
    }

    if (type === 'canal') {
      const dry = variant === 'dry';
      // stone-edged water channel filling the tile diamond
      g.strokeStyle = '#8a857a'; g.lineWidth = 4; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(cx, cy - 14); g.lineTo(cx + 28, cy); g.lineTo(cx, cy + 14); g.lineTo(cx - 28, cy); g.closePath(); g.stroke();
      const gw = g.createLinearGradient(cx, cy - 12, cx, cy + 12);
      if (dry) { gw.addColorStop(0, '#b09a6e'); gw.addColorStop(1, '#94805a'); }
      else { gw.addColorStop(0, '#3f86b4'); gw.addColorStop(1, '#2b6491'); }
      g.fillStyle = gw;
      g.beginPath(); g.moveTo(cx, cy - 12); g.lineTo(cx + 25, cy); g.lineTo(cx, cy + 12); g.lineTo(cx - 25, cy); g.closePath(); g.fill();
      if (!dry) {
        g.strokeStyle = 'rgba(210,240,255,.55)'; g.lineWidth = 1.3;
        for (const [wx, wy] of [[-10, -2], [2, 2], [-2, -5]]) {
          g.beginPath(); g.moveTo(cx + wx, cy + wy);
          g.quadraticCurveTo(cx + wx + 5, cy + wy - 2, cx + wx + 10, cy + wy); g.stroke();
        }
        g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(cx + 6, cy - 4, 2, 2);
      }
      const out = { cv: c, ax: cx, ay: cy, k: 2 }; cache.set(key, out); return out;
    }

    if (type === 'wall' || type === 'gate') {
      // auto-connecting stone wall. variant = neighbor mask:
      // bit1: x+1 (screen SE), bit2: x-1 (NW), bit4: y+1 (SW), bit8: y-1 (NE)
      const mask = parseInt(variant, 10) || 0;
      const EL = 20, SW2 = 5.5, L = 17;
      const segs = []; // [vx, vy] screen direction to each connected edge
      if (mask & 2) segs.push([-16, -8]); // NW (back)
      if (mask & 8) segs.push([16, -8]);  // NE (back)
      if (mask & 4) segs.push([-16, 8]);  // SW (front)
      if (mask & 1) segs.push([16, 8]);   // SE (front)
      const stoneT = style === 'rome' ? '#ddd6c4' : p.top;
      const stoneL = style === 'rome' ? '#c2bba8' : p.wallL;
      const stoneR = style === 'rome' ? '#9b9482' : p.wallR;
      function slab(vx2, vy2) {
        const len = Math.hypot(vx2, vy2);
        const px2 = -vy2 / len * SW2, py2 = vx2 / len * SW2;
        const quad = [[cx + px2, cy + py2], [cx + px2 + vx2, cy + py2 + vy2],
                      [cx - px2 + vx2, cy - py2 + vy2], [cx - px2, cy - py2]];
        // drop faces from each top edge that faces the viewer (lower on screen)
        for (const [a, b2] of [[quad[0], quad[1]], [quad[3], quad[2]], [quad[1], quad[2]]]) {
          if ((a[1] + b2[1]) / 2 < cy - 1) continue; // back-facing
          g.fillStyle = (a[0] + b2[0]) / 2 < cx ? stoneL : stoneR;
          g.strokeStyle = 'rgba(20,12,6,.4)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(a[0], a[1] - EL); g.lineTo(b2[0], b2[1] - EL);
          g.lineTo(b2[0], b2[1]); g.lineTo(a[0], a[1]); g.closePath(); g.fill(); g.stroke();
          // masonry courses + roman arrow slit on the front faces
          g.strokeStyle = 'rgba(20,12,6,.16)';
          g.beginPath(); g.moveTo(a[0], a[1] - EL * .5); g.lineTo(b2[0], b2[1] - EL * .5); g.stroke();
          if (style === 'rome' && Math.abs(b2[0] - a[0]) > 10) {
            const mx2 = (a[0] + b2[0]) / 2, my2 = (a[1] + b2[1]) / 2;
            g.fillStyle = '#241a10'; g.fillRect(mx2 - 1.1, my2 - EL + 4, 2.2, 9);
          }
        }
        // top face
        g.fillStyle = stoneT; g.strokeStyle = 'rgba(20,12,6,.4)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(quad[0][0], quad[0][1] - EL);
        for (let i = 1; i < 4; i++) g.lineTo(quad[i][0], quad[i][1] - EL);
        g.closePath(); g.fill(); g.stroke();
        // crenellations along the top
        g.fillStyle = stoneR;
        for (const t2 of [0.42, 0.85]) {
          g.fillRect(cx + vx2 * t2 - 2.2, cy + vy2 * t2 - EL - 4, 4.4, 4.5);
        }
      }
      // back segments first, then the center post, then front segments
      for (const [vx2, vy2] of segs) if (vy2 < 0) slab(vx2, vy2);
      // center post (always: it's the joint; alone it reads as a pillar)
      g.fillStyle = stoneL; g.strokeStyle = 'rgba(20,12,6,.45)'; g.lineWidth = 1;
      g.fillRect(cx - 6, cy - EL - 3, 6, EL + 3); g.strokeRect(cx - 6, cy - EL - 3, 6, EL + 3);
      g.fillStyle = stoneR; g.fillRect(cx, cy - EL - 3, 6, EL + 3); g.strokeRect(cx, cy - EL - 3, 6, EL + 3);
      g.fillStyle = stoneT; g.beginPath();
      g.moveTo(cx, cy - EL - 7); g.lineTo(cx + 7.5, cy - EL - 3); g.lineTo(cx, cy - EL + 1); g.lineTo(cx - 7.5, cy - EL - 3);
      g.closePath(); g.fill(); g.stroke();
      for (const [vx2, vy2] of segs) if (vy2 > 0) slab(vx2, vy2);
      if (variant.includes('G')) {   // gatehouse: twin stone towers flanking a studded timber door
        // two taller tower posts left & right of the doorway
        for (const sx2 of [-13, 13]) {
          g.fillStyle = stoneL; g.fillRect(cx + sx2 - 4, cy - EL - 14, 4, EL + 14);
          g.fillStyle = stoneR; g.fillRect(cx + sx2, cy - EL - 14, 4, EL + 14);
          g.fillStyle = stoneT; g.fillRect(cx + sx2 - 4, cy - EL - 17, 8, 4);
          g.strokeStyle = 'rgba(20,12,6,.4)'; g.lineWidth = 1; g.strokeRect(cx + sx2 - 4, cy - EL - 14, 8, EL + 14);
          // merlon caps
          g.fillStyle = stoneR; g.fillRect(cx + sx2 - 4, cy - EL - 20, 3, 4); g.fillRect(cx + sx2 + 1, cy - EL - 20, 3, 4);
        }
        // recessed archway shadow
        g.fillStyle = '#1a120a'; g.beginPath();
        g.moveTo(cx - 9, cy + 3); g.lineTo(cx - 9, cy - 8); g.arc(cx, cy - 8, 9, Math.PI, 0); g.lineTo(cx + 9, cy + 3); g.closePath(); g.fill();
        // timber double door with iron bands & studs
        const dw = g.createLinearGradient(cx, cy - 10, cx, cy + 3);
        dw.addColorStop(0, '#7a5430'); dw.addColorStop(1, '#5a3c20');
        g.fillStyle = dw; g.beginPath();
        g.moveTo(cx - 8, cy + 2); g.lineTo(cx - 8, cy - 7); g.arc(cx, cy - 7, 8, Math.PI, 0); g.lineTo(cx + 8, cy + 2); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(20,10,4,.55)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(cx, cy - 15); g.lineTo(cx, cy + 2); g.stroke();   // door seam
        for (const px2 of [-5, -2.5, 2.5, 5]) { g.beginPath(); g.moveTo(cx + px2, cy - 13); g.lineTo(cx + px2, cy + 2); g.stroke(); } // planks
        g.strokeStyle = '#3a2a18'; g.lineWidth = 1.6;
        for (const py2 of [cy - 9, cy - 3]) { g.beginPath(); g.moveTo(cx - 8, py2); g.lineTo(cx + 8, py2); g.stroke(); } // iron bands
        g.fillStyle = '#caa860'; g.fillRect(cx - 9, cy - 16, 18, 2.4);   // stone lintel
      } else if (variant.includes('g')) {   // water gate: an arched culvert with water running through the wall
        g.fillStyle = '#1d140a'; g.beginPath();
        g.moveTo(cx - 5, cy + 2); g.lineTo(cx - 5, cy - 7); g.arc(cx, cy - 7, 5, Math.PI, 0); g.lineTo(cx + 5, cy + 2); g.closePath(); g.fill();
        const gw = g.createLinearGradient(cx, cy - 6, cx, cy + 2);
        gw.addColorStop(0, '#4fa3d8'); gw.addColorStop(1, '#2b6491');
        g.fillStyle = gw; g.fillRect(cx - 4, cy - 5, 8, 6.5);
        g.strokeStyle = 'rgba(210,240,255,.6)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(cx - 3, cy - 1); g.lineTo(cx + 3, cy - 1); g.moveTo(cx - 2, cy - 3.5); g.lineTo(cx + 2, cy - 3.5); g.stroke();
        g.fillStyle = '#cfae6a'; g.fillRect(cx - 6, cy - 9, 12, 1.8); // stone lintel over the arch
      }
      const out = { cv: c, ax: cx, ay: cy, k: 2 };
      cache.set(key, out); return out;
    }

    if (type === 'storehouse') {
      // open-sided timber depot: posts, low-pitched roof, stacked goods & barrels
      const hw = s * 30, hh = s * 15, wallH2 = 20;
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath();
      g.moveTo(cx, cy - hh); g.lineTo(cx + hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx - hw, cy); g.closePath(); g.fill();
      // back-corner posts
      g.strokeStyle = '#5d4426'; g.lineWidth = 3.4;
      for (const [px2, py2] of [[cx - hw + 4, cy - 1], [cx, cy - hh + 1], [cx + hw - 4, cy - 1], [cx, cy + hh - 1]])
        { g.beginPath(); g.moveTo(px2, py2); g.lineTo(px2, py2 - wallH2); g.stroke(); }
      // stacked crates + sacks under the roof
      g.fillStyle = '#9c7e54'; g.strokeStyle = '#5d4426'; g.lineWidth = 1;
      g.fillRect(cx - 12, cy - 12, 10, 10); g.strokeRect(cx - 12, cy - 12, 10, 10);
      g.fillRect(cx - 1, cy - 9, 9, 8); g.strokeRect(cx - 1, cy - 9, 9, 8);
      g.strokeStyle = 'rgba(60,42,22,.5)'; g.beginPath(); g.moveTo(cx - 7, cy - 12); g.lineTo(cx - 7, cy - 2); g.stroke();
      for (const [bx2, by2, col] of [[cx + 9, cy + 2, '#c8a24a'], [cx + 13, cy + 4, '#b3895a']]) {
        g.fillStyle = col; g.beginPath(); g.ellipse(bx2, by2, 4, 5.5, 0, 0, 7); g.fill();
        g.strokeStyle = '#3a2a16'; g.lineWidth = 1; g.stroke();
      }
      // barrel
      g.fillStyle = '#7d5a2e'; g.beginPath(); g.ellipse(cx - 13, cy + 4, 4, 5.5, 0, 0, 7); g.fill();
      g.strokeStyle = '#3a2a16'; g.stroke();
      g.strokeStyle = '#9a7b54'; g.beginPath(); g.ellipse(cx - 13, cy + 4, 4, 2, 0, 0, 7); g.stroke();
      // low hip roof
      g.fillStyle = '#8a5a3a'; g.beginPath();
      g.moveTo(cx - hw - 3, cy - wallH2); g.lineTo(cx, cy - hh - wallH2 - 6);
      g.lineTo(cx + hw + 3, cy - wallH2); g.lineTo(cx, cy + hh - wallH2 + 2); g.closePath(); g.fill();
      g.fillStyle = '#6e4630'; g.beginPath();
      g.moveTo(cx + hw + 3, cy - wallH2); g.lineTo(cx, cy - hh - wallH2 - 6); g.lineTo(cx, cy + hh - wallH2 + 2); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(20,12,6,.4)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx - hw - 3, cy - wallH2); g.lineTo(cx, cy - hh - wallH2 - 6); g.lineTo(cx + hw + 3, cy - wallH2); g.stroke();
      flag(g, cx + hw - 6, cy - wallH2 - 2, colorIdx);
      ageDress(g, cx, cy, hw, hh, wallH2, age, colorIdx);
      const out = { cv: c, ax: cx, ay: cy, k: 2 };
      cache.set(key, out); return out;
    }

    if (type === 'dock') {
      // wooden pier deck on posts over the water, with a roofed hut + crane
      const deckY = cy - 7;
      g.strokeStyle = '#4e3f2a'; g.lineWidth = 3.4;
      for (const [px2, py2] of [[cx - s * 26, cy], [cx + s * 26, cy], [cx, cy + s * 13], [cx, cy - s * 13]])
        { g.beginPath(); g.moveTo(px2, py2 + 4); g.lineTo(px2, py2 - 8); g.stroke(); }
      g.fillStyle = '#a8895c'; g.strokeStyle = 'rgba(20,12,6,.5)'; g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(cx, deckY - s * 16); g.lineTo(cx + s * 32, deckY); g.lineTo(cx, deckY + s * 16); g.lineTo(cx - s * 32, deckY);
      g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(70,50,28,.45)'; g.lineWidth = 1;
      for (let i = -3; i <= 3; i++) {
        g.beginPath(); g.moveTo(cx + i * 8 - s * 14, deckY - s * 9 + i * 4);
        g.lineTo(cx + i * 8 + s * 13, deckY + i * 4 + s * 5); g.stroke();
      }
      // hut on the back half
      const hx2 = cx + s * 10, hy2 = deckY - s * 2;
      g.fillStyle = p.wallL; g.fillRect(hx2 - 14, hy2 - 22, 28, 22);
      g.strokeRect(hx2 - 14, hy2 - 22, 28, 22);
      g.fillStyle = '#241a10'; g.fillRect(hx2 - 4, hy2 - 12, 8, 12);
      roofFor(g, style, hx2, hy2 - 24, 0.9);
      // crane + crate + barrels
      g.strokeStyle = '#4e3f2a'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx - s * 16, deckY + 2); g.lineTo(cx - s * 16, deckY - 26); g.lineTo(cx - s * 26, deckY - 18); g.stroke();
      g.strokeStyle = '#241a10'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(cx - s * 26, deckY - 18); g.lineTo(cx - s * 26, deckY - 8); g.stroke();
      g.fillStyle = '#9c7e54'; g.fillRect(cx - s * 26 - 4, deckY - 8, 9, 8); g.strokeRect(cx - s * 26 - 4, deckY - 8, 9, 8);
      for (const bx2 of [cx - 4, cx + 4]) {
        g.fillStyle = '#8a6a48'; g.beginPath(); g.ellipse(bx2, deckY + s * 6, 4, 5.5, 0, 0, 7); g.fill();
        g.strokeStyle = '#3a2a16'; g.lineWidth = 1; g.stroke();
      }
      // moored rowboat + coiled rope
      g.fillStyle = '#9c7e54'; g.strokeStyle = 'rgba(20,12,6,.55)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(cx - s * 8, deckY + s * 14);
      g.quadraticCurveTo(cx, deckY + s * 18, cx + s * 8, deckY + s * 14);
      g.quadraticCurveTo(cx, deckY + s * 12, cx - s * 8, deckY + s * 14); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#241a10'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx - s * 4, deckY + s * 13); g.lineTo(cx - s * 6, deckY + s * 8); g.stroke();
      g.strokeStyle = '#b8a784'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(cx - s * 10, deckY + s * 4, 3, 0, 7); g.stroke();
      flag(g, cx + s * 26, deckY - s * 8, colorIdx);
      ageDress(g, cx, deckY, s * 28, s * 14, 18, age, colorIdx);
      const out = { cv: c, ax: cx, ay: cy, k: 2 };
      cache.set(key, out); return out;
    }

    if (type === 'grounds') {
      // open drill yard: fence ring, sparring dummies, weapon rack — no hall at all
      const hw = s * 30, hh = s * 15;
      g.fillStyle = '#8a7148'; // packed-earth yard
      g.beginPath(); g.moveTo(cx, cy - hh); g.lineTo(cx + hw, cy); g.lineTo(cx, cy + hh); g.lineTo(cx - hw, cy); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(70,50,28,.45)'; g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(cx, cy, hw * .5, hh * .5, 0, 0, 7); g.stroke(); // sparring circle
      // fence posts + rails along the yard edges
      g.strokeStyle = '#5d4426'; g.lineWidth = 2.6;
      for (let i = 0; i <= 4; i++) {
        const t2 = i / 4;
        for (const [px2, py2] of [
          [cx - hw + hw * t2, cy - hh * t2], [cx + hw * t2, cy - hh + hh * t2],
          [cx - hw + hw * t2, cy + hh * t2], [cx + hw * t2, cy + hh - hh * t2]]) {
          g.beginPath(); g.moveTo(px2, py2); g.lineTo(px2, py2 - 9); g.stroke();
        }
      }
      g.strokeStyle = '#6e5638'; g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(cx - hw, cy - 5); g.lineTo(cx, cy - hh - 5); g.lineTo(cx + hw, cy - 5);
      g.lineTo(cx, cy + hh - 5); g.closePath(); g.stroke();
      // two sparring dummies with padded bodies
      for (const [dx2, dy2] of [[cx - 12, cy - 2], [cx + 14, cy + 5]]) {
        g.strokeStyle = '#6e5638'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(dx2, dy2); g.lineTo(dx2, dy2 - 17); g.stroke();
        g.beginPath(); g.moveTo(dx2 - 8, dy2 - 11); g.lineTo(dx2 + 8, dy2 - 11); g.stroke();
        g.fillStyle = '#9a3b30'; g.fillRect(dx2 - 4, dy2 - 9, 8, 6);
        g.fillStyle = '#cdb279'; g.beginPath(); g.arc(dx2, dy2 - 19, 4, 0, 7); g.fill();
      }
      // spear rack
      g.strokeStyle = '#6e5638'; g.lineWidth = 1.7;
      for (let i = 0; i < 3; i++) {
        g.beginPath(); g.moveTo(cx - hw * .55 + i * 5, cy + 9); g.lineTo(cx - hw * .55 + 6 + i * 5, cy - 9); g.stroke();
        g.fillStyle = '#cfd6dd'; g.beginPath();
        g.moveTo(cx - hw * .55 + 6 + i * 5, cy - 9); g.lineTo(cx - hw * .55 + 4.4 + i * 5, cy - 13.4);
        g.lineTo(cx - hw * .55 + 8.2 + i * 5, cy - 11.4); g.closePath(); g.fill();
      }
      // tethered horse by the fence (cavalry drills here)
      drawHorse(g, cx + hw * .55, cy - hh * .3, colorIdx, 0);
      g.strokeStyle = '#241a10'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx + hw * .55 - 20, cy - hh * .3 - 28); g.lineTo(cx + hw * .55 - 26, cy - hh * .3 - 6); g.stroke();
      flag(g, cx, cy - hh - 9, colorIdx);
      const out = { cv: c, ax: cx, ay: cy, k: 2 };
      cache.set(key, out); return out;
    }

    if (type === 'stable') {
      // Open timber-frame horse barn with stall archways and visible horses
      const hw = s * 32, hh = s * 16, wallH2 = 22;
      isoBox(g, cx, cy, s, wallH2, '#c4a870', '#9a7a54', '#7a5e3c');
      // thatched roof
      const roofY2 = cy - wallH2;
      g.fillStyle = '#c8a04a';
      g.beginPath(); g.moveTo(cx - hw, roofY2); g.lineTo(cx, roofY2 - hh - 10); g.lineTo(cx + hw, roofY2); g.lineTo(cx, roofY2 + hh); g.closePath(); g.fill();
      g.fillStyle = '#a07c34';
      g.beginPath(); g.moveTo(cx + hw, roofY2); g.lineTo(cx, roofY2 - hh - 10); g.lineTo(cx, roofY2 + hh); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(80,60,20,.2)'; g.lineWidth = 1.1;
      for (let i = 1; i <= 4; i++) { const t2 = i / 5;
        g.beginPath(); g.moveTo(cx - hw * t2, roofY2 + hh * t2 - hh); g.lineTo(cx, roofY2 + hh - hh * t2); g.stroke();
        g.beginPath(); g.moveTo(cx + hw * t2, roofY2 + hh * t2 - hh); g.lineTo(cx, roofY2 + hh - hh * t2); g.stroke(); }
      // 3 arched stall openings on the front-left face
      for (let i = 0; i < 3; i++) {
        const t2 = 0.18 + i * 0.28, ax2 = cx - hw + hw * t2, ay2 = cy + hh * t2 - wallH2 * 0.28;
        g.fillStyle = '#241a10';
        g.beginPath(); g.moveTo(ax2 - 4.5, ay2 + 3); g.lineTo(ax2 - 4.5, ay2 - 7);
        g.quadraticCurveTo(ax2, ay2 - 13, ax2 + 4.5, ay2 - 7); g.lineTo(ax2 + 4.5, ay2 + 3); g.closePath(); g.fill();
        g.strokeStyle = '#6e5638'; g.lineWidth = 1; g.stroke();
        g.fillStyle = '#d4a83c'; g.fillRect(ax2 - 3.5, ay2 + 1, 7, 2.2); // hay
      }
      // vertical timber framing on left wall
      g.strokeStyle = 'rgba(60,40,20,.32)'; g.lineWidth = 1.2;
      for (let i = 1; i <= 3; i++) { const t2 = i / 4;
        g.beginPath(); g.moveTo(cx - hw + hw * t2, cy + hh * t2 - wallH2); g.lineTo(cx - hw + hw * t2, cy + hh * t2); g.stroke(); }
      // two horse heads visible in right-wall stalls
      g.fillStyle = '#8a6a48'; g.strokeStyle = 'rgba(20,12,6,.35)'; g.lineWidth = 0.9;
      for (const [ox, oy] of [[cx + hw * 0.38, cy - hh * 0.38 - 11], [cx + hw * 0.68, cy - hh * 0.68 - 7]]) {
        g.beginPath(); g.ellipse(ox, oy, 3.5, 3, -.3, 0, 7); g.fill(); g.stroke();
        g.beginPath(); g.ellipse(ox - 3.2, oy - 0.5, 2, 1.5, 0, 0, 7); g.fill(); // muzzle
        g.strokeStyle = '#3a2c1c'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(ox - 1, oy - 3.5); g.quadraticCurveTo(ox + 0.5, oy - 5.5, ox + 2, oy - 3.5); g.stroke();
        g.strokeStyle = 'rgba(20,12,6,.35)'; g.lineWidth = 0.9;
      }
      ageDress(g, cx, cy, hw, hh, wallH2, age, colorIdx);
      flag(g, cx + hw * .5, cy - hh * .5 - wallH2 - 2, colorIdx);
      const outS = { cv: c, ax: cx, ay: cy, k: 2 };
      cache.set(key, outS); return outS;
    }

    const wallH = type === 'tower' ? 46 : type === 'tc' || type === 'town' ? 26 : 20;
    if (type === 'tower') {
      // tapered watchtower with arrow slits and a lit brazier
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(cx, cy, 20, 9, 0, 0, 7); g.fill();
      const gr = g.createLinearGradient(cx - 14, 0, cx + 14, 0);
      gr.addColorStop(0, p.wallL); gr.addColorStop(.55, p.top); gr.addColorStop(1, p.wallR);
      g.fillStyle = gr; g.beginPath();
      g.moveTo(cx - 14, cy - 2); g.lineTo(cx - 10, cy - wallH); g.lineTo(cx + 10, cy - wallH); g.lineTo(cx + 14, cy - 2);
      g.ellipse(cx, cy - 2, 14, 6, 0, 0, Math.PI); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(20,12,6,.45)'; g.stroke();
      // stone courses
      g.strokeStyle = 'rgba(20,12,6,.14)'; g.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        const yy = cy - 2 - (wallH - 4) * i / 4, ww = 14 - 4 * i / 4;
        g.beginPath(); g.moveTo(cx - ww, yy); g.lineTo(cx + ww, yy); g.stroke();
      }
      // overhanging parapet
      g.fillStyle = p.top; g.beginPath(); g.ellipse(cx, cy - wallH, 13, 5, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = p.wallR;
      for (let i = -1; i <= 1; i++) g.fillRect(cx + i * 9 - 2.5, cy - wallH - 6, 5, 7);
      // arrow slits + door
      g.fillStyle = '#241a10';
      g.fillRect(cx - 1.4, cy - wallH + 9, 2.8, 8);
      g.fillRect(cx - 7.5, cy - wallH + 20, 2.4, 6.5);
      g.fillRect(cx + 5.1, cy - wallH + 20, 2.4, 6.5);
      g.beginPath(); g.moveTo(cx - 4, cy + 2); g.lineTo(cx - 4, cy - 8); g.arc(cx, cy - 8, 4, Math.PI, 0); g.lineTo(cx + 4, cy + 2); g.closePath(); g.fill();
      // brazier flame
      g.fillStyle = '#6b6557'; g.beginPath(); g.arc(cx, cy - wallH - 7, 3, 0, 7); g.fill();
      g.fillStyle = '#ff7a30'; g.beginPath();
      g.moveTo(cx - 2.5, cy - wallH - 8); g.quadraticCurveTo(cx, cy - wallH - 17, cx + 2.5, cy - wallH - 8); g.closePath(); g.fill();
      g.fillStyle = '#ffc14d'; g.beginPath();
      g.moveTo(cx - 1.2, cy - wallH - 8.5); g.quadraticCurveTo(cx, cy - wallH - 13, cx + 1.2, cy - wallH - 8.5); g.closePath(); g.fill();
      flag(g, cx, cy - wallH - 16, colorIdx);
      ageDress(g, cx, cy, 15, 6, wallH, age, colorIdx);
      const out = { cv: c, ax: cx, ay: cy, k: 2 }; cache.set(key, out); return out;
    }

    if (type === 'keep') {
      // wall integration: draw connecting slabs toward any adjacent wall/gate/keep tiles
      const kMask = parseInt(variant, 10) || 0;
      if (kMask) {
        const KEL = 20, KSW = 5.5;
        const kStoneT = style === 'rome' ? '#ddd6c4' : p.top;
        const kStoneL = style === 'rome' ? '#c2bba8' : p.wallL;
        const kStoneR = style === 'rome' ? '#9b9482' : p.wallR;
        function keepSlab(vx2, vy2) {
          const len = Math.hypot(vx2, vy2);
          const px2 = -vy2 / len * KSW, py2 = vx2 / len * KSW;
          const quad = [[cx+px2,cy+py2],[cx+px2+vx2,cy+py2+vy2],[cx-px2+vx2,cy-py2+vy2],[cx-px2,cy-py2]];
          for (const [a, b2] of [[quad[0],quad[1]],[quad[3],quad[2]],[quad[1],quad[2]]]) {
            if ((a[1]+b2[1])/2 < cy-1) continue;
            g.fillStyle = (a[0]+b2[0])/2 < cx ? kStoneL : kStoneR;
            g.strokeStyle='rgba(20,12,6,.4)'; g.lineWidth=1;
            g.beginPath(); g.moveTo(a[0],a[1]-KEL); g.lineTo(b2[0],b2[1]-KEL);
            g.lineTo(b2[0],b2[1]); g.lineTo(a[0],a[1]); g.closePath(); g.fill(); g.stroke();
            g.strokeStyle='rgba(20,12,6,.16)';
            g.beginPath(); g.moveTo(a[0],a[1]-KEL*.5); g.lineTo(b2[0],b2[1]-KEL*.5); g.stroke();
          }
          g.fillStyle=kStoneT; g.strokeStyle='rgba(20,12,6,.4)'; g.lineWidth=1;
          g.beginPath(); g.moveTo(quad[0][0],quad[0][1]-KEL);
          for (let i=1;i<4;i++) g.lineTo(quad[i][0],quad[i][1]-KEL);
          g.closePath(); g.fill(); g.stroke();
        }
        const kSegs = [];
        if (kMask & 2) kSegs.push([-16,-8]);
        if (kMask & 8) kSegs.push([16,-8]);
        if (kMask & 4) kSegs.push([-16,8]);
        if (kMask & 1) kSegs.push([16,8]);
        for (const [vx2,vy2] of kSegs) if (vy2 < 0) keepSlab(vx2,vy2);
        for (const [vx2,vy2] of kSegs) if (vy2 > 0) keepSlab(vx2,vy2);
      }
      // a great wall tower: tall, broad-shouldered, machicolated, bristling with archers
      const KH = 66, BW = 19; // tower height & half-width
      g.fillStyle = 'rgba(0,0,0,.26)'; g.beginPath(); g.ellipse(cx, cy, 26, 11, 0, 0, 7); g.fill();
      const gr = g.createLinearGradient(cx - BW, 0, cx + BW, 0);
      gr.addColorStop(0, p.wallL); gr.addColorStop(.55, p.top); gr.addColorStop(1, p.wallR);
      g.fillStyle = gr; g.beginPath();
      g.moveTo(cx - BW, cy - 2); g.lineTo(cx - BW + 3, cy - KH); g.lineTo(cx + BW - 3, cy - KH); g.lineTo(cx + BW, cy - 2);
      g.ellipse(cx, cy - 2, BW, 8, 0, 0, Math.PI); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(20,12,6,.5)'; g.lineWidth = 1.2; g.stroke();
      // stone courses
      g.strokeStyle = 'rgba(20,12,6,.16)'; g.lineWidth = 1;
      for (let i = 1; i <= 5; i++) { const yy = cy - 2 - (KH - 6) * i / 6, ww = BW - 3 * i / 6;
        g.beginPath(); g.moveTo(cx - ww, yy); g.lineTo(cx + ww, yy); g.stroke(); }
      // machicolated overhang + battlements
      g.fillStyle = p.wallR; g.fillRect(cx - BW - 2, cy - KH - 4, (BW + 2) * 2, 6);
      g.fillStyle = p.top; g.beginPath(); g.ellipse(cx, cy - KH - 4, BW + 2, 6, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(20,12,6,.5)'; g.stroke();
      g.fillStyle = p.wallR;
      for (let i = -2; i <= 2; i++) g.fillRect(cx + i * 8 - 3, cy - KH - 13, 6, 9); // merlons
      // arrow slits up the shaft + a great door
      g.fillStyle = '#201509';
      for (const yy of [KH - 14, KH - 28, KH - 42]) { g.fillRect(cx - 9, cy - yy, 2.6, 9); g.fillRect(cx + 6.4, cy - yy, 2.6, 9); g.fillRect(cx - 1.3, cy - yy - 4, 2.6, 9); }
      g.beginPath(); g.moveTo(cx - 6, cy + 1); g.lineTo(cx - 6, cy - 11); g.arc(cx, cy - 11, 6, Math.PI, 0); g.lineTo(cx + 6, cy + 1); g.closePath(); g.fill();
      // twin oil cauldrons steaming on the parapet
      for (const sx2 of [-10, 10]) {
        g.fillStyle = '#33291f'; g.beginPath(); g.ellipse(cx + sx2, cy - KH - 10, 3.4, 2.2, 0, 0, 7); g.fill();
        g.fillStyle = '#ff8a2a'; g.beginPath(); g.arc(cx + sx2, cy - KH - 11, 1.6, 0, 7); g.fill();
        g.strokeStyle = 'rgba(150,150,150,.5)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(cx + sx2, cy - KH - 13); g.quadraticCurveTo(cx + sx2 + 2, cy - KH - 18, cx + sx2, cy - KH - 22); g.stroke();
      }
      flag(g, cx, cy - KH - 20, colorIdx);
      ageDress(g, cx, cy, BW, 8, KH, age, colorIdx);
      const out = { cv: c, ax: cx, ay: cy, k: 2 }; cache.set(key, out); return out;
    }

    if (type === 'castle') {
      // Grand fortress — central keep flanked by round towers, battlements all around
      const CH = 58, BW = 22;
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(cx, cy, 38, 16, 0, 0, 7); g.fill();
      // central keep body
      const kGrad = g.createLinearGradient(cx - BW, 0, cx + BW, 0);
      kGrad.addColorStop(0, p.wallL); kGrad.addColorStop(.5, p.top); kGrad.addColorStop(1, p.wallR);
      g.fillStyle = kGrad;
      g.beginPath(); g.moveTo(cx - BW, cy - 3); g.lineTo(cx - BW + 4, cy - CH);
      g.lineTo(cx + BW - 4, cy - CH); g.lineTo(cx + BW, cy - 3);
      g.ellipse(cx, cy - 3, BW, 10, 0, 0, Math.PI); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(20,12,6,.55)'; g.lineWidth = 1.3; g.stroke();
      // stone courses on keep
      g.strokeStyle = 'rgba(20,12,6,.15)'; g.lineWidth = 1;
      for (let i = 1; i <= 5; i++) {
        const yy = cy - 3 - (CH - 6) * i / 6, ww = BW - 4 * i / 6;
        g.beginPath(); g.moveTo(cx - ww, yy); g.lineTo(cx + ww, yy); g.stroke();
      }
      // parapet + merlons on keep
      g.fillStyle = p.wallR; g.fillRect(cx - BW - 2, cy - CH - 4, (BW + 2) * 2, 6);
      g.fillStyle = p.top; g.beginPath(); g.ellipse(cx, cy - CH - 4, BW + 2, 6, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(20,12,6,.5)'; g.stroke();
      g.fillStyle = p.wallR;
      for (let i = -3; i <= 3; i++) g.fillRect(cx + i * 8 - 3, cy - CH - 14, 6, 11);
      // grand portcullis gate
      g.fillStyle = '#1a120a'; g.beginPath();
      g.moveTo(cx - 10, cy + 2); g.lineTo(cx - 10, cy - 14);
      g.arc(cx, cy - 14, 10, Math.PI, 0); g.lineTo(cx + 10, cy + 2); g.closePath(); g.fill();
      const ptc = g.createLinearGradient(cx, cy - 20, cx, cy + 2);
      ptc.addColorStop(0, '#4a3828'); ptc.addColorStop(1, '#2e2218');
      g.fillStyle = ptc; g.beginPath();
      g.moveTo(cx - 9, cy + 1); g.lineTo(cx - 9, cy - 13);
      g.arc(cx, cy - 13, 9, Math.PI, 0); g.lineTo(cx + 9, cy + 1); g.closePath(); g.fill();
      g.strokeStyle = '#8a6a42'; g.lineWidth = 1;
      for (let gx = cx - 7; gx <= cx + 7; gx += 4.5) { g.beginPath(); g.moveTo(gx, cy + 1); g.lineTo(gx, cy - 20); g.stroke(); }
      for (const gy of [cy - 5, cy - 12]) { g.beginPath(); g.moveTo(cx - 9, gy); g.lineTo(cx + 9, gy); g.stroke(); }
      // portcullis spikes at the bottom
      g.fillStyle = '#6a5030';
      for (let gx = cx - 7; gx <= cx + 7; gx += 4.5) { g.beginPath(); g.moveTo(gx - 1.2, cy + 1); g.lineTo(gx + 1.2, cy + 1); g.lineTo(gx, cy + 4); g.closePath(); g.fill(); }
      // two flanking round towers
      for (const [tx, tdir] of [[cx - s * 28, -1], [cx + s * 28, 1]]) {
        const ty = cy + (tdir < 0 ? s * 14 : -s * 14);
        const TH = 48, TW = 13;
        g.fillStyle = tdir < 0 ? p.wallL : p.wallR;
        g.beginPath(); g.moveTo(tx - TW, ty - 2); g.lineTo(tx - TW + 3, ty - TH);
        g.lineTo(tx + TW - 3, ty - TH); g.lineTo(tx + TW, ty - 2);
        g.ellipse(tx, ty - 2, TW, 5, 0, 0, Math.PI); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(20,12,6,.45)'; g.lineWidth = 1; g.stroke();
        g.strokeStyle = 'rgba(20,12,6,.14)';
        for (let i = 1; i <= 3; i++) {
          const yy = ty - 2 - (TH - 4) * i / 4, ww = TW - 3 * i / 4;
          g.beginPath(); g.moveTo(tx - ww, yy); g.lineTo(tx + ww, yy); g.stroke();
        }
        g.fillStyle = tdir < 0 ? p.wallL : p.wallR;
        g.fillRect(tx - TW - 1, ty - TH - 3, (TW + 1) * 2, 5);
        g.fillStyle = p.top; g.beginPath(); g.ellipse(tx, ty - TH - 3, TW + 1, 5, 0, 0, 7); g.fill();
        g.strokeStyle = 'rgba(20,12,6,.5)'; g.stroke();
        g.fillStyle = tdir < 0 ? p.wallL : p.wallR;
        for (let i = -1; i <= 1; i++) g.fillRect(tx + i * 7 - 2.5, ty - TH - 11, 5, 8);
        g.fillStyle = '#1a120a'; g.fillRect(tx - 2, ty - TH + 10, 4, 8); // arrow slit
        // oil cauldron on tower roof
        g.fillStyle = '#33291f'; g.beginPath(); g.ellipse(tx, ty - TH - 8, 3, 2, 0, 0, 7); g.fill();
        g.fillStyle = '#ff6a20'; g.beginPath(); g.arc(tx, ty - TH - 9, 1.4, 0, 7); g.fill();
      }
      // arrow slits on keep
      g.fillStyle = '#1a120a';
      for (const [slx, sly] of [[cx - 11, cy - CH + 18], [cx + 9, cy - CH + 18], [cx - 1.5, cy - CH + 8]]) {
        g.fillRect(slx, sly, 3, 10);
      }
      // age dressing on the keep
      ageDress(g, cx, cy, BW, 10, CH, age, colorIdx);
      flag(g, cx, cy - CH - 19, colorIdx);
      flag(g, cx - s * 28, cy + s * 14 - 48 - 14, colorIdx);
      const out = { cv: c, ax: cx, ay: cy, k: 2 }; cache.set(key, out); return out;
    }

    isoBox(g, cx, cy, s, wallH, p.top, p.wallL, p.wallR);

    // door
    g.fillStyle = '#241a10'; g.beginPath();
    g.moveTo(cx - s * 13, cy + s * 7 - 1); g.lineTo(cx - s * 13, cy + s * 7 - 13); g.lineTo(cx - s * 7, cy + s * 10 - 13); g.lineTo(cx - s * 7, cy + s * 10 - 1); g.closePath(); g.fill();

    // civ roof on top
    roofFor(g, type === 'town' ? 'flat' : style, cx, cy - wallH, s);
    if (type === 'town') { // raised inner keep so towns read as fortresses
      isoBox(g, cx, cy - wallH - 6, s * 0.52, 22, p.top, p.wallL, p.wallR);
      roofFor(g, 'flat', cx, cy - wallH - 28, s * 0.52);
      g.fillStyle = '#241a10';
      g.fillRect(cx - 2.5, cy - wallH - 20, 5, 7); // keep window
      flag(g, cx, cy - wallH - 36, colorIdx);
    }

    // wall texture: subtle masonry / plank courses on both wall faces
    g.strokeStyle = 'rgba(20,12,6,.13)'; g.lineWidth = 1;
    for (const f of [0.36, 0.68]) {
      const yo = wallH * f;
      g.beginPath(); g.moveTo(cx - s * 32, cy - yo); g.lineTo(cx, cy + s * 16 - yo); g.lineTo(cx + s * 32, cy - yo); g.stroke();
    }
    // windows on the big halls
    if (type === 'tc' || type === 'barracks' || type === 'range' || type === 'university') {
      g.fillStyle = '#241a10';
      for (const t2 of [0.3, 0.62]) {
        const wx2 = cx + s * 32 * t2, wy2 = cy + s * 16 * t2 - wallH * 0.62;
        g.fillRect(wx2 - 2.2, wy2, 4.4, 6); // right wall
      }
    }

    // ---- signature structures per type ----
    if (type === 'tc') {
      // ---- grand town hall: stone steps, full colonnade, banners, bell tower ----
      const tc2 = teamCols(colorIdx);
      // stepped stone plinth (3 courses) along the front-left & front-right faces
      for (let stp = 0; stp < 3; stp++) {
        const yo = cy - stp * 2.4, ext = (3 - stp) * 3;
        g.fillStyle = stp % 2 ? '#cfc7b4' : '#ddd6c4';
        g.beginPath();
        g.moveTo(cx - s * 32 - ext, yo); g.lineTo(cx, yo + s * 16 + ext * 0.5);
        g.lineTo(cx + s * 32 + ext, yo); g.lineTo(cx, yo - s * 16 - ext * 0.5);
        g.closePath(); g.fill();
      }
      // re-stamp the main hall body over the plinth so columns sit on it
      isoBox(g, cx, cy - 6, s, wallH, p.top, p.wallL, p.wallR);
      // grand entrance: tall arched doorway with steps
      g.fillStyle = '#2a1f12';
      g.beginPath();
      g.moveTo(cx - s * 8, cy + s * 8 - 6); g.lineTo(cx - s * 8, cy - 4);
      g.quadraticCurveTo(cx, cy - 16, cx + s * 8, cy - 4); g.lineTo(cx + s * 8, cy + s * 8 - 6);
      g.closePath(); g.fill();
      g.strokeStyle = '#8a6420'; g.lineWidth = 1.4; g.stroke();
      // full marble colonnade across the front-left face
      const colCol = style === 'china' ? '#b34a3a' : '#ece4d2';
      for (let i = 0; i < 5; i++) {
        const t2 = 0.1 + i * 0.2, capx = cx - s * 32 + s * 32 * t2, capy = cy + s * 16 * t2 - 6;
        g.fillStyle = colCol; g.fillRect(capx - 2.6, capy - wallH + 1, 5.2, wallH - 2);
        g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(capx + 1, capy - wallH + 1, 1.6, wallH - 2); // shade
        g.fillStyle = '#f3ecda'; g.fillRect(capx - 3.4, capy - wallH, 6.8, 2.2);       // capital
        g.fillRect(capx - 3.4, capy - 3, 6.8, 2.2);                                     // base
      }
      // civ roof: gabled pediment (rome), tiered (china), dome (india)
      roofFor(g, style, cx, cy - wallH - 6, s);
      // central bell tower rising above the hall
      const tx = cx, tbase = cy - wallH - 12;
      g.fillStyle = p.wallL; g.fillRect(tx - 9, tbase - 22, 9, 24);
      g.fillStyle = p.wallR; g.fillRect(tx, tbase - 22, 9, 24);
      g.strokeStyle = 'rgba(20,12,6,.4)'; g.lineWidth = 1; g.strokeRect(tx - 9, tbase - 22, 18, 24);
      g.fillStyle = '#2a1f12'; g.beginPath(); // bell arch
      g.moveTo(tx - 5, tbase - 4); g.lineTo(tx - 5, tbase - 12);
      g.quadraticCurveTo(tx, tbase - 18, tx + 5, tbase - 12); g.lineTo(tx + 5, tbase - 4); g.closePath(); g.fill();
      g.fillStyle = '#c9a34f'; g.beginPath(); g.ellipse(tx, tbase - 9, 3, 3.5, 0, 0, 7); g.fill(); // bell
      g.fillStyle = '#8a6420'; g.fillRect(tx - 0.8, tbase - 6, 1.6, 2);
      roofFor(g, style === 'india' ? 'india' : style === 'china' ? 'china' : 'rome', tx, tbase - 24, s * 0.34);
      flag(g, tx, tbase - 24 - s * 6, colorIdx);
      // hanging banners flanking the entrance
      for (const bxs of [-1, 1]) {
        const bxp = cx + bxs * s * 13;
        g.fillStyle = tc2.main; g.strokeStyle = tc2.dark; g.lineWidth = 1;
        g.beginPath(); g.moveTo(bxp - 4, cy - wallH + 2); g.lineTo(bxp + 4, cy - wallH + 2);
        g.lineTo(bxp + 4, cy - 4); g.lineTo(bxp, cy); g.lineTo(bxp - 4, cy - 4); g.closePath();
        g.fill(); g.stroke();
        g.fillStyle = '#e7cf8e'; g.beginPath(); g.arc(bxp, cy - wallH * 0.55, 2, 0, 7); g.fill();
      }
    }
    if (type === 'town') { // corner watch-turrets make it a fortress at a glance
      for (const [tx2, ty2] of [[cx - s * 32, cy], [cx + s * 32, cy], [cx, cy - s * 16], [cx, cy + s * 16]]) {
        const gr2 = g.createLinearGradient(tx2 - 5, 0, tx2 + 5, 0);
        gr2.addColorStop(0, p.wallL); gr2.addColorStop(1, p.wallR);
        g.fillStyle = gr2; g.strokeStyle = 'rgba(20,12,6,.45)'; g.lineWidth = 1;
        g.fillRect(tx2 - 5, ty2 - wallH - 8, 10, wallH + 8); g.strokeRect(tx2 - 5, ty2 - wallH - 8, 10, wallH + 8);
        g.fillStyle = p.top;
        for (let i = -1; i <= 1; i++) g.fillRect(tx2 + i * 3.6 - 1.4, ty2 - wallH - 12, 2.8, 4.5);
      }
    }
    if (type === 'university') {
      // stepped stone base + full colonnade + golden orb: a temple of learning
      g.fillStyle = 'rgba(255,255,255,.18)';
      g.beginPath(); g.moveTo(cx - s * 32, cy); g.lineTo(cx, cy + s * 16); g.lineTo(cx + s * 32, cy);
      g.lineTo(cx + s * 32, cy - 3); g.lineTo(cx, cy + s * 16 - 3); g.lineTo(cx - s * 32, cy - 3); g.closePath(); g.fill();
      g.fillStyle = style === 'china' ? '#9c2f2f' : '#e3dccb';
      for (let i = 0; i < 5; i++) {
        const t2 = 0.12 + i * 0.19;
        g.fillRect(cx - s * 32 + s * 32 * t2 - 2.2, cy + s * 16 * t2 - wallH + 2, 4.4, wallH - 3);
      }
      g.fillStyle = '#e7cf8e'; g.strokeStyle = '#8a6420'; g.lineWidth = 1; // golden orb finial
      g.beginPath(); g.arc(cx, cy - wallH - (style === 'india' ? s * 18 : s * 12), 4, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - 1.2, cy - wallH - (style === 'india' ? s * 18 : s * 12) - 1.2, 1.2, 0, 7); g.fill();
    }
    if (type === 'barracks') {
      // shield wall on the facade + crossed swords standard + spear rack
      for (let i = 0; i < 3; i++) {
        const t2 = 0.25 + i * 0.22;
        const sx3 = cx - s * 32 + s * 32 * t2, sy3 = cy + s * 16 * t2 - wallH * 0.45;
        const tcb = teamCols(colorIdx);
        const gr2 = g.createRadialGradient(sx3 - 1, sy3 - 1, 1, sx3, sy3, 4.6);
        gr2.addColorStop(0, tcb.light); gr2.addColorStop(1, tcb.dark);
        g.fillStyle = gr2; g.strokeStyle = 'rgba(20,12,6,.55)'; g.lineWidth = 1;
        g.beginPath(); g.arc(sx3, sy3, 4.6, 0, 7); g.fill(); g.stroke();
        g.fillStyle = '#e7cf8e'; g.beginPath(); g.arc(sx3, sy3, 1.3, 0, 7); g.fill();
      }
      // crossed swords above the door
      g.save(); g.translate(cx - s * 10, cy + s * 8.5 - wallH - 4);
      for (const a of [-0.6, 0.6]) {
        g.save(); g.rotate(a);
        g.fillStyle = '#d7dde4'; g.fillRect(-1.1, -8, 2.2, 12);
        g.fillStyle = '#8a6420'; g.fillRect(-2.6, 1.6, 5.2, 1.8);
        g.restore();
      }
      g.restore();
      g.strokeStyle = '#6e5638'; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx + s * 20 + i * 5, cy + 4); g.lineTo(cx + s * 26 + i * 5, cy - 16); g.stroke(); }
      g.fillStyle = '#cfd6dd';
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx + s * 26 + i * 5, cy - 16); g.lineTo(cx + s * 24 + i * 5, cy - 21); g.lineTo(cx + s * 28 + i * 5, cy - 19); g.closePath(); g.fill(); }
      // forge: glowing furnace mouth + anvil + quench barrel (the armory is a workshop)
      const fgx = cx - s * 24, fgy = cy + s * 2;
      g.fillStyle = '#57534a'; g.strokeStyle = 'rgba(20,12,6,.5)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(fgx - 8, fgy); g.lineTo(fgx - 8, fgy - 12); g.arc(fgx, fgy - 12, 8, Math.PI, 0); g.lineTo(fgx + 8, fgy); g.closePath(); g.fill(); g.stroke();
      const fg = g.createRadialGradient(fgx, fgy - 4, 1, fgx, fgy - 4, 6.5);
      fg.addColorStop(0, '#ffd34d'); fg.addColorStop(.55, '#ff7a30'); fg.addColorStop(1, '#9a3b30');
      g.fillStyle = fg; g.beginPath(); g.moveTo(fgx - 5, fgy); g.lineTo(fgx - 5, fgy - 8); g.arc(fgx, fgy - 8, 5, Math.PI, 0); g.lineTo(fgx + 5, fgy); g.closePath(); g.fill();
      g.fillStyle = '#3f3a33'; // anvil
      g.fillRect(fgx + 11, fgy - 7, 9, 3.4); g.fillRect(fgx + 13.5, fgy - 4, 4, 4.5);
      g.beginPath(); g.moveTo(fgx + 20, fgy - 7); g.lineTo(fgx + 24, fgy - 5.4); g.lineTo(fgx + 20, fgy - 3.6); g.closePath(); g.fill();
      // armor stand: cuirass + helm on a post
      const asx = cx - s * 28, asy = cy - s * 6;
      g.strokeStyle = '#5d4426'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(asx, asy + 6); g.lineTo(asx, asy - 12); g.stroke();
      g.beginPath(); g.moveTo(asx - 6, asy - 8); g.lineTo(asx + 6, asy - 8); g.stroke();
      const tcb2 = teamCols(colorIdx);
      g.fillStyle = tcb2.main; g.strokeStyle = 'rgba(20,12,6,.55)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(asx - 4.5, asy - 8); g.lineTo(asx + 4.5, asy - 8); g.lineTo(asx + 3.4, asy + 1); g.lineTo(asx - 3.4, asy + 1); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#9aa2ad'; g.beginPath(); g.arc(asx, asy - 12.5, 3.6, Math.PI, 0); g.fill(); g.stroke();
    }
    if (type === 'range') {
      // striped shooting awning + big target + arrow barrel
      const ax2 = cx + s * 14, ay2 = cy + s * 2;
      g.strokeStyle = '#5d4426'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(ax2 - 10, ay2 + 8); g.lineTo(ax2 - 10, ay2 - 14); g.stroke();
      g.beginPath(); g.moveTo(ax2 + 12, ay2 + 2); g.lineTo(ax2 + 12, ay2 - 18); g.stroke();
      for (let i = 0; i < 4; i++) { // striped canopy
        g.fillStyle = i % 2 ? '#e8e0ce' : '#c4543f';
        g.beginPath();
        g.moveTo(ax2 - 12 + i * 6.5, ay2 - 14 - i * 1.2); g.lineTo(ax2 - 5.5 + i * 6.5, ay2 - 15.2 - i * 1.2);
        g.lineTo(ax2 - 3.5 + i * 6.5, ay2 - 22 - i * 1.2); g.lineTo(ax2 - 10 + i * 6.5, ay2 - 20.8 - i * 1.2);
        g.closePath(); g.fill();
      }
      const tx = cx + s * 24, ty = cy + 4;
      for (const [r, col] of [[8.5, '#e8e0ce'], [6, '#c4543f'], [3.4, '#e8e0ce'], [1.6, '#c4543f']]) {
        g.fillStyle = col; g.beginPath(); g.ellipse(tx, ty, r, r * .8, 0, 0, 7); g.fill();
      }
      g.strokeStyle = '#6e5638'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(tx - 5, ty + 10); g.lineTo(tx, ty + 5); g.lineTo(tx + 5, ty + 10); g.stroke();
      // barrel of arrows
      g.fillStyle = '#8a6a48'; g.strokeStyle = '#3a2a16'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(cx - s * 22, cy + s * 6, 4.5, 5.5, 0, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = '#9a7b54'; g.lineWidth = 1.2;
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(cx - s * 22 + i * 2, cy + s * 6 - 4); g.lineTo(cx - s * 22 + i * 3.4, cy + s * 6 - 12); g.stroke(); }
    }
    // civilization accents
    if (style === 'china' && (type === 'tc' || type === 'barracks' || type === 'range' || type === 'university')) {
      for (const lx of [cx - s * 30, cx + s * 30]) { // red lanterns at the eaves
        g.strokeStyle = '#3a2a16'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(lx, cy - wallH - 2); g.lineTo(lx, cy - wallH + 4); g.stroke();
        g.fillStyle = '#d04a35'; g.beginPath(); g.ellipse(lx, cy - wallH + 8, 3.4, 4.2, 0, 0, 7); g.fill();
        g.fillStyle = '#ffd34d'; g.fillRect(lx - 1, cy - wallH + 12.2, 2, 2.6);
      }
    }
    if (style === 'india' && (type === 'tc' || type === 'barracks' || type === 'range')) {
      for (const fx2 of [cx - s * 26, cx + s * 26]) { // gold corner finials
        g.fillStyle = '#d4a647';
        g.beginPath(); g.moveTo(fx2 - 2.4, cy - wallH - 1); g.lineTo(fx2 + 2.4, cy - wallH - 1); g.lineTo(fx2, cy - wallH - 8); g.closePath(); g.fill();
      }
    }
    flag(g, cx + s * 28, cy - wallH - 2, colorIdx);
    if (type === 'tc' || type === 'town') flag(g, cx - s * 28, cy - wallH - 2, colorIdx);
    ageDress(g, cx, cy, s * 32, s * 16, wallH, age, colorIdx);

    const out = { cv: c, ax: cx, ay: cy, k: 2 };
    cache.set(key, out); return out;
  }

  /* ---------------- icons (HUD) ---------------- */
  function icon(name) {
    const key = `i_${name}`;
    if (cache.has(key)) return cache.get(key);
    const c = mk(26, 26), g = g2(c);
    g.lineWidth = 1.6; g.strokeStyle = 'rgba(20,12,6,.7)';
    switch (name) {
      case 'food': g.fillStyle = '#c97e4f'; g.beginPath(); g.ellipse(11, 13, 7.5, 5.5, -.6, 0, 7); g.fill(); g.stroke();
        g.fillStyle = '#e8e0ce'; g.beginPath(); g.arc(19, 6.5, 3, 0, 7); g.fill();
        g.strokeStyle = '#e8e0ce'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(15, 10); g.lineTo(19, 6.5); g.stroke(); break;
      case 'wood': g.fillStyle = '#8a6a48'; g.save(); g.translate(13, 13); g.rotate(.5);
        g.fillRect(-9, -4, 18, 8); g.strokeRect(-9, -4, 18, 8); g.restore();
        g.fillStyle = '#cdb279'; g.beginPath(); g.ellipse(18.5, 16, 3, 4, .5, 0, 7); g.fill(); g.stroke();
        g.strokeStyle = '#9a7b54'; g.lineWidth = 1; g.beginPath(); g.ellipse(18.5, 16, 1.4, 2, .5, 0, 7); g.stroke(); break;
      case 'gold': for (const [x, y] of [[10, 16], [16, 16], [13, 11]]) {
          g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.stroke();
          g.strokeStyle = '#b8924a'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, 3, 0, 7); g.stroke();
          g.strokeStyle = 'rgba(20,12,6,.7)'; g.lineWidth = 1.6; } break;
      case 'stone': g.fillStyle = '#9a948a';
        g.beginPath(); g.moveTo(4, 18); g.lineTo(8, 9); g.lineTo(15, 8); g.lineTo(20, 13); g.lineTo(18, 19); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#c2bcae'; g.beginPath(); g.moveTo(8, 9); g.lineTo(15, 8); g.lineTo(13, 13); g.closePath(); g.fill(); break;
      case 'iron': g.fillStyle = '#7d7872'; g.beginPath();
        g.moveTo(5, 18); g.lineTo(8, 11); g.lineTo(18, 11); g.lineTo(21, 18); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#a8a39c'; g.fillRect(8, 11, 10, 2.4);
        g.fillStyle = '#b3543b'; g.fillRect(10, 14, 3, 1.6); break;
      case 'knowledge': g.fillStyle = '#e8dcc3'; g.beginPath(); g.roundRect(6, 5, 14, 16, 2); g.fill(); g.stroke();
        g.fillStyle = '#b8924a'; g.fillRect(4, 4, 4, 18);
        g.strokeStyle = '#8a7148'; g.lineWidth = 1.1;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(10, 9 + i * 3.4); g.lineTo(17, 9 + i * 3.4); g.stroke(); } break;
      case 'pop': g.fillStyle = '#cdbb96'; g.beginPath(); g.arc(13, 8.5, 4.2, 0, 7); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(5.5, 21); g.quadraticCurveTo(13, 11, 20.5, 21); g.closePath(); g.fill(); g.stroke(); break;
      case 'attack': g.strokeStyle = '#d7dde4'; g.lineWidth = 3; g.beginPath(); g.moveTo(6, 20); g.lineTo(19, 7); g.stroke();
        g.strokeStyle = '#8a6420'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(8.5, 13.5); g.lineTo(13, 18); g.stroke(); break;
      case 'age': g.strokeStyle = '#ffd34d'; g.lineWidth = 2;
        g.beginPath(); g.arc(13, 14, 8, Math.PI * .8, Math.PI * 2.2); g.stroke();
        g.fillStyle = '#ffd34d'; for (let i = 0; i < 5; i++) { const a = Math.PI * .8 + i * Math.PI * 1.4 / 4;
          g.beginPath(); g.ellipse(13 + Math.cos(a) * 8, 14 + Math.sin(a) * 8, 2.6, 1.4, a, 0, 7); g.fill(); } break;
      case 'flag': g.strokeStyle = '#6e5638'; g.lineWidth = 2; g.beginPath(); g.moveTo(8, 22); g.lineTo(8, 4); g.stroke();
        g.fillStyle = '#c4543f'; g.beginPath(); g.moveTo(8, 4); g.lineTo(21, 7.5); g.lineTo(8, 11); g.closePath(); g.fill(); break;
      case 'axe2': g.strokeStyle = '#6e5638'; g.lineWidth = 2.6;
        g.beginPath(); g.moveTo(8, 21); g.lineTo(17, 7); g.stroke();
        g.fillStyle = '#aab3bf'; g.beginPath(); g.moveTo(17, 7); g.quadraticCurveTo(24, 8, 22, 15); g.lineTo(15.5, 10); g.closePath(); g.fill(); g.stroke(); break;
      case 'hammer': g.strokeStyle = '#6e5638'; g.lineWidth = 2.6;
        g.beginPath(); g.moveTo(9, 21); g.lineTo(16, 8); g.stroke();
        g.fillStyle = '#9aa2ad'; g.beginPath(); g.roundRect(11.5, 3.5, 10, 6.5, 1.5); g.fill(); g.stroke(); break;
      case 'sword2': g.fillStyle = '#d7dde4'; g.save(); g.translate(13, 13); g.rotate(-0.78);
        g.fillRect(-1.5, -10, 3, 13); g.fillStyle = '#8a6420'; g.fillRect(-4, 2.4, 8, 2.4);
        g.fillStyle = '#5d4426'; g.beginPath(); g.arc(0, 6, 1.8, 0, 7); g.fill(); g.restore();
        g.strokeStyle = 'rgba(20,12,6,.7)'; break;
      case 'pick': g.strokeStyle = '#6e5638'; g.lineWidth = 2.6;        // miner's pick
        g.beginPath(); g.moveTo(13, 23); g.lineTo(13, 8); g.stroke();
        g.strokeStyle = '#9aa2ad'; g.lineWidth = 3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(5, 10); g.quadraticCurveTo(13, 5, 21, 10); g.stroke(); break;
      case 'bow': g.strokeStyle = '#7d5a2e'; g.lineWidth = 2.4;          // hunter's bow + arrow
        g.beginPath(); g.arc(8, 13, 8, -1.9, 1.9); g.stroke();
        g.strokeStyle = '#cdbb96'; g.lineWidth = 1; g.beginPath(); g.moveTo(5.3, 6.4); g.lineTo(5.3, 19.6); g.stroke();
        g.strokeStyle = '#8a6420'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(6, 13); g.lineTo(23, 13); g.stroke();
        g.fillStyle = '#cfd6dd'; g.beginPath(); g.moveTo(24, 13); g.lineTo(19, 10); g.lineTo(19, 16); g.closePath(); g.fill(); break;
      case 'hoe': g.strokeStyle = '#7d5a2e'; g.lineWidth = 2.4; g.lineCap = 'round';  // farmer's hoe
        g.beginPath(); g.moveTo(7, 21); g.lineTo(18, 6); g.stroke();
        g.fillStyle = '#8a8f98'; g.strokeStyle = 'rgba(20,12,6,.6)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(18, 5); g.lineTo(24, 9); g.lineTo(21, 12); g.lineTo(15, 9); g.closePath(); g.fill(); g.stroke(); break;
      case 'berry': g.fillStyle = '#4e8a3a';                            // berry bush cluster
        g.beginPath(); g.ellipse(13, 6, 7, 3, 0, 0, 7); g.fill();
        g.fillStyle = '#d23b58'; g.strokeStyle = 'rgba(80,12,20,.6)'; g.lineWidth = 1;
        for (const [x, y] of [[9, 12], [15, 12], [12, 17], [18, 16], [13, 21]]) { g.beginPath(); g.arc(x, y, 2.8, 0, 7); g.fill(); g.stroke(); } break;
      case 'net': g.strokeStyle = '#e8e0ce'; g.lineWidth = 1.2;          // fishing net
        g.beginPath(); g.arc(13, 14, 9, 0, 7); g.stroke();
        g.save(); g.beginPath(); g.arc(13, 14, 9, 0, 7); g.clip();
        for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(13 + i * 4, 4); g.lineTo(13 + i * 4, 24); g.moveTo(4, 14 + i * 4); g.lineTo(22, 14 + i * 4); g.stroke(); }
        g.restore(); break;
      case 'knife': g.fillStyle = '#d7dde4'; g.strokeStyle = 'rgba(20,12,6,.6)'; g.lineWidth = 1;  // skinning knife
        g.beginPath(); g.moveTo(6, 21); g.lineTo(17, 7); g.lineTo(19.5, 9); g.lineTo(8.5, 23); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#5d4426'; g.fillRect(4.5, 19.5, 5, 4.5); break;
      case 'stop': g.fillStyle = '#c4543f'; g.beginPath(); g.roundRect(6, 6, 14, 14, 3); g.fill(); g.stroke(); break;
      case 'poison': g.fillStyle = '#5fae3f'; g.beginPath();
        g.moveTo(13, 4); g.quadraticCurveTo(20, 13, 13, 21); g.quadraticCurveTo(6, 13, 13, 4); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#1d3812'; g.beginPath(); g.arc(10.5, 12, 1.7, 0, 7); g.fill();
        g.beginPath(); g.arc(15.5, 12, 1.7, 0, 7); g.fill();
        g.fillRect(11, 16, 4, 1.6); break;
      case 'coin': g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(13, 13, 8, 0, 7); g.fill(); g.stroke();
        g.strokeStyle = '#8a6420'; g.lineWidth = 1.6; g.beginPath(); g.arc(13, 13, 5, 0, 7); g.stroke();
        g.fillStyle = '#8a6420'; g.font = 'bold 9px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('$', 13, 13.5); break;
      default: g.fillStyle = '#cdbb96'; g.font = 'bold 14px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(name[0].toUpperCase(), 13, 14);
    }
    cache.set(key, c); return c;
  }

  /* civ portrait for the title screen */
  function portrait(civKey) {
    const key = `p_${civKey}`;
    if (cache.has(key)) return cache.get(key);
    const c = mk(96, 96), g = g2(c);
    const gr = g.createRadialGradient(48, 40, 8, 48, 48, 52);
    gr.addColorStop(0, '#3a2c18'); gr.addColorStop(1, '#16100a');
    g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 46, 0, 7); g.fill();
    g.strokeStyle = '#957437'; g.lineWidth = 2.5; g.beginPath(); g.arc(48, 48, 45, 0, 7); g.stroke();
    const map = { rome: ['legionary', 6], china: ['chukonu', 6], india: ['elephant', 6] };
    const [t, d] = map[civKey];
    const s = unit(t, civKey === 'rome' ? 1 : civKey === 'china' ? 2 : 0, civKey, d, 'idle', 0);
    g.save(); g.beginPath(); g.arc(48, 48, 44, 0, 7); g.clip();
    const sc = t === 'elephant' ? 1.0 : 1.55;
    const pk = s.k || 1;
    g.drawImage(s.cv, 48 - s.ax * sc, 86 - s.ay * sc, s.cv.width * sc / pk, s.cv.height * sc / pk);
    g.restore();
    cache.set(key, c); return c;
  }

  return { tile: bakeTile, obj: bakeObj, unit, building, icon, portrait, teamCols };
})();
