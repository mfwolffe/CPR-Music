'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button, Dropdown, Form } from 'react-bootstrap';
import { useAudio, useEffects } from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Generate LFO waveform
 */
function generateLFOWaveform(type, sampleRate, duration, frequency, phase) {
  const samples = Math.floor(sampleRate * duration);
  const waveform = new Float32Array(samples);
  const phaseOffset = (phase / 360) * Math.PI * 2;

  for (let i = 0; i < samples; i++) {
    const t = (i / sampleRate) * frequency * Math.PI * 2 + phaseOffset;

    switch (type) {
      case 'sine':
        waveform[i] = Math.sin(t);
        break;

      case 'triangle':
        // Triangle wave formula
        const normalized = (t / (Math.PI * 2)) % 1;
        waveform[i] = 4 * Math.abs(normalized - 0.5) - 1;
        break;

      case 'square':
        waveform[i] = Math.sin(t) > 0 ? 1 : -1;
        break;

      case 'sawtooth':
        // Sawtooth wave formula
        waveform[i] = 2 * ((t / (Math.PI * 2)) % 1) - 1;
        break;

      default:
        waveform[i] = Math.sin(t);
    }
  }

  return waveform;
}

/**
 * Process auto-pan on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processAutoPanRegion(
  audioBuffer,
  startSample,
  endSample,
  parameters,
) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;
  const regionDuration = (endSample - startSample) / sampleRate;

  // Generate LFO for panning
  const lfoWaveform = generateLFOWaveform(
    parameters.waveform || 'sine',
    sampleRate,
    regionDuration,
    parameters.rate || 1,
    parameters.phase || 0,
  );

  // Create output buffer
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate,
  );

  // Process audio
  if (audioBuffer.numberOfChannels === 2) {
    // Stereo processing
    const leftIn = audioBuffer.getChannelData(0);
    const rightIn = audioBuffer.getChannelData(1);
    const leftOut = outputBuffer.getChannelData(0);
    const rightOut = outputBuffer.getChannelData(1);

    // Copy original audio
    leftOut.set(leftIn);
    rightOut.set(rightIn);

    // Apply auto-pan to region
    for (let i = 0; i < regionLength; i++) {
      const sampleIndex = startSample + i;
      const lfoValue = lfoWaveform[i] * (parameters.depth || 1);

      // Calculate pan values (constant power panning)
      const panValue = (lfoValue + 1) / 2; // Convert from -1...1 to 0...1
      const leftGain = Math.cos((panValue * Math.PI) / 2);
      const rightGain = Math.sin((panValue * Math.PI) / 2);

      const originalLeft = leftIn[sampleIndex];
      const originalRight = rightIn[sampleIndex];

      // Preserve stereo information: scale each channel instead of collapsing to mono
      leftOut[sampleIndex] = originalLeft * leftGain;
      rightOut[sampleIndex] = originalRight * rightGain;
    }
  } else {
    // Mono to stereo processing
    const monoIn = audioBuffer.getChannelData(0);
    const monoOut = outputBuffer.getChannelData(0);

    // Copy original audio
    monoOut.set(monoIn);

    // For mono, we can't pan - just copy the data
    console.warn(
      'Auto-pan works best with stereo audio. Mono audio will be unchanged.',
    );
  }

  return outputBuffer;
}

/**
 * Auto-Pan effect component using Web Audio API StereoPannerNode
 */
export default function AutoPan({ width }) {
  const { audioRef, wavesurferRef, addToEditHistory, audioURL } = useAudio();

  const {
    autoPanRate,
    setAutoPanRate,
    autoPanDepth,
    setAutoPanDepth,
    autoPanWaveform,
    setAutoPanWaveform,
    autoPanPhase,
    setAutoPanPhase,
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

  // Apply auto-pan to selected region
  const applyAutoPan = useCallback(async () => {
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
        rate: autoPanRate,
        depth: autoPanDepth,
        waveform: autoPanWaveform,
        phase: autoPanPhase,
      };

      const outputBuffer = await processAutoPanRegion(
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
      addToEditHistory(url, 'Apply Auto-Pan', {
        effect: 'autopan',
        parameters,
        region: { start: cutRegion.start, end: cutRegion.end },
      });

      // Load new audio
      await wavesurfer.load(url);

      // Clear region
      cutRegion.remove();
    } catch (error) {
      console.error('Error applying auto-pan:', error);
      alert('Error applying auto-pan. Please try again.');
    }
  }, [
    audioURL,
    addToEditHistory,
    wavesurferRef,
    autoPanRate,
    autoPanDepth,
    autoPanWaveform,
    autoPanPhase,
    cutRegion,
  ]);

  const waveformTypes = [
    { key: 'sine', name: 'Sine' },
    { key: 'triangle', name: 'Triangle' },
    { key: 'square', name: 'Square' },
    { key: 'sawtooth', name: 'Sawtooth' },
  ];

  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        {/* Waveform selector */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Waveform</Form.Label>
          <Dropdown
            onSelect={(eventKey) => setAutoPanWaveform(eventKey)}
            size="sm"
          >
            <Dropdown.Toggle variant="secondary" size="sm" className="w-100">
              {waveformTypes.find((t) => t.key === autoPanWaveform)?.name ||
                'Sine'}
            </Dropdown.Toggle>
            <Dropdown.Menu className="bg-daw-toolbars">
              {waveformTypes.map((type) => (
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
            value={autoPanRate}
            onChange={setAutoPanRate}
            min={0.1}
            max={20}
            step={0.1}
            label="Rate"
            displayValue={`${autoPanRate.toFixed(1)}Hz`}
            size={45}
            color="#e75b5c"
          />
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={autoPanDepth}
            onChange={setAutoPanDepth}
            min={0}
            max={1}
            label="Depth"
            displayValue={`${Math.round(autoPanDepth * 100)}%`}
            size={45}
            color="#7bafd4"
          />
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={autoPanPhase}
            onChange={setAutoPanPhase}
            min={0}
            max={360}
            step={1}
            label="Phase"
            displayValue={`${autoPanPhase}°`}
            size={45}
            color="#cbb677"
          />
        </Col>

        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button size="sm" className="w-100" onClick={applyAutoPan}>
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
