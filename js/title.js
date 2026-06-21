/* ============ CONQUERORS — cinematic war title screen ============ */
'use strict';

const Title = (() => {
  const sel = { civ: 'rome', diff: 'normal', map: 'small', res: 'normal', animals: 'normal' };
  const mp = { civ: 'rome', code: '' };
  let fxRunning = false;
  let view = 'mode'; // 'mode' | 'sp' | 'load' | 'mpmode' | 'mphost' | 'mpjoin'

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
    root.innerHTML = `<canvas id="titleFx"></canvas><div id="titleInner"></div>`;
    renderView(saved);
    warFx();

    // music on first interaction (browser autoplay rules)
    const wake = () => { Audio2.setMood('battle'); Audio2.startMusic(1.0); Audio2.setIntensity(0.9); root.removeEventListener('pointerdown', wake); };
    root.addEventListener('pointerdown', wake);
  }

  function setView(v) { view = v; renderView(); }

  function renderView(savedBoot) {
    const inner = document.getElementById('titleInner');
    if (view === 'mode') inner.innerHTML = modeHTML();
    else if (view === 'sp') inner.innerHTML = spHTML();
    else if (view === 'load') inner.innerHTML = loadHTML();
    else if (view === 'mpmode') inner.innerHTML = mpModeHTML();
    else if (view === 'mphost') inner.innerHTML = mpHostHTML();
    else if (view === 'mpjoin') inner.innerHTML = mpJoinHTML();
    wireView(savedBoot);
  }

  /* ---------------- mode select ---------------- */
  function modeHTML() {
    return `
      <h1 class="gametitle">CONQUERORS</h1>
      <div class="subtitle">⚔ Forge · Capture · Conquer ⚔</div>
      <div class="moderow">
        <div class="modebtn" id="goSp"><h3>⚔ Single Player</h3><p>Build your empire and crush the AI on a map of your choosing.</p></div>
        <div class="modebtn" id="goMp"><h3>🌐 Multiplayer</h3><p>Invite a friend and fight them directly, kingdom vs kingdom.</p></div>
      </div>`;
  }

  /* ---------------- civ card row (shared by SP + MP host/join) ---------------- */
  function buildCivRow(row, selObj) {
    for (const key in CIVS) {
      const c = CIVS[key];
      const card = document.createElement('div');
      card.className = 'civcard' + (key === selObj.civ ? ' sel' : '');
      card.dataset.civ = key;
      card.innerHTML = `<h3>${c.name}</h3><div class="tag">${c.tag}</div>`;
      card.appendChild(Sprites.portrait(key));
      const ul = document.createElement('ul');
      for (const d of c.desc) { const li = document.createElement('li'); li.textContent = d; ul.appendChild(li); }
      card.appendChild(ul);
      card.onclick = () => {
        selObj.civ = key;
        row.querySelectorAll('.civcard').forEach(x => x.classList.toggle('sel', x.dataset.civ === key));
        Audio2.sfx('click');
      };
      row.appendChild(card);
    }
  }

  /* ---------------- single player ---------------- */
  function spHTML() {
    return `
      <button class="backbtn" id="backBtn">← Back</button>
      <h1 class="gametitle">CONQUERORS</h1>
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
      <button id="loadBtn" style="display:none">📂 Load Game</button>`;
  }

  /* ---------------- load game list ---------------- */
  function loadHTML() {
    const saves = SaveLoad.listSaves();
    const rows = saves.length ? saves.map(s => `
      <div class="saveitem" data-name="${encodeURIComponent(s.name)}">
        <div class="info">
          <div class="nm">${s.name}</div>
          <div class="meta">${(CIVS[s.civKey] || {}).name || s.civKey} · Age ${s.age} · ${new Date(s.savedAt).toLocaleString()}</div>
        </div>
        <button class="loadb">Load</button>
        <button class="delb">✕</button>
      </div>`).join('') : `<div class="mpstatus">No saved games yet.</div>`;
    return `
      <button class="backbtn" id="backBtn">← Back</button>
      <h1 class="gametitle">CONQUERORS</h1>
      <div class="subtitle">Load Game</div>
      <div class="savelist">${rows}</div>`;
  }

  /* ---------------- multiplayer mode select ---------------- */
  function mpModeHTML() {
    return `
      <button class="backbtn" id="backBtn">← Back</button>
      <h1 class="gametitle">CONQUERORS</h1>
      <div class="subtitle">Multiplayer</div>
      <div class="moderow">
        <div class="modebtn" id="goHost"><h3>Host Game</h3><p>Create an invite code and share it with the friend you want to play.</p></div>
        <div class="modebtn" id="goJoin"><h3>Join Game</h3><p>Paste the invite code your friend sent you.</p></div>
      </div>`;
  }

  /* ---------------- host flow ---------------- */
  function mpHostHTML() {
    return `
      <button class="backbtn" id="backBtn">← Back</button>
      <h1 class="gametitle">CONQUERORS</h1>
      <div class="subtitle">Host Game — pick your civilization</div>
      <div class="civrow" id="civrow"></div>
      <button class="mpbtn" id="mkInviteBtn">⚔ Create Invite Code ⚔</button>
      <div class="mpstatus" id="mpStatus">Click to generate a code, then send it to your friend.</div>
      <div class="mpstep" id="inviteStep" style="display:none">
        <div class="steplabel">Step 1 · Send this code to your friend</div>
        <div class="mpcoderow">
          <textarea class="mpcode" id="inviteOut" readonly></textarea>
          <button class="copybtn" id="copyInviteBtn">Copy</button>
        </div>
      </div>
      <div class="mpstep" id="answerWrap" style="display:none">
        <div class="steplabel">Step 2 · Paste their reply code here</div>
        <div class="stephint">They'll send you back a reply code once they've pasted your invite — paste it below.</div>
        <textarea class="mpcode" id="answerIn" placeholder="Paste the reply code here…" style="width:100%; height:60px;"></textarea>
        <button class="mpbtn" id="connectBtn">Connect</button>
      </div>`;
  }

  /* ---------------- join flow ---------------- */
  function mpJoinHTML() {
    return `
      <button class="backbtn" id="backBtn">← Back</button>
      <h1 class="gametitle">CONQUERORS</h1>
      <div class="subtitle">Join Game — pick your civilization</div>
      <div class="civrow" id="civrow"></div>
      <div class="mpstep">
        <div class="steplabel">Step 1 · Paste the invite code your friend sent you</div>
        <textarea class="mpcode" id="offerIn" placeholder="Paste the invite code here…" style="width:100%; height:60px;"></textarea>
      </div>
      <button class="mpbtn" id="joinBtn">⚔ Generate Reply Code ⚔</button>
      <div class="mpstatus" id="mpStatus"></div>
      <div class="mpstep" id="answerStep" style="display:none">
        <div class="steplabel">Step 2 · Send this reply code back to your friend</div>
        <div class="mpcoderow">
          <textarea class="mpcode" id="answerOut" readonly></textarea>
          <button class="copybtn" id="copyAnswerBtn">Copy</button>
        </div>
      </div>`;
  }

  /* ---------------- wire up whichever view just rendered ---------------- */
  function wireView(savedBoot) {
    const root = document.getElementById('title');
    const back = document.getElementById('backBtn');
    if (back) back.onclick = () => { Audio2.sfx('click'); setView(view === 'load' ? 'sp' : view === 'mphost' || view === 'mpjoin' ? 'mpmode' : 'mode'); };

    if (view === 'mode') {
      document.getElementById('goSp').onclick = () => { Audio2.sfx('click'); setView('sp'); };
      document.getElementById('goMp').onclick = () => { Audio2.sfx('click'); setView('mpmode'); };
    } else if (view === 'mpmode') {
      document.getElementById('goHost').onclick = () => { Audio2.sfx('click'); setView('mphost'); };
      document.getElementById('goJoin').onclick = () => { Audio2.sfx('click'); setView('mpjoin'); };
    } else if (view === 'sp') {
      wireSp(savedBoot);
    } else if (view === 'load') {
      wireLoad();
    } else if (view === 'mphost') {
      wireMpHost();
    } else if (view === 'mpjoin') {
      wireMpJoin();
    }
  }

  function wireSp(savedBoot) {
    const root = document.getElementById('title');
    const row = document.getElementById('civrow');
    buildCivRow(row, sel);
    root.querySelectorAll('.optbtn').forEach(b => {
      b.onclick = () => {
        const g = b.dataset.g; sel[g] = b.dataset.v;
        root.querySelectorAll('.optbtn[data-g="' + g + '"]').forEach(x => x.classList.toggle('sel', x === b));
        Audio2.sfx('click');
      };
    });
    ['diff', 'map', 'res', 'animals'].forEach(g =>
      root.querySelectorAll('.optbtn[data-g="' + g + '"]').forEach(b => b.classList.toggle('sel', b.dataset.v === sel[g])));
    if (savedBoot) { const sh = root.querySelector('.soundhint'); if (sh) sh.textContent = '⚔ Battlefield ready — press TO WAR ⚔'; }

    if (SaveLoad.listSaves().length) {
      const lb = document.getElementById('loadBtn');
      lb.style.display = '';
      lb.onclick = () => { Audio2.sfx('age'); setView('load'); };
    }

    document.getElementById('startBtn').onclick = () => {
      const res = { low: 0.6, normal: 1, high: 1.7 }[sel.res];
      const animals = { few: 0.5, normal: 1, many: 2.2 }[sel.animals];
      const mapN = MAP_SIZES[sel.map];
      window.GAME_OPTS = { res, animals };
      Audio2.sfx('age');
      if (mapN !== CFG.MAP) {
        localStorage.setItem('conq_boot', JSON.stringify({ civ: sel.civ, diff: sel.diff, map: sel.map, res, animals }));
        location.reload();
        return;
      }
      localStorage.removeItem('conq_boot');
      Audio2.startMusic(1.0); Audio2.setIntensity(0.75);
      fxRunning = false;
      root.classList.add('hidden');
      window.startGame(sel.civ, sel.diff);
    };
  }

  function wireLoad() {
    document.querySelectorAll('.saveitem').forEach(item => {
      const name = decodeURIComponent(item.dataset.name);
      item.querySelector('.loadb').onclick = () => { Audio2.sfx('age'); SaveLoad.requestLoad(name); };
      item.querySelector('.delb').onclick = () => { Audio2.sfx('click'); SaveLoad.deleteSaveNamed(name); setView('load'); };
    });
  }

  /* ---------------- multiplayer connection plumbing ---------------- */
  function startTheMatch(hostCiv, clientCiv, diff, seed, asHost) {
    const root = document.getElementById('title');
    Audio2.startMusic(1.0); Audio2.setIntensity(0.75);
    fxRunning = false;
    root.classList.add('hidden');
    if (asHost) window.startMultiplayerHost(hostCiv, clientCiv, diff, seed);
    else window.startMultiplayerClient(hostCiv, clientCiv, diff, seed);
  }

  function wireCopyBtn(btnId, sourceId) {
    const btn = document.getElementById(btnId);
    btn.onclick = () => {
      const ta = document.getElementById(sourceId);
      ta.select();
      navigator.clipboard.writeText(ta.value).then(() => {
        Audio2.sfx('click');
        const old = btn.textContent; btn.textContent = '✔ Copied';
        setTimeout(() => { btn.textContent = old; }, 1200);
      }).catch(() => { /* clipboard permission denied - text is still select()ed for manual copy */ });
    };
  }

  function wireMpHost() {
    buildCivRow(document.getElementById('civrow'), mp);
    const status = document.getElementById('mpStatus');
    wireCopyBtn('copyInviteBtn', 'inviteOut');
    document.getElementById('mkInviteBtn').onclick = async () => {
      Audio2.sfx('click');
      status.textContent = 'Generating invite code…';
      try {
        const code = await Net.hostCreateOffer();
        document.getElementById('inviteOut').value = code;
        document.getElementById('inviteStep').style.display = '';
        document.getElementById('answerWrap').style.display = '';
        status.textContent = 'Send this code to your friend, then paste their reply below.';
        Net.onOpen(() => Net.send({ t: 'hello', civKey: mp.civ }));
        Net.onMessage(msg => {
          if (msg.t !== 'hello') return;
          status.textContent = 'Connected! Starting the match…';
          const seed = (Date.now() % 100000) | 0;
          startTheMatch(mp.civ, msg.civKey, sel.diff, seed, true);
        });
      } catch (e) { status.textContent = 'Could not create invite: ' + e.message; }
    };
    document.getElementById('connectBtn').onclick = async () => {
      Audio2.sfx('click');
      const code = document.getElementById('answerIn').value.trim();
      if (!code) { status.textContent = 'Paste your friend\'s reply code first.'; return; }
      try {
        status.textContent = 'Connecting…';
        await Net.hostAcceptAnswer(code);
      } catch (e) { status.textContent = 'Connection failed: ' + e.message; }
    };
  }

  function wireMpJoin() {
    buildCivRow(document.getElementById('civrow'), mp);
    const status = document.getElementById('mpStatus');
    wireCopyBtn('copyAnswerBtn', 'answerOut');
    document.getElementById('joinBtn').onclick = async () => {
      Audio2.sfx('click');
      const code = document.getElementById('offerIn').value.trim();
      if (!code) { status.textContent = 'Paste the invite code your friend sent you first.'; return; }
      try {
        status.textContent = 'Generating reply code…';
        const answer = await Net.joinWithOffer(code);
        document.getElementById('answerOut').value = answer;
        document.getElementById('answerStep').style.display = '';
        status.textContent = 'Send this reply code back to your friend, then wait…';
        Net.onOpen(() => Net.send({ t: 'hello', civKey: mp.civ }));
        Net.onMessage(msg => {
          if (msg.t !== 'init') return;
          status.textContent = 'Connected! Starting the match…';
          startTheMatch(msg.hostCiv, msg.clientCiv, msg.diff, msg.seed, false);
        });
      } catch (e) { status.textContent = 'Could not join: ' + e.message; }
    };
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
