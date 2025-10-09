'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSingleTrack, useAudio, useUI } from '../../../../contexts/DAWProvider';

const TIMELINE_HEIGHT = 30;
const WAVEFORM_HEIGHT = 180;
const TOTAL_HEIGHT = TIMELINE_HEIGHT + WAVEFORM_HEIGHT;

export default function SingleTrackWaveformBasic() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const lastDrawTimeRef = useRef(0);

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
  const [hasAudio, setHasAudio] = useState(false);

  // Check if we have audio
  useEffect(() => {
    setHasAudio(!!globalAudioURL && duration > 0);
  }, [globalAudioURL, duration]);

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
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Draw function - only called when needed
  const draw = useCallback(() => {
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

    // Draw timeline ticks
    ctx.save();
    ctx.font = `${11 * dpr}px Arial`;
    ctx.fillStyle = '#888';
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;

    for (let sec = 0; sec <= visibleDuration; sec++) {
      const x = sec * pixelsPerSecond;

      ctx.beginPath();
      ctx.moveTo(x, (TIMELINE_HEIGHT - 10) * dpr);
      ctx.lineTo(x, TIMELINE_HEIGHT * dpr);
      ctx.stroke();

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

    // Draw simple waveform placeholder if we have audio
    if (hasAudio) {
      const centerY = (TIMELINE_HEIGHT + WAVEFORM_HEIGHT / 2) * dpr;
      const amplitude = (WAVEFORM_HEIGHT / 2 - 20) * dpr;

      // Draw a simple sine wave placeholder
      ctx.strokeStyle = 'rgba(123, 175, 212, 0.7)';
      ctx.fillStyle = 'rgba(123, 175, 212, 0.3)';
      ctx.lineWidth = 2 * dpr;

      ctx.beginPath();
      const samples = Math.min(canvas.width, 500); // Limit samples
      for (let i = 0; i <= samples; i++) {
        const x = (i / samples) * canvas.width;
        const phase = (i / samples) * Math.PI * 8; // 4 waves
        const y = centerY + Math.sin(phase) * amplitude * 0.5;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Center line
      ctx.strokeStyle = 'rgba(123, 175, 212, 0.2)';
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(canvas.width, centerY);
      ctx.stroke();
    } else if (globalAudioURL) {
      // Show loading text
      ctx.fillStyle = '#666';
      ctx.font = `${12 * dpr}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('Loading audio...', canvas.width / 2, (TIMELINE_HEIGHT + WAVEFORM_HEIGHT / 2) * dpr);
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
    ctx.strokeStyle = '#ffc107';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, canvas.height);
    ctx.stroke();
  }, [duration, currentTime, zoomLevel, region, hasAudio, globalAudioURL]);

  // Redraw when relevant state changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Update cursor position only (more efficient than full redraw)
  useEffect(() => {
    // Throttle cursor updates to 30fps
    const now = Date.now();
    if (now - lastDrawTimeRef.current < 33) return; // 30fps = 33ms
    lastDrawTimeRef.current = now;

    draw();
  }, [currentTime, draw]);

  // Mouse handlers
  const handleMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickTime = x / zoomLevel;

    if (y < TIMELINE_HEIGHT) {
      seek(clickTime);
    } else {
      setDragState({ startX: x, startTime: clickTime });
    }
  }, [zoomLevel, seek]);

  const handleMouseMove = useCallback((e) => {
    if (!dragState) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const currentTimePos = x / zoomLevel;

    const start = Math.min(dragState.startTime, currentTimePos);
    const end = Math.max(dragState.startTime, currentTimePos);

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

    if (y > TIMELINE_HEIGHT) {
      const clickTime = x / zoomLevel;
      if (clickTime >= region.start && clickTime <= region.end) {
        setRegion(null);
      }
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
      {mapPresent && (
        <div
          id="mmap"
          style={{
            width: '100%',
            height: '35px',
            backgroundColor: '#2a2a2a',
            borderTop: '1px solid #444',
          }}
        >
          <div style={{ color: '#666', textAlign: 'center', paddingTop: '8px', fontSize: '12px' }}>
            Minimap (simplified)
          </div>
        </div>
      )}
    </div>
  );
}