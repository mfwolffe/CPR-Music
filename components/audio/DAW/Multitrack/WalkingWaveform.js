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
  // Track the latest duration to avoid stale closure issues
  const durationRef = useRef(duration);

  // Update ref whenever globalCurrentTime changes
  useEffect(() => {
    currentTimeRef.current = globalCurrentTime;
  }, [globalCurrentTime]);

  // Update ref whenever duration changes
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    console.log('🎤 WalkingWaveform effect:', {
      mediaStream,
      isRecording,
      hasCanvas: !!canvasRef.current,
      startPosition,
      zoomLevel,
      duration,
      currentTime: globalCurrentTime,
    });

    if (!mediaStream || !isRecording || !canvasRef.current) {
      console.log('🎤 WalkingWaveform: Missing requirements', {
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

      // Calculate pixels per second - MUST match MultitrackEditor playhead calculation exactly
      // The playhead uses: pixelsPerSecond = (3000 * scale) / baseDuration
      // where baseDuration = duration > 0 ? duration : 30
      // We need to use the CURRENT duration to match the playhead's calculation
      // Since duration changes during recording, we calculate this dynamically in the draw loop
      const scale = zoomLevel / 100;

      const canvasHeight = canvas.height;

      console.log('🎤 WalkingWaveform: Canvas setup', {
        scale,
        startPosition,
        globalCurrentTime,
        duration,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      });

      // Store the initial globalCurrentTime to calculate elapsed time
      startTimeRef.current = globalCurrentTime;
      waveformDataRef.current = [];

      // Track drawing state
      let frameCount = 0;
      // Clear waveform data on new recording
      waveformDataRef.current = [];
      let lastDrawnX = 0; // Track last drawn X position on canvas

      console.log('🎤 WalkingWaveform: Starting animation loop');

      // Pre-allocate canvas with sufficient width to avoid constant resizing
      const estimatedDuration = 120; // Allocate for at least 2 minutes
      const initialPixelsPerSecond = (3000 * scale) / 30; // Use default for initial sizing
      const initialWidth = Math.floor(initialPixelsPerSecond * estimatedDuration);
      canvas.width = initialWidth;
      canvas.style.width = initialWidth + 'px';

      // Clear canvas initially
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvasHeight);

      // Animation function
      const draw = () => {
        if (!isRecording) {
          console.log('🎤 WalkingWaveform: Stopping animation - recording ended');
          return;
        }

        frameCount++;

        // Log first few frames to debug
        if (frameCount <= 3) {
          console.log(`🎤 WalkingWaveform: Frame ${frameCount} executing`);
        }

        // Calculate elapsed time using currentTimeRef to get latest value
        const currentGlobalTime = currentTimeRef.current;
        const elapsed = currentGlobalTime - startTimeRef.current;

        // Calculate FIXED pixelsPerSecond to match the playhead
        // This MUST match MultitrackEditor's calculation exactly
        const PIXELS_PER_SECOND_AT_100_ZOOM = 100;
        const pixelsPerSecond = PIXELS_PER_SECOND_AT_100_ZOOM * scale;

        // Debug logging every 60 frames (~1 second)
        if (frameCount % 60 === 0) {
          console.log('🎵 WalkingWaveform timing:', {
            frameCount,
            currentTime: currentGlobalTime.toFixed(3),
            startTime: startTimeRef.current.toFixed(3),
            elapsed: elapsed.toFixed(3),
            startPosition,
            currentTimeInTimeline: (startPosition + elapsed).toFixed(3),
            pixelsPerSecond,
            totalSamples: waveformDataRef.current.length,
          });
        }

        // Only resize if we're approaching the edge (within 10 seconds)
        const currentEndX = currentX;
        if (currentEndX > canvas.width - (10 * pixelsPerSecond)) {
          const newWidth = canvas.width + Math.floor(60 * pixelsPerSecond); // Add 1 minute

          // Create temporary canvas to preserve existing content
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(canvas, 0, 0);

          // Resize main canvas
          canvas.width = newWidth;
          canvas.style.width = newWidth + 'px';

          // Restore content
          ctx.drawImage(tempCanvas, 0, 0);
        }

        // Get current audio data
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

        // Calculate the current X position in pixels
        // The waveform represents time elapsed since startPosition
        const currentX = elapsed * pixelsPerSecond;

        // Store amplitude data
        waveformDataRef.current.push({
          time: elapsed,
          amplitude: amplitude,
          x: currentX
        });

        // Draw incrementally from last position to current position
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // If we have at least 2 points, draw a line between them
        if (waveformDataRef.current.length > 1) {
          const prevData = waveformDataRef.current[waveformDataRef.current.length - 2];
          const currData = waveformDataRef.current[waveformDataRef.current.length - 1];

          ctx.beginPath();

          // Previous point
          const prevY = (canvasHeight / 2) - (prevData.amplitude * canvasHeight * 0.4);
          ctx.moveTo(prevData.x, prevY);

          // Current point
          const currY = (canvasHeight / 2) - (currData.amplitude * canvasHeight * 0.4);
          ctx.lineTo(currData.x, currY);

          ctx.stroke();

          // Also draw the bottom half (mirror)
          ctx.beginPath();
          const prevYBottom = (canvasHeight / 2) + (prevData.amplitude * canvasHeight * 0.4);
          ctx.moveTo(prevData.x, prevYBottom);
          const currYBottom = (canvasHeight / 2) + (currData.amplitude * canvasHeight * 0.4);
          ctx.lineTo(currData.x, currYBottom);
          ctx.stroke();
        }

        // Debug logging every 60 frames (~1 second)
        if (frameCount % 60 === 0) {
          const waveformEndX = currentX;
          const expectedPlayheadX = currentGlobalTime * pixelsPerSecond;
          const waveformAbsoluteX = (startPosition + elapsed) * pixelsPerSecond;
          console.log('🎤 WalkingWaveform Sync:', {
            elapsed: elapsed.toFixed(3),
            waveformEndX: waveformEndX.toFixed(1),
            playheadX: expectedPlayheadX.toFixed(1),
            waveformAbsoluteX: waveformAbsoluteX.toFixed(1),
            drift: (expectedPlayheadX - waveformAbsoluteX).toFixed(1),
            globalTime: currentGlobalTime.toFixed(3),
            startPosition,
            pixelsPerSecond: pixelsPerSecond.toFixed(1)
          });
        }

        // Continue animation
        animationRef.current = requestAnimationFrame(draw);
      };

      // Start drawing
      console.log(
        '🎤 WalkingWaveform: Calling draw() to start animation at position',
        startPosition,
      );
      draw();
    } catch (error) {
      console.error('🎤 WalkingWaveform: Error initializing:', error);
    }

    // Cleanup
    return () => {
      console.log('🎤 WalkingWaveform: CLEANUP - Component unmounting or dependencies changed');
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
    // Removed duration from dependencies as it changes constantly during recording
    // We use currentTimeRef to track the current time without causing re-renders
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
