'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects 
} from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Phaser effect component using Web Audio API AllPassFilterNodes
 */
export default function Phaser({ width }) {
  const {
    audioRef,
    wavesurferRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const {
    phaserRate,
    setPhaserRate,
    phaserDepth,
    setPhaserDepth,
    phaserFeedback,
    setPhaserFeedback,
    phaserStages,
    setPhaserStages,
    phaserWetMix,
    setPhaserWetMix,
    cutRegion
  } = useEffects();
  
  const audioContextRef = useRef(null);
  
  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);
  
  // Apply phaser to selected region
  const applyPhaser = useCallback(async () => {
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
      
      // Create offline context for processing
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        sampleRate
      );
      
      // Create source
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Create dry/wet mix gains
      const dryGain = offlineContext.createGain();
      const wetGain = offlineContext.createGain();
      const outputGain = offlineContext.createGain();
      
      dryGain.gain.value = 1 - phaserWetMix;
      wetGain.gain.value = phaserWetMix;
      
      // Create allpass filters for phaser stages
      const allpassFilters = [];
      for (let i = 0; i < phaserStages; i++) {
        const filter = offlineContext.createBiquadFilter();
        filter.type = 'allpass';
        allpassFilters.push(filter);
      }
      
      // Create feedback gain
      const feedbackGain = offlineContext.createGain();
      feedbackGain.gain.value = phaserFeedback;
      
      // Connect dry path
      source.connect(dryGain);
      dryGain.connect(outputGain);
      
      // Connect wet path with allpass filters
      source.connect(allpassFilters[0]);
      
      // Chain allpass filters
      for (let i = 0; i < allpassFilters.length - 1; i++) {
        allpassFilters[i].connect(allpassFilters[i + 1]);
      }
      
      // Connect last filter to wet gain and feedback
      allpassFilters[allpassFilters.length - 1].connect(wetGain);
      allpassFilters[allpassFilters.length - 1].connect(feedbackGain);
      feedbackGain.connect(allpassFilters[0]);
      
      wetGain.connect(outputGain);
      outputGain.connect(offlineContext.destination);
      
      // Create LFO for modulating filter frequencies
      const lfo = offlineContext.createOscillator();
      const lfoGain = offlineContext.createGain();
      
      lfo.frequency.value = phaserRate;
      lfoGain.gain.value = phaserDepth * 1000; // Depth in Hz
      
      lfo.connect(lfoGain);
      
      // Connect LFO to all filter frequencies
      const baseFrequencies = [200, 400, 800, 1600, 3200, 6400];
      allpassFilters.forEach((filter, index) => {
        const baseFreq = baseFrequencies[index % baseFrequencies.length];
        filter.frequency.value = baseFreq;
        filter.Q.value = 0.5;
        lfoGain.connect(filter.frequency);
      });
      
      // Start source and LFO
      source.start(0);
      lfo.start(0);
      
      // Render
      const renderedBuffer = await offlineContext.startRendering();
      
      // Create output buffer with processed region
      const outputBuffer = context.createBuffer(
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
      
      // Convert to blob and update
      const wav = await audioBufferToWav(outputBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      // Update audio and history
      addToEditHistory(url, 'Apply Phaser', {
        effect: 'phaser',
        parameters: {
          rate: phaserRate,
          depth: phaserDepth,
          feedback: phaserFeedback,
          stages: phaserStages,
          wetMix: phaserWetMix
        },
        region: { start: cutRegion.start, end: cutRegion.end }
      });
      
      // Load new audio
      await wavesurfer.load(url);
      
      // Clear region
      cutRegion.remove();
      
    } catch (error) {
      console.error('Error applying phaser:', error);
      alert('Error applying phaser. Please try again.');
    }
  }, [audioURL, addToEditHistory, wavesurferRef, phaserRate, phaserDepth, phaserFeedback, phaserStages, phaserWetMix, cutRegion]);
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={phaserRate}
            onChange={setPhaserRate}
            min={0.1}
            max={10}
            step={0.1}
            label="Rate"
            displayValue={`${phaserRate.toFixed(1)}Hz`}
            size={45}
            color="#e75b5c"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={phaserDepth}
            onChange={setPhaserDepth}
            min={0}
            max={1}
            label="Depth"
            displayValue={`${Math.round(phaserDepth * 100)}%`}
            size={45}
            color="#7bafd4"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={phaserFeedback}
            onChange={setPhaserFeedback}
            min={0}
            max={0.95}
            label="Feedback"
            displayValue={`${Math.round(phaserFeedback * 100)}%`}
            size={45}
            color="#cbb677"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={phaserStages}
            onChange={setPhaserStages}
            min={2}
            max={8}
            step={1}
            label="Stages"
            displayValue={`${phaserStages}`}
            size={45}
            color="#92ceaa"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={phaserWetMix}
            onChange={setPhaserWetMix}
            min={0}
            max={1}
            label="Mix"
            displayValue={`${Math.round(phaserWetMix * 100)}%`}
            size={45}
            color="#92ce84"
          />
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyPhaser}
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