'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button, Dropdown, Form } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects 
} from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Generate oscillator waveform
 */
function generateOscillatorWaveform(type, sampleRate, duration, frequency) {
  const samples = Math.floor(sampleRate * duration);
  const waveform = new Float32Array(samples);
  
  for (let i = 0; i < samples; i++) {
    const t = (i / sampleRate) * frequency * Math.PI * 2;
    
    switch(type) {
      case 'sine':
        waveform[i] = Math.sin(t);
        break;
        
      case 'triangle':
        const normalized = (t / (Math.PI * 2)) % 1;
        waveform[i] = 4 * Math.abs(normalized - 0.5) - 1;
        break;
        
      case 'square':
        waveform[i] = Math.sin(t) > 0 ? 1 : -1;
        break;
        
      case 'sawtooth':
        waveform[i] = 2 * ((t / (Math.PI * 2)) % 1) - 1;
        break;
        
      default:
        waveform[i] = Math.sin(t);
    }
  }
  
  return waveform;
}

/**
 * Process ring modulation on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processRingModulatorRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;
  const regionDuration = (endSample - startSample) / sampleRate;
  
  // Generate oscillator waveform
  const oscillatorWaveform = generateOscillatorWaveform(
    parameters.waveform || 'sine',
    sampleRate,
    regionDuration,
    parameters.frequency || 440
  );
  
  // Create output buffer
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );
  
  // Process each channel
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);
    
    // Copy original audio
    outputData.set(inputData);
    
    // Apply ring modulation to region
    for (let i = 0; i < regionLength; i++) {
      const sampleIndex = startSample + i;
      const originalSample = inputData[sampleIndex];
      
      // Ring modulation: multiply signal with oscillator
      const modulatedSample = originalSample * oscillatorWaveform[i] * (parameters.depth || 1);
      
      // Mix dry and wet signals
      outputData[sampleIndex] = (originalSample * (1 - (parameters.mix || 1))) + (modulatedSample * (parameters.mix || 1));
    }
  }
  
  return outputBuffer;
}

/**
 * Ring Modulator effect component - multiplies signal with oscillator
 */
export default function RingModulator({ width }) {
  const {
    audioRef,
    wavesurferRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const {
    ringModFrequency,
    setRingModFrequency,
    ringModWaveform,
    setRingModWaveform,
    ringModMix,
    setRingModMix,
    ringModDepth,
    setRingModDepth,
    cutRegion
  } = useEffects();
  
  const audioContextRef = useRef(null);
  
  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);
  
  // Apply ring modulation to selected region
  const applyRingMod = useCallback(async () => {
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
        frequency: ringModFrequency,
        waveform: ringModWaveform,
        mix: ringModMix,
        depth: ringModDepth
      };
      
      const outputBuffer = await processRingModulatorRegion(
        audioBuffer,
        startSample,
        endSample,
        parameters
      );
      
      // Convert to blob and update
      const wav = await audioBufferToWav(outputBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      // Update audio and history
      addToEditHistory(url, 'Apply Ring Modulator', {
        effect: 'ringmod',
        parameters,
        region: { start: cutRegion.start, end: cutRegion.end }
      });
      
      // Load new audio
      await wavesurfer.load(url);
      
      // Clear region
      cutRegion.remove();
      
    } catch (error) {
      console.error('Error applying ring modulation:', error);
      alert('Error applying ring modulation. Please try again.');
    }
  }, [audioURL, addToEditHistory, wavesurferRef, ringModFrequency, ringModWaveform, ringModMix, ringModDepth, cutRegion]);
  
  const waveformTypes = [
    { key: 'sine', name: 'Sine' },
    { key: 'triangle', name: 'Triangle' },
    { key: 'square', name: 'Square' },
    { key: 'sawtooth', name: 'Sawtooth' }
  ];
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        {/* Waveform selector */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Waveform</Form.Label>
          <Dropdown
            onSelect={(eventKey) => setRingModWaveform(eventKey)}
            size="sm"
          >
            <Dropdown.Toggle
              variant="secondary"
              size="sm"
              className="w-100"
            >
              {waveformTypes.find(t => t.key === ringModWaveform)?.name || 'Sine'}
            </Dropdown.Toggle>
            <Dropdown.Menu className="bg-daw-toolbars">
              {waveformTypes.map(type => (
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
            value={ringModFrequency}
            onChange={setRingModFrequency}
            min={1}
            max={5000}
            step={1}
            label="Frequency"
            displayValue={ringModFrequency >= 1000 ? `${(ringModFrequency/1000).toFixed(1)}k` : `${ringModFrequency}Hz`}
            size={45}
            color="#e75b5c"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={ringModDepth}
            onChange={setRingModDepth}
            min={0}
            max={1}
            label="Depth"
            displayValue={`${(ringModDepth * 100).toFixed(0)}%`}
            size={45}
            color="#7bafd4"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={ringModMix}
            onChange={setRingModMix}
            min={0}
            max={1}
            label="Mix"
            displayValue={`${Math.round(ringModMix * 100)}%`}
            size={45}
            color="#92ce84"
          />
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyRingMod}
          >
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