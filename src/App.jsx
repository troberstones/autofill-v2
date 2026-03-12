import { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import './App.css';

const MAX_HISTORY = 20;

function downloadCanvas(canvas, filename, whiteBackground = false) {
  let src = canvas;
  if (whiteBackground) {
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const ctx = tmp.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(canvas, 0, 0);
    src = tmp;
  }
  const a = document.createElement('a');
  a.href = src.toDataURL('image/png');
  a.download = filename;
  a.click();
}

export default function App() {
  const artCanvasRef      = useRef(null);
  const fillCanvasRef     = useRef(null);
  const boundaryCanvasRef = useRef(null);

  const [activeTool,   setActiveTool]   = useState('draw');
  const [strokeColor,  setStrokeColor]  = useState('#000000');
  const [fillColor,    setFillColor]    = useState('#4a9eff');
  const [brushSize,    setBrushSize]    = useState(4);
  const [gapTolerance, setGapTolerance] = useState(4);
  const [status,       setStatus]       = useState('');

  const [layerVisibility, setLayerVisibility] = useState({
    art: true, fill: true, boundary: false,
  });

  // Each history entry: { type: 'art'|'fill'|'both', artSnapshot?, fillSnapshot? }
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
    if (entry.artSnapshot)  artCanvasRef.current?.getContext('2d').putImageData(entry.artSnapshot, 0, 0);
    if (entry.fillSnapshot) fillCanvasRef.current?.getContext('2d').putImageData(entry.fillSnapshot, 0, 0);
  }, []);

  const handleToggleLayer = useCallback((key) => {
    setLayerVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleExportLayer = useCallback((key) => {
    const canvasMap = {
      art:      artCanvasRef.current,
      fill:     fillCanvasRef.current,
      boundary: boundaryCanvasRef.current,
    };
    const canvas = canvasMap[key];
    if (!canvas) return;
    // Art layer gets a white background so it renders correctly as a standalone file.
    // Fill and boundary are exported with transparency preserved.
    downloadCanvas(canvas, `layer-${key}.png`, key === 'art');
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
          const ctx = art.getContext('2d');
          pushHistory({ type: 'art', artSnapshot: ctx.getImageData(0, 0, art.width, art.height) });
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, art.width, art.height);
          const scale = Math.min(art.width / img.width, art.height / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (art.width - w) / 2, (art.height - h) / 2, w, h);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [pushHistory]);

  const handleExportComposite = useCallback(() => {
    const art  = artCanvasRef.current;
    const fill = fillCanvasRef.current;
    if (!art || !fill) return;
    const tmp = document.createElement('canvas');
    tmp.width = art.width;
    tmp.height = art.height;
    const ctx = tmp.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(fill, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(art, 0, 0);
    downloadCanvas(tmp, 'line-fill-composite.png');
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
        activeTool={activeTool}     setActiveTool={setActiveTool}
        strokeColor={strokeColor}   setStrokeColor={setStrokeColor}
        fillColor={fillColor}       setFillColor={setFillColor}
        brushSize={brushSize}       setBrushSize={setBrushSize}
        gapTolerance={gapTolerance} setGapTolerance={setGapTolerance}
        layerVisibility={layerVisibility}
        onToggleLayer={handleToggleLayer}
        onExportLayer={handleExportLayer}
        onImport={handleImport}
        onExportComposite={handleExportComposite}
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
        layerVisibility={layerVisibility}
        onHistoryPush={pushHistory}
        onStatusChange={setStatus}
      />
      {status && <div className="statusBar">{status}</div>}
    </div>
  );
}
