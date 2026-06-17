/* ============ CONQUERORS — units, buildings, combat, capture ============ */
'use strict';

const GATHER_RATE = { bush: 0.55, farm: 0.42, tree: 0.50, gold: 0.45, stone: 0.42, iron: 0.40, fish: 0.65, carcass: 28 };
const OBJ_RES = { bush: 'food', farm: 'food', tree: 'wood', gold: 'gold', stone: 'stone', iron: 'iron', fish: 'food', carcass: 'food' };
let NEXT_ID = 1;

/* ================= UNIT ================= */
class Unit {
  constructor(owner, type, x, y, civKey) {
    const u = UNITS[type];
    this.id = NEXT_ID++; this.kind = 'unit';
    this.owner = owner; this.type = type; this.civKey = civKey;
    this.x = x; this.y = y;
    this.maxHp = u.hp; this.hp = u.hp;
    this.speed = u.speed; this.los = u.los;
    this.dead = false;
    this.path = null; this.wp = 0;
    this.order = null;             // {kind, x,y, target, obj}
    this.state = 'idle';
    this.dir = 0; this.animT = 0; this.anim = 'idle'; this.frame = 0;
    this.atkCd = 0; this.repathT = 0; this.scanT = Math.random() * 0.4;
    this.carry = null;             // {res, amt}
    this.gatherT = 0;
    this.xp = 0; this.rank = 0;
    this.burn = null; this.lastHitT = -99;
    this.buffT = 0;                // centurion aura
    this.burstLeft = 0; this.burstT = 0;
    this.stuckT = 0; this.lastX = x; this.lastY = y;
    this.gaveKnow = false;         // traders
    this.fade = 1;
    this.cargo = u.capacity ? [] : null; // transports
    this.inShip = null;            // set while riding a transport
    this.inWall = null;            // set while garrisoned in a wall
    this.buildQueue = [];          // queued construction sites
    this.flashUntil = 0;           // hit flash timestamp (ms)
    this.workObj = null;           // remembered gather target (resume after deposit/flee)
    this.gatherKind = null;        // resource kind being harvested (seek next node when one runs dry)
    this.hungerT = -99;            // siege starvation
    this.poisonT = -99;            // poisoned water
    this.starveT = -99;            // prolonged siege: hp decay
    this.cover = false;            // fighting beside trees blunts arrows
    // merchants: where they've been is worth gold
    this.visited = u.npc ? {} : null;
    this.trail = u.npc ? [] : null;
    this.trailT = 0; this.bribedBy = -2; this.route = null;
  }
  cx() { return this.x; } cy() { return this.y; }

  /* which tool the settler is using, so the sprite matches the task */
  tool() {
    if (this.type !== 'settler') return null;
    const o = this.order;
    if (o && o.kind === 'build') return 'hammer';
    if (o && o.kind === 'attack' && o.target && o.target.def && o.target.def.animal)
      return this.huntMelee ? 'knife' : 'bow';
    let node = null;
    if (o && o.kind === 'gather') node = o.obj;
    else if ((o && o.kind === 'deposit') || (!o && this.carry)) node = this.workObj;
    if (node) {
      const k = node.kind === 'bld' ? 'farm' : node.kind;
      if (k === 'tree') return 'axe';
      if (k === 'gold' || k === 'stone' || k === 'iron') return 'pick';
      if (k === 'farm') return 'hoe';                       // tilling a crop field
      if (k === 'carcass') return 'knife';                  // butchering a kill
      if (k === 'bush') return 'forage';                    // hand-picking berries
    }
    return null; // idle / marching: bare hands
  }

  /* job title: 'Settler (Gold Miner)', 'Settler (Lumberjack)', etc. */
  displayName() {
    if (this.type === 'settler') {
      const o = this.order;
      if (o && o.kind === 'build') return 'Settler (Builder)';
      if (o && o.kind === 'attack' && o.target && o.target.def && o.target.def.animal) return 'Settler (Hunter)';
      let node = null;
      if (o && o.kind === 'gather') node = o.obj;
      else if ((o && o.kind === 'deposit') || (!o && this.carry)) node = this.workObj;
      if (node) {
        const k = node.kind === 'bld' ? 'farm' : node.kind;
        const title = { tree: 'Lumberjack', gold: 'Gold Miner', stone: 'Quarryman',
                        iron: 'Iron Miner', bush: 'Forager', farm: 'Farmer',
                        deer: 'Hunter', boar: 'Hunter' }[k];
        if (title) return 'Settler (' + title + ')';
      }
    }
    if (this.type === 'fishboat' && (this.order && this.order.kind === 'gather' || this.carry))
      return 'Fishing Boat';
    return this.def.name;
  }
  get def() { return UNITS[this.type]; }
  get civilian() { return !!this.def.civilian; }

  effAtk(game) {
    const p = game.players[this.owner];
    let a = p ? p.statAtk(this.def) : this.def.atk;
    a *= 1 + this.rank * CFG.RANK_BONUS;
    if (this.buffT > 0) a *= 1.25;
    if (game.time - this.hungerT < 4) a *= 0.75;  // starving under siege
    if (game.time - this.poisonT < 4) a *= 0.8;   // sickened by bad water
    return a;
  }
  effArmor(game) {
    const p = game.players[this.owner];
    return (p ? p.statArmor(this.def) : this.def.armor);
  }
  effRange(game) {
    const p = game.players[this.owner];
    return p ? p.statRange(this.def) : this.def.range;
  }

  addXP(amt, game) {
    if (this.def.npc || this.civilian) return;
    this.xp += amt;
    while (this.rank < 3 && this.xp >= CFG.XP_RANKS[this.rank]) {
      this.rank++;
      const oldMax = this.maxHp;
      this.maxHp = Math.round(this.def.hp * (1 + this.rank * CFG.RANK_BONUS));
      this.hp += this.maxHp - oldMax;
      Sim.puff(game, this.x, this.y - 1, '#ffd34d', 8);
      if (this.owner === game.humanId) game.message(`${this.def.name} promoted to ${['', 'Trained', 'Veteran', 'Elite'][this.rank]}!`);
    }
  }

  /* ---- orders (repathT reset = commands respond INSTANTLY) ---- */
  clearOrder() { this.order = null; this.path = null; this.state = 'idle'; }
  resetQueue() { if (this.buildQueue) this.buildQueue.length = 0; }
  orderMove(x, y) { this.resetQueue(); this.workObj = null; this.gatherKind = null; this.order = { kind: 'move', x, y }; this.path = null; this.repathT = 0; this.state = 'move'; }
  orderAttack(t) { this.resetQueue(); this.workObj = null; this.gatherKind = null; this.order = { kind: 'attack', target: t }; this.path = null; this.repathT = 0; this.state = 'attack'; }
  orderGarrison(b) { // ranged units man the walls
    if (!this.def.tags.includes('ranged') || this.def.naval) return;
    this.order = { kind: 'garrison', target: b }; this.path = null; this.repathT = 0; this.state = 'move';
  }
  orderGather(obj) {
    const canGather = obj.kind === 'fish' ? this.type === 'fishboat'
                    : this.type === 'settler';
    if (!canGather) return this.orderMove(obj.x + .5, obj.y + .5);
    this.order = { kind: 'gather', obj }; this.path = null; this.repathT = 0; this.state = 'gather';
    this.workObj = obj; // remember it so we resume after depositing / fleeing
    // remember WHAT we're harvesting (tree/bush/gold/…) so we can seek the next
    // node of the same kind when this one runs dry — survives order recreation.
    if (obj.kind && obj.kind !== 'bld') this.gatherKind = obj.kind;
  }
  orderBoard(t) {
    if (this.def.naval || this.def.npc) return;
    this.order = { kind: 'board', target: t }; this.path = null; this.repathT = 0; this.state = 'move';
  }
  orderPoison(x, y) {
    if (this.type !== 'scout') return;
    this.order = { kind: 'poison', x, y, t: 0 }; this.path = null; this.repathT = 0; this.state = 'move';
  }
  orderUnload(x, y) {
    if (!this.cargo) return;
    this.order = { kind: 'unload', x, y }; this.path = null; this.repathT = 0; this.state = 'move';
  }
  orderBuild(b) {
    if (this.type !== 'settler') return;
    this.workObj = null; this.gatherKind = null;
    this.order = { kind: 'build', target: b }; this.path = null; this.repathT = 0; this.state = 'build';
  }
  orderBuildQueued(b) { // queue construction like AoE villagers
    if (this.type !== 'settler') return;
    if (this.order && this.order.kind === 'build') this.buildQueue.push(b);
    else this.orderBuild(b);
  }
  orderDeposit(game) { this.order = { kind: 'deposit', resume: this.order && this.order.kind === 'gather' ? this.order.obj : null }; this.path = null; }

  /* nearest harvestable node of `kind` (≠ exclude) that has a free approach tile and
     isn't already crowded — used to redistribute workers off a contested tree/mine */
  findReachableNode(game, kind, exclude) {
    // how many of my settlers are already assigned to each node (true occupancy)
    const occ = new Map();
    for (const u of game.units) {
      if (u === this || u.dead || u.type !== 'settler' || u.owner !== this.owner) continue;
      const t = (u.order && u.order.kind === 'gather') ? u.order.obj : null;
      if (t) occ.set(t, (occ.get(t) || 0) + 1);
    }
    let best = null, bd = 1e9;
    for (const o of game.world.objects) {
      if (!o.alive || o.kind !== kind || o === exclude) continue;
      const d = dist2(this.x, this.y, o.x, o.y);
      if (d > 30 * 30 || d >= bd) continue;
      if ((occ.get(o) || 0) >= 2) continue;               // already has its 2 workers
      let open = false;                                    // a walkable neighbour = reachable
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = o.x + dx, y = o.y + dy;
        if (World.inB(x, y) && !game.world.blocked[World.idx(x, y)]) { open = true; break; }
      }
      if (open) { bd = d; best = o; }
    }
    return best;
  }

  /* ---- hunting: butcher a kill, then two settlers haul it home on a pole ---- */
  butcherCarcass(game, carc, dt) {
    if (carc.team) { this.clearOrder(); return; }   // already hoisted by a crew
    this.anim = 'work'; this.huntMelee = true;       // bend over the kill with a knife
    const crew = [];
    for (const u of game.queryUnits(carc.x + .5, carc.y + .5, 1.7)) {
      if (u.type === 'settler' && u.owner === this.owner && !u.dead &&
          u.order && u.order.kind === 'gather' && u.order.obj === carc &&
          dist(u.x, u.y, carc.x + .5, carc.y + .5) < 1.6) crew.push(u);
    }
    if (crew.length >= 2) {
      this.loneWaitT = 0;
      carc.butcherT = (carc.butcherT || 0) + dt;     // both add dt → ready in ~1.5s of teamwork
      if (carc.butcherT > 3) {
        const a = crew[0], b = crew[1];
        carc.team = [a, b]; carc.dest = game.findDropoff(a.owner, carc.x, carc.y); carc.carried = true;
        a.order = { kind: 'haulkill', carc, role: 'front' }; a.state = 'haul'; a.path = null; a.huntMelee = false;
        b.order = { kind: 'haulkill', carc, role: 'back' };  b.state = 'haul'; b.path = null; b.huntMelee = false;
        if (a.owner === game.humanId) Audio2.sfx('click');
      }
    } else {                                          // a lone settler can't lift a kill
      carc.butcherT = 0;
      this.loneWaitT = (this.loneWaitT || 0) + dt;
      if (this.loneWaitT > 12) {
        this.loneWaitT = 0;
        if (this.owner === game.humanId && game.time - (game.killMsgT || -99) > 15) {
          game.killMsgT = game.time; game.message('A kill needs 2 settlers to carry it home.', true);
        }
        this.workObj = null; this.gatherKind = null;   // stop looping on a kill we can't lift alone
        this.clearOrder();
      }
    }
  }

  deliverKill(game, carc, d) {
    const pl = game.players[this.owner];
    if (pl) pl.meatCuring = (pl.meatCuring || 0) + (carc.amount || 0);
    if (this.owner === game.humanId) { game.message(`Kill hauled in — ${carc.amount} food curing…`); Audio2.sfx('capture'); }
    for (const u of (carc.team || [])) if (u && !u.dead) { u.order = null; u.state = 'idle'; u.path = null; }
    carc.team = null; carc.carried = false; carc.alive = false; World.removeObj(carc);
  }

  /* ---- pathing ---- */
  ensurePath(game, tx, ty) {
    if (this.path && this.wp < this.path.length) return true;
    if (this.repathT > 0) return false;
    this.repathT = 0.25 + Math.random() * 0.2;
    const grid = this.def.naval ? game.world.navBlocked : game.world.blocked;
    // ships get an uncapped-ish search: coastlines force long detours, and a
    // capped A* strands them in dead-end bays chasing straight-line distance
    const p = Path.find(grid, this.x, this.y, tx, ty, this.def.naval ? 9500 : 4200);
    if (p && p.length) {
      this.path = Path.smooth(grid, this.x, this.y, p); // stride, don't stair-step
      this.wp = 0;
      return true;
    }
    this.path = null;
    return false;
  }
  moveAlong(game, dt) {
    if (!this.path || this.wp >= this.path.length) return false;
    // consume the whole step across waypoints — no stutter at tile centers
    let step = this.speed * dt;
    while (step > 0 && this.wp < this.path.length) {
      const [tx, ty] = this.path[this.wp];
      const gx = tx + .5, gy = ty + .5;
      const d = dist(this.x, this.y, gx, gy);
      if (d <= step) { this.x = gx; this.y = gy; this.wp++; step -= d; }
      else {
        const vx = (gx - this.x) / d, vy = (gy - this.y) / d;
        this.x += vx * step; this.y += vy * step;
        this.setDir(vx, vy);
        step = 0;
      }
    }
    if (this.def.naval && Math.random() < dt * 5) game.particles.push({ // wake foam
      x: this.x + (Math.random() - .5) * .3, y: this.y + (Math.random() - .5) * .3,
      vx: 0, vy: 0, grav: 0, life: .8, max: 1, color: 'rgba(225,243,255,.5)', size: 2.5,
    });
    this.anim = 'walk';
    return true;
  }
  /* 24-direction facing from the on-screen movement vector (smooth turning).
     dir: 0=E, 6=S(front), 12=W, 18=N(back), increasing clockwise on screen. */
  setDir(vx, vy) {
    const sdx = vx - vy, sdy = (vx + vy) * 0.5; // tile velocity -> screen velocity
    if (sdx * sdx + sdy * sdy < 1e-8) return;
    const a = Math.atan2(sdy, sdx); // 0 = screen-east, +90° = screen-south
    this.dir = (Math.round(a / (Math.PI * 2) * 24) + 24) % 24;
  }

  distTo(e) {
    if (e.kind === 'bld') {
      const cx = clamp(this.x, e.x, e.x + e.size), cy = clamp(this.y, e.y, e.y + e.size);
      return dist(this.x, this.y, cx, cy);
    }
    return dist(this.x, this.y, e.x, e.y);
  }

  /* ---- combat ---- */
  tryAttack(game, dt) {
    const t = this.order.target;
    if (!t || t.dead) { this.clearOrder(); return; }
    // settlers hunt animals with a bow (so they can shoot fleeing deer)
    const hunting = this.type === 'settler' && t.def && t.def.animal;
    let range = hunting ? 4 : Math.max(this.effRange(game), this.def.naval ? 1.6 : 1.0);
    if (range > 1.2 && World.terAt(this.x, this.y) === TERRAIN.HILL) range += 0.6; // shooting downhill
    const d = this.distTo(t);
    const minR = this.def.minRange || 0;
    if (d <= range + 0.15 && d >= minR) {
      if (this.def.suicide) { Sim.fireshipExplode(game, this, t); return; } // fire ship!
      this.path = null;
      this.setDir((t.cx() - this.x) || .01, (t.cy() - this.y) || 0);
      // a hunting settler shoots from afar (bow) but switches to a knife point-blank
      const shoot = range > 1.2 && (hunting ? d > 1.5 : true);
      this.huntMelee = hunting && !shoot; // tells the sprite to draw a knife, not a bow
      if (this.atkCd <= 0) {
        this.atkCd = this.def.cd;
        this.anim = 'attack'; this.animT = 0;
        if (this.def.burst) { this.burstLeft = this.def.burst; this.burstT = 0; }
        else if (shoot) Sim.fireProjectile(game, this, t);
        else Sim.meleeHit(game, this, t);
      }
    } else if (d < minR) {
      // step away from target
      const ang = Math.atan2(this.y - t.cy(), this.x - t.cx());
      const nx = clamp(this.x + Math.cos(ang) * 2, 1, World.N - 2), ny = clamp(this.y + Math.sin(ang) * 2, 1, World.N - 2);
      if (this.ensurePath(game, nx, ny)) this.moveAlong(game, dt);
    } else {
      if (this.ensurePath(game, t.cx(), t.cy())) this.moveAlong(game, dt);
      else if (!this.path) {
        // a hunted animal keeps darting — don't abandon the hunt on a transient
        // path miss; just retry. Other targets give up so units don't freeze.
        if (t.def && t.def.animal) this.repathT = 0;
        else this.clearOrder();
      }
    }
  }

  /* ---- main update ---- */
  update(game, dt) {
    if (this.dead) return;
    if (this.inShip) { // riding a transport: follow it, do nothing else
      if (this.inShip.dead) { this.dead = true; game.popFree(this); return; }
      this.x = this.inShip.x; this.y = this.inShip.y;
      return;
    }
    if (this.inWall) { // manning a wall: the wall fights for us
      this.x = this.inWall.cx(); this.y = this.inWall.cy();
      return;
    }
    this.atkCd -= dt; this.repathT -= dt; this.scanT -= dt;
    if (this.buffT > 0) this.buffT -= dt;
    this.animT += dt;

    // burst fire (chu ko nu)
    if (this.burstLeft > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        const t = this.order && this.order.target;
        if (t && !t.dead) Sim.fireProjectile(game, this, t);
        this.burstLeft--; this.burstT = 0.13;
      }
    }
    // burning
    if (this.burn) {
      this.burn.t -= dt;
      this.takeDamage(game, this.burn.dps * dt, null, true);
      if (Math.random() < dt * 8) Sim.flame(game, this.x, this.y - .5);
      if (this.burn.t <= 0) this.burn = null;
    }
    // siege starvation & poison sickness
    const hungry = game.time - this.hungerT < 4, sick = game.time - this.poisonT < 4;
    if (sick && this.hp > this.maxHp * 0.15) {
      this.hp -= 0.12 * dt * this.maxHp / 10;
      if (Math.random() < dt * 2) Sim.puff(game, this.x, this.y - 0.8, '#5fae3f', 1);
    }
    if (game.time - this.starveT < 4 && this.hp > this.maxHp * 0.15) this.hp -= 0.2 * dt;

    // regen (India / medicine near TC) — the starving and the sick don't heal
    const p = game.players[this.owner];
    if (p && !hungry && !sick && this.hp < this.maxHp && game.time - this.lastHitT > 4) {
      let r = (p.civ && p.civ.regen) || 0;
      if (p.bonus.tcHeal && game.nearDropoff(this.owner, this.x, this.y, 6)) r += 1;
      if (r) this.hp = Math.min(this.maxHp, this.hp + r * dt);
    }

    const prevAnim = this.anim;
    // relax to idle each frame; a one-shot attack swing is allowed to finish.
    // 'work' (gather/build) is re-asserted by the state machine and loops below.
    if (this.anim !== 'attack' || this.animT > 0.55) this.anim = 'idle';

    // ===== state machine =====
    const o = this.order;
    if (o) {
      switch (o.kind) {
        case 'move': {
          if (this.ensurePath(game, o.x, o.y)) {
            if (!this.moveAlong(game, dt)) this.clearOrder();
          } else if (!this.path) {
            // way is barred: soldiers breach the structure in front of them
            if (!this.civilian && !this.def.npc && dist(this.x, this.y, o.x, o.y) > 3) {
              let blk = null, bd = 2.4;
              for (const b of game.buildings) {
                if (b.dead || b.owner < 0 || !game.hostile(this.owner, b.owner)) continue;
                const d = this.distTo(b);
                if (d < bd) { bd = d; blk = b; }
              }
              if (blk) { this.orderAttack(blk); break; }
            }
            this.clearOrder();
          }
          break;
        }
        case 'garrison': {
          const b = o.target;
          if (!b || b.dead || !b.built || !b.garrison || b.owner !== this.owner ||
              b.garrison.length >= (b.def.garrison || 0)) { this.clearOrder(); break; }
          if (this.distTo(b) < 1.6) {
            b.garrison.push(this); this.inWall = b;
            this.path = null; this.order = null; this.state = 'idle';
            const si = game.selected.indexOf(this);
            if (si >= 0) game.selected.splice(si, 1);
            if (this.owner === game.humanId) Audio2.sfx('click');
          } else {
            if (this.ensurePath(game, b.cx(), b.cy())) this.moveAlong(game, dt);
            else if (!this.path) this.clearOrder();
          }
          break;
        }
        case 'attack': this.tryAttack(game, dt); break;
        case 'gather': {
          let obj = o.obj;
          const isFarm = obj && obj.kind === 'bld';   // farm building vs world resource node
          const gone = !obj || (isFarm ? (obj.dead || !obj.built) : !obj.alive);
          if (gone) {
            // node ran dry: roam to the next node of the same resource and keep
            // working (villagers never just stop while the resource still exists).
            const nk = o.lastKind || this.gatherKind;
            const nxt = nk ? World.nearestObj(nk, this.x, this.y, 60) : null;
            if (nxt) { o.obj = nxt; o.lastKind = nk; this.workObj = nxt; break; }
            this.clearOrder(); break;
          }
          if (!isFarm) o.lastKind = obj.kind;
          const carcass = !isFarm && obj.kind === 'carcass';
          const cap = carcass ? 200 : (this.def.carry || CFG.CARRY);   // haul a whole carcass at once
          if (this.carry && this.carry.amt >= cap) { this.orderDeposit(game); this.order.resume = obj; break; }
          let ox, oy, adj;
          if (isFarm) {
            // up to 4 farmers work one field from its four edges — no clumping
            const half = obj.size / 2 + 0.45, slot = this.id % 4;
            const so = [[0, -half], [half, 0], [0, half], [-half, 0]][slot];
            ox = obj.cx() + so[0]; oy = obj.cy() + so[1];
            adj = dist(this.x, this.y, ox, oy) < 0.55;
          } else {
            ox = obj.x + .5; oy = obj.y + .5;
            adj = dist(this.x, this.y, ox, oy) < (this.def.naval ? 1.7 : 1.45);
          }
          if (adj) {
            this.path = null; this.gStuckT = 0;
            this.setDir((isFarm ? obj.cx() : ox) - this.x || .01, (isFarm ? obj.cy() : oy) - this.y);
            if (carcass) { this.butcherCarcass(game, obj, dt); break; }   // 2 settlers: butcher → pole-carry
            if (isFarm && !obj.irrigated) {
              // no water supply: crops won't grow. wait briefly for rain, then go
              // find other work rather than idle forever on a dead field.
              this.anim = 'idle';
              this.dryWaitT = (this.dryWaitT || 0) + dt;
              if (this.owner === game.humanId && game.time - (game.dryMsgT || -99) > 12) {
                game.dryMsgT = game.time;
                game.message('A farm has no water! Build it near water or connect a Canal.', true);
                Audio2.say('Our farms need water, build canals from a lake.');
              }
              if (this.dryWaitT > 6) {
                this.dryWaitT = 0;
                const alt = game.buildings.find(b => !b.dead && b.type === 'farm' && b.built && b.irrigated && b.owner === this.owner && b !== obj);
                if (alt) { this.orderGather(alt); break; }
                const bush = World.nearestObj('bush', this.x, this.y, 50);
                if (bush) { this.orderGather(bush); break; }
                this.clearOrder();                 // nothing else to do — release the farmer
              }
              break;
            }
            this.dryWaitT = 0;
            this.anim = 'work'; // hoe / chop / mine / butcher — the tool picks the look
            const gk = isFarm ? 'farm' : obj.kind;
            const pl = game.players[this.owner];
            const rate = GATHER_RATE[gk] * pl.bonus.gather *
                         (OBJ_RES[gk] === 'gold' && pl.civ ? pl.civ.goldMult : 1);
            this.gatherT += rate * dt;
            if (this.gatherT >= 1) {
              const take = this.gatherT | 0; this.gatherT %= 1;
              const res = OBJ_RES[gk];
              if (!this.carry || this.carry.res !== res) this.carry = { res, amt: 0 };
              this.carry.amt += take;
              if (carcass) this.carry.cure = true;        // banked over time at the dropoff, not instantly
              if (isFarm) {
                // a worked field drinks from its lake — more farmers => faster drain
                if (obj.waterSrc) World.drainLake(obj.waterSrc[0], obj.waterSrc[1], take * (CFG.WATER_PER_FOOD || 18));
              } else {
                obj.amount -= take;
                if (Math.random() < .3 && this.owner === game.humanId) Audio2.sfx('chop');
                if (obj.amount <= 0) { World.removeObj(obj); }
              }
            }
          } else {
            const px = this.x, py = this.y;
            if (this.ensurePath(game, ox, oy)) this.moveAlong(game, dt);
            const moved = (this.x - px) ** 2 + (this.y - py) ** 2 > 0.0004;
            if (moved) { this.gStuckT = 0; }             // still advancing toward the node — fine
            else {
              // not advancing: the node's spots are taken / blocked by the forest.
              this.gStuckT = (this.gStuckT || 0) + dt;
              if (this.gStuckT > 2) {
                this.gStuckT = 0;
                const alt = isFarm ? null : this.findReachableNode(game, obj.kind, obj);
                if (alt) { o.obj = alt; o.lastKind = obj.kind; this.workObj = alt; this.path = null; this.repathT = 0; }
                else this.clearOrder();   // nothing reachable — release (auto-behaviour retries)
              }
            }
          }
          break;
        }
        case 'haulkill': {   // two settlers carry a kill slung on a pole to the dropoff
          const carc = o.carc;
          if (!carc || !carc.team || carc.team.indexOf(this) < 0) { this.clearOrder(); break; }
          if (o.role === 'front') {
            this.anim = 'walk';
            let d = carc.dest;
            if (!d || d.dead) d = carc.dest = game.findDropoff(this.owner, this.x, this.y);
            if (!d) { this.deliverKill(game, carc, null); break; }
            if (this.distTo(d) < 1.5) { this.deliverKill(game, carc, d); break; }
            const px = this.x, py = this.y;
            if (this.ensurePath(game, d.cx(), d.cy())) this.moveAlong(game, dt);
            else if (!this.path) { this.deliverKill(game, carc, d); break; }  // unreachable: deliver anyway
            const mx = this.x - px, my = this.y - py, ml = Math.hypot(mx, my);
            if (ml > 0.002) { carc.dirX = mx / ml; carc.dirY = my / ml; }      // remember heading for the pole
            carc.x = this.x | 0; carc.y = this.y | 0;
          } else {
            const front = carc.team[0];
            if (!front || front.dead) { this.clearOrder(); break; }
            const dx = carc.dirX != null ? carc.dirX : -1, dy = carc.dirY != null ? carc.dirY : 0;
            this.x = front.x - dx * 1.15; this.y = front.y - dy * 1.15;        // trail behind, pole taut
            this.dir = front.dir; this.anim = 'walk';
          }
          break;
        }
        case 'deposit': {
          if (!this.carry) { this.order = o.resume ? { kind: 'gather', obj: o.resume } : null; if (!this.order) this.state = 'idle'; break; }
          const d = game.findDropoff(this.owner, this.x, this.y, this.def.naval);
          if (!d) { this.clearOrder(); break; } // no dropoff at all: idle, retried by auto-behavior
          if (this.distTo(d) < (this.def.naval ? 1.6 : 1.3)) { // forgiving so big TCs always accept
            const pl = game.players[this.owner];
            if (this.carry.cure) {                          // a carcass: cures into food over ~30s
              pl.meatCuring = (pl.meatCuring || 0) + this.carry.amt;
              if (this.owner === game.humanId) { game.message(`Carcass dropped off — ${this.carry.amt} food curing…`); Audio2.sfx('click'); }
            } else {
              pl.res[this.carry.res] += this.carry.amt;      // usable immediately
              if (d.store) d.store[this.carry.res] += this.carry.amt; // also held here, awaiting a cart
            }
            this.carry = null;
            const rs = o.resume;
            const ok = rs && (rs.kind === 'bld' ? (!rs.dead && rs.built) : rs.alive);
            this.order = ok ? { kind: 'gather', obj: rs } : null;
            if (!this.order) this.state = 'idle';
          } else {
            if (this.ensurePath(game, d.cx(), d.cy())) this.moveAlong(game, dt);
            else { this.repathT = 0; this.depFail = (this.depFail || 0) + 1; // keep trying to reach it
              if (this.depFail > 30) this.clearOrder(); } // give up after ~13s; auto-behavior retries fresh
          }
          break;
        }
        case 'haul': { // ox cart carries a batch from a storehouse to the Town Center
          let tc = this.haulTC;
          if (!tc || tc.dead) tc = this.haulTC = game.findHomeTC(this.owner, this.x, this.y);
          if (!tc) { Sim.cartArrive(game, this, null); break; } // no TC: refund where it stands
          if (this.distTo(tc) < 1.6) {
            Sim.cartArrive(game, this, tc);
          } else {
            if (this.ensurePath(game, tc.cx(), tc.cy())) this.moveAlong(game, dt);
            else if (!this.path) { Sim.cartArrive(game, this, tc); } // unreachable: deliver anyway
          }
          break;
        }
        case 'poison': { // scout sneaks to enemy water and fouls it
          const d = dist(this.x, this.y, o.x, o.y);
          if (d < 1.7) {
            this.path = null; this.anim = 'attack';
            o.t += dt;
            if (Math.random() < dt * 4) Sim.puff(game, o.x, o.y, '#5fae3f', 2);
            if (o.t >= 5) { Sim.applyPoison(game, this.owner, o.x, o.y); this.clearOrder(); }
          } else {
            if (this.ensurePath(game, o.x, o.y)) this.moveAlong(game, dt);
            else if (!this.path) this.clearOrder();
          }
          break;
        }
        case 'board': {
          const t = o.target;
          if (!t || t.dead || !t.cargo) { this.clearOrder(); break; }
          if (this.distTo(t) < 2.7) {
            const used = t.cargo.reduce((s, c2) => s + c2.def.pop, 0);
            if (used + this.def.pop > t.def.capacity) {
              if (this.owner === game.humanId) game.message('Transport is full!', true);
              this.clearOrder(); break;
            }
            t.cargo.push(this); this.inShip = t;
            this.path = null; this.order = null; this.state = 'idle';
            const si = game.selected.indexOf(this);
            if (si >= 0) game.selected.splice(si, 1);
            if (this.owner === game.humanId) Audio2.sfx('click');
          } else {
            if (this.ensurePath(game, t.x, t.y)) this.moveAlong(game, dt);
            else if (!this.path) this.clearOrder();
          }
          break;
        }
        case 'unload': { // transports: sail to the shore point, then land the troops
          if (!this.cargo || !this.cargo.length) { this.clearOrder(); break; }
          if (dist(this.x, this.y, o.x, o.y) < 2.6) {
            this.path = null;
            Sim.unloadCargo(game, this, o.x, o.y);
            this.clearOrder();
          } else {
            if (this.ensurePath(game, o.x, o.y)) this.moveAlong(game, dt);
            else if (!this.path) { Sim.unloadCargo(game, this, this.x, this.y); this.clearOrder(); }
          }
          break;
        }
        case 'build': {
          const b = o.target;
          // next job: queued site first, then any nearby foundation (AoE improvising)
          const nextJob = () => {
            while (this.buildQueue.length) {
              const n = this.buildQueue.shift();
              if (n && !n.dead && !n.built) { this.orderBuild(n); return true; }
            }
            let best = null, bd = 14 * 14;
            for (const f of game.buildings) {
              if (f.dead || f.built || f.owner !== this.owner) continue;
              const d = dist2(this.x, this.y, f.cx(), f.cy());
              if (d < bd) { bd = d; best = f; }
            }
            if (best) { this.orderBuild(best); return true; }
            return false;
          };
          if (!b || b.dead || b.built) { if (!nextJob()) this.clearOrder(); break; }
          if (this.distTo(b) < (b.def.naval ? 1.3 : 0.7)) {
            this.path = null; this.anim = 'work'; // looping hammer swing
            this.setDir((b.cx() - this.x) || .01, (b.cy() - this.y));
            const spd = (game.players[this.owner].civ || {}).buildSpd || 1;
            b.progress += dt * spd / b.def.buildTime;
            b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.9 * dt * spd / b.def.buildTime);
            if (Math.random() < .25 && this.owner === game.humanId) Audio2.sfx('build');
            if (b.progress >= 1) { b.finish(game); if (!nextJob()) this.clearOrder(); }
          } else {
            if (this.ensurePath(game, b.cx(), b.cy())) this.moveAlong(game, dt);
            else if (!this.path) { if (!nextJob()) this.clearOrder(); }
          }
          break;
        }
      }
    }

    // ===== auto-behaviors =====
    if (this.scanT <= 0) {
      this.scanT = 0.45;
      // forest cover: a tree at your shoulder blunts incoming arrows
      this.cover = false;
      for (let dy = -1; dy <= 1 && !this.cover; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ob = World.objAt((this.x + dx) | 0, (this.y + dy) | 0);
        if (ob && ob.alive && ob.kind === 'tree') { this.cover = true; break; }
      }
      if (this.def.npc) { // merchants remember every kingdom they pass through
        const terr = game.inTerritory(this.x, this.y);
        if (terr >= 0 && this.visited) this.visited[terr] = true;
      }
      if (!this.def.npc) {
        if (!this.civilian && (!this.order || (this.order.kind === 'move' && false))) {
          // idle military: engage nearby enemies (fire ships wait for explicit orders)
          if (!this.order && !this.def.suicide) {
            const e = game.nearestEnemy(this, CFG.AGGRO);
            if (e && !(this.def.naval && !e.def.naval && this.effRange(game) <= 1.6)) this.orderAttack(e);
          }
        }
        // an idle settler is never allowed to just stand around:
        if ((this.type === 'settler' || this.type === 'fishboat') && !this.order) {
          if (this.carry && this.carry.amt > 0) {       // still holding goods -> deliver them
            this.depFail = 0; this.orderDeposit(game); if (this.order) this.order.resume = this.workObj;
          } else if (this.workObj || this.gatherKind) {  // empty-handed -> resume working
            const w = this.workObj;
            const alive = w && (w.kind === 'bld' ? (!w.dead && w.built) : w.alive);
            const threat = game.nearestEnemy(this, CFG.AGGRO);
            if (alive) { if (!threat) this.orderGather(w); }
            else {
              // remembered node is gone — seek the nearest of the same resource so
              // the settler keeps working until told to do something else.
              const nxt = this.gatherKind ? World.nearestObj(this.gatherKind, this.x, this.y, 80) : null;
              if (nxt && !threat) this.orderGather(nxt);
              else this.workObj = null;
            }
          }
        }
        // ruins & traders pickup
        const ru = World.objAt(Math.round(this.x - .5), Math.round(this.y - .5));
        if (ru && ru.alive && ru.kind === 'ruin') {
          World.removeObj(ru);
          const pl = game.players[this.owner];
          if (pl) { pl.res.knowledge += ru.amount;
            Sim.puff(game, this.x, this.y - 1, '#b58cff', 10);
            if (this.owner === game.humanId) { game.message(`Ancient ruins explored: +${ru.amount} Knowledge`); Audio2.sfx('capture'); } }
        }
      } else if (this.type === 'trader' && !this.gaveKnow) {
        // trader: gift knowledge to first nearby unit's owner
        const near = game.queryUnits(this.x, this.y, 1.8).find(u => u !== this && u.owner >= 0 && !u.dead);
        if (near) {
          this.gaveKnow = true;
          const pl = game.players[near.owner];
          pl.res.knowledge += 30;
          Sim.puff(game, this.x, this.y - 1, '#b58cff', 12);
          if (near.owner === game.humanId) { game.message('A trader shares wisdom: +30 Knowledge'); Audio2.sfx('capture'); }
        }
      }
    }

    // predators (wolves) hunt people on sight
    if (this.def.aggressive && this.scanT <= 0.001 && (!this.order || this.order.kind === 'move')) {
      let prey = null, bd = (this.los || 8) ** 2;
      for (const u of game.queryUnits(this.x, this.y, this.los || 8)) {
        if (u.dead || u.owner < 0 || u.def.animal || u.inShip || u.inWall) continue;
        const d2 = dist2(this.x, this.y, u.x, u.y);
        if (d2 < bd) { bd = d2; prey = u; }
      }
      if (prey) this.orderAttack(prey);
    }
    // wild animals graze and wander when undisturbed (but freeze once hunted)
    if (this.def.animal && !this.order && game.time - this.lastHitT > 5 && Math.random() < dt * 0.4) {
      const nx = clamp(this.x + (Math.random() * 8 - 4), 2, World.N - 3);
      const ny = clamp(this.y + (Math.random() * 8 - 4), 2, World.N - 3);
      if (!game.world.blocked[World.idx(nx | 0, ny | 0)]) this.orderMove(nx, ny);
    }

    // trader behavior: wander, remember the road, or run a bribed trade route
    if (this.type === 'trader') {
      if ((this.trailT += dt) > 2.5 && this.trail) {
        this.trailT = 0;
        this.trail.push([this.x, this.y]);
        if (this.trail.length > 80) this.trail.shift();
      }
      if (this.route && !this.order) {
        // bribed caravan: shuttle between the briber's TC and a far town
        const { a, b } = this.route;
        if (!a || a.dead || !b || b.dead) { this.route = null; }
        else {
          const tgt = this.route.leg === 'a' ? a : b;
          if (this.distTo(tgt) < 2.4) {
            if (this.route.leg === 'a') { // arrived home: pay out
              const p = game.players[this.bribedBy];
              if (p) { p.res.gold += 15;
                Sim.puff(game, this.x, this.y - 1, '#ffd34d', 8);
                if (this.bribedBy === game.humanId) Audio2.sfx('train'); }
            }
            this.route.leg = this.route.leg === 'a' ? 'b' : 'a';
          } else this.orderMove(tgt.cx(), tgt.cy());
        }
      } else if (!this.order) {
        if (this.gaveKnow && !this.route) {
          this.fade -= dt * 0.5;
          if (this.fade <= 0) { this.dead = true; game.popFree(this); }
        } else {
          const nx = clamp(this.x + (Math.random() * 16 - 8), 2, World.N - 3);
          const ny = clamp(this.y + (Math.random() * 16 - 8), 2, World.N - 3);
          if (!game.world.blocked[World.idx(nx | 0, ny | 0)]) this.orderMove(nx, ny);
        }
      }
    }

    // stuck detection
    if (this.state !== 'idle' && this.path) {
      if (dist2(this.x, this.y, this.lastX, this.lastY) < 0.0004) {
        this.stuckT += dt;
        if (this.stuckT > 1.4) { this.path = null; this.repathT = 0; this.stuckT = 0; }
      } else this.stuckT = 0;
    }
    this.lastX = this.x; this.lastY = this.y;

    // reset the clock when the animation kind changes so each starts fresh
    // (but 'work' stays running so its swing loops continuously)
    if (this.anim !== prevAnim && this.anim !== 'work') this.animT = 0;
    // animation frames
    if (this.anim === 'walk') {
      // animals cycle their legs in step with how fast they move (deer skitter, sheep amble)
      const cad = this.def.animal ? Math.max(0.07, 0.16 / Math.max(0.4, this.def.speed)) : 0.14;
      this.frame = ((this.animT / cad) | 0) % 4;
    }
    else if (this.anim === 'attack') this.frame = Math.min(2, (this.animT / 0.18) | 0);
    else if (this.anim === 'work') this.frame = ((this.animT / 0.2) | 0) % 3; // looping swing
    else this.frame = 0;
  }

  takeDamage(game, dmg, from, silent) {
    if (this.dead) return;
    // merchants (not animals) are under royal protection inside kingdom borders
    if (this.type === 'trader' && game.inTerritory(this.x, this.y) >= 0) return;
    this.hp -= dmg;
    this.lastHitT = game.time;
    if (!silent) this.flashUntil = performance.now() + 90; // white impact flash
    if (this.owner === game.humanId || (from && from.owner === game.humanId)) game.combatT = game.time;
    if (!silent && Math.random() < 0.5) Sim.puff(game, this.x, this.y - 0.6, this.def.animal ? '#7a3a1a' : '#a3322a', 3);
    // reactions to being hit
    if (from && !this.dead) {
      if (this.def.animal) {
        if (this.def.retaliate) this.orderAttack(from);                 // boar/wolf charge their attacker
        else {
          // deer & sheep bolt away from whatever struck them — every hit, so the
          // hunter has to chase them down (bow + speed make it winnable).
          const a = Math.atan2(this.y - from.y, this.x - from.x);
          this.orderMove(clamp(this.x + Math.cos(a) * 3.2, 2, World.N - 3), clamp(this.y + Math.sin(a) * 3.2, 2, World.N - 3));
        }
      } else if (this.civilian && !this.def.npc && !this.def.cart && (!this.order || this.order.kind !== 'move')) {
        const d = game.findDropoff(this.owner, this.x, this.y);
        if (d && this.type === 'settler' && (!this.order || this.order.kind === 'gather')) {
          const resume = this.workObj, rk = this.gatherKind;  // remember what we were chopping
          this.orderMove(d.cx(), d.cy());        // flee to safety (clears workObj)
          this.workObj = resume; this.gatherKind = rk;        // ...but keep the memory to resume later
        }
      } else if (!this.civilian && !this.order) this.orderAttack(from);
    }
    if (this.hp <= 0) {
      this.dead = true;
      game.popFree(this);
      if (this.def.animal) Sim.dropCarcass(game, this, from);
      Sim.puff(game, this.x, this.y - 0.4, '#5b1f18', 9);
      if (this.def.cart) {
        // supply cart destroyed: its in-transit goods are lost for good
        if (this.haulHome) this.haulHome.cart = null;
        Sim.rubble(game, this);
        if (this.owner === game.humanId) { game.message('A supply cart was destroyed — its goods are lost!', true); game.ping(this.x, this.y); }
      } else {
        if (!this.def.npc && !this.def.naval && World.visAt(this.x, this.y) === 2) {
          this.type === 'elephant' ? Audio2.sfx('trumpet') : Audio2.sfx('die');
        }
      }
      if (from && from.kind === 'unit') from.addXP(8 + (this.def.pop || 1) * 3, game);
      if (this.owner === game.humanId) game.checkAttackAlert(this.x, this.y, true);
    }
  }

  drawSprite(g, view) {
    const civ = this.civKey || 'none';
    const s = Sprites.unit(this.type, this.owner < 0 ? -1 : this.owner, civ, this.dir, this.anim, this.frame, this.tool());
    const ix = (World.isoX(this.x, this.y) - view.left) * view.z;
    const iy = (World.isoY(this.x, this.y) - view.top) * view.z;
    const sc = view.z * (this.def.big ? 0.95 : 0.78);
    const k = s.k || 1; // supersampled sprites render at logical size
    let bob = this.def.naval ? Math.sin(performance.now() / 450 + this.id * 1.7) * 2 * view.z : 0;
    if (World.terAt(this.x, this.y) === TERRAIN.HILL) bob -= 5 * view.z; // standing tall on high ground
    if (this.fade < 1) g.globalAlpha = this.fade;
    g.drawImage(s.cv, ix - s.ax * sc, iy - s.ay * sc + bob, s.cv.width * sc / k, s.cv.height * sc / k);
    if (performance.now() < this.flashUntil) { // hit flash
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55;
      g.drawImage(s.cv, ix - s.ax * sc, iy - s.ay * sc + bob, s.cv.width * sc / k, s.cv.height * sc / k);
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1;
    // transport cargo count
    if (this.cargo && this.cargo.length) {
      g.fillStyle = 'rgba(15,10,5,.8)'; g.beginPath();
      g.arc(ix + 14 * view.z, iy - 30 * view.z, 8 * view.z, 0, 7); g.fill();
      g.fillStyle = '#ffe9b0'; g.font = `bold ${Math.max(9, 10 * view.z)}px sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(this.cargo.reduce((s2, c2) => s2 + c2.def.pop, 0)), ix + 14 * view.z, iy - 30 * view.z + bob);
    }
    // carry indicator
    if (this.carry && this.carry.amt > 0) {
      const cols = { food: '#c97e4f', wood: '#8a6a48', gold: '#ffd34d', stone: '#9a948a', iron: '#7d7872' };
      g.fillStyle = cols[this.carry.res]; g.beginPath();
      g.arc(ix + 8 * view.z, iy - 18 * view.z, 3 * view.z, 0, 7); g.fill();
    }
    // rank chevrons
    if (this.rank > 0) {
      g.strokeStyle = '#ffd34d'; g.lineWidth = Math.max(1, 1.6 * view.z);
      for (let i = 0; i < this.rank; i++) {
        const yy = iy - (this.def.big ? 64 : 46) * view.z - i * 4 * view.z;
        g.beginPath(); g.moveTo(ix - 4 * view.z, yy); g.lineTo(ix, yy + 3 * view.z); g.lineTo(ix + 4 * view.z, yy); g.stroke();
      }
    }
    return { ix, iy };
  }
}

/* ================= BUILDING ================= */
class Building {
  constructor(owner, type, bx, by, civKey, built) {
    const B = BUILDINGS[type];
    this.id = NEXT_ID++; this.kind = 'bld';
    this.owner = owner; this.type = type; this.civKey = civKey;
    this.x = bx; this.y = by; this.size = B.size;
    this.los = B.los;
    this.maxHp = B.hp; this.hp = built ? B.hp : B.hp * 0.1;
    this.built = !!built; this.progress = built ? 1 : 0;
    this.dead = false;
    this.queue = [];               // {uKey, t, total}
    this.atkCd = 0; this.auraT = 0;
    this.capture = {};             // playerId -> progress 0..1
    this.captureBy = -2;           // current sole capturer (for UI)
    this.irrigated = false;        // farms: water supply present
    this.flowing = false;          // canals: connected to a water source
    this.garrison = B.garrison ? [] : null; // walls: archers firing from inside
    this.wallMask = 0;             // walls: which neighbors to connect to
    this.store = B.store ? { food: 0, wood: 0, gold: 0, stone: 0, iron: 0 } : null; // storehouse holdings
    this.cart = null;              // the storehouse's ox cart
    this.depositT = 0;             // time since last deposit (for cart flush)
  }
  cx() { return this.x + this.size / 2; }
  cy() { return this.y + this.size / 2; }
  get def() { return BUILDINGS[this.type]; }

  applyHpBonus(p) {
    const mult = (p.civ ? p.civ.bldHp : 1) * p.bonus.bldHp;
    const ratio = this.hp / this.maxHp;
    this.maxHp = Math.round(BUILDINGS[this.type].hp * mult);
    this.hp = this.maxHp * ratio;
  }

  finish(game) {
    this.built = true; this.progress = 1;
    const p = game.players[this.owner];
    if (p) this.applyHpBonus(p);
    this.hp = this.maxHp;
    if (this.type === 'canal' || this.type === 'farm') Sim.recomputeIrrigation(game);
    if (this.owner === game.humanId) { game.message(`${this.def.name} complete`); Audio2.sfx('train'); }
  }

  trainable(game) {
    const p = game.players[this.owner];
    if (!p || !this.def.trains) return [];
    return this.def.trains.filter(k => p.canTrain(k));
  }
  enqueue(game, uKey) {
    const p = game.players[this.owner];
    const u = UNITS[uKey];
    if (this.queue.length >= 5 || !p.canAfford(u.cost)) return false;
    if (uKey === 'centurion') {
      const n = game.units.filter(x => !x.dead && x.owner === this.owner && x.type === 'centurion').length +
                this.queue.filter(q => q.uKey === 'centurion').length;
      if (n >= (u.limit || 99)) { if (this.owner === game.humanId) game.message('Centurion limit reached', true); return false; }
    }
    if (p.pop + game.queuedPop(this.owner) + u.pop > p.popCap) {
      if (this.owner === game.humanId) game.message('Need more population — capture a town!', true);
      return false;
    }
    p.pay(u.cost);
    const mult = (p.civ && !u.civilian) ? p.civ.trainMult : 1;
    this.queue.push({ uKey, t: 0, total: u.time * mult });
    return true;
  }

  update(game, dt) {
    if (this.dead) return;
    const p = game.players[this.owner];

    // training
    if (this.built && this.queue.length) {
      const q = this.queue[0];
      q.t += dt;
      if (q.t >= q.total) {
        this.queue.shift();
        const spot = game.freeSpotNear(this, !!UNITS[q.uKey].naval);
        if (spot) {
          const u = Sim.spawnUnit(game, this.owner, q.uKey, spot[0], spot[1], p.civKey);
          if (u && this.rally) u.orderMove(this.rally.x, this.rally.y);
          if (this.owner === game.humanId) Audio2.sfx('train');
          if (q.uKey === 'elephant' && this.owner === game.humanId) Audio2.sfx('trumpet');
        } else this.queue.unshift(q); // wait for space
      }
    }

    // tower attack
    if (this.built && this.def.atk && (this.atkCd -= dt) <= 0) {
      const e = game.nearestEnemy(this, this.def.range);
      if (e) { this.atkCd = this.def.cd; Sim.fireProjectile(game, this, e); }
    }

    // manned wall: garrisoned archers loose arrows from the parapet at 2x attack
    if (this.built && this.def.wall && this.garrison && this.garrison.length) {
      this.wallCd = (this.wallCd || 0) - dt;
      if (this.wallCd <= 0) {
        const e = game.nearestEnemy(this, 5.5);
        if (e) {
          this.wallCd = 1.5;
          const pl = game.players[this.owner];
          for (const u of this.garrison) {
            const base = pl ? pl.statAtk(u.def) : u.def.atk;
            Sim.fireProjectile(game, this, e, base * 2);
          }
        }
      }
    }

    // storehouse: dispatch an ox cart to haul a batch home to the Town Center
    if (this.built && this.store) {
      const total = this.store.food + this.store.wood + this.store.gold + this.store.stone + this.store.iron;
      this.depositT += dt;
      const cartGone = !this.cart || this.cart.dead;
      if (cartGone && total > 0 && (total >= CFG.CART_BATCH || this.depositT > CFG.CART_FLUSH)) {
        const tc = game.findHomeTC(this.owner, this.cx(), this.cy());
        const spot = game.freeSpotNear(this, false);
        if (tc && spot) {
          const cart = Sim.spawnUnit(game, this.owner, 'cart', spot[0], spot[1], p ? p.civKey : 'none');
          cart.haulHome = this; cart.haulTC = tc;
          // load the batch: it leaves the usable pool until the cart delivers it
          cart.carry2 = {};
          for (const k of ['food','wood','gold','stone','iron']) {
            const take = Math.min(this.store[k], p ? p.res[k] : this.store[k]);
            cart.carry2[k] = take; this.store[k] -= take;
            if (p) p.res[k] -= take;             // resources dip while in transit
          }
          cart.order = { kind: 'haul' }; cart.state = 'move';
          this.cart = cart; this.depositT = 0;
        }
      }
    }

    // manned wall: every garrisoned archer fires a clean shot
    if (this.built && this.garrison) {
      this.los = this.def.los + (this.garrison.length ? 5 : 0);
      if (this.garrison.length && (this.atkCd -= dt) <= 0) {
        const rome2 = p && p.civKey === 'rome';
        const e = game.nearestEnemy(this, rome2 ? 5.5 : 4.8);
        if (e) {
          this.atkCd = 1.8;
          for (const u of this.garrison) Sim.garrisonShot(game, this, u, e);
        }
      }
    }

    // training grounds aura: XP drip
    if (this.built && this.def.aura && (this.auraT += dt) >= 1) {
      this.auraT = 0;
      for (const u of game.queryUnits(this.cx(), this.cy(), this.def.aura)) {
        if (u.owner === this.owner && !u.civilian && !u.dead) u.addXP(0.7, game);
      }
    }

    // ===== neutral town capture =====
    if (this.type === 'town' && this.built) {
      const claimants = new Map();
      let contested = false;
      for (const u of game.queryUnits(this.cx(), this.cy(), 3.0)) {
        if (u.dead || u.civilian || u.def.naval || u.inShip) continue; // boots on the ground only
        if (u.owner === this.owner) { contested = true; continue; } // defenders block capture
        claimants.set(u.owner, (claimants.get(u.owner) || 0) + 1);
      }
      if (claimants.size === 1 && !contested) {
        const [pid, n] = claimants.entries().next().value;
        const rate = Math.min(n, 3) / CFG.CAPTURE_TIME * dt;
        this.capture[pid] = (this.capture[pid] || 0) + rate;
        this.captureBy = pid;
        for (const k in this.capture) if (+k !== pid) this.capture[k] = Math.max(0, this.capture[k] - rate);
        if (this.capture[pid] >= 1) Sim.captureTown(game, this, pid);
      } else {
        this.captureBy = -2;
        for (const k in this.capture) this.capture[k] = Math.max(0, this.capture[k] - dt / CFG.CAPTURE_TIME * 0.5);
      }
    }
  }

  takeDamage(game, dmg, from) {
    if (this.dead) return;
    this.hp -= dmg;
    if (this.owner === game.humanId || (from && from.owner === game.humanId)) game.combatT = game.time;
    if (this.owner === game.humanId) game.checkAttackAlert(this.cx(), this.cy(), false);
    if (this.hp <= 0) {
      this.dead = true;
      game.unblockBuilding(this);
      Sim.rubble(game, this);
      if (this.garrison && this.garrison.length) {
        // the wall falls: Roman arrow slits double as sally ports — their archers
        // escape unharmed; everyone else gets crushed in the collapse
        for (const u of this.garrison) {
          u.inWall = null;
          const spot = game.freeSpotNear(this, false);
          if (spot) { u.x = spot[0]; u.y = spot[1]; }
          const pu = game.players[u.owner];
          if (!(pu && pu.civKey === 'rome')) u.takeDamage(game, u.maxHp * 0.55, from, true);
        }
        this.garrison = [];
      }
      if (this.type === 'wall') Sim.refreshWallMasks(game);
      if (this.type === 'canal' || this.type === 'farm') Sim.recomputeIrrigation(game);
      if (from && from.kind === 'unit') from.addXP(20, game);
      if (this.type === 'town') {
        // razed towns revert to neutral ruins-with-hp; previous owner loses cap
        const prev = game.players[this.owner];
        if (prev) { prev.towns--; prev.popCap -= CFG.TOWN_POP; }
      }
    }
  }

  drawSprite(g, view, game) {
    const style = this.type === 'town' ? 'none' : (this.civKey || 'none');
    let flag = '';
    if (this.built) {
      if (this.type === 'farm' && !this.irrigated) flag = 'dry';
      if (this.type === 'canal' && !this.flowing) flag = 'dry';
      if (this.type === 'wall') flag = String(this.wallMask) + (this.gate ? 'g' : '');
    }
    const age = (game && this.owner >= 0 && game.players[this.owner]) ? game.players[this.owner].age : 1;
    const s = Sprites.building(this.type, style, this.owner < 0 ? -1 : this.owner, this.built, flag, age);
    const ix = (World.isoX(this.cx(), this.cy()) - view.left) * view.z;
    const iy = (World.isoY(this.cx(), this.cy()) - view.top) * view.z;
    const bk = s.k || 1;
    g.drawImage(s.cv, ix - s.ax * view.z, iy - s.ay * view.z, s.cv.width * view.z / bk, s.cv.height * view.z / bk);
    // construction progress
    if (!this.built) {
      g.fillStyle = 'rgba(0,0,0,.5)';
      g.fillRect(ix - 22 * view.z, iy + 4 * view.z, 44 * view.z, 5 * view.z);
      g.fillStyle = '#e7cf8e';
      g.fillRect(ix - 21 * view.z, iy + 5 * view.z, 42 * view.z * this.progress, 3 * view.z);
    }
    // garrison pips: helmets peeking over the wall
    if (this.garrison && this.garrison.length) {
      for (let i = 0; i < this.garrison.length; i++) {
        const px2 = ix + (i - (this.garrison.length - 1) / 2) * 9 * view.z;
        g.fillStyle = '#9aa2ad'; g.beginPath();
        g.arc(px2, iy - 30 * view.z, 3.2 * view.z, Math.PI, 0); g.fill();
        g.fillStyle = Sprites.teamCols(this.owner < 0 ? -1 : this.owner).main;
        g.fillRect(px2 - 3.2 * view.z, iy - 30 * view.z, 6.4 * view.z, 1.6 * view.z);
      }
    }
    // siege banner
    if (this.besieged) {
      const pulse = 0.6 + Math.sin(performance.now() / 250) * 0.3;
      g.strokeStyle = `rgba(220,60,40,${pulse.toFixed(2)})`;
      g.lineWidth = 3 * view.z;
      g.beginPath(); g.ellipse(ix, iy, this.size * 34 * view.z, this.size * 17 * view.z, 0, 0, 7); g.stroke();
      g.fillStyle = '#d04a35';
      g.beginPath();
      g.moveTo(ix, iy - (this.size * 26 + 44) * view.z);
      g.lineTo(ix + 9 * view.z, iy - (this.size * 26 + 56) * view.z);
      g.lineTo(ix - 9 * view.z, iy - (this.size * 26 + 56) * view.z);
      g.closePath(); g.fill();
    }
    // capture progress ring
    if (this.type === 'town' && this.captureBy >= -1) {
      const pr = this.capture[this.captureBy] || 0;
      if (pr > 0.02) {
        const tc = this.captureBy >= 0 ? PLAYER_COLORS[this.captureBy] : GAIA_COLOR;
        g.strokeStyle = tc.main; g.lineWidth = 4 * view.z;
        g.beginPath(); g.arc(ix, iy - 40 * view.z, 14 * view.z, -Math.PI / 2, -Math.PI / 2 + pr * Math.PI * 2); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.25)';
        g.beginPath(); g.arc(ix, iy - 40 * view.z, 14 * view.z, 0, 7); g.stroke();
      }
    }
    return { ix, iy };
  }
}

/* ================= PROJECTILES & FX ================= */
const Sim = {
  spawnUnit(game, owner, type, x, y, civKey) {
    const p = game.players[owner];
    const u = UNITS[type];
    if (p) { p.pop += u.pop; }
    const unit = new Unit(owner, type, x, y, civKey || (p ? p.civKey : 'none'));
    // apply current player armor/hp upgrades? hp upgrades via rank only; fine
    game.units.push(unit);
    return unit;
  },

  canPlace(game, type, bx, by) {
    const B = BUILDINGS[type];
    if (bx < 1 || by < 1 || bx + B.size > World.N - 1 || by + B.size > World.N - 1) return false;
    if (B.naval) {
      // docks: on the SEA (salt water) only, free of fish/ships, touching the shore
      let touchesLand = false;
      const reg = game.world.waterRegion[World.idx(bx, by)];
      if (!reg || game.world.regionSizes[reg] < 60) return false;
      for (let y = by; y < by + B.size; y++) for (let x = bx; x < bx + B.size; x++) {
        const i = World.idx(x, y);
        if (game.world.ter[i] > TERRAIN.SHALLOW || game.world.salt[i] !== 1 ||
            game.world.objGrid[i] || game.world.navBlocked[i]) return false;
      }
      for (let y = by - 1; y <= by + B.size; y++) for (let x = bx - 1; x <= bx + B.size; x++)
        if (World.inB(x, y) && game.world.ter[World.idx(x, y)] >= TERRAIN.SAND) touchesLand = true;
      if (!touchesLand) return false;
    } else {
      for (let y = by; y < by + B.size; y++) for (let x = bx; x < bx + B.size; x++) {
        const i = World.idx(x, y);
        if (game.world.blocked[i] || game.world.objGrid[i] || game.world.ter[i] < TERRAIN.SAND) return false;
      }
    }
    // not on top of units
    for (const u of game.queryUnits(bx + B.size / 2, by + B.size / 2, B.size + 1)) {
      if (!u.dead && u.x >= bx - .2 && u.x <= bx + B.size + .2 && u.y >= by - .2 && u.y <= by + B.size + .2) return false;
    }
    // not overlapping existing buildings (farms don't block the grid)
    for (const b of game.buildings) {
      if (b.dead) continue;
      if (bx < b.x + b.size && bx + B.size > b.x && by < b.y + b.size && by + B.size > b.y) return false;
    }
    return true;
  },

  placeBuilding(game, owner, type, bx, by, built) {
    const p = game.players[owner];
    const b = new Building(owner, type, bx, by, p ? p.civKey : 'none', built);
    if (built && p) { b.applyHpBonus(p); b.hp = b.maxHp; }
    game.buildings.push(b);
    const B = BUILDINGS[type];
    if (B.naval) { // docks block ships, not the (already unwalkable) water
      for (let y = by; y < by + B.size; y++) for (let x = bx; x < bx + B.size; x++)
        game.world.navBlocked[World.idx(x, y)] = 1;
    } else if (!B.farm) { // farms walkable
      for (let y = by; y < by + B.size; y++) for (let x = bx; x < bx + B.size; x++)
        game.world.blocked[World.idx(x, y)] = 1;
    }
    if (!B.farm && !B.canal && !B.naval) { // tall structures hide what's behind them
      for (let y = by; y < by + B.size; y++) for (let x = bx; x < bx + B.size; x++)
        game.world.sightBlock[World.idx(x, y)] = 1;
    }
    // clear decorative doodads under the foundation
    for (const o of game.world.objects)
      if (o.doodad && o.alive && o.x >= bx - 1 && o.x < bx + B.size && o.y >= by - 1 && o.y < by + B.size)
        o.alive = false;
    if (type === 'wall') Sim.refreshWallMasks(game);
    return b;
  },

  meleeHit(game, src, t) {
    const dmg = this.calcDamage(game, src, t);
    t.takeDamage(game, dmg, src);
    // slash sparks at the point of impact
    if (World.visAt(t.cx(), t.cy()) === 2) {
      for (let i = 0; i < 4; i++) game.particles.push({
        x: t.cx() + (Math.random() - .5) * .5, y: t.cy() - .2 + (Math.random() - .5) * .3,
        vx: (Math.random() - .5) * 3, vy: -Math.random() * 1.5, grav: 2,
        z: 12 + Math.random() * 8, vz: 0,
        life: .16 + Math.random() * .08, max: .22, color: i % 2 ? '#fff8d8' : '#ffd34d', size: 2.2,
      });
    }
    if (src.owner === game.humanId || t.owner === game.humanId) {
      const w = { legionary: 'sword', sword: 'sword', centurion: 'sword',
                  spearman: 'spear', chariot: 'spear', scout: 'spear',
                  elephant: 'stomp', settler: 'chop' }[src.type] || 'clang';
      Audio2.sfx(w);
    }
    // elephant splash
    if (src.def.splash && t.kind === 'unit') {
      for (const o of game.queryUnits(t.x, t.y, src.def.splash)) {
        if (o !== t && o !== src && !o.dead && game.hostile(src.owner, o.owner))
          o.takeDamage(game, dmg * 0.5, src);
      }
    }
  },

  calcDamage(game, src, t) {
    let atk = src.kind === 'unit' ? src.effAtk(game) : src.def.atk;
    // terrain: archers rule the high ground; mountain passes are death funnels.
    if (src.kind === 'unit') {
      const ranged = src.def.range > 1.2;
      if (World.isPass(src.x, src.y)) atk *= ranged ? 2.0 : 0.5;          // pass: archers brutal, melee feeble
      else if (World.terAt(src.x, src.y) === TERRAIN.HILL) atk *= ranged ? 1.5 : 1.2;
    }
    let mult = 1;
    const bv = src.def.bonusVs;
    if (bv) {
      const tags = t.kind === 'bld' ? ['building'] : t.def.tags || [];
      for (const tag of tags) if (bv[tag]) mult = Math.max(mult, bv[tag]);
    }
    // defenders on high ground take far less (cover + elevation)
    if (t.kind === 'unit') {
      if (World.isPass(t.x, t.y)) mult *= 0.33;                            // ~3x effective defence
      else if (World.terAt(t.x, t.y) === TERRAIN.HILL) mult *= 0.5;        // ~2x effective defence
    }
    const armor = t.kind === 'unit' ? t.effArmor(game) : 1;
    return Math.max(1, atk * mult - armor);
  },

  fireProjectile(game, src, t, dmgOverride) {
    const p = game.players[src.owner];
    const burn = p && p.bonus.greekFire && (src.type === 'catapult' || src.type === 'tower');
    game.projectiles.push({
      x: src.cx(), y: src.cy() - (src.kind === 'bld' ? 1.2 : 0.5),
      target: t, speed: src.type === 'catapult' ? 7 : 13,
      src, t0: game.time, dmg: dmgOverride != null ? dmgOverride : this.calcDamage(game, src, t),
      splash: src.def.splash || 0, burn,
      stone: src.type === 'catapult',
    });
    if (src.owner === game.humanId || t.owner === game.humanId) {
      if (src.type === 'chukonu') Audio2.sfx('crossbow');
      else if (src.type !== 'catapult') { Audio2.sfx('bowstring'); Audio2.sfx('arrow'); }
      else Audio2.sfx('arrow');
    }
  },

  updateProjectiles(game, dt) {
    const ps = game.projectiles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const pr = ps[i];
      const t = pr.target;
      if (!t || t.dead) { ps.splice(i, 1); continue; }
      const tx = t.cx(), ty = t.cy();
      const d = dist(pr.x, pr.y, tx, ty);
      const step = pr.speed * dt;
      if (d <= step) {
        ps.splice(i, 1);
        if (pr.splash) {
          if (pr.stone) Audio2.sfx('boom');
          this.puff(game, tx, ty, '#c2b9a0', 10);
          for (const o of game.queryUnits(tx, ty, pr.splash)) {
            if (!o.dead && game.hostile(pr.src.owner, o.owner)) {
              o.takeDamage(game, pr.dmg * (o === t ? 1 : 0.6), pr.src);
              if (pr.burn) { o.burn = { t: 3, dps: 5 }; this.flame(game, o.x, o.y); }
            }
          }
          if (t.kind === 'bld') {
            t.takeDamage(game, pr.dmg, pr.src);
            if (pr.burn) this.flame(game, tx, ty);
          }
        } else {
          let dmg = pr.dmg;
          if (t.kind === 'unit' && t.cover) dmg *= 0.7; // forest cover blunts arrows
          t.takeDamage(game, dmg, pr.src);
          if (pr.burn && t.kind === 'unit') { t.burn = { t: 3, dps: 5 }; this.flame(game, tx, ty); }
        }
      } else {
        pr.x += (tx - pr.x) / d * step;
        pr.y += (ty - pr.y) / d * step;
      }
    }
  },

  captureTown(game, town, pid) {
    const prev = game.players[town.owner];
    if (prev) { prev.towns--; prev.popCap -= CFG.TOWN_POP; }
    town.owner = pid;
    town.capture = {}; town.captureBy = -2;
    const p = game.players[pid]; // undefined when neutral garrison reclaims it
    const know = town.fortress ? 100 : 40;   // mountain citadels are a knowledge windfall
    if (p) {
      p.towns++; p.popCap = Math.min(CFG.MAX_POP, p.popCap + CFG.TOWN_POP);
      p.res.knowledge += know;
      town.applyHpBonus(p); town.hp = town.maxHp;
    }
    this.puff(game, town.cx(), town.cy() - 1, '#ffd34d', town.fortress ? 28 : 16);
    if (pid === game.humanId) {
      game.message(town.fortress
        ? `Mountain Citadel seized! +${CFG.TOWN_POP} population, +100 Knowledge, and its riches are yours!`
        : `Town captured! +${CFG.TOWN_POP} population, +40 Knowledge`);
      Audio2.sfx('capture');
      Audio2.say(town.fortress ? 'A mountain citadel is ours! Its treasures will fund the war.' : 'Town captured! Our empire grows.', true);
    } else if (prev && prev.id === game.humanId) {
      game.message('We lost a town!', true); Audio2.sfx('alert');
      Audio2.say('We have lost a town!', true);
    } else if (p) game.message(`${PLAYER_COLORS[pid].name} captured a town`, false);
    game.ping(town.cx(), town.cy());
  },

  /* ---- walls: connect neighbors + garrison fire ---- */
  refreshWallMasks(game) {
    const walls = new Map();
    for (const b of game.buildings)
      if (!b.dead && b.type === 'wall') walls.set(b.y * World.N + b.x, b);
    for (const b of walls.values()) {
      b.wallMask = (walls.has(b.y * World.N + b.x + 1) ? 1 : 0) |
                   (walls.has(b.y * World.N + b.x - 1) ? 2 : 0) |
                   (walls.has((b.y + 1) * World.N + b.x) ? 4 : 0) |
                   (walls.has((b.y - 1) * World.N + b.x) ? 8 : 0);
    }
  },

  garrisonShot(game, wall, u, t) {
    const p = game.players[u.owner];
    const mult = p && p.civKey === 'rome' ? 1.5 : 1.25; // clean shots from the slits
    const armor = t.kind === 'unit' ? t.effArmor(game) : 1;
    const dmg = Math.max(1, u.effAtk(game) * mult - armor);
    game.projectiles.push({
      x: wall.cx(), y: wall.cy() - 0.8, target: t, speed: 13,
      src: wall, t0: game.time, dmg, splash: 0,
    });
    if (wall.owner === game.humanId || t.owner === game.humanId) Audio2.sfx('arrow');
  },

  /* ---- a hunted animal drops a carcass the hunters must haul home ---- */
  dropCarcass(game, animal, killer) {
    const owner = killer ? (killer.kind === 'unit' ? killer.owner : -1) : -1;
    // a real meat node: settlers carry it to a dropoff where it cures into food
    const o = { id: game.world.objects.length, kind: 'carcass', x: animal.x | 0, y: animal.y | 0,
                amount: animal.def.meat, variant: 0, alive: true, fade: 80 }; // rots if left ~80s
    game.world.objects.push(o);
    (game.carcasses || (game.carcasses = [])).push(o);
    this.puff(game, animal.x, animal.y, '#9a3a1a', 10);
    if (owner >= 0) {
      // up to 2 settlers butcher & haul one carcass — start with the killer, then nearby idle hands
      const haulers = [];
      if (killer.type === 'settler' && !killer.dead) haulers.push(killer);
      for (const u of game.queryUnits(animal.x, animal.y, 7)) {
        if (haulers.length >= 2) break;
        if (u.type === 'settler' && u.owner === owner && !u.dead && !haulers.includes(u) &&
            (!u.order || u.order.kind === 'move' || (u.order.kind === 'attack' && u.order.target === animal)))
          haulers.push(u);
      }
      for (const u of haulers) u.orderGather(o);
      if (owner === game.humanId) { game.message(`${animal.def.name} down — hauling ${animal.def.meat} food home (cures on drop-off)`); Audio2.sfx('capture'); }
    }
  },

  /* ---- ox cart delivers its batch to the Town Center (resources restored) ---- */
  cartArrive(game, cart, tc) {
    const p = game.players[cart.owner];
    if (p && cart.carry2) for (const k of ['food','wood','gold','stone','iron']) p.res[k] += cart.carry2[k] || 0;
    if (cart.haulHome && cart.haulHome.cart === cart) cart.haulHome.cart = null;
    cart.dead = true; game.popFree(cart);
    if (tc && cart.owner === game.humanId) Sim.puff(game, tc.cx(), tc.cy() - 1, '#ffd34d', 6);
  },

  /* ---- sieges: surround a settlement to starve its defenders ---- */
  sieges(game) {
    for (const b of game.buildings) {
      if (b.dead || !b.built || (b.type !== 'tc' && b.type !== 'town') || b.owner < 0) continue;
      let foes = 0;
      for (const u of game.queryUnits(b.cx(), b.cy(), CFG.SIEGE_R))
        if (!u.dead && !u.civilian && !u.def.npc && !u.inShip && u.owner >= 0 && u.owner !== b.owner) foes++;
      b.siegeT = foes >= CFG.SIEGE_MEN ? (b.siegeT || 0) + 2 : Math.max(0, (b.siegeT || 0) - 4);
      const was = b.besieged;
      b.besieged = b.siegeT >= CFG.SIEGE_DELAY;
      if (b.besieged && !was) {
        if (b.owner === game.humanId) {
          game.message('UNDER SIEGE — supplies are cut, our troops are starving!', true);
          Audio2.say('We are under siege! They mean to starve us out!', true);
          game.ping(b.cx(), b.cy());
        } else game.message('Enemy settlement is under siege — starve them out!');
      }
      if (was && !b.besieged && b.owner === game.humanId) game.message('The siege is broken — supplies flow again');
      if (b.besieged) {
        for (const u of game.queryUnits(b.cx(), b.cy(), CFG.SIEGE_R + 1)) {
          if (u.dead || u.owner !== b.owner) continue;
          u.hungerT = game.time;
          if (b.siegeT > 90) u.starveT = game.time; // long sieges kill
        }
      }
    }
  },

  /* ---- poison wells: scouts foul enemy water ---- */
  applyPoison(game, by, x, y) {
    game.poisons.push({ x, y, by, until: game.time + CFG.POISON_T });
    for (let i = 0; i < 16; i++) game.particles.push({
      x: x + (Math.random() - .5) * 2, y: y + (Math.random() - .5) * 1.4,
      vx: (Math.random() - .5), vy: -1 - Math.random(), grav: -1,
      life: .9 + Math.random() * .6, max: 1.4, color: '#5fae3f', size: 2.5 + Math.random() * 3,
    });
    const victim = game.inTerritory(x, y);
    if (victim === game.humanId) {
      game.message('Our water has been POISONED! Troops nearby are sickening!', true);
      Audio2.say('Our water has been poisoned!', true);
      game.ping(x, y);
    }
    if (by === game.humanId) {
      game.message('Water poisoned — enemy troops there will sicken for 90s');
      Audio2.say('The wells are poisoned. Their soldiers will drink death.');
    }
  },

  /* ---- merchants: gold buys their maps and their loyalty ---- */
  bribe(game, trader, pid) {
    const p = game.players[pid];
    if (!p || trader.bribedBy >= 0 || p.res.gold < CFG.BRIBE_COST) return false;
    p.res.gold -= CFG.BRIBE_COST;
    trader.bribedBy = pid;
    trader.gaveKnow = true; // no double-dipping the knowledge gift
    p.res.knowledge += 20;
    if (pid === game.humanId) {
      // his maps: everywhere he's walked becomes explored
      for (const [tx, ty] of trader.trail) World.explore(tx, ty, 5);
      World.explore(trader.x, trader.y, 6);
      // his gossip: every kingdom he's visited is betrayed
      let kingdoms = 0;
      for (const k in trader.visited) {
        const other = +k;
        if (other === pid) continue;
        kingdoms++;
        for (const b of game.buildings) {
          if (b.dead || b.owner !== other || (b.type !== 'tc' && b.type !== 'town')) continue;
          World.explore(b.cx(), b.cy(), 7);
          game.ping(b.cx(), b.cy());
        }
      }
      game.message(kingdoms
        ? `The merchant sold his maps — and the location of ${kingdoms} rival kingdom${kingdoms > 1 ? 's' : ''}!`
        : 'The merchant sold his maps. +20 Knowledge');
      Audio2.say(kingdoms ? 'The merchant has betrayed the rival kingdoms to us.' : 'The merchant shared his travel maps.');
      Audio2.sfx('capture');
    }
    // he becomes your caravan: TC <-> the nearest town he can trade with
    const myTc = game.buildings.find(b => !b.dead && b.owner === pid && b.type === 'tc');
    let tgt = null, bd = 1e9;
    for (const b of game.buildings) {
      if (b.dead || b.type !== 'town' || b.owner === pid) continue;
      const d = dist2(trader.x, trader.y, b.cx(), b.cy());
      if (d < bd) { bd = d; tgt = b; }
    }
    if (myTc && tgt) { trader.route = { a: myTc, b: tgt, leg: 'a' }; trader.clearOrder(); }
    return true;
  },

  /* ---- irrigation: BFS water flow through canal chains ---- */
  recomputeIrrigation(game) {
    // only FRESH water with reserve left irrigates — salt sea & dried lakes can't
    const isWater = (x, y) => World.lakeHasWater(x, y);
    const canals = [], farms = [];
    for (const b of game.buildings) {
      if (b.dead) continue;
      if (b.type === 'canal' && b.built) canals.push(b);
      else if (b.type === 'farm') farms.push(b);
    }
    // seed: canals touching natural water (remember WHICH lake tile feeds them)
    const queue = [];
    for (const c of canals) {
      c.flowing = false; c.srcTile = null;
      for (let dy = -1; dy <= 1 && !c.flowing; dy++) for (let dx = -1; dx <= 1; dx++)
        if (isWater(c.x + dx, c.y + dy)) { c.flowing = true; c.srcTile = [c.x + dx, c.y + dy]; queue.push(c); break; }
    }
    // walls a canal feeds become culvert gates — water passes under them into a walled town
    const walls = [];
    for (const b of game.buildings) if (!b.dead && b.type === 'wall' && b.built) { b.gate = false; walls.push(b); }
    const wallAt = (x, y) => walls.find(w => w.x === x && w.y === y);
    const canalAt = (x, y) => canals.find(c => c.x === x && c.y === y);
    // spread flow through adjacent canals (and through any single wall a canal feeds)
    while (queue.length) {
      const c = queue.pop();
      for (const o of canals) {
        if (o.flowing || Math.abs(o.x - c.x) > 1 || Math.abs(o.y - c.y) > 1) continue;
        o.flowing = true; o.srcTile = c.srcTile; queue.push(o);
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const w = wallAt(c.x + dx, c.y + dy);
        if (!w || w.owner !== c.owner) continue;
        w.gate = true; w.flowing = true; w.srcTile = c.srcTile;        // this wall is now a water gate
        const far = canalAt(c.x + dx * 2, c.y + dy * 2);
        if (far && !far.flowing) { far.flowing = true; far.srcTile = c.srcTile; queue.push(far); }
      }
    }
    // farms: direct water OR a flowing canal within IRRIGATION range of the farm's edge
    const R = CFG.IRRIGATION;
    const nearRect = (px, py, f, r) => {
      const cx2 = clamp(px, f.x, f.x + f.size), cy2 = clamp(py, f.y, f.y + f.size);
      return dist2(px, py, cx2, cy2) <= r * r;
    };
    for (const f of farms) {
      const fx = f.cx(), fy = f.cy();
      let ok = false, src = null;
      const x0 = Math.max(0, (f.x - R - 1) | 0), x1 = Math.min(World.N - 1, (f.x + f.size + R + 1) | 0);
      const y0 = Math.max(0, (f.y - R - 1) | 0), y1 = Math.min(World.N - 1, (f.y + f.size + R + 1) | 0);
      for (let y = y0; y <= y1 && !ok; y++) for (let x = x0; x <= x1; x++)
        if (isWater(x, y) && nearRect(x + .5, y + .5, f, R)) { ok = true; src = [x, y]; break; }
      if (!ok) for (const c of canals.concat(walls.filter(w => w.gate)))
        if (c.flowing && nearRect(c.cx(), c.cy(), f, R - 0.5)) { ok = true; src = c.srcTile || [c.x, c.y]; break; }
      const wasDry = f.irrigated && !ok;
      if (wasDry && f.built && f.owner === game.humanId) {
        game.message('A farm dried up — its lake is empty! Wait for rain.', true);
        Audio2.say('Our farms have run dry — we need rain.', true);
        game.ping(fx, fy);
      }
      f.irrigated = ok;
      f.waterSrc = ok ? src : null;   // farmers drain THIS lake tile as they harvest (see gather)
    }
  },

  /* particles */
  puff(game, x, y, color, n) {
    for (let i = 0; i < n; i++) game.particles.push({
      x: x + (Math.random() - .5) * .6, y: y + (Math.random() - .5) * .4,
      vx: (Math.random() - .5) * 2, vy: -Math.random() * 2 - .5,
      life: .6 + Math.random() * .5, max: 1, color, size: 2 + Math.random() * 3, grav: 3,
    });
  },
  flame(game, x, y) {
    for (let i = 0; i < 4; i++) game.particles.push({
      x: x + (Math.random() - .5) * .5, y,
      vx: (Math.random() - .5), vy: -1.5 - Math.random() * 1.5,
      life: .5 + Math.random() * .4, max: 1, color: Math.random() < .5 ? '#ff7a30' : '#ffc14d',
      size: 2.5 + Math.random() * 3, grav: -2,
    });
  },
  rubble(game, b) {
    for (let i = 0; i < 22; i++) game.particles.push({
      x: b.cx() + (Math.random() - .5) * b.size, y: b.cy() + (Math.random() - .5) * b.size * .6,
      vx: (Math.random() - .5) * 3, vy: -Math.random() * 3,
      life: .8 + Math.random() * .6, max: 1, color: ['#9a948a', '#6e5638', '#4e3f2a'][i % 3],
      size: 3 + Math.random() * 4, grav: 7,
    });
    Audio2.sfx('boom');
  },

  updateParticles(game, dt) {
    const ps = game.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt * 0.5;
      p.vy += p.grav * dt;
      if (p.vz) p.z = (p.z || 0) + p.vz * dt; // screen-space height (smoke rises)
    }
  },

  /* chimney smoke from town centers & keeps */
  smoke(game, b) {
    game.particles.push({
      x: b.cx() - 0.4 + Math.random() * 0.3, y: b.cy() - 0.4,
      vx: 0.12 + Math.random() * 0.1, vy: 0, grav: 0,
      z: (b.size * 26) + 14, vz: 16 + Math.random() * 8,
      life: 1.6 + Math.random() * 0.8, max: 2.2,
      color: 'rgba(160,150,135,0.5)', size: 3 + Math.random() * 3,
    });
  },

  /* separation: gently push overlapping units apart */
  separate(game, dt) {
    const units = game.units;
    for (const u of units) {
      if (u.dead || u.inShip) continue;
      const grid = u.def.naval ? game.world.navBlocked : game.world.blocked;
      const uMoving = u.path && u.wp < u.path.length;
      for (const o of game.queryUnits(u.x, u.y, 0.9)) {
        if (o === u || o.dead || o.inShip || !!o.def.naval !== !!u.def.naval) continue;
        const oMoving = o.path && o.wp < o.path.length;
        // marching columns don't elbow each other — only resolve real overlaps
        if (uMoving && oMoving) continue;
        const d2 = dist2(u.x, u.y, o.x, o.y);
        if (d2 < 0.20 && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          let push = (0.45 - d) * dt * 2.2;
          if (uMoving) push *= 0.45; // moving units get a gentler nudge
          const px = (u.x - o.x) / d * push, py = (u.y - o.y) / d * push;
          const nx = u.x + px, ny = u.y + py;
          if (!grid[World.idx(clamp(nx | 0, 0, World.N - 1), clamp(ny | 0, 0, World.N - 1))]) { u.x = nx; u.y = ny; }
        }
      }
    }
  },

  /* transport: land cargo on free shore tiles near (tx, ty) */
  unloadCargo(game, ship, tx, ty) {
    const spots = [];
    const sx = ship.x | 0, sy = ship.y | 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = sx + dx, y = sy + dy;
      if (!World.inB(x, y)) continue;
      const i = World.idx(x, y);
      if (game.world.ter[i] >= TERRAIN.SAND && !game.world.blocked[i])
        spots.push([x, y, dist2(x + .5, y + .5, tx, ty)]);
    }
    spots.sort((a, b) => a[2] - b[2]);
    let landed = 0;
    while (ship.cargo.length && landed < spots.length) {
      const u = ship.cargo.shift();
      const [x, y] = spots[landed++];
      u.inShip = null; u.x = x + .5; u.y = y + .5;
      u.clearOrder();
    }
    if (ship.cargo.length) {
      if (ship.owner === game.humanId) game.message('No room to land all troops here!', true);
    } else if (landed && ship.owner === game.humanId) {
      Audio2.ack('move', false);
    }
  },

  /* fire ship: ram and burn */
  fireshipExplode(game, ship, target) {
    ship.dead = true;
    game.popFree(ship);
    const dmg = this.calcDamage(game, ship, target);
    target.takeDamage(game, dmg, ship);
    if (target.kind === 'unit') target.burn = { t: 4, dps: 6 };
    for (const o of game.queryUnits(target.cx(), target.cy(), ship.def.splash)) {
      if (o === target || o.dead || !game.hostile(ship.owner, o.owner)) continue;
      o.takeDamage(game, dmg * 0.6, ship);
      if (o.def.naval) o.burn = { t: 3, dps: 5 };
    }
    for (let i = 0; i < 14; i++) this.flame(game, target.cx() + (Math.random() - .5) * 1.5, target.cy() + (Math.random() - .5));
    this.puff(game, target.cx(), target.cy(), '#5a5550', 10);
    Audio2.sfx('boom');
  },

  /* centurion aura */
  auras(game) {
    for (const u of game.units) {
      if (u.dead || u.type !== 'centurion') continue;
      for (const o of game.queryUnits(u.x, u.y, u.def.aura)) {
        if (o.owner === u.owner && o !== u && !o.civilian) o.buffT = 0.8;
      }
    }
  },
};
