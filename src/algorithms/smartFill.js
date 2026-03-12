/**
 * Smart flood fill with two-pass gap-tolerant algorithm.
 *
 * Pass 1: BFS using a dilated boundary (line pixels expanded by gapTolerance)
 *   → finds which region was clicked without leaking through gaps
 *   → produces a filledMask of pixels in the region
 *
 * Pass 2: BFS expands filledMask outward by gapTolerance, stopping at actual
 *   line pixels (not dilated ones) → fill reaches the real line edges, no white border
 *
 * Reads line data from artImageData, writes fill color to fillImageData.
 */
export function smartFill(artImageData, fillImageData, startX, startY, fillColor, options = {}) {
  const { gapTolerance = 4, lineThreshold = 128, boundaryImageData = null } = options;
  const { width, height } = artImageData;
  const artData = artImageData.data;
  const fillData = fillImageData.data;
  const total = width * height;
  const startIdx = startY * width + startX;

  // --- Step 1: Classify line pixels ---
  // If boundaryImageData is provided (skeleton + gap bridges), use alpha-based detection.
  // Otherwise fall back to luminance-based detection on the art layer.
  const isLine = new Uint8Array(total);
  if (boundaryImageData) {
    const bd = boundaryImageData.data;
    for (let i = 0; i < total; i++) {
      isLine[i] = bd[i * 4 + 3] > 0 ? 1 : 0;
    }
  } else {
    for (let i = 0; i < total; i++) {
      const r = artData[i * 4];
      const g = artData[i * 4 + 1];
      const b = artData[i * 4 + 2];
      const a = artData[i * 4 + 3];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      if (a > lineThreshold && luminance < lineThreshold) isLine[i] = 1;
    }
  }

  // --- Step 2: BFS dilation — expand line pixels outward by gapTolerance ---
  // Gaps up to 2*gapTolerance wide get bridged by the virtual boundary.
  const dilated = new Uint8Array(isLine);
  const dilateQueue = new Int32Array(total);
  const distFromLine = new Int32Array(total).fill(-1);
  let dHead = 0, dTail = 0;

  for (let i = 0; i < total; i++) {
    if (isLine[i]) { distFromLine[i] = 0; dilateQueue[dTail++] = i; }
  }

  while (dHead < dTail) {
    const idx = dilateQueue[dHead++];
    if (distFromLine[idx] >= gapTolerance) continue;
    const x = idx % width, y = (idx / width) | 0;
    if (x > 0         && distFromLine[idx - 1]     === -1) { distFromLine[idx - 1]     = distFromLine[idx] + 1; dilated[idx - 1]     = 1; dilateQueue[dTail++] = idx - 1; }
    if (x < width - 1 && distFromLine[idx + 1]     === -1) { distFromLine[idx + 1]     = distFromLine[idx] + 1; dilated[idx + 1]     = 1; dilateQueue[dTail++] = idx + 1; }
    if (y > 0         && distFromLine[idx - width] === -1) { distFromLine[idx - width] = distFromLine[idx] + 1; dilated[idx - width] = 1; dilateQueue[dTail++] = idx - width; }
    if (y < height - 1 && distFromLine[idx + width] === -1) { distFromLine[idx + width] = distFromLine[idx] + 1; dilated[idx + width] = 1; dilateQueue[dTail++] = idx + width; }
  }

  // --- Step 3: Validate start pixel ---
  if (dilated[startIdx]) {
    return { fillImageData, filled: 0, aborted: true, reason: 'start_on_boundary' };
  }

  // --- Step 4: Pass 1 — BFS flood fill using dilated boundary → filledMask ---
  // Identifies which region was clicked. Gaps are closed so fill can't leak.
  const filledMask = new Uint8Array(total);
  const pass1Queue = new Int32Array(total);
  let p1Head = 0, p1Tail = 0;

  filledMask[startIdx] = 1;
  pass1Queue[p1Tail++] = startIdx;

  while (p1Head < p1Tail) {
    const idx = pass1Queue[p1Head++];
    const x = idx % width, y = (idx / width) | 0;
    if (x > 0         && !filledMask[idx - 1]     && !dilated[idx - 1])     { filledMask[idx - 1]     = 1; pass1Queue[p1Tail++] = idx - 1; }
    if (x < width - 1 && !filledMask[idx + 1]     && !dilated[idx + 1])     { filledMask[idx + 1]     = 1; pass1Queue[p1Tail++] = idx + 1; }
    if (y > 0         && !filledMask[idx - width] && !dilated[idx - width]) { filledMask[idx - width] = 1; pass1Queue[p1Tail++] = idx - width; }
    if (y < height - 1 && !filledMask[idx + width] && !dilated[idx + width]) { filledMask[idx + width] = 1; pass1Queue[p1Tail++] = idx + width; }
  }

  // --- Step 5: Pass 2 — Expand filledMask outward to actual line edges ---
  // Starts from every pixel in filledMask and expands outward by gapTolerance,
  // stopping only at actual isLine pixels (not the dilated boundary).
  // This fills the "fringe zone" between the dilated boundary and real lines,
  // eliminating the white border. Safe from leaking: the expansion is bounded
  // to gapTolerance steps from a region that was already gap-closed in pass 1.
  const expandedMask = new Uint8Array(filledMask);
  const pass2Queue = new Int32Array(total);
  const distFromRegion = new Int32Array(total).fill(-1);
  let p2Head = 0, p2Tail = 0;

  for (let i = 0; i < total; i++) {
    if (filledMask[i]) { distFromRegion[i] = 0; pass2Queue[p2Tail++] = i; }
  }

  while (p2Head < p2Tail) {
    const idx = pass2Queue[p2Head++];
    if (distFromRegion[idx] >= gapTolerance) continue;
    const x = idx % width, y = (idx / width) | 0;

    const tryExpand = (nIdx) => {
      if (distFromRegion[nIdx] === -1 && !isLine[nIdx]) {
        distFromRegion[nIdx] = distFromRegion[idx] + 1;
        expandedMask[nIdx] = 1;
        pass2Queue[p2Tail++] = nIdx;
      }
    };
    if (x > 0)          tryExpand(idx - 1);
    if (x < width - 1)  tryExpand(idx + 1);
    if (y > 0)          tryExpand(idx - width);
    if (y < height - 1) tryExpand(idx + width);
  }

  // --- Step 6: Paint expandedMask to the fill canvas ---
  const fr = fillColor.r ?? 0;
  const fg = fillColor.g ?? 0;
  const fb = fillColor.b ?? 0;
  const fa = fillColor.a ?? 255;
  let filled = 0;

  for (let i = 0; i < total; i++) {
    if (expandedMask[i]) {
      const pi = i * 4;
      fillData[pi]     = fr;
      fillData[pi + 1] = fg;
      fillData[pi + 2] = fb;
      fillData[pi + 3] = fa;
      filled++;
    }
  }

  return { fillImageData, filled, aborted: false };
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
