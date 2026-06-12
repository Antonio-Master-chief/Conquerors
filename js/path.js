/* ============ CONQUERORS — A* pathfinding (8-dir, binary heap) ============ */
'use strict';

const Path = (() => {
  const N = CFG.MAP;
  // reusable typed arrays
  const gScore = new Float32Array(N * N);
  const fScore = new Float32Array(N * N);
  const came = new Int32Array(N * N);
  const stamp = new Int32Array(N * N);
  let curStamp = 0;

  // binary min-heap over fScore
  const heap = new Int32Array(N * N);
  let heapLen = 0;
  function hPush(i) {
    heap[heapLen++] = i;
    let c = heapLen - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (fScore[heap[p]] <= fScore[heap[c]]) break;
      const t = heap[p]; heap[p] = heap[c]; heap[c] = t; c = p;
    }
  }
  function hPop() {
    const top = heap[0];
    heap[0] = heap[--heapLen];
    let p = 0;
    while (true) {
      const l = p * 2 + 1, r = l + 1; let m = p;
      if (l < heapLen && fScore[heap[l]] < fScore[heap[m]]) m = l;
      if (r < heapLen && fScore[heap[r]] < fScore[heap[m]]) m = r;
      if (m === p) break;
      const t = heap[p]; heap[p] = heap[m]; heap[m] = t; p = m;
    }
    return top;
  }

  const DIRS = [[1,0,1],[ -1,0,1],[0,1,1],[0,-1,1],[1,1,1.42],[1,-1,1.42],[-1,1,1.42],[-1,-1,1.42]];

  /* find path from (sx,sy) to (tx,ty) on blocked grid (Uint8Array, 1=blocked).
     Returns array of [x,y] tile coords (excluding start), or null.
     If target blocked, walks to nearest reachable neighbor of target. */
  function find(blocked, sx, sy, tx, ty, maxIter = 4200) {
    sx |= 0; sy |= 0; tx |= 0; ty |= 0;
    if (sx === tx && sy === ty) return [];
    curStamp++;
    heapLen = 0;
    const start = sy * N + sx, goal = ty * N + tx;
    gScore[start] = 0; fScore[start] = Math.hypot(tx - sx, ty - sy);
    came[start] = -1; stamp[start] = curStamp;
    hPush(start);
    let best = start, bestH = fScore[start];
    let iter = 0;
    while (heapLen > 0 && iter++ < maxIter) {
      const cur = hPop();
      if (cur === goal) { best = cur; break; }
      const cx = cur % N, cy = (cur / N) | 0;
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const ni = ny * N + nx;
        if (blocked[ni] && ni !== goal) continue;
        // prevent corner cutting on diagonals
        if (dx && dy && (blocked[cy * N + nx] || blocked[ny * N + cx])) continue;
        const ng = gScore[cur] + cost;
        if (stamp[ni] !== curStamp || ng < gScore[ni]) {
          stamp[ni] = curStamp;
          gScore[ni] = ng;
          const h = Math.hypot(tx - nx, ty - ny);
          fScore[ni] = ng + h;
          came[ni] = cur;
          hPush(ni);
          if (h < bestH) { bestH = h; best = ni; }
        }
      }
    }
    // reconstruct from best (goal if reached, else closest point)
    if (best === start) return null;
    const path = [];
    let n = best;
    if (blocked[best] && came[best] >= 0) n = came[best]; // don't end inside a blocked goal tile
    while (n !== start && n >= 0) {
      path.push([n % N, (n / N) | 0]);
      n = came[n];
    }
    path.reverse();
    return path.length ? path : null;
  }

  /* can a unit walk a straight line between two points? (samples the grid) */
  function lineWalkable(blocked, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    if (d < 0.01) return true;
    const steps = Math.ceil(d / 0.2);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      if (blocked[(y | 0) * N + (x | 0)]) return false;
      // don't squeeze through blocked diagonal corners
      const fx = x - (x | 0), fy = y - (y | 0);
      if (fx < 0.25 && blocked[(y | 0) * N + Math.max(0, (x | 0) - 1)] &&
          (fy < 0.25 || fy > 0.75)) return false;
    }
    return true;
  }

  /* string-pulling: drop waypoints that a straight walk can skip,
     so units stride diagonally instead of stair-stepping tile centers */
  function smooth(blocked, sx, sy, path) {
    if (!path || path.length < 3) return path;
    const out = [];
    let cx = sx, cy = sy, i = 0;
    while (i < path.length) {
      let pick = i;
      const max = Math.min(i + 7, path.length - 1);
      for (let j = max; j > i; j--) {
        if (lineWalkable(blocked, cx, cy, path[j][0] + .5, path[j][1] + .5)) { pick = j; break; }
      }
      out.push(path[pick]);
      cx = path[pick][0] + .5; cy = path[pick][1] + .5;
      i = pick + 1;
    }
    return out;
  }

  return { find, smooth, lineWalkable };
})();
