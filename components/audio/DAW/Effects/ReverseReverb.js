'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Button, Dropdown, Form } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects 
} from '../../../../contexts/DAWProvider';
import { ReverbProcessor } from '../../../../lib/ReverbProcessor';
import { getPresetNames, impulseResponsePresets } from '../../../../lib/impulseResponses';
import Knob from '../../../Knob';

/**
 * Process reverse reverb on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processReverseReverbRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;
  
  // Create reverb processor
  const reverbProcessor = new ReverbProcessor(audioContext);
  
  // Apply reverb parameters
  reverbProcessor.loadPreset(parameters.preset || 'mediumHall');
  reverbProcessor.setWetDryMix(parameters.wetMix || 0.7);
  reverbProcessor.setPreDelay(parameters.predelay || 0);
  
  // Extract region
  const regionBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    regionLength,
    sampleRate
  );
  
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const regionData = regionBuffer.getChannelData(channel);
    
    for (let i = 0; i < regionLength; i++) {
      regionData[i] = inputData[startSample + i];
    }
  }
  
  // Process region with reverb
  const reverbResult = await reverbProcessor.processRegion(
    regionBuffer,
    0,
    regionLength
  );
  
  // Reverse the reverb tail
  const reversedBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    reverbResult.buffer.length,
    sampleRate
  );
  
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const reverbData = reverbResult.buffer.getChannelData(channel);
    const reversedData = reversedBuffer.getChannelData(channel);
    
    // Reverse the audio
    for (let i = 0; i < reverbData.length; i++) {
      reversedData[i] = reverbData[reverbData.length - 1 - i];
    }
  }
  
  // Calculate buildup samples
  const buildupSamples = Math.floor((parameters.buildupTime || 0.5) * sampleRate);
  const fadeSamples = Math.floor((parameters.fadeTime || 0.1) * sampleRate);
  
  // Create output buffer with pre-verb
  const outputLength = audioBuffer.length + buildupSamples;
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    outputLength,
    sampleRate
  );
  
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);
    const reversedData = reversedBuffer.getChannelData(channel);
    
    // Copy audio before region
    for (let i = 0; i < startSample; i++) {
      outputData[i] = inputData[i];
    }
    
    // Add reversed reverb buildup before the region
    const preverbStart = Math.max(0, startSample - buildupSamples);
    const preverbLength = Math.min(buildupSamples, reversedData.length);
    
    for (let i = 0; i < preverbLength; i++) {
      const outputIdx = preverbStart + i;
      const reversedIdx = reversedData.length - preverbLength + i;
      
      if (outputIdx >= 0 && outputIdx < outputData.length && reversedIdx >= 0) {
        // Apply fade-in envelope
        const fadeIn = i / fadeSamples;
        const envelope = Math.min(1, fadeIn);
        
        // Mix with existing audio
        outputData[outputIdx] = outputData[outputIdx] * (1 - parameters.wetMix) + 
                               reversedData[reversedIdx] * parameters.wetMix * envelope;
      }
    }
    
    // Copy the original region (shifted by buildup time)
    for (let i = 0; i < regionLength; i++) {
      const outputIdx = startSample + buildupSamples + i;
      if (outputIdx < outputData.length) {
        outputData[outputIdx] = inputData[startSample + i];
      }
    }
    
    // Copy audio after region (shifted)
    for (let i = endSample; i < inputData.length; i++) {
      const outputIdx = i + buildupSamples;
      if (outputIdx < outputData.length) {
        outputData[outputIdx] = inputData[i];
      }
    }
  }
  
  return outputBuffer;
}

/**
 * Reverse Reverb (Pre-verb) effect
 * Creates the supernatural effect of reverb that comes before the sound
 */
export default function ReverseReverb({ width }) {
  const {
    audioRef,
    wavesurferRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const {
    cutRegion
  } = useEffects();
  
  const audioContextRef = useRef(null);
  const reverbProcessorRef = useRef(null);
  
  // Parameters
  const [preset, setPreset] = useState('mediumHall');
  const [wetMix, setWetMix] = useState(0.7);
  const [fadeTime, setFadeTime] = useState(0.1);
  const [predelay, setPredelay] = useState(0);
  const [buildupTime, setBuildupTime] = useState(0.5);
  
  // Initialize audio context and reverb processor
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (!reverbProcessorRef.current) {
      reverbProcessorRef.current = new ReverbProcessor(audioContextRef.current);
    }
  }, []);
  
  // Update reverb parameters
  useEffect(() => {
    if (reverbProcessorRef.current) {
      reverbProcessorRef.current.loadPreset(preset);
      reverbProcessorRef.current.setWetDryMix(wetMix);
      reverbProcessorRef.current.setPreDelay(predelay);
    }
  }, [preset, wetMix, predelay]);
  
  // Apply reverse reverb
  const applyReverseReverb = useCallback(async () => {
    if (!cutRegion || !wavesurferRef.current || !reverbProcessorRef.current) {
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
      
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(cutRegion.start * sampleRate);
      const endSample = Math.floor(cutRegion.end * sampleRate);
      
      // Use the exported processing function
      const parameters = {
        preset,
        wetMix,
        fadeTime,
        predelay,
        buildupTime
      };
      
      const outputBuffer = await processReverseReverbRegion(
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
      addToEditHistory(url, 'Apply Reverse Reverb', {
        effect: 'reverseReverb',
        parameters,
        region: { start: cutRegion.start, end: cutRegion.end }
      });
      
      // Load new audio
      await wavesurfer.load(url);
      
      // Clear region
      cutRegion.remove();
      
    } catch (error) {
      console.error('Error applying reverse reverb:', error);
      alert('Error applying reverse reverb. Please try again.');
    }
  }, [audioURL, addToEditHistory, wavesurferRef, preset, wetMix, fadeTime, predelay, buildupTime, cutRegion]);
  
  const presetNames = getPresetNames();
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        {/* Preset selector */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Reverb Type</Form.Label>
          <Dropdown
            onSelect={(eventKey) => setPreset(eventKey)}
            size="sm"
          >
            <Dropdown.Toggle
              variant="secondary"
              size="sm"
              className="w-100"
            >
              {impulseResponsePresets[preset]?.name || 'Select Preset'}
            </Dropdown.Toggle>
            <Dropdown.Menu className="bg-daw-toolbars" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {presetNames.map(key => (
                <Dropdown.Item
                  key={key}
                  eventKey={key}
                  className="text-white"
                >
                  {impulseResponsePresets[key].name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </Col>
        
        {/* Knobs */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={buildupTime}
            onChange={setBuildupTime}
            min={0.1}
            max={2}
            step={0.05}
            label="Buildup"
            displayValue={`${(buildupTime * 1000).toFixed(0)}ms`}
            size={45}
            color="#e75b5c"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={wetMix}
            onChange={setWetMix}
            min={0}
            max={1}
            label="Mix"
            displayValue={`${Math.round(wetMix * 100)}%`}
            size={45}
            color="#92ce84"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={fadeTime}
            onChange={setFadeTime}
            min={0.01}
            max={0.5}
            step={0.01}
            label="Fade In"
            displayValue={`${(fadeTime * 1000).toFixed(0)}ms`}
            size={45}
            color="#7bafd4"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={predelay}
            onChange={setPredelay}
            min={0}
            max={100}
            step={1}
            label="Pre-Delay"
            displayValue={`${predelay}ms`}
            size={45}
            color="#cbb677"
          />
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyReverseReverb}
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