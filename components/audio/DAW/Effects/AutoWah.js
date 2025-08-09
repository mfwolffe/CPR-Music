'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { useAudio, useEffects } from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Process auto-wah on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processAutoWahRegion(
  audioBuffer,
  startSample,
  endSample,
  parameters,
) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;

  // Calculate envelope follower
  const calculateEnvelope = (audioData, attack, release) => {
    const envelope = new Float32Array(audioData.length);
    let envValue = 0;

    const attackCoeff = Math.exp(-1 / (attack * sampleRate));
    const releaseCoeff = Math.exp(-1 / (release * sampleRate));

    for (let i = 0; i < audioData.length; i++) {
      const rectified = Math.abs(audioData[i]);

      if (rectified > envValue) {
        // Attack
        envValue = rectified + (envValue - rectified) * attackCoeff;
      } else {
        // Release
        envValue = rectified + (envValue - rectified) * releaseCoeff;
      }

      envelope[i] = envValue;
    }

    return envelope;
  };

  // Create output buffer
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate,
  );

  // Process each channel
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    // Copy original audio
    outputData.set(inputData);

    // Extract region for processing
    const regionData = new Float32Array(regionLength);
    for (let i = 0; i < regionLength; i++) {
      regionData[i] = inputData[startSample + i];
    }

    // Calculate envelope
    const envelope = calculateEnvelope(
      regionData,
      parameters.attack || 0.01,
      parameters.release || 0.1,
    );

    // Create offline context for filtering
    const offlineContext = new OfflineAudioContext(1, regionLength, sampleRate);
    const sourceBuffer = offlineContext.createBuffer(
      1,
      regionLength,
      sampleRate,
    );
    sourceBuffer.getChannelData(0).set(regionData);

    const source = offlineContext.createBufferSource();
    const filter = offlineContext.createBiquadFilter();

    source.buffer = sourceBuffer;
    filter.type = 'bandpass';
    filter.Q.value = parameters.q || 5;

    // Set up automation for filter frequency based on envelope
    const baseFreq = parameters.frequency || 500;
    const range = parameters.range || 2000;
    const sensitivity = parameters.sensitivity || 0.5;

    // Initialize value and then ramp forward in small steps
    let lastTime = offlineContext.currentTime;
    let lastFreq = baseFreq;
    filter.frequency.setValueAtTime(lastFreq, lastTime);

    const automationRate = 128; // samples per automation point
    const stepSec = automationRate / sampleRate;

    for (let i = 0; i < regionLength; i += automationRate) {
      const envValue = envelope[i] * sensitivity;
      const target = Math.max(20, Math.min(20000, baseFreq + envValue * range));
      const time = lastTime + stepSec;
      const t1 = Math.max(time, lastTime + 1e-4); // ensure strictly increasing
      filter.frequency.linearRampToValueAtTime(target, t1);
      lastTime = t1;
      lastFreq = target;
    }

    // Connect and render
    source.connect(filter);
    filter.connect(offlineContext.destination);
    source.start(0);

    const renderedBuffer = await offlineContext.startRendering();
    const processedData = renderedBuffer.getChannelData(0);

    // Copy processed region back
    for (let i = 0; i < regionLength; i++) {
      outputData[startSample + i] = processedData[i];
    }
  }

  return outputBuffer;
}

/**
 * Auto-Wah effect component - envelope-controlled filter
 */
export default function AutoWah({ width }) {
  const { audioRef, wavesurferRef, addToEditHistory, audioURL } = useAudio();

  const {
    autoWahSensitivity,
    setAutoWahSensitivity,
    autoWahFrequency,
    setAutoWahFrequency,
    autoWahRange,
    setAutoWahRange,
    autoWahQ,
    setAutoWahQ,
    autoWahAttack,
    setAutoWahAttack,
    autoWahRelease,
    setAutoWahRelease,
    cutRegion,
  } = useEffects();

  const audioContextRef = useRef(null);

  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
  }, []);

  // Apply auto-wah to selected region
  const applyAutoWah = useCallback(async () => {
    if (!cutRegion || !wavesurferRef.current) {
      alert('Please select a region first');
      return;
    }

    try {
      const wavesurfer = wavesurferRef.current;
      const context = audioContextRef.current;

      // Get the audio buffer
      const response = await fetch(audioURL);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(arrayBuffer);

      // Calculate sample positions
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(cutRegion.start * sampleRate);
      const endSample = Math.floor(cutRegion.end * sampleRate);

      // Use the exported processing function
      const parameters = {
        sensitivity: autoWahSensitivity,
        frequency: autoWahFrequency,
        range: autoWahRange,
        q: autoWahQ,
        attack: autoWahAttack,
        release: autoWahRelease,
      };

      const outputBuffer = await processAutoWahRegion(
        audioBuffer,
        startSample,
        endSample,
        parameters,
      );

      // Convert to blob and update
      const wav = await audioBufferToWav(outputBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      // Update audio and history
      addToEditHistory(url, 'Apply Auto-Wah', {
        effect: 'autowah',
        parameters,
        region: { start: cutRegion.start, end: cutRegion.end },
      });

      // Load new audio
      await wavesurfer.load(url);

      // Clear region
      cutRegion.remove();
    } catch (error) {
      console.error('Error applying auto-wah:', error);
      alert('Error applying auto-wah. Please try again.');
    }
  }, [
    audioURL,
    addToEditHistory,
    wavesurferRef,
    autoWahSensitivity,
    autoWahFrequency,
    autoWahRange,
    autoWahQ,
    autoWahAttack,
    autoWahRelease,
    cutRegion,
  ]);

  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={autoWahSensitivity}
            onChange={setAutoWahSensitivity}
            min={0}
            max={1}
            label="Sensitivity"
            displayValue={`${Math.round(autoWahSensitivity * 100)}%`}
            size={45}
            color="#e75b5c"
          />
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={autoWahFrequency}
            onChange={setAutoWahFrequency}
            min={200}
            max={2000}
            step={10}
            label="Base Freq"
            displayValue={
              autoWahFrequency >= 1000
                ? `${(autoWahFrequency / 1000).toFixed(1)}k`
                : `${autoWahFrequency}Hz`
            }
            size={45}
            color="#7bafd4"
          />
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={autoWahRange}
            onChange={setAutoWahRange}
            min={100}
            max={5000}
            step={50}
            label="Range"
            displayValue={
              autoWahRange >= 1000
                ? `${(autoWahRange / 1000).toFixed(1)}k`
                : `${autoWahRange}Hz`
            }
            size={45}
            color="#92ce84"
          />
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={autoWahQ}
            onChange={setAutoWahQ}
            min={0.5}
            max={20}
            step={0.1}
            label="Resonance"
            displayValue={`${autoWahQ.toFixed(1)}`}
            size={45}
            color="#cbb677"
          />
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={autoWahAttack * 1000}
            onChange={(v) => setAutoWahAttack(v / 1000)}
            min={1}
            max={100}
            label="Attack"
            displayValue={`${(autoWahAttack * 1000).toFixed(0)}ms`}
            size={45}
            color="#92ceaa"
          />
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={autoWahRelease * 1000}
            onChange={(v) => setAutoWahRelease(v / 1000)}
            min={10}
            max={1000}
            label="Release"
            displayValue={`${(autoWahRelease * 1000).toFixed(0)}ms`}
            size={45}
            color="#92ceaa"
          />
        </Col>

        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button size="sm" className="w-100" onClick={applyAutoWah}>
            Apply to Region
          </Button>
        </Col>
      </Row>
    </Container>
  );
}

// Helper function to convert AudioBuffer to WAV
async function audioBufferToWav(buffer) {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  const channels = [];
  let offset = 0;
  let pos = 0;

  // Write WAV header
  const setUint16 = (data) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };
  const setUint32 = (data) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  // RIFF identifier
  setUint32(0x46464952);
  // file length
  setUint32(length - 8);
  // RIFF type
  setUint32(0x45564157);
  // format chunk identifier
  setUint32(0x20746d66);
  // format chunk length
  setUint32(16);
  // sample format (PCM)
  setUint16(1);
  // channel count
  setUint16(buffer.numberOfChannels);
  // sample rate
  setUint32(buffer.sampleRate);
  // byte rate
  setUint32(buffer.sampleRate * buffer.numberOfChannels * 2);
  // block align
  setUint16(buffer.numberOfChannels * 2);
  // bits per sample
  setUint16(16);
  // data chunk identifier
  setUint32(0x61746164);
  // data chunk length
  setUint32(length - pos - 4);

  // Extract channel data
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  // Interleave channels and convert to 16-bit PCM
  while (offset < buffer.length) {
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return arrayBuffer;
}
