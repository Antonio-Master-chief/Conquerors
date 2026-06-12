/* ============ CONQUERORS — game state, world setup, render, main loop ============ */
'use strict';

let Game = null;

/* ---------------- game factory ---------------- */
function makeGame(civKey, diff) {
  const canvas = document.getElementById('game');
  const g = {
    canvas, ctx: canvas.getContext('2d'),
    dpr: Math.min(2, window.devicePixelRatio || 1),
    cam: { x: 0, y: 0, zoom: 0.9 },
    world: World.W,
    players: [], units: [], buildings: [], projectiles: [], particles: [], pings: [],
    selected: [], placing: null, targeting: null,
    ai: [], time: 0, humanId: 0, over: false, speed: 1,
    lastAlertT: -99, traderT: 25,
    poisons: [],                  // active poisoned water sources
    grid: new Map(),

    hostile(a, b) { return a !== b; },

    /* which kingdom's borders is this point inside? -2 = wilderness */
    inTerritory(x, y) {
      const r2 = CFG.TERRITORY * CFG.TERRITORY;
      for (const b of this.buildings) {
        if (b.dead || !b.built || b.owner < 0 || (b.type !== 'tc' && b.type !== 'town')) continue;
        if (dist2(x, y, b.cx(), b.cy()) <= r2) return b.owner;
      }
      return -2;
    },

    rebuildGrid() {
      this.grid.clear();
      for (const u of this.units) {
        if (u.dead) continue;
        const k = ((u.x / 3) | 0) + ((u.y / 3) | 0) * 64;
        let arr = this.grid.get(k);
        if (!arr) { arr = []; this.grid.set(k, arr); }
        arr.push(u);
      }
    },
    queryUnits(x, y, r) {
      const out = [];
      const c0x = ((x - r) / 3) | 0, c1x = ((x + r) / 3) | 0;
      const c0y = ((y - r) / 3) | 0, c1y = ((y + r) / 3) | 0;
      for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
        const arr = this.grid.get(cx + cy * 64);
        if (!arr) continue;
        for (const u of arr) if (dist2(u.x, u.y, x, y) <= r * r) out.push(u);
      }
      return out;
    },
    nearestEnemy(src, r) {
      const x = src.cx(), y = src.cy();
      let best = null, bd = r * r;
      for (const u of this.queryUnits(x, y, r)) {
        if (u.dead || !this.hostile(src.owner, u.owner) || u.def.npc) continue;
        const d = dist2(x, y, u.x, u.y);
        if (d < bd) { bd = d; best = u; }
      }
      return best;
    },
    findDropoff(owner, x, y, naval) {
      let best = null, bd = 1e9;
      for (const b of this.buildings) {
        if (b.dead || !b.built || b.owner !== owner || !b.def.dropoff) continue;
        if (naval ? b.type !== 'dock' : b.def.naval) continue; // boats only use docks, walkers never do
        const d = dist2(x, y, b.cx(), b.cy());
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    },
    nearDropoff(owner, x, y, r) {
      const d = this.findDropoff(owner, x, y);
      return d && dist(x, y, d.cx(), d.cy()) <= r;
    },
    playerHasBuilding(owner, type) {
      return this.buildings.some(b => !b.dead && b.built && b.owner === owner && b.type === type);
    },
    queuedPop(owner) {
      let n = 0;
      for (const b of this.buildings) if (!b.dead && b.owner === owner)
        for (const q of b.queue) n += UNITS[q.uKey].pop;
      return n;
    },
    popFree(u) { const p = this.players[u.owner]; if (p) p.pop -= u.def.pop; },
    unblockBuilding(b) {
      if (b.def.farm) return;
      const grid = b.def.naval ? this.world.navBlocked : this.world.blocked;
      for (let y = b.y; y < b.y + b.size; y++) for (let x = b.x; x < b.x + b.size; x++) {
        grid[World.idx(x, y)] = 0;
        if (!b.def.canal && !b.def.naval) this.world.sightBlock[World.idx(x, y)] = 0;
      }
    },
    freeSpotNear(b, naval) {
      const grid = naval ? this.world.navBlocked : this.world.blocked;
      for (let d = 1; d <= 4; d++) {
        const x0 = b.x - d, y0 = b.y - d, x1 = b.x + b.size + d - 1, y1 = b.y + b.size + d - 1;
        const cand = [];
        for (let x = x0; x <= x1; x++) { cand.push([x, y0], [x, y1]); }
        for (let y = y0 + 1; y < y1; y++) { cand.push([x0, y], [x1, y]); }
        for (const [x, y] of cand) {
          if (World.inB(x, y) && !grid[World.idx(x, y)]) return [x + .5, y + .5];
        }
      }
      return null;
    },
    message(text, bad) { UI.message(text, bad); },
    ping(x, y) { this.pings.push({ x, y, t: this.time }); },
    checkAttackAlert(x, y) {
      if (this.time - this.lastAlertT < 12) return;
      this.lastAlertT = this.time;
      this.message('Your empire is under attack!', true);
      this.ping(x, y);
      Audio2.sfx('alert');
      Audio2.say('Our empire is under attack!', true);
    },
    onAgeUp(p) {
      if (p.id === this.humanId) {
        this.message(`You have advanced to the ${AGES[p.age - 1].name}!`);
        Audio2.sfx('age');
        Audio2.say(`We have entered the ${AGES[p.age - 1].name}.`, true);
        UI.refreshPanels(true);
      } else this.message(`${p.civ.name} advanced to the ${AGES[p.age - 1].name}`);
    },
    onTech(p, key) {
      if (p.id === this.humanId) {
        this.message(`${TECHS[key].name} researched`);
        Audio2.sfx('train');
        Audio2.say(`${TECHS[key].name} research complete.`);
        UI.refreshPanels(true);
      }
    },
  };

  function resize() {
    canvas.width = innerWidth * g.dpr;
    canvas.height = innerHeight * g.dpr;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
  }
  window.addEventListener('resize', resize);
  resize();
  return g;
}

/* ---------------- world setup ---------------- */
function setupMatch(game, civKey, diff) {
  World.gen((Date.now() % 100000) | 0);

  const civKeys = Object.keys(CIVS);
  const others = civKeys.filter(k => k !== civKey).sort(() => Math.random() - .5);
  game.players = [
    new Player(0, civKey, true, diff),
    new Player(1, others[0], false, diff),
    new Player(2, others[1], false, diff),
  ];

  for (let i = 0; i < 3; i++) {
    const s = game.world.starts[i];
    // clear obstacles under the TC
    for (let y = s.y - 1; y <= s.y + 1; y++) for (let x = s.x - 1; x <= s.x + 1; x++) {
      const o = World.objAt(x, y); if (o) World.removeObj(o);
      game.world.blocked[World.idx(x, y)] = 0;
    }
    const tc = Sim.placeBuilding(game, i, 'tc', s.x - 1, s.y - 1, true);
    const offs = [[-2.2, 1.8], [2.4, 1.6], [0, 2.8]];
    for (const [ox, oy] of offs) Sim.spawnUnit(game, i, 'settler', s.x + .5 + ox, s.y + .5 + oy);
    Sim.spawnUnit(game, i, 'scout', s.x + .5, s.y - 2.4);
  }

  // neutral towns + garrisons
  game.world.towns.forEach((t, ti) => {
    for (let y = t.y - 1; y <= t.y + 1; y++) for (let x = t.x - 1; x <= t.x + 1; x++) {
      const o = World.objAt(x, y); if (o) World.removeObj(o);
      game.world.blocked[World.idx(x, y)] = 0;
    }
    Sim.placeBuilding(game, -1, 'town', t.x - 1, t.y - 1, true);
    const center = ti === 0;
    const garrison = center
      ? ['spearman', 'spearman', 'spearman', 'spearman', 'archer', 'archer', 'archer', 'sword', 'sword']
      : ['spearman', 'spearman', 'spearman', 'archer'];
    garrison.forEach((gk, gi) => {
      const a = gi / garrison.length * Math.PI * 2;
      const u = Sim.spawnUnit(game, -1, gk, t.x + .5 + Math.cos(a) * 2.2, t.y + .5 + Math.sin(a) * 2.2, 'none');
      u.home = { x: u.x, y: u.y };
    });
  });

  game.ai = [new AIController(game, 1), new AIController(game, 2)];

  // camera on human TC
  const hs = game.world.starts[0];
  game.cam.x = World.isoX(hs.x, hs.y);
  game.cam.y = World.isoY(hs.x, hs.y);
  game.cam.zoom = innerWidth < 700 ? 0.75 : 0.95;

  World.recomputeFog([...game.units, ...game.buildings], game.humanId);
}

/* ---------------- traders ---------------- */
function maybeSpawnTrader(game, dt) {
  game.traderT -= dt;
  if (game.traderT > 0) return;
  game.traderT = 55 + Math.random() * 35;
  const alive = game.units.filter(u => !u.dead && u.type === 'trader').length;
  if (alive >= 2) return;
  for (let i = 0; i < 50; i++) {
    const x = 4 + (Math.random() * (World.N - 8)) | 0, y = 4 + (Math.random() * (World.N - 8)) | 0;
    if (!game.world.blocked[World.idx(x, y)]) {
      Sim.spawnUnit(game, -1, 'trader', x + .5, y + .5, 'none');
      return;
    }
  }
}

/* ---------------- victory ---------------- */
function checkVictory(game) {
  if (game.over) return;
  for (const p of game.players) {
    if (p.defeated) continue;
    const hasUnits = game.units.some(u => !u.dead && u.owner === p.id);
    const hasBlds = game.buildings.some(b => !b.dead && b.owner === p.id && b.type !== 'town');
    if (!hasUnits && !hasBlds) {
      p.defeated = true;
      for (const b of game.buildings) {
        if (!b.dead && b.owner === p.id && b.type === 'town') { b.owner = -1; b.capture = {}; b.captureBy = -2; }
      }
      game.message(`${p.civ.name} (${PLAYER_COLORS[p.id].name}) has been eliminated!`);
    }
  }
  if (game.players[game.humanId].defeated) { game.over = true; UI.endScreen(false); }
  else if (game.players.every(p => p.isHuman || p.defeated)) { game.over = true; UI.endScreen(true); }
}

/* ---------------- rendering ---------------- */
function render(game) {
  const ctx = game.ctx, cv = game.canvas;
  const z = game.cam.zoom * game.dpr;
  const view = { left: game.cam.x - cv.width / 2 / z, top: game.cam.y - cv.height / 2 / z, z };
  ctx.fillStyle = '#0d1622';
  ctx.fillRect(0, 0, cv.width, cv.height);

  World.drawTerrain(ctx, { x: game.cam.x, y: game.cam.y, zoom: z }, cv.width, cv.height);

  // selection rings (under entities)
  for (const e of game.selected) {
    if (e.dead) continue;
    const ix = (World.isoX(e.cx(), e.cy()) - view.left) * z;
    const iy = (World.isoY(e.cx(), e.cy()) - view.top) * z;
    const r = e.kind === 'bld' ? e.size * 30 : (e.def.big ? 24 : 13);
    ctx.strokeStyle = e.owner === game.humanId ? 'rgba(140,255,120,.85)' : 'rgba(255,255,255,.6)';
    ctx.lineWidth = 2 * z;
    ctx.beginPath(); ctx.ellipse(ix, iy + (e.kind === 'bld' ? 0 : 1 * z), r * z, r * z * .5, 0, 0, 7); ctx.stroke();
  }

  // build ghost
  if (game.placing && game.placing.bx !== undefined) {
    const { type, bx, by } = game.placing;
    const B = BUILDINGS[type];
    const ok = Sim.canPlace(game, type, bx, by);
    ctx.fillStyle = ok ? 'rgba(110,220,90,.3)' : 'rgba(220,70,50,.35)';
    ctx.beginPath();
    const cx = bx + B.size / 2, cy = by + B.size / 2;
    const tx = (World.isoX(cx, cy) - view.left) * z, ty = (World.isoY(cx, cy) - view.top) * z;
    ctx.moveTo(tx, ty - B.size * 16 * z);
    ctx.lineTo(tx + B.size * 32 * z, ty);
    ctx.lineTo(tx, ty + B.size * 16 * z);
    ctx.lineTo(tx - B.size * 32 * z, ty);
    ctx.closePath(); ctx.fill();
    const s = Sprites.building(type, game.players[0].civKey, 0, true);
    ctx.globalAlpha = .65;
    ctx.drawImage(s.cv, tx - s.ax * z, ty - s.ay * z, s.cv.width * z, s.cv.height * z);
    ctx.globalAlpha = 1;
  }

  // ----- collect & sort drawables -----
  const margin = 120;
  const sxMin = view.left - margin, sxMax = view.left + cv.width / z + margin;
  const syMin = view.top - margin, syMax = view.top + cv.height / z + margin;
  const draws = [];
  for (const o of game.world.objects) {
    if (!o.alive) continue;
    const v = World.visAt(o.x, o.y);
    if (v === 0) continue;
    const ix = World.isoX(o.x + .5, o.y + .5), iy = World.isoY(o.x + .5, o.y + .5);
    if (ix < sxMin || ix > sxMax || iy < syMin || iy > syMax) continue;
    draws.push({ key: o.x + o.y + 1, obj: o });
  }
  for (const b of game.buildings) {
    if (b.dead) continue;
    if (World.visAt(b.cx(), b.cy()) === 0) continue;
    const ix = World.isoX(b.cx(), b.cy()), iy = World.isoY(b.cx(), b.cy());
    if (ix < sxMin - 100 || ix > sxMax + 100 || iy < syMin || iy > syMax + 100) continue;
    draws.push({ key: b.x + b.y + b.size, bld: b });
  }
  for (const u of game.units) {
    if (u.dead || u.inShip) continue;
    if (u.owner !== game.humanId && World.visAt(u.x, u.y) !== 2) continue;
    const ix = World.isoX(u.x, u.y), iy = World.isoY(u.x, u.y);
    if (ix < sxMin || ix > sxMax || iy < syMin || iy > syMax) continue;
    draws.push({ key: u.x + u.y, unit: u });
  }
  draws.sort((a, b) => a.key - b.key);

  for (const d of draws) {
    if (d.obj) {
      const o = d.obj;
      const s = Sprites.obj(o.kind, o.variant);
      const ix = (World.isoX(o.x + .5, o.y + .5) - view.left) * z;
      const iy = (World.isoY(o.x + .5, o.y + .5) - view.top) * z;
      const dim = World.visAt(o.x, o.y) === 1;
      if (dim) ctx.globalAlpha = .8;
      ctx.drawImage(s.cv, ix - s.ax * z, iy - s.ay * z + 8 * z, s.cv.width * z, s.cv.height * z);
      ctx.globalAlpha = 1;
    } else if (d.bld) {
      const b = d.bld;
      const pos = b.drawSprite(ctx, view);
      drawHpBar(ctx, game, b, pos.ix, pos.iy - (b.size * 26 + 26) * z, z, b.size * 40);
    } else {
      const u = d.unit;
      const pos = u.drawSprite(ctx, view);
      drawHpBar(ctx, game, u, pos.ix, pos.iy - (u.def.big ? 58 : 42) * z, z, 26);
    }
  }

  // projectiles
  for (const pr of game.projectiles) {
    const ix = (World.isoX(pr.x, pr.y) - view.left) * z;
    const iy = (World.isoY(pr.x, pr.y) - view.top) * z;
    if (pr.stone) {
      ctx.fillStyle = pr.burn ? '#ff7a30' : '#6b6557';
      ctx.beginPath(); ctx.arc(ix, iy - 14 * z, 4 * z, 0, 7); ctx.fill();
    } else {
      const t = pr.target;
      const tx = (World.isoX(t.cx(), t.cy()) - view.left) * z, ty = (World.isoY(t.cx(), t.cy()) - view.top) * z;
      const d = Math.hypot(tx - ix, ty - iy) || 1;
      ctx.strokeStyle = '#e8dcc3'; ctx.lineWidth = 1.6 * z;
      ctx.beginPath(); ctx.moveTo(ix, iy - 10 * z);
      ctx.lineTo(ix + (tx - ix) / d * 9 * z, iy - 10 * z + (ty - iy) / d * 9 * z); ctx.stroke();
    }
  }

  // particles (p.z = screen-space height, used by rising smoke)
  for (const p of game.particles) {
    const ix = (World.isoX(p.x, p.y) - view.left) * z;
    const iy = (World.isoY(p.x, p.y) - view.top) * z;
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(ix - p.size * z / 2, iy - (8 + (p.z || 0)) * z - p.size * z / 2, p.size * z, p.size * z);
  }
  ctx.globalAlpha = 1;

  // day / night tint
  const ph = (game.time % CFG.DAY_CYCLE) / CFG.DAY_CYCLE;
  const night = clamp(Math.sin((ph - 0.5) * Math.PI * 2) * 1.6, 0, 1); // 0 by day, 1 deep night
  const dusk = Math.max(0, 1 - Math.abs(ph - 0.5) * 14) + Math.max(0, 1 - Math.abs(ph - 0.97) * 14);
  if (night > 0.01) { ctx.fillStyle = `rgba(14,22,66,${(night * 0.28).toFixed(3)})`; ctx.fillRect(0, 0, cv.width, cv.height); }
  if (dusk > 0.01) { ctx.fillStyle = `rgba(255,128,46,${(dusk * 0.10).toFixed(3)})`; ctx.fillRect(0, 0, cv.width, cv.height); }

  World.drawFog(ctx, { x: game.cam.x, y: game.cam.y, zoom: z }, cv.width, cv.height);

  // drag selection box (CSS px -> device px)
  const dr = Input.dragRect();
  if (dr) {
    ctx.strokeStyle = 'rgba(140,255,120,.9)'; ctx.lineWidth = 1.5 * game.dpr;
    ctx.strokeRect(dr.a.x * game.dpr, dr.a.y * game.dpr,
      (dr.b.x - dr.a.x) * game.dpr, (dr.b.y - dr.a.y) * game.dpr);
    ctx.fillStyle = 'rgba(140,255,120,.08)';
    ctx.fillRect(dr.a.x * game.dpr, dr.a.y * game.dpr,
      (dr.b.x - dr.a.x) * game.dpr, (dr.b.y - dr.a.y) * game.dpr);
  }
}

function drawHpBar(ctx, game, e, ix, iy, z, w) {
  const sel = game.selected.includes(e);
  if (!sel && e.hp >= e.maxHp) return;
  const ww = w * z;
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(ix - ww / 2, iy, ww, 4 * z);
  const r = clamp(e.hp / e.maxHp, 0, 1);
  ctx.fillStyle = r > .55 ? '#6fc24a' : r > .25 ? '#e0a23a' : '#d04a35';
  ctx.fillRect(ix - ww / 2 + z, iy + z, (ww - 2 * z) * r, 2 * z);
}

/* ---------------- main loop ---------------- */
let lastT = 0, fogT = 0, uiT = 0, mmT = 0, panelT = 0, vicT = 0, leashT = 0, auraT = 0,
    irrT = 0, smokeT = 0, moodT = 0, siegeT2 = 0, poisonT2 = 0;

function loop(now) {
  const game = Game;
  if (!game) return;
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
  lastT = now;

  Input.update(dt);
  // game speed: run extra simulation sub-steps, render once
  for (let step = 0; step < game.speed; step++) simStep(game, dt);

  render(game);
  requestAnimationFrame(loop);
}

function simStep(game, dt) {
  game.time += dt;
  game.rebuildGrid();

  for (const u of game.units) u.update(game, dt);
  Sim.separate(game, dt);
  for (const b of game.buildings) b.update(game, dt);
  Sim.updateProjectiles(game, dt);
  Sim.updateParticles(game, dt);
  for (const p of game.players) p.tickResearch(dt, game);
  for (const ai of game.ai) ai.tick(dt);
  maybeSpawnTrader(game, dt);

  if ((auraT += dt) > 0.5) { auraT = 0; Sim.auras(game); }
  if ((siegeT2 += dt) > 2) { siegeT2 = 0; Sim.sieges(game); }
  if ((poisonT2 += dt) > 1) { // poisoned water sickens nearby enemies of the poisoner
    poisonT2 = 0;
    game.poisons = game.poisons.filter(ps => ps.until > game.time);
    for (const ps of game.poisons) {
      for (const u of game.queryUnits(ps.x, ps.y, 12)) {
        if (!u.dead && u.owner >= 0 && u.owner !== ps.by && !u.def.npc) u.poisonT = game.time;
      }
      if (Math.random() < 0.4 && World.visAt(ps.x, ps.y) === 2) Sim.puff(game, ps.x, ps.y, '#5fae3f', 2);
    }
  }
  if ((irrT += dt) > 2) { irrT = 0; Sim.recomputeIrrigation(game); }
  if ((smokeT += dt) > 0.5) { // chimney smoke from visible settlements
    smokeT = 0;
    for (const b of game.buildings) {
      if (b.dead || !b.built || (b.type !== 'tc' && b.type !== 'town')) continue;
      if (World.visAt(b.cx(), b.cy()) === 2 && Math.random() < 0.7) Sim.smoke(game, b);
    }
  }
  if ((moodT += dt) > 1) { // adaptive soundtrack: war drums when fighting, calm theme in peace
    moodT = 0;
    Audio2.setMood(game.time - (game.combatT || -99) < 9 ? 'battle' : 'peace');
  }
  if ((leashT += dt) > 0.8) {
    leashT = 0;
    for (const u of game.units) {
      if (u.dead || u.owner !== -1 || !u.home) continue;
      if (dist(u.x, u.y, u.home.x, u.home.y) > 9) { u.clearOrder(); u.orderMove(u.home.x, u.home.y); }
    }
  }
  if ((fogT += dt) > 0.3) {
    fogT = 0;
    World.recomputeFog([...game.units, ...game.buildings], game.humanId);
  }
  if ((uiT += dt) > 0.25) { uiT = 0; UI.refreshTop(); }
  if ((panelT += dt) > 0.6) { panelT = 0; if (game.selected.length || game.placing) UI.refreshPanels(true); }
  if ((mmT += dt) > 0.5) { mmT = 0; UI.renderMinimap(); }
  if ((vicT += dt) > 2) { vicT = 0; checkVictory(game); }

  // cleanup
  game.pings = game.pings.filter(p => game.time - p.t < 2);
  if (game.units.some(u => u.dead)) game.units = game.units.filter(u => !u.dead);
  if (game.buildings.some(b => b.dead)) {
    game.selected = game.selected.filter(e => !e.dead);
    game.buildings = game.buildings.filter(b => !b.dead);
  }
  game.selected = game.selected.filter(e => !e.dead);
}

/* ---------------- entry ---------------- */
window.startGame = function (civKey, diff) {
  Game = makeGame(civKey, diff);
  setupMatch(Game, civKey, diff);
  UI.init(Game);
  Input.init(Game);
  Sim.recomputeIrrigation(Game);
  Audio2.startAmbient();
  Audio2.setMood('peace');
  Game.message(`Welcome, ${CIVS[civKey].name}. Capture neutral towns to grow your empire!`);
  Audio2.say(`Welcome, commander of the ${CIVS[civKey].name}. Capture neutral towns to grow your empire.`);
  lastT = performance.now();
  requestAnimationFrame(loop);
};

Title.build();
