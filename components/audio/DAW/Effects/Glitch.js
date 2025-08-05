'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button, Dropdown, Form } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects 
} from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Glitch/Beat Repeat effect - rhythmic stutters and chaos
 */
export default function Glitch({ width }) {
  const {
    audioRef,
    wavesurferRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const {
    glitchDivision,
    setGlitchDivision,
    glitchProbability,
    setGlitchProbability,
    glitchRepeats,
    setGlitchRepeats,
    glitchReverse,
    setGlitchReverse,
    glitchPitch,
    setGlitchPitch,
    glitchCrush,
    setGlitchCrush,
    cutRegion
  } = useEffects();
  
  const audioContextRef = useRef(null);
  
  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);
  
  // Apply glitch effect to selected region
  const applyGlitch = useCallback(async () => {
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
      const regionLength = endSample - startSample;
      
      // Calculate beat division in samples (assuming 120 BPM for now)
      const bpm = 120;
      const beatLength = (60 / bpm) * sampleRate;
      const divisionLength = Math.floor(beatLength / glitchDivision);
      
      // Create output buffer
      const outputBuffer = context.createBuffer(
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
        
        // Process region with glitch
        let position = 0;
        while (position < regionLength) {
          const shouldGlitch = Math.random() < glitchProbability;
          
          if (shouldGlitch) {
            // Capture a slice
            const sliceLength = Math.min(divisionLength, regionLength - position);
            const slice = new Float32Array(sliceLength);
            
            for (let i = 0; i < sliceLength; i++) {
              slice[i] = inputData[startSample + position + i];
            }
            
            // Apply effects to slice
            let processedSlice = slice;
            
            // Reverse?
            if (Math.random() < glitchReverse) {
              processedSlice = new Float32Array(sliceLength);
              for (let i = 0; i < sliceLength; i++) {
                processedSlice[i] = slice[sliceLength - 1 - i];
              }
            }
            
            // Pitch shift?
            if (glitchPitch !== 0) {
              const pitchRatio = Math.pow(2, glitchPitch / 12);
              const pitchedLength = Math.floor(sliceLength / pitchRatio);
              const tempSlice = new Float32Array(sliceLength);
              
              for (let i = 0; i < sliceLength; i++) {
                const sourceIndex = Math.floor(i * pitchRatio);
                if (sourceIndex < sliceLength) {
                  tempSlice[i] = processedSlice[sourceIndex];
                }
              }
              processedSlice = tempSlice;
            }
            
            // Bit crush?
            if (glitchCrush) {
              const bits = 4; // Crush to 4-bit
              const levels = Math.pow(2, bits);
              for (let i = 0; i < sliceLength; i++) {
                processedSlice[i] = Math.round(processedSlice[i] * levels) / levels;
              }
            }
            
            // Repeat the slice
            for (let repeat = 0; repeat < glitchRepeats; repeat++) {
              for (let i = 0; i < sliceLength; i++) {
                const outputIndex = startSample + position + (repeat * sliceLength) + i;
                if (outputIndex < endSample) {
                  // Mix with some randomness
                  const mixAmount = 0.8 + Math.random() * 0.2;
                  outputData[outputIndex] = processedSlice[i] * mixAmount;
                }
              }
            }
            
            // Skip ahead
            position += sliceLength * glitchRepeats;
          } else {
            // No glitch, just move forward
            position += divisionLength;
          }
        }
      }
      
      // Convert to blob and update
      const wav = await audioBufferToWav(outputBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      // Update audio and history
      addToEditHistory(url, 'Apply Glitch', {
        effect: 'glitch',
        parameters: {
          division: glitchDivision,
          probability: glitchProbability,
          repeats: glitchRepeats,
          reverse: glitchReverse,
          pitch: glitchPitch,
          crush: glitchCrush
        },
        region: { start: cutRegion.start, end: cutRegion.end }
      });
      
      // Load new audio
      await wavesurfer.load(url);
      
      // Clear region
      cutRegion.remove();
      
    } catch (error) {
      console.error('Error applying glitch:', error);
      alert('Error applying glitch. Please try again.');
    }
  }, [audioURL, addToEditHistory, wavesurferRef, glitchDivision, glitchProbability, glitchRepeats, glitchReverse, glitchPitch, glitchCrush, cutRegion]);
  
  const divisionOptions = [
    { value: 4, label: '1/4' },
    { value: 8, label: '1/8' },
    { value: 16, label: '1/16' },
    { value: 32, label: '1/32' },
    { value: 64, label: '1/64' }
  ];
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        {/* Division selector */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Division</Form.Label>
          <Form.Select
            size="sm"
            value={glitchDivision}
            onChange={(e) => setGlitchDivision(Number(e.target.value))}
          >
            {divisionOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Form.Select>
        </Col>
        
        {/* Bit Crush toggle */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Bit Crush</Form.Label>
          <Form.Check
            type="switch"
            id="crush-switch"
            label={glitchCrush ? "On" : "Off"}
            checked={glitchCrush}
            onChange={(e) => setGlitchCrush(e.target.checked)}
            className="text-white"
          />
        </Col>
        
        {/* Knobs */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={glitchProbability}
            onChange={setGlitchProbability}
            min={0}
            max={1}
            label="Probability"
            displayValue={`${Math.round(glitchProbability * 100)}%`}
            size={45}
            color="#e75b5c"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={glitchRepeats}
            onChange={setGlitchRepeats}
            min={1}
            max={16}
            step={1}
            label="Repeats"
            displayValue={`${glitchRepeats}x`}
            size={45}
            color="#7bafd4"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={glitchReverse}
            onChange={setGlitchReverse}
            min={0}
            max={1}
            label="Reverse"
            displayValue={`${Math.round(glitchReverse * 100)}%`}
            size={45}
            color="#cbb677"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={glitchPitch}
            onChange={setGlitchPitch}
            min={-12}
            max={12}
            step={1}
            label="Pitch"
            displayValue={`${glitchPitch > 0 ? '+' : ''}${glitchPitch}`}
            size={45}
            color="#92ce84"
          />
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyGlitch}
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