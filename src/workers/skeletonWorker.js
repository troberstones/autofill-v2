import { zhangSuenThin, pruneSpurs } from '../algorithms/skeleton.js';

self.onmessage = ({ data }) => {
  if (data.type !== 'skeletonize') return;
  const { pixels, width, height, spurLength } = data;

  const skeleton = zhangSuenThin(pixels, width, height);
  if (spurLength > 0) pruneSpurs(skeleton, width, height, spurLength);

  // Transfer the buffer back to avoid copying
  self.postMessage({ type: 'skeleton_done', skeleton, width, height }, [skeleton.buffer]);
};
