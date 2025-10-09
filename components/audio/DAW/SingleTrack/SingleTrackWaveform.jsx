'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSingleTrack } from '../../../../contexts/SingleTrackContext';
import waveformCache from '../Multitrack/WaveformCache';

const TIMELINE_HEIGHT = 30; // pixels
const WAVEFORM_HEIGHT = 180; // pixels
const TOTAL_HEIGHT = TIMELINE_HEIGHT + WAVEFORM_HEIGHT;

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function SingleTrackWaveform() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const {
    audioURL,
    duration,
    currentTime,
    zoomLevel,
    region,
    setRegion,
    seek,
  } = useSingleTrack();

  const [peaks, setPeaks] = useState(null);
  const [dragState, setDragState] = useState(null); // { startX, startTime }

  // Load peaks when audio URL changes
  useEffect(() => {
    if (!audioURL) {
      setPeaks(null);
      return;
    }

    console.log('🎵 SingleTrack: Starting to load peaks for:', audioURL);
    let cancelled = false;

    const loadPeaks = async () => {
      try {
        console.log('🎵 SingleTrack: Calling waveformCache.getPeaksForURL...');
        const result = await waveformCache.getPeaksForURL(audioURL, 256);
        if (!cancelled) {
          setPeaks(result.peaks);
          console.log('🌊 SingleTrack: Loaded peaks, count =', result.peaks?.length);
        }
      } catch (err) {
        console.error('❌ SingleTrack: Error loading peaks:', err);
        if (!cancelled) {
          setPeaks(null);
        }
      }
    };

    loadPeaks();

    return () => {
      cancelled = true;
    };
  }, [audioURL]);

  // Resize canvas to match container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = TOTAL_HEIGHT * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${TOTAL_HEIGHT}px`;

    return { dpr, width: canvas.width, height: canvas.height, cssWidth: rect.width };
  }, []);

  // Initial resize on mount and when window resizes
  useEffect(() => {
    resizeCanvas();
  }, [resizeCanvas]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      resizeCanvas();
      // Trigger a redraw after resize
      const event = new Event('canvasResize');
      window.dispatchEvent(event);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [resizeCanvas]);

  // Draw everything
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate dimensions
    const timelineHeightPx = TIMELINE_HEIGHT * dpr;
    const waveformHeightPx = WAVEFORM_HEIGHT * dpr;
    const pixelsPerSecond = zoomLevel * dpr;
    const totalWidthSec = duration || 30;
    const totalWidthPx = totalWidthSec * pixelsPerSecond;

    // Draw timeline background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, timelineHeightPx);

    // Draw timeline tick marks
    drawTimeline(ctx, dpr, timelineHeightPx, pixelsPerSecond, totalWidthSec);

    // Draw waveform background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, timelineHeightPx, canvas.width, waveformHeightPx);

    // Draw waveform
    if (peaks && peaks.length > 0) {
      drawWaveform(ctx, dpr, timelineHeightPx, waveformHeightPx, pixelsPerSecond, totalWidthSec);
    }

    // Draw region overlay
    if (region) {
      drawRegion(ctx, dpr, timelineHeightPx, waveformHeightPx, pixelsPerSecond);
    }

    // Draw playback cursor
    drawCursor(ctx, dpr, timelineHeightPx, waveformHeightPx, pixelsPerSecond);

  }, [peaks, duration, currentTime, zoomLevel, region]);

  // Timeline rendering
  const drawTimeline = (ctx, dpr, timelineH, pxPerSec, totalSec) => {
    ctx.save();
    ctx.font = `${11 * dpr}px Arial`;
    ctx.fillStyle = '#888';
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1 * dpr;

    // Major ticks every second
    for (let sec = 0; sec <= totalSec; sec++) {
      const x = sec * pxPerSec;

      // Draw tick
      ctx.beginPath();
      ctx.moveTo(x, timelineH - 10 * dpr);
      ctx.lineTo(x, timelineH);
      ctx.stroke();

      // Draw label every 5 seconds
      if (sec % 5 === 0) {
        const mins = Math.floor(sec / 60);
        const secs = sec % 60;
        const label = `${mins}:${secs.toString().padStart(2, '0')}`;
        ctx.fillText(label, x + 3 * dpr, timelineH - 15 * dpr);
      }
    }

    // Minor ticks every 0.2 seconds
    ctx.strokeStyle = '#333';
    for (let sec = 0; sec <= totalSec; sec += 0.2) {
      if (sec % 1 !== 0) {
        const x = sec * pxPerSec;
        ctx.beginPath();
        ctx.moveTo(x, timelineH - 5 * dpr);
        ctx.lineTo(x, timelineH);
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  // Waveform rendering
  const drawWaveform = (ctx, dpr, timelineH, waveformH, pxPerSec, totalSec) => {
    if (!peaks || peaks.length === 0) return;

    ctx.save();

    const centerY = timelineH + waveformH / 2;
    const amplitude = (waveformH - 20 * dpr) / 2;
    const totalWidthPx = totalSec * pxPerSec;

    // Calculate samples per pixel
    const peaksPerPixel = peaks.length / totalWidthPx;

    ctx.strokeStyle = hexToRgba('#7bafd4', 0.7);
    ctx.fillStyle = hexToRgba('#7bafd4', 0.3);
    ctx.lineWidth = Math.max(1, dpr);

    // Draw waveform
    if (peaksPerPixel > 1) {
      // More peaks than pixels - aggregate
      for (let x = 0; x < totalWidthPx; x++) {
        const peakStart = Math.floor(x * peaksPerPixel);
        const peakEnd = Math.floor((x + 1) * peaksPerPixel);

        let min = 1.0;
        let max = -1.0;

        for (let i = peakStart; i < peakEnd && i < peaks.length; i++) {
          if (peaks[i][0] < min) min = peaks[i][0];
          if (peaks[i][1] > max) max = peaks[i][1];
        }

        const yMin = centerY - max * amplitude;
        const yMax = centerY - min * amplitude;

        ctx.beginPath();
        ctx.moveTo(x, yMin);
        ctx.lineTo(x, yMax);
        ctx.stroke();
      }
    } else {
      // Fewer peaks than pixels - interpolate
      ctx.beginPath();

      // Top line
      for (let i = 0; i < peaks.length; i++) {
        const x = (i / peaks.length) * totalWidthPx;
        const y = centerY - peaks[i][1] * amplitude;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      // Bottom line (reversed)
      for (let i = peaks.length - 1; i >= 0; i--) {
        const x = (i / peaks.length) * totalWidthPx;
        const y = centerY - peaks[i][0] * amplitude;
        ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Draw center line
    ctx.strokeStyle = hexToRgba('#7bafd4', 0.2);
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(totalWidthPx, centerY);
    ctx.stroke();

    ctx.restore();
  };

  // Region overlay
  const drawRegion = (ctx, dpr, timelineH, waveformH, pxPerSec) => {
    if (!region) return;

    ctx.save();

    const x1 = region.start * pxPerSec;
    const x2 = region.end * pxPerSec;
    const width = x2 - x1;

    // Draw region on waveform
    ctx.fillStyle = 'rgba(155, 115, 215, 0.4)';
    ctx.fillRect(x1, timelineH, width, waveformH);

    // Draw region borders
    ctx.strokeStyle = 'rgba(155, 115, 215, 0.8)';
    ctx.lineWidth = 2 * dpr;
    ctx.strokeRect(x1, timelineH, width, waveformH);

    ctx.restore();
  };

  // Playback cursor
  const drawCursor = (ctx, dpr, timelineH, waveformH, pxPerSec) => {
    const x = currentTime * pxPerSec;

    ctx.save();
    ctx.strokeStyle = 'var(--jmu-gold)';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, timelineH + waveformH);
    ctx.stroke();
    ctx.restore();
  };

  // Mouse handlers
  const handleMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert to time
    const pixelsPerSecond = zoomLevel;
    const clickTime = x / pixelsPerSecond;

    // If clicking on timeline, seek
    if (y < TIMELINE_HEIGHT) {
      seek(clickTime);
      return;
    }

    // If clicking on waveform, start region drag
    setDragState({ startX: x, startTime: clickTime });
  }, [zoomLevel, seek]);

  const handleMouseMove = useCallback((e) => {
    if (!dragState) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const pixelsPerSecond = zoomLevel;
    const currentTimePos = x / pixelsPerSecond;

    // Update region
    const start = Math.min(dragState.startTime, currentTimePos);
    const end = Math.max(dragState.startTime, currentTimePos);

    setRegion({ start, end });
  }, [dragState, zoomLevel, setRegion]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  const handleDoubleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !region) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Only clear region if double-clicking in waveform area
    if (y < TIMELINE_HEIGHT) return;

    const pixelsPerSecond = zoomLevel;
    const clickTime = x / pixelsPerSecond;

    // Check if clicking inside region
    if (clickTime >= region.start && clickTime <= region.end) {
      setRegion(null);
    }
  }, [region, zoomLevel, setRegion]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: `${TOTAL_HEIGHT}px`,
        position: 'relative',
        backgroundColor: '#1e1e1e',
        cursor: dragState ? 'col-resize' : 'crosshair',
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}
