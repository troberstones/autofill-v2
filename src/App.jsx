import { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import './App.css';

const MAX_HISTORY = 20;

export default function App() {
  const artCanvasRef      = useRef(null);
  const fillCanvasRef     = useRef(null);
  const boundaryCanvasRef = useRef(null);

  const [activeTool,    setActiveTool]    = useState('draw');
  const [strokeColor,   setStrokeColor]   = useState('#000000');
  const [fillColor,     setFillColor]     = useState('#4a9eff');
  const [brushSize,     setBrushSize]     = useState(4);
  const [gapTolerance,  setGapTolerance]  = useState(4);
  const [status,        setStatus]        = useState('');

  // Each history entry: { type: 'art'|'fill'|'both', artSnapshot?, fillSnapshot? }
  // We only store the snapshot(s) that changed to conserve memory.
  const historyRef = useRef([]);
  const [canUndo, setCanUndo] = useState(false);

  const pushHistory = useCallback((entry) => {
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), entry];
    setCanUndo(true);
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const entry = historyRef.current.pop();
    setCanUndo(historyRef.current.length > 0);

    if (entry.artSnapshot) {
      const art = artCanvasRef.current;
      if (art) art.getContext('2d').putImageData(entry.artSnapshot, 0, 0);
    }
    if (entry.fillSnapshot) {
      const fill = fillCanvasRef.current;
      if (fill) fill.getContext('2d').putImageData(entry.fillSnapshot, 0, 0);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'd' || e.key === 'D') setActiveTool('draw');
      if (e.key === 'f' || e.key === 'F') setActiveTool('fill');
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const art = artCanvasRef.current;
          if (!art) return;
          const artCtx = art.getContext('2d');
          pushHistory({ type: 'art', artSnapshot: artCtx.getImageData(0, 0, art.width, art.height) });
          artCtx.fillStyle = '#ffffff';
          artCtx.fillRect(0, 0, art.width, art.height);
          const scale = Math.min(art.width / img.width, art.height / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          artCtx.drawImage(img, (art.width - w) / 2, (art.height - h) / 2, w, h);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [pushHistory]);

  const handleExport = useCallback(() => {
    const art  = artCanvasRef.current;
    const fill = fillCanvasRef.current;
    if (!art || !fill) return;

    // Composite: white background + fill layer + art layer (multiply)
    const tmp = document.createElement('canvas');
    tmp.width  = art.width;
    tmp.height = art.height;
    const ctx = tmp.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(fill, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(art, 0, 0);

    const a = document.createElement('a');
    a.href = tmp.toDataURL('image/png');
    a.download = 'line-fill.png';
    a.click();
  }, []);

  const handleClear = useCallback(() => {
    const art  = artCanvasRef.current;
    const fill = fillCanvasRef.current;
    if (!art || !fill) return;
    const artCtx  = art.getContext('2d');
    const fillCtx = fill.getContext('2d');

    pushHistory({
      type: 'both',
      artSnapshot:  artCtx.getImageData(0, 0, art.width, art.height),
      fillSnapshot: fillCtx.getImageData(0, 0, fill.width, fill.height),
    });

    artCtx.fillStyle = '#ffffff';
    artCtx.fillRect(0, 0, art.width, art.height);
    fillCtx.clearRect(0, 0, fill.width, fill.height);
  }, [pushHistory]);

  return (
    <div className="app">
      <Toolbar
        activeTool={activeTool}   setActiveTool={setActiveTool}
        strokeColor={strokeColor} setStrokeColor={setStrokeColor}
        fillColor={fillColor}     setFillColor={setFillColor}
        brushSize={brushSize}     setBrushSize={setBrushSize}
        gapTolerance={gapTolerance} setGapTolerance={setGapTolerance}
        onImport={handleImport}
        onExport={handleExport}
        onClear={handleClear}
        onUndo={undo}
        canUndo={canUndo}
      />
      <Canvas
        artCanvasRef={artCanvasRef}
        fillCanvasRef={fillCanvasRef}
        boundaryCanvasRef={boundaryCanvasRef}
        activeTool={activeTool}
        strokeColor={strokeColor}
        brushSize={brushSize}
        fillColor={fillColor}
        gapTolerance={gapTolerance}
        onHistoryPush={pushHistory}
        onStatusChange={setStatus}
      />
      {status && <div className="statusBar">{status}</div>}
    </div>
  );
}
