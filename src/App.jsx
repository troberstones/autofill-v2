import { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { ProcessToolbar } from './components/ProcessToolbar';
import { closeGaps } from './algorithms/gapClose.js';
import './App.css';

const MAX_HISTORY    = 20;
const MAX_SKEL_WIDTH = 1200; // cap skeleton resolution to keep worker fast

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

  // Tool settings
  const [activeTool,   setActiveTool]   = useState('draw');
  const [strokeColor,  setStrokeColor]  = useState('#000000');
  const [fillColor,    setFillColor]    = useState('#4a9eff');
  const [brushSize,    setBrushSize]    = useState(4);
  const [gapTolerance, setGapTolerance] = useState(4);
  const [status,       setStatus]       = useState('');

  // Layer visibility
  const [layerVisibility, setLayerVisibility] = useState({
    art: true, fill: true, boundary: true,
  });

  // Skeleton / process state
  const workerRef      = useRef(null);
  const skeletonRef    = useRef(null); // { data: Uint8Array, width, height } | null
  const [spurLength,    setSpurLength]    = useState(8);
  const [maxGapDist,    setMaxGapDist]    = useState(30);
  const [windowSize,    setWindowSize]    = useState(31); // adaptive threshold window (px)
  const [bias,          setBias]          = useState(10); // luminance units below local mean = line
  const [boundaryMode,  setBoundaryMode]  = useState('art'); // 'art' | 'skeleton'
  const [isProcessing,  setIsProcessing]  = useState(false);
  const [hasSkeleton,   setHasSkeleton]   = useState(false);
  const [processStatus, setProcessStatus] = useState('');

  // History — each entry: { type: 'art'|'fill'|'both', artSnapshot?, fillSnapshot? }
  const historyRef = useRef([]);
  const [canUndo, setCanUndo] = useState(false);

  // ── Worker setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const worker = new Worker(
      new URL('./workers/skeletonWorker.js', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = ({ data }) => {
      if (data.type !== 'skeleton_done') return;
      const { skeleton, width, height } = data;

      // Store skeleton for future re-processing
      skeletonRef.current = { data: skeleton, width, height };

      // Render skeleton + run gap closing on boundary canvas
      const boundary = boundaryCanvasRef.current;
      if (boundary) {
        const ctx = boundary.getContext('2d');
        ctx.clearRect(0, 0, boundary.width, boundary.height);

        // Draw skeleton (orange) scaled up to full canvas resolution
        const imgData = new ImageData(width, height);
        for (let i = 0; i < skeleton.length; i++) {
          if (skeleton[i]) {
            imgData.data[i * 4]     = 217;
            imgData.data[i * 4 + 1] = 108;
            imgData.data[i * 4 + 2] = 0;
            imgData.data[i * 4 + 3] = 255;
          }
        }
        // Draw to an offscreen canvas at skeleton resolution, then scale to boundary canvas
        const offscreen = document.createElement('canvas');
        offscreen.width = width; offscreen.height = height;
        offscreen.getContext('2d').putImageData(imgData, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(offscreen, 0, 0, boundary.width, boundary.height);

        // Gap closing: draw Bézier bridges on top of skeleton
        const result = closeGaps(skeleton, width, height, ctx, boundary.width, boundary.height, {
          maxDist:  maxGapDistRef.current,
          lookback: 10,
        });

        setProcessStatus(`${result.endpointCount} endpoints · ${result.bridgeCount} bridges`);
      }

      setHasSkeleton(true);
      setBoundaryMode('skeleton');
      setIsProcessing(false);
    };

    worker.onerror = (err) => {
      console.error('Skeleton worker error:', err);
      setIsProcessing(false);
      setProcessStatus('Error during processing');
    };

    return () => worker.terminate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep a ref to maxGapDist so the worker callback can read the current value
  const maxGapDistRef = useRef(maxGapDist);
  useEffect(() => { maxGapDistRef.current = maxGapDist; }, [maxGapDist]);

  // ── History ───────────────────────────────────────────────────────────────────
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

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
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

  // ── Process (skeletonize + gap close) ────────────────────────────────────────
  const handleProcess = useCallback(() => {
    const art = artCanvasRef.current;
    if (!art || isProcessing) return;

    setIsProcessing(true);
    setProcessStatus('Extracting lines…');

    // Downsample to capped resolution for performance
    const scale = Math.min(1, MAX_SKEL_WIDTH / art.width);
    const sw = Math.floor(art.width * scale);
    const sh = Math.floor(art.height * scale);

    const offscreen = document.createElement('canvas');
    offscreen.width = sw; offscreen.height = sh;
    offscreen.getContext('2d').drawImage(art, 0, 0, sw, sh);
    const imgData = offscreen.getContext('2d').getImageData(0, 0, sw, sh);

    // Extract per-pixel luminance (transparent pixels → 255 = white background)
    const luminance = new Float32Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) {
      const r = imgData.data[i * 4];
      const g = imgData.data[i * 4 + 1];
      const b = imgData.data[i * 4 + 2];
      const a = imgData.data[i * 4 + 3];
      luminance[i] = a < 128 ? 255 : 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // Send raw luminance to worker — it handles auto-levels + adaptive threshold
    workerRef.current.postMessage(
      { type: 'skeletonize', luminance, width: sw, height: sh, spurLength, windowSize, bias },
      [luminance.buffer]
    );
  }, [isProcessing, spurLength]);

  // ── Layers ────────────────────────────────────────────────────────────────────
  const handleToggleLayer = useCallback((key) => {
    setLayerVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleExportLayer = useCallback((key) => {
    const map = { art: artCanvasRef, fill: fillCanvasRef, boundary: boundaryCanvasRef };
    const canvas = map[key]?.current;
    if (!canvas) return;
    downloadCanvas(canvas, `layer-${key}.png`, key === 'art');
  }, []);

  // ── Import / Export / Clear ───────────────────────────────────────────────────
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
          const w = img.width * scale, h = img.height * scale;
          ctx.drawImage(img, (art.width - w) / 2, (art.height - h) / 2, w, h);
          // Importing new art invalidates the skeleton
          skeletonRef.current = null;
          setHasSkeleton(false);
          setBoundaryMode('art');
          setProcessStatus('');
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
    tmp.width = art.width; tmp.height = art.height;
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
    const boundary = boundaryCanvasRef.current;
    if (!art || !fill) return;
    const artCtx = art.getContext('2d');
    const fillCtx = fill.getContext('2d');
    pushHistory({
      type: 'both',
      artSnapshot:  artCtx.getImageData(0, 0, art.width, art.height),
      fillSnapshot: fillCtx.getImageData(0, 0, fill.width, fill.height),
    });
    artCtx.fillStyle = '#ffffff';
    artCtx.fillRect(0, 0, art.width, art.height);
    fillCtx.clearRect(0, 0, fill.width, fill.height);
    if (boundary) boundary.getContext('2d').clearRect(0, 0, boundary.width, boundary.height);
    skeletonRef.current = null;
    setHasSkeleton(false);
    setBoundaryMode('art');
    setProcessStatus('');
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
      <ProcessToolbar
        spurLength={spurLength}   setSpurLength={setSpurLength}
        maxGapDist={maxGapDist}   setMaxGapDist={setMaxGapDist}
        windowSize={windowSize}   setWindowSize={setWindowSize}
        bias={bias}               setBias={setBias}
        boundaryMode={boundaryMode} setBoundaryMode={setBoundaryMode}
        onProcess={handleProcess}
        isProcessing={isProcessing}
        hasSkeleton={hasSkeleton}
        processStatus={processStatus}
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
        boundaryMode={boundaryMode}
        layerVisibility={layerVisibility}
        onHistoryPush={pushHistory}
        onStatusChange={setStatus}
      />
      {status && <div className="statusBar">{status}</div>}
    </div>
  );
}
