import styles from './ProcessToolbar.module.css';

export function ProcessToolbar({
  spurLength, setSpurLength,
  maxGapDist, setMaxGapDist,
  blurRadius, setBlurRadius,
  windowSize, setWindowSize,
  bias, setBias,
  boundaryMode, setBoundaryMode,
  onProcess,
  isProcessing,
  hasSkeleton,
  processStatus,
}) {
  return (
    <div className={styles.bar}>
      <span className={styles.sectionLabel}>Skeleton</span>

      <button
        className={`${styles.btn} ${styles.primary}`}
        onClick={onProcess}
        disabled={isProcessing}
        title="Extract skeleton from line art, then close gaps"
      >
        {isProcessing ? <SpinnerIcon /> : <SkeletonIcon />}
        {isProcessing ? 'Processing…' : 'Process'}
      </button>

      <div className={styles.sliderGroup}>
        <label className={styles.sliderLabel} title="Blur radius applied before thresholding — knits faint nearby pixels together">
          Blur <strong>{blurRadius === 0 ? 'off' : `${blurRadius}px`}</strong>
        </label>
        <input type="range" min={0} max={10} value={blurRadius}
          onChange={e => setBlurRadius(Number(e.target.value))}
          className={styles.slider} disabled={isProcessing} />
      </div>

      <div className={styles.sliderGroup}>
        <label className={styles.sliderLabel} title="Adaptive threshold window size — larger captures more context">
          Window <strong>{windowSize}px</strong>
        </label>
        <input type="range" min={7} max={81} step={2} value={windowSize}
          onChange={e => setWindowSize(Number(e.target.value))}
          className={styles.slider} disabled={isProcessing} />
      </div>

      <div className={styles.sliderGroup}>
        <label className={styles.sliderLabel} title="Lower = captures lighter/finer strokes. Higher = only darkest marks.">
          Sensitivity <strong>{bias}</strong>
        </label>
        <input type="range" min={1} max={40} value={bias}
          onChange={e => setBias(Number(e.target.value))}
          className={styles.slider} disabled={isProcessing} />
      </div>

      <div className={styles.sliderGroup}>
        <label className={styles.sliderLabel}>Spur <strong>{spurLength}px</strong></label>
        <input type="range" min={0} max={20} value={spurLength}
          onChange={e => setSpurLength(Number(e.target.value))}
          className={styles.slider} disabled={isProcessing} />
      </div>

      <div className={styles.sliderGroup}>
        <label className={styles.sliderLabel}>Max gap <strong>{maxGapDist}px</strong></label>
        <input type="range" min={2} max={100} value={maxGapDist}
          onChange={e => setMaxGapDist(Number(e.target.value))}
          className={styles.slider} disabled={isProcessing} />
      </div>

      <div className={styles.divider} />

      <span className={styles.sectionLabel}>Fill boundary</span>

      <div className={styles.modeToggle}>
        <button
          className={`${styles.modeBtn} ${boundaryMode === 'art' ? styles.modeActive : ''}`}
          onClick={() => setBoundaryMode('art')}
          title="Use original line art as fill boundary"
        >
          Art
        </button>
        <button
          className={`${styles.modeBtn} ${boundaryMode === 'skeleton' ? styles.modeActive : ''}`}
          onClick={() => setBoundaryMode('skeleton')}
          disabled={!hasSkeleton}
          title="Use skeleton + gap bridges as fill boundary"
        >
          Skeleton
        </button>
      </div>

      {processStatus && (
        <span className={styles.status}>{processStatus}</span>
      )}
    </div>
  );
}

function SkeletonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16"/><path d="M4 4h16"/><path d="M9 4v4"/><path d="M15 4v4"/><path d="M9 16v4"/><path d="M15 16v4"/><path d="M4 12h16"/><path d="M9 8a3 3 0 0 0 6 0"/><path d="M9 16a3 3 0 0 1 6 0"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}
