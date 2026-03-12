import { useRef, useCallback } from 'react';

/**
 * Encapsulates draw-mode canvas logic.
 * Returns event handlers to attach to the canvas element.
 */
export function useDrawing({ canvasRef, brushSize, strokeColor, onStrokeEnd }) {
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);

  const getPos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, [canvasRef]);

  const startStroke = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Save snapshot before stroke begins
    onStrokeEnd?.('before');

    const ctx = canvas.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = strokeColor;
    ctx.fill();

    isDrawingRef.current = true;
    lastPointRef.current = pos;
  }, [canvasRef, brushSize, strokeColor, getPos, onStrokeEnd]);

  const continueStroke = useCallback((e) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);
    const last = lastPointRef.current;

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastPointRef.current = pos;
  }, [canvasRef, brushSize, strokeColor, getPos]);

  const endStroke = useCallback((e) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    onStrokeEnd?.('after');
  }, [onStrokeEnd]);

  return { startStroke, continueStroke, endStroke };
}
