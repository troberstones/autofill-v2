import { useEffect, useRef, useCallback } from 'react';
import { useDrawing } from '../hooks/useDrawing';
import { smartFill, hexToRgba } from '../algorithms/smartFill';
import styles from './Canvas.module.css';

export function Canvas({
  canvasRef,
  activeTool,
  strokeColor,
  brushSize,
  fillColor,
  gapTolerance,
  onHistoryPush,
  onStatusChange,
}) {
  const containerRef = useRef(null);

  // Initialize canvas size and fill with white
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      // Preserve existing content during resize
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      tmp.getContext('2d').drawImage(canvas, 0, 0);

      canvas.width = Math.floor(width * devicePixelRatio);
      canvas.height = Math.floor(height * devicePixelRatio);

      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (tmp.width > 0 && tmp.height > 0) {
        ctx.drawImage(tmp, 0, 0);
      }
    };

    let initialized = false;
    const resizeAndMaybeLoad = () => {
      resize();
      if (!initialized) {
        initialized = true;
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        };
        img.src = '/testFills.png';
      }
    };

    resizeAndMaybeLoad();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [canvasRef]);

  const handleHistorySnapshot = useCallback((phase) => {
    if (phase === 'before') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      onHistoryPush(snapshot);
    }
  }, [canvasRef, onHistoryPush]);

  const { startStroke, continueStroke, endStroke } = useDrawing({
    canvasRef,
    brushSize,
    strokeColor,
    onStrokeEnd: handleHistorySnapshot,
  });

  const handleFillClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const rgba = hexToRgba(fillColor);

    onStatusChange('Filling…');

    // Use setTimeout to let status render before the synchronous fill
    setTimeout(() => {
      const result = smartFill(imageData, x, y, rgba, { gapTolerance });
      if (result.aborted) {
        if (result.reason === 'start_on_boundary') {
          onStatusChange('Clicked on a line — try clicking inside a region');
        } else {
          onStatusChange('');
        }
        return;
      }
      // Push snapshot before applying fill
      const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      onHistoryPush(snapshot);
      ctx.putImageData(result.imageData, 0, 0);
      onStatusChange(`Filled ${result.filled.toLocaleString()} pixels`);
      setTimeout(() => onStatusChange(''), 2000);
    }, 16);
  }, [canvasRef, fillColor, gapTolerance, onHistoryPush, onStatusChange]);

  const handleMouseDown = useCallback((e) => {
    if (activeTool === 'draw') startStroke(e);
  }, [activeTool, startStroke]);

  const handleMouseMove = useCallback((e) => {
    if (activeTool === 'draw') continueStroke(e);
  }, [activeTool, continueStroke]);

  const handleMouseUp = useCallback((e) => {
    if (activeTool === 'draw') endStroke(e);
  }, [activeTool, endStroke]);

  const handleClick = useCallback((e) => {
    if (activeTool === 'fill') handleFillClick(e);
  }, [activeTool, handleFillClick]);

  const cursor = activeTool === 'fill' ? 'crosshair' : 'none';

  return (
    <div ref={containerRef} className={styles.container}>
      {activeTool === 'draw' && (
        <div
          className={styles.brushCursor}
          id="brushCursor"
          style={{ width: brushSize, height: brushSize }}
        />
      )}
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        style={{ cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => {
          handleMouseMove(e);
          // Move custom brush cursor
          if (activeTool === 'draw') {
            const el = document.getElementById('brushCursor');
            if (el) {
              el.style.left = e.clientX + 'px';
              el.style.top = e.clientY + 'px';
            }
          }
        }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      />
    </div>
  );
}
