// components/audio/DAW/Multitrack/WalkingWaveform.js
'use client';

import { useEffect, useRef } from 'react';

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
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const startTimeRef = useRef(null);
  const waveformDataRef = useRef([]);

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
      const width = canvas.width;
      const canvasHeight = canvas.height;

      // Calculate pixels per second to match TrackClipCanvas calculation
      const scale = Math.max(0.01, zoomLevel / 100);
      const projectDur = Math.max(1e-6, duration || 30);
      const pixelsPerSecond = (width * scale) / projectDur;

      console.log('WalkingWaveform: Pixel calculation', {
        width,
        scale,
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

        // Store waveform data point
        waveformDataRef.current.push(amplitude);

        // Calculate time position
        const elapsed = (Date.now() - startTimeRef.current) / 1000; // seconds since recording started
        const absoluteTime = startPosition + elapsed; // absolute position in the timeline
        const xPosition = absoluteTime * pixelsPerSecond;

        // Draw waveform bars
        const barWidth = 2;
        const barSpacing = 1;
        const currentBar = Math.floor(xPosition / (barWidth + barSpacing));

        // Check if we're still within canvas bounds
        if (currentBar * (barWidth + barSpacing) < width) {
          const x = currentBar * (barWidth + barSpacing);

          // Calculate bar height and center it vertically
          const maxBarHeight = canvasHeight * 0.8; // Use 80% of canvas height
          const barHeight = amplitude * maxBarHeight;
          const y = (canvasHeight - barHeight) / 2; // Center vertically

          ctx.fillStyle = color;
          ctx.fillRect(x, y, barWidth, barHeight);
        } else {
          console.log('WalkingWaveform: Reached canvas edge', {
            currentBar,
            maxBars: width / (barWidth + barSpacing),
          });
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
      width={3000} // Match track width for scrolling
      height={height}
      style={{
        display: 'block',
        position: 'absolute',
        top: '50%',
        left: 0,
        transform: 'translateY(-50%)',
        backgroundColor: 'transparent',
        width: '3000px',
        height: `${height}px`,
      }}
    />
  );
}
