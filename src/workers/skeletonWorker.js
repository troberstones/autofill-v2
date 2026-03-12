import { autoLevels, adaptiveThreshold } from '../algorithms/threshold.js';
import { zhangSuenThin, pruneSpurs } from '../algorithms/skeleton.js';

self.onmessage = ({ data }) => {
  if (data.type !== 'skeletonize') return;
  const { luminance, width, height, spurLength, windowSize, bias } = data;

  // 1. Stretch contrast so faint pencil lines become clearly dark
  const leveled = autoLevels(luminance, width * height);

  // 2. Adaptive threshold — each pixel vs. its local neighborhood average
  const binary = adaptiveThreshold(leveled, width, height, windowSize, bias);

  // 3. Zhang-Suen thinning → 1px skeleton
  const skeleton = zhangSuenThin(binary, width, height);

  // 4. Remove short spur branches from noise / texture
  if (spurLength > 0) pruneSpurs(skeleton, width, height, spurLength);

  self.postMessage({ type: 'skeleton_done', skeleton, width, height }, [skeleton.buffer]);
};
