'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button, Dropdown, Form } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects 
} from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Frequency Shifter effect - shifts all frequencies by a fixed amount
 * Unlike pitch shifting, this destroys harmonic relationships for wild effects
 */
export default function FrequencyShifter({ width }) {
  const {
    audioRef,
    wavesurferRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const {
    freqShiftAmount,
    setFreqShiftAmount,
    freqShiftMix,
    setFreqShiftMix,
    freqShiftFeedback,
    setFreqShiftFeedback,
    freqShiftDirection,
    setFreqShiftDirection,
    cutRegion
  } = useEffects();
  
  const audioContextRef = useRef(null);
  
  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);
  
  // Apply frequency shifting using Hilbert transform
  const applyFrequencyShift = useCallback(async () => {
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
        
        // Extract region for processing
        const regionData = new Float32Array(regionLength);
        for (let i = 0; i < regionLength; i++) {
          regionData[i] = inputData[startSample + i];
        }
        
        // Apply frequency shift using single sideband modulation
        // This is a simplified version - real frequency shifting uses Hilbert transform
        const shiftedData = new Float32Array(regionLength);
        const shiftFreq = freqShiftAmount;
        
        // Create oscillators for shifting
        const cosPhase = new Float32Array(regionLength);
        const sinPhase = new Float32Array(regionLength);
        
        for (let i = 0; i < regionLength; i++) {
          const t = i / sampleRate;
          cosPhase[i] = Math.cos(2 * Math.PI * shiftFreq * t);
          sinPhase[i] = Math.sin(2 * Math.PI * shiftFreq * t);
        }
        
        // Apply Hilbert transform approximation (90-degree phase shift)
        // This is simplified - a real implementation would use FFT
        const hilbert = new Float32Array(regionLength);
        for (let i = 0; i < regionLength; i++) {
          // Simple delay-based approximation
          const delay = Math.floor(sampleRate / (4 * Math.abs(shiftFreq)));
          const delayedIndex = i - delay;
          if (delayedIndex >= 0) {
            hilbert[i] = regionData[delayedIndex];
          }
        }
        
        // Single sideband modulation
        for (let i = 0; i < regionLength; i++) {
          if (freqShiftDirection === 'up' || freqShiftDirection === 'both') {
            // Upper sideband (shift up)
            shiftedData[i] = regionData[i] * cosPhase[i] - hilbert[i] * sinPhase[i];
          } else {
            // Lower sideband (shift down)
            shiftedData[i] = regionData[i] * cosPhase[i] + hilbert[i] * sinPhase[i];
          }
          
          if (freqShiftDirection === 'both') {
            // Mix both sidebands for ring mod-like effect
            const lower = regionData[i] * cosPhase[i] + hilbert[i] * sinPhase[i];
            shiftedData[i] = (shiftedData[i] + lower) * 0.5;
          }
        }
        
        // Apply feedback if requested
        if (freqShiftFeedback > 0) {
          const feedbackBuffer = new Float32Array(regionLength);
          const feedbackDelay = Math.floor(sampleRate * 0.1); // 100ms delay
          
          for (let i = 0; i < regionLength; i++) {
            feedbackBuffer[i] = shiftedData[i];
            
            if (i >= feedbackDelay) {
              feedbackBuffer[i] += feedbackBuffer[i - feedbackDelay] * freqShiftFeedback;
            }
          }
          
          for (let i = 0; i < regionLength; i++) {
            shiftedData[i] = feedbackBuffer[i];
          }
        }
        
        // Mix dry and wet signals
        for (let i = 0; i < regionLength; i++) {
          const drySignal = regionData[i];
          const wetSignal = shiftedData[i];
          outputData[startSample + i] = drySignal * (1 - freqShiftMix) + wetSignal * freqShiftMix;
        }
      }
      
      // Convert to blob and update
      const wav = await audioBufferToWav(outputBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      // Update audio and history
      addToEditHistory(url, 'Apply Frequency Shifter', {
        effect: 'frequencyshifter',
        parameters: {
          amount: freqShiftAmount,
          mix: freqShiftMix,
          feedback: freqShiftFeedback,
          direction: freqShiftDirection
        },
        region: { start: cutRegion.start, end: cutRegion.end }
      });
      
      // Load new audio
      await wavesurfer.load(url);
      
      // Clear region
      cutRegion.remove();
      
    } catch (error) {
      console.error('Error applying frequency shifter:', error);
      alert('Error applying frequency shifter. Please try again.');
    }
  }, [audioURL, addToEditHistory, wavesurferRef, freqShiftAmount, freqShiftMix, freqShiftFeedback, freqShiftDirection, cutRegion]);
  
  const directionOptions = [
    { key: 'up', name: 'Up' },
    { key: 'down', name: 'Down' },
    { key: 'both', name: 'Both' }
  ];
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        {/* Direction selector */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Direction</Form.Label>
          <Dropdown
            onSelect={(eventKey) => setFreqShiftDirection(eventKey)}
            size="sm"
          >
            <Dropdown.Toggle
              variant="secondary"
              size="sm"
              className="w-100"
            >
              {directionOptions.find(d => d.key === freqShiftDirection)?.name || 'Up'}
            </Dropdown.Toggle>
            <Dropdown.Menu className="bg-daw-toolbars">
              {directionOptions.map(dir => (
                <Dropdown.Item
                  key={dir.key}
                  eventKey={dir.key}
                  className="text-white"
                >
                  {dir.name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </Col>
        
        {/* Knobs */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={freqShiftAmount}
            onChange={setFreqShiftAmount}
            min={-500}
            max={500}
            step={1}
            label="Shift"
            displayValue={`${freqShiftAmount > 0 ? '+' : ''}${freqShiftAmount}Hz`}
            size={45}
            color="#e75b5c"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={freqShiftFeedback}
            onChange={setFreqShiftFeedback}
            min={0}
            max={0.9}
            label="Feedback"
            displayValue={`${Math.round(freqShiftFeedback * 100)}%`}
            size={45}
            color="#7bafd4"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={freqShiftMix}
            onChange={setFreqShiftMix}
            min={0}
            max={1}
            label="Mix"
            displayValue={`${Math.round(freqShiftMix * 100)}%`}
            size={45}
            color="#92ce84"
          />
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyFrequencyShift}
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