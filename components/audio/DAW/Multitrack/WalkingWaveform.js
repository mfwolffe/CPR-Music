// components/audio/DAW/Multitrack/WalkingWaveform.js
'use client';

import { useEffect, useRef, useState } from 'react';
import { useMultitrack } from '../../../../contexts/MultitrackContext';

export default function WalkingWaveform({
  mediaStream,
  isRecording,
  trackId,
  height = 120,
  color = '#ff6b6b',
  backgroundColor = '#2a2a2a',
  startPosition = 0, // Start position in seconds
  zoomLevel = 100, // Zoom level percentage
  duration = 30, // Project duration
}) {
  const { currentTime: globalCurrentTime } = useMultitrack();
  
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const startTimeRef = useRef(null);
  const waveformDataRef = useRef([]);
  
  // Viewport state for auto-scroll
  const [viewportStartTime, setViewportStartTime] = useState(startPosition);

  useEffect(() => {
    console.log('WalkingWaveform effect:', {
      mediaStream,
      isRecording,
      hasCanvas: !!canvasRef.current,
      startPosition,
      zoomLevel,
      duration,
    });

    if (!mediaStream || !isRecording || !canvasRef.current) {
      console.log('WalkingWaveform: Missing requirements', {
        hasMediaStream: !!mediaStream,
        isRecording,
        hasCanvas: !!canvasRef.current,
      });
      return;
    }

    try {
      // Initialize Web Audio
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
      const source =
        audioContextRef.current.createMediaStreamSource(mediaStream);

      // Create analyser node
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;
      source.connect(analyserRef.current);

      console.log('WalkingWaveform: Audio context initialized');

      // Set up canvas
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const inner = document.getElementById('multitrack-tracks-inner');
      const totalWidth = inner
        ? inner.offsetWidth
        : 280 + 3000 * (zoomLevel / 100);
      const contentWidth = Math.max(1, totalWidth - 280);
      canvas.width = contentWidth;
      canvas.style.width = contentWidth + 'px';
      const width = contentWidth;
      const canvasHeight = canvas.height;

      // Calculate pixels per second to match TrackClipCanvas calculation
      const projectDur = Math.max(1e-6, duration || 30);
      const pixelsPerSecond = width / projectDur;

      console.log('WalkingWaveform: Pixel calculation', {
        width,
        projectDur,
        pixelsPerSecond,
        startPositionPx: startPosition * pixelsPerSecond,
      });

      // Initialize recording start time
      startTimeRef.current = Date.now();
      waveformDataRef.current = [];

      // Clear canvas
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, canvasHeight);

      let frameCount = 0;

      // Animation function
      const draw = () => {
        if (!isRecording) {
          console.log('WalkingWaveform: Stopping animation - recording ended');
          return;
        }

        frameCount++;
        if (frameCount % 60 === 0) {
          // Log every second
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          console.log('WalkingWaveform: Still animating...', {
            frameCount,
            startPosition,
            elapsed,
            currentX: (startPosition + elapsed) * pixelsPerSecond,
          });
        }

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteTimeDomainData(dataArray);

        // Calculate RMS (root mean square) for amplitude
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const normalized = (dataArray[i] - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / bufferLength);
        const amplitude = Math.min(rms * 3, 1); // Scale and clamp

        // Calculate elapsed time since recording started (independent timing)
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const currentTime = startPosition + elapsed; // absolute position in timeline
        
        // Store waveform data point with timestamp
        waveformDataRef.current.push({
          amplitude,
          time: currentTime
        });
        
        // Auto-scroll viewport to follow the playhead during recording
        let viewportStart = viewportStartTime;
        if (isRecording && currentTime > 0) {
          const viewportDuration = width / pixelsPerSecond; // How many seconds fit in the viewport
          const viewportEnd = viewportStart + viewportDuration;
          const scrollThreshold = viewportDuration * 0.2; // Start scrolling at 20% from right edge
          
          if (currentTime > (viewportEnd - scrollThreshold)) {
            // Playhead near right edge - scroll forward to keep it at 25% from left
            const newViewportStart = Math.max(0, currentTime - viewportDuration * 0.25);
            setViewportStartTime(newViewportStart);
            viewportStart = newViewportStart;
          }
        }
        
        // Clear and redraw entire viewport
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, canvasHeight);
        
        // Draw all waveform data that's visible in the current viewport
        const barWidth = 2;
        const barSpacing = 1;
        const samplesPerPixel = 1 / pixelsPerSecond * 60; // Assume ~60fps
        
        ctx.fillStyle = color;
        for (let i = 0; i < waveformDataRef.current.length; i++) {
          const sample = waveformDataRef.current[i];
          const relativeTime = sample.time - viewportStart;
          const xPosition = relativeTime * pixelsPerSecond;
          
          // Only draw if within viewport
          if (xPosition >= 0 && xPosition < width) {
            const x = Math.floor(xPosition);
            const maxBarHeight = canvasHeight * 0.8;
            const barHeight = sample.amplitude * maxBarHeight;
            const y = (canvasHeight - barHeight) / 2;
            
            ctx.fillRect(x, y, barWidth, barHeight);
          }
        }

        // Continue animation
        animationRef.current = requestAnimationFrame(draw);
      };

      // Start drawing
      console.log(
        'WalkingWaveform: Starting animation at position',
        startPosition,
      );
      draw();
    } catch (error) {
      console.error('WalkingWaveform: Error initializing:', error);
    }

    // Cleanup
    return () => {
      console.log('WalkingWaveform: Cleanup');
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== 'closed'
      ) {
        audioContextRef.current.close();
      }
    };
  }, [
    mediaStream,
    isRecording,
    height,
    color,
    backgroundColor,
    startPosition,
    zoomLevel,
    duration,
  ]);

  return (
    <canvas
      ref={canvasRef}
      height={height}
      style={{
        display: 'block',
        position: 'absolute',
        top: '50%',
        left: 0,
        transform: 'translateY(-50%)',
        backgroundColor: 'transparent',
        width: '100%',
        height: `${height}px`,
      }}
    />
  );
}
