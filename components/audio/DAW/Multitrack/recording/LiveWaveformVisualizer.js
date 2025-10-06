// components/audio/DAW/Multitrack/recording/LiveWaveformVisualizer.js
'use client';

import { useEffect, useRef } from 'react';
import RecordingManager from './RecordingManager';
import { getAudioContext } from '../AudioEngine';

export default function LiveWaveformVisualizer({
  trackId,
  mediaStream,
  height = 120,
  color = '#ff6b6b',
  backgroundColor = 'transparent',
  zoomLevel = 100,
  getTransportTime
}) {
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const sourceRef = useRef(null);
  const waveformDataRef = useRef([]);
  const isDrawingRef = useRef(false);
  const startTimeRef = useRef(null);
  const startPositionRef = useRef(0);

  // Setup audio analysis
  useEffect(() => {
    if (!mediaStream) return;

    const setupAnalyser = async () => {
      try {
        const audioContext = getAudioContext();

        // Resume if suspended
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        // Create audio source
        sourceRef.current = audioContext.createMediaStreamSource(mediaStream);

        // Create analyser
        analyserRef.current = audioContext.createAnalyser();
        analyserRef.current.fftSize = 2048;
        analyserRef.current.smoothingTimeConstant = 0.8;

        // Connect
        sourceRef.current.connect(analyserRef.current);

        console.log(`📊 LiveWaveformVisualizer: Audio analyser setup for track ${trackId}`);
      } catch (error) {
        console.error(`📊 LiveWaveformVisualizer: Setup error:`, error);
      }
    };

    setupAnalyser();

    // Cleanup
    return () => {
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
      }
      if (analyserRef.current) {
        try {
          analyserRef.current.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
      }
    };
  }, [mediaStream, trackId]);

  // Subscribe to recording events
  useEffect(() => {
    const handleRecordingStart = ({ trackId: id, type, startPosition }) => {
      if (id === trackId && type === 'audio') {
        console.log(`📊 LiveWaveformVisualizer: Starting visualization for track ${trackId}`);
        startTimeRef.current = performance.now() / 1000;
        startPositionRef.current = startPosition || 0;
        waveformDataRef.current = [];
        isDrawingRef.current = true;
        startDrawing();
      }
    };

    const handleRecordingStop = ({ trackId: id, type }) => {
      if (id === trackId && type === 'audio') {
        console.log(`📊 LiveWaveformVisualizer: Stopping visualization for track ${trackId}`);
        stopDrawing();
      }
    };

    RecordingManager.on('recording-start', handleRecordingStart);
    RecordingManager.on('recording-stop', handleRecordingStop);

    return () => {
      RecordingManager.off('recording-start', handleRecordingStart);
      RecordingManager.off('recording-stop', handleRecordingStop);
      stopDrawing();
    };
  }, [trackId]);

  const stopDrawing = () => {
    isDrawingRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    waveformDataRef.current = [];
  };

  const startDrawing = () => {
    if (!canvasRef.current || !analyserRef.current) {
      console.log(`📊 LiveWaveformVisualizer: Cannot start - missing canvas or analyser`);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Calculate pixels per second
    const PIXELS_PER_SECOND_AT_100_ZOOM = 100;
    const pixelsPerSecond = PIXELS_PER_SECOND_AT_100_ZOOM * (zoomLevel / 100);

    // Set initial canvas size
    canvas.width = Math.floor(pixelsPerSecond * 120); // 2 minutes
    canvas.style.width = canvas.width + 'px';

    // Clear canvas
    ctx.fillStyle = backgroundColor === 'transparent' ? 'rgba(0,0,0,0)' : backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    console.log(`📊 LiveWaveformVisualizer: Starting draw loop`, {
      width: canvas.width,
      height: canvas.height,
      pixelsPerSecond
    });

    let frameCount = 0;

    const draw = () => {
      if (!isDrawingRef.current || !analyserRef.current || !canvasRef.current) {
        console.log(`📊 LiveWaveformVisualizer: Stopping draw loop`);
        return;
      }

      frameCount++;

      // Get current time
      let currentTime = startPositionRef.current;
      if (getTransportTime && typeof getTransportTime === 'function') {
        currentTime = getTransportTime();
      } else if (startTimeRef.current !== null) {
        const elapsed = (performance.now() / 1000) - startTimeRef.current;
        currentTime = startPositionRef.current + elapsed;
      }

      // Calculate X position
      const currentX = currentTime * pixelsPerSecond;

      // Resize canvas if needed
      if (currentX > canvas.width - (10 * pixelsPerSecond)) {
        const newWidth = canvas.width + Math.floor(60 * pixelsPerSecond);

        // Save current content
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Resize
        canvas.width = newWidth;
        canvas.style.width = newWidth + 'px';

        // Restore content
        ctx.putImageData(imageData, 0, 0);
      }

      // Get audio data
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteTimeDomainData(dataArray);

      // Calculate RMS amplitude
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / bufferLength);
      const amplitude = Math.min(rms * 3, 1);

      // Store data point
      const dataPoint = {
        time: currentTime,
        amplitude: amplitude,
        x: currentX
      };
      waveformDataRef.current.push(dataPoint);

      // Draw waveform
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.8;

      // Draw current sample as vertical bar
      const barHeight = amplitude * canvas.height * 0.8;
      const barY = (canvas.height - barHeight) / 2;

      ctx.fillRect(
        currentX - 1,
        barY,
        2,
        barHeight
      );

      // Connect to previous sample
      if (waveformDataRef.current.length > 1) {
        const prevData = waveformDataRef.current[waveformDataRef.current.length - 2];
        const gap = currentX - prevData.x;

        if (gap > 0 && gap < 10) {
          ctx.beginPath();

          const prevHeight = prevData.amplitude * canvas.height * 0.8;
          const prevY = (canvas.height - prevHeight) / 2;

          // Draw filled polygon connecting samples
          ctx.moveTo(prevData.x, prevY);
          ctx.lineTo(currentX, barY);
          ctx.lineTo(currentX, barY + barHeight);
          ctx.lineTo(prevData.x, prevY + prevHeight);
          ctx.closePath();
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1.0;

      // Log progress periodically
      if (frameCount % 60 === 0) {
        console.log(`📊 LiveWaveformVisualizer: Frame ${frameCount}`, {
          time: currentTime.toFixed(2),
          x: currentX.toFixed(0),
          samples: waveformDataRef.current.length
        });
      }

      // Continue animation
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    // Start drawing
    draw();
  };

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={height}
      style={{
        display: 'block',
        position: 'absolute',
        top: '50%',
        left: 0,
        transform: 'translateY(-50%)',
        backgroundColor: 'transparent',
        height: `${height}px`,
        pointerEvents: 'none',
        zIndex: 10
      }}
    />
  );
}