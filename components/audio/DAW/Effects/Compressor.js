'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects 
} from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Compressor effect component using Web Audio API DynamicsCompressorNode
 */
export default function Compressor({ width }) {
  const {
    audioRef,
    wavesurferRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const {
    compressorThreshold,
    setCompressorThreshold,
    compressorRatio,
    setCompressorRatio,
    compressorAttack,
    setCompressorAttack,
    compressorRelease,
    setCompressorRelease,
    compressorKnee,
    setCompressorKnee,
    compressorMakeup,
    setCompressorMakeup,
    cutRegion
  } = useEffects();
  
  const audioContextRef = useRef(null);
  
  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);
  
  // Apply compressor to selected region
  const applyCompressor = useCallback(async () => {
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
      
      // Create nodes
      const source = offlineContext.createBufferSource();
      const compressor = offlineContext.createDynamicsCompressor();
      const makeupGain = offlineContext.createGain();
      
      // Configure compressor
      compressor.threshold.value = compressorThreshold;
      compressor.ratio.value = compressorRatio;
      compressor.attack.value = compressorAttack;
      compressor.release.value = compressorRelease;
      compressor.knee.value = compressorKnee;
      
      // Apply makeup gain
      makeupGain.gain.value = Math.pow(10, compressorMakeup / 20); // Convert dB to linear
      
      // Connect nodes
      source.connect(compressor);
      compressor.connect(makeupGain);
      makeupGain.connect(offlineContext.destination);
      
      // Set source buffer and start
      source.buffer = audioBuffer;
      source.start(0);
      
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
      addToEditHistory(url, 'Apply Compressor', {
        effect: 'compressor',
        parameters: {
          threshold: compressorThreshold,
          ratio: compressorRatio,
          attack: compressorAttack,
          release: compressorRelease,
          knee: compressorKnee,
          makeup: compressorMakeup
        },
        region: { start: cutRegion.start, end: cutRegion.end }
      });
      
      // Load new audio
      await wavesurfer.load(url);
      
      // Clear region
      cutRegion.remove();
      
    } catch (error) {
      console.error('Error applying compressor:', error);
      alert('Error applying compressor. Please try again.');
    }
  }, [audioURL, addToEditHistory, wavesurferRef, compressorThreshold, compressorRatio, compressorAttack, compressorRelease, compressorKnee, compressorMakeup, cutRegion]);
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={compressorThreshold}
            onChange={setCompressorThreshold}
            min={-60}
            max={0}
            label="Threshold"
            displayValue={`${compressorThreshold.toFixed(0)}dB`}
            size={45}
            color="#e75b5c"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={compressorRatio}
            onChange={setCompressorRatio}
            min={1}
            max={20}
            step={0.1}
            label="Ratio"
            displayValue={`${compressorRatio.toFixed(1)}:1`}
            size={45}
            color="#7bafd4"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={compressorAttack}
            onChange={setCompressorAttack}
            min={0}
            max={1}
            step={0.001}
            label="Attack"
            displayValue={`${(compressorAttack * 1000).toFixed(0)}ms`}
            size={45}
            color="#92ce84"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={compressorRelease}
            onChange={setCompressorRelease}
            min={0}
            max={1}
            step={0.001}
            label="Release"
            displayValue={`${(compressorRelease * 1000).toFixed(0)}ms`}
            size={45}
            color="#92ce84"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={compressorKnee}
            onChange={setCompressorKnee}
            min={0}
            max={40}
            label="Knee"
            displayValue={`${compressorKnee.toFixed(0)}dB`}
            size={45}
            color="#cbb677"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={compressorMakeup}
            onChange={setCompressorMakeup}
            min={0}
            max={24}
            label="Makeup"
            displayValue={`${compressorMakeup.toFixed(0)}dB`}
            size={45}
            color="#92ceaa"
          />
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyCompressor}
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