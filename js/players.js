/* ============ CONQUERORS — player state, ages, techs ============ */
'use strict';

class Player {
  constructor(id, civKey, isHuman, difficulty) {
    this.id = id;                     // -1 gaia, 0 human, 1..2 AI
    this.civKey = civKey;
    this.civ = CIVS[civKey] || null;
    this.isHuman = isHuman;
    this.difficulty = difficulty || 'normal';
    this.res = { food: 200, wood: 200, gold: 100, stone: 0, iron: 0, knowledge: 0 };
    this.age = 1;
    this.meatCuring = 0;               // hauled carcass meat trickling into food
    this.popCap = CFG.START_POP;
    this.pop = 0;
    this.towns = 0;                   // captured neutral towns
    this.techs = new Set();
    this.researching = null;          // {key, t, total} (univ) or {age:true,...}
    this.bonus = { meleeAtk: 0, rangedAtk: 0, armor: 0, range: 0,
                   bldHp: 1, gather: 1, tcHeal: false, greekFire: false };
    this.defeated = false;
    this.knowFrac = 0;
  }

  canAfford(cost) {
    if (!cost) return true;
    for (const k in cost) if ((this.res[k] || 0) < cost[k]) return false;
    return true;
  }
  pay(cost) { if (!cost) return; for (const k in cost) this.res[k] -= cost[k]; }
  refund(cost) { if (!cost) return; for (const k in cost) this.res[k] += cost[k]; }

  /* unit roster respecting civ swaps & uniques */
  canTrain(uKey) {
    const u = UNITS[uKey];
    if (!u || u.npc) return false;
    if (u.age > this.age) return false;
    if (u.civ && u.civ !== this.civKey) return false;
    // civ roster replacement: if this civ has a unique swap for this slot, suppress the generic
    if (this.civ && this.civ.roster && this.civ.roster[uKey]) return false;
    return true;
  }
  techCost(t) {
    if (!this.civ || !this.civ.techDiscount) return t.cost;
    const c = {};
    for (const k in t.cost) c[k] = Math.round(t.cost[k] * this.civ.techDiscount);
    return c;
  }
  canResearch(key) {
    const t = TECHS[key];
    if (!t || this.techs.has(key) || this.researching) return false;
    if (t.age > this.age) return false;
    if (t.civ && t.civ !== this.civKey) return false;
    if (t.req && !this.techs.has(t.req)) return false;
    return this.canAfford(this.techCost(t));
  }
  startResearch(key) {
    const t = TECHS[key];
    this.pay(this.techCost(t));
    this.researching = { key, t: 0, total: t.time };
  }
  ageUpCost() { return this.age < 4 ? AGES[this.age].cost : null; }
  canAgeUp() {
    if (this.age >= 4 || this.researching) return false;
    const a = AGES[this.age];
    return this.towns >= (a.towns || 0) && this.canAfford(a.cost);
  }
  startAgeUp() {
    this.pay(AGES[this.age].cost);
    this.researching = { ageUp: true, t: 0, total: 30 + this.age * 10 };
  }

  tickResearch(dt, game) {
    // passive knowledge (Chinese scholars)
    if (this.civ && this.civ.knowTrickle && game.playerHasBuilding(this.id, 'university')) {
      this.knowFrac += this.civ.knowTrickle * dt;
      if (this.knowFrac >= 1) { this.res.knowledge += this.knowFrac | 0; this.knowFrac %= 1; }
    }
    // hauled carcass meat cures into food fast (~CFG.MEAT_CURE_RATE per second)
    if (this.meatCuring > 0) {
      const give = Math.min(this.meatCuring, CFG.MEAT_CURE_RATE * dt);
      this.res.food += give; this.meatCuring -= give;
      if (this.meatCuring < 0.01) this.meatCuring = 0;
    }
    if (!this.researching) return;
    this.researching.t += dt;
    if (this.researching.t < this.researching.total) return;
    const r = this.researching; this.researching = null;
    if (r.ageUp) {
      this.age++;
      game.onAgeUp(this);
    } else {
      this.techs.add(r.key);
      TECHS[r.key].apply(this);
      game.onTech(this, r.key);
    }
  }

  /* effective stats for a unit type */
  statAtk(u) {
    const ranged = u.range > 1.2;
    return u.atk + (ranged ? this.bonus.rangedAtk : this.bonus.meleeAtk);
  }
  statRange(u) { return u.range > 1.2 ? u.range + this.bonus.range : u.range; }
  statArmor(u) { return u.armor + this.bonus.armor; }
}
