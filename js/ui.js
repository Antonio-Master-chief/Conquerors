/* ============ CONQUERORS — HUD, panels, minimap, messages ============ */
'use strict';

const UI = (() => {
  let game = null;
  let resEls = {}, ageEl = null, mmCv = null, mmG = null;
  let lastPanelKey = '';
  let quitArmed = false;

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function init(g) {
    game = g;
    document.getElementById('hud').classList.remove('hidden');
    const top = document.getElementById('topbar');
    top.innerHTML = '';
    resEls = {};
    for (const k of RES_KEYS) {
      const d = el('div', 'res', top);
      const ic = Sprites.icon(k); ic.title = k;
      d.appendChild(ic);
      const v = el('span', '', d); v.textContent = '0';
      resEls[k] = v;
    }
    const dp = el('div', 'res', top);
    dp.appendChild(Sprites.icon('pop'));
    resEls.pop = el('span', '', dp);
    ageEl = el('div', '', top); ageEl.id = 'agebadge';
    const sb = el('button', '', top); sb.id = 'menuBtn'; sb.textContent = '1×';
    sb.title = 'Game speed';
    sb.onclick = () => {
      game.speed = game.speed >= 3 ? 1 : game.speed + 1;
      sb.textContent = game.speed + '×';
      Audio2.sfx('click');
    };
    const mb = el('button', '', top); mb.id = 'menuBtn'; mb.textContent = '☰';
    mb.onclick = () => {
      if (quitArmed) location.reload();
      else { quitArmed = true; mb.textContent = 'Quit?'; message('Tap again to quit to menu', true); setTimeout(() => { quitArmed = false; mb.textContent = '☰'; }, 2500); }
    };
    mmCv = document.getElementById('minimap');
    mmG = mmCv.getContext('2d');
    bindMinimap();
    // idle settler button (floats above the minimap)
    const ib = el('button', '', document.getElementById('minimapWrap'));
    ib.id = 'idleBtn'; ib.title = 'Select next idle settler';
    ib.onclick = (ev) => {
      ev.stopPropagation();
      const idle = game.units.filter(u => !u.dead && u.owner === game.humanId && u.type === 'settler' && !u.order);
      if (!idle.length) return;
      idleCycle = (idleCycle + 1) % idle.length;
      const u = idle[idleCycle];
      game.selected = [u];
      game.cam.x = World.isoX(u.x, u.y);
      game.cam.y = World.isoY(u.x, u.y);
      Audio2.sfx('click');
      refreshPanels(true);
    };
    refreshTop(); refreshPanels(true);
  }
  let idleCycle = 0;

  /* ---------------- top bar ---------------- */
  function refreshTop() {
    const p = game.players[game.humanId];
    for (const k of RES_KEYS) resEls[k].textContent = Math.floor(p.res[k]);
    resEls.pop.textContent = `${p.pop}/${p.popCap}`;
    resEls.pop.className = p.pop >= p.popCap ? 'low' : '';
    const ib = document.getElementById('idleBtn');
    if (ib) {
      const n = game.units.filter(u => !u.dead && u.owner === game.humanId && u.type === 'settler' && !u.order).length;
      ib.textContent = '🧑‍🌾 ' + n;
      ib.style.display = n ? 'block' : 'none';
    }
    if (p.researching) {
      const r = p.researching;
      const pct = Math.floor(r.t / r.total * 100);
      ageEl.textContent = r.ageUp ? `Advancing… ${pct}%` : `${TECHS[r.key].name}… ${pct}%`;
    } else ageEl.textContent = AGES[p.age - 1].name;
  }

  /* ---------------- messages ---------------- */
  function message(text, bad) {
    const log = document.getElementById('msglog');
    const m = el('div', 'msg' + (bad ? ' bad' : ''), log);
    m.textContent = text;
    while (log.children.length > 4) log.removeChild(log.firstChild);
    setTimeout(() => { m.style.transition = 'opacity .6s'; m.style.opacity = '0'; setTimeout(() => m.remove(), 600); }, 4000);
  }

  /* ---------------- selection & action panels ---------------- */
  function iconForUnit(type, civ) {
    const s = Sprites.unit(type, 0, civ || 'rome', 0, 'idle', 0);
    const c = document.createElement('canvas'); c.width = 30; c.height = 30;
    const g = c.getContext('2d');
    const sc = Math.min(30 / s.cv.width, 30 / s.cv.height) * 1.4;
    g.drawImage(s.cv, 15 - s.ax * sc, 28 - s.ay * sc, s.cv.width * sc, s.cv.height * sc);
    return c;
  }
  function iconForBld(type, civ) {
    const s = Sprites.building(type, civ || 'rome', 0, true);
    const c = document.createElement('canvas'); c.width = 30; c.height = 30;
    const g = c.getContext('2d');
    const sc = Math.min(28 / s.cv.width, 28 / s.cv.height);
    g.drawImage(s.cv, 15 - s.cv.width * sc / 2, 15 - s.cv.height * sc / 2 + 4, s.cv.width * sc, s.cv.height * sc);
    return c;
  }

  function actionBtn(parent, { label, icon, cost, enabled, onClick, badge, title }) {
    const b = el('button', 'abtn' + (enabled ? '' : ' dis'), parent);
    if (icon) b.appendChild(icon);
    const l = el('div', '', b); l.textContent = label;
    if (cost) { const cs = el('div', 'cost', b); cs.textContent = costStr(cost); }
    if (badge) { const bd = el('div', 'badge', b); bd.textContent = badge; }
    if (title) b.title = title;
    b.onclick = (ev) => { ev.stopPropagation(); if (enabled) { Audio2.sfx('click'); onClick(); refreshPanels(true); } };
    return b;
  }

  function panelKey() {
    const sel = game.selected;
    let k = sel.map(e => e.id).join(',') + '|' + (game.placing ? game.placing.type : '');
    const b = sel[0];
    if (b && b.kind === 'bld') k += '|' + b.queue.length + '|' + (game.players[game.humanId].researching ? 'r' : '');
    return k;
  }

  function refreshPanels(force) {
    const key = panelKey();
    if (!force && key === lastPanelKey) { updateBars(); return; }
    lastPanelKey = key;
    const selP = document.getElementById('selpanel');
    const actP = document.getElementById('actionpanel');
    selP.innerHTML = ''; actP.innerHTML = '';
    const p = game.players[game.humanId];
    const sel = game.selected.filter(e => !e.dead);

    if (game.placing) {
      const c = el('div', 'card', selP);
      el('div', 'nm', c).textContent = `Place ${BUILDINGS[game.placing.type].name}`;
      el('div', 'sub', c).textContent = 'Tap the map to build · X cancels';
      actionBtn(actP, { label: 'Cancel', icon: Sprites.icon('stop').cloneNode ? makeIconCv('stop') : null, enabled: true, onClick: () => { game.placing = null; } });
      return;
    }
    if (!sel.length) return;

    const first = sel[0];
    /* ---- selection cards ---- */
    if (first.kind === 'unit') {
      const types = {};
      for (const u of sel) types[u.type] = (types[u.type] || 0) + 1;
      for (const t in types) {
        const c = el('div', 'card', selP);
        el('div', 'nm', c).textContent = `${UNITS[t].name}${types[t] > 1 ? ' ×' + types[t] : ''}`;
        if (types[t] === 1) {
          const u = sel.find(x => x.type === t);
          const hb = el('div', 'hpbar', c); el('div', '', hb).style.width = `${u.hp / u.maxHp * 100}%`;
          let sub = `ATK ${Math.round(u.effAtk(game))} · DEF ${u.effArmor(game)}${u.rank ? ' · ' + ['', 'Trained', 'Veteran', 'Elite'][u.rank] : ''}`;
          if (u.cargo) sub = `⚓ Troops aboard: ${u.cargo.reduce((s, c2) => s + c2.def.pop, 0)}/${u.def.capacity} — tap a shore to land`;
          if (u.def.suicide) sub = '🔥 Rams and burns enemy ships — single use!';
          if (u.type === 'trader') {
            const known = u.visited ? Object.keys(u.visited).filter(k => +k !== game.humanId).length : 0;
            sub = u.bribedBy === game.humanId ? '💰 Your trade caravan — pays gold at your Town Center'
                : u.bribedBy >= 0 ? 'Already serving another kingdom'
                : `Knows ${known} rival kingdom${known === 1 ? '' : 's'} · protected inside borders`;
          }
          el('div', 'sub', c).textContent = sub;
        }
      }
    } else {
      const b = first;
      const c = el('div', 'card', selP);
      el('div', 'nm', c).textContent = b.def.name + (b.owner === game.humanId ? '' : b.owner === -1 ? ' (Neutral)' : ' (Enemy)');
      const hb = el('div', 'hpbar', c); el('div', '', hb).style.width = `${b.hp / b.maxHp * 100}%`;
      let sub = b.built ? (b.def.desc || '') : `Building… ${Math.floor(b.progress * 100)}%`;
      if (b.built && b.type === 'farm') sub = b.irrigated ? '💧 Irrigated — infinite food' : '⚠ NO WATER — crops won\'t grow!';
      if (b.built && b.type === 'canal') sub = b.flowing ? '💧 Water is flowing' : '⚠ Not connected to a water source';
      el('div', 'sub', c).textContent = sub;
      // training queue
      if (b.queue.length) {
        const qc = el('div', 'card', selP);
        qc.style.display = 'flex'; qc.style.gap = '4px';
        b.queue.forEach((q, i) => {
          const s = el('div', 'qslot', qc);
          s.appendChild(iconForUnit(q.uKey, p.civKey));
          if (i === 0) { const f = el('div', 'fill', s); f.style.height = `${q.t / q.total * 100}%`; }
        });
      }
    }

    /* ---- merchant bribe ---- */
    if (first.kind === 'unit' && first.def.npc && first.type === 'trader' && first.bribedBy < 0) {
      const nearMine = game.units.some(u => !u.dead && u.owner === game.humanId && dist(u.x, u.y, first.x, first.y) < 4.5);
      actionBtn(actP, {
        label: 'Bribe', icon: makeIconCv('coin'), cost: { gold: CFG.BRIBE_COST },
        enabled: nearMine && p.res.gold >= CFG.BRIBE_COST,
        title: nearMine ? 'Buy his maps, his gossip, and his loyalty — he becomes your trade caravan'
                        : 'Move one of your units next to the merchant first',
        onClick: () => { if (Sim.bribe(game, first, game.humanId)) refreshPanels(true); },
      });
    }

    /* ---- actions ---- */
    if (first.kind === 'unit' && first.owner === game.humanId) {
      const settlers = sel.filter(u => u.type === 'settler');
      if (settlers.length) {
        for (const bt of ['farm', 'canal', 'dock', 'barracks', 'range', 'university', 'grounds', 'tower']) {
          const B = BUILDINGS[bt];
          const lockAge = B.age > p.age;
          actionBtn(actP, {
            label: B.name.split(' ')[0], icon: iconForBld(bt, p.civKey), cost: B.cost,
            enabled: !lockAge && p.canAfford(B.cost),
            badge: lockAge ? `Age ${B.age}` : null, title: B.desc,
            onClick: () => { game.placing = { type: bt }; },
          });
        }
      }
      if (p.bonus.poison && sel.some(u => u.type === 'scout')) {
        actionBtn(actP, {
          label: 'Poison Water', icon: makeIconCv('poison'), enabled: !game.targeting,
          title: 'Send a scout to foul an enemy water source — their troops sicken for 90s',
          onClick: () => {
            game.targeting = { kind: 'poison' };
            message('Tap an enemy water tile to poison it');
          },
        });
      }
      const loaded = sel.filter(u => u.cargo && u.cargo.length);
      if (loaded.length) {
        actionBtn(actP, {
          label: 'Unload', icon: makeIconCv('flag'), enabled: true,
          title: 'Land all troops on the nearest shore',
          onClick: () => { for (const t of loaded) t.orderUnload(t.x, t.y); },
        });
      }
      actionBtn(actP, { label: 'Stop', icon: makeIconCv('stop'), enabled: true,
        onClick: () => { for (const u of sel) u.clearOrder(); } });
    }
    if (first.kind === 'bld' && first.owner === game.humanId && first.built) {
      const b = first;
      for (const uk of b.trainable(game)) {
        const u = UNITS[uk];
        actionBtn(actP, {
          label: u.name.split(' ').pop(), icon: iconForUnit(uk, p.civKey), cost: u.cost,
          enabled: p.canAfford(u.cost), title: `HP ${u.hp} · ATK ${u.atk}${u.range > 1.2 ? ' · ranged' : ''}`,
          onClick: () => b.enqueue(game, uk),
        });
      }
      if (b.type === 'tc' && p.age < 4) {
        const a = AGES[p.age];
        const needT = (a.towns || 0) - p.towns;
        actionBtn(actP, {
          label: a.name, icon: makeIconCv('age'), cost: a.cost,
          enabled: p.canAgeUp(),
          badge: needT > 0 ? `${needT}🏰` : null,
          title: needT > 0 ? `Capture ${needT} more town(s) first` : 'Advance to the next Age',
          onClick: () => { p.startAgeUp(); message(`Advancing to the ${a.name}…`); },
        });
      }
      if (b.type === 'university') {
        for (const tk in TECHS) {
          const t = TECHS[tk];
          if (p.techs.has(tk)) continue;
          if (t.civ && t.civ !== p.civKey) continue;
          if (t.req && !p.techs.has(t.req)) continue;
          if (t.age > p.age + 1) continue;
          const lockAge = t.age > p.age;
          actionBtn(actP, {
            label: t.name, icon: makeIconCv('knowledge'), cost: p.techCost(t),
            enabled: !lockAge && p.canResearch(tk),
            badge: lockAge ? `Age ${t.age}` : null, title: t.desc,
            onClick: () => { p.startResearch(tk); message(`Researching ${t.name}`); },
          });
        }
      }
    }
  }
  function makeIconCv(name) {
    const src = Sprites.icon(name);
    const c = document.createElement('canvas'); c.width = 30; c.height = 30;
    c.getContext('2d').drawImage(src, 2, 2, 26, 26);
    return c;
  }
  function updateBars() {
    // light refresh of hp bars / queue fills without rebuilding DOM
  }

  /* ---------------- minimap ---------------- */
  const MM = 176;
  function renderMinimap() {
    const W = game.world;
    mmG.clearRect(0, 0, MM, MM);
    mmG.drawImage(W.minimapBase, 0, 0, MM, MM);
    const sc = MM / World.N;
    // fog
    mmG.fillStyle = 'rgba(5,4,8,.92)';
    for (let y = 0; y < World.N; y += 2) for (let x = 0; x < World.N; x += 2) {
      if (W.vis[y * World.N + x] === 0) mmG.fillRect(x * sc, y * sc, sc * 2, sc * 2);
    }
    mmG.fillStyle = 'rgba(5,4,8,.4)';
    for (let y = 0; y < World.N; y += 2) for (let x = 0; x < World.N; x += 2) {
      if (W.vis[y * World.N + x] === 1) mmG.fillRect(x * sc, y * sc, sc * 2, sc * 2);
    }
    // entities
    for (const b of game.buildings) {
      if (b.dead) continue;
      const v = W.vis[World.idx(b.x | 0, b.y | 0)];
      if (v === 0) continue;
      const col = b.owner === -1 ? (b.type === 'town' ? '#ffd34d' : '#c2bcae') : PLAYER_COLORS[b.owner].main;
      mmG.fillStyle = col;
      const s = Math.max(2.5, b.size * sc);
      mmG.fillRect(b.x * sc - 1, b.y * sc - 1, s + 1, s + 1);
    }
    for (const u of game.units) {
      if (u.dead) continue;
      if (World.visAt(u.x, u.y) !== 2 && u.owner !== game.humanId) continue;
      mmG.fillStyle = u.owner === -1 ? '#e8e0ce' : PLAYER_COLORS[u.owner].main;
      mmG.fillRect(u.x * sc - 1, u.y * sc - 1, 2.2, 2.2);
    }
    // pings
    for (const pg of game.pings) {
      const a = 1 - (game.time - pg.t) / 2;
      if (a <= 0) continue;
      mmG.strokeStyle = `rgba(255,80,60,${a})`; mmG.lineWidth = 2;
      mmG.beginPath(); mmG.arc(pg.x * sc, pg.y * sc, (2 - a) * 9, 0, 7); mmG.stroke();
    }
    // viewport rect: convert cam iso -> tile coords
    const cam = game.cam, cw = game.canvas.width / cam.zoom, chh = game.canvas.height / cam.zoom;
    const tx = (cam.x / 64 + cam.y / 32), ty = (cam.y / 32 - cam.x / 64);
    const w = (cw / 64 + chh / 32), h = (chh / 32 + cw / 64);
    mmG.strokeStyle = 'rgba(255,255,255,.8)'; mmG.lineWidth = 1.2;
    mmG.save();
    mmG.translate(tx * sc, ty * sc); mmG.rotate(Math.PI / 4);
    const dw = Math.sqrt(cw * chh) / 45 * sc * 1.4;
    mmG.strokeRect(-w * sc * .35, -h * sc * .35, w * sc * .7, h * sc * .7);
    mmG.restore();
  }

  function bindMinimap() {
    const jump = (ev) => {
      const r = mmCv.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width * World.N;
      const py = (ev.clientY - r.top) / r.height * World.N;
      game.cam.x = World.isoX(px, py);
      game.cam.y = World.isoY(px, py);
      ev.preventDefault(); ev.stopPropagation();
    };
    mmCv.addEventListener('pointerdown', jump);
    mmCv.addEventListener('pointermove', (ev) => { if (ev.buttons) jump(ev); });
  }

  /* ---------------- end screen ---------------- */
  function endScreen(win) {
    if (document.getElementById('endscreen')) return;
    const d = el('div', '', document.body); d.id = 'endscreen';
    const h = el('h2', win ? 'win' : 'lose', d);
    h.textContent = win ? 'VICTORY' : 'DEFEAT';
    const sub = el('div', '', d);
    sub.style.cssText = 'color:#a8946d;letter-spacing:.2em;margin-top:8px;';
    sub.textContent = win ? 'Your name echoes through history.' : 'Your empire has fallen.';
    const b = el('button', '', d); b.id = 'startBtn'; b.textContent = 'Play Again';
    b.onclick = () => location.reload();
    Audio2.sfx(win ? 'victory' : 'defeat');
    Audio2.say(win ? 'Victory! Your name echoes through history.' : 'We have been defeated.', true);
    Audio2.setIntensity(0.3);
  }

  return { init, refreshTop, refreshPanels, renderMinimap, message, endScreen };
})();
