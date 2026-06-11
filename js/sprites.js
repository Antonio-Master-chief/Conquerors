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
    else                         { base = variant % 2 ? ['#587f37', '#4e7530'] : ['#5d8a3c', '#527c33']; det = 'grass'; }
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
    // edge shading for depth
    g.strokeStyle = 'rgba(0,0,0,.13)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, 16); g.lineTo(32, 32); g.lineTo(64, 16); g.stroke();
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
      c = mk(60, 44); g = g2(c); shadow(g, 30, 38, 19, 6);
      const cols = kind === 'gold' ? ['#8d8678', '#6b6557'] : kind === 'stone' ? ['#9a948a', '#736e64'] : ['#6e5a50', '#4e3f38'];
      for (const [x, y, r] of [[22, 28, 12], [38, 30, 10], [30, 22, 9]]) {
        const gr = g.createLinearGradient(x - r, y - r, x + r, y + r);
        gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]);
        g.fillStyle = gr; g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x - r, y + r * .5); g.lineTo(x - r * .5, y - r); g.lineTo(x + r * .6, y - r * .8); g.lineTo(x + r, y + r * .4); g.closePath();
        g.fill(); g.stroke();
      }
      if (kind === 'gold') for (let i = 0; i < 8; i++) { g.fillStyle = '#ffd34d'; g.fillRect(14 + rnd() * 30, 16 + rnd() * 18, 2.5, 2.5); }
      if (kind === 'iron') for (let i = 0; i < 7; i++) { g.fillStyle = '#b3543b'; g.fillRect(14 + rnd() * 30, 16 + rnd() * 18, 3, 1.6); }
      cache.set(key, { cv: c, ax: 30, ay: 38 }); return cache.get(key);
    }
    if (kind === 'fish') {
      c = mk(56, 30); g = g2(c);
      g.strokeStyle = 'rgba(220,240,255,.45)'; g.lineWidth = 1.2;
      for (const [x, y, r] of [[20, 14, 9], [36, 18, 7]]) { g.beginPath(); g.ellipse(x, y, r, r * .4, 0, 0, 7); g.stroke(); }
      g.fillStyle = 'rgba(190,210,230,.85)';
      for (const [x, y] of [[22, 13], [34, 17], [28, 20]]) {
        g.beginPath(); g.ellipse(x, y, 4, 1.6, .3, 0, 7); g.fill();
        g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x - 7, y - 2); g.lineTo(x - 7, y + 2); g.closePath(); g.fill();
      }
      cache.set(key, { cv: c, ax: 28, ay: 18 }); return cache.get(key);
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
    sword:    { tunic: 'team',    helmet: 'metal', weapon: 'sword',   shield: 'kite'  },
    legionary:{ tunic: 'team',    helmet: 'galea', weapon: 'sword',   shield: 'scutum'},
    centurion:{ tunic: 'team',    helmet: 'crest', weapon: 'sword',   shield: 'scutum', cape: '#a32626' },
    chukonu:  { tunic: 'team',    helmet: 'cone',  weapon: 'crossbow',shield: 'none'  },
    trader:   { tunic: '#7a5d8a', helmet: 'turban',weapon: 'staff',   shield: 'none', pack: true },
  };

  function drawHumanoid(g, type, colorIdx, civ, dir, anim, fr) {
    const v = UNIT_VIS[type] || UNIT_VIS.spearman;
    const tc = teamCols(colorIdx);
    const skin = SKIN[civ] || SKIN.none;
    const tunic = v.tunic === 'team' ? tc.main : v.tunic;
    const tunicD = v.tunic === 'team' ? tc.dark : 'rgba(0,0,0,.25)';
    // pose params
    let swing = 0, lunge = 0, raise = 0;
    if (anim === 'walk') swing = Math.sin(fr / 4 * Math.PI * 2) * 0.7;
    if (anim === 'attack') { lunge = fr === 1 ? 3.5 : fr === 0 ? -1.5 : 0.5; raise = fr === 0 ? 1 : fr === 1 ? -0.6 : 0.2; }
    const GY = 52, hipY = 36, hipX = 24 + (dir === 1 ? -lunge : 0);
    const side = dir === 1;
    const F = side ? -1 : 0; // facing offset for side view (faces left)

    g.save();
    // shadow
    g.fillStyle = 'rgba(0,0,0,.30)'; g.beginPath(); g.ellipse(24, GY, 9, 3.4, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(20,12,6,.65)';

    // ----- legs -----
    g.lineWidth = 3.6; g.strokeStyle = '#3f3324';
    if (side) {
      for (const s of [-1, 1]) {
        const a = swing * s;
        g.strokeStyle = s < 0 ? '#332a1e' : '#46392a';
        g.beginPath(); g.moveTo(hipX, hipY);
        g.lineTo(hipX + Math.sin(a) * 13 * -1, hipY + Math.cos(a) * 14);
        g.stroke();
      }
    } else {
      const bob = Math.abs(swing) * 1.5;
      g.strokeStyle = '#3a2f22';
      g.beginPath(); g.moveTo(hipX - 3.4, hipY); g.lineTo(hipX - 3.6, GY - 1 - (swing > 0 ? bob : 0)); g.stroke();
      g.beginPath(); g.moveTo(hipX + 3.4, hipY); g.lineTo(hipX + 3.6, GY - 1 - (swing < 0 ? bob : 0)); g.stroke();
    }

    // ----- cape (back layer) -----
    if (v.cape && dir !== 0) {
      g.fillStyle = v.cape; g.beginPath();
      g.moveTo(hipX - 5, hipY - 13); g.quadraticCurveTo(hipX + 8, hipY - 2, hipX + 6, hipY + 6);
      g.lineTo(hipX - 2, hipY + 4); g.closePath(); g.fill();
    }
    if (v.pack) { g.fillStyle = '#6e5638'; g.beginPath(); g.ellipse(hipX + (side ? 6 : 0), hipY - 12, 6, 8, side ? .3 : 0, 0, 7); g.fill(); }

    // ----- torso -----
    const shY = hipY - 13;
    let grd = g.createLinearGradient(hipX - 6, shY, hipX + 6, hipY);
    grd.addColorStop(0, tunic); grd.addColorStop(1, tunicD === 'rgba(0,0,0,.25)' ? tunic : tunicD);
    g.fillStyle = grd; g.strokeStyle = 'rgba(20,12,6,.55)'; g.lineWidth = 1.2;
    g.beginPath();
    if (side) { g.moveTo(hipX - 5.5, shY); g.lineTo(hipX + 5.5, shY); g.lineTo(hipX + 4.5, hipY + 2); g.lineTo(hipX - 4.5, hipY + 2); }
    else      { g.moveTo(hipX - 6.5, shY); g.lineTo(hipX + 6.5, shY); g.lineTo(hipX + 5, hipY + 2); g.lineTo(hipX - 5, hipY + 2); }
    g.closePath(); g.fill(); g.stroke();
    if (v.tunic === 'team' && tunicD !== tunic) { // belt + trim
      g.fillStyle = '#8a6420'; g.fillRect(hipX - 5, hipY - 2.5, 10, 2.2);
    }
    // pteruges skirt for legion types
    if (v.helmet === 'galea' || v.helmet === 'crest') {
      g.fillStyle = '#7d6235';
      for (let i = -2; i <= 2; i++) g.fillRect(hipX + i * 2.4 - 1, hipY, 2, 4.5);
    }

    // ----- head -----
    const hx = hipX + (side ? -2.5 : 0), hy = shY - 7;
    g.fillStyle = skin; g.beginPath(); g.arc(hx, hy, 5.4, 0, 7); g.fill();
    if (dir === 0) { g.fillStyle = '#241a10'; g.fillRect(hx - 2.6, hy - 1, 1.6, 1.8); g.fillRect(hx + 1.2, hy - 1, 1.6, 1.8); }
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
        if (side) { g.fillRect(hx - 6.5, hy - .5, 2.4, 4.5); }   // cheek guard
        const cc = v.helmet === 'crest' ? '#d22' : (type === 'legionary' ? tc.light : '#d22');
        if (v.helmet === 'crest' || type === 'centurion') { g.fillStyle = '#c22020';
          if (side) g.fillRect(hx - 6, hy - 9.5, 12, 3.4); else { g.beginPath(); g.ellipse(hx, hy - 8.5, 7, 2.8, 0, 0, 7); g.fill(); } }
        else if (v.helmet === 'galea') { g.fillStyle = tc.main;
          g.beginPath(); g.moveTo(hx - 1.2, hy - 6); g.quadraticCurveTo(hx + (side ? 6 : 0), hy - 12, hx + (side ? 7 : 1.2), hy - 6); g.closePath(); g.fill(); }
        break; }
      case 'hood': g.fillStyle = '#46552f'; g.beginPath(); g.arc(hx, hy - 1, 6, Math.PI * .9, Math.PI * .1); g.fill();
        g.beginPath(); g.moveTo(hx - 5.5, hy); g.lineTo(hx + 5.5, hy); g.lineTo(hx + 3, hy + 4); g.lineTo(hx - 3, hy + 4); g.closePath(); g.fill(); break;
      case 'cone': g.fillStyle = '#b8924a'; g.beginPath(); g.moveTo(hx - 7, hy - 2); g.lineTo(hx + 7, hy - 2); g.lineTo(hx, hy - 9); g.closePath(); g.fill(); break;
      case 'turban': g.fillStyle = '#e8e0ce'; g.beginPath(); g.ellipse(hx, hy - 3, 6, 4.4, 0, 0, 7); g.fill();
        g.strokeStyle = '#b8a784'; g.beginPath(); g.moveTo(hx - 5, hy - 4); g.quadraticCurveTo(hx, hy - 1, hx + 5, hy - 4); g.stroke(); break;
    }

    // ----- weapon & arms -----
    const armY = shY + 2.5;
    const wx = side ? hipX - 8 : hipX + 7; // weapon hand
    g.strokeStyle = skin; g.lineWidth = 3;
    // back arm
    if (dir !== 1 || v.shield === 'none') { g.beginPath(); g.moveTo(hipX + (side ? 3 : -6), armY); g.lineTo(hipX + (side ? 5 : -8), armY + 7); g.stroke(); }
    // weapon arm
    g.beginPath(); g.moveTo(hipX + (side ? -3 : 6), armY); g.lineTo(wx, armY + 5 - raise * 3); g.stroke();

    const wy = armY + 5 - raise * 3;
    g.lineWidth = 2;
    switch (v.weapon) {
      case 'spear': {
        g.strokeStyle = '#6e5638'; g.lineWidth = 2.2;
        const ext = anim === 'attack' && fr === 1 ? 8 : 0;
        if (side) { g.beginPath(); g.moveTo(wx + 12, wy + 3); g.lineTo(wx - 14 - ext, wy - 4); g.stroke();
          g.fillStyle = '#cfd6dd'; g.beginPath(); g.moveTo(wx - 14 - ext, wy - 4); g.lineTo(wx - 20 - ext, wy - 6.2); g.lineTo(wx - 13.4 - ext, wy - 1); g.closePath(); g.fill(); }
        else { g.beginPath(); g.moveTo(wx, wy + 9); g.lineTo(wx, wy - 16 - ext); g.stroke();
          g.fillStyle = '#cfd6dd'; g.beginPath(); g.moveTo(wx - 2.4, wy - 16 - ext); g.lineTo(wx + 2.4, wy - 16 - ext); g.lineTo(wx, wy - 23 - ext); g.closePath(); g.fill(); }
        break; }
      case 'sword': {
        const a = side ? (-2.2 + raise * 1.4) : (-1.2 + raise * 1.2);
        g.save(); g.translate(wx, wy); g.rotate(a);
        g.fillStyle = '#d7dde4'; g.fillRect(-1.4, -15, 2.8, 15);
        g.fillStyle = '#8a6420'; g.fillRect(-3.4, -1.5, 6.8, 2.4);
        g.restore(); break; }
      case 'axe': {
        const a = side ? (-2.0 + raise * 1.6) : (-1.0 + raise * 1.4);
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

    // ----- shield (front layer) -----
    const sx2 = side ? hipX - 7.5 : hipX - 7.5, sy2 = armY + 3;
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(20,12,6,.6)';
    if (v.shield === 'round') {
      const gr = g.createRadialGradient(sx2 - 1.5, sy2 - 1.5, 1, sx2, sy2, 6);
      gr.addColorStop(0, tc.light); gr.addColorStop(1, tc.dark);
      g.fillStyle = gr; g.beginPath(); g.arc(sx2, sy2, 6, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#e7cf8e'; g.beginPath(); g.arc(sx2, sy2, 1.7, 0, 7); g.fill();
    } else if (v.shield === 'scutum') {
      const gr = g.createLinearGradient(sx2 - 5, 0, sx2 + 5, 0);
      gr.addColorStop(0, tc.main); gr.addColorStop(1, tc.dark);
      g.fillStyle = gr;
      g.beginPath(); g.roundRect(sx2 - 5, sy2 - 8.5, 10, 17, 3); g.fill(); g.stroke();
      g.strokeStyle = '#e7cf8e'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(sx2, sy2 - 6); g.lineTo(sx2, sy2 + 6); g.stroke();
      g.fillStyle = '#e7cf8e'; g.beginPath(); g.arc(sx2, sy2, 2, 0, 7); g.fill();
    } else if (v.shield === 'kite') {
      g.fillStyle = tc.main; g.beginPath();
      g.moveTo(sx2 - 5, sy2 - 6); g.quadraticCurveTo(sx2, sy2 - 9, sx2 + 5, sy2 - 6);
      g.quadraticCurveTo(sx2 + 4, sy2 + 4, sx2, sy2 + 9); g.quadraticCurveTo(sx2 - 4, sy2 + 4, sx2 - 5, sy2 - 6);
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
        const dip = anim === 'attack' ? Math.sin(fr * 2.1) * 3 : 0;
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

  /* public: unit sprite. dir: 0 front,1 left,2 back,3 right */
  const BIG_TYPES = { scout: 1, chariot: 1, elephant: 1, catapult: 1,
    fishboat: 1, transport: 1, galley: 1, quinquereme: 1, fireship: 1, catamaran: 1 };
  function unit(type, colorIdx, civ, dir, anim, fr) {
    const big = !!BIG_TYPES[type];
    if (big && dir !== 3) dir = 1;
    const key = `u_${type}_${colorIdx}_${civ}_${dir}_${anim}_${fr}`;
    if (cache.has(key)) return cache.get(key);
    let s;
    if (dir === 3) { // mirror of left
      const L = unit(type, colorIdx, civ, 1, anim, fr);
      const c = mk(L.cv.width, L.cv.height), g = g2(c);
      g.translate(L.cv.width, 0); g.scale(-1, 1); g.drawImage(L.cv, 0, 0);
      s = { cv: c, ax: L.cv.width - L.ax, ay: L.ay };
    } else if (big) {
      s = drawBig(type, colorIdx, civ, anim, fr);
    } else {
      const c = mk(48, 56), g = g2(c);
      drawHumanoid(g, type, colorIdx, civ, dir, anim, fr);
      s = { cv: c, ax: 24, ay: 52 };
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

  function building(type, style, colorIdx, built, variant) {
    variant = variant || '';
    const key = `b_${type}_${style}_${colorIdx}_${built ? 1 : 0}_${variant}`;
    if (cache.has(key)) return cache.get(key);
    const B = BUILDINGS[type], s = B.size;
    const W = s * 64 + 24, H = s * 32 + 86;
    const c = mk(W, H), g = g2(c);
    const cx = W / 2, cy = H - s * 16 - 4; // footprint center
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
      const out = { cv: c, ax: cx, ay: cy };
      cache.set(key, out); return out;
    }

    if (type === 'farm') {
      const dry = variant === 'dry';
      g.save();
      g.beginPath(); g.moveTo(cx, cy - s * 16); g.lineTo(cx + s * 32, cy); g.lineTo(cx, cy + s * 16); g.lineTo(cx - s * 32, cy); g.closePath(); g.clip();
      g.fillStyle = dry ? '#8d7752' : '#7d663f'; g.fill();
      g.strokeStyle = dry ? '#a08a5e' : '#5d8a3c'; g.lineWidth = 3;
      for (let i = -3; i <= 3; i++) {
        g.beginPath(); g.moveTo(cx + i * 9 - s * 14, cy - s * 16 + 6 + i * 4.5);
        g.lineTo(cx + i * 9 + s * 14, cy + 6 + i * 4.5 + s * 7); g.stroke();
      }
      if (dry) { // cracked earth
        g.strokeStyle = 'rgba(70,55,35,.8)'; g.lineWidth = 1;
        const rc = RNG(11);
        for (let i = 0; i < 8; i++) {
          const x0 = cx - s * 18 + rc() * s * 36, y0 = cy - 8 + rc() * 16;
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + 6 - rc() * 12, y0 + 3 + rc() * 4); g.stroke();
        }
      }
      g.restore();
      if (!dry) {
        g.fillStyle = '#e7cf8e';
        const rr = RNG(7); for (let i = 0; i < 10; i++) g.fillRect(cx - s * 20 + rr() * s * 40, cy - 8 + rr() * 14, 1.6, 4);
        g.fillStyle = '#9fc25a';
        const rg = RNG(13); for (let i = 0; i < 8; i++) g.fillRect(cx - s * 18 + rg() * s * 36, cy - 6 + rg() * 12, 2, 3);
      } else { // red droplet warning
        g.fillStyle = '#d04a35'; g.beginPath();
        g.moveTo(cx, cy - 26); g.quadraticCurveTo(cx + 7, cy - 16, cx, cy - 11);
        g.quadraticCurveTo(cx - 7, cy - 16, cx, cy - 26); g.closePath(); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(cx - 8, cy - 10); g.lineTo(cx + 8, cy - 26); g.stroke();
      }
      const out = { cv: c, ax: cx, ay: cy }; cache.set(key, out); return out;
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
      const out = { cv: c, ax: cx, ay: cy }; cache.set(key, out); return out;
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
      flag(g, cx + s * 26, deckY - s * 8, colorIdx);
      const out = { cv: c, ax: cx, ay: cy };
      cache.set(key, out); return out;
    }

    const wallH = type === 'tower' ? 46 : type === 'tc' || type === 'town' ? 26 : 20;
    if (type === 'tower') {
      // cylinder tower
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(cx, cy, 20, 9, 0, 0, 7); g.fill();
      const gr = g.createLinearGradient(cx - 14, 0, cx + 14, 0);
      gr.addColorStop(0, p.wallL); gr.addColorStop(.55, p.top); gr.addColorStop(1, p.wallR);
      g.fillStyle = gr; g.beginPath();
      g.moveTo(cx - 14, cy - 2); g.lineTo(cx - 11, cy - wallH); g.lineTo(cx + 11, cy - wallH); g.lineTo(cx + 14, cy - 2);
      g.ellipse(cx, cy - 2, 14, 6, 0, 0, Math.PI); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(20,12,6,.45)'; g.stroke();
      g.fillStyle = p.top; g.beginPath(); g.ellipse(cx, cy - wallH, 11, 4.5, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = p.wallR;
      for (let i = -1; i <= 1; i++) g.fillRect(cx + i * 8 - 2.5, cy - wallH - 6, 5, 7);
      g.fillStyle = '#241a10'; g.fillRect(cx - 2.5, cy - wallH + 10, 5, 7);
      flag(g, cx, cy - wallH - 8, colorIdx);
      const out = { cv: c, ax: cx, ay: cy }; cache.set(key, out); return out;
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

    // decorations per type
    if (type === 'tc' && style === 'rome') { // columns
      g.fillStyle = '#e3dccb';
      for (let i = 0; i < 3; i++) g.fillRect(cx - s * 24 + i * 14, cy - 4 - wallH + 6 + i * 7, 4.5, wallH - 4);
    }
    if (type === 'university') {
      g.fillStyle = '#e7cf8e'; g.beginPath(); g.arc(cx + s * 16, cy - wallH - 2, 6, 0, 7); g.fill();
      g.fillStyle = p.roofD; g.font = 'bold 9px serif'; g.textAlign = 'center'; g.fillText('Ω', cx + s * 16, cy - wallH + 1);
    }
    if (type === 'barracks') { // weapon rack
      g.strokeStyle = '#6e5638'; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx + s * 20 + i * 5, cy + 4); g.lineTo(cx + s * 26 + i * 5, cy - 16); g.stroke(); }
      g.fillStyle = '#cfd6dd';
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx + s * 26 + i * 5, cy - 16); g.lineTo(cx + s * 24 + i * 5, cy - 21); g.lineTo(cx + s * 28 + i * 5, cy - 19); g.closePath(); g.fill(); }
    }
    if (type === 'range') { // target
      const tx = cx + s * 22, ty = cy + 2;
      for (const [r, col] of [[8, '#e8e0ce'], [5.5, '#c4543f'], [3, '#e8e0ce'], [1.5, '#c4543f']]) {
        g.fillStyle = col; g.beginPath(); g.ellipse(tx, ty, r, r * .8, 0, 0, 7); g.fill();
      }
      g.strokeStyle = '#6e5638'; g.lineWidth = 2; g.beginPath(); g.moveTo(tx - 5, ty + 10); g.lineTo(tx, ty + 5); g.lineTo(tx + 5, ty + 10); g.stroke();
    }
    if (type === 'grounds') { // training dummy
      const dx = cx + s * 20, dy = cy + 2;
      g.strokeStyle = '#6e5638'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(dx, dy); g.lineTo(dx, dy - 18); g.stroke();
      g.beginPath(); g.moveTo(dx - 8, dy - 12); g.lineTo(dx + 8, dy - 12); g.stroke();
      g.fillStyle = '#cdb279'; g.beginPath(); g.arc(dx, dy - 20, 4, 0, 7); g.fill();
    }
    flag(g, cx + s * 28, cy - wallH - 2, colorIdx);
    if (type === 'tc' || type === 'town') flag(g, cx - s * 28, cy - wallH - 2, colorIdx);

    const out = { cv: c, ax: cx, ay: cy };
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
    const map = { rome: ['legionary', 0], china: ['chukonu', 0], india: ['elephant', 1] };
    const [t, d] = map[civKey];
    const s = unit(t, civKey === 'rome' ? 1 : civKey === 'china' ? 2 : 0, civKey, d, 'idle', 0);
    g.save(); g.beginPath(); g.arc(48, 48, 44, 0, 7); g.clip();
    const sc = t === 'elephant' ? 1.0 : 1.55;
    g.drawImage(s.cv, 48 - s.ax * sc, 86 - s.ay * sc, s.cv.width * sc, s.cv.height * sc);
    g.restore();
    cache.set(key, c); return c;
  }

  return { tile: bakeTile, obj: bakeObj, unit, building, icon, portrait, teamCols };
})();
