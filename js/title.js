/* ============ CONQUERORS — cinematic title screen ============ */
'use strict';

const Title = (() => {
  let selCiv = 'rome', selDiff = 'normal', fxRunning = false;

  function build() {
    const root = document.getElementById('title');
    root.innerHTML = `
      <canvas id="titleFx"></canvas>
      <div id="titleInner">
        <h1 class="gametitle">CONQUERORS</h1>
        <div class="subtitle">Forge · Capture · Conquer</div>
        <div class="civrow" id="civrow"></div>
        <div class="optrow">
          <label>Enemy AI</label>
          <button class="diffbtn" data-d="easy">Easy</button>
          <button class="diffbtn sel" data-d="normal">Normal</button>
          <button class="diffbtn" data-d="hard">Hard</button>
        </div>
        <div class="optrow"><div class="soundhint">⚔ tap anywhere to awaken the war drums ⚔</div></div>
        <button id="startBtn">To War</button>
      </div>`;

    const row = document.getElementById('civrow');
    for (const key in CIVS) {
      const c = CIVS[key];
      const card = document.createElement('div');
      card.className = 'civcard' + (key === selCiv ? ' sel' : '');
      card.dataset.civ = key;
      card.innerHTML = `<h3>${c.name}</h3><div class="tag">${c.tag}</div>`;
      card.appendChild(Sprites.portrait(key));
      const ul = document.createElement('ul');
      for (const d of c.desc) { const li = document.createElement('li'); li.textContent = d; ul.appendChild(li); }
      card.appendChild(ul);
      card.onclick = () => {
        selCiv = key;
        row.querySelectorAll('.civcard').forEach(x => x.classList.toggle('sel', x.dataset.civ === key));
        Audio2.sfx('click');
      };
      row.appendChild(card);
    }
    root.querySelectorAll('.diffbtn').forEach(b => {
      b.onclick = () => {
        selDiff = b.dataset.d;
        root.querySelectorAll('.diffbtn').forEach(x => x.classList.toggle('sel', x === b));
        Audio2.sfx('click');
      };
    });

    // music on first interaction (browser autoplay rules)
    const wake = () => { Audio2.startMusic(1.0); root.removeEventListener('pointerdown', wake); };
    root.addEventListener('pointerdown', wake);

    document.getElementById('startBtn').onclick = () => {
      Audio2.startMusic(1.0);
      Audio2.sfx('age');
      Audio2.setIntensity(0.55);
      fxRunning = false;
      root.classList.add('hidden');
      window.startGame(selCiv, selDiff);
    };

    embers();
  }

  /* drifting embers + smoke behind the title */
  function embers() {
    const cv = document.getElementById('titleFx');
    const g = cv.getContext('2d');
    const ps = [];
    fxRunning = true;
    function resize() { cv.width = innerWidth; cv.height = innerHeight; }
    resize();
    window.addEventListener('resize', resize);
    function tick() {
      if (!fxRunning) { g.clearRect(0, 0, cv.width, cv.height); return; }
      g.clearRect(0, 0, cv.width, cv.height);
      if (ps.length < 70 && Math.random() < .5) ps.push({
        x: Math.random() * cv.width, y: cv.height + 10,
        vx: (Math.random() - .5) * 18, vy: -28 - Math.random() * 46,
        r: 1 + Math.random() * 2.4, life: 1,
        hue: Math.random() < .8 ? 30 + Math.random() * 18 : 45,
      });
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.x += p.vx / 60; p.y += p.vy / 60;
        p.vx += (Math.random() - .5) * 4;
        p.life -= 0.0035;
        if (p.life <= 0 || p.y < -10) { ps.splice(i, 1); continue; }
        g.globalAlpha = Math.max(0, p.life) * .85;
        g.fillStyle = `hsl(${p.hue},90%,${55 + Math.random() * 12}%)`;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
      requestAnimationFrame(tick);
    }
    tick();
  }

  return { build };
})();
