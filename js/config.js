/* ============ CONQUERORS — config & data ============ */
'use strict';

/* pre-game options chosen on the title screen, persisted across the fresh reload
   that applies them (map size must be known before the world arrays allocate). */
const BOOT = (() => { try { return JSON.parse(localStorage.getItem('conq_boot') || 'null'); } catch (e) { return null; } })();
const MAP_SIZES = { small: 96, medium: 144, large: 192, huge: 240 };  // all divisible by CHUNK(12)
window.GAME_OPTS = { res: (BOOT && BOOT.res) || 1, animals: (BOOT && BOOT.animals) || 1 };

const CFG = {
  MAP: (BOOT && MAP_SIZES[BOOT.map]) || 96,    // map is MAP x MAP tiles (title-selectable)
  TILE_W: 64, TILE_H: 32,  // iso tile screen size at zoom 1
  CHUNK: 12,               // tiles per terrain cache chunk
  START_POP: 18,
  TOWN_POP: 10,
  MAX_POP: 110,
  CARRY: 10,               // settler carry capacity
  CAPTURE_TIME: 8,         // seconds to capture a neutral town
  XP_RANKS: [25, 70, 150], // veterancy thresholds
  RANK_BONUS: 0.15,        // +atk/+hp per rank
  AGGRO: 6,                // auto-engage radius (tiles)
  IRRIGATION: 3,           // farm-to-water/canal supply distance (tiles)
  DAY_CYCLE: 300,          // seconds per full day/night cycle
  CART_BATCH: 90,          // storehouse waits to accumulate this, then dispatches a cart
  CART_FLUSH: 8,           // ...or after this many idle seconds, haul the remainder
  RAIN_EVERY: 150,         // seconds between rain events
  RAIN_DUR: 45,            // how long a rain cloud lingers
  LAKE_PER_TILE: 90,       // freshwater reserve per lake tile (depleted by active farming)
  WATER_PER_FOOD: 14,      // lake water drawn per unit of food a farm yields
  MEAT_CURE_RATE: 12,      // food/sec a hauled carcass cures into at the dropoff
  TERRITORY: 12,           // kingdom border radius around TCs & owned towns
  SIEGE_R: 10,             // enemy presence radius that blockades a settlement
  SIEGE_MEN: 5,            // enemies needed to enforce a siege
  SIEGE_DELAY: 25,         // seconds of blockade before hunger sets in
  POISON_T: 90,            // seconds a poisoned water source stays toxic
  BRIBE_COST: 100,
  ZOOM_MIN: 0.55, ZOOM_MAX: 1.6,
};

const TERRAIN = { DEEP:0, SHALLOW:1, SAND:2, GRASS:3, DIRT:4, HILL:5 };

const AGES = [
  { name:'Settlement Age', cost:null },
  // Bronze is pure gold+food (AoE-style, always reachable). Higher ages also
  // want captured towns — towns remain the path to population & late power.
  { name:'Bronze Age',    cost:{food:500,  gold:250},                 towns:0 },
  { name:'Imperial Age',  cost:{food:1000, gold:500,  iron:200},      towns:1 },
  { name:'Conquest Age',  cost:{food:1500, gold:900,  iron:450},      towns:2 },
];

const RES_KEYS = ['food','wood','gold','stone','iron','knowledge'];

/* ---------- Civilizations ---------- */
const CIVS = {
  rome: {
    name:'Romans', tag:'Discipline · Siege · Fire', style:'rome',
    desc:['Legionaries — heavy shielded swordsmen','Centurion command aura (Age III)',
          'Military trains 15% faster','Greek Fire — burning shots (Age IV)'],
    trainMult:0.85, bldHp:1, buildSpd:1, goldMult:1, regen:0, knowTrickle:0,
    roster:{ sword:'legionary' }, uniques:['centurion'],
  },
  china: {
    name:'Chinese', tag:'Engineering · Gunpowder · Walls', style:'china',
    desc:['Chu Ko Nu — repeating crossbows (Age III)','Buildings +25% HP, built 25% faster',
          'Scholars: passive Knowledge income','Cheaper University research'],
    trainMult:1, bldHp:1.25, buildSpd:1.25, goldMult:1, regen:0, knowTrickle:1/8,
    roster:{}, uniques:['chukonu'], techDiscount:0.8,
  },
  india: {
    name:'Indians', tag:'War Beasts · Steel · Wealth', style:'india',
    desc:['War Elephants — armored living siege (Age III)','Chariot Runners — fast raiders (Age II)',
          'Ayurveda: units slowly regenerate','Gold gathered 20% faster'],
    trainMult:1, bldHp:1, buildSpd:1, goldMult:1.2, regen:0.6, knowTrickle:0,
    roster:{}, uniques:['chariot','elephant'],
  },
};

/* ---------- Units ----------
   atk applied every cooldown sec. range in tiles (<=1 means melee).
   speed tiles/sec. bonusVs: extra dmg multiplier vs tags. */
const UNITS = {
  settler:  { name:'Settler',   hp:35,  atk:3,  range:1,   speed:0.95, cd:1.5, armor:0, los:5,
              cost:{food:50}, pop:1, time:18, age:1, tags:['civilian'], civilian:true,
              bonusVs:{ animal:5 } },   // hunters hit game hard (but stay weak vs real troops)
  scout:    { name:'Scout',     hp:48,  atk:4,  range:1,   speed:1.75, cd:1.5, armor:0, los:9,
              cost:{food:70},  pop:1, time:16, age:1, tags:['cavalry'] },
  spearman: { name:'Spearman',  hp:58,  atk:7,  range:1,   speed:0.95, cd:1.4, armor:0, los:6,
              cost:{food:40,wood:25}, pop:1, time:15, age:1, tags:['infantry'],
              bonusVs:{cavalry:1.6, elephant:1.8} },
  archer:   { name:'Archer',    hp:34,  atk:6,  range:4.6, speed:1.0,  cd:1.7, armor:0, los:7,
              cost:{wood:30,gold:35}, pop:1, time:16, age:2, tags:['ranged'] },
  sword:    { name:'Swordsman', hp:72,  atk:10, range:1,   speed:0.95, cd:1.4, armor:1, los:6,
              cost:{food:55,gold:35}, pop:1, time:17, age:2, tags:['infantry'] },
  legionary:{ name:'Legionary', hp:88,  atk:11, range:1,   speed:0.92, cd:1.4, armor:2, los:6,
              cost:{food:60,gold:45}, pop:1, time:17, age:2, tags:['infantry'], civ:'rome' },
  chariot:  { name:'Chariot Runner', hp:60, atk:8, range:1, speed:1.8, cd:1.3, armor:0, los:7,
              cost:{food:45,wood:50}, pop:1, time:16, age:2, tags:['cavalry'], civ:'india' },
  chukonu:  { name:'Chu Ko Nu', hp:38,  atk:4,  range:4.2, speed:1.0,  cd:2.1, armor:0, los:7,
              cost:{wood:45,gold:50}, pop:1, time:17, age:3, tags:['ranged'], civ:'china', burst:3 },
  centurion:{ name:'Centurion', hp:115, atk:13, range:1,   speed:0.95, cd:1.3, armor:2, los:7,
              cost:{food:90,gold:80,iron:20}, pop:1, time:24, age:3, tags:['infantry'], civ:'rome',
              aura:4, limit:3 },
  elephant: { name:'War Elephant', hp:270, atk:16, range:1, speed:0.72, cd:1.8, armor:3, los:6,
              cost:{food:120,gold:80,iron:30}, pop:2, time:30, age:3, tags:['elephant'], civ:'india',
              splash:1.0, big:true },
  catapult: { name:'Catapult',  hp:85,  atk:14, range:6.2, speed:0.62, cd:3.4, armor:0, los:8,
              cost:{wood:120,gold:80,iron:40}, pop:2, time:30, age:3, tags:['siege'],
              bonusVs:{building:4}, splash:0.9, minRange:1.6, big:true },
  trader:   { name:'Trader',    hp:40,  atk:0,  range:1,   speed:0.8,  cd:2,   armor:0, los:4,
              cost:{}, pop:0, time:0, age:1, tags:['civilian'], civilian:true, npc:true },
  cart:     { name:'Ox Cart',   hp:110, atk:0,  range:1,   speed:1.05, cd:2,   armor:1, los:4,
              cost:{}, pop:0, time:0, age:1, tags:['civilian'], civilian:true, cart:true, big:true },
  /* ---- wild animals (gaia, huntable for food) ---- */
  deer:     { name:'Deer',      hp:45,  atk:0,  range:1,   speed:0.8,  cd:2,   armor:0, los:8,
              cost:{}, pop:0, time:0, age:1, tags:['animal'], civilian:true, npc:true,
              animal:true, flee:true, meat:160, big:true },
  boar:     { name:'Wild Boar', hp:120, atk:7,  range:1,   speed:1.15, cd:1.4, armor:1, los:6,
              cost:{}, pop:0, time:0, age:1, tags:['animal'], npc:true,
              animal:true, retaliate:true, meat:360, big:true },
  wolf:     { name:'Wolf',      hp:70,  atk:9,  range:1,   speed:1.3,  cd:1.4, armor:0, los:8,
              cost:{}, pop:0, time:0, age:1, tags:['animal'], npc:true,
              animal:true, retaliate:true, aggressive:true, meat:80, big:true },
  sheep:    { name:'Sheep',     hp:30,  atk:0,  range:1,   speed:0.65, cd:2,   armor:0, los:5,
              cost:{}, pop:0, time:0, age:1, tags:['animal'], civilian:true, npc:true,
              animal:true, meat:130, big:true },
  /* ---- ships (Phase 2: naval) ---- */
  fishboat: { name:'Fishing Boat', hp:45, atk:0, range:1, speed:1.15, cd:2, armor:0, los:6,
              cost:{wood:40}, pop:1, time:18, age:1, tags:['ship','civilian'], civilian:true,
              naval:true, big:true, carry:15 },
  transport:{ name:'Transport Ship', hp:140, atk:0, range:1, speed:1.3, cd:2, armor:2, los:6,
              cost:{wood:80}, pop:1, time:22, age:2, tags:['ship','civilian'], civilian:true,
              naval:true, big:true, capacity:5 },
  galley:   { name:'War Galley', hp:115, atk:8, range:5, speed:1.25, cd:1.9, armor:0, los:8,
              cost:{wood:90,gold:30}, pop:1, time:24, age:2, tags:['ship','ranged'], naval:true, big:true },
  quinquereme:{ name:'Quinquereme', hp:210, atk:13, range:5, speed:1.0, cd:2.0, armor:2, los:8,
              cost:{wood:140,gold:60,iron:20}, pop:2, time:30, age:3, tags:['ship','ranged'],
              civ:'rome', naval:true, big:true },
  fireship: { name:'Fire Ship', hp:90, atk:48, range:1, speed:1.6, cd:1, armor:0, los:6,
              cost:{wood:70,gold:40}, pop:1, time:20, age:3, tags:['ship'], civ:'china',
              naval:true, big:true, suicide:true, splash:1.3, bonusVs:{ship:1.5} },
  catamaran:{ name:'War Catamaran', hp:70, atk:6, range:4, speed:1.7, cd:1.6, armor:0, los:7,
              cost:{wood:55,gold:15}, pop:1, time:16, age:2, tags:['ship','ranged'], civ:'india',
              naval:true, big:true },
};

/* ---------- Buildings ---------- */
const BUILDINGS = {
  tc:       { name:'Town Center', hp:1700, size:3, los:8, cost:null, dropoff:true,
              trains:['settler','scout'], desc:'Trains settlers & scouts. Researches Ages.' },
  town:     { name:'Town', hp:1300, size:3, los:7, cost:null, dropoff:true, capturable:true,
              desc:'Capture to gain +10 population.' },
  storehouse:{ name:'Storehouse', hp:600, size:1, los:4, cost:{wood:70}, buildTime:16, age:1,
              dropoff:true, store:true, cap:160,
              desc:'Drop-off near forests, mines & quarries — no long walk to Town Center. Ox carts haul stored goods home (resources dip in transit, restored on arrival).' },
  farm:     { name:'Farm', hp:120, size:2, los:2, cost:{wood:45}, buildTime:18, age:1,
              farm:true, desc:'Infinite food — needs water within 3 tiles, or a flowing canal.' },
  canal:    { name:'Canal', hp:150, size:1, los:2, cost:{wood:15}, buildTime:7, age:1,
              canal:true, drag:true, desc:'Carries water from lakes/rivers to farms. If the chain is cut, farms dry up. Drag to lay a line.' },
  wall:     { name:'Stone Wall', hp:850, size:1, los:2, cost:{stone:15}, buildTime:9, age:2,
              wall:true, drag:true, garrison:2,
              desc:'Drag to build lines. Blocks movement & vision. Garrison archers inside to fire out (+25% attack). Roman walls have arrow slits — their archers are untouchable.' },
  barracks: { name:'Barracks', hp:850, size:2, los:5, cost:{wood:150}, buildTime:34, age:1,
              trains:['spearman','sword','legionary','chariot','centurion','elephant','catapult'],
              desc:'Trains melee, beasts & siege.' },
  range:    { name:'Archery Range', hp:750, size:2, los:5, cost:{wood:140}, buildTime:32, age:2,
              trains:['archer','chukonu'], desc:'Trains ranged units.' },
  university:{ name:'University', hp:750, size:2, los:5, cost:{wood:160,gold:60}, buildTime:38, age:2,
              techs:true, desc:'Spend Knowledge on technology.' },
  grounds:  { name:'Training Grounds', hp:650, size:2, los:4, cost:{wood:120}, buildTime:30, age:2,
              aura:4.5, desc:'Drills nearby units — they gain XP over time.' },
  tower:    { name:'Watchtower', hp:520, size:1, los:9, cost:{stone:110}, buildTime:28, age:2,
              atk:9, range:6.5, cd:2.0, desc:'Defensive tower. Long sight.' },
  dock:     { name:'Dock', hp:900, size:2, los:7, cost:{wood:120}, buildTime:30, age:1,
              naval:true, dropoff:true,
              trains:['fishboat','transport','galley','quinquereme','fireship','catamaran'],
              desc:'Builds ships. Place on shallow water at the shore. Fish drop-off.' },
};

/* ---------- Technologies (University) ---------- */
const TECHS = {
  bronzeBlades:{ name:'Bronze Blades', cost:{knowledge:60, gold:100}, age:2, time:25,
    desc:'+1 melee attack', apply:p=>p.bonus.meleeAtk+=1 },
  ironBlades:{ name:'Iron Blades', cost:{knowledge:110, gold:150, iron:80}, age:3, time:30,
    req:'bronzeBlades', desc:'+2 melee attack', apply:p=>p.bonus.meleeAtk+=2 },
  wootz:{ name:'Wootz Steel', cost:{knowledge:160, gold:200, iron:150}, age:4, time:38, civ:'india',
    req:'ironBlades', desc:'+3 melee attack (Indian legend)', apply:p=>p.bonus.meleeAtk+=3 },
  fletching:{ name:'Fletching', cost:{knowledge:60, gold:100}, age:2, time:25,
    desc:'+1 ranged attack, +0.5 range', apply:p=>{p.bonus.rangedAtk+=1; p.bonus.range+=0.5;} },
  bodkin:{ name:'Bodkin Arrows', cost:{knowledge:110, gold:160, iron:60}, age:3, time:30,
    req:'fletching', desc:'+2 ranged attack, +0.5 range', apply:p=>{p.bonus.rangedAtk+=2; p.bonus.range+=0.5;} },
  leather:{ name:'Leather Armor', cost:{knowledge:50, gold:80}, age:2, time:22,
    desc:'+1 armor (all units)', apply:p=>p.bonus.armor+=1 },
  scale:{ name:'Scale Armor', cost:{knowledge:100, gold:140, iron:70}, age:3, time:30,
    req:'leather', desc:'+1 more armor', apply:p=>p.bonus.armor+=1 },
  plate:{ name:'Plate Armor', cost:{knowledge:170, gold:220, iron:160}, age:4, time:38,
    req:'scale', desc:'+1 more armor', apply:p=>p.bonus.armor+=1 },
  masonry:{ name:'Masonry', cost:{knowledge:70, wood:120}, age:2, time:28,
    desc:'Buildings +30% HP', apply:p=>p.bonus.bldHp*=1.3 },
  architecture:{ name:'Architecture', cost:{knowledge:130, stone:150}, age:3, time:34,
    req:'masonry', desc:'Buildings +30% more HP', apply:p=>p.bonus.bldHp*=1.3 },
  wheelbarrow:{ name:'Wheelbarrow', cost:{knowledge:50, wood:80}, age:2, time:25,
    desc:'Settlers gather 15% faster', apply:p=>p.bonus.gather*=1.15 },
  ironTools:{ name:'Iron Tools', cost:{knowledge:110, iron:90}, age:3, time:30,
    req:'wheelbarrow', desc:'Settlers gather 20% more', apply:p=>p.bonus.gather*=1.2 },
  medicine:{ name:'Medicine', cost:{knowledge:90, gold:100}, age:3, time:28,
    desc:'Units regenerate near Town Centers', apply:p=>p.bonus.tcHeal=true },
  greekfire:{ name:'Greek Fire', cost:{knowledge:200, gold:250, iron:120}, age:4, time:40, civ:'rome',
    desc:'Catapults & towers set targets ablaze', apply:p=>p.bonus.greekFire=true },
  poisonwells:{ name:'Poison Wells', cost:{knowledge:120, gold:120}, age:3, time:30,
    desc:'Scouts can poison enemy water sources — their troops sicken', apply:p=>p.bonus.poison=true },
};

/* ---------- Helpers ---------- */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by);
const dist2=(ax,ay,bx,by)=>{const dx=ax-bx,dy=ay-by;return dx*dx+dy*dy;};

// Seeded PRNG (mulberry32)
function RNG(seed){ let s=seed>>>0; return function(){ s|=0; s=(s+0x6D2B79F5)|0;
  let t=Math.imul(s^(s>>>15),1|s); t=(t+Math.imul(t^(t>>>7),61|t))^t;
  return ((t^(t>>>14))>>>0)/4294967296; }; }

const PLAYER_COLORS = [
  { main:'#3d7ddb', dark:'#244e92', light:'#7daef0', name:'Blue' },
  { main:'#cc3b2e', dark:'#84231a', light:'#ef7e6d', name:'Red' },
  { main:'#3fa345', dark:'#256328', light:'#7fd083', name:'Green' },
];
const GAIA_COLOR = { main:'#8f8a7e', dark:'#57534a', light:'#c2bcae', name:'Neutral' };

function costStr(c){ if(!c) return ''; return Object.entries(c).map(([k,v])=>`${v} ${k[0].toUpperCase()+k.slice(1,4)}`).join(' '); }
