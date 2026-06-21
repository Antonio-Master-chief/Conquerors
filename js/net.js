/* ============ CONQUERORS — multiplayer netcode (WebRTC P2P) ============
   No backend server exists for this project, so connection setup uses
   manual copy/paste signaling: the host generates an invite code (its SDP
   offer + gathered ICE candidates, base64-encoded), the joining player
   pastes it in and generates a response code, the host pastes that back.
   Once the data channel opens, the HOST runs the authoritative simulation
   (the existing single-player sim isn't guaranteed deterministic, so true
   lockstep would desync) and streams state snapshots to the client; the
   client is a thin renderer that forwards its own input as commands and
   never runs Sim/AI itself. */
'use strict';

const Net = (() => {
  const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
  let pc = null, dc = null, role = null; // role: 'host' | 'client' | null
  let onMessageCb = null, onOpenCb = null, onCloseCb = null;

  function encode(obj) { return btoa(encodeURIComponent(JSON.stringify(obj))); }
  function decode(str) { return JSON.parse(decodeURIComponent(atob(str.trim()))); }

  function waitIceComplete(conn) {
    return new Promise(resolve => {
      if (conn.iceGatheringState === 'complete') return resolve();
      const check = () => {
        if (conn.iceGatheringState === 'complete') { conn.removeEventListener('icegatheringstatechange', check); resolve(); }
      };
      conn.addEventListener('icegatheringstatechange', check);
      setTimeout(resolve, 4000); // don't hang forever on a slow/blocked NAT — ship whatever candidates we have
    });
  }

  function wireChannel(channel) {
    dc = channel;
    dc.onopen = () => { if (onOpenCb) onOpenCb(); };
    dc.onclose = () => { if (onCloseCb) onCloseCb(); };
    dc.onmessage = (e) => {
      if (!onMessageCb) return;
      try { onMessageCb(JSON.parse(e.data)); } catch (err) { console.warn('Net: bad message', err); }
    };
  }

  /* ---- host: create an invite code ---- */
  async function hostCreateOffer() {
    role = 'host';
    pc = new RTCPeerConnection(RTC_CONFIG);
    wireChannel(pc.createDataChannel('game', { ordered: true }));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitIceComplete(pc);
    return encode({ sdp: pc.localDescription });
  }
  /* ---- host: consume the joining player's response code ---- */
  async function hostAcceptAnswer(code) {
    const { sdp } = decode(code);
    await pc.setRemoteDescription(sdp);
  }
  /* ---- joiner: consume the host's invite code, produce a response code ---- */
  async function joinWithOffer(code) {
    role = 'client';
    pc = new RTCPeerConnection(RTC_CONFIG);
    pc.ondatachannel = (e) => wireChannel(e.channel);
    const { sdp } = decode(code);
    await pc.setRemoteDescription(sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitIceComplete(pc);
    return encode({ sdp: pc.localDescription });
  }

  function send(msg) { if (dc && dc.readyState === 'open') dc.send(JSON.stringify(msg)); }
  function isHost() { return role === 'host'; }
  function isClient() { return role === 'client'; }
  function isConnected() { return !!dc && dc.readyState === 'open'; }
  function onMessage(cb) { onMessageCb = cb; }
  function onOpen(cb) { onOpenCb = cb; }
  function onClose(cb) { onCloseCb = cb; }
  function reset() {
    try { if (dc) dc.close(); } catch (e) {}
    try { if (pc) pc.close(); } catch (e) {}
    dc = null; pc = null; role = null; onMessageCb = null; onOpenCb = null; onCloseCb = null;
  }

  /* ================= gameplay sync (host-authoritative) =================
     Only the 6 order* commands, training a unit, and placing a building are
     networked in this first pass — covers normal move/fight/economy play.
     Research clicks, rally-point dragging, and a few rarer actions aren't
     forwarded yet and will silently no-op for the client player. */

  const ENTITY_ARG_METHODS = { orderAttack: 0, orderGarrison: 0, orderBoard: 0, orderBuild: 0, orderBuildQueued: 0 };

  function findEntity(game, id) {
    if (id == null) return null;
    return game.units.find(u => u.id === id) || game.buildings.find(b => b.id === id)
        || game.world.objects.find(o => o.id === id) || null;
  }

  /* called on the CLIENT the moment a local order* call would normally fire */
  function sendOrder(unit, method, args) {
    const entIdx = ENTITY_ARG_METHODS[method];
    const wireArgs = args.map((a, i) => (i === entIdx && a && typeof a === 'object') ? { __ent: a.id } : a);
    send({ t: 'cmd', cmd: 'order', id: unit.id, method, args: wireArgs });
  }
  function sendTrain(buildingId, uKey) { send({ t: 'cmd', cmd: 'train', buildingId, uKey }); }
  function sendPlace(type, x, y, builderIds) { send({ t: 'cmd', cmd: 'place', type, x, y, builderIds }); }

  /* called on the HOST when a 'cmd' message arrives from the client */
  function applyRemoteCommand(game, msg) {
    if (msg.cmd === 'order') {
      const unit = game.units.find(u => u.id === msg.id);
      if (!unit || typeof unit[msg.method] !== 'function') return;
      const args = (msg.args || []).map(a => (a && typeof a === 'object' && '__ent' in a) ? findEntity(game, a.__ent) : a);
      unit[msg.method](...args);
    } else if (msg.cmd === 'train') {
      const b = game.buildings.find(x => x.id === msg.buildingId);
      if (b && b.enqueue) b.enqueue(game, msg.uKey);
    } else if (msg.cmd === 'place') {
      const p = game.players[1];
      const B = BUILDINGS[msg.type];
      if (!p || !B || !Sim.canPlace(game, msg.type, msg.x, msg.y) || !p.canAfford(B.cost)) return;
      p.pay(B.cost);
      const b = Sim.placeBuilding(game, 1, msg.type, msg.x, msg.y, false);
      if (b) for (const id of (msg.builderIds || [])) {
        const u = game.units.find(x => x.id === id);
        if (u) u.orderBuildQueued(b);
      }
    }
  }

  /* host -> client: lightweight periodic snapshot (positions/hp/queues/resources,
     NOT a full save() — terrain/resource nodes are reproduced locally by the
     client from the shared world seed, so only dynamic entity state travels). */
  function buildSnapshot(game) {
    // resource nodes are reproduced locally from the shared seed, but their
    // amount/alive state drifts as they're worked - only changed ones travel.
    const objDelta = [];
    for (const o of game.world.objects) {
      if (o.doodad) continue;
      if (!o.alive) objDelta.push([o.id, 0, 0]);
      else if (o._lastSentAmt !== o.amount) objDelta.push([o.id, 1, o.amount]);
      o._lastSentAmt = o.amount;
    }
    return {
      t: 'snap', time: game.time, objDelta,
      units: game.units.filter(u => !u.dead).map(u => [
        u.id, u.type, u.owner, u.civKey,
        Math.round(u.x * 10) / 10, Math.round(u.y * 10) / 10,
        Math.round(u.hp), u.dir || 0, u.anim || 'idle', u.fr || 0,
        u.carry ? [u.carry.res, Math.round(u.carry.amt)] : null,
      ]),
      buildings: game.buildings.filter(b => !b.dead).map(b => [
        b.id, b.type, b.owner, b.civKey || 'none', b.x, b.y,
        Math.round(b.hp), b.built ? 1 : 0, Math.round((b.progress || 0) * 100) / 100,
        b.wallMask || 0, (b.queue || []).map(q => ({ uKey: q.uKey, t: q.t, total: q.total })),
      ]),
      res: game.players.map(p => p.res),
      age: game.players.map(p => p.age),
      pop: game.players.map(p => p.pop),
    };
  }

  /* client: reconcile local entities against a host snapshot (create/update/remove by id) */
  function applySnapshot(game, snap) {
    game.time = snap.time;
    for (const [id, alive, amt] of (snap.objDelta || [])) {
      const o = game.world.objects[id];
      if (!o) continue;
      if (!alive && o.alive) World.removeObj(o);
      else if (alive) o.amount = amt;
    }
    const unitMap = new Map(game.units.map(u => [u.id, u]));
    const seenU = new Set();
    for (const rec of snap.units) {
      const [id, tp, ow, ck, x, y, hp, dir, anim, fr, carry] = rec;
      seenU.add(id);
      let u = unitMap.get(id);
      if (!u) { u = Sim.spawnUnit(game, ow, tp, x, y, ck); if (!u) continue; u.id = id; unitMap.set(id, u); }
      u.x = x; u.y = y; u.hp = hp; u.dir = dir; u.anim = anim; u.fr = fr;
      u.carry = carry ? { res: carry[0], amt: carry[1] } : null;
    }
    for (const u of game.units) if (!seenU.has(u.id)) u.dead = true;

    const bldMap = new Map(game.buildings.map(b => [b.id, b]));
    const seenB = new Set();
    for (const rec of snap.buildings) {
      const [id, tp, ow, ck, x, y, hp, built, progress, wallMask, queue] = rec;
      seenB.add(id);
      let b = bldMap.get(id);
      if (!b) { b = Sim.placeBuilding(game, ow, tp, x, y, !!built); if (!b) continue; b.id = id; bldMap.set(id, b); }
      b.hp = hp; b.built = !!built; b.progress = progress; b.wallMask = wallMask; b.queue = queue;
    }
    for (const b of game.buildings) if (!seenB.has(b.id)) b.dead = true;

    snap.res.forEach((r, i) => { if (game.players[i]) game.players[i].res = r; });
    snap.age.forEach((a, i) => { if (game.players[i]) game.players[i].age = a; });
    snap.pop.forEach((p, i) => { if (game.players[i]) game.players[i].pop = p; });
    if (game.units.some(u => u.dead)) game.units = game.units.filter(u => !u.dead);
    if (game.buildings.some(b => b.dead)) game.buildings = game.buildings.filter(b => !b.dead);
  }

  /* on the client, every player-issued unit order gets forwarded to the host
     instead of executing locally (the client never runs its own Sim ticks,
     so executing locally would just be silently overwritten by the next
     snapshot anyway). orderDeposit is excluded - it's fired internally by a
     unit's own update loop (auto-return-to-drop-off), never by player input,
     so it only ever needs to run where the sim itself runs: the host. */
  for (const method of ['orderMove', 'orderAttack', 'orderExplore', 'orderGarrison',
                         'orderGather', 'orderBoard', 'orderPoison', 'orderUnload',
                         'orderBuild', 'orderBuildQueued']) {
    const orig = Unit.prototype[method];
    if (!orig) continue;
    Unit.prototype[method] = function (...args) {
      if (isClient()) { sendOrder(this, method, args); return; }
      return orig.apply(this, args);
    };
  }

  return {
    hostCreateOffer, hostAcceptAnswer, joinWithOffer, send, isHost, isClient, isConnected,
    onMessage, onOpen, onClose, reset,
    sendOrder, sendTrain, sendPlace, applyRemoteCommand, buildSnapshot, applySnapshot,
  };
})();
