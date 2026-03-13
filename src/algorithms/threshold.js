/**
 * Image thresholding utilities — all pure functions, safe for Web Workers.
 *
 * Pipeline: autoLevels → adaptiveThreshold → binary Uint8Array
 */

/**
 * Separable box blur on a Float32Array of luminance values.
 * Two O(n) sliding-window passes (horizontal then vertical) — fast regardless of radius.
 *
 * Applied before adaptive thresholding so nearby faint pixels reinforce each
 * other and small gaps within a stroke get filled before the binary decision.
 *
 * @param {Float32Array} luminance
 * @param {number}       width / height
 * @param {number}       radius   0 = no-op; 1–10 useful range
 * @returns {Float32Array}
 */
export function boxBlur(luminance, width, height, radius) {
  if (radius < 1) return luminance;

  const tmp = new Float32Array(luminance.length);
  const out = new Float32Array(luminance.length);

  // --- Horizontal pass: luminance → tmp ---
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    // Seed window with pixels [0 .. min(radius, width-1)]
    for (let x = 0; x <= Math.min(radius, width - 1); x++) sum += luminance[row + x];

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      tmp[row + x] = sum / (x1 - x0 + 1);
      // Slide right: remove leftmost, add new rightmost
      if (x - radius >= 0)         sum -= luminance[row + x - radius];
      if (x + radius + 1 < width)  sum += luminance[row + x + radius + 1];
    }
  }

  // --- Vertical pass: tmp → out ---
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = 0; y <= Math.min(radius, height - 1); y++) sum += tmp[y * width + x];

    for (let y = 0; y < height; y++) {
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(height - 1, y + radius);
      out[y * width + x] = sum / (y1 - y0 + 1);
      if (y - radius >= 0)          sum -= tmp[(y - radius) * width + x];
      if (y + radius + 1 < height)  sum += tmp[(y + radius + 1) * width + x];
    }
  }

  return out;
}

/**
 * Percentile-based auto-levels on a Float32Array of luminance values.
 * Clips the darkest 2% and brightest 2% of pixels, then stretches the
 * remaining range to [0, 255]. Handles faint pencil scans by punching
 * up contrast without being thrown off by isolated outlier pixels.
 *
 * @param {Float32Array} luminance  Per-pixel luminance [0..255]
 * @param {number}       total      Width × height
 * @returns {Float32Array}          Stretched luminance [0..255]
 */
export function autoLevels(luminance, total) {
  // Build 256-bin histogram
  const hist = new Uint32Array(256);
  for (let i = 0; i < total; i++) {
    hist[Math.min(255, Math.max(0, luminance[i] | 0))]++;
  }

  // Find 2nd and 98th percentile
  const clip = total * 0.02;
  let minL = 0, maxL = 255;

  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= clip) { minL = v; break; }
  }

  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= clip) { maxL = v; break; }
  }

  if (maxL <= minL) return luminance; // degenerate image

  const inv = 255 / (maxL - minL);
  const out = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    out[i] = Math.min(255, Math.max(0, (luminance[i] - minL) * inv));
  }
  return out;
}

/**
 * Adaptive (local) thresholding using an integral image for O(1) window sums.
 *
 * A pixel is classified as a line if its luminance is more than `bias` below
 * the mean luminance of its local window. Works across regions with varying
 * background brightness — essential for pencil sketches.
 *
 * @param {Float32Array} luminance   Luminance values [0..255] (post-autoLevels)
 * @param {number}       width
 * @param {number}       height
 * @param {number}       windowSize  Local neighborhood size in pixels (should be odd, e.g. 31)
 * @param {number}       bias        How much darker than local mean = line. Lower = more sensitive.
 * @returns {Uint8Array}             Binary mask: 1 = line pixel
 */
export function adaptiveThreshold(luminance, width, height, windowSize, bias) {
  const half = windowSize >> 1;

  // Integral image: (width+1) × (height+1), Float64 to avoid precision loss
  const W = width + 1;
  const integral = new Float64Array(W * (height + 1));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      integral[(y + 1) * W + (x + 1)] =
        luminance[y * width + x]
        + integral[y * W + (x + 1)]
        + integral[(y + 1) * W + x]
        - integral[y * W + x];
    }
  }

  const binary = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height - 1, y + half);

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width - 1, x + half);

      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integral[(y1 + 1) * W + (x1 + 1)]
        - integral[y0 * W + (x1 + 1)]
        - integral[(y1 + 1) * W + x0]
        + integral[y0 * W + x0];

      const localMean = sum / count;
      binary[y * width + x] = luminance[y * width + x] < localMean - bias ? 1 : 0;
    }
  }

  return binary;
}
