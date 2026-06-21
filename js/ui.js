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
    const saveB = el('button', '', top); saveB.id = 'menuBtn'; saveB.title = 'Save game';
    saveB.textContent = '💾';
    saveB.onclick = () => {
      Audio2.sfx('click');
      openSaveModal(saveB);
    };
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

  /* ---------------- save-name modal ---------------- */
  // Minimal inline overlay (matches the .card / #startBtn wood-and-gold look)
  // asking for a save name, then calling SaveLoad.saveAs(game, name).
  function openSaveModal(saveB) {
    if (document.getElementById('saveModal')) return;
    const p = game.players[game.humanId];
    const civName = (CIVS[p.civKey] && CIVS[p.civKey].name) || p.civKey;
    const defaultName = `${civName} · Age ${p.age} · ${new Date().toLocaleDateString()}`;

    const overlay = el('div', '', document.body);
    overlay.id = 'saveModal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:70;display:flex;align-items:center;'
      + 'justify-content:center;background:rgba(5,3,2,.72);backdrop-filter:blur(2px);';

    const panel = el('div', 'card', overlay);
    panel.style.cssText = 'width:min(360px,86vw);padding:16px;box-shadow:0 6px 28px rgba(0,0,0,.7);';

    const title = el('div', 'nm', panel);
    title.style.cssText = 'font-size:15px;margin-bottom:10px;';
    title.textContent = 'Save Game';

    const input = el('input', '', panel);
    input.type = 'text';
    input.value = defaultName;
    input.maxLength = 60;
    input.style.cssText = 'width:100%;padding:7px 9px;font-size:13px;font-family:inherit;'
      + 'background:#1c130b;color:#ffe9b0;border:1px solid #6b5121;border-radius:6px;outline:none;';

    const row = el('div', '', panel);
    row.style.cssText = 'display:flex;gap:8px;margin-top:12px;justify-content:flex-end;';

    const cancelB = el('button', 'diffbtn', row);
    cancelB.textContent = 'Cancel';
    cancelB.style.cssText = 'font-family:inherit;padding:7px 16px;';

    const okB = el('button', 'diffbtn sel', row);
    okB.textContent = 'Save';
    okB.style.cssText = 'font-family:inherit;padding:7px 16px;';

    const close = () => overlay.remove();
    cancelB.onclick = () => { Audio2.sfx('click'); close(); };
    overlay.onclick = (ev) => { if (ev.target === overlay) close(); };

    const doSave = () => {
      const name = input.value.trim() || defaultName;
      if (SaveLoad.saveAs(game, name)) {
        close();
        if (saveB) {
          saveB.textContent = '✔';
          setTimeout(() => { saveB.textContent = '💾'; }, 1200);
        }
        message(`Saved as "${name}"`);
        Audio2.sfx('train');
      } else {
        message('Save failed', true);
      }
    };
    okB.onclick = () => { Audio2.sfx('click'); doSave(); };
    input.onkeydown = (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') doSave();
      else if (ev.key === 'Escape') { Audio2.sfx('click'); close(); }
    };
    input.focus();
    input.select();
  }

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

  /* ---------------- AI-art portraits (subset of units so far) ---------------- */
  const PORTRAIT_KEYS = new Set([
    'archer_china', 'archer_india', 'archer_rome',
    'crossbow_china', 'crossbow_rome',
    'scout_china', 'scout_india', 'scout_rome',
    'settler_china', 'settler_india', 'settler_rome',
    'spearman_china', 'spearman_india', 'spearman_rome',
    'sword_china', 'sword_india',
    'legionary_rome',
  ]);
  function portraitPath(type, civ) {
    const key = `${type}_${civ}`;
    return PORTRAIT_KEYS.has(key) ? `assets/portraits/${key}.png` : null;
  }

  /* ---------------- selection & action panels ---------------- */
  function iconForUnit(type, civ) {
    const path = portraitPath(type, civ);
    if (path) {
      const img = document.createElement('img');
      img.className = 'portraitIcon'; img.alt = ''; img.src = path;
      return img;
    }
    const s = Sprites.unit(type, 0, civ || 'rome', 6, 'idle', 0); // dir 6 = front, for icons
    const c = document.createElement('canvas'); c.width = 30; c.height = 30;
    const g = c.getContext('2d');
    const k = s.k || 1;
    const sc = Math.min(30 / s.cv.width, 30 / s.cv.height) * 1.4;
    g.drawImage(s.cv, 15 - s.ax * k * sc, 28 - s.ay * k * sc, s.cv.width * sc, s.cv.height * sc);
    return c;
  }
  function iconForBld(type, civ) {
    const variant = type === 'gate' ? '3G' : (type === 'wall' ? '3' : ''); // show a gate/wall mid-line
    const s = Sprites.building(type, civ || 'rome', 0, true, variant);
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
    let k = sel.map(e => e.id).join(',') + '|' + (game.placing ? game.placing.type : '') + '|' + (game.formation || 'box');
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
    const RES_INFO = {
      tree:  { name: 'Tree',          res: 'wood',  use: 'buildings, ships, siege' },
      bush:  { name: 'Berry Bush',    res: 'food',  use: 'feeds settlers & troops' },
      gold:  { name: 'Gold Mine',     res: 'gold',  use: 'units, tech, age-ups' },
      stone: { name: 'Stone Quarry',  res: 'stone', use: 'towers & walls' },
      iron:  { name: 'Iron Deposit',  res: 'iron',  use: 'advanced units & armor' },
      fish:  { name: 'Fish Shoal',    res: 'food',  use: 'food (fishing boats)' },
      deer:  { name: 'Deer',          res: 'food',  use: 'fast food — hunt it' },
      boar:  { name: 'Wild Boar',     res: 'food',  use: 'lots of food — but it fights back!' },
    };
    /* ---- selection cards ---- */
    if (first.kind === 'unit') {
      const types = {};
      for (const u of sel) types[u.type] = (types[u.type] || 0) + 1;
      for (const t in types) {
        const c = el('div', 'card', selP);
        const one = sel.find(x => x.type === t);
        const nm = types[t] === 1 ? one.displayName() : UNITS[t].name;
        const pPath = types[t] === 1 ? portraitPath(t, one.civKey) : null;
        let body = c;
        if (pPath) {
          c.classList.add('withPortrait');
          const img = el('img', 'portrait', c); img.alt = ''; img.src = pPath;
          body = el('div', 'cardBody', c);
        }
        el('div', 'nm', body).textContent = `${nm}${types[t] > 1 ? ' ×' + types[t] : ''}`;
        if (types[t] === 1) {
          const u = one;
          const hb = el('div', 'hpbar', body); el('div', '', hb).style.width = `${u.hp / u.maxHp * 100}%`;
          let sub = `ATK ${Math.round(u.effAtk(game))} · DEF ${u.effArmor(game)}${u.rank ? ' · ' + ['', 'Trained', 'Veteran', 'Elite'][u.rank] : ''}`;
          if (u.def.animal) {
            const icon = { deer: '🦌', boar: '🐗', wolf: '🐺', sheep: '🐑' }[u.type] || '🦌';
            sub = u.def.aggressive ? `${icon} Predator — hunts your settlers! ${u.def.meat} food if killed`
                : u.def.retaliate ? `${icon} ${u.def.meat} food — dangerous, fights back when hunted`
                : `${icon} ${u.def.meat} food — easy meat, right-click to hunt`;
          }
          if (u.carry && u.carry.amt > 0) sub = `Carrying ${u.carry.amt} ${u.carry.res} — returning to drop off`;
          if (u.cargo) sub = `⚓ Troops aboard: ${u.cargo.reduce((s, c2) => s + c2.def.pop, 0)}/${u.def.capacity} — tap a shore to land`;
          if (u.def.suicide) sub = '🔥 Rams and burns enemy ships — single use!';
          if (u.type === 'trader') {
            const known = u.visited ? Object.keys(u.visited).filter(k => +k !== game.humanId).length : 0;
            sub = u.bribedBy === game.humanId ? '💰 Your trade caravan — pays gold at your Town Center'
                : u.bribedBy >= 0 ? 'Already serving another kingdom'
                : `Knows ${known} rival kingdom${known === 1 ? '' : 's'} · protected inside borders`;
          }
          el('div', 'sub', body).textContent = sub;
        }
      }
    } else if (first.kind === 'lake') {
      // a freshwater lake — show its water level (farms drink it, rain refills it)
      const c = el('div', 'card', selP);
      el('div', 'nm', c).textContent = 'Freshwater Lake';
      const pct = Math.round(World.lakeFrac(first.x, first.y) * 100);
      const hb = el('div', 'hpbar', c); el('div', '', hb).firstChild;
      const bar = el('div', '', hb); bar.style.width = pct + '%'; bar.style.background = 'linear-gradient(90deg,#3fa3d2,#2b6491)';
      el('div', 'sub', c).textContent = pct > 0
        ? `💧 Water ${pct}% — farms draw from it; rain refills it`
        : '⚠ Dried up — farms here won\'t grow until it rains';
    } else if (RES_INFO[first.kind]) {
      // a resource node / animal — show what it is, its use, and how much is left
      const info = RES_INFO[first.kind];
      const c = el('div', 'card', selP);
      el('div', 'nm', c).textContent = info.name;
      const left = first.amount | 0;
      el('div', 'sub', c).textContent = first.kind === 'fish'
        ? `${left} food left · ${info.use}`
        : `${left} ${info.res} left · ${info.use}`;
      if (first.kind === 'boar' || first.kind === 'deer') {
        const hb = el('div', 'hpbar', c); el('div', '', hb).style.width = `${(first.hp / first.maxHp) * 100}%`;
      }
    } else {
      const b = first;
      const c = el('div', 'card', selP);
      el('div', 'nm', c).textContent = b.def.name + (b.owner === game.humanId ? '' : b.owner === -1 ? ' (Neutral)' : ' (Enemy)');
      const hb = el('div', 'hpbar', c); el('div', '', hb).style.width = `${b.hp / b.maxHp * 100}%`;
      let sub = b.built ? (b.def.desc || '') : `Building… ${Math.floor(b.progress * 100)}%`;
      if (b.built && b.type === 'farm') sub = b.irrigated ? '💧 Irrigated — infinite food' : '⚠ NO WATER — crops won\'t grow!';
      if (b.built && b.type === 'canal') sub = b.flowing ? '💧 Water is flowing' : '⚠ Not connected to a water source';
      if (b.built && b.garrison) sub = b.garrison.length
        ? `🏹 Manned: ${b.garrison.length}/${b.def.garrison} — firing at enemies in range`
        : 'Send archers here to man the wall (+25% attack, Rome: protected by slits)';
      if (b.built && b.store) {
        const held = b.store.food + b.store.wood + b.store.gold + b.store.stone + b.store.iron;
        sub = b.cart ? `🛒 Ox cart hauling ${Math.round(held + (b.cart.carry2 ? Object.values(b.cart.carry2).reduce((a,v)=>a+v,0) : 0))} goods to the Town Center`
                     : held > 0 ? `📦 Holding ${Math.round(held)} goods — a cart will haul them home`
                                : 'Drop-off point — settlers deposit here instead of walking home';
      }
      el('div', 'sub', c).textContent = sub;
      if (b.built && b.garrison && b.garrison.length && b.owner === game.humanId) {
        actionBtn(actP, {
          label: 'Eject', icon: makeIconCv('flag'), enabled: true,
          title: 'Order the archers down from the wall',
          onClick: () => {
            for (const u of b.garrison) {
              u.inWall = null;
              const spot = game.freeSpotNear(b, false);
              if (spot) { u.x = spot[0]; u.y = spot[1]; }
            }
            b.garrison = [];
            Audio2.sfx('click');
            refreshPanels(true);
          },
        });
      }
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
      // manual deposit: drop carried resources at the nearest drop-off now
      const carriers = sel.filter(u => u.carry && u.carry.amt > 0);
      if (carriers.length) {
        actionBtn(actP, {
          label: 'Drop Off', icon: makeIconCv('wood'), enabled: true,
          title: 'Carry the gathered resources to the nearest Town Center / Storehouse now',
          onClick: () => { for (const u of carriers) u.orderDeposit(game); Audio2.sfx('click'); refreshPanels(true); },
        });
      }
      if (settlers.length) {
        for (const bt of ['storehouse', 'farm', 'canal', 'wall', 'gate', 'dock', 'barracks', 'stable', 'range', 'university', 'grounds', 'tower', 'keep', 'castle', 'wonder']) {
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
      const scouts = sel.filter(u => u.type === 'scout');
      if (scouts.length) {
        actionBtn(actP, {
          label: 'Auto-Explore', icon: makeIconCv('flag'), cost: { gold: 50 },
          enabled: p.canAfford({ gold: 50 }) && !scouts.every(u => u.order && u.order.kind === 'autoexplore'),
          title: 'Pay 50 gold — your scout roams the whole map alone, dodging every fight, until it falls.',
          onClick: () => { if (p.canAfford({ gold: 50 })) { p.res.gold -= 50; for (const u of scouts) u.orderExplore(); message('Scout sets off to map the world…'); } },
        });
        // resource-finder: jump the view to the nearest deposit of a chosen kind
        for (const [kind, label, icon] of [['gold', 'Find Gold', 'gold'], ['iron', 'Find Iron', 'iron'], ['stone', 'Find Stone', 'stone'], ['tree', 'Find Wood', 'wood'], ['bush', 'Find Food', 'food']]) {
          actionBtn(actP, {
            label, icon: makeIconCv(icon), enabled: true,
            title: `Snap the view to the nearest ${label.split(' ')[1].toLowerCase()} deposit`,
            onClick: () => { if (!findNearestResource(scouts[0], kind)) message('No more of that to be found!', true); },
          });
        }
      }
      // formation picker — shown when 2+ military units are selected
      const milU = sel.filter(u => !u.civilian && !u.def.animal);
      if (milU.length >= 2) {
        const curF = game.formation || 'box';
        const fRow = el('div', '', actP);
        fRow.style.cssText = 'display:flex;gap:3px;flex-wrap:wrap;padding:2px 0 4px;border-top:1px solid rgba(255,255,255,.1);margin-top:2px;width:100%;';
        const fLabel = el('div', '', fRow);
        fLabel.textContent = 'Formation:';
        fLabel.style.cssText = 'font-size:10px;color:rgba(255,220,100,.75);align-self:center;margin-right:2px;white-space:nowrap;';
        for (const [key, icon, tip] of [
          ['box',    '□ Box',    'Balanced square — default marching order'],
          ['line',   '≡ Line',   'Wide battle line — maximises frontage for archers & melee'],
          ['wedge',  '▲ Wedge',  'Tip-forward V — cavalry charge, punches through the centre'],
          ['column', '|| Col',   'Two-file column — march through gates & narrow terrain'],
        ]) {
          const b = el('button', '', fRow);
          b.textContent = icon;
          b.title = tip;
          b.style.cssText = 'font-size:10px;padding:3px 5px;border-radius:3px;cursor:pointer;white-space:nowrap;' +
            (key === curF
              ? 'background:#e8c96a;color:#2a1a08;border:1px solid #c8a840;font-weight:bold;'
              : 'background:rgba(255,255,255,.1);color:#e8dfc8;border:1px solid rgba(255,255,255,.18);');
          b.onclick = ev => { ev.stopPropagation(); game.formation = key; Audio2.sfx('click'); refreshPanels(true); };
        }
        // pace note when mixed-speed units are selected
        const slowest = Math.min(...milU.map(u => u.speed));
        if (milU.some(u => u.speed > slowest + 0.05)) {
          const note = el('div', '', actP);
          note.style.cssText = 'font-size:10px;color:rgba(255,220,100,.65);padding:1px 0 3px;';
          note.textContent = `⚡ Army pace locked to slowest unit (${slowest.toFixed(2)})`;
        }
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
          onClick: () => Net.isClient() ? Net.sendTrain(b.id, uk) : b.enqueue(game, uk),
        });
      }
      // storehouse: manually dispatch an ox cart now (otherwise auto-dispatches)
      if (b.store) {
        const held = b.store.food + b.store.wood + b.store.gold + b.store.stone + b.store.iron;
        actionBtn(actP, {
          label: 'Send Cart', icon: iconForUnit('cart', p.civKey),
          enabled: !b.cart && held > 0,
          title: b.cart ? 'A cart is already hauling' : held > 0 ? 'Dispatch an ox cart to the Town Center now' : 'Nothing stored to haul yet',
          onClick: () => { b.depositT = 999; refreshPanels(true); }, // forces dispatch next tick
        });
      }
      if (b.type === 'tc' && p.age < 4) {
        const a = AGES[p.age];
        const needT = (a.towns || 0) - p.towns;
        const advancing = p.researching && p.researching.ageUp;
        actionBtn(actP, {
          label: advancing ? 'Advancing…' : 'Advance: ' + a.name.split(' ')[0],
          icon: makeIconCv('age'), cost: advancing ? null : a.cost,
          enabled: p.canAgeUp(),
          badge: advancing ? '⏳' : needT > 0 ? `${needT}🏰` : null,
          title: advancing ? 'Advancing to the next Age…'
               : needT > 0 ? `Capture ${needT} more town(s) first, then pay ${costStr(a.cost)}`
               : `Advance to the ${a.name} for ${costStr(a.cost)}`,
          onClick: () => { if (p.canAgeUp()) { p.startAgeUp(); message(`Advancing to the ${a.name}…`); refreshPanels(true); }
                           else if (needT > 0) message(`Capture ${needT} more town(s) first`, true);
                           else message('Not enough resources to advance', true); },
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
  // resource-finder: snap the camera to the nearest deposit of a kind & ping it
  function findNearestResource(scout, kind) {
    const W = game.world; let best = null, bd = 1e18;
    const sx = scout ? scout.x : game.cam.x, sy = scout ? scout.y : game.cam.y;
    for (const o of W.objects) {
      if (!o || !o.alive || o.kind !== kind) continue;
      const d = (o.x - sx) ** 2 + (o.y - sy) ** 2;
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) return false;
    game.cam.x = World.isoX(best.x + .5, best.y + .5);
    game.cam.y = World.isoY(best.x + .5, best.y + .5);
    game.ping(best.x + .5, best.y + .5);
    Audio2.sfx('click');
    return true;
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
