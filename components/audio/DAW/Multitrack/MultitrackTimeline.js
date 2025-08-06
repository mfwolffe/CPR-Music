// components/audio/DAW/Multitrack/MultitrackTimeline.js
'use client';

import { useEffect, useRef } from 'react';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

export default function MultitrackTimeline({ zoomLevel = 100 }) {
  const canvasRef = useRef(null);
  const { duration } = useMultitrack();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, width, height);

    // Timeline markings
    ctx.strokeStyle = '#666';
    ctx.fillStyle = '#999';
    ctx.font = '10px sans-serif';

    const pixelsPerSecond = 50 * (zoomLevel / 100);
    const secondsPerMark = Math.max(1, Math.floor(100 / pixelsPerSecond));
    const totalSeconds = duration || 120; // Default to 2 minutes if no duration

    for (let i = 0; i <= totalSeconds; i += secondsPerMark) {
      const x = i * pixelsPerSecond;

      // Major tick every 10 seconds
      if (i % 10 === 0) {
        ctx.beginPath();
        ctx.moveTo(x, height - 15);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Time label
        const mins = Math.floor(i / 60);
        const secs = i % 60;
        const label = `${mins}:${secs.toString().padStart(2, '0')}`;
        ctx.fillText(label, x + 2, height - 18);
      } else if (i % 5 === 0) {
        // Medium tick every 5 seconds
        ctx.beginPath();
        ctx.moveTo(x, height - 10);
        ctx.lineTo(x, height);
        ctx.stroke();
      } else {
        // Small tick every second
        ctx.beginPath();
        ctx.moveTo(x, height - 5);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }
  }, [duration, zoomLevel]);

  return (
    <div className="multitrack-timeline">
      <div className="timeline-controls-spacer" />
      <canvas
        ref={canvasRef}
        width={3000} // Wide enough for scrolling
        height={30}
        className="timeline-canvas"
      />
    </div>
  );
}
