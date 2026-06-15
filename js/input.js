/* ============ CONQUERORS — input: mouse, keyboard, touch ============ */
'use strict';

const Input = (() => {
  let game = null;
  const keys = {};
  let dragStart = null, dragNow = null, dragging = false;
  let panPointer = null, panLast = null, panMoved = 0;
  const pointers = new Map();
  let pinchDist = 0;
  let longPressTimer = null;
  let hoverX = -1, hoverY = -1, hoverInside = false; // mouse position for edge-pan

  function init(g) {
    game = g;
    const cv = game.canvas;

    window.addEventListener('keydown', e => {
      keys[e.key.toLowerCase()] = true;
      if (e.key === 'Escape') { game.placing = null; game.selected = []; UI.refreshPanels(true); }
    });
    window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    // edge-pan needs to know when the mouse leaves the window entirely
    window.addEventListener('pointermove', e => {
      if (e.pointerType !== 'touch') { hoverX = e.clientX; hoverY = e.clientY; hoverInside = true; }
    }, true);
    window.addEventListener('pointerout', e => { if (!e.relatedTarget) hoverInside = false; });
    window.addEventListener('blur', () => { hoverInside = false; for (const k in keys) keys[k] = false; });
  }

  const isTouch = (e) => e.pointerType === 'touch';

  function screenToWorldIso(px, py) {
    const cam = game.cam;
    const cssW = game.canvas.width / game.dpr, cssH = game.canvas.height / game.dpr;
    return [cam.x + (px - cssW / 2) / cam.zoom, cam.y + (py - cssH / 2) / cam.zoom];
  }
  function screenToTile(px, py) {
    const [ix, iy] = screenToWorldIso(px, py);
    return [ix / 64 + iy / 32, iy / 32 - ix / 64];
  }

  /* ---------- picking ----------
     AoE-style: hit-test the SPRITE on screen, not the ground tile under the
     cursor — clicking a soldier's head or a building's roof must select it. */
  function toScreen(wx, wy) {
    const cam = game.cam;
    const cssW = game.canvas.width / game.dpr, cssH = game.canvas.height / game.dpr;
    return [(World.isoX(wx, wy) - cam.x) * cam.zoom + cssW / 2,
            (World.isoY(wx, wy) - cam.y) * cam.zoom + cssH / 2];
  }
  function pickAt(px, py) {
    const z = game.cam.zoom;
    let best = null, bestScore = 1e9;
    for (const u of game.units) {
      if (u.dead || u.inShip || u.inWall || u.def.cart) continue; // carts auto-route, not selectable
      if (u.owner !== game.humanId && World.visAt(u.x, u.y) !== 2) continue;
      const [sx, sy] = toScreen(u.x, u.y);
      const hw = (u.def.big ? 30 : 19) * z;          // half-width of the body box (matches sprite)
      const top = (u.def.big ? 58 : 44) * z;         // sprite height above the feet
      const bot = 10 * z;
      if (px < sx - hw || px > sx + hw || py < sy - top || py > sy + bot) continue;
      // nearest to body center wins; own units strongly preferred
      let score = Math.abs(px - sx) + Math.abs(py - (sy - top * 0.45)) * 0.6;
      if (u.owner === game.humanId) score -= 1000;
      if (score < bestScore) { bestScore = score; best = u; }
    }
    if (best) return best;
    for (const b of game.buildings) {
      if (b.dead) continue;
      if (World.visAt(b.cx(), b.cy()) === 0) continue;
      const [sx, sy] = toScreen(b.cx(), b.cy());
      const hw = b.size * 33 * z;
      const top = (b.size * 26 + 40) * z, bot = b.size * 17 * z;
      if (px >= sx - hw && px <= sx + hw && py >= sy - top && py <= sy + bot) return b;
    }
    return null;
  }
  function objPick(tx, ty, allowFish) {
    const o = World.objAt(tx | 0, ty | 0);
    if (!o || !o.alive || o.kind === 'ruin') return null;
    if (o.kind === 'fish' && !allowFish) return null;
    return o;
  }

  /* ---------- commands ---------- */
  function mark(kind, x, y) { game.markers.push({ kind, x, y, t0: game.time }); }

  /* distribute gatherers across same-kind nodes near the clicked one, so a
     crowded mine/forest overflows to the next nearest node (AoE behavior) */
  function spreadGather(workers, target) {
    const kind = target.kind, CAP = 4;
    const nodes = game.world.objects.filter(o =>
      o.alive && o.kind === kind && dist2(o.x, o.y, target.x, target.y) < 18 * 18);
    if (nodes.length <= 1) { for (const w of workers) w.orderGather(target); return; }
    const counts = new Map();
    for (const w of workers) {
      let best = null, bd = 1e9;
      for (const nd of nodes) {
        if ((counts.get(nd) || 0) >= CAP) continue;
        const d = dist2(w.x, w.y, nd.x, nd.y);
        if (d < bd) { bd = d; best = nd; }
      }
      if (!best) best = target;                 // everything full: pile on the target
      counts.set(best, (counts.get(best) || 0) + 1);
      w.orderGather(best);
    }
  }

  function commandAt(px, py) {
    const sel = game.selected.filter(e => !e.dead && e.kind === 'unit' && e.owner === game.humanId);
    const [tx, ty] = screenToTile(px, py);
    // production buildings: set rally point (classic AoE)
    if (!sel.length) {
      const blds = game.selected.filter(e => !e.dead && e.kind === 'bld' && e.owner === game.humanId && e.def.trains);
      if (blds.length && World.inB(tx | 0, ty | 0)) {
        for (const b of blds) b.rally = { x: tx, y: ty };
        mark('rally', tx, ty);
        UI.message('Rally point set');
        Audio2.sfx('click');
        return true;
      }
      return false;
    }
    const target = pickAt(px, py);
    const settlers = sel.filter(u => u.type === 'settler');

    const big = sel.some(u => u.def.big);
    // hunt wild animals — settlers and soldiers alike (NOT a merchant)
    if (target && target.kind === 'unit' && target.def.animal) {
      for (const u of sel) u.orderAttack(target);
      mark('attack', target.cx(), target.cy());
      Audio2.ack('attack', big);
      return true;
    }
    // merchants can be hunted in the wilderness — never inside kingdom borders
    if (target && target.kind === 'unit' && target.type === 'trader') {
      if (game.inTerritory(target.x, target.y) >= 0) {
        UI.message('Merchants are protected inside kingdom borders', true);
        return true;
      }
      for (const u of sel) if (!u.civilian) u.orderAttack(target);
      mark('attack', target.x, target.y);
      Audio2.ack('attack', big);
      return true;
    }
    // board a friendly transport
    if (target && target.kind === 'unit' && target.owner === game.humanId && target.cargo) {
      const landUnits = sel.filter(u => !u.def.naval && u !== target);
      if (landUnits.length) {
        for (const u of landUnits) u.orderBoard(target);
        Audio2.ack('move', false);
        return true;
      }
    }
    if (target && target.kind === 'unit' && game.hostile(game.humanId, target.owner) && !target.def.npc) {
      for (const u of sel) u.orderAttack(target);
      mark('attack', target.x, target.y);
      if (sel.some(u => u.type === 'elephant')) Audio2.sfx('trumpet'); else Audio2.ack('attack', big);
      return true;
    }
    if (target && target.kind === 'bld') {
      if (target.owner === game.humanId) {
        if (!target.built && settlers.length) { for (const s of settlers) s.orderBuildQueued(target); mark('move', target.cx(), target.cy()); Audio2.sfx('click'); return true; }
        if (target.def.farm && settlers.length) { for (const s of settlers) s.orderGather(target); mark('gather', target.cx(), target.cy()); Audio2.sfx('click'); return true; }
        // man the walls: ranged units garrison inside
        if (target.garrison && target.built) {
          const bowmen = sel.filter(u => u.def.tags.includes('ranged') && !u.def.naval);
          if (bowmen.length) {
            const room = (target.def.garrison || 0) - target.garrison.length;
            bowmen.slice(0, Math.max(0, room)).forEach(u => u.orderGarrison(target));
            if (room <= 0) UI.message('Wall is fully manned', true);
            else { mark('move', target.cx(), target.cy()); Audio2.ack('move', false); }
            return true;
          }
        }
      } else if (target.type === 'town') {
        // move military adjacent to capture / fight garrison
        for (const u of sel) u.orderMove(target.cx() + (Math.random() * 2.4 - 1.2), target.cy() + (Math.random() * 2.4 - 1.2));
        mark('attack', target.cx(), target.cy());
        Audio2.ack('move', big); return true;
      } else if (game.hostile(game.humanId, target.owner)) {
        for (const u of sel) u.orderAttack(target);
        mark('attack', target.cx(), target.cy());
        Audio2.sfx('click'); return true;
      }
      return true;
    }
    const fishers = sel.filter(u => u.type === 'fishboat');
    // screen-space pick so clicking a tall sprite (tree canopy) hits the node
    const obj = pickResource(px, py) || objPick(tx, ty, !!fishers.length);
    if (obj && (obj.kind === 'deer' || obj.kind === 'boar')) { // hunt the animal
      const hunters = sel.filter(u => u.type === 'settler' || !u.civilian);
      for (const u of hunters) u.orderAttack(obj);
      mark('attack', obj.x + .5, obj.y + .5); Audio2.sfx('click'); return true;
    }
    if (obj && obj.kind === 'fish' && fishers.length) {
      spreadGather(fishers, obj);
      mark('gather', obj.x + .5, obj.y + .5);
      Audio2.sfx('click'); return true;
    }
    if (obj && obj.kind !== 'fish' && settlers.length) {
      // command is "gather THIS resource type" — spread workers across nearby
      // same-kind nodes so a crowded mine overflows to the next nearest one
      spreadGather(settlers, obj);
      for (const u of sel) if (u.type !== 'settler') u.orderMove(tx, ty);
      mark('gather', obj.x + .5, obj.y + .5);
      Audio2.sfx('click'); return true;
    }
    // loaded transports tapped onto land: beach landing
    const loaded = sel.filter(u => u.cargo && u.cargo.length);
    if (loaded.length && World.inB(tx | 0, ty | 0) &&
        game.world.ter[World.idx(tx | 0, ty | 0)] >= TERRAIN.SAND) {
      for (const t of loaded) t.orderUnload(tx, ty);
      for (const u of sel) if (!loaded.includes(u)) u.orderMove(tx, ty);
      mark('move', tx, ty);
      Audio2.sfx('click'); return true;
    }
    // formation move — never assign a slot that sits on a blocked tile
    const n = sel.length;
    const cols = Math.ceil(Math.sqrt(n));
    sel.forEach((u, i) => {
      const ox = (i % cols - (cols - 1) / 2) * 0.9;
      const oy = (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * 0.9;
      let gx = clamp(tx + ox, 1, World.N - 2), gy = clamp(ty + oy, 1, World.N - 2);
      const grid = u.def.naval ? game.world.navBlocked : game.world.blocked;
      if (grid[World.idx(gx | 0, gy | 0)]) { gx = tx; gy = ty; } // fall back to the click point
      u.orderMove(gx, gy);
    });
    mark('move', tx, ty);
    Audio2.ack('move', big);
    return true;
  }

  /* targeted abilities (Poison Wells) */
  function resolveTargeting(px, py) {
    const t = game.targeting;
    game.targeting = null;
    if (!t || t.kind !== 'poison') return;
    const [tx, ty] = screenToTile(px, py);
    const x = tx | 0, y = ty | 0;
    if (!World.inB(x, y) || game.world.ter[World.idx(x, y)] > TERRAIN.SHALLOW) {
      UI.message('Target a water tile', true); return;
    }
    const scout = game.selected.find(u => !u.dead && u.kind === 'unit' && u.owner === game.humanId && u.type === 'scout');
    if (!scout) { UI.message('Select a scout first', true); return; }
    scout.orderPoison(x + .5, y + .5);
    Audio2.ack('move', false);
    UI.refreshPanels(true);
  }

  function placeAt(px, py) {
    const type = game.placing.type;
    const B = BUILDINGS[type];
    const [tx, ty] = screenToTile(px, py);
    const bx = Math.round(tx - B.size / 2), by = Math.round(ty - B.size / 2);
    const p = game.players[game.humanId];
    if (!Sim.canPlace(game, type, bx, by)) { UI.message('Cannot build there', true); return; }
    if (!p.canAfford(B.cost)) { UI.message('Not enough resources', true); game.placing = null; UI.refreshPanels(true); return; }
    p.pay(B.cost);
    const b = Sim.placeBuilding(game, game.humanId, type, bx, by, false);
    const settlers = game.selected.filter(e => !e.dead && e.kind === 'unit' && e.type === 'settler');
    for (const s of settlers) s.orderBuildQueued(b); // queues if already building (AoE style)
    Audio2.sfx('build');
    game.placing = null;
    UI.refreshPanels(true);
  }

  /* ---------- drag-placement for walls & canals ---------- */
  let placeDrag = null;
  function dragCells(x0, y0, x1, y1) { // straight tile line, Bresenham
    const cells = [];
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx2 = x0 < x1 ? 1 : -1, sy2 = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0, guard = 0;
    while (guard++ < 40) {
      cells.push([x, y]);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx2; }
      if (e2 <= dx) { err += dx; y += sy2; }
    }
    return cells;
  }
  function updatePlaceDrag(px, py) {
    const [tx, ty] = screenToTile(px, py);
    placeDrag.cells = dragCells(placeDrag.x0, placeDrag.y0, tx | 0, ty | 0);
    game.placing.cells = placeDrag.cells;
  }
  function finishPlaceDrag() {
    const type = game.placing.type, B = BUILDINGS[type];
    const p = game.players[game.humanId];
    const placed = [];
    for (const [x, y] of placeDrag.cells) {
      if (!Sim.canPlace(game, type, x, y)) continue;
      if (!p.canAfford(B.cost)) { UI.message('Out of resources', true); break; }
      p.pay(B.cost);
      placed.push(Sim.placeBuilding(game, game.humanId, type, x, y, false));
    }
    if (placed.length) {
      const settlers = game.selected.filter(e => !e.dead && e.kind === 'unit' && e.type === 'settler');
      for (const s of settlers) for (const b of placed) s.orderBuildQueued(b);
      Audio2.sfx('build');
      UI.message(`${placed.length} × ${B.name} placed`);
    }
    placeDrag = null;
    game.placing.cells = null; // stay in placing mode: drag the next stretch
    UI.refreshPanels(true);
  }

  /* screen-space pick of a resource node / animal under the cursor (for info select) */
  const SELECTABLE_RES = ['tree', 'gold', 'stone', 'iron', 'bush', 'fish', 'deer', 'boar'];
  function pickResource(px, py) {
    const z = game.cam.zoom;
    let best = null, bd = 1e9;
    for (const o of game.world.objects) {
      if (!o.alive || SELECTABLE_RES.indexOf(o.kind) < 0) continue;
      if (World.visAt(o.x, o.y) === 0) continue;
      const [sx, sy] = toScreen(o.x + .5, o.y + .5);
      const tall = o.kind === 'tree' ? 70 : 28, hw = 17 * z;
      if (px < sx - hw || px > sx + hw || py < sy - tall * z || py > sy + 10 * z) continue;
      const d = Math.abs(px - sx) + Math.abs(py - (sy - tall * z * 0.4));
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  /* ---------- selection ---------- */
  let lastSelT = 0, lastSelId = -1;
  function selectAt(px, py, additive) {
    const hit = pickAt(px, py);
    if (!hit) {
      const r = pickResource(px, py);       // left-clicking a tree/mine shows its info
      if (r) { game.selected = [r]; Audio2.sfx('click'); UI.refreshPanels(true); return; }
      // left-clicking a freshwater lake shows its water level
      const [ltx, lty] = screenToTile(px, py);
      if (World.isFresh(ltx, lty)) { game.selected = [{ kind: 'lake', x: ltx | 0, y: lty | 0 }]; Audio2.sfx('click'); UI.refreshPanels(true); return; }
    }
    if (hit) {
      if (hit.kind === 'unit' && hit.owner === game.humanId) {
        hit.type === 'elephant' ? Audio2.sfx('trumpet') : Audio2.ack('select', !!hit.def.big);
        // double-click: select every unit of this type on screen (AoE classic)
        if (performance.now() - lastSelT < 380 && lastSelId === hit.id) {
          const cssW = game.canvas.width / game.dpr, cssH = game.canvas.height / game.dpr;
          const picked = [];
          for (const u of game.units) {
            if (u.dead || u.inShip || u.owner !== game.humanId || u.type !== hit.type) continue;
            const [sx, sy] = toScreen(u.x, u.y);
            if (sx > -30 && sx < cssW + 30 && sy > -30 && sy < cssH + 30) picked.push(u);
          }
          if (!picked.includes(hit)) picked.push(hit); // the unit you clicked always counts
          game.selected = picked;
          if (picked.length > 1) UI.message(`${picked.length} × ${hit.def.name} selected`);
          lastSelT = 0; lastSelId = -1;
          UI.refreshPanels(true);
          return;
        }
        lastSelT = performance.now(); lastSelId = hit.id;
        if (additive && game.selected[0] && game.selected[0].kind === 'unit') {
          if (!game.selected.includes(hit)) game.selected.push(hit);
        } else game.selected = [hit];
      } else game.selected = [hit];
    } else if (!additive) game.selected = [];
    UI.refreshPanels(true);
  }

  /* does the current selection have a real job at this own-building? */
  function workableHere(b) {
    const sel = game.selected.filter(s => !s.dead && s.kind === 'unit' && s.owner === game.humanId);
    if (!sel.length) return false;
    const settlers = sel.some(u => u.type === 'settler');
    if (!b.built && settlers) return true;          // finish construction
    if (b.def.farm && b.built && settlers) return true; // gather a farm
    if (b.garrison && b.built && sel.some(u => u.def.tags.includes('ranged') && !u.def.naval)
        && b.garrison.length < (b.def.garrison || 0)) return true; // man a wall
    return false;
  }

  /* one tap/click does the right thing: select friends, command everything else */
  function tapAction(px, py, additive, allowBldRally) {
    const hit = pickAt(px, py);
    const haveUnits = game.selected.some(s => !s.dead && s.kind === 'unit' && s.owner === game.humanId);
    const haveBlds = game.selected.some(s => !s.dead && s.kind === 'bld' && s.owner === game.humanId && s.def.trains);
    if (hit && hit.kind === 'unit' && hit.owner === game.humanId) {
      // own loaded-transport special case: clicking it with troops selected = board
      if (hit.cargo && haveUnits &&
          game.selected.some(u => u.kind === 'unit' && !u.def.naval && u !== hit)) { commandAt(px, py); return; }
      selectAt(px, py, additive);
    } else if (hit && hit.kind === 'bld' && hit.owner === game.humanId) {
      // clicking your own building SELECTS it (to open its panel) unless the
      // chosen units have an actual job there (build / gather / garrison)
      if (haveUnits && workableHere(hit)) commandAt(px, py);
      else selectAt(px, py, additive);
    } else if (haveUnits || (allowBldRally && haveBlds)) {
      commandAt(px, py); // left-click the map / enemy: GO THERE
    } else {
      selectAt(px, py, additive);
    }
  }
  function boxSelect(x0, y0, x1, y1, additive) {
    const ax = Math.min(x0, x1), ay = Math.min(y0, y1);
    const bx = Math.max(x0, x1), by = Math.max(y0, y1);
    const cssW = game.canvas.width / game.dpr, cssH = game.canvas.height / game.dpr;
    const picked = [];
    for (const u of game.units) {
      if (u.dead || u.inShip || u.inWall || u.def.cart || u.owner !== game.humanId) continue;
      // test the unit's body center (slightly above the feet), not just the feet point
      const sx = (World.isoX(u.x, u.y) - game.cam.x) * game.cam.zoom + cssW / 2;
      const sy = (World.isoY(u.x, u.y) - game.cam.y) * game.cam.zoom + cssH / 2 - 16 * game.cam.zoom;
      if (sx >= ax && sx <= bx && sy >= ay && sy <= by) picked.push(u);
    }
    if (!picked.length) {
      if (!additive) { game.selected = []; UI.refreshPanels(true); }
      return;
    }
    // prefer military when the box catches a mix; civilians only if that's all there is
    const military = picked.filter(u => !u.civilian);
    const finalPick = military.length ? military : picked;
    if (additive) {
      for (const u of finalPick) if (!game.selected.includes(u)) game.selected.push(u);
    } else game.selected = finalPick;
    Audio2.ack('select', false);
    UI.refreshPanels(true);
  }

  /* ---------- events ---------- */
  function onWheel(e) {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.pow(1.0015, -e.deltaY));
  }
  function zoomAt(px, py, factor) {
    const cam = game.cam;
    const [wx, wy] = screenToWorldIso(px, py);
    cam.zoom = clamp(cam.zoom * factor, CFG.ZOOM_MIN, CFG.ZOOM_MAX);
    const cssW = game.canvas.width / game.dpr, cssH = game.canvas.height / game.dpr;
    cam.x = wx - (px - cssW / 2) / cam.zoom;
    cam.y = wy - (py - cssH / 2) / cam.zoom;
  }

  function onDown(e) {
    try { game.canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic/stale pointer */ }
    Audio2.resume();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (isTouch(e)) {
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        panPointer = null;
        clearTimeout(longPressTimer);
        return;
      }
      // drag-buildable tool active: one-finger drag paints the wall line
      if (game.placing && BUILDINGS[game.placing.type].drag) {
        const [tx, ty] = screenToTile(e.clientX, e.clientY);
        placeDrag = { x0: tx | 0, y0: ty | 0, cells: [[tx | 0, ty | 0]] };
        game.placing.cells = placeDrag.cells;
        panPointer = null;
        return;
      }
      panPointer = e.pointerId;
      panLast = { x: e.clientX, y: e.clientY };
      panMoved = 0;
      // long-press: deselect / cancel
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        if (panMoved < 8) { game.selected = []; game.placing = null; UI.refreshPanels(true); }
      }, 450);
      return;
    }
    // mouse
    if (e.button === 0) {
      if (game.targeting) { resolveTargeting(e.clientX, e.clientY); return; }
      if (game.placing) {
        if (BUILDINGS[game.placing.type].drag) {
          const [tx, ty] = screenToTile(e.clientX, e.clientY);
          placeDrag = { x0: tx | 0, y0: ty | 0, cells: [[tx | 0, ty | 0]] };
          game.placing.cells = placeDrag.cells;
        } else placeAt(e.clientX, e.clientY);
        return;
      }
      dragStart = { x: e.clientX, y: e.clientY }; dragNow = { ...dragStart }; dragging = true;
    } else if (e.button === 2) {
      if (game.targeting) { game.targeting = null; UI.message('Cancelled'); return; }
      if (game.placing) { game.placing = null; UI.refreshPanels(true); return; }
      commandAt(e.clientX, e.clientY);
    } else if (e.button === 1) {
      panPointer = e.pointerId; panLast = { x: e.clientX, y: e.clientY }; panMoved = 0;
      e.preventDefault();
    }
  }

  function onMove(e) {
    const pt = pointers.get(e.pointerId);
    if (pt) { pt.x = e.clientX; pt.y = e.clientY; }

    if (isTouch(e) && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinchDist);
      pinchDist = d;
      return;
    }
    if (panPointer === e.pointerId && panLast) {
      const dx = e.clientX - panLast.x, dy = e.clientY - panLast.y;
      panMoved += Math.abs(dx) + Math.abs(dy);
      game.cam.x -= dx / game.cam.zoom;
      game.cam.y -= dy / game.cam.zoom;
      panLast = { x: e.clientX, y: e.clientY };
      return;
    }
    if (dragging && dragStart) dragNow = { x: e.clientX, y: e.clientY };
    if (placeDrag) { updatePlaceDrag(e.clientX, e.clientY); return; }
    if (game.placing) {
      const [tx, ty] = screenToTile(e.clientX, e.clientY);
      const B = BUILDINGS[game.placing.type];
      game.placing.bx = Math.round(tx - B.size / 2);
      game.placing.by = Math.round(ty - B.size / 2);
    }
    if (!isTouch(e)) updateHoverCursor(e.clientX, e.clientY);
  }

  /* ---------- context cursor (desktop): axe / hammer / sword ---------- */
  const cursorCache = {};
  function cursorFor(iconName) {
    if (cursorCache[iconName]) return cursorCache[iconName];
    const c = document.createElement('canvas'); c.width = 26; c.height = 26;
    c.getContext('2d').drawImage(Sprites.icon(iconName), 0, 0);
    cursorCache[iconName] = `url(${c.toDataURL()}) 5 5, auto`;
    return cursorCache[iconName];
  }
  let hoverT = 0, lastCursor = '';
  function setCursor(v) {
    if (v === lastCursor) return;
    lastCursor = v;
    game.canvas.style.cursor = v;
  }
  function updateHoverCursor(px, py) {
    const now = performance.now();
    if (now - hoverT < 80) return;
    hoverT = now;
    if (game.placing || game.targeting) { setCursor('crosshair'); return; }
    const sel = game.selected.filter(s => !s.dead && s.kind === 'unit' && s.owner === game.humanId);
    if (!sel.length) { setCursor('default'); return; }
    const settlers = sel.some(u => u.type === 'settler');
    const military = sel.some(u => !u.civilian);
    const hit = pickAt(px, py);
    if (hit && game.hostile(game.humanId, hit.owner) && hit.owner >= -1 &&
        !(hit.kind === 'unit' && hit.def.npc && game.inTerritory(hit.x, hit.y) >= 0)) {
      if (military || hit.kind === 'bld') { setCursor(cursorFor('sword2')); return; }
    }
    if (hit && hit.kind === 'bld' && hit.owner === game.humanId && !hit.built && settlers) {
      setCursor(cursorFor('hammer')); return;
    }
    if (settlers) {
      const [tx, ty] = screenToTile(px, py);
      const o = objPick(tx, ty, false);
      if (o && o.kind !== 'fish' && !o.doodad) { setCursor(cursorFor('axe2')); return; }
      if (hit && hit.kind === 'bld' && hit.owner === game.humanId && hit.def.farm && hit.built) {
        setCursor(cursorFor('axe2')); return;
      }
    }
    setCursor('default');
  }

  function onUp(e) {
    pointers.delete(e.pointerId);
    clearTimeout(longPressTimer);

    if (placeDrag) { finishPlaceDrag(); return; }
    if (isTouch(e)) {
      if (pointers.size > 0) { pinchDist = 0; return; }
      pinchDist = 0;
      if (panPointer === e.pointerId) {
        panPointer = null;
        if (panMoved < 9) { // tap
          if (game.targeting) { resolveTargeting(e.clientX, e.clientY); return; }
          if (game.placing) { placeAt(e.clientX, e.clientY); return; }
          tapAction(e.clientX, e.clientY, false, true);
        }
      }
      return;
    }
    if (e.button === 1 && panPointer === e.pointerId) { panPointer = null; return; }
    if (e.button === 0 && dragging) {
      dragging = false;
      // AoE scheme: LEFT click = select only (units, buildings, or a resource —
      // shows its info). Commands are RIGHT-click. Big drag = box select.
      const dx = Math.abs(dragNow.x - dragStart.x), dy = Math.abs(dragNow.y - dragStart.y);
      if (Math.max(dx, dy) < 14) selectAt(e.clientX, e.clientY, e.shiftKey);
      else boxSelect(dragStart.x, dragStart.y, dragNow.x, dragNow.y, e.shiftKey);
      dragStart = null;
    }
  }

  function update(dt) {
    const sp = 620 / game.cam.zoom * dt;
    let dx = 0, dy = 0;
    // keyboard pan
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;
    // edge-pan: push the mouse to a screen edge to scroll the map (AoE-style).
    // Suppressed while box-selecting or placing so it never fights the cursor.
    if (edgePanOn && hoverInside && !dragging && !placeDrag) {
      const cssW = game.canvas.width / game.dpr, cssH = game.canvas.height / game.dpr;
      const M = 28; // edge band thickness in CSS px
      if (hoverX < M) dx -= (M - hoverX) / M;
      else if (hoverX > cssW - M) dx += (hoverX - (cssW - M)) / M;
      if (hoverY < M) dy -= (M - hoverY) / M;
      else if (hoverY > cssH - M) dy += (hoverY - (cssH - M)) / M;
    }
    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      game.cam.x += dx / len * sp;
      game.cam.y += dy / len * sp;
    }
    // clamp camera to map bounds (iso extent)
    const lim = World.N * 32;
    game.cam.x = clamp(game.cam.x, -lim, lim);
    game.cam.y = clamp(game.cam.y, 0, World.N * 32);
  }
  let edgePanOn = true;
  function setEdgePan(v) { edgePanOn = v; }

  function dragRect() { return dragging && dragStart ? { a: dragStart, b: dragNow } : null; }

  return { init, update, dragRect, screenToTile };
})();
