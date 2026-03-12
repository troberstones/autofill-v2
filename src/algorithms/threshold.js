/**
 * Image thresholding utilities — all pure functions, safe for Web Workers.
 *
 * Pipeline: autoLevels → adaptiveThreshold → binary Uint8Array
 */

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
