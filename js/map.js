/* ============ CONQUERORS — world gen, terrain chunks, fog of war ============ */
'use strict';

const World = (() => {
  const N = CFG.MAP, CH = CFG.CHUNK, NCH = N / CH;

  const W = {
    ter: new Uint8Array(N * N),
    blocked: new Uint8Array(N * N),     // land-unit passability: static + buildings (not units)
    navBlocked: new Uint8Array(N * N),  // ship passability: land = blocked, open water = free
    sightBlock: new Uint8Array(N * N),  // vision blockers: trees, tall buildings (walls later)
    vis: new Uint8Array(N * N),         // 0 unexplored 1 explored 2 visible (human player)
    objects: [],                        // resource nodes & decorations
    objGrid: new Int32Array(N * N),     // object id+1 at tile
    starts: [], towns: [], ruins: [],
    chunks: new Array(NCH * NCH).fill(null),
    minimapBase: null,
    fogDirty: true,
  };

  const idx = (x, y) => y * N + x;
  const inB = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  const isoX = (x, y) => (x - y) * 32;
  const isoY = (x, y) => (x + y) * 16;

  /* ---------------- value noise ---------------- */
  function makeNoise(rnd, scale) {
    const S = 36;
    const grid = new Float32Array((S + 1) * (S + 1));
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    return (x, y) => {
      const fx = (x / scale) % S, fy = (y / scale) % S;
      const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = grid[y0 * (S + 1) + x0], b = grid[y0 * (S + 1) + x0 + 1];
      const c = grid[(y0 + 1) * (S + 1) + x0], d = grid[(y0 + 1) * (S + 1) + x0 + 1];
      return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
    };
  }

  /* ---------------- generation ---------------- */
  function gen(seed) {
    const rnd = RNG(seed);
    const n1 = makeNoise(rnd, 13), n2 = makeNoise(rnd, 6), nf = makeNoise(rnd, 5), nd = makeNoise(rnd, 9),
          nh = makeNoise(rnd, 7); // highlands

    // player starts: triangle around center (kept clear of the wide border ocean)
    const cx = N / 2, cy = N / 2, R = N * 0.31;
    const a0 = rnd() * Math.PI * 2;
    W.starts = [];
    for (let i = 0; i < 3; i++) {
      const a = a0 + i * Math.PI * 2 / 3;
      W.starts.push({ x: Math.round(cx + Math.cos(a) * R), y: Math.round(cy + Math.sin(a) * R) });
    }
    // neutral towns: 3 mid-ring (between starts), 1 center, 3 outer
    W.towns = [{ x: cx | 0, y: cy | 0 }];
    for (let i = 0; i < 3; i++) {
      const a = a0 + (i + 0.5) * Math.PI * 2 / 3;
      W.towns.push({ x: Math.round(cx + Math.cos(a) * R * 0.55), y: Math.round(cy + Math.sin(a) * R * 0.55) });
      W.towns.push({ x: Math.round(cx + Math.cos(a) * R * 1.18), y: Math.round(cy + Math.sin(a) * R * 1.18) });
    }
    for (const t of W.towns) { t.x = clamp(t.x, 6, N - 9); t.y = clamp(t.y, 6, N - 9); }

    // terrain from noise + guaranteed land at key sites
    const landBoost = (x, y) => {
      let b = 0;
      for (const s of W.starts) { const d = dist(x, y, s.x, s.y); if (d < 10) b = Math.max(b, (10 - d) * .055); }
      for (const t of W.towns) { const d = dist(x, y, t.x, t.y); if (d < 7) b = Math.max(b, (7 - d) * .06); }
      return b;
    };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      // ocean falloff at borders (wide enough that island towns always fit)
      const ex = Math.min(x, N - 1 - x), ey = Math.min(y, N - 1 - y);
      const edge = Math.min(1, Math.min(ex, ey) / 12);
      let h = n1(x, y) * 0.62 + n2(x, y) * 0.38;
      h = h * edge + landBoost(x, y);
      let t;
      if (h < 0.30) t = TERRAIN.DEEP;
      else if (h < 0.365) t = TERRAIN.SHALLOW;
      else if (h < 0.40) t = TERRAIN.SAND;
      else t = nd(x, y) > 0.72 ? TERRAIN.DIRT : TERRAIN.GRASS;
      // highlands: defensive high ground (walkable, combat bonuses)
      if (t === TERRAIN.GRASS && nh(x, y) > 0.80) t = TERRAIN.HILL;
      W.ter[idx(x, y)] = t;
      if (t <= TERRAIN.SHALLOW) W.blocked[idx(x, y)] = 1;
    }

    /* guarantee a pond near every start so irrigation farming is always possible */
    function ensurePond(sx, sy) {
      for (let y = Math.max(0, sy - 12); y <= Math.min(N - 1, sy + 12); y++)
        for (let x = Math.max(0, sx - 12); x <= Math.min(N - 1, sx + 12); x++)
          if (W.ter[idx(x, y)] <= TERRAIN.SHALLOW) return; // water already nearby
      for (let tries = 0; tries < 24; tries++) {
        const a = rnd() * Math.PI * 2;
        const px = Math.round(sx + Math.cos(a) * 9), py = Math.round(sy + Math.sin(a) * 9);
        if (px < 4 || py < 4 || px > N - 5 || py > N - 5) continue;
        if (W.towns.some(t => dist(px, py, t.x, t.y) < 6)) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const d = Math.hypot(dx, dy * 1.4);
          if (d > 2.2) continue;
          const i = idx(px + dx, py + dy);
          W.ter[i] = d < 1 ? TERRAIN.DEEP : TERRAIN.SHALLOW;
          W.blocked[i] = 1;
        }
        // sandy rim
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const d = Math.hypot(dx, dy * 1.4);
          if (d > 2.2 && d <= 3.1) { const i = idx(px + dx, py + dy);
            if (W.ter[i] > TERRAIN.SHALLOW) W.ter[i] = TERRAIN.SAND; }
        }
        return;
      }
    }
    for (const s of W.starts) ensurePond(s.x, s.y);

    /* objects */
    W.objects = []; W.objGrid.fill(0); W.sightBlock.fill(0);
    const free = (x, y) => inB(x, y) && !W.blocked[idx(x, y)] && !W.objGrid[idx(x, y)] && W.ter[idx(x, y)] >= TERRAIN.SAND;
    function addObj(kind, x, y, amount) {
      if (!free(x, y)) return false;
      const o = { id: W.objects.length, kind, x, y, amount, variant: (x * 7 + y * 13) % 4, alive: true };
      W.objects.push(o);
      W.objGrid[idx(x, y)] = o.id + 1;
      if (kind === 'tree' || kind === 'gold' || kind === 'stone' || kind === 'iron') W.blocked[idx(x, y)] = 1;
      if (kind === 'tree') W.sightBlock[idx(x, y)] = 1; // forests hide what's behind them
      return true;
    }
    const nearSite = (x, y, r) =>
      W.starts.some(s => dist(x, y, s.x, s.y) < r) || W.towns.some(t => dist(x, y, t.x, t.y) < r);

    // forests
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      if (W.ter[idx(x, y)] !== TERRAIN.GRASS) continue;
      if (nearSite(x, y, 6)) continue;
      const f = nf(x, y);
      if (f > 0.66 && rnd() < 0.75) addObj('tree', x, y, 120);
    }
    // cluster helper
    function cluster(kind, cx, cy, count, spread, amount) {
      let placed = 0, guard = 0;
      while (placed < count && guard++ < 60) {
        const a = rnd() * Math.PI * 2, r = rnd() * spread;
        const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
        if (addObj(kind, x, y, amount)) placed++;
      }
    }
    // per-start guaranteed economy (generous — AI and player both live off this)
    for (const s of W.starts) {
      cluster('bush', s.x + (rnd() < .5 ? -6 : 6), s.y + (rnd() < .5 ? -5 : 5), 8, 2.5, 150);
      cluster('bush', s.x + (rnd() < .5 ? -5 : 5), s.y + (rnd() < .5 ? 7 : -7), 5, 2.2, 150);
      cluster('tree', s.x + (rnd() < .5 ? -9 : 9), s.y + (rnd() < .5 ? 8 : -8), 18, 4.5, 120);
      cluster('tree', s.x + (rnd() < .5 ? -7 : 7), s.y + (rnd() < .5 ? -9 : 9), 10, 3.5, 120);
      cluster('gold', s.x + (rnd() < .5 ? -8 : 8), s.y + (rnd() < .5 ? -8 : 8), 5, 2.2, 600);
      cluster('stone', s.x + (rnd() < .5 ? -11 : 11), s.y, 4, 2.2, 500);
      cluster('iron', s.x, s.y + (rnd() < .5 ? -11 : 11), 4, 2.2, 450);
    }
    // scattered wealth + near towns
    for (const t of W.towns) {
      cluster(rnd() < .5 ? 'gold' : 'iron', t.x + 5, t.y - 5, 3, 2, 500);
      cluster('bush', t.x - 5, t.y + 5, 4, 2, 150);
    }
    for (let i = 0; i < 14; i++) {
      const x = 6 + (rnd() * (N - 12)) | 0, y = 6 + (rnd() * (N - 12)) | 0;
      if (nearSite(x, y, 8)) continue;
      cluster(['gold', 'stone', 'iron', 'bush'][i % 4], x, y, 4, 2.2, 500);
    }
    /* ---- connectivity: carve corridors so every start & town is reachable ----
       (clears trees/rocks, turns water into sand fords along jittered lines) */
    function carve(x0, y0, x1, y1) {
      const steps = Math.ceil(dist(x0, y0, x1, y1) * 2);
      let jx = 0, jy = 0;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        jx = clamp(jx + (rnd() - .5) * 1.2, -2.5, 2.5);
        jy = clamp(jy + (rnd() - .5) * 1.2, -2.5, 2.5);
        const cx2 = Math.round(lerp(x0, x1, t) + jx), cy2 = Math.round(lerp(y0, y1, t) + jy);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = cx2 + dx, y = cy2 + dy;
          if (!inB(x, y)) continue;
          const i = idx(x, y);
          if (W.ter[i] <= TERRAIN.SHALLOW) { W.ter[i] = TERRAIN.SAND; W.blocked[i] = 0; } // ford
          const oid = W.objGrid[i];
          if (oid) {
            const o = W.objects[oid - 1];
            if (o.kind === 'tree' || o.kind === 'gold' || o.kind === 'stone' || o.kind === 'iron') removeObj(o);
          }
        }
      }
    }
    const hub = W.towns[0]; // center town
    for (const s of W.starts) carve(s.x, s.y, hub.x, hub.y);
    for (let ti = 1; ti < W.towns.length; ti++) carve(W.towns[ti].x, W.towns[ti].y, hub.x, hub.y);

    /* ---- island towns: conquest objectives reachable only by sea ----
       (added AFTER carve() so no land corridor is cut to them) */
    W.islands = [];
    {
      // candidate centers: an 11x11 all-water box (keeps a sea moat around the island)
      const allWater = (cx2, cy2, r) => {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const x = cx2 + dx, y = cy2 + dy;
          if (!inB(x, y) || W.ter[idx(x, y)] > TERRAIN.SHALLOW) return false;
        }
        return true;
      };
      const cands = [];
      for (const rad of [5, 4]) { // prefer roomy seas, settle for snug ones
        for (let y = 6; y <= N - 6; y++) for (let x = 6; x <= N - 6; x++)
          if (allWater(x, y, rad)) {
            let sd = 1e9;
            for (const s of W.starts) sd = Math.min(sd, dist2(x, y, s.x, s.y));
            cands.push([x, y, sd]);
          }
        if (cands.length) break;
      }
      if (!cands.length) {
        // rare land-heavy seed: dredge a sea at the wettest corner, far from towns
        const corners = [[12, 12], [N - 13, 12], [12, N - 13], [N - 13, N - 13]]
          .filter(([x, y]) => !W.towns.some(t => dist(x, y, t.x, t.y) < 10) &&
                              !W.starts.some(s => dist(x, y, s.x, s.y) < 14));
        let best = corners[0], bw = -1;
        for (const [x, y] of corners) {
          let w2 = 0;
          for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++)
            if (W.ter[idx(x + dx, y + dy)] <= TERRAIN.SHALLOW) w2++;
          if (w2 > bw) { bw = w2; best = [x, y]; }
        }
        if (best) {
          const [x, y] = best;
          for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
            const d = Math.hypot(dx, dy);
            if (d > 5.4) continue;
            const i = idx(x + dx, y + dy);
            if (W.objGrid[i]) removeObj(W.objects[W.objGrid[i] - 1]);
            W.ter[i] = d > 4.4 ? TERRAIN.SHALLOW : TERRAIN.DEEP;
            W.blocked[i] = 1;
          }
          cands.push([x, y, 0]);
        }
      }
      cands.sort((a, b) => b[2] - a[2]); // farthest from player starts first
      for (const [ix2, iy2] of cands) {
        if (W.islands.length >= 2) break;
        if (W.islands.some(t => dist(ix2, iy2, t.x + 1, t.y + 1) < 26)) continue;
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > 4) continue;
          const i = idx(ix2 + dx, iy2 + dy);
          if (W.objGrid[i]) removeObj(W.objects[W.objGrid[i] - 1]);
          if (d <= 3) { W.ter[i] = TERRAIN.GRASS; W.blocked[i] = 0; }
          else if (W.ter[i] <= TERRAIN.SHALLOW) { W.ter[i] = TERRAIN.SAND; W.blocked[i] = 0; }
        }
        const town = { x: ix2, y: iy2, island: true }; // center tile, like mainland towns
        W.towns.push(town); W.islands.push(town);
        cluster('gold', ix2 - 2, iy2 + 2, 2, 1.4, 600); // island treasure
      }
    }

    // ruins (knowledge pickups)
    W.ruins = [];
    let placedRuins = 0, guard = 0;
    while (placedRuins < 8 && guard++ < 200) {
      const x = 8 + (rnd() * (N - 16)) | 0, y = 8 + (rnd() * (N - 16)) | 0;
      if (nearSite(x, y, 10) || !free(x, y)) continue;
      const o = { id: W.objects.length, kind: 'ruin', x, y, amount: 40, variant: 0, alive: true };
      W.objects.push(o); W.objGrid[idx(x, y)] = o.id + 1;
      W.ruins.push(o); placedRuins++;
    }
    /* label connected water regions (flood fill) so fish/docks only use
       real seas & lakes, not landlocked puddles */
    W.waterRegion = new Int32Array(N * N);   // 0 = land, else region id
    W.regionSizes = [0];
    {
      let rid = 0;
      const stack = [];
      for (let i = 0; i < N * N; i++) {
        if (W.ter[i] > TERRAIN.SHALLOW || W.waterRegion[i]) continue;
        rid++; let size = 0;
        stack.push(i); W.waterRegion[i] = rid;
        while (stack.length) {
          const j = stack.pop(); size++;
          const jx = j % N, jy = (j / N) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = jx + dx, ny = jy + dy;
            if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
            const k = ny * N + nx;
            if (W.ter[k] <= TERRAIN.SHALLOW && !W.waterRegion[k]) { W.waterRegion[k] = rid; stack.push(k); }
          }
        }
        W.regionSizes[rid] = size;
      }
    }
    const openWater = (x, y) => W.regionSizes[W.waterRegion[idx(x, y)]] >= 60;

    // fish shoals — gathered by fishing boats (major food source on the coast)
    function addFish(x, y) {
      if (!inB(x, y) || W.objGrid[idx(x, y)] || W.ter[idx(x, y)] > TERRAIN.SHALLOW) return false;
      if (!openWater(x, y)) return false; // no fish worth boats in tiny ponds
      const o = { id: W.objects.length, kind: 'fish', x, y, amount: 400, variant: 0, alive: true };
      W.objects.push(o); W.objGrid[idx(x, y)] = o.id + 1;
      return true;
    }
    let fishPlaced = 0, fGuard = 0;
    while (fishPlaced < 30 && fGuard++ < 800) {
      const x = (rnd() * N) | 0, y = (rnd() * N) | 0;
      if (addFish(x, y)) fishPlaced++;
    }
    for (const t of W.islands) // rich waters around island towns
      for (let i = 0; i < 4; i++) {
        const a = rnd() * Math.PI * 2;
        addFish(Math.round(t.x + 1 + Math.cos(a) * 6), Math.round(t.y + 1 + Math.sin(a) * 6));
      }

    /* ---- decorative doodads: nature, not gameplay ---- */
    function addDoodad(kind, x, y, variant) {
      if (!inB(x, y) || W.objGrid[idx(x, y)] || W.blocked[idx(x, y)]) return false;
      W.objects.push({ id: W.objects.length, kind, x, y, amount: 0,
                       variant: variant | 0, alive: true, doodad: true });
      return true;
    }
    const terIs = (x, y, t) => inB(x, y) && W.ter[idx(x, y)] === t;
    const nearWaterT = (x, y) => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
        if (inB(x + dx, y + dy) && W.ter[idx(x + dx, y + dy)] <= TERRAIN.SHALLOW) return true;
      return false;
    };
    // sweep every tile once; each biome rolls for its own decoration
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      const t = W.ter[idx(x, y)];
      if (t === TERRAIN.GRASS) { if (rnd() < 0.02) addDoodad('flower', x, y, rnd() * 4); }
      else if (t === TERRAIN.DIRT || t === TERRAIN.HILL) { if (rnd() < 0.035) addDoodad('rock', x, y, rnd() * 2); }
      else if (t === TERRAIN.SAND && nearWaterT(x, y)) {
        const r = rnd();
        if (r < 0.055) addDoodad('reed', x, y, rnd() * 2);
        else if (r < 0.10) addDoodad('palm', x, y, 0);
      }
    }
    let mush = 0;
    for (let i = 0; i < 600 && mush < 45; i++) { // mushrooms at the feet of trees
      const x = (rnd() * N) | 0, y = (rnd() * N) | 0;
      if (!terIs(x, y, TERRAIN.GRASS)) continue;
      let byTree = false;
      for (let dy = -1; dy <= 1 && !byTree; dy++) for (let dx = -1; dx <= 1; dx++) {
        const o = objAt(x + dx, y + dy);
        if (o && o.alive && o.kind === 'tree') { byTree = true; break; }
      }
      if (byTree && addDoodad('mushroom', x, y, 0)) mush++;
    }

    // ship passability: anything that's not water is a wall for ships
    for (let i = 0; i < N * N; i++) W.navBlocked[i] = W.ter[i] <= TERRAIN.SHALLOW ? 0 : 1;

    W.vis.fill(0);
    W.chunks.fill(null);
    bakeMinimapBase();
    W.fogDirty = true;
  }

  function removeObj(o) {
    o.alive = false;
    W.objGrid[idx(o.x, o.y)] = 0;
    if (o.kind === 'tree' || o.kind === 'gold' || o.kind === 'stone' || o.kind === 'iron') W.blocked[idx(o.x, o.y)] = 0;
    if (o.kind === 'tree') W.sightBlock[idx(o.x, o.y)] = 0;
  }

  function objAt(x, y) {
    if (!inB(x, y)) return null;
    const id = W.objGrid[idx(x, y)];
    return id ? W.objects[id - 1] : null;
  }

  /* nearest living resource of kind near (x,y) within maxR */
  function nearestObj(kind, x, y, maxR = 18) {
    let best = null, bd = maxR * maxR;
    for (const o of W.objects) {
      if (!o.alive || o.kind !== kind) continue;
      const d = dist2(x, y, o.x + .5, o.y + .5);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  /* ---------------- terrain chunks ---------------- */
  function chunkCanvas(ci) {
    let ch = W.chunks[ci];
    if (ch) return ch;
    const cgx = ci % NCH, cgy = (ci / NCH) | 0;
    const x0 = cgx * CH, y0 = cgy * CH;
    const ox = isoX(x0, y0 + CH - 1) - 32;
    const oy = isoY(x0, y0);
    const cv = document.createElement('canvas');
    cv.width = CH * 64; cv.height = CH * 32 + 16;
    const g = cv.getContext('2d');
    for (let y = y0; y < y0 + CH; y++) for (let x = x0; x < x0 + CH; x++) {
      const t = W.ter[idx(x, y)];
      g.drawImage(Sprites.tile(t, (x * 31 + y * 17 + ((x * x + y) >> 2)) % 6), isoX(x, y) - 32 - ox, isoY(x, y) - oy);
    }
    // soft blending where two LAND terrains meet (kills the patchwork look)
    const BLEND = { 2: 'rgba(205,178,121,.30)', 3: 'rgba(88,138,60,.30)', 4: 'rgba(138,113,72,.30)', 5: 'rgba(147,160,90,.30)' };
    g.lineCap = 'round';
    for (let y = y0; y < y0 + CH; y++) for (let x = x0; x < x0 + CH; x++) {
      const t = W.ter[idx(x, y)];
      if (t < TERRAIN.SAND) continue;
      const tx2 = isoX(x, y) - ox, ty2 = isoY(x, y) - oy;
      // down-facing edges only (each boundary drawn once)
      for (const [nx, ny, ex0, ey0, ex1, ey1] of [
        [x + 1, y, tx2 + 32, ty2 + 16, tx2, ty2 + 32],   // SE edge
        [x, y + 1, tx2, ty2 + 32, tx2 - 32, ty2 + 16]]) { // SW edge
        if (!inB(nx, ny)) continue;
        const nt = W.ter[idx(nx, ny)];
        if (nt < TERRAIN.SAND || nt === t) continue;
        g.strokeStyle = BLEND[t]; g.lineWidth = 7;
        g.beginPath(); g.moveTo(ex0, ey0); g.lineTo(ex1, ey1); g.stroke();
      }
    }
    // coastline foam: white edge where shallow water meets land
    g.lineCap = 'round';
    const land = (xx, yy) => inB(xx, yy) && W.ter[idx(xx, yy)] >= TERRAIN.SAND;
    for (let y = y0; y < y0 + CH; y++) for (let x = x0; x < x0 + CH; x++) {
      if (W.ter[idx(x, y)] !== TERRAIN.SHALLOW) continue;
      const tx = isoX(x, y) - ox, ty = isoY(x, y) - oy; // diamond top corner
      const edges = [];
      if (land(x + 1, y)) edges.push([[tx + 32, ty + 16], [tx, ty + 32]]); // SE
      if (land(x, y + 1)) edges.push([[tx, ty + 32], [tx - 32, ty + 16]]); // SW
      if (land(x - 1, y)) edges.push([[tx - 32, ty + 16], [tx, ty]]);      // NW
      if (land(x, y - 1)) edges.push([[tx, ty], [tx + 32, ty + 16]]);      // NE
      for (const [[ax2, ay2], [bx2, by2]] of edges) {
        const mx = (ax2 + bx2) / 2, my = (ay2 + by2) / 2;
        // push the wavy midpoint slightly toward the water side (tile center)
        const wx2 = mx + (tx - mx) * 0.18, wy2 = my + (ty + 16 - my) * 0.18;
        g.strokeStyle = 'rgba(235,248,255,.55)'; g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(ax2, ay2); g.quadraticCurveTo(wx2, wy2, bx2, by2); g.stroke();
        g.strokeStyle = 'rgba(190,225,245,.30)'; g.lineWidth = 4.5;
        g.beginPath(); g.moveTo(ax2, ay2); g.quadraticCurveTo(wx2, wy2, bx2, by2); g.stroke();
      }
    }
    ch = { cv, ox, oy };
    W.chunks[ci] = ch;
    return ch;
  }

  /* draw visible terrain chunks. cam = {x, y, zoom}; canvas w,h */
  function drawTerrain(g, cam, w, h) {
    const z = cam.zoom;
    const left = cam.x - w / 2 / z, top = cam.y - h / 2 / z;
    const right = cam.x + w / 2 / z, bottom = cam.y + h / 2 / z;
    for (let ci = 0; ci < NCH * NCH; ci++) {
      const cgx = ci % NCH, cgy = (ci / NCH) | 0;
      const x0 = cgx * CH, y0 = cgy * CH;
      const ox = isoX(x0, y0 + CH - 1) - 32, oy = isoY(x0, y0);
      const cw = CH * 64, chh = CH * 32 + 16;
      if (ox > right || ox + cw < left || oy > bottom || oy + chh < top) continue;
      const ch = chunkCanvas(ci);
      g.drawImage(ch.cv, (ox - left) * z, (oy - top) * z, cw * z, chh * z);
    }
  }

  /* ---------------- fog of war ---------------- */
  // fog is rendered into a tiny N x N canvas (1px per tile), then drawn with an
  // affine transform that maps each pixel square exactly onto its iso diamond.
  const fogCv = document.createElement('canvas');
  fogCv.width = N; fogCv.height = N;
  const fogG = fogCv.getContext('2d');
  const fogImg = fogG.createImageData(N, N);

  function updateFogCanvas() {
    const d = fogImg.data;
    for (let i = 0; i < N * N; i++) {
      const v = W.vis[i];
      const o = i * 4;
      d[o] = 8; d[o + 1] = 6; d[o + 2] = 12;
      d[o + 3] = v === 0 ? 255 : v === 1 ? 105 : 0;
    }
    fogG.putImageData(fogImg, 0, 0);
    W.fogDirty = false;
  }

  /* line-of-sight raycast: vision stops at the first obstacle on each ray.
     Trees, tall buildings (and future walls) block; hills block unless the
     viewer is elevated (standing on a hill, or is a tower). */
  function castLight(ex, ey, r, elevated, selfRect) {
    const r2 = r * r;
    const sx = ex | 0, sy = ey | 0;
    if (inB(sx, sy)) W.vis[idx(sx, sy)] = 2;
    const x0 = (ex - r) | 0, x1 = (ex + r) | 0;
    const y0 = (ey - r) | 0, y1 = (ey + r) | 0;
    // rays to every perimeter tile of the LOS square
    for (let px = x0; px <= x1; px++) for (let py = y0; py <= y1; py += (px === x0 || px === x1) ? 1 : (y1 - y0)) {
      const dx = px + .5 - ex, dy = py + .5 - ey;
      const steps = Math.ceil(Math.hypot(dx, dy) / 0.45);
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const x = (ex + dx * t) | 0, y = (ey + dy * t) | 0;
        if (!inB(x, y)) break;
        if (dist2(x + .5, y + .5, ex, ey) > r2) break;
        const i = idx(x, y);
        W.vis[i] = 2; // you see the obstacle itself — just not past it
        const own = selfRect && x >= selfRect.x && x < selfRect.x + selfRect.s &&
                    y >= selfRect.y && y < selfRect.y + selfRect.s;
        if (own) continue;
        if (W.sightBlock[i]) break;
        if (!elevated && W.ter[i] === TERRAIN.HILL) break;
      }
    }
  }

  function recomputeFog(entities, humanId) {
    // downgrade visible -> explored
    for (let i = 0; i < W.vis.length; i++) if (W.vis[i] === 2) W.vis[i] = 1;
    for (const e of entities) {
      if (e.owner !== humanId || e.dead || e.inShip || e.inWall) continue;
      const r = e.los || 5;
      const elevated = e.type === 'tower' ||
        terAt(e.cx(), e.cy()) === TERRAIN.HILL; // high ground sees over hills
      const selfRect = e.kind === 'bld' ? { x: e.x, y: e.y, s: e.size } : null;
      castLight(e.cx(), e.cy(), r, elevated, selfRect);
    }
    W.fogDirty = true;
  }
  const visAt = (x, y) => inB(x | 0, y | 0) ? W.vis[idx(x | 0, y | 0)] : 0;
  const terAt = (x, y) => inB(x | 0, y | 0) ? W.ter[idx(x | 0, y | 0)] : -1;

  /* mark a circle as explored (merchant intel) without granting live vision */
  function explore(cx2, cy2, r) {
    const x0 = Math.max(0, (cx2 - r) | 0), x1 = Math.min(N - 1, (cx2 + r) | 0);
    const y0 = Math.max(0, (cy2 - r) | 0), y1 = Math.min(N - 1, (cy2 + r) | 0);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (W.vis[idx(x, y)] === 0 && dist2(x, y, cx2, cy2) <= r * r) W.vis[idx(x, y)] = 1;
    W.fogDirty = true;
  }

  /* fog overlay: one transformed drawImage (tile space -> iso screen space) */
  function drawFog(g, cam, w, h) {
    if (W.fogDirty) updateFogCanvas();
    const z = cam.zoom;
    const left = cam.x - w / 2 / z, top = cam.y - h / 2 / z;
    g.save();
    g.setTransform(32 * z, 16 * z, -32 * z, 16 * z, -left * z, -top * z);
    g.imageSmoothingEnabled = true;
    g.drawImage(fogCv, 0, 0, N, N);
    g.restore();
  }

  /* ---------------- minimap ---------------- */
  function bakeMinimapBase() {
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    const g = cv.getContext('2d');
    const cols = ['#16345c', '#2e6e96', '#cdb279', '#5d8a3c', '#8a7148', '#93a05a'];
    const img = g.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = W.ter[idx(x, y)];
      const c = cols[t];
      const r = parseInt(c.slice(1, 3), 16), gg = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
      const i = (y * N + x) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // trees
    for (const o of W.objects) {
      if (o.kind === 'tree') { g.fillStyle = '#3c6323'; g.fillRect(o.x, o.y, 1, 1); }
    }
    W.minimapBase = cv;
  }

  return { W, gen, idx, inB, isoX, isoY, objAt, nearestObj, removeObj,
           drawTerrain, drawFog, recomputeFog, visAt, terAt, explore, N };
})();
