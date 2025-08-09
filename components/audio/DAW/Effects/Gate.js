// components/audio/DAW/Effects/Gate.js
'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { useAudio, useEffects } from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Process gate on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processGateRegion(
  audioBuffer,
  startSample,
  endSample,
  parameters,
) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;

  // Convert dB to linear
  const dbToLinear = (db) => Math.pow(10, db / 20);

  // Gate parameters
  const thresholdLinear = dbToLinear(parameters.threshold || -40);
  const rangeLinear = dbToLinear(parameters.range || -60);
  const attackSamples = Math.floor((parameters.attack || 0.001) * sampleRate);
  const releaseSamples = Math.floor((parameters.release || 0.1) * sampleRate);
  const holdSamples = Math.floor((parameters.hold || 0.01) * sampleRate);

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

    // Gate state variables
    let gateOpen = false;
    let gateGain = 0;
    let holdCounter = 0;
    let envelope = 0;

    // Envelope follower coefficient
    const envCoeff = 0.99;

    // Process region
    for (let i = 0; i < regionLength; i++) {
      const sampleIndex = startSample + i;
      const inputSample = inputData[sampleIndex];

      // Update envelope
      const rectified = Math.abs(inputSample);
      envelope = rectified + (envelope - rectified) * envCoeff;

      // Gate logic
      if (envelope > thresholdLinear) {
        gateOpen = true;
        holdCounter = holdSamples;
      } else if (holdCounter > 0) {
        holdCounter--;
      } else {
        gateOpen = false;
      }

      // Calculate target gain
      const targetGain = gateOpen ? 1 : rangeLinear;

      // Smooth gain changes
      if (targetGain > gateGain) {
        // Attack
        const attackRate = 1 / attackSamples;
        gateGain = Math.min(targetGain, gateGain + attackRate);
      } else {
        // Release
        const releaseRate = 1 / releaseSamples;
        gateGain = Math.max(targetGain, gateGain - releaseRate);
      }

      // Apply gate
      outputData[sampleIndex] = inputSample * gateGain;
    }
  }

  return outputBuffer;
}

/**
 * Gate effect component - cuts audio below threshold
 */
export default function Gate({ width }) {
  const { audioRef, wavesurferRef, addToEditHistory, audioURL } = useAudio();

  const {
    gateThreshold,
    setGateThreshold,
    gateAttack,
    setGateAttack,
    gateRelease,
    setGateRelease,
    gateHold,
    setGateHold,
    gateRange,
    setGateRange,
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

  // Apply gate to selected region
  const applyGate = useCallback(async () => {
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
        threshold: gateThreshold,
        attack: gateAttack,
        release: gateRelease,
        hold: gateHold,
        range: gateRange,
      };

      const outputBuffer = await processGateRegion(
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
      addToEditHistory(url, 'Apply Gate', {
        effect: 'gate',
        parameters,
        region: { start: cutRegion.start, end: cutRegion.end },
      });

      // Load new audio
      await wavesurfer.load(url);

      // Clear region
      cutRegion.remove();
    } catch (error) {
      console.error('Error applying gate:', error);
      alert('Error applying gate. Please try again.');
    }
  }, [
    audioURL,
    addToEditHistory,
    wavesurferRef,
    gateThreshold,
    gateAttack,
    gateRelease,
    gateHold,
    gateRange,
    cutRegion,
  ]);

  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={gateThreshold}
            onChange={setGateThreshold}
            min={-80}
            max={0}
            label="Threshold"
            displayValue={`${gateThreshold.toFixed(0)}dB`}
            size={45}
            color="#e75b5c"
          />
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={gateRange}
            onChange={setGateRange}
            min={-80}
            max={0}
            label="Range"
            displayValue={`${gateRange.toFixed(0)}dB`}
            size={45}
            color="#7bafd4"
          />
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={gateAttack * 1000}
            onChange={(v) => setGateAttack(v / 1000)}
            min={0.1}
            max={10}
            step={0.1}
            label="Attack"
            displayValue={`${(gateAttack * 1000).toFixed(1)}ms`}
            size={45}
            color="#92ce84"
          />
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={gateHold * 1000}
            onChange={(v) => setGateHold(v / 1000)}
            min={0}
            max={100}
            label="Hold"
            displayValue={`${(gateHold * 1000).toFixed(0)}ms`}
            size={45}
            color="#cbb677"
          />
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={gateRelease * 1000}
            onChange={(v) => setGateRelease(v / 1000)}
            min={10}
            max={1000}
            label="Release"
            displayValue={`${(gateRelease * 1000).toFixed(0)}ms`}
            size={45}
            color="#92ceaa"
          />
        </Col>

        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button size="sm" className="w-100" onClick={applyGate}>
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
