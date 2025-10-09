'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSingleTrack, useAudio } from '../../../../contexts/DAWProvider';
import { drawPeaks } from '../../../../lib/waveformPeaks';

const MINIMAP_HEIGHT = 35;

export default function SingleTrackMinimap({ peaks, visible = true }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const { audioURL: globalAudioURL } = useAudio();
  const { duration, currentTime, zoomLevel, seek } = useSingleTrack();

  // Resize canvas
  const resizeCanvas = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = MINIMAP_HEIGHT * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${MINIMAP_HEIGHT}px`;

    return { width: rect.width, height: MINIMAP_HEIGHT, dpr };
  }, []);

  // Initial resize
  useEffect(() => {
    resizeCanvas();
  }, [resizeCanvas]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      resizeCanvas();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [resizeCanvas]);

  // Draw minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible) return;

    const result = resizeCanvas();
    if (!result) return;

    const { width, height, dpr } = result;
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw waveform if peaks exist
    if (peaks && peaks.peaks && peaks.peaks.length > 0) {
      ctx.save();
      ctx.scale(dpr, dpr);

      drawPeaks(
        ctx,
        peaks.peaks,
        width,
        height,
        0,
        {
          waveColor: '#b999aa',
          waveAlpha: 1.0,
          fillAlpha: 0.5,
          centerLineColor: null,
          mirror: true
        }
      );

      ctx.restore();

      // Draw viewport indicator
      if (duration > 0) {
        const viewportWidth = (width / duration) * (width / zoomLevel);
        const viewportX = (currentTime / duration) * width * dpr;

        // Draw viewport rectangle
        ctx.fillStyle = 'rgba(252, 186, 3, 0.2)'; // var(--jmu-gold) with alpha
        ctx.fillRect(viewportX, 0, viewportWidth * dpr, canvas.height);

        ctx.strokeStyle = 'rgba(252, 186, 3, 0.8)';
        ctx.lineWidth = 1 * dpr;
        ctx.strokeRect(viewportX, 0, viewportWidth * dpr, canvas.height);
      }

      // Draw playback cursor
      const cursorX = (currentTime / duration) * canvas.width;
      ctx.strokeStyle = '#ffc107'; // var(--jmu-gold)
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, canvas.height);
      ctx.stroke();
    }
  }, [peaks, duration, currentTime, zoomLevel, visible, resizeCanvas]);

  // Handle click to seek
  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !duration || !seek) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickTime = (x / rect.width) * duration;

    seek(clickTime);
  }, [duration, seek]);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      id="mmap"
      style={{
        width: '100%',
        height: `${MINIMAP_HEIGHT}px`,
        backgroundColor: '#2a2a2a',
        cursor: 'pointer',
        borderTop: '1px solid #444',
      }}
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}