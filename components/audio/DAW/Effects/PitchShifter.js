'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button, Dropdown, Form } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects 
} from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Pitch Shifter effect component using granular synthesis
 */
export default function PitchShifter({ width }) {
  const {
    audioRef,
    wavesurferRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const {
    pitchShiftSemitones,
    setPitchShiftSemitones,
    pitchShiftCents,
    setPitchShiftCents,
    pitchShiftMix,
    setPitchShiftMix,
    pitchShiftQuality,
    setPitchShiftQuality,
    cutRegion
  } = useEffects();
  
  const audioContextRef = useRef(null);
  
  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);
  
  // Calculate pitch shift ratio
  const getPitchRatio = () => {
    const totalCents = (pitchShiftSemitones * 100) + pitchShiftCents;
    return Math.pow(2, totalCents / 1200);
  };
  
  // Granular pitch shifting algorithm
  const applyGranularPitchShift = (inputData, sampleRate, pitchRatio, quality) => {
    // Grain size based on quality
    const grainSizes = {
      low: 2048,
      medium: 4096,
      high: 8192
    };
    const grainSize = grainSizes[quality] || 4096;
    const overlap = 0.5; // 50% overlap
    
    // Calculate output length
    const outputLength = Math.floor(inputData.length);
    const outputData = new Float32Array(outputLength);
    
    // Window function for smooth grain transitions
    const window = new Float32Array(grainSize);
    for (let i = 0; i < grainSize; i++) {
      window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (grainSize - 1));
    }
    
    // Process grains
    let inputPos = 0;
    let outputPos = 0;
    const hopSize = Math.floor(grainSize * (1 - overlap));
    
    while (outputPos < outputLength - grainSize) {
      // Calculate input position with pitch shift
      const actualInputPos = Math.floor(inputPos);
      
      if (actualInputPos + grainSize >= inputData.length) {
        break;
      }
      
      // Copy and window the grain
      for (let i = 0; i < grainSize; i++) {
        const inputIndex = actualInputPos + i;
        if (inputIndex < inputData.length && outputPos + i < outputLength) {
          outputData[outputPos + i] += inputData[inputIndex] * window[i];
        }
      }
      
      // Advance positions
      outputPos += hopSize;
      inputPos += hopSize * pitchRatio;
    }
    
    // Normalize to prevent clipping
    let maxVal = 0;
    for (let i = 0; i < outputLength; i++) {
      maxVal = Math.max(maxVal, Math.abs(outputData[i]));
    }
    if (maxVal > 1) {
      for (let i = 0; i < outputLength; i++) {
        outputData[i] /= maxVal;
      }
    }
    
    return outputData;
  };
  
  // Apply pitch shift to selected region
  const applyPitchShift = useCallback(async () => {
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
      
      // Get pitch ratio
      const pitchRatio = getPitchRatio();
      
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
        
        // Apply pitch shift
        const shiftedData = applyGranularPitchShift(
          regionData,
          sampleRate,
          pitchRatio,
          pitchShiftQuality
        );
        
        // Mix dry and wet signals
        for (let i = 0; i < regionLength && i < shiftedData.length; i++) {
          const drySignal = inputData[startSample + i];
          const wetSignal = shiftedData[i];
          outputData[startSample + i] = drySignal * (1 - pitchShiftMix) + wetSignal * pitchShiftMix;
        }
      }
      
      // Convert to blob and update
      const wav = await audioBufferToWav(outputBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      // Update audio and history
      addToEditHistory(url, 'Apply Pitch Shift', {
        effect: 'pitchshift',
        parameters: {
          semitones: pitchShiftSemitones,
          cents: pitchShiftCents,
          mix: pitchShiftMix,
          quality: pitchShiftQuality
        },
        region: { start: cutRegion.start, end: cutRegion.end }
      });
      
      // Load new audio
      await wavesurfer.load(url);
      
      // Clear region
      cutRegion.remove();
      
    } catch (error) {
      console.error('Error applying pitch shift:', error);
      alert('Error applying pitch shift. Please try again.');
    }
  }, [audioURL, addToEditHistory, wavesurferRef, pitchShiftSemitones, pitchShiftCents, pitchShiftMix, pitchShiftQuality, cutRegion]);
  
  const qualityOptions = [
    { key: 'low', name: 'Low (Fast)' },
    { key: 'medium', name: 'Medium' },
    { key: 'high', name: 'High (Slow)' }
  ];
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        {/* Quality selector */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Quality</Form.Label>
          <Dropdown
            onSelect={(eventKey) => setPitchShiftQuality(eventKey)}
            size="sm"
          >
            <Dropdown.Toggle
              variant="secondary"
              size="sm"
              className="w-100"
            >
              {qualityOptions.find(q => q.key === pitchShiftQuality)?.name || 'Medium'}
            </Dropdown.Toggle>
            <Dropdown.Menu className="bg-daw-toolbars">
              {qualityOptions.map(option => (
                <Dropdown.Item
                  key={option.key}
                  eventKey={option.key}
                  className="text-white"
                >
                  {option.name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </Col>
        
        {/* Knobs */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={pitchShiftSemitones}
            onChange={setPitchShiftSemitones}
            min={-24}
            max={24}
            step={1}
            label="Semitones"
            displayValue={`${pitchShiftSemitones > 0 ? '+' : ''}${pitchShiftSemitones}`}
            size={45}
            color="#e75b5c"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={pitchShiftCents}
            onChange={setPitchShiftCents}
            min={-100}
            max={100}
            step={1}
            label="Fine Tune"
            displayValue={`${pitchShiftCents > 0 ? '+' : ''}${pitchShiftCents}¢`}
            size={45}
            color="#7bafd4"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={pitchShiftMix}
            onChange={setPitchShiftMix}
            min={0}
            max={1}
            label="Mix"
            displayValue={`${Math.round(pitchShiftMix * 100)}%`}
            size={45}
            color="#92ce84"
          />
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyPitchShift}
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