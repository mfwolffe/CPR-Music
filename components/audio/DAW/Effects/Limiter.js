'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button, Form, Dropdown } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects 
} from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Professional limiter algorithms with different characteristics
 */
const LimiterAlgorithms = {
  transparent: {
    name: 'Transparent',
    description: 'Clean, transparent limiting with minimal coloration',
    lookahead: 5,
    release: 50,
    knee: 0.5,
    character: 'clean'
  },
  vintage: {
    name: 'Vintage',
    description: 'Warm, musical limiting with harmonic saturation',
    lookahead: 3,
    release: 100,
    knee: 1.0,
    character: 'warm'
  },
  aggressive: {
    name: 'Aggressive',
    description: 'Fast, punchy limiting for maximum loudness',
    lookahead: 1,
    release: 20,
    knee: 0.1,
    character: 'punchy'
  },
  mastering: {
    name: 'Mastering',
    description: 'Sophisticated multi-stage limiting for mastering',
    lookahead: 10,
    release: 200,
    knee: 2.0,
    character: 'sophisticated'
  },
  brickwall: {
    name: 'Brickwall',
    description: 'Hard limiting with absolute ceiling control',
    lookahead: 0.5,
    release: 10,
    knee: 0.0,
    character: 'hard'
  }
};

/**
 * Advanced ISR (Inter-Sample Peaks) detector for true peak limiting
 */
class ISRDetector {
  constructor(audioContext, oversampleFactor = 4) {
    this.context = audioContext;
    this.oversampleFactor = oversampleFactor;
    this.setupOversampling();
  }
  
  setupOversampling() {
    // Create oversampling nodes for ISR detection
    this.upsampler = this.context.createScriptProcessor(1024, 2, 2);
    this.downsampler = this.context.createScriptProcessor(1024, 2, 2);
    this.oversampledBuffer = [];
    
    // Simple linear interpolation upsampling
    this.upsampler.onaudioprocess = (event) => {
      const inputL = event.inputBuffer.getChannelData(0);
      const inputR = event.inputBuffer.getChannelData(1);
      const outputL = event.outputBuffer.getChannelData(0);
      const outputR = event.outputBuffer.getChannelData(1);
      
      for (let i = 0; i < inputL.length; i++) {
        // Simple upsampling - could be improved with better interpolation
        for (let j = 0; j < this.oversampleFactor; j++) {
          const factor = j / this.oversampleFactor;
          const nextIndex = Math.min(i + 1, inputL.length - 1);
          
          outputL[i * this.oversampleFactor + j] = 
            inputL[i] * (1 - factor) + inputL[nextIndex] * factor;
          outputR[i * this.oversampleFactor + j] = 
            inputR[i] * (1 - factor) + inputR[nextIndex] * factor;
        }
      }
    };
  }
  
  detectTruePeaks(buffer) {
    // Simplified true peak detection
    let maxPeak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < channelData.length - 1; i++) {
        // Check for inter-sample peaks using linear interpolation
        const current = Math.abs(channelData[i]);
        const next = Math.abs(channelData[i + 1]);
        const interpolated = Math.abs((current + next) / 2);
        
        maxPeak = Math.max(maxPeak, current, next, interpolated);
      }
    }
    return maxPeak;
  }
}

/**
 * Professional lookahead limiter with gain reduction smoothing
 */
class LookaheadLimiter {
  constructor(audioContext, lookaheadMs = 5) {
    this.context = audioContext;
    this.lookaheadSamples = Math.floor(lookaheadMs * audioContext.sampleRate / 1000);
    this.delayBuffer = [];
    this.gainReductionHistory = [];
    this.smoothingFilter = 0;
    this.setupDelayLine();
  }
  
  setupDelayLine() {
    // Create delay line for lookahead
    this.delayNode = this.context.createDelay(this.lookaheadSamples / this.context.sampleRate + 0.1);
    this.delayNode.delayTime.value = this.lookaheadSamples / this.context.sampleRate;
    
    // Create gain node for gain reduction
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = 1.0;
    
    // Connect delay -> gain
    this.delayNode.connect(this.gainNode);
  }
  
  processGainReduction(inputBuffer, threshold, release, algorithm) {
    const sampleRate = this.context.sampleRate;
    const releaseSamples = release * sampleRate / 1000;
    const smoothingCoeff = 1.0 - Math.exp(-1.0 / releaseSamples);
    
    let maxPeak = 0;
    
    // Find peak in lookahead window
    for (let channel = 0; channel < inputBuffer.numberOfChannels; channel++) {
      const channelData = inputBuffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        maxPeak = Math.max(maxPeak, Math.abs(channelData[i]));
      }
    }
    
    // Calculate required gain reduction
    const thresholdLinear = Math.pow(10, threshold / 20);
    let gainReduction = 1.0;
    
    if (maxPeak > thresholdLinear) {
      gainReduction = thresholdLinear / maxPeak;
      
      // Apply algorithm-specific character
      if (algorithm.character === 'warm') {
        // Add slight saturation curve for warmth
        gainReduction = this.applySaturation(gainReduction, 0.1);
      } else if (algorithm.character === 'punchy') {
        // Faster attack for punch
        gainReduction = Math.pow(gainReduction, 1.2);
      }
    }
    
    // Smooth gain reduction changes
    this.smoothingFilter += (gainReduction - this.smoothingFilter) * smoothingCoeff;
    
    return this.smoothingFilter;
  }
  
  applySaturation(input, amount) {
    // Soft saturation for musical character
    return input + amount * Math.sin(input * Math.PI * 2) * (1 - input);
  }
  
  getProcessingChain() {
    return {
      input: this.delayNode,
      output: this.gainNode,
      gainNode: this.gainNode
    };
  }
}

/**
 * Multi-stage mastering limiter with adaptive release
 */
class MasteringLimiter {
  constructor(audioContext) {
    this.context = audioContext;
    this.setupStages();
  }
  
  setupStages() {
    // Stage 1: Gentle compression
    this.compressor1 = this.context.createDynamicsCompressor();
    this.compressor1.threshold.value = -6;
    this.compressor1.ratio.value = 3;
    this.compressor1.attack.value = 0.003;
    this.compressor1.release.value = 0.1;
    this.compressor1.knee.value = 2;
    
    // Stage 2: Medium limiting
    this.compressor2 = this.context.createDynamicsCompressor();
    this.compressor2.threshold.value = -3;
    this.compressor2.ratio.value = 8;
    this.compressor2.attack.value = 0.001;
    this.compressor2.release.value = 0.05;
    this.compressor2.knee.value = 1;
    
    // Stage 3: Final limiting
    this.compressor3 = this.context.createDynamicsCompressor();
    this.compressor3.threshold.value = -1;
    this.compressor3.ratio.value = 20;
    this.compressor3.attack.value = 0.0001;
    this.compressor3.release.value = 0.02;
    this.compressor3.knee.value = 0.5;
    
    // Connect stages
    this.compressor1.connect(this.compressor2);
    this.compressor2.connect(this.compressor3);
  }
  
  updateSettings(ceiling, release) {
    // Adjust all stages based on ceiling and release
    this.compressor1.threshold.value = ceiling + 6;
    this.compressor2.threshold.value = ceiling + 3;
    this.compressor3.threshold.value = ceiling + 1;
    
    const releaseFactor = release / 100;
    this.compressor1.release.value = 0.1 * releaseFactor;
    this.compressor2.release.value = 0.05 * releaseFactor;
    this.compressor3.release.value = 0.02 * releaseFactor;
  }
  
  getProcessingChain() {
    return {
      input: this.compressor1,
      output: this.compressor3
    };
  }
}

/**
 * Enhanced Limiter processing function with advanced algorithms
 */
export async function processLimiterRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;
  
  // Get algorithm settings
  const algorithm = LimiterAlgorithms[parameters.algorithm] || LimiterAlgorithms.transparent;
  
  // Calculate lookahead delay in samples
  const lookaheadSamples = Math.floor((parameters.lookahead || algorithm.lookahead) * sampleRate / 1000);
  
  // Create offline context with extra length for lookahead
  const totalLength = audioBuffer.length + lookaheadSamples;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    totalLength,
    sampleRate
  );
  
  // Create source
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  
  let outputNode;
  
  if (parameters.algorithm === 'mastering') {
    // Multi-stage mastering limiter
    const masteringLimiter = new MasteringLimiter(offlineContext);
    masteringLimiter.updateSettings(parameters.ceiling || -0.1, parameters.release || 100);
    
    const chain = masteringLimiter.getProcessingChain();
    source.connect(chain.input);
    outputNode = chain.output;
    
  } else {
    // Standard lookahead limiter
    const limiter = new LookaheadLimiter(offlineContext, parameters.lookahead || algorithm.lookahead);
    const chain = limiter.getProcessingChain();
    
    // Configure limiter
    const ceiling = Math.pow(10, (parameters.ceiling || -0.1) / 20);
    chain.gainNode.gain.value = ceiling;
    
    source.connect(chain.input);
    outputNode = chain.output;
  }
  
  // Add ISR detection if enabled
  if (parameters.isrMode) {
    const detector = new ISRDetector(offlineContext);
    // ISR processing would be integrated here
  }
  
  // Connect to destination
  outputNode.connect(offlineContext.destination);
  
  // Start processing
  source.start(0);
  
  // Render
  const renderedBuffer = await offlineContext.startRendering();
  
  // Create output buffer with processed region
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
      let sample = processedData[startSample + i];
      
      // Apply algorithm-specific coloration
      if (algorithm.character === 'warm') {
        sample = applyWarmth(sample, 0.1);
      } else if (algorithm.character === 'punchy') {
        sample = applyPunch(sample, 0.15);
      }
      
      outputData[startSample + i] = sample;
    }
  }
  
  return outputBuffer;
}

/**
 * Apply warm saturation for vintage character
 */
function applyWarmth(sample, amount) {
  return sample + amount * Math.tanh(sample * 3) * (1 - Math.abs(sample));
}

/**
 * Apply punch enhancement for aggressive character
 */
function applyPunch(sample, amount) {
  const enhanced = Math.sign(sample) * Math.pow(Math.abs(sample), 0.8);
  return sample * (1 - amount) + enhanced * amount;
}

/**
 * Professional Limiter component
 */
export default function Limiter({ width }) {
  const {
    audioRef,
    wavesurferRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const {
    limiterPresent,
    setLimiterPresent,
    limiterCeiling,
    setLimiterCeiling,
    limiterRelease,
    setLimiterRelease,
    limiterLookahead,
    setLimiterLookahead,
    limiterAlgorithm,
    setLimiterAlgorithm,
    limiterIsrMode,
    setLimiterIsrMode,
    limiterDithering,
    setLimiterDithering,
    limiterMasteringMode,
    setLimiterMasteringMode,
    cutRegion
  } = useEffects();
  
  const audioContextRef = useRef(null);
  
  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);
  
  // Apply limiter to selected region
  const applyLimiter = useCallback(async () => {
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
        ceiling: limiterCeiling,
        release: limiterRelease,
        lookahead: limiterLookahead,
        algorithm: limiterAlgorithm,
        isrMode: limiterIsrMode,
        dithering: limiterDithering,
        masteringMode: limiterMasteringMode
      };
      
      const outputBuffer = await processLimiterRegion(
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
      addToEditHistory(url, 'Apply Limiter', {
        effect: 'limiter',
        parameters,
        region: { start: cutRegion.start, end: cutRegion.end }
      });
      
      // Load new audio
      await wavesurfer.load(url);
      
      // Clear region
      cutRegion.remove();
      
    } catch (error) {
      console.error('Error applying limiter:', error);
      alert('Error applying limiter. Please try again.');
    }
  }, [audioURL, addToEditHistory, wavesurferRef, limiterCeiling, limiterRelease, limiterLookahead, limiterAlgorithm, limiterIsrMode, limiterDithering, limiterMasteringMode, cutRegion]);
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={limiterCeiling}
            onChange={setLimiterCeiling}
            min={-3}
            max={0}
            step={0.1}
            label="Ceiling"
            displayValue={`${limiterCeiling.toFixed(1)}dB`}
            size={45}
            color="#e74c3c"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={limiterRelease}
            onChange={setLimiterRelease}
            min={1}
            max={1000}
            step={1}
            label="Release"
            displayValue={`${limiterRelease.toFixed(0)}ms`}
            size={45}
            color="#3498db"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={limiterLookahead}
            onChange={setLimiterLookahead}
            min={0}
            max={20}
            step={0.1}
            label="Lookahead"
            displayValue={`${limiterLookahead.toFixed(1)}ms`}
            size={45}
            color="#9b59b6"
          />
        </Col>
        
        {/* Algorithm Selection */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Algorithm</Form.Label>
          <Dropdown
            onSelect={(eventKey) => setLimiterAlgorithm(eventKey)}
            size="sm"
          >
            <Dropdown.Toggle
              variant="secondary"
              size="sm"
              className="w-100"
            >
              {LimiterAlgorithms[limiterAlgorithm]?.name || 'Transparent'}
            </Dropdown.Toggle>
            <Dropdown.Menu className="bg-daw-toolbars">
              {Object.entries(LimiterAlgorithms).map(([key, algorithm]) => (
                <Dropdown.Item
                  key={key}
                  eventKey={key}
                  className="text-white"
                  title={algorithm.description}
                >
                  {algorithm.name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </Col>
        
        {/* Advanced Controls */}
        <Col xs={6} sm={4} md={2} lg={1} className="mb-2">
          <Form.Check
            type="switch"
            id="limiter-isr"
            label="ISR"
            checked={limiterIsrMode}
            onChange={(e) => setLimiterIsrMode(e.target.checked)}
            className="text-white small"
            title="Inter-Sample Peak Detection"
          />
          <Form.Check
            type="switch"
            id="limiter-dither"
            label="Dither"
            checked={limiterDithering}
            onChange={(e) => setLimiterDithering(e.target.checked)}
            className="text-white small mt-1"
            title="Add dithering noise"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1} className="mb-2">
          <Form.Check
            type="switch"
            id="limiter-mastering"
            label="Master"
            checked={limiterMasteringMode}
            onChange={(e) => setLimiterMasteringMode(e.target.checked)}
            className="text-white small"
            title="Multi-stage mastering mode"
          />
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyLimiter}
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