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

  /* ---------- picking ---------- */
  function pickAt(px, py) {
    const [tx, ty] = screenToTile(px, py);
    // units first (visible)
    let best = null, bestKey = -1;
    for (const u of game.units) {
      if (u.dead || u.inShip) continue;
      if (u.owner !== game.humanId && World.visAt(u.x, u.y) !== 2) continue;
      const r = u.def.big ? 1.1 : 0.62;
      if (Math.abs(u.x - tx) < r && Math.abs(u.y - ty) < r + 0.35) {
        const k = u.x + u.y + (u.owner === game.humanId ? 10 : 0); // prefer own
        if (k > bestKey) { bestKey = k; best = u; }
      }
    }
    if (best) return best;
    for (const b of game.buildings) {
      if (b.dead) continue;
      if (World.visAt(b.cx(), b.cy()) === 0) continue;
      if (tx >= b.x - .2 && tx < b.x + b.size + .2 && ty >= b.y - .2 && ty < b.y + b.size + .2) return b;
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
  function commandAt(px, py) {
    const sel = game.selected.filter(e => !e.dead && e.kind === 'unit' && e.owner === game.humanId);
    if (!sel.length) return false;
    const [tx, ty] = screenToTile(px, py);
    const target = pickAt(px, py);
    const settlers = sel.filter(u => u.type === 'settler');

    const big = sel.some(u => u.def.big);
    // merchants can be hunted in the wilderness — never inside kingdom borders
    if (target && target.kind === 'unit' && target.def.npc) {
      if (game.inTerritory(target.x, target.y) >= 0) {
        UI.message('Merchants are protected inside kingdom borders', true);
        return true;
      }
      for (const u of sel) if (!u.civilian) u.orderAttack(target);
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
      if (sel.some(u => u.type === 'elephant')) Audio2.sfx('trumpet'); else Audio2.ack('attack', big);
      return true;
    }
    if (target && target.kind === 'bld') {
      if (target.owner === game.humanId) {
        if (!target.built && settlers.length) { for (const s of settlers) s.orderBuild(target); Audio2.sfx('click'); return true; }
        if (target.def.farm && settlers.length) { for (const s of settlers) s.orderGather(target); Audio2.sfx('click'); return true; }
      } else if (target.type === 'town') {
        // move military adjacent to capture / fight garrison
        for (const u of sel) u.orderMove(target.cx() + (Math.random() * 2.4 - 1.2), target.cy() + (Math.random() * 2.4 - 1.2));
        Audio2.sfx('click'); return true;
      } else if (game.hostile(game.humanId, target.owner)) {
        for (const u of sel) u.orderAttack(target);
        Audio2.sfx('click'); return true;
      }
      return true;
    }
    const fishers = sel.filter(u => u.type === 'fishboat');
    const obj = objPick(tx, ty, !!fishers.length);
    if (obj && obj.kind === 'fish' && fishers.length) {
      for (const f of fishers) f.orderGather(obj);
      Audio2.sfx('click'); return true;
    }
    if (obj && obj.kind !== 'fish' && settlers.length) {
      for (const s of settlers) s.orderGather(obj);
      for (const u of sel) if (u.type !== 'settler') u.orderMove(tx, ty);
      Audio2.sfx('click'); return true;
    }
    // loaded transports tapped onto land: beach landing
    const loaded = sel.filter(u => u.cargo && u.cargo.length);
    if (loaded.length && World.inB(tx | 0, ty | 0) &&
        game.world.ter[World.idx(tx | 0, ty | 0)] >= TERRAIN.SAND) {
      for (const t of loaded) t.orderUnload(tx, ty);
      for (const u of sel) if (!loaded.includes(u)) u.orderMove(tx, ty);
      Audio2.sfx('click'); return true;
    }
    // formation move
    const n = sel.length;
    const cols = Math.ceil(Math.sqrt(n));
    sel.forEach((u, i) => {
      const ox = (i % cols - (cols - 1) / 2) * 0.9;
      const oy = (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * 0.9;
      u.orderMove(clamp(tx + ox, 1, World.N - 2), clamp(ty + oy, 1, World.N - 2));
    });
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
    for (const s of settlers) s.orderBuild(b);
    Audio2.sfx('build');
    game.placing = null;
    UI.refreshPanels(true);
  }

  /* ---------- selection ---------- */
  function selectAt(px, py, additive) {
    const hit = pickAt(px, py);
    if (hit) {
      if (hit.kind === 'unit' && hit.owner === game.humanId)
        hit.type === 'elephant' ? Audio2.sfx('trumpet') : Audio2.ack('select', !!hit.def.big);
      if (hit.kind === 'unit' && hit.owner === game.humanId) {
        if (additive && game.selected[0] && game.selected[0].kind === 'unit') {
          if (!game.selected.includes(hit)) game.selected.push(hit);
        } else game.selected = [hit];
      } else game.selected = [hit];
    } else if (!additive) game.selected = [];
    UI.refreshPanels(true);
  }
  function boxSelect(x0, y0, x1, y1) {
    const [ax, ay] = [Math.min(x0, x1), Math.min(y0, y1)];
    const [bx, by] = [Math.max(x0, x1), Math.max(y0, y1)];
    const picked = [];
    for (const u of game.units) {
      if (u.dead || u.inShip || u.owner !== game.humanId) continue;
      const cssW = game.canvas.width / game.dpr, cssH = game.canvas.height / game.dpr;
      const sx = (World.isoX(u.x, u.y) - game.cam.x) * game.cam.zoom + cssW / 2;
      const sy = (World.isoY(u.x, u.y) - game.cam.y) * game.cam.zoom + cssH / 2;
      if (sx >= ax && sx <= bx && sy >= ay && sy <= by) picked.push(u);
    }
    if (picked.length) {
      const military = picked.filter(u => !u.civilian);
      game.selected = military.length ? military : picked;
    }
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
    game.canvas.setPointerCapture && game.canvas.setPointerCapture(e.pointerId);
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
      if (game.placing) { placeAt(e.clientX, e.clientY); return; }
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
    if (game.placing) {
      const [tx, ty] = screenToTile(e.clientX, e.clientY);
      const B = BUILDINGS[game.placing.type];
      game.placing.bx = Math.round(tx - B.size / 2);
      game.placing.by = Math.round(ty - B.size / 2);
    }
  }

  function onUp(e) {
    pointers.delete(e.pointerId);
    clearTimeout(longPressTimer);

    if (isTouch(e)) {
      if (pointers.size > 0) { pinchDist = 0; return; }
      pinchDist = 0;
      if (panPointer === e.pointerId) {
        panPointer = null;
        if (panMoved < 9) { // tap
          if (game.targeting) { resolveTargeting(e.clientX, e.clientY); return; }
          if (game.placing) { placeAt(e.clientX, e.clientY); return; }
          const hit = pickAt(e.clientX, e.clientY);
          const haveUnits = game.selected.some(s => !s.dead && s.kind === 'unit' && s.owner === game.humanId);
          if (hit && hit.kind === 'unit' && hit.owner === game.humanId) selectAt(e.clientX, e.clientY, false);
          else if (haveUnits) commandAt(e.clientX, e.clientY);
          else selectAt(e.clientX, e.clientY, false);
        }
      }
      return;
    }
    if (e.button === 1 && panPointer === e.pointerId) { panPointer = null; return; }
    if (e.button === 0 && dragging) {
      dragging = false;
      const dx = Math.abs(dragNow.x - dragStart.x), dy = Math.abs(dragNow.y - dragStart.y);
      if (dx + dy < 7) selectAt(e.clientX, e.clientY, e.shiftKey);
      else boxSelect(dragStart.x, dragStart.y, dragNow.x, dragNow.y);
      dragStart = null;
    }
  }

  function update(dt) {
    // keyboard pan
    const sp = 620 / game.cam.zoom * dt;
    if (keys['w'] || keys['arrowup']) game.cam.y -= sp;
    if (keys['s'] || keys['arrowdown']) game.cam.y += sp;
    if (keys['a'] || keys['arrowleft']) game.cam.x -= sp;
    if (keys['d'] || keys['arrowright']) game.cam.x += sp;
    // clamp camera to map bounds (iso extent)
    const lim = World.N * 32;
    game.cam.x = clamp(game.cam.x, -lim, lim);
    game.cam.y = clamp(game.cam.y, 0, World.N * 32);
  }

  function dragRect() { return dragging && dragStart ? { a: dragStart, b: dragNow } : null; }

  return { init, update, dragRect, screenToTile };
})();
