'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useMultitrack } from '../../../../contexts/DAWProvider';
import styles from './MultitrackTimeline.module.css';

/**
 * Timeline component for multitrack editor
 * Shows time ruler, playhead, and cursor position
 */
export default function MultitrackTimeline({
  pixelsPerSecond = 50,
  snapToGrid = true,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const { duration, currentTime, cursorPosition, setCursorPos, isPlaying } =
    useMultitrack();

  // Snap to nearest beat/bar
  const snapTime = useCallback(
    (time) => {
      if (!snapToGrid) return time;

      const bpm = 120; // TODO: Make this configurable
      const beatInterval = 60 / bpm;
      const nearestBeat = Math.round(time / beatInterval) * beatInterval;
      return nearestBeat;
    },
    [snapToGrid],
  );

  // Handle click on timeline to set cursor position
  const handleTimelineClick = useCallback(
    (e) => {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + containerRef.current.scrollLeft;
      const time = x / pixelsPerSecond;
      const snappedTime = snapTime(time);
      setCursorPos(snappedTime);
    },
    [pixelsPerSecond, setCursorPos, snapTime],
  );

  // Draw timeline with enhanced grid
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = Math.max(duration * pixelsPerSecond, 1000);
    const height = 40;

    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw beat grid (assuming 120 BPM for now - can be made configurable)
    const bpm = 120;
    const beatInterval = 60 / bpm; // seconds per beat
    const beatsPerBar = 4;

    // Draw bar lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i <= Math.ceil(duration || 20) * (bpm / 60); i++) {
      const time = i * beatInterval;
      const x = time * pixelsPerSecond;

      if (i % beatsPerBar === 0) {
        // Bar line
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
      } else {
        // Beat line
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
      }

      ctx.beginPath();
      ctx.moveTo(x, height - 10);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw second markers and time labels
    ctx.strokeStyle = '#444';
    ctx.fillStyle = '#888';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';

    for (let i = 0; i <= Math.ceil(duration || 20); i++) {
      const x = i * pixelsPerSecond;

      // Major marker every 5 seconds
      if (i % 5 === 0) {
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Time label
        const mins = Math.floor(i / 60);
        const secs = i % 60;
        const label = `${mins}:${secs.toString().padStart(2, '0')}`;
        ctx.fillText(label, x, height - 5);
      } else {
        // Minor marker
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, height - 15);
        ctx.lineTo(x, height - 10);
        ctx.stroke();
      }
    }

    // Draw cursor position (red line)
    if (cursorPosition >= 0) {
      const cursorX = cursorPosition * pixelsPerSecond;

      // Draw cursor line
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, height);
      ctx.stroke();

      // Cursor handle
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.moveTo(cursorX - 6, 0);
      ctx.lineTo(cursorX + 6, 0);
      ctx.lineTo(cursorX, 8);
      ctx.closePath();
      ctx.fill();

      // Cursor position label
      ctx.fillStyle = '#ff4444';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      const cursorTime = cursorPosition.toFixed(1) + 's';
      const textX = Math.max(20, Math.min(width - 20, cursorX));
      ctx.fillText(cursorTime, textX, 20);
    }

    // Draw playhead (white line) if playing
    if (isPlaying && currentTime >= 0) {
      const playheadX = currentTime * pixelsPerSecond;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Playhead handle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [duration, currentTime, cursorPosition, isPlaying, pixelsPerSecond]);

  return (
    <div
      ref={containerRef}
      className={styles.timelineContainer}
      onClick={handleTimelineClick}
    >
      <canvas ref={canvasRef} className={styles.timelineCanvas} />
    </div>
  );
}
