/* ============ CONQUERORS — cinematic war title screen ============ */
'use strict';

const Title = (() => {
  const sel = { civ: 'rome', diff: 'normal', map: 'small', res: 'normal', animals: 'normal' };
  let fxRunning = false;

  function build() {
    const root = document.getElementById('title');
    root.classList.remove('hidden');
    // carry the player's choices across the fresh reload that applies map size
    const saved = (() => { try { return JSON.parse(localStorage.getItem('conq_boot') || 'null'); } catch (e) { return null; } })();
    if (saved) {
      sel.civ = saved.civ || sel.civ;
      sel.diff = saved.diff || sel.diff;
      sel.map = saved.map || sel.map;
      sel.res = ({ '0.6': 'low', '1': 'normal', '1.7': 'high' })[saved.res] || sel.res;
      sel.animals = ({ '0.5': 'few', '1': 'normal', '2.2': 'many' })[saved.animals] || sel.animals;
    }
    root.innerHTML = `
      <canvas id="titleFx"></canvas>
      <div id="titleInner">
        <h1 class="gametitle">CONQUERORS</h1>
        <div class="subtitle">⚔ Forge · Capture · Conquer ⚔</div>
        <div class="civrow" id="civrow"></div>
        <div class="optrow"><label>Enemy AI</label>
          <button class="optbtn" data-g="diff" data-v="easy">Easy</button>
          <button class="optbtn sel" data-g="diff" data-v="normal">Normal</button>
          <button class="optbtn" data-g="diff" data-v="hard">Hard</button>
        </div>
        <div class="optrow"><label>Battlefield</label>
          <button class="optbtn sel" data-g="map" data-v="small">Small</button>
          <button class="optbtn" data-g="map" data-v="medium">Medium</button>
          <button class="optbtn" data-g="map" data-v="large">Large</button>
          <button class="optbtn" data-g="map" data-v="huge">Huge</button>
        </div>
        <div class="optrow"><label>Resources</label>
          <button class="optbtn" data-g="res" data-v="low">Scarce</button>
          <button class="optbtn sel" data-g="res" data-v="normal">Normal</button>
          <button class="optbtn" data-g="res" data-v="high">Abundant</button>
        </div>
        <div class="optrow"><label>Wildlife</label>
          <button class="optbtn" data-g="animals" data-v="few">Few</button>
          <button class="optbtn sel" data-g="animals" data-v="normal">Normal</button>
          <button class="optbtn" data-g="animals" data-v="many">Many</button>
        </div>
        <div class="optrow"><div class="soundhint">⚔ tap anywhere to awaken the war drums ⚔</div></div>
        <button id="startBtn">⚔ TO WAR ⚔</button>
      </div>`;

    const row = document.getElementById('civrow');
    for (const key in CIVS) {
      const c = CIVS[key];
      const card = document.createElement('div');
      card.className = 'civcard' + (key === sel.civ ? ' sel' : '');
      card.dataset.civ = key;
      card.innerHTML = `<h3>${c.name}</h3><div class="tag">${c.tag}</div>`;
      card.appendChild(Sprites.portrait(key));
      const ul = document.createElement('ul');
      for (const d of c.desc) { const li = document.createElement('li'); li.textContent = d; ul.appendChild(li); }
      card.appendChild(ul);
      card.onclick = () => {
        sel.civ = key;
        row.querySelectorAll('.civcard').forEach(x => x.classList.toggle('sel', x.dataset.civ === key));
        Audio2.sfx('click');
      };
      row.appendChild(card);
    }

    // unified option buttons (difficulty, map, resources, wildlife)
    root.querySelectorAll('.optbtn').forEach(b => {
      b.onclick = () => {
        const g = b.dataset.g; sel[g] = b.dataset.v;
        root.querySelectorAll('.optbtn[data-g="' + g + '"]').forEach(x => x.classList.toggle('sel', x === b));
        Audio2.sfx('click');
      };
    });
    // reflect any carried-over selections in the UI
    root.querySelectorAll('.civcard').forEach(x => x.classList.toggle('sel', x.dataset.civ === sel.civ));
    ['diff', 'map', 'res', 'animals'].forEach(g =>
      root.querySelectorAll('.optbtn[data-g="' + g + '"]').forEach(b => b.classList.toggle('sel', b.dataset.v === sel[g])));
    if (saved) { const sh = root.querySelector('.soundhint'); if (sh) sh.textContent = '⚔ Battlefield ready — press TO WAR ⚔'; }

    // music on first interaction (browser autoplay rules)
    const wake = () => { Audio2.setMood('battle'); Audio2.startMusic(1.0); Audio2.setIntensity(0.9); root.removeEventListener('pointerdown', wake); };
    root.addEventListener('pointerdown', wake);

    document.getElementById('startBtn').onclick = () => {
      const res = { low: 0.6, normal: 1, high: 1.7 }[sel.res];
      const animals = { few: 0.5, normal: 1, many: 2.2 }[sel.animals];
      const mapN = MAP_SIZES[sel.map];
      window.GAME_OPTS = { res, animals };
      Audio2.sfx('age');
      if (mapN !== CFG.MAP) {
        // a different map size must be set before the world arrays allocate — do a
        // fresh reload carrying the chosen options; main.js then auto-starts.
        localStorage.setItem('conq_boot', JSON.stringify({ civ: sel.civ, diff: sel.diff, map: sel.map, res, animals }));
        location.reload();
        return;
      }
      localStorage.removeItem('conq_boot');   // chosen size already loaded — start now
      Audio2.startMusic(1.0); Audio2.setIntensity(0.75);
      fxRunning = false;
      root.classList.add('hidden');
      window.startGame(sel.civ, sel.diff);
    };

    warFx();
  }

  /* war backdrop: a marching silhouette army under drifting embers & a fire glow */
  function warFx() {
    const cv = document.getElementById('titleFx');
    const g = cv.getContext('2d');
    const ps = [];
    fxRunning = true;
    function resize() { cv.width = innerWidth; cv.height = innerHeight; }
    resize();
    window.addEventListener('resize', resize);
    let t = 0;
    function soldier(x, base, s, ph) {
      const bob = Math.sin(t * 2.4 + ph) * 2;
      g.save(); g.translate(x, base + bob);
      g.fillStyle = '#0b0805';
      g.beginPath(); g.ellipse(0, 0, 4 * s, 9 * s, 0, 0, 7); g.fill();        // body
      g.beginPath(); g.arc(0, -10 * s, 3 * s, 0, 7); g.fill();                 // head/helm
      g.fillRect(-5 * s, -13 * s, 10 * s, 2.4 * s);                            // helm brim
      g.lineWidth = 1.6 * s; g.strokeStyle = '#0b0805';                        // spear
      g.beginPath(); g.moveTo(5 * s, 4 * s); g.lineTo(7 * s, -20 * s); g.stroke();
      g.beginPath(); g.moveTo(7 * s, -20 * s); g.lineTo(5.6 * s, -24 * s); g.lineTo(8.4 * s, -23 * s); g.closePath(); g.fill();
      g.restore();
    }
    function tick() {
      if (!fxRunning) { g.clearRect(0, 0, cv.width, cv.height); return; }
      t += 1 / 60;
      g.clearRect(0, 0, cv.width, cv.height);
      // distant fire glow on the horizon
      const horizon = cv.height * 0.82;
      const glow = g.createLinearGradient(0, horizon - 120, 0, horizon + 40);
      glow.addColorStop(0, 'rgba(0,0,0,0)');
      glow.addColorStop(1, `rgba(${150 + Math.sin(t * 3) * 20 | 0},60,20,0.30)`);
      g.fillStyle = glow; g.fillRect(0, horizon - 120, cv.width, 160);
      // embers
      if (ps.length < 80 && Math.random() < .6) ps.push({
        x: Math.random() * cv.width, y: cv.height + 10,
        vx: (Math.random() - .5) * 18, vy: -28 - Math.random() * 46,
        r: 1 + Math.random() * 2.4, life: 1, hue: Math.random() < .8 ? 30 + Math.random() * 18 : 45,
      });
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.x += p.vx / 60; p.y += p.vy / 60; p.vx += (Math.random() - .5) * 4; p.life -= 0.0035;
        if (p.life <= 0 || p.y < -10) { ps.splice(i, 1); continue; }
        g.globalAlpha = Math.max(0, p.life) * .85;
        g.fillStyle = `hsl(${p.hue},90%,${55 + Math.random() * 12}%)`;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
      // marching army silhouette band along the bottom (two ranks)
      const spacing = 46;
      for (let rk = 0; rk < 2; rk++) {
        const base = cv.height - 16 - rk * 24, sc = 1.15 - rk * 0.25;
        const drift = (t * (16 + rk * 6)) % spacing;
        for (let x = -spacing; x < cv.width + spacing; x += spacing) {
          soldier(x + drift + (rk ? spacing / 2 : 0), base, sc, x * 0.7 + rk);
        }
      }
      requestAnimationFrame(tick);
    }
    tick();
  }

  return { build };
})();
