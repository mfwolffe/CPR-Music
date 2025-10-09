'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSingleTrack, useAudio, useUI } from '../../../../contexts/DAWProvider';
import { generatePeaks, drawPeaks } from '../../../../lib/waveformPeaks';
import SingleTrackMinimap from './SingleTrackMinimap';

const TIMELINE_HEIGHT = 30;
const WAVEFORM_HEIGHT = 180;
const TOTAL_HEIGHT = TIMELINE_HEIGHT + WAVEFORM_HEIGHT;

export default function SingleTrackWaveformSimple() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);

  const { audioURL: globalAudioURL } = useAudio();
  const { mapPresent } = useUI();
  const {
    duration,
    currentTime,
    zoomLevel,
    region,
    setRegion,
    seek,
  } = useSingleTrack();

  const [dragState, setDragState] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [peaks, setPeaks] = useState(null);
  const [peaksLoading, setPeaksLoading] = useState(false);

  // Load peaks when audio URL changes
  useEffect(() => {
    if (!globalAudioURL) {
      setPeaks(null);
      return;
    }

    let cancelled = false;
    setPeaksLoading(true);

    const loadPeaks = async () => {
      try {
        const peakData = await generatePeaks(globalAudioURL, 256);
        if (!cancelled) {
          setPeaks(peakData);
          setPeaksLoading(false);
        }
      } catch (error) {
        console.error('Failed to generate peaks:', error);
        if (!cancelled) {
          setPeaks(null);
          setPeaksLoading(false);
        }
      }
    };

    loadPeaks();

    return () => {
      cancelled = true;
    };
  }, [globalAudioURL]);

  // Handle canvas resize
  useEffect(() => {
    const updateCanvasSize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = TOTAL_HEIGHT * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${TOTAL_HEIGHT}px`;

      setCanvasSize({ width: rect.width, height: TOTAL_HEIGHT });
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Main render function - called via requestAnimationFrame
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate dimensions
    const pixelsPerSecond = zoomLevel * dpr;
    const visibleDuration = duration || 30;

    // Draw timeline background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, TIMELINE_HEIGHT * dpr);

    // Draw timeline ticks and labels
    ctx.save();
    ctx.font = `${11 * dpr}px Arial`;
    ctx.fillStyle = '#888';
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;

    // Draw major ticks every second
    for (let sec = 0; sec <= visibleDuration; sec++) {
      const x = sec * pixelsPerSecond;

      ctx.beginPath();
      ctx.moveTo(x, (TIMELINE_HEIGHT - 10) * dpr);
      ctx.lineTo(x, TIMELINE_HEIGHT * dpr);
      ctx.stroke();

      // Label every 5 seconds
      if (sec % 5 === 0) {
        const mins = Math.floor(sec / 60);
        const secs = sec % 60;
        const label = `${mins}:${secs.toString().padStart(2, '0')}`;
        ctx.fillText(label, x + 3 * dpr, (TIMELINE_HEIGHT - 15) * dpr);
      }
    }
    ctx.restore();

    // Draw waveform background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, TIMELINE_HEIGHT * dpr, canvas.width, WAVEFORM_HEIGHT * dpr);

    // Draw waveform peaks
    if (peaks && peaks.peaks && peaks.peaks.length > 0) {
      const visibleWidthPx = Math.min(canvas.width / dpr, visibleDuration * zoomLevel);

      // Scale peaks to visible area
      ctx.save();
      ctx.scale(dpr, dpr);

      drawPeaks(
        ctx,
        peaks.peaks,
        visibleWidthPx,
        WAVEFORM_HEIGHT,
        TIMELINE_HEIGHT,
        {
          waveColor: '#7bafd4',
          waveAlpha: 0.7,
          fillAlpha: 0.3,
          centerLineColor: '#7bafd4',
          centerLineAlpha: 0.2,
          mirror: true
        }
      );

      ctx.restore();
    } else if (peaksLoading) {
      // Show loading indicator
      ctx.fillStyle = '#666';
      ctx.font = `${12 * dpr}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('Loading waveform...', canvas.width / 2, (TIMELINE_HEIGHT + WAVEFORM_HEIGHT / 2) * dpr);
    }

    // Draw region if exists
    if (region) {
      const x1 = region.start * pixelsPerSecond;
      const x2 = region.end * pixelsPerSecond;
      const width = x2 - x1;

      ctx.fillStyle = 'rgba(155, 115, 215, 0.4)';
      ctx.fillRect(x1, TIMELINE_HEIGHT * dpr, width, WAVEFORM_HEIGHT * dpr);

      ctx.strokeStyle = 'rgba(155, 115, 215, 0.8)';
      ctx.lineWidth = 2 * dpr;
      ctx.strokeRect(x1, TIMELINE_HEIGHT * dpr, width, WAVEFORM_HEIGHT * dpr);
    }

    // Draw playback cursor
    const cursorX = currentTime * pixelsPerSecond;
    ctx.strokeStyle = '#ffc107'; // var(--jmu-gold)
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, canvas.height);
    ctx.stroke();
  }, [duration, currentTime, zoomLevel, region, peaks, peaksLoading]);

  // Animation loop for smooth cursor updates
  useEffect(() => {
    const animate = () => {
      render();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render]);

  // Mouse handlers
  const handleMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickTime = x / zoomLevel;

    // Click on timeline = seek
    if (y < TIMELINE_HEIGHT) {
      seek(clickTime);
    } else {
      // Start region selection
      setDragState({ startX: x, startTime: clickTime });
    }
  }, [zoomLevel, seek]);

  const handleMouseMove = useCallback((e) => {
    if (!dragState) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const currentTime = x / zoomLevel;

    const start = Math.min(dragState.startTime, currentTime);
    const end = Math.max(dragState.startTime, currentTime);

    setRegion({ start: Math.max(0, start), end: Math.max(0, end) });
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

    // Only clear region if clicking in waveform area
    if (y > TIMELINE_HEIGHT) {
      const clickTime = x / zoomLevel;
      if (clickTime >= region.start && clickTime <= region.end) {
        setRegion(null);
      }
    }
  }, [region, zoomLevel, setRegion]);

  return (
    <>
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
      <SingleTrackMinimap peaks={peaks} visible={mapPresent} />
    </>
  );
}