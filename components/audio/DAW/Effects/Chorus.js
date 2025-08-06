'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects 
} from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Process chorus on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processChorusRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;
  
  // Create offline context for processing
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );
  
  // Create nodes
  const source = offlineContext.createBufferSource();
  const inputGainNode = offlineContext.createGain();
  const outputGainNode = offlineContext.createGain();
  const dryGain = offlineContext.createGain();
  const wetGain = offlineContext.createGain();
  
  // Create multiple delay lines for chorus
  const numVoices = 3; // Number of chorus voices
  const delays = [];
  const gains = [];
  const lfos = [];
  const lfoGains = [];
  
  for (let i = 0; i < numVoices; i++) {
    const delay = offlineContext.createDelay(0.1); // Max 100ms delay
    const gain = offlineContext.createGain();
    const lfo = offlineContext.createOscillator();
    const lfoGain = offlineContext.createGain();
    
    delays.push(delay);
    gains.push(gain);
    lfos.push(lfo);
    lfoGains.push(lfoGain);
  }
  
  // Set parameters
  inputGainNode.gain.value = parameters.inputGain || 1;
  outputGainNode.gain.value = parameters.outputGain || 1;
  dryGain.gain.value = 1 - (parameters.decay || 0.5); // Decay acts as mix
  wetGain.gain.value = parameters.decay || 0.5;
  
  // Configure each voice
  for (let i = 0; i < numVoices; i++) {
    // Base delay time with slight offset for each voice
    const baseDelay = (parameters.delay || 20) / 1000; // Convert ms to seconds
    delays[i].delayTime.value = baseDelay + (i * 0.002); // 2ms offset per voice
    
    // LFO configuration
    lfos[i].frequency.value = (parameters.speed || 0.5) + (i * 0.1); // Slight frequency offset
    lfoGains[i].gain.value = (parameters.depth || 0.002) * 0.5; // Depth in seconds
    
    // Voice gain
    gains[i].gain.value = 1 / numVoices; // Equal mix of all voices
  }
  
  // Connect nodes
  source.connect(inputGainNode);
  inputGainNode.connect(dryGain);
  dryGain.connect(outputGainNode);
  
  // Connect chorus voices
  for (let i = 0; i < numVoices; i++) {
    inputGainNode.connect(delays[i]);
    
    // LFO modulates delay time
    lfos[i].connect(lfoGains[i]);
    lfoGains[i].connect(delays[i].delayTime);
    
    delays[i].connect(gains[i]);
    gains[i].connect(wetGain);
    
    // Start LFO
    lfos[i].start(0);
  }
  
  wetGain.connect(outputGainNode);
  outputGainNode.connect(offlineContext.destination);
  
  // Set source buffer and start
  source.buffer = audioBuffer;
  source.start(0);
  
  // Render
  const renderedBuffer = await offlineContext.startRendering();
  
  // Create output buffer
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
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
 * Chorus effect component
 * Creates a thicker, richer sound by mixing multiple delayed copies
 */
export default function Chorus({ width }) {
  const {
    audioRef,
    wavesurferRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const {
    inGainChr,
    setInGainChr,
    outGainChr,
    setOutGainChr,
    delayChr,
    setDelayChr,
    decayChr,
    setDecayChr,
    speedChr,
    setSpeedChr,
    depthsChr,
    setDepthsChr,
    cutRegion
  } = useEffects();
  
  const audioContextRef = useRef(null);
  
  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);
  
  // Apply chorus to selected region
  const applyChorus = useCallback(async () => {
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
        inputGain: inGainChr,
        outputGain: outGainChr,
        delay: delayChr,
        decay: decayChr,
        speed: speedChr,
        depth: depthsChr
      };
      
      const outputBuffer = await processChorusRegion(
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
      addToEditHistory(url, 'Apply Chorus', {
        effect: 'chorus',
        parameters,
        region: { start: cutRegion.start, end: cutRegion.end }
      });
      
      // Load new audio
      await wavesurfer.load(url);
      
      // Clear region
      cutRegion.remove();
      
    } catch (error) {
      console.error('Error applying chorus:', error);
      alert('Error applying chorus. Please try again.');
    }
  }, [audioURL, addToEditHistory, wavesurferRef, inGainChr, outGainChr, delayChr, decayChr, speedChr, depthsChr, cutRegion]);
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={inGainChr}
            onChange={setInGainChr}
            min={0}
            max={1}
            label="Input"
            displayValue={inGainChr.toFixed(2)}
            size={45}
            color="#92ce84"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={outGainChr}
            onChange={setOutGainChr}
            min={0}
            max={1}
            label="Output"
            displayValue={outGainChr.toFixed(2)}
            size={45}
            color="#92ce84"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={delayChr}
            onChange={setDelayChr}
            min={0}
            max={70}
            step={0.1}
            label="Delay"
            displayValue={`${delayChr.toFixed(1)}ms`}
            size={45}
            color="#7bafd4"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={decayChr}
            onChange={setDecayChr}
            min={0.01}
            max={1}
            label="Mix"
            displayValue={decayChr.toFixed(2)}
            size={45}
            color="#cbb677"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={speedChr}
            onChange={setSpeedChr}
            min={0.1}
            max={10}
            step={0.1}
            label="Speed"
            displayValue={`${speedChr.toFixed(1)}Hz`}
            size={45}
            color="#e75b5c"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={depthsChr}
            onChange={setDepthsChr}
            min={0.01}
            max={4}
            label="Depth"
            displayValue={depthsChr.toFixed(2)}
            size={45}
            color="#e75b5c"
          />
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyChorus}
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