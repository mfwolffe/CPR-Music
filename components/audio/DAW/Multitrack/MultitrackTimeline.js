// components/audio/DAW/Multitrack/MultitrackTimeline.js
'use client';

import { useEffect, useRef, useState } from 'react';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

export default function MultitrackTimeline({
  zoomLevel = 100,
  scrollRef,
  onScroll,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);

  const { duration, currentTime, seek, isPlaying } = useMultitrack();

  // Connect external scroll ref if provided
  useEffect(() => {
    if (scrollRef && scrollContainerRef.current) {
      scrollRef.current = scrollContainerRef.current;
    }
  }, [scrollRef]);

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
    const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
    const x = e.clientX - rect.left + scrollLeft;

    // Calculate time based on the virtual width
    const scale = zoomLevel / 100;
    const virtualWidth = 3000 * scale; // Match track canvas width
    const projectDuration = Math.max(duration, 30);
    const clickTime = (x / virtualWidth) * projectDuration;

    // Convert to progress (0-1)
    const progress = clickTime / projectDuration;
    seek(Math.max(0, Math.min(1, progress)));
  };

  // Draw timeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const height = 40;

    // Calculate virtual width based on zoom
    const scale = zoomLevel / 100;
    const virtualWidth = 3000 * scale; // Match track canvas width
    const width = Math.max(containerWidth, virtualWidth);

    canvas.width = width;
    canvas.height = height;

    // Clear canvas with dark background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);

    // Calculate pixels per second using the same formula as tracks
    const projectDuration = Math.max(duration, 30);
    const pixelsPerSecond = virtualWidth / projectDuration;

    // Determine appropriate tick intervals based on zoom level
    let majorTickInterval = 1; // seconds
    let minorTicksPerMajor = 5;

    if (pixelsPerSecond > 200) {
      // Very zoomed in - show 0.1 second intervals
      majorTickInterval = 0.1;
      minorTicksPerMajor = 10;
    } else if (pixelsPerSecond > 100) {
      // Zoomed in - show 0.5 second intervals
      majorTickInterval = 0.5;
      minorTicksPerMajor = 5;
    } else if (pixelsPerSecond > 50) {
      // Normal - show 1 second intervals
      majorTickInterval = 1;
      minorTicksPerMajor = 5;
    } else if (pixelsPerSecond > 20) {
      // Zoomed out - show 5 second intervals
      majorTickInterval = 5;
      minorTicksPerMajor = 5;
    } else if (pixelsPerSecond > 10) {
      // Very zoomed out - show 10 second intervals
      majorTickInterval = 10;
      minorTicksPerMajor = 5;
    } else {
      // Extremely zoomed out - show 30 second intervals
      majorTickInterval = 30;
      minorTicksPerMajor = 6;
    }

    ctx.font = '11px Arial';
    ctx.fillStyle = '#888';
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;

    // Draw major ticks and time labels
    for (let sec = 0; sec <= projectDuration; sec += majorTickInterval) {
      const x = sec * pixelsPerSecond;

      if (x > width) break;

      // Major tick
      ctx.beginPath();
      ctx.moveTo(x, height - 10);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Time label
      const minutes = Math.floor(sec / 60);
      const seconds = sec % 60;

      let label;
      if (majorTickInterval < 1) {
        // Show decimal seconds for sub-second intervals
        label = sec.toFixed(1) + 's';
      } else if (seconds === 0 && minutes > 0) {
        // Show just minutes for whole minutes
        label = `${minutes}:00`;
      } else {
        // Show minutes:seconds
        label = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }

      ctx.fillText(label, x + 3, height - 15);
    }

    // Draw minor ticks
    ctx.strokeStyle = '#333';
    const minorTickInterval = majorTickInterval / minorTicksPerMajor;

    for (let sec = 0; sec <= projectDuration; sec += minorTickInterval) {
      if (sec % majorTickInterval !== 0) {
        const x = sec * pixelsPerSecond;

        if (x > width) break;

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

      // Calculate position using the same scale as drawing
      const scale = zoomLevel / 100;
      const virtualWidth = 3000 * scale;
      const projectDuration = Math.max(duration, 30);
      const pixelsPerSecond = virtualWidth / projectDuration;

      const x = currentTime * pixelsPerSecond;
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
  }, [currentTime, duration, zoomLevel, isPlaying]);

  // Calculate the actual width for the timeline
  const scale = zoomLevel / 100;
  const virtualWidth = 3000 * scale;
  const timelineWidth = Math.max(containerWidth, virtualWidth);

  return (
    <>
      <style>
        {`
          /* Hide scrollbar for Chrome, Safari and Opera */
          .timeline-scroll-container::-webkit-scrollbar {
            height: 8px;
            opacity: 0;
            transition: opacity 0.3s;
          }
          
          .timeline-scroll-container::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
          }
          
          .timeline-scroll-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
          }
          
          .timeline-scroll-container::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
          }
          
          /* Show scrollbar on hover or when scrolling */
          .timeline-scroll-container.show-scrollbar::-webkit-scrollbar,
          .timeline-scroll-container:hover::-webkit-scrollbar {
            opacity: 1;
          }
          
          /* For Firefox - show thin scrollbar on hover */
          .timeline-scroll-container:hover {
            scrollbar-width: thin !important;
          }
        `}
      </style>
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

        {/* Timeline with horizontal scroll */}
        <div
          ref={scrollContainerRef}
          className={`timeline-scroll-container ${isScrolling ? 'show-scrollbar' : ''}`}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onScroll={(e) => {
            // Show scrollbar while scrolling
            setIsScrolling(true);

            // Clear existing timeout
            if (scrollTimeoutRef.current) {
              clearTimeout(scrollTimeoutRef.current);
            }

            // Hide scrollbar after scrolling stops
            scrollTimeoutRef.current = setTimeout(() => {
              setIsScrolling(false);
            }, 1000);

            // Handle scroll sync if needed
            if (onScroll) {
              onScroll(e);
            }
          }}
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'hidden',
            position: 'relative',
            // Hide scrollbar by default
            scrollbarWidth: 'none', // Firefox
            msOverflowStyle: 'none', // IE/Edge
          }}
        >
          <div
            ref={containerRef}
            className="multitrack-timeline"
            onClick={handleTimelineClick}
            style={{
              position: 'relative',
              width: `${timelineWidth}px`,
              height: '40px',
              backgroundColor: '#1e1e1e',
              cursor: 'pointer',
              userSelect: 'none',
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
      </div>
    </>
  );
}
