'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Button, Form } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects 
} from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Process stereo widener on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processStereoWidenerRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;
  
  // Check if audio is stereo
  if (audioBuffer.numberOfChannels < 2) {
    throw new Error('Stereo widener requires stereo audio');
  }
  
  // Haas delay in samples
  const delaySamples = Math.floor((parameters.delay / 1000) * sampleRate);
  
  // Create output buffer
  const outputBuffer = audioContext.createBuffer(
    2, // Ensure stereo
    audioBuffer.length,
    sampleRate
  );
  
  // Get channel data
  const leftIn = audioBuffer.getChannelData(0);
  const rightIn = audioBuffer.getChannelData(1);
  const leftOut = outputBuffer.getChannelData(0);
  const rightOut = outputBuffer.getChannelData(1);
  
  // Copy original audio
  leftOut.set(leftIn);
  rightOut.set(rightIn);
  
  // Process region with M/S (Mid/Side) technique
  for (let i = 0; i < regionLength; i++) {
    const sampleIndex = startSample + i;
    
    if (sampleIndex < audioBuffer.length) {
      // Convert L/R to M/S
      const mid = (leftIn[sampleIndex] + rightIn[sampleIndex]) * 0.5;
      const side = (leftIn[sampleIndex] - rightIn[sampleIndex]) * 0.5;
      
      // Apply width adjustment to side signal
      const wideSide = side * (parameters.width || 1.5);
      
      // Convert back to L/R
      let newLeft = mid + wideSide;
      let newRight = mid - wideSide;
      
      // Apply Haas effect (slight delay to one channel)
      if (i + delaySamples < regionLength) {
        const delayedIndex = sampleIndex + delaySamples;
        if (delayedIndex < audioBuffer.length) {
          // Add delayed signal to create width
          newRight = newRight * 0.8 + leftIn[delayedIndex] * 0.2;
        }
      }
      
      // Bass mono retention (keep low frequencies centered)
      if (parameters.bassRetain) {
        // Simple low-pass filter coefficient
        const cutoff = (parameters.bassFreq || 200) / sampleRate;
        const rc = 1.0 / (cutoff * 2 * Math.PI);
        const dt = 1.0 / sampleRate;
        const alpha = dt / (rc + dt);
        
        // Extract bass content (very simple filter)
        const bassContent = mid * alpha;
        const bassRatio = 0.8; // How much bass to keep mono
        
        newLeft = newLeft * (1 - bassRatio) + bassContent * bassRatio;
        newRight = newRight * (1 - bassRatio) + bassContent * bassRatio;
      }
      
      // Normalize to prevent clipping
      const maxValue = Math.max(Math.abs(newLeft), Math.abs(newRight));
      if (maxValue > 1) {
        newLeft /= maxValue;
        newRight /= maxValue;
      }
      
      leftOut[sampleIndex] = newLeft;
      rightOut[sampleIndex] = newRight;
    }
  }
  
  return outputBuffer;
}

/**
 * Stereo Widener effect component using Haas effect and M/S processing
 */
export default function StereoWidener({ width }) {
  const {
    audioRef,
    wavesurferRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const {
    stereoWidenerWidth,
    setStereoWidenerWidth,
    stereoWidenerDelay,
    setStereoWidenerDelay,
    stereoWidenerBassRetain,
    setStereoWidenerBassRetain,
    stereoWidenerBassFreq,
    setStereoWidenerBassFreq,
    cutRegion
  } = useEffects();
  
  const audioContextRef = useRef(null);
  
  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);
  
  // Apply stereo widening to selected region
  const applyStereoWidener = useCallback(async () => {
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
      
      // Check if audio is stereo
      if (audioBuffer.numberOfChannels < 2) {
        alert('Stereo widener requires stereo audio. Please convert to stereo first.');
        return;
      }
      
      // Calculate sample positions
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(cutRegion.start * sampleRate);
      const endSample = Math.floor(cutRegion.end * sampleRate);
      
      // Use the exported processing function
      const parameters = {
        width: stereoWidenerWidth,
        delay: stereoWidenerDelay,
        bassRetain: stereoWidenerBassRetain,
        bassFreq: stereoWidenerBassFreq
      };
      
      const outputBuffer = await processStereoWidenerRegion(
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
      addToEditHistory(url, 'Apply Stereo Widener', {
        effect: 'stereowidener',
        parameters,
        region: { start: cutRegion.start, end: cutRegion.end }
      });
      
      // Load new audio
      await wavesurfer.load(url);
      
      // Clear region
      cutRegion.remove();
      
    } catch (error) {
      console.error('Error applying stereo widener:', error);
      alert('Error applying stereo widener. Please try again.');
    }
  }, [audioURL, addToEditHistory, wavesurferRef, stereoWidenerWidth, stereoWidenerDelay, stereoWidenerBassRetain, stereoWidenerBassFreq, cutRegion]);
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        {/* Bass Mono toggle */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Bass Mono</Form.Label>
          <Form.Check
            type="switch"
            id="bassmono-switch"
            label={stereoWidenerBassRetain ? "On" : "Off"}
            checked={stereoWidenerBassRetain}
            onChange={(e) => setStereoWidenerBassRetain(e.target.checked)}
            className="text-white"
          />
        </Col>
        
        {/* Knobs */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={stereoWidenerWidth}
            onChange={setStereoWidenerWidth}
            min={0}
            max={2}
            label="Width"
            displayValue={`${Math.round(stereoWidenerWidth * 100)}%`}
            size={45}
            color="#e75b5c"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={stereoWidenerDelay}
            onChange={setStereoWidenerDelay}
            min={0}
            max={50}
            step={0.5}
            label="Haas Delay"
            displayValue={`${stereoWidenerDelay.toFixed(1)}ms`}
            size={45}
            color="#7bafd4"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={stereoWidenerBassFreq}
            onChange={setStereoWidenerBassFreq}
            min={50}
            max={500}
            step={10}
            label="Bass Freq"
            displayValue={`${stereoWidenerBassFreq}Hz`}
            size={45}
            color="#cbb677"
            disabled={!stereoWidenerBassRetain}
          />
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyStereoWidener}
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