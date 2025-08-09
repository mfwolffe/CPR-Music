// components/audio/DAW/Effects/Distortion.js
'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button, Dropdown, Form } from 'react-bootstrap';
import { useAudio, useEffects } from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Create distortion curve
 */
function makeDistortionCurve(amount, type = 'overdrive') {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;

    switch (type) {
      case 'overdrive':
        // Soft clipping
        curve[i] =
          ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
        break;

      case 'distortion':
        // Hard clipping
        curve[i] = Math.sign(x) * Math.min((Math.abs(x) * amount) / 10, 1);
        break;

      case 'fuzz':
        // Extreme clipping with harmonics - fixed to avoid division by near-zero
        const k = Math.max(0.1, amount / 10); // Clamp to avoid extreme values
        curve[i] = Math.sign(x) * Math.pow(Math.abs(x), 1 / k);
        break;

      case 'bitcrush':
        // Quantize to simulate bit reduction (amplitude quantization only)
        const bits = Math.max(1, 16 - amount / 10);
        const step = 2 / Math.pow(2, bits);
        curve[i] = Math.round(x / step) * step;
        break;

      default:
        curve[i] = x;
    }
  }

  return curve;
}

/**
 * Process distortion on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processDistortionRegion(
  audioBuffer,
  startSample,
  endSample,
  parameters,
) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;

  // Create offline context for processing
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate,
  );

  // Create nodes
  const source = offlineContext.createBufferSource();
  const waveshaper = offlineContext.createWaveShaper();
  const toneFilter = offlineContext.createBiquadFilter();
  const outputGain = offlineContext.createGain();

  // Configure distortion
  waveshaper.curve = makeDistortionCurve(
    parameters.amount || 50,
    parameters.type || 'overdrive',
  );
  waveshaper.oversample = '4x';

  // Configure tone control (low-pass filter)
  toneFilter.type = 'lowpass';
  toneFilter.frequency.value = parameters.tone || 5000;
  toneFilter.Q.value = 0.7;

  // Set output gain
  outputGain.gain.value = parameters.outputGain || 0.7;

  // Connect nodes
  source.connect(waveshaper);
  waveshaper.connect(toneFilter);
  toneFilter.connect(outputGain);
  outputGain.connect(offlineContext.destination);

  // Process only the selected region
  source.buffer = audioBuffer;
  source.start(0);

  // Render
  const renderedBuffer = await offlineContext.startRendering();

  // Create output buffer with processed region
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate,
  );

  // Mix the processed region back
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const processedData = renderedBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    // Copy original audio
    outputData.set(inputData);

    // Overwrite with processed region
    for (let i = 0; i < regionLength; i++) {
      outputData[startSample + i] = processedData[startSample + i];
    }
  }

  return outputBuffer;
}

/**
 * Distortion effect component using Web Audio API WaveShaperNode
 */
export default function Distortion({ width }) {
  const { audioRef, wavesurferRef, addToEditHistory, audioURL } = useAudio();

  const {
    distortionAmount,
    setDistortionAmount,
    distortionType,
    setDistortionType,
    distortionTone,
    setDistortionTone,
    distortionOutputGain,
    setDistortionOutputGain,
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

  // Apply distortion to selected region
  const applyDistortion = useCallback(async () => {
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
        amount: distortionAmount,
        type: distortionType,
        tone: distortionTone,
        outputGain: distortionOutputGain,
      };

      const outputBuffer = await processDistortionRegion(
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
      addToEditHistory(url, 'Apply Distortion', {
        effect: 'distortion',
        parameters,
        region: { start: cutRegion.start, end: cutRegion.end },
      });

      // Load new audio
      await wavesurfer.load(url);

      // Clear region
      cutRegion.remove();
    } catch (error) {
      console.error('Error applying distortion:', error);
      alert('Error applying distortion. Please try again.');
    }
  }, [
    audioURL,
    addToEditHistory,
    wavesurferRef,
    distortionAmount,
    distortionType,
    distortionTone,
    distortionOutputGain,
    cutRegion,
  ]);

  const distortionTypes = [
    { key: 'overdrive', name: 'Overdrive' },
    { key: 'distortion', name: 'Distortion' },
    { key: 'fuzz', name: 'Fuzz' },
    { key: 'bitcrush', name: 'Bit Crusher' },
  ];

  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        {/* Type selector */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Type</Form.Label>
          <Dropdown
            onSelect={(eventKey) => setDistortionType(eventKey)}
            size="sm"
          >
            <Dropdown.Toggle variant="secondary" size="sm" className="w-100">
              {distortionTypes.find((t) => t.key === distortionType)?.name ||
                'Overdrive'}
            </Dropdown.Toggle>
            <Dropdown.Menu className="bg-daw-toolbars">
              {distortionTypes.map((type) => (
                <Dropdown.Item
                  key={type.key}
                  eventKey={type.key}
                  className="text-white"
                >
                  {type.name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </Col>

        {/* Knobs */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={distortionAmount}
            onChange={setDistortionAmount}
            min={0}
            max={100}
            label="Drive"
            displayValue={`${Math.round(distortionAmount)}%`}
            size={45}
            color="#e75b5c"
          />
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={distortionTone}
            onChange={setDistortionTone}
            min={200}
            max={20000}
            label="Tone"
            displayValue={
              distortionTone >= 1000
                ? `${(distortionTone / 1000).toFixed(1)}k`
                : `${distortionTone}Hz`
            }
            size={45}
            color="#cbb677"
          />
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={distortionOutputGain}
            onChange={setDistortionOutputGain}
            min={0}
            max={1}
            label="Output"
            displayValue={`${Math.round(distortionOutputGain * 100)}%`}
            size={45}
            color="#92ce84"
          />
        </Col>

        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button size="sm" className="w-100" onClick={applyDistortion}>
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
