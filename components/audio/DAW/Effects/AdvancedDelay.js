'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button, Form } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects 
} from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Advanced Delay effect component with ping-pong and filtering
 */
export default function AdvancedDelay({ width }) {
  const {
    audioRef,
    wavesurferRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const {
    advDelayTime,
    setAdvDelayTime,
    advDelayFeedback,
    setAdvDelayFeedback,
    advDelayMix,
    setAdvDelayMix,
    advDelayPingPong,
    setAdvDelayPingPong,
    advDelayFilterFreq,
    setAdvDelayFilterFreq,
    advDelayFilterType,
    setAdvDelayFilterType,
    cutRegion
  } = useEffects();
  
  const audioContextRef = useRef(null);
  
  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);
  
  // Apply advanced delay to selected region
  const applyAdvancedDelay = useCallback(async () => {
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
      
      // Calculate delay parameters
      const delaySamples = Math.floor((advDelayTime / 1000) * sampleRate);
      const maxDelayTaps = 10; // Maximum number of delay repetitions
      
      // Calculate total output length (original + delay tails)
      const totalLength = audioBuffer.length + (delaySamples * maxDelayTaps);
      
      // Create offline context for processing
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        totalLength,
        sampleRate
      );
      
      // Create source buffer with extended length
      const extendedBuffer = offlineContext.createBuffer(
        audioBuffer.numberOfChannels,
        totalLength,
        sampleRate
      );
      
      // Copy original audio to extended buffer
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const inputData = audioBuffer.getChannelData(channel);
        const extendedData = extendedBuffer.getChannelData(channel);
        extendedData.set(inputData);
      }
      
      // Create nodes
      const source = offlineContext.createBufferSource();
      source.buffer = extendedBuffer;
      
      // Create delay nodes for stereo processing
      const delayL = offlineContext.createDelay(2);
      const delayR = offlineContext.createDelay(2);
      const feedbackGainL = offlineContext.createGain();
      const feedbackGainR = offlineContext.createGain();
      const filterL = offlineContext.createBiquadFilter();
      const filterR = offlineContext.createBiquadFilter();
      const wetGain = offlineContext.createGain();
      const dryGain = offlineContext.createGain();
      const merger = offlineContext.createChannelMerger(2);
      const splitter = offlineContext.createChannelSplitter(2);
      
      // Set parameters
      delayL.delayTime.value = advDelayTime / 1000;
      delayR.delayTime.value = advDelayTime / 1000;
      feedbackGainL.gain.value = advDelayFeedback;
      feedbackGainR.gain.value = advDelayFeedback;
      wetGain.gain.value = advDelayMix;
      dryGain.gain.value = 1 - advDelayMix;
      
      // Configure filters
      filterL.type = advDelayFilterType;
      filterR.type = advDelayFilterType;
      filterL.frequency.value = advDelayFilterFreq;
      filterR.frequency.value = advDelayFilterFreq;
      filterL.Q.value = 1;
      filterR.Q.value = 1;
      
      // Connect nodes
      source.connect(splitter);
      source.connect(dryGain);
      dryGain.connect(offlineContext.destination);
      
      if (advDelayPingPong) {
        // Ping-pong delay routing
        splitter.connect(delayL, 0);
        splitter.connect(delayR, 1);
        
        delayL.connect(filterL);
        delayR.connect(filterR);
        
        filterL.connect(feedbackGainL);
        filterR.connect(feedbackGainR);
        
        // Cross-feedback for ping-pong
        feedbackGainL.connect(delayR);
        feedbackGainR.connect(delayL);
        
        filterL.connect(merger, 0, 0);
        filterR.connect(merger, 0, 1);
      } else {
        // Standard stereo delay
        splitter.connect(delayL, 0);
        splitter.connect(delayR, 1);
        
        delayL.connect(filterL);
        delayR.connect(filterR);
        
        filterL.connect(feedbackGainL);
        filterR.connect(feedbackGainR);
        
        feedbackGainL.connect(delayL);
        feedbackGainR.connect(delayR);
        
        filterL.connect(merger, 0, 0);
        filterR.connect(merger, 0, 1);
      }
      
      merger.connect(wetGain);
      wetGain.connect(offlineContext.destination);
      
      // Start processing
      source.start(0);
      
      // Render
      const renderedBuffer = await offlineContext.startRendering();
      
      // Create output buffer (trim to original length for now)
      const outputBuffer = context.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        sampleRate
      );
      
      // Mix the processed audio
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const originalData = audioBuffer.getChannelData(channel);
        const processedData = renderedBuffer.getChannelData(channel);
        const outputData = outputBuffer.getChannelData(channel);
        
        // Copy all audio with processing applied to region
        for (let i = 0; i < audioBuffer.length; i++) {
          if (i >= startSample && i < endSample) {
            // In the selected region, use processed audio
            outputData[i] = processedData[i];
          } else {
            // Outside region, use original
            outputData[i] = originalData[i];
          }
        }
      }
      
      // Convert to blob and update
      const wav = await audioBufferToWav(outputBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      // Update audio and history
      addToEditHistory(url, 'Apply Advanced Delay', {
        effect: 'advanceddelay',
        parameters: {
          time: advDelayTime,
          feedback: advDelayFeedback,
          mix: advDelayMix,
          pingPong: advDelayPingPong,
          filterFreq: advDelayFilterFreq,
          filterType: advDelayFilterType
        },
        region: { start: cutRegion.start, end: cutRegion.end }
      });
      
      // Load new audio
      await wavesurfer.load(url);
      
      // Clear region
      cutRegion.remove();
      
    } catch (error) {
      console.error('Error applying advanced delay:', error);
      alert('Error applying advanced delay. Please try again.');
    }
  }, [audioURL, addToEditHistory, wavesurferRef, advDelayTime, advDelayFeedback, advDelayMix, advDelayPingPong, advDelayFilterFreq, advDelayFilterType, cutRegion]);
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        {/* Ping-Pong toggle */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Mode</Form.Label>
          <Form.Check
            type="switch"
            id="pingpong-switch"
            label={advDelayPingPong ? "Ping-Pong" : "Standard"}
            checked={advDelayPingPong}
            onChange={(e) => setAdvDelayPingPong(e.target.checked)}
            className="text-white"
          />
        </Col>
        
        {/* Filter Type */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Filter</Form.Label>
          <Form.Select
            size="sm"
            value={advDelayFilterType}
            onChange={(e) => setAdvDelayFilterType(e.target.value)}
          >
            <option value="lowpass">Low Pass</option>
            <option value="highpass">High Pass</option>
            <option value="bandpass">Band Pass</option>
            <option value="allpass">All Pass</option>
          </Form.Select>
        </Col>
        
        {/* Knobs */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={advDelayTime}
            onChange={setAdvDelayTime}
            min={1}
            max={2000}
            step={1}
            label="Time"
            displayValue={`${advDelayTime}ms`}
            size={45}
            color="#e75b5c"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={advDelayFeedback}
            onChange={setAdvDelayFeedback}
            min={0}
            max={0.95}
            label="Feedback"
            displayValue={`${Math.round(advDelayFeedback * 100)}%`}
            size={45}
            color="#7bafd4"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={advDelayFilterFreq}
            onChange={setAdvDelayFilterFreq}
            min={100}
            max={10000}
            step={10}
            label="Filter Freq"
            displayValue={advDelayFilterFreq >= 1000 ? `${(advDelayFilterFreq/1000).toFixed(1)}k` : `${advDelayFilterFreq}Hz`}
            size={45}
            color="#cbb677"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={advDelayMix}
            onChange={setAdvDelayMix}
            min={0}
            max={1}
            label="Mix"
            displayValue={`${Math.round(advDelayMix * 100)}%`}
            size={45}
            color="#92ce84"
          />
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyAdvancedDelay}
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