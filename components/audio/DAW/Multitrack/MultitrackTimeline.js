// components/audio/DAW/Multitrack/MultitrackTimeline.js
'use client';

import { useEffect, useRef, useState } from 'react';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

export default function MultitrackTimeline({ zoomLevel = 100 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Track controls width - should match the actual width of track controls
  const TRACK_CONTROLS_WIDTH = 280; // Adjust this to match your track controls width

  const { duration, currentTime, seek, isPlaying, tracks } = useMultitrack();

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Handle click to set playhead position
  const handleTimelineClick = (e) => {
    if (!containerRef.current || duration === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Only respond to clicks in the waveform area
    if (x < TRACK_CONTROLS_WIDTH) return;

    const waveformAreaWidth = rect.width - TRACK_CONTROLS_WIDTH;
    const progress = (x - TRACK_CONTROLS_WIDTH) / waveformAreaWidth;

    // Seek all tracks to this position
    seek(Math.max(0, Math.min(1, progress)));
  };

  // Draw timeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = containerWidth;
    const height = 40;

    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw track controls background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, TRACK_CONTROLS_WIDTH, height);

    // Draw time markers only in the waveform area
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';

    const waveformAreaWidth = width - TRACK_CONTROLS_WIDTH;

    // Calculate time markers based on zoom
    const pixelsPerSecond = 50 * (zoomLevel / 100);
    const secondsPerMarker = Math.max(1, Math.floor(100 / pixelsPerSecond));

    for (let time = 0; time <= duration; time += secondsPerMarker) {
      const x = TRACK_CONTROLS_WIDTH + (time / duration) * waveformAreaWidth;

      // Draw tick
      ctx.strokeStyle = '#444';
      ctx.beginPath();
      ctx.moveTo(x, height - 10);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Draw time label
      ctx.fillText(formatTime(time), x + 2, height - 15);
    }
  }, [containerWidth, duration, zoomLevel]);

  // Draw playhead
  useEffect(() => {
    const drawPlayhead = () => {
      if (!containerRef.current || duration === 0) return;

      const playheadElement = document.getElementById('multitrack-playhead');
      if (!playheadElement) return;

      const waveformAreaWidth = containerWidth - TRACK_CONTROLS_WIDTH;
      const x =
        TRACK_CONTROLS_WIDTH + (currentTime / duration) * waveformAreaWidth;
      playheadElement.style.left = `${x}px`;
    };

    // Update playhead position
    const animate = () => {
      drawPlayhead();
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      animate();
    } else {
      drawPlayhead();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentTime, duration, containerWidth, isPlaying]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className="multitrack-timeline"
      onClick={handleTimelineClick}
      style={{
        position: 'relative',
        height: '40px',
        backgroundColor: '#1a1a1a',
        cursor: 'pointer',
        userSelect: 'none',
        borderBottom: '1px solid #444',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />

      {/* Playhead */}
      <div
        id="multitrack-playhead"
        style={{
          position: 'absolute',
          top: 0,
          width: '2px',
          height: '100vh', // Extend down through all tracks
          backgroundColor: '#ff0000',
          pointerEvents: 'none',
          zIndex: 100,
          transition: isPlaying ? 'none' : 'left 0.1s ease-out',
        }}
      />
    </div>
  );
}
