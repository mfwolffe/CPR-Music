'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMultitrack } from './MultitrackContext';
import waveformCache from '../components/audio/DAW/Multitrack/WaveformCache';

export default function TrackClipCanvas({ track, zoomLevel = 100, height = 100 }) {
  const {
    currentTime,
    duration,
    selectedTrackId,
    setSelectedTrackId,
    selectedClipId,
    setSelectedClipId,
    editorTool,
    snapEnabled,
    gridSizeSec,
    setTracks,
  } = useMultitrack();

  const canvasRef = useRef(null);
  const dragRef = useRef({ op: null, clipIndex: -1, startX: 0, pxPerSecCSS: 1, orig: null });
  const [peaksCache, setPeaksCache] = useState(new Map()); // clip.id -> peaks
  const clips = Array.isArray(track?.clips) ? track.clips : [];

  const interactive = editorTool === 'clip' && selectedTrackId === track.id;
  const MIN_DUR = 0.02; // 20ms
  const HANDLE_W = 8;   // CSS px

  // Load peaks for all clips
  useEffect(() => {
    const loadPeaks = async () => {
      const newPeaksCache = new Map();
      
      for (const clip of clips) {
        if (!clip.src) continue;
        
        try {
          // Get the canvas width to calculate proper resolution
          const canvas = canvasRef.current;
          if (!canvas) continue;
          
          const rect = canvas.getBoundingClientRect();
          const projectDur = Math.max(1e-6, duration || 1);
          const scale = Math.max(0.01, zoomLevel / 100);
          const pxPerSec = (rect.width * scale) / projectDur;
          const clipWidthPx = Math.max(1, (clip.duration || 0) * pxPerSec);
          
          const peaks = await waveformCache.getPeaksForClip(
            clip.src,
            clip.offset || 0,
            clip.duration || 0,
            clipWidthPx,
            zoomLevel
          );
          
          newPeaksCache.set(clip.id, peaks);
        } catch (err) {
          console.warn(`Failed to load peaks for clip ${clip.id}:`, err);
        }
      }
      
      setPeaksCache(newPeaksCache);
    };
    
    loadPeaks();
  }, [clips, duration, zoomLevel]);

  const resizeToCSS = (canvas) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    return { dpr, width: canvas.width, height: canvas.height, cssWidth: rect.width, cssHeight: rect.height };
  };

  const clipRects = useMemo(() => {
    const projectDur = Math.max(1e-6, duration || 0);
    const scale = Math.max(0.01, zoomLevel / 100);
    return (W) => {
      const pxPerSec = (W * scale) / projectDur;
      return clips.map((c) => ({
        id: c.id,
        start: c.start || 0,
        duration: c.duration || 0,
        color: c.color || track?.color || '#7bafd4',
        x: Math.max(0, Math.floor((c.start || 0) * pxPerSec)),
        w: Math.max(1, Math.floor((c.duration || 0) * pxPerSec)),
      }));
    };
  }, [clips, duration, zoomLevel, track?.color]);

  // Draw waveform for a clip
  const drawWaveform = (ctx, clip, rect, dpr) => {
    const peaks = peaksCache.get(clip.id);
    if (!peaks || peaks.length === 0) return;
    
    const clipH = rect.h;
    const centerY = rect.y + clipH / 2;
    const amplitude = (clipH - 12 * dpr) / 2; // Leave some padding
    
    // Calculate how many peaks to draw per pixel
    const peaksPerPixel = peaks.length / rect.w;
    
    ctx.save();
    
    // Set up clipping region to contain waveform within clip bounds
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, clipH);
    ctx.clip();
    
    // Draw waveform
    ctx.strokeStyle = hexToRgba(rect.color, 0.7);
    ctx.fillStyle = hexToRgba(rect.color, 0.3);
    ctx.lineWidth = Math.max(1, dpr);
    
    // If we have more peaks than pixels, aggregate them
    if (peaksPerPixel > 1) {
      for (let x = 0; x < rect.w; x++) {
        const peakStart = Math.floor(x * peaksPerPixel);
        const peakEnd = Math.floor((x + 1) * peaksPerPixel);
        
        let min = 1.0;
        let max = -1.0;
        
        // Find min/max in this pixel's range
        for (let i = peakStart; i < peakEnd && i < peaks.length; i++) {
          if (peaks[i][0] < min) min = peaks[i][0];
          if (peaks[i][1] > max) max = peaks[i][1];
        }
        
        const yMin = centerY - max * amplitude;
        const yMax = centerY - min * amplitude;
        
        // Draw vertical line for this pixel
        ctx.beginPath();
        ctx.moveTo(rect.x + x, yMin);
        ctx.lineTo(rect.x + x, yMax);
        ctx.stroke();
      }
    } else {
      // We have fewer peaks than pixels, so interpolate
      ctx.beginPath();
      
      // Top line (max values)
      for (let i = 0; i < peaks.length; i++) {
        const x = rect.x + (i / (peaks.length - 1)) * rect.w;
        const y = centerY - peaks[i][1] * amplitude;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      // Bottom line (min values, reversed)
      for (let i = peaks.length - 1; i >= 0; i--) {
        const x = rect.x + (i / (peaks.length - 1)) * rect.w;
        const y = centerY - peaks[i][0] * amplitude;
        ctx.lineTo(x, y);
      }
      
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    
    // Draw center line
    ctx.strokeStyle = hexToRgba(rect.color, 0.2);
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.moveTo(rect.x, centerY);
    ctx.lineTo(rect.x + rect.w, centerY);
    ctx.stroke();
    
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    window.addEventListener('resize', draw);

    function draw() {
      const { dpr, width: W, height: H } = resizeToCSS(canvas);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, W, H);

      // Get clip rectangles
      const rects = clipRects(W);
      
      // Draw each clip
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        const clip = clips[i];
        const isSel = r.id === selectedClipId && selectedTrackId === track.id;
        
        // Clip background
        ctx.fillStyle = hexToRgba(r.color, isSel ? 0.2 : 0.12);
        ctx.fillRect(r.x, Math.floor(6 * dpr), r.w, H - Math.floor(12 * dpr));
        
        // Draw waveform
        drawWaveform(ctx, clip, {
          x: r.x,
          y: Math.floor(6 * dpr),
          w: r.w,
          h: H - Math.floor(12 * dpr),
          color: r.color
        }, dpr);
        
        // Clip border
        ctx.lineWidth = Math.max(1, Math.floor((isSel ? 2 : 1.5) * dpr));
        ctx.strokeStyle = hexToRgba(r.color, isSel ? 0.9 : 0.45);
        ctx.strokeRect(r.x + 0.5, Math.floor(6 * dpr) + 0.5, r.w - 1, H - Math.floor(12 * dpr) - 1);

        // Resize handles (only if selected)
        if (isSel) {
          const handleW = Math.max(4, Math.floor(HANDLE_W * dpr));
          ctx.fillStyle = hexToRgba('#ffffff', 0.7);
          ctx.fillRect(r.x, 0, handleW, H);
          ctx.fillRect(r.x + r.w - handleW, 0, handleW, H);
        }
        
        // Clip label (optional)
        if (r.w > 50 * dpr) {
          ctx.fillStyle = hexToRgba('#ffffff', 0.8);
          ctx.font = `${Math.floor(11 * dpr)}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const label = clip.name || `Clip ${i + 1}`;
          ctx.fillText(label, r.x + 6 * dpr, Math.floor(10 * dpr));
        }
      }

      // Playhead
      const projectDur = Math.max(1e-6, duration || 0);
      const scale = Math.max(0.01, zoomLevel / 100);
      const pxPerSec = (W * scale) / projectDur;
      const phX = Math.floor((currentTime || 0) * pxPerSec);
      ctx.fillStyle = '#ff3030';
      ctx.fillRect(phX, 0, Math.max(1, Math.floor(2 * dpr)), H);
      
      // Draw grid lines if snap is enabled
      if (snapEnabled && gridSizeSec > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = dpr;
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        
        for (let t = 0; t < projectDur; t += gridSizeSec) {
          const x = Math.floor(t * pxPerSec);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, H);
          ctx.stroke();
        }
        
        ctx.setLineDash([]);
      }
    }

    // Pointer handlers remain the same as original
    function quantize(sec) {
      if (!snapEnabled) return sec;
      const gs = Math.max(0.001, Number(gridSizeSec) || 0.1);
      return Math.round(sec / gs) * gs;
    }

    function hitTest(clientX) {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const projectDur = Math.max(1e-6, duration || 0);
      const scale = Math.max(0.01, zoomLevel / 100);
      const pxPerSec = (rect.width * scale) / projectDur;
      const rects = clipRects(canvas.width);
      
      for (let i = clips.length - 1; i >= 0; i--) {
        const c = clips[i];
        const x0 = (c.start || 0) * pxPerSec;
        const w = (c.duration || 0) * pxPerSec;
        if (x >= x0 && x <= x0 + w) {
          const nearL = x - x0 <= HANDLE_W;
          const nearR = x0 + w - x <= HANDLE_W;
          return { index: i, edge: nearL ? 'L' : nearR ? 'R' : null, pxPerSecCSS: pxPerSec };
        }
      }
      return { index: -1, edge: null, pxPerSecCSS: pxPerSec };
    }

    function onPointerDown(e) {
      if (!interactive) return;
      canvas.setPointerCapture(e.pointerId);
      setSelectedTrackId(track.id);
      const hit = hitTest(e.clientX);
      dragRef.current.pxPerSecCSS = hit.pxPerSecCSS;
      if (hit.index >= 0) {
        const c = clips[hit.index];
        setSelectedClipId(c.id);
        const op = hit.edge === 'L' ? 'resizeL' : hit.edge === 'R' ? 'resizeR' : 'move';
        dragRef.current.op = op;
        dragRef.current.clipIndex = hit.index;
        dragRef.current.startX = e.clientX;
        dragRef.current.orig = { start: c.start || 0, duration: c.duration || 0, offset: c.offset || 0 };
      } else {
        dragRef.current.op = null;
        dragRef.current.clipIndex = -1;
      }
    }

    function onPointerMove(e) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const hit = hitTest(e.clientX);
      
      if (!dragRef.current.op) {
        if (hit.index >= 0) {
          if (hit.edge) canvas.style.cursor = 'ew-resize';
          else canvas.style.cursor = 'grab';
        } else {
          canvas.style.cursor = 'default';
        }
      }
      
      if (!interactive) return;
      if (!dragRef.current.op) return;

      const dxCss = e.clientX - dragRef.current.startX;
      const dxSecRaw = dxCss / dragRef.current.pxPerSecCSS;
      const dxSec = snapEnabled ? quantize(dxSecRaw) : dxSecRaw;
      const { start, duration: dur, offset } = dragRef.current.orig;
      const op = dragRef.current.op;
      let newStart = start;
      let newDur = dur;
      let newOffset = offset;

      if (op === 'move') {
        newStart = Math.max(0, start + dxSec);
      } else if (op === 'resizeL') {
        newStart = Math.max(0, start + dxSec);
        const delta = newStart - start;
        newDur = Math.max(MIN_DUR, dur - delta);
        newOffset = Math.max(0, (offset || 0) + delta);
      } else if (op === 'resizeR') {
        newDur = Math.max(MIN_DUR, dur + dxSec);
      }

      draw();
      const { dpr, width: W, height: H } = resizeToCSS(canvas);
      const ctx = canvas.getContext('2d');
      const projectDur = Math.max(1e-6, duration || 0);
      const scale = Math.max(0.01, zoomLevel / 100);
      const pxPerSec = (W * scale) / projectDur;
      const x0 = Math.floor(newStart * pxPerSec);
      const w = Math.max(1, Math.floor(newDur * pxPerSec));
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x0, 0, w, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = Math.max(1, Math.floor(2 * dpr));
      ctx.strokeRect(x0 + 0.5, 0.5, w - 1, H - 1);
      ctx.restore();

      dragRef.current.preview = { start: newStart, duration: newDur, offset: newOffset };
    }

    function onPointerUp(e) {
      canvas.releasePointerCapture?.(e.pointerId);
      if (!interactive) { draw(); return; }
      if (!dragRef.current.op || dragRef.current.clipIndex < 0) { draw(); return; }
      const idx = dragRef.current.clipIndex;
      const p = dragRef.current.preview;
      dragRef.current.op = null;
      dragRef.current.clipIndex = -1;
      dragRef.current.preview = null;
      if (!p) { draw(); return; }
      setTracks((prev) => prev.map((t) => {
        if (t.id !== track.id || !Array.isArray(t.clips)) return t;
        const nextClips = t.clips.map((c, i) => i === idx ? { ...c, start: p.start, duration: p.duration, offset: p.offset } : c);
        return { ...t, clips: nextClips };
      }));
      draw();
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    draw();
    return () => {
      try { ro.disconnect(); } catch {}
      window.removeEventListener('resize', draw);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [clipRects, currentTime, duration, zoomLevel, interactive, selectedClipId, selectedTrackId, 
      snapEnabled, gridSizeSec, setSelectedTrackId, setSelectedClipId, setTracks, track?.id, 
      peaksCache, clips]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: `${height}px`,
        pointerEvents: interactive ? 'auto' : 'none',
        cursor: 'default',
        background: 'transparent',
      }}
    />
  );
}

function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(123,175,212,${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}