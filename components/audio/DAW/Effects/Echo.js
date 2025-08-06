'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects 
} from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Process echo on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processEchoRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;
  
  // Calculate delay parameters
  const delaySamples = Math.floor((parameters.delay / 1000) * sampleRate);
  const feedback = parameters.feedback || 0.5;
  const inputGain = parameters.inputGain || 1;
  const outputGain = parameters.outputGain || 1;
  
  // Calculate total length with echo tail
  const maxEchoes = 20; // Limit echo repeats
  const totalLength = audioBuffer.length + (delaySamples * maxEchoes);
  
  // Create offline context for processing
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    totalLength,
    sampleRate
  );
  
  // Create nodes
  const source = offlineContext.createBufferSource();
  const inputGainNode = offlineContext.createGain();
  const delayNode = offlineContext.createDelay(Math.max(2, parameters.delay / 1000));
  const feedbackGainNode = offlineContext.createGain();
  const outputGainNode = offlineContext.createGain();
  
  // Set parameters
  inputGainNode.gain.value = inputGain;
  delayNode.delayTime.value = parameters.delay / 1000;
  feedbackGainNode.gain.value = feedback;
  outputGainNode.gain.value = outputGain;
  
  // Connect nodes
  source.connect(inputGainNode);
  inputGainNode.connect(delayNode);
  inputGainNode.connect(outputGainNode); // Dry signal
  
  // Feedback loop
  delayNode.connect(feedbackGainNode);
  feedbackGainNode.connect(delayNode);
  
  // Wet signal to output
  delayNode.connect(outputGainNode);
  outputGainNode.connect(offlineContext.destination);
  
  // Set source buffer and start
  source.buffer = audioBuffer;
  source.start(0);
  
  // Render
  const renderedBuffer = await offlineContext.startRendering();
  
  // Create output buffer with proper length
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
    
    // Apply echo only to the selected region
    for (let i = startSample; i < endSample; i++) {
      if (i < processedData.length) {
        outputData[i] = processedData[i];
      }
    }
  }
  
  return outputBuffer;
}

/**
 * Echo effect component
 * Implements a simple echo/delay effect with feedback
 */
export default function Echo({ width }) {
  const {
    audioRef,
    wavesurferRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const {
    inGain,
    setInGain,
    outGain,
    setOutGain,
    delay,
    setDelay,
    decay,
    setDecay,
    cutRegion
  } = useEffects();
  
  const audioContextRef = useRef(null);
  
  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);
  
  // Apply echo to selected region
  const applyEcho = useCallback(async () => {
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
        delay: delay,
        feedback: decay,
        inputGain: inGain,
        outputGain: outGain
      };
      
      const outputBuffer = await processEchoRegion(
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
      addToEditHistory(url, 'Apply Echo', {
        effect: 'echo',
        parameters,
        region: { start: cutRegion.start, end: cutRegion.end }
      });
      
      // Load new audio
      await wavesurfer.load(url);
      
      // Clear region
      cutRegion.remove();
      
    } catch (error) {
      console.error('Error applying echo:', error);
      alert('Error applying echo. Please try again.');
    }
  }, [audioURL, addToEditHistory, wavesurferRef, inGain, outGain, delay, decay, cutRegion]);
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={inGain}
            onChange={setInGain}
            min={0}
            max={1}
            label="Input Gain"
            displayValue={inGain.toFixed(2)}
            size={45}
            color="#92ce84"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={outGain}
            onChange={setOutGain}
            min={0}
            max={1}
            label="Output Gain"
            displayValue={outGain.toFixed(2)}
            size={45}
            color="#92ce84"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={delay}
            onChange={setDelay}
            min={0.1}
            max={2000}
            step={1}
            label="Delay Time"
            displayValue={`${delay.toFixed(0)}ms`}
            size={45}
            color="#7bafd4"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={decay}
            onChange={setDecay}
            min={0.1}
            max={1}
            label="Feedback"
            displayValue={`${Math.round(decay * 100)}%`}
            size={45}
            color="#cbb677"
          />
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyEcho}
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