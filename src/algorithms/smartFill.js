/**
 * Smart flood fill that closes gaps in line drawings.
 *
 * Uses BFS dilation to expand line pixels outward by `gapTolerance` pixels,
 * creating a virtual boundary that closes gaps up to 2*gapTolerance wide.
 * The actual flood fill uses this virtual boundary, then paints only on
 * non-line pixels to preserve stroke appearance.
 */
export function smartFill(imageData, startX, startY, fillColor, options = {}) {
  const { gapTolerance = 4, lineThreshold = 128 } = options;
  const { width, height, data } = imageData;

  const total = width * height;
  const startIdx = startY * width + startX;

  // --- Step 1: Classify pixels as line or background ---
  // A pixel is a "line" if it's dark (low luminance) or has high alpha,
  // meaning something was drawn there. Works for both drawn strokes and
  // imported images with dark lines on white.
  const isLine = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    // Drawn strokes: alpha-based. Imported images: luminance-based.
    if ((a > lineThreshold && luminance < lineThreshold) || (a === 255 && luminance < lineThreshold)) {
      isLine[i] = 1;
    }
  }

  // --- Step 2: BFS dilation to build virtual boundary ---
  // Expand each line pixel outward by `gapTolerance` steps.
  // This closes gaps up to 2*gapTolerance pixels wide.
  const dilated = new Uint8Array(isLine); // copy

  // BFS dilation: track distance from nearest line pixel
  // Use a typed array queue for performance (O(1) dequeue)
  const dilateQueue = new Int32Array(total);
  const dist = new Int32Array(total).fill(-1);
  let dHead = 0;
  let dTail = 0;

  for (let i = 0; i < total; i++) {
    if (isLine[i]) { dist[i] = 0; dilateQueue[dTail++] = i; }
  }

  while (dHead < dTail) {
    const idx = dilateQueue[dHead++];
    if (dist[idx] >= gapTolerance) continue;
    const x = idx % width;
    const y = Math.floor(idx / width);

    // 4-connected neighbors
    const neighbors = [];
    if (x > 0) neighbors.push(idx - 1);
    if (x < width - 1) neighbors.push(idx + 1);
    if (y > 0) neighbors.push(idx - width);
    if (y < height - 1) neighbors.push(idx + width);

    for (const nIdx of neighbors) {
      if (dist[nIdx] === -1) {
        dist[nIdx] = dist[idx] + 1;
        dilated[nIdx] = 1;
        dilateQueue[dTail++] = nIdx;
      }
    }
  }

  // --- Step 3: Validate start pixel ---
  if (dilated[startIdx]) {
    return { imageData, filled: 0, aborted: true, reason: 'start_on_boundary' };
  }

  // Parse fill color
  const fr = fillColor.r ?? 0;
  const fg = fillColor.g ?? 0;
  const fb = fillColor.b ?? 0;
  const fa = fillColor.a ?? 255;

  // Check if already this fill color
  const si = startIdx * 4;
  if (data[si] === fr && data[si + 1] === fg && data[si + 2] === fb && data[si + 3] === fa) {
    return { imageData, filled: 0, aborted: true, reason: 'already_filled' };
  }

  // --- Step 4: BFS flood fill using dilated boundary ---
  const visited = new Uint8Array(total);
  const fillQueue = new Int32Array(total);
  let fHead = 0;
  let fTail = 0;

  fillQueue[fTail++] = startIdx;
  visited[startIdx] = 1;
  let filled = 0;

  while (fHead < fTail) {
    const idx = fillQueue[fHead++];
    const x = idx % width;
    const y = Math.floor(idx / width);

    // Paint this pixel if it's not an actual line pixel
    if (!isLine[idx]) {
      const pi = idx * 4;
      data[pi] = fr;
      data[pi + 1] = fg;
      data[pi + 2] = fb;
      data[pi + 3] = fa;
      filled++;
    }

    // Enqueue 4-connected neighbors not blocked by dilated boundary
    const left = idx - 1;
    if (x > 0 && !visited[left] && !dilated[left]) {
      visited[left] = 1;
      fillQueue[fTail++] = left;
    }
    const right = idx + 1;
    if (x < width - 1 && !visited[right] && !dilated[right]) {
      visited[right] = 1;
      fillQueue[fTail++] = right;
    }
    const up = idx - width;
    if (y > 0 && !visited[up] && !dilated[up]) {
      visited[up] = 1;
      fillQueue[fTail++] = up;
    }
    const down = idx + width;
    if (y < height - 1 && !visited[down] && !dilated[down]) {
      visited[down] = 1;
      fillQueue[fTail++] = down;
    }
  }

  return { imageData, filled, aborted: false };
}

/** Convert a hex color string (#rrggbb) to { r, g, b, a } */
export function hexToRgba(hex, alpha = 255) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: alpha,
  };
}
