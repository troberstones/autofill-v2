import styles from './Toolbar.module.css';

export function Toolbar({
  activeTool, setActiveTool,
  strokeColor, setStrokeColor,
  fillColor, setFillColor,
  brushSize, setBrushSize,
  gapTolerance, setGapTolerance,
  layerVisibility, onToggleLayer, onExportLayer,
  onImport, onExportComposite, onClear, onUndo,
  canUndo,
}) {
  return (
    <div className={styles.toolbar}>
      {/* Tool selection */}
      <div className={styles.group}>
        <button
          className={`${styles.toolBtn} ${activeTool === 'draw' ? styles.active : ''}`}
          onClick={() => setActiveTool('draw')}
          title="Draw (D)"
        >
          <PenIcon />
          <span>Draw</span>
        </button>
        <button
          className={`${styles.toolBtn} ${activeTool === 'fill' ? styles.active : ''}`}
          onClick={() => setActiveTool('fill')}
          title="Fill (F)"
        >
          <BucketIcon />
          <span>Fill</span>
        </button>
      </div>

      <div className={styles.divider} />

      {/* Colors */}
      <div className={styles.group}>
        <label className={styles.colorLabel} title="Stroke color">
          <span className={styles.labelText}>Stroke</span>
          <span className={styles.colorSwatch} style={{ background: strokeColor }} />
          <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className={styles.colorInput} />
        </label>
        <label className={styles.colorLabel} title="Fill color">
          <span className={styles.labelText}>Fill</span>
          <span className={styles.colorSwatch} style={{ background: fillColor }} />
          <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} className={styles.colorInput} />
        </label>
      </div>

      <div className={styles.divider} />

      {/* Brush size */}
      <div className={styles.group}>
        <div className={styles.sliderGroup}>
          <label className={styles.sliderLabel}>Brush <strong>{brushSize}px</strong></label>
          <input type="range" min={1} max={40} value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className={styles.slider} disabled={activeTool !== 'draw'} />
        </div>
      </div>

      <div className={styles.divider} />

      {/* Gap tolerance */}
      <div className={styles.group}>
        <div className={styles.sliderGroup}>
          <label className={styles.sliderLabel} title="Closes gaps up to 2× this value wide">
            Gap <strong>{gapTolerance}px</strong>
          </label>
          <input type="range" min={0} max={20} value={gapTolerance}
            onChange={(e) => setGapTolerance(Number(e.target.value))}
            className={styles.slider} disabled={activeTool !== 'fill'} />
        </div>
      </div>

      <div className={styles.divider} />

      {/* Layers */}
      <div className={styles.group}>
        <div className={styles.layersPanel}>
          <span className={styles.layersLabel}>Layers</span>
          <div className={styles.layerRows}>
            {[
              { key: 'art',      label: 'Art',      dot: '#888' },
              { key: 'fill',     label: 'Fill',     dot: '#4a9eff' },
              { key: 'boundary', label: 'Boundary', dot: '#f90' },
            ].map(({ key, label, dot }) => (
              <div key={key} className={styles.layerRow}>
                <button
                  className={`${styles.eyeBtn} ${layerVisibility[key] ? styles.eyeOn : styles.eyeOff}`}
                  onClick={() => onToggleLayer(key)}
                  title={`Toggle ${label} layer`}
                >
                  {layerVisibility[key] ? <EyeIcon /> : <EyeOffIcon />}
                </button>
                <span className={styles.layerDot} style={{ background: dot }} />
                <span className={styles.layerName}>{label}</span>
                <button
                  className={styles.layerExportBtn}
                  onClick={() => onExportLayer(key)}
                  title={`Export ${label} layer`}
                >
                  <ExportIcon />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Actions */}
      <div className={styles.group}>
        <button className={styles.actionBtn} onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <UndoIcon /> Undo
        </button>
        <button className={styles.actionBtn} onClick={onImport} title="Import image">
          <ImportIcon /> Import
        </button>
        <button className={styles.actionBtn} onClick={onExportComposite} title="Export composited PNG">
          <ExportIcon /> Export
        </button>
        <button className={`${styles.actionBtn} ${styles.danger}`} onClick={onClear} title="Clear canvas">
          <ClearIcon /> Clear
        </button>
      </div>
    </div>
  );
}

function PenIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>;
}
function BucketIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 11-8-8-8.5 8.5a5.5 5.5 0 0 0 7.78 7.78L19 11Z"/><path d="m19 11 2 2a2.5 2.5 0 0 1 0 3.5"/><circle cx="20" cy="21" r="1"/></svg>;
}
function UndoIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>;
}
function ImportIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
}
function ExportIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}
function ClearIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
}
function EyeIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function EyeOffIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>;
}
