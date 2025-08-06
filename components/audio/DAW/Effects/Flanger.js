'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects 
} from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Process flanger on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processFlangerRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;
  const regionDuration = (endSample - startSample) / sampleRate;
  
  // Create offline context for processing
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );
  
  // Create source
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  
  // Create delay node for flanging
  const delayNode = offlineContext.createDelay(0.02); // Max 20ms delay
  const feedbackGain = offlineContext.createGain();
  const wetGain = offlineContext.createGain();
  const dryGain = offlineContext.createGain();
  const outputGain = offlineContext.createGain();
  
  // Set static parameters
  feedbackGain.gain.value = parameters.feedback || 0.5;
  wetGain.gain.value = parameters.mix || 0.5;
  dryGain.gain.value = 1 - (parameters.mix || 0.5);
  
  // Create LFO for modulating delay time
  const lfo = offlineContext.createOscillator();
  const lfoGain = offlineContext.createGain();
  
  lfo.frequency.value = parameters.rate || 0.5;
  lfoGain.gain.value = parameters.depth || 0.002; // Depth in seconds
  
  // Connect LFO to delay time
  lfo.connect(lfoGain);
  lfoGain.connect(delayNode.delayTime);
  
  // Set base delay time
  delayNode.delayTime.value = parameters.delay || 0.005;
  
  // Connect audio path
  source.connect(dryGain);
  source.connect(delayNode);
  
  // Feedback loop
  delayNode.connect(feedbackGain);
  feedbackGain.connect(delayNode);
  
  // Mix wet and dry
  delayNode.connect(wetGain);
  dryGain.connect(outputGain);
  wetGain.connect(outputGain);
  
  outputGain.connect(offlineContext.destination);
  
  // Start source and LFO
  source.start(0);
  lfo.start(0);
  
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
      outputData[startSample + i] = processedData[startSample + i];
    }
  }
  
  return outputBuffer;
}

/**
 * Flanger effect component - similar to phaser but with shorter delay times
 */
export default function Flanger({ width }) {
  const {
    audioRef,
    wavesurferRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const {
    flangerRate,
    setFlangerRate,
    flangerDepth,
    setFlangerDepth,
    flangerFeedback,
    setFlangerFeedback,
    flangerDelay,
    setFlangerDelay,
    flangerMix,
    setFlangerMix,
    cutRegion
  } = useEffects();
  
  const audioContextRef = useRef(null);
  
  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);
  
  // Apply flanger to selected region
  const applyFlanger = useCallback(async () => {
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
        rate: flangerRate,
        depth: flangerDepth,
        feedback: flangerFeedback,
        delay: flangerDelay,
        mix: flangerMix
      };
      
      const outputBuffer = await processFlangerRegion(
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
      addToEditHistory(url, 'Apply Flanger', {
        effect: 'flanger',
        parameters,
        region: { start: cutRegion.start, end: cutRegion.end }
      });
      
      // Load new audio
      await wavesurfer.load(url);
      
      // Clear region
      cutRegion.remove();
      
    } catch (error) {
      console.error('Error applying flanger:', error);
      alert('Error applying flanger. Please try again.');
    }
  }, [audioURL, addToEditHistory, wavesurferRef, flangerRate, flangerDepth, flangerFeedback, flangerDelay, flangerMix, cutRegion]);
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={flangerRate}
            onChange={setFlangerRate}
            min={0.1}
            max={10}
            step={0.1}
            label="Rate"
            displayValue={`${flangerRate.toFixed(1)}Hz`}
            size={45}
            color="#e75b5c"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={flangerDepth * 1000}
            onChange={(v) => setFlangerDepth(v / 1000)}
            min={0.1}
            max={5}
            step={0.1}
            label="Depth"
            displayValue={`${(flangerDepth * 1000).toFixed(1)}ms`}
            size={45}
            color="#7bafd4"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={flangerFeedback}
            onChange={setFlangerFeedback}
            min={-0.95}
            max={0.95}
            label="Feedback"
            displayValue={`${Math.round(flangerFeedback * 100)}%`}
            size={45}
            color="#cbb677"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={flangerDelay * 1000}
            onChange={(v) => setFlangerDelay(v / 1000)}
            min={1}
            max={20}
            step={0.5}
            label="Delay"
            displayValue={`${(flangerDelay * 1000).toFixed(1)}ms`}
            size={45}
            color="#92ceaa"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={flangerMix}
            onChange={setFlangerMix}
            min={0}
            max={1}
            label="Mix"
            displayValue={`${Math.round(flangerMix * 100)}%`}
            size={45}
            color="#92ce84"
          />
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyFlanger}
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