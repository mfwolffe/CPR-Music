// components/audio/DAW/Multitrack/SimpleWaveformTest.js
'use client';

import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

export default function SimpleWaveformTest({ audioURL, trackId }) {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !audioURL) return;

    console.log(`SimpleWaveformTest ${trackId} - Creating wavesurfer...`);

    // Create wavesurfer instance
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#7bafd4',
      progressColor: '#92ce84',
      cursorColor: '#cbb677',
      barWidth: 2,
      barHeight: 0.8,
      height: 60,
      normalize: true,
      interact: true,
      dragToSeek: true,
    });

    wavesurferRef.current = ws;

    // Load audio
    console.log(`SimpleWaveformTest ${trackId} - Loading audio:`, audioURL);
    ws.load(audioURL)
      .then(() => {
        console.log(
          `SimpleWaveformTest ${trackId} - Audio loaded successfully!`,
        );
      })
      .catch((err) => {
        console.error(
          `SimpleWaveformTest ${trackId} - Error loading audio:`,
          err,
        );
      });

    // Cleanup
    return () => {
      console.log(`SimpleWaveformTest ${trackId} - Destroying wavesurfer`);
      ws.destroy();
    };
  }, [audioURL, trackId]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '60px',
        backgroundColor: '#2a2a2a',
        border: '1px solid red',
        marginBottom: '10px',
      }}
    />
  );
}
