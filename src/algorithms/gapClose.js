import { findEndpoints, computeEndpointDirections } from './skeleton.js';

/**
 * Find compatible endpoint pairs and draw Bézier bridges onto the boundary canvas.
 *
 * Pairing rules:
 *   1. Distance between endpoints < maxDist (in skeleton pixel space)
 *   2. dot(dirA, dirB) < dotThreshold  → they face each other
 *   3. dot(dirA, normalize(B−A)) > 0   → B is ahead of A (not behind)
 *
 * Bridges are drawn as cubic Béziers using the outward tangent at each endpoint
 * as the control point direction.
 *
 * @param {Uint8Array} skeleton - flat binary array at (skelW × skelH)
 * @param {number} skelW / skelH - skeleton resolution
 * @param {CanvasRenderingContext2D} ctx - boundary canvas context (full DPR resolution)
 * @param {number} canvasW / canvasH - boundary canvas pixel dimensions
 * @param {object} options
 * @returns {{ endpointCount, bridgeCount }}
 */
export function closeGaps(skeleton, skelW, skelH, ctx, canvasW, canvasH, options = {}) {
  const {
    maxDist      = 40,   // skeleton pixels
    dotThreshold = -0.2, // facing threshold (more negative = stricter)
    lookback     = 10,   // pixels to walk back for direction
    controlScale = 0.4,  // control point distance as fraction of gap length
  } = options;

  const scaleX = canvasW / skelW;
  const scaleY = canvasH / skelH;

  const endpoints = findEndpoints(skeleton, skelW, skelH);
  const withDirs  = computeEndpointDirections(skeleton, skelW, skelH, endpoints, lookback);

  // Build candidate pairs
  const candidates = [];
  for (let i = 0; i < withDirs.length; i++) {
    for (let j = i + 1; j < withDirs.length; j++) {
      const a = withDirs[i], b = withDirs[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 2 || dist > maxDist) continue;

      // Facing each other check
      if (a.dx * b.dx + a.dy * b.dy > dotThreshold) continue;

      // B must be roughly ahead of A (not behind it)
      if (a.dx * (dx / dist) + a.dy * (dy / dist) < 0.1) continue;

      candidates.push({ i, j, dist });
    }
  }

  // Greedy assignment: closest compatible pairs first
  candidates.sort((a, b) => a.dist - b.dist);
  const used = new Set();

  ctx.save();
  ctx.strokeStyle = 'rgb(217, 108, 0)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.imageSmoothingEnabled = false;

  let bridgeCount = 0;
  for (const { i, j, dist } of candidates) {
    if (used.has(i) || used.has(j)) continue;

    const a = withDirs[i], b = withDirs[j];
    const t = dist * controlScale;

    // Map from skeleton space → canvas space
    const ax = a.x * scaleX, ay = a.y * scaleY;
    const bx = b.x * scaleX, by = b.y * scaleY;
    const c1x = ax + a.dx * t * scaleX, c1y = ay + a.dy * t * scaleY;
    const c2x = bx + b.dx * t * scaleX, c2y = by + b.dy * t * scaleY;

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, bx, by);
    ctx.stroke();

    used.add(i);
    used.add(j);
    bridgeCount++;
  }

  ctx.restore();

  // Collect endpoints that were NOT connected (open ends)
  const openEndpoints = withDirs
    .filter((_, i) => !used.has(i))
    .map(ep => ({
      x: ep.x * scaleX,
      y: ep.y * scaleY,
    }));

  return { endpointCount: endpoints.length, bridgeCount, openEndpoints };
}
