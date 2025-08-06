// components/audio/DAW/Multitrack/MultitrackTimeline.js
'use client';

import { useEffect, useRef, useState } from 'react';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

export default function MultitrackTimeline({ zoomLevel = 100 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

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
    const progress = x / rect.width;

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

    // Clear canvas with dark background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);

    // Draw timeline markers
    const pixelsPerSecond =
      (width * (zoomLevel / 100)) / Math.max(duration, 30);
    const secondsPerMajorTick = Math.max(1, Math.floor(50 / pixelsPerSecond));

    ctx.font = '11px Arial';
    ctx.fillStyle = '#888';
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;

    // Draw major ticks and time labels
    for (let sec = 0; sec <= duration; sec += secondsPerMajorTick) {
      const x = (sec / duration) * width;

      // Major tick
      ctx.beginPath();
      ctx.moveTo(x, height - 10);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Time label
      const minutes = Math.floor(sec / 60);
      const seconds = sec % 60;
      const label = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      ctx.fillText(label, x + 3, height - 15);
    }

    // Draw minor ticks
    ctx.strokeStyle = '#333';
    const secondsPerMinorTick = secondsPerMajorTick / 5;
    for (let sec = 0; sec <= duration; sec += secondsPerMinorTick) {
      if (sec % secondsPerMajorTick !== 0) {
        const x = (sec / duration) * width;
        ctx.beginPath();
        ctx.moveTo(x, height - 5);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // Draw bottom border
    ctx.strokeStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.moveTo(0, height - 0.5);
    ctx.lineTo(width, height - 0.5);
    ctx.stroke();
  }, [containerWidth, duration, zoomLevel]);

  // Update playhead position
  useEffect(() => {
    const updatePlayhead = () => {
      const playhead = document.getElementById('multitrack-playhead');
      if (!playhead || !containerRef.current || duration === 0) return;

      const progress = currentTime / duration;
      const x = progress * containerRef.current.offsetWidth;
      playhead.style.left = `${x}px`;
    };

    const animate = () => {
      updatePlayhead();
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      animate();
    } else {
      updatePlayhead();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentTime, duration, containerWidth, isPlaying]);

  return (
    <div
      className="timeline-container"
      style={{ display: 'flex', height: '40px' }}
    >
      {/* Sidebar spacer - matches add track button area */}
      <div
        className="timeline-sidebar-spacer"
        style={{
          width: '80px',
          backgroundColor: '#1e1e1e',
          borderRight: '1px solid #3a3a3a',
          flexShrink: 0,
        }}
      />

      {/* Track controls spacer */}
      <div
        className="timeline-controls-spacer"
        style={{
          width: '200px',
          backgroundColor: '#232323',
          borderRight: '1px solid #444',
          flexShrink: 0,
        }}
      />

      {/* Timeline */}
      <div
        ref={containerRef}
        className="multitrack-timeline"
        onClick={handleTimelineClick}
        style={{
          position: 'relative',
          flex: 1,
          height: '40px',
          backgroundColor: '#1e1e1e',
          cursor: 'pointer',
          userSelect: 'none',
          overflow: 'hidden',
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

        {/* Playhead - positioned relative to timeline container */}
        <div
          id="multitrack-playhead"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '2px',
            height: '100vh',
            backgroundColor: '#ff3030',
            boxShadow: '0 0 3px rgba(255, 48, 48, 0.8)',
            pointerEvents: 'none',
            zIndex: 1000,
            transition: isPlaying ? 'none' : 'left 0.1s ease-out',
          }}
        />
      </div>
    </div>
  );
}
