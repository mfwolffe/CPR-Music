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

  // Track the latest globalCurrentTime to avoid stale closure issues
  const currentTimeRef = useRef(globalCurrentTime);

  // Update ref whenever globalCurrentTime changes
  useEffect(() => {
    currentTimeRef.current = globalCurrentTime;
  }, [globalCurrentTime]);

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

      console.log('WalkingWaveform: Audio context initialized', {
        sampleRate: audioContextRef.current.sampleRate,
        state: audioContextRef.current.state,
        baseLatency: audioContextRef.current.baseLatency,
      });

      // Set up canvas with consistent pixels-per-second calculation
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // Calculate base dimensions and pixels per second (matching MultitrackEditor)
      const baseWidth = 310 + 3000 * (zoomLevel / 100); // 80px sidebar + 230px track controls
      const baseContentWidth = baseWidth - 230; // Subtract controls

      // Use simple baseDuration for pixels-per-second calculation
      const baseDuration = duration || 30;

      // CONSTANT pixels-per-second - never changes during recording
      const pixelsPerSecond = baseContentWidth / baseDuration;

      const canvasHeight = canvas.height;

      console.log('WalkingWaveform: Setup', {
        baseContentWidth,
        baseDuration,
        pixelsPerSecond,
        startPosition,
      });

      // Store the initial globalCurrentTime to calculate elapsed time
      startTimeRef.current = globalCurrentTime;
      waveformDataRef.current = [];

      let frameCount = 0;

      // Animation function
      const draw = () => {
        if (!isRecording) {
          console.log('WalkingWaveform: Stopping animation - recording ended');
          return;
        }

        frameCount++;

        // Calculate elapsed time using currentTimeRef to get latest value (avoid stale closure)
        // This ensures waveform and playhead move at EXACTLY the same rate
        const elapsed = currentTimeRef.current - startTimeRef.current;

        // Debug logging every 60 frames (~1 second)
        if (frameCount % 60 === 0) {
          console.log('🎵 WalkingWaveform timing:', {
            frameCount,
            currentTime: currentTimeRef.current.toFixed(3),
            startTime: startTimeRef.current.toFixed(3),
            elapsed: elapsed.toFixed(3),
            startPosition,
            currentTimeInTimeline: (startPosition + elapsed).toFixed(3),
          });
        }
        const effectiveDuration = Math.max(baseDuration, elapsed + 20); // Keep 20s buffer
        const newWidth = Math.max(1, Math.floor(pixelsPerSecond * effectiveDuration));

        // Resize canvas if needed (without stretching)
        if (canvas.width !== newWidth) {
          canvas.width = newWidth;
          canvas.style.width = newWidth + 'px';
        }

        const width = canvas.width;

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

        // Use the elapsed time already calculated above
        const currentTime = startPosition + elapsed; // absolute position in timeline
        
        // Store waveform data point with timestamp
        waveformDataRef.current.push({
          amplitude,
          time: currentTime
        });

        // Clear and redraw entire canvas
        // NOTE: No viewport scrolling here - parent MultitrackEditor handles that
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, canvasHeight);

        // Draw all waveform data in absolute timeline coordinates
        const barWidth = 2;

        ctx.fillStyle = color;
        for (let i = 0; i < waveformDataRef.current.length; i++) {
          const sample = waveformDataRef.current[i];
          // Convert absolute timeline time to pixel position
          const xPosition = (sample.time - startPosition) * pixelsPerSecond;

          // Draw all bars (parent handles scrolling via container scroll)
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
