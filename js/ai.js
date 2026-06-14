/* ============ CONQUERORS — AI opponent (classic AoE-style skirmish AI) ============
   Economy build-up -> tech -> town capture racing -> counter-comp attack waves. */
'use strict';

class AIController {
  constructor(game, pid) {
    this.game = game; this.pid = pid;
    this.p = game.players[pid];
    const d = this.p.difficulty;
    this.cfg = d === 'easy'
      ? { settlers: 7,  wave: 11, think: 1.3, techy: false, gatherBoost: 1 }
      : d === 'hard'
      ? { settlers: 13, wave: 7,  think: 0.7, techy: true,  gatherBoost: 1.18 }
      : { settlers: 10, wave: 8,  think: 0.9, techy: true,  gatherBoost: 1 };
    this.p.bonus.gather *= this.cfg.gatherBoost;
    this.t = Math.random();
    this.bldHp = new Map();        // damage detection
    this.defendUntil = 0; this.defendPos = null;
    this.waveTarget = null;
    this.farms = 0;
    this.reachCache = new Map();   // townId -> land-reachable from our TC
  }

  myUnits() { return this.game.units.filter(u => !u.dead && u.owner === this.pid); }
  myBlds() { return this.game.buildings.filter(b => !b.dead && b.owner === this.pid); }
  tc() { return this.game.buildings.find(b => !b.dead && b.owner === this.pid && (b.type === 'tc')); }

  tick(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = this.cfg.think;
    if (this.p.defeated) return;
    const tc = this.tc();
    if (!tc) return; // can still fight with remaining units via auto-aggro
    const units = this.myUnits();
    const blds = this.myBlds();
    const settlers = units.filter(u => u.type === 'settler');
    const army = units.filter(u => !u.civilian && u.type !== 'scout' && !u.def.naval);

    // stall rescue: an AI that loses every settler with an empty granary can
    // never recover on its own — a relief caravan tops up its food
    if (settlers.length < 3 && this.p.res.food < 100 &&
        this.game.time - (this.lastRelief || 0) > 45) {
      this.lastRelief = this.game.time;
      this.p.res.food += 60;
    }

    this.detectAttacks(blds, units);
    this.economy(tc, blds, settlers);
    this.production(tc, blds, settlers, army);
    this.research(blds);
    this.military(tc, army, settlers.length);

    // idle fishing boats get back to work
    for (const u of units) {
      if (u.type === 'fishboat' && !u.order) {
        const fish = World.nearestObj('fish', u.x, u.y, 22);
        if (fish) u.orderGather(fish);
      }
    }
  }

  /* ---------- damage detection -> defense ---------- */
  detectAttacks(blds, units) {
    const g = this.game;
    for (const b of blds) {
      const prev = this.bldHp.get(b.id);
      if (prev !== undefined && b.hp < prev - 1) {
        this.defendUntil = g.time + 14;
        this.defendPos = { x: b.cx(), y: b.cy() };
      }
      if (b.besieged) { // break the siege or starve
        this.defendUntil = g.time + 20;
        this.defendPos = { x: b.cx(), y: b.cy() };
      }
      this.bldHp.set(b.id, b.hp);
    }
  }

  /* ---------- economy ---------- */
  settlerTarget() {
    // always leave pop room for an army (towns are the only pop source)
    return Math.max(4, Math.min(this.cfg.settlers, this.p.popCap - 7));
  }
  economy(tc, blds, settlers) {
    const g = this.game, p = this.p;
    // train settlers
    if (settlers.length < this.settlerTarget() && tc.queue.length === 0 && p.canAfford(UNITS.settler.cost))
      tc.enqueue(g, 'settler');

    // resource weights by age / pending needs
    const w = { food: 3, wood: 2.2, gold: 1.6, stone: 0.4, iron: p.age >= 2 ? 1.6 : 0.2 };
    if (p.age < 4) { const c = AGES[p.age].cost; for (const k in c) if (p.res[k] < c[k]) w[k] = (w[k] || 0) + 1.4; }
    // tech buildings are wood-gated: push lumberjacks until range+university exist
    if (p.age >= 2 && !(this.game.playerHasBuilding(this.pid, 'range') && this.game.playerHasBuilding(this.pid, 'university')))
      w.wood += 2.2;
    // count current assignment
    const counts = { food: 0, wood: 0, gold: 0, stone: 0, iron: 0 };
    const idle = [];
    const resOf = obj => obj.kind === 'bld' ? 'food' : OBJ_RES[obj.kind];
    for (const s of settlers) {
      const o = s.order;
      if (o && (o.kind === 'gather' || o.kind === 'deposit')) {
        const obj = o.kind === 'gather' ? o.obj : o.resume;
        if (obj) { const rk = resOf(obj); counts[rk] = (counts[rk] || 0) + 1; continue; }
      }
      if (o && o.kind === 'build') continue;
      idle.push(s);
    }
    const total = settlers.length || 1;
    for (const s of idle) {
      // most-needed resource
      let bestK = 'food', bestScore = -99;
      for (const k in w) {
        const score = w[k] - (counts[k] / total) * 7;
        if (score > bestScore) { bestScore = score; bestK = k; }
      }
      const kinds = { food: ['bush', 'farm'], wood: ['tree'], gold: ['gold'], stone: ['stone'], iron: ['iron'] };
      let obj = null;
      for (const kd of kinds[bestK]) {
        if (kd === 'farm') {
          const f = this.game.buildings.find(b => !b.dead && b.built && b.owner === this.pid && b.type === 'farm');
          if (f) { obj = f; break; }
        } else { obj = this.safeObj(kd, tc); if (obj) break; }
      }
      if (obj) { s.orderGather(obj); counts[bestK]++; }
      else if (bestK === 'food' && p.canAfford(BUILDINGS.farm.cost)) this.tryBuildFarm(tc, s);
      else { w[bestK] = -99; } // resource exhausted nearby; try others next loop
    }
    // keep farms coming if no berries left
    if (!World.nearestObj('bush', tc.cx(), tc.cy(), 18) && this.farms < 4 + this.p.age &&
        p.canAfford(BUILDINGS.farm.cost) && settlers.length) {
      if (this.tryBuildFarm(tc, settlers[0])) this.farms++;
    }
  }

  /* nearest resource that is NOT inside a hostile town's garrison kill-zone —
     gathering next to a neutral keep is how AI settlers used to get massacred */
  safeObj(kind, tc) {
    const g = this.game;
    let best = null, bd = 26 * 26;
    for (const o of g.world.objects) {
      if (!o.alive || o.kind !== kind) continue;
      const d = dist2(tc.cx(), tc.cy(), o.x + .5, o.y + .5);
      if (d >= bd) continue;
      let danger = false;
      for (const b of g.buildings) {
        if (b.dead || b.type !== 'town' || b.owner === this.pid) continue;
        if (dist2(o.x + .5, o.y + .5, b.cx(), b.cy()) < 64) { danger = true; break; }
      }
      if (!danger) { bd = d; best = o; }
    }
    return best;
  }

  /* farms need irrigation: place them next to natural water (a pond is
     guaranteed near every start by map gen) */
  tryBuildFarm(tc, settler) {
    const g = this.game, p = this.p;
    const isWater = (x, y) => World.isFresh(x, y); // crops need fresh water, not the sea
    const waterNear = (cx2, cy2) => {
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++)
        if (dx * dx + dy * dy <= 9 && isWater((cx2 + dx) | 0, (cy2 + dy) | 0)) return true;
      return false;
    };
    let best = null, bd = 1e9;
    for (let r = 2; r < 18; r += 1) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const a = Math.random() * Math.PI * 2;
        const bx = Math.round(tc.cx() + Math.cos(a) * r), by = Math.round(tc.cy() + Math.sin(a) * r);
        if (!Sim.canPlace(g, 'farm', bx, by)) continue;
        if (!waterNear(bx + 1, by + 1)) continue;
        const d = dist2(bx, by, tc.cx(), tc.cy());
        if (d < bd) { bd = d; best = [bx, by]; }
      }
      if (best) break;
    }
    if (!best) return this.tryBuild('farm', tc, settler); // fallback (will read as dry)
    p.pay(BUILDINGS.farm.cost);
    const b = Sim.placeBuilding(g, this.pid, 'farm', best[0], best[1], false);
    settler.orderBuild(b);
    return true;
  }

  /* ---------- buildings & training ---------- */
  production(tc, blds, settlers, army) {
    const g = this.game, p = this.p;
    const has = t => blds.some(b => b.type === t);
    const builderFree = settlers.find(s => !s.order || s.order.kind === 'gather');
    if (builderFree) {
      if (!has('barracks') && p.canAfford(BUILDINGS.barracks.cost)) this.tryBuild('barracks', tc, builderFree);
      else if (p.age >= 2 && !has('range') && p.canAfford(BUILDINGS.range.cost)) this.tryBuild('range', tc, builderFree);
      else if (p.age >= 2 && !has('university') && p.canAfford(BUILDINGS.university.cost)) this.tryBuild('university', tc, builderFree);
      else if (p.age >= 2 && this.cfg.techy && !has('grounds') && p.canAfford(BUILDINGS.grounds.cost)) this.tryBuild('grounds', tc, builderFree);
      else if (p.age >= 2 && blds.filter(b => b.type === 'tower').length < 2 && p.res.stone >= 110 && this.defendPos)
        this.tryBuild('tower', tc, builderFree);
      else if (!has('dock') && p.res.wood > 220 && p.canAfford(BUILDINGS.dock.cost))
        this.tryBuildDock(tc, builderFree);
    }

    // age up
    if (p.canAgeUp()) { p.startAgeUp(); return; }

    // army training: keep mixed composition
    const popRoom = p.pop < p.popCap - 1;
    if (!popRoom) return;
    // once the town requirement is met, bank food/gold for the age-up
    // instead of bleeding it all into troops (keep a small defense force)
    if (p.age < 4 && !p.researching && p.towns >= (AGES[p.age].towns || 0) &&
        army.length >= (this.p.difficulty === 'easy' ? 7 : 5)) return;
    const reserve = settlers.length < this.settlerTarget() ? 60 : 0; // keep food for settlers
    // save wood for missing tech buildings instead of spending it all on troops
    const woodReserve = p.age >= 2 && (!has('range') || !has('university')) ? 160 : 0;
    const melee = army.filter(u => UNITS[u.type].range <= 1.2).length;
    const ranged = army.length - melee;
    for (const b of blds) {
      if (!b.built || !b.def.trains || b.queue.length >= 2) continue;
      const options = b.trainable(g).filter(k => k !== 'settler' && k !== 'scout');
      if (!options.length) continue;
      let pick;
      if (b.type === 'dock') { // small fleet: fishers first, then a couple of warships
        const mine = g.units.filter(u => !u.dead && u.owner === this.pid);
        const fishers = mine.filter(u => u.type === 'fishboat').length;
        const warShips = mine.filter(u => u.def.naval && !u.civilian).length;
        if (fishers < 2 && p.canAfford(UNITS.fishboat.cost)) b.enqueue(g, 'fishboat');
        else if (p.age >= 2 && warShips < 2 && Math.random() < 0.3) {
          const w2 = options.includes('quinquereme') && p.age >= 3 ? 'quinquereme'
                   : options.includes('catamaran') ? 'catamaran'
                   : options.includes('galley') ? 'galley' : null;
          if (w2 && p.canAfford(UNITS[w2].cost)) b.enqueue(g, w2);
        }
        continue;
      }
      if (b.type === 'range') pick = options.includes('chukonu') ? 'chukonu' : 'archer';
      else {
        // prefer civ specials & counters
        if (options.includes('elephant') && p.res.food > 250 && Math.random() < .4) pick = 'elephant';
        else if (options.includes('chariot') && Math.random() < .3) pick = 'chariot';
        else if (options.includes('centurion') && Math.random() < .25) pick = 'centurion';
        else if (options.includes('catapult') && Math.random() < .2) pick = 'catapult';
        else if (melee <= ranged) pick = options.includes('legionary') ? 'legionary' : options.includes('sword') ? 'sword' : 'spearman';
        else pick = 'spearman';
      }
      if (pick && UNITS[pick] && p.res.food - (UNITS[pick].cost.food || 0) >= reserve &&
          p.res.wood - (UNITS[pick].cost.wood || 0) >= woodReserve && p.canAfford(UNITS[pick].cost))
        b.enqueue(g, pick);
    }
  }

  tryBuildDock(tc, settler) {
    const g = this.game, p = this.p;
    for (let r = 4; r < 18; r++) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const a = Math.random() * Math.PI * 2;
        const bx = Math.round(tc.cx() + Math.cos(a) * r), by = Math.round(tc.cy() + Math.sin(a) * r);
        if (Sim.canPlace(g, 'dock', bx, by)) {
          p.pay(BUILDINGS.dock.cost);
          const b = Sim.placeBuilding(g, this.pid, 'dock', bx, by, false);
          settler.orderBuild(b);
          return true;
        }
      }
    }
    return false;
  }

  /* can our army walk to this target? (island towns can't be reached on foot) */
  reachable(tc, b) {
    if (this.reachCache.has(b.id)) return this.reachCache.get(b.id);
    // path must start OUTSIDE the TC's own blocked footprint or it dies instantly
    const s = this.game.freeSpotNear(tc, false) || [tc.cx(), tc.cy()];
    const path = Path.find(this.game.world.blocked, s[0], s[1], b.cx() | 0, b.cy() | 0);
    let ok = false;
    if (path && path.length) {
      const [ex, ey] = path[path.length - 1];
      ok = dist(ex + .5, ey + .5, b.cx(), b.cy()) < 4.5;
    }
    this.reachCache.set(b.id, ok);
    return ok;
  }

  tryBuild(type, tc, settler) {
    const g = this.game, p = this.p;
    const B = BUILDINGS[type];
    // spiral search around TC
    for (let r = 3; r < 14; r++) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const a = Math.random() * Math.PI * 2;
        const bx = Math.round(tc.cx() + Math.cos(a) * r), by = Math.round(tc.cy() + Math.sin(a) * r);
        if (Sim.canPlace(g, type, bx, by)) {
          p.pay(B.cost);
          const b = Sim.placeBuilding(g, this.pid, type, bx, by, false);
          settler.orderBuild(b);
          return true;
        }
      }
    }
    return false;
  }

  /* ---------- research ---------- */
  research(blds) {
    if (!this.cfg.techy) return;
    const p = this.p;
    const uni = blds.find(b => b.built && b.type === 'university');
    if (!uni || p.researching) return;
    const prio = ['wheelbarrow', 'bronzeBlades', 'fletching', 'leather', 'masonry',
                  'ironBlades', 'bodkin', 'scale', 'ironTools', 'medicine', 'architecture',
                  'plate', 'wootz', 'greekfire', 'poisonwells'];
    for (const k of prio) if (p.canResearch(k)) { p.startResearch(k); return; }
  }

  /* ---------- military ---------- */
  military(tc, armyAll, settlerCount) {
    const g = this.game, p = this.p;

    // garrison duty: hold captured towns (2 guards each) so garrison survivors
    // and raiders can't flip them straight back
    const ownedTowns = g.buildings.filter(b => !b.dead && b.type === 'town' && b.owner === this.pid);
    const guards = new Set();
    for (const t of ownedTowns) {
      const near = armyAll.filter(u => dist(u.x, u.y, t.cx(), t.cy()) < 6);
      for (const u of near.slice(0, 2)) guards.add(u.id);
      let need = 2 - near.length;
      for (const u of armyAll) {
        if (need <= 0) break;
        if (guards.has(u.id) || u.order) continue;
        u.orderMove(t.cx() + (Math.random() * 3 - 1.5), t.cy() + (Math.random() * 3 - 1.5));
        guards.add(u.id); need--;
      }
    }
    const army = armyAll.filter(u => !guards.has(u.id)); // field army only

    // wave size can never exceed what population allows
    const effWave = Math.max(4, Math.min(this.cfg.wave, p.popCap - settlerCount - 2 - guards.size));

    // defense first
    if (g.time < this.defendUntil && this.defendPos) {
      for (const u of army) {
        if (!u.order || u.order.kind === 'move') u.orderMove(this.defendPos.x + (Math.random() * 4 - 2), this.defendPos.y + (Math.random() * 4 - 2));
      }
      this.waveTarget = null;
      return;
    }

    // continue current wave (with a timeout so unreachable targets get dropped)
    if (this.waveTarget) {
      if (this.waveTarget.dead || this.waveTarget.owner === this.pid ||
          g.time - (this.waveSince || 0) > 75) { this.waveTarget = null; }
      else {
        let engaged = 0;
        for (const u of army) {
          if (!u.order) {
            if (this.waveTarget.type === 'town') u.orderMove(this.waveTarget.cx() + (Math.random() * 3 - 1.5), this.waveTarget.cy() + (Math.random() * 3 - 1.5));
            else u.orderAttack(this.waveTarget);
          }
          if (u.order) engaged++;
        }
        if (army.length < 3) this.waveTarget = null; // wave wiped, regroup
        return;
      }
    }

    // gather a new wave
    if (army.length < effWave) {
      // rally idle troops near base
      for (const u of army) if (!u.order && dist(u.x, u.y, tc.cx(), tc.cy()) > 12)
        u.orderMove(tc.cx() + (Math.random() * 6 - 3), tc.cy() + (Math.random() * 6 - 3));
      return;
    }

    // pick target: towns when we need pop/age, else enemy base
    const needTowns = (p.age < 4 && p.towns < (AGES[p.age].towns || 0)) || (p.popCap - p.pop < 5);
    let target = null;
    if (needTowns || Math.random() < 0.45) {
      let bd = 1e9;
      for (const b of g.buildings) {
        if (b.dead || b.type !== 'town' || b.owner === this.pid) continue;
        if (!this.reachable(tc, b)) continue; // island towns need boats — not this AI's game (yet)
        const d = dist2(tc.cx(), tc.cy(), b.cx(), b.cy());
        // prefer neutral over enemy-held
        const bias = b.owner === -1 ? 0 : 600;
        if (d + bias < bd) { bd = d + bias; target = b; }
      }
    }
    if (!target) {
      let bd = 1e9;
      for (const b of g.buildings) {
        if (b.dead || b.owner === this.pid || b.owner === -1 || b.type === 'town' || b.type === 'farm') continue;
        const d = dist2(tc.cx(), tc.cy(), b.cx(), b.cy());
        if (d < bd) { bd = d; target = b; }
      }
    }
    if (target) {
      this.waveTarget = target;
      this.waveSince = g.time;
      for (const u of army) {
        if (target.type === 'town') u.orderMove(target.cx() + (Math.random() * 3 - 1.5), target.cy() + (Math.random() * 3 - 1.5));
        else u.orderAttack(target);
      }
    }
  }
}
