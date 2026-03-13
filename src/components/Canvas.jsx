import { useEffect, useRef, useCallback } from 'react';
import { useDrawing } from '../hooks/useDrawing';
import { smartFill, hexToRgba } from '../algorithms/smartFill';
import styles from './Canvas.module.css';

export function Canvas({
  artCanvasRef,
  fillCanvasRef,
  boundaryCanvasRef,
  endpointsCanvasRef,
  activeTool,
  strokeColor,
  brushSize,
  fillColor,
  gapTolerance,
  boundaryMode,
  layerVisibility,
  onHistoryPush,
  onStatusChange,
}) {
  const containerRef = useRef(null);

  // Resize a canvas to match the container, preserving its existing content.
  const resizeCanvas = useCallback((canvas, preserveContent = true, fillWhite = false) => {
    const container = containerRef.current;
    if (!canvas || !container) return;
    const { width, height } = container.getBoundingClientRect();
    const w = Math.floor(width * devicePixelRatio);
    const h = Math.floor(height * devicePixelRatio);
    if (canvas.width === w && canvas.height === h) return;

    let saved = null;
    if (preserveContent && canvas.width > 0 && canvas.height > 0) {
      saved = document.createElement('canvas');
      saved.width = canvas.width;
      saved.height = canvas.height;
      saved.getContext('2d').drawImage(canvas, 0, 0);
    }

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (fillWhite) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    if (saved) ctx.drawImage(saved, 0, 0);
  }, []);

  // Initialize all three canvases and load the default test image.
  useEffect(() => {
    const container = containerRef.current;
    const artCanvas       = artCanvasRef.current;
    const fillCanvas      = fillCanvasRef.current;
    const boundaryCanvas  = boundaryCanvasRef.current;
    const endpointsCanvas = endpointsCanvasRef.current;
    if (!container || !artCanvas || !fillCanvas || !boundaryCanvas || !endpointsCanvas) return;

    let initialized = false;

    const resize = () => {
      resizeCanvas(artCanvas, true, true);        // art: white background
      resizeCanvas(fillCanvas, true, false);      // fill: transparent background
      resizeCanvas(boundaryCanvas, true, false);
      resizeCanvas(endpointsCanvas, true, false); // endpoints: transparent
    };

    const init = () => {
      resize();
      if (!initialized) {
        initialized = true;
        const img = new Image();
        img.onload = () => {
          const art = artCanvasRef.current;
          if (!art) return;
          const ctx = art.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, art.width, art.height);
          const scale = Math.min(art.width / img.width, art.height / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (art.width - w) / 2, (art.height - h) / 2, w, h);
        };
        img.src = '/testFills.png';
      }
    };

    init();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [artCanvasRef, fillCanvasRef, boundaryCanvasRef, endpointsCanvasRef, resizeCanvas]);

  // Snapshot the art canvas before each stroke (for undo).
  const handleStrokeSnapshot = useCallback((phase) => {
    if (phase !== 'before') return;
    const art = artCanvasRef.current;
    if (!art) return;
    const snapshot = art.getContext('2d').getImageData(0, 0, art.width, art.height);
    onHistoryPush({ type: 'art', artSnapshot: snapshot });
  }, [artCanvasRef, onHistoryPush]);

  const { startStroke, continueStroke, endStroke } = useDrawing({
    canvasRef: artCanvasRef,
    brushSize,
    strokeColor,
    onStrokeEnd: handleStrokeSnapshot,
  });

  const handleFillClick = useCallback((e) => {
    const art = artCanvasRef.current;
    const fill = fillCanvasRef.current;
    if (!art || !fill) return;

    const rect = art.getBoundingClientRect();
    const scaleX = art.width / rect.width;
    const scaleY = art.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const artCtx = art.getContext('2d');
    const fillCtx = fill.getContext('2d');

    const artImageData  = artCtx.getImageData(0, 0, art.width, art.height);
    const fillImageData = fillCtx.getImageData(0, 0, fill.width, fill.height);
    const rgba = hexToRgba(fillColor);

    // When using skeleton mode, read boundary canvas as the line source
    let boundaryImageData = null;
    if (boundaryMode === 'skeleton' && boundaryCanvasRef.current) {
      const bCtx = boundaryCanvasRef.current.getContext('2d');
      boundaryImageData = bCtx.getImageData(0, 0, boundaryCanvasRef.current.width, boundaryCanvasRef.current.height);
    }

    onStatusChange('Filling…');

    setTimeout(() => {
      const result = smartFill(artImageData, fillImageData, x, y, rgba, {
        gapTolerance,
        boundaryImageData,
      });

      if (result.aborted) {
        onStatusChange(result.reason === 'start_on_boundary'
          ? 'Clicked on a line — try clicking inside a region'
          : '');
        return;
      }

      // Save fill canvas snapshot before committing (for undo).
      const snapshot = fillCtx.getImageData(0, 0, fill.width, fill.height);
      onHistoryPush({ type: 'fill', fillSnapshot: snapshot });

      fillCtx.putImageData(result.fillImageData, 0, 0);
      onStatusChange(`Filled ${result.filled.toLocaleString()} pixels`);
      setTimeout(() => onStatusChange(''), 2000);
    }, 16);
  }, [artCanvasRef, fillCanvasRef, fillColor, gapTolerance, onHistoryPush, onStatusChange]);

  const handleMouseDown = useCallback((e) => {
    if (activeTool === 'draw') startStroke(e);
  }, [activeTool, startStroke]);

  const handleMouseMove = useCallback((e) => {
    if (activeTool === 'draw') continueStroke(e);
    if (activeTool === 'draw') {
      const el = document.getElementById('brushCursor');
      if (el) { el.style.left = e.clientX + 'px'; el.style.top = e.clientY + 'px'; }
    }
  }, [activeTool, continueStroke]);

  const handleMouseUp = useCallback((e) => {
    if (activeTool === 'draw') endStroke(e);
  }, [activeTool, endStroke]);

  const handleClick = useCallback((e) => {
    if (activeTool === 'fill') handleFillClick(e);
  }, [activeTool, handleFillClick]);

  return (
    <div ref={containerRef} className={styles.container}>
      {activeTool === 'draw' && (
        <div
          id="brushCursor"
          className={styles.brushCursor}
          style={{ width: brushSize, height: brushSize }}
        />
      )}

      {/* Layer order: fill → boundary → art (multiply) → endpoints (pointer-events: none) */}
      <canvas ref={fillCanvasRef}     className={styles.layerCanvas} style={{ visibility: layerVisibility.fill      ? 'visible' : 'hidden' }} />
      <canvas ref={boundaryCanvasRef} className={styles.layerCanvas} style={{ visibility: layerVisibility.boundary  ? 'visible' : 'hidden' }} />
      <canvas
        ref={artCanvasRef}
        className={`${styles.layerCanvas} ${styles.artCanvas}`}
        style={{
          cursor: activeTool === 'fill' ? 'crosshair' : 'none',
          visibility: layerVisibility.art ? 'visible' : 'hidden',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      />
      {/* Endpoints layer — purely visual, never receives pointer events */}
      <canvas
        ref={endpointsCanvasRef}
        className={styles.layerCanvas}
        style={{
          visibility: layerVisibility.endpoints ? 'visible' : 'hidden',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
