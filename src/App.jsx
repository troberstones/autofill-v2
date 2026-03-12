import { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import './App.css';

const MAX_HISTORY = 30;

export default function App() {
  const canvasRef = useRef(null);

  // Tool settings
  const [activeTool, setActiveTool] = useState('draw');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('#4a9eff');
  const [brushSize, setBrushSize] = useState(4);
  const [gapTolerance, setGapTolerance] = useState(4);
  const [status, setStatus] = useState('');

  // Undo history stored as ref (avoids re-renders on push)
  const historyRef = useRef([]);
  const [canUndo, setCanUndo] = useState(false);

  const pushHistory = useCallback((snapshot) => {
    historyRef.current = [...historyRef.current.slice(-MAX_HISTORY + 1), snapshot];
    setCanUndo(historyRef.current.length > 0);
  }, []);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length === 0) return;
    const snapshot = historyRef.current.pop();
    setCanUndo(historyRef.current.length > 0);
    const ctx = canvas.getContext('2d');
    ctx.putImageData(snapshot, 0, 0);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'd' || e.key === 'D') setActiveTool('draw');
      if (e.key === 'f' || e.key === 'F') setActiveTool('fill');
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
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
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          pushHistory(ctx.getImageData(0, 0, canvas.width, canvas.height));
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          const x = (canvas.width - w) / 2;
          const y = (canvas.height - h) / 2;
          ctx.drawImage(img, x, y, w, h);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [canvasRef, pushHistory]);

  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'line-fill.png';
    a.click();
  }, [canvasRef]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    pushHistory(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [canvasRef, pushHistory]);

  return (
    <div className="app">
      <Toolbar
        activeTool={activeTool} setActiveTool={setActiveTool}
        strokeColor={strokeColor} setStrokeColor={setStrokeColor}
        fillColor={fillColor} setFillColor={setFillColor}
        brushSize={brushSize} setBrushSize={setBrushSize}
        gapTolerance={gapTolerance} setGapTolerance={setGapTolerance}
        onImport={handleImport}
        onExport={handleExport}
        onClear={handleClear}
        onUndo={undo}
        canUndo={canUndo}
      />
      <Canvas
        canvasRef={canvasRef}
        activeTool={activeTool}
        strokeColor={strokeColor}
        brushSize={brushSize}
        fillColor={fillColor}
        gapTolerance={gapTolerance}
        onHistoryPush={pushHistory}
        onStatusChange={setStatus}
      />
      {status && (
        <div className="statusBar">{status}</div>
      )}
    </div>
  );
}
