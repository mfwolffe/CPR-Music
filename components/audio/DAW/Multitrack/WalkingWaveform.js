// components/audio/DAW/Multitrack/WalkingWaveform.js
'use client';

import { useEffect, useRef, useState } from 'react';

export default function WalkingWaveform({
  mediaStream,
  isRecording,
  trackId,
  height = 60,
  color = '#ff6b6b',
  backgroundColor = '#2a2a2a',
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

      // Initialize recording start time
      startTimeRef.current = Date.now();
      waveformDataRef.current = [];

      // Clear canvas
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

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
          console.log('WalkingWaveform: Still animating...', frameCount);
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
        const elapsed = (Date.now() - startTimeRef.current) / 1000; // seconds
        const pixelsPerSecond = 50; // Match the timeline scale
        const xPosition = elapsed * pixelsPerSecond;

        // Draw the waveform
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        // Draw waveform bars
        const barWidth = 2;
        const barSpacing = 1;
        const currentBar = Math.floor(xPosition / (barWidth + barSpacing));

        if (currentBar < width / (barWidth + barSpacing)) {
          const x = currentBar * (barWidth + barSpacing);
          const barHeight = amplitude * height * 0.8;

          ctx.fillStyle = color;
          ctx.fillRect(x, (height - barHeight) / 2, barWidth, barHeight);
        }

        // Continue animation
        animationRef.current = requestAnimationFrame(draw);
      };

      // Start drawing
      console.log('WalkingWaveform: Starting animation');
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
  }, [mediaStream, isRecording, height, color, backgroundColor]);

  return (
    <canvas
      ref={canvasRef}
      width={3000} // Match track width
      height={height}
      style={{
        display: 'block',
        backgroundColor,
        border: '1px solid red', // Debug border
      }}
    />
  );
}
