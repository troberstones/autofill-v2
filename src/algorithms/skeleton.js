/**
 * Zhang-Suen thinning, spur pruning, and endpoint utilities.
 * All pure functions on flat Uint8Arrays — safe to use in a Web Worker.
 *
 * Zhang-Suen neighbor ordering (clockwise from N):
 *   P2=N, P3=NE, P4=E, P5=SE, P6=S, P7=SW, P8=W, P9=NW
 * Array index: [0,    1,   2,   3,    4,   5,    6,  7 ]
 */

function nbrOffsets(w) {
  return [-w, -w + 1, 1, w + 1, w, w - 1, -1, -w - 1];
}

/** Count 0→1 transitions in the circular 8-neighbor ring. */
function transitions(p) {
  let t = 0;
  for (let k = 0; k < 8; k++) {
    if (p[k] === 0 && p[(k + 1) & 7] === 1) t++;
  }
  return t;
}

/**
 * Zhang-Suen thinning.
 * Returns a new Uint8Array (skeleton) — does not modify the input.
 */
export function zhangSuenThin(binary, width, height) {
  const img = new Uint8Array(binary);
  const offsets = nbrOffsets(width);
  const marked = new Uint8Array(width * height);
  const p = new Uint8Array(8);

  let changed = true;
  while (changed) {
    changed = false;

    // --- Sub-iteration 1 ---
    marked.fill(0);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (!img[i]) continue;

        for (let k = 0; k < 8; k++) p[k] = img[i + offsets[k]];
        const B = p[0]+p[1]+p[2]+p[3]+p[4]+p[5]+p[6]+p[7];
        if (B < 2 || B > 6) continue;
        if (transitions(p) !== 1) continue;
        if (p[0] * p[2] * p[4] !== 0) continue; // P2*P4*P6
        if (p[2] * p[4] * p[6] !== 0) continue; // P4*P6*P8
        marked[i] = 1;
      }
    }
    for (let i = 0; i < marked.length; i++) {
      if (marked[i]) { img[i] = 0; changed = true; }
    }

    // --- Sub-iteration 2 ---
    marked.fill(0);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (!img[i]) continue;

        for (let k = 0; k < 8; k++) p[k] = img[i + offsets[k]];
        const B = p[0]+p[1]+p[2]+p[3]+p[4]+p[5]+p[6]+p[7];
        if (B < 2 || B > 6) continue;
        if (transitions(p) !== 1) continue;
        if (p[0] * p[2] * p[6] !== 0) continue; // P2*P4*P8
        if (p[0] * p[4] * p[6] !== 0) continue; // P2*P6*P8
        marked[i] = 1;
      }
    }
    for (let i = 0; i < marked.length; i++) {
      if (marked[i]) { img[i] = 0; changed = true; }
    }
  }

  return img;
}

/**
 * Spur pruning: iteratively removes dangling endpoint pixels.
 * Only removes an endpoint if its trunk neighbor has >1 neighbor —
 * this prevents collapsing legitimate 2-pixel isolated segments.
 * Modifies skeleton in-place. Returns it.
 */
export function pruneSpurs(skeleton, width, height, iterations) {
  for (let iter = 0; iter < iterations; iter++) {
    const toRemove = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!skeleton[i]) continue;

        let nbrCount = 0;
        let trunkIdx = -1;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const ni = ny * width + nx;
            if (skeleton[ni]) { nbrCount++; trunkIdx = ni; }
          }
        }

        if (nbrCount !== 1) continue; // not an endpoint

        // Guard: trunk must have >1 neighbor itself
        const tx = trunkIdx % width, ty = (trunkIdx / width) | 0;
        let trunkNbrCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = tx + dx, ny = ty + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            if (skeleton[ny * width + nx]) trunkNbrCount++;
          }
        }

        if (trunkNbrCount > 1) toRemove.push(i);
      }
    }

    if (toRemove.length === 0) break;
    for (const i of toRemove) skeleton[i] = 0;
  }

  return skeleton;
}

/**
 * Find all skeleton endpoint pixels (exactly 1 8-connected neighbor).
 */
export function findEndpoints(skeleton, width, height) {
  const endpoints = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!skeleton[i]) continue;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && skeleton[ny * width + nx]) count++;
        }
      }
      if (count === 1) endpoints.push({ x, y, idx: i });
    }
  }
  return endpoints;
}

/**
 * Walk along the skeleton from each endpoint inward, computing
 * the outward tangent direction at each endpoint.
 * Returns enriched array: [{ x, y, idx, dx, dy }, ...]
 */
export function computeEndpointDirections(skeleton, width, height, endpoints, lookback = 9) {
  return endpoints.map(ep => {
    const dir = walkTangent(skeleton, width, height, ep.x, ep.y, lookback);
    return { ...ep, dx: dir.dx, dy: dir.dy };
  });
}

function walkTangent(skeleton, width, height, startX, startY, lookback) {
  let prevX = startX, prevY = startY;
  let currX = -1, currY = -1;

  // Step 1: find the single neighbor of the endpoint
  outer:
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = startX + dx, ny = startY + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && skeleton[ny * width + nx]) {
        currX = nx; currY = ny;
        break outer;
      }
    }
  }

  if (currX < 0) return { dx: 0, dy: 1 }; // isolated pixel

  // Step 2: walk inward up to lookback steps
  for (let step = 1; step < lookback; step++) {
    let nextX = -1, nextY = -1;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = currX + dx, ny = currY + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        if (!skeleton[ny * width + nx]) continue;
        if (nx === prevX && ny === prevY) continue; // no backtrack
        nextX = nx; nextY = ny;
        break;
      }
      if (nextX >= 0) break;
    }
    if (nextX < 0) break;
    prevX = currX; prevY = currY;
    currX = nextX; currY = nextY;
  }

  // Direction: interior → endpoint (outward, away from the stroke body)
  const dx = startX - currX;
  const dy = startY - currY;
  const len = Math.sqrt(dx * dx + dy * dy);
  return len > 0 ? { dx: dx / len, dy: dy / len } : { dx: 0, dy: 1 };
}
