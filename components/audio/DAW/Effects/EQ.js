'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Container, Row, Col, Form, Button } from 'react-bootstrap';
import { useAudio, useEffects } from '../../../../contexts/DAWProvider';

/**
 * Process EQ on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processEQRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;
  
  // Default frequency bands if not provided
  const defaultBands = [
    { frequency: 100, gain: 0, type: 'peaking', q: 1 },
    { frequency: 250, gain: 0, type: 'peaking', q: 1 },
    { frequency: 500, gain: 0, type: 'peaking', q: 1 },
    { frequency: 1000, gain: 0, type: 'peaking', q: 1 },
    { frequency: 2000, gain: 0, type: 'peaking', q: 1 },
    { frequency: 4000, gain: 0, type: 'peaking', q: 1 },
    { frequency: 8000, gain: 0, type: 'peaking', q: 1 },
    { frequency: 16000, gain: 0, type: 'peaking', q: 1 }
  ];
  
  const bands = parameters.bands || defaultBands;
  
  // Create offline context
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );
  
  // Create source
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  
  // Create filter chain
  let currentNode = source;
  const filters = [];
  
  for (const band of bands) {
    const filter = offlineContext.createBiquadFilter();
    filter.type = band.type || 'peaking';
    filter.frequency.value = band.frequency;
    filter.gain.value = band.gain;
    filter.Q.value = band.q || 1;
    
    currentNode.connect(filter);
    currentNode = filter;
    filters.push(filter);
  }
  
  // Connect to destination
  currentNode.connect(offlineContext.destination);
  
  // Start and render
  source.start(0);
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
 * Equalizer component with frequency band controls
 * Note: This component is designed for real-time preview in single-track DAW
 * For multitrack, use the processEQRegion export function
 */
export default function EQ({ width }) {
  const {
    audioRef,
    wavesurferRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const { 
    filters,
    cutRegion 
  } = useEffects();
  
  const audioContextRef = useRef(null);
  const currentBandValues = useRef([]);
  
  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);
  
  // Track current band values
  useEffect(() => {
    if (filters.length > 0) {
      currentBandValues.current = filters.map(filter => ({
        frequency: filter.frequency.value,
        gain: filter.gain.value,
        type: filter.type,
        q: filter.Q.value
      }));
    }
  }, [filters]);
  
  // Apply EQ to selected region
  const applyEQ = useCallback(async () => {
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
      
      // Use the exported processing function with current filter values
      const parameters = {
        bands: currentBandValues.current
      };
      
      const outputBuffer = await processEQRegion(
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
      addToEditHistory(url, 'Apply EQ', {
        effect: 'eq',
        parameters,
        region: { start: cutRegion.start, end: cutRegion.end }
      });
      
      // Load new audio
      await wavesurfer.load(url);
      
      // Clear region
      cutRegion.remove();
      
      // Reset EQ sliders
      filters.forEach(filter => {
        filter.gain.value = 0;
      });
      
    } catch (error) {
      console.error('Error applying EQ:', error);
      alert('Error applying EQ. Please try again.');
    }
  }, [audioURL, addToEditHistory, wavesurferRef, filters, cutRegion]);
  
  return (
    <Container fluid className="p-2">
      <Row className="align-items-end">
        {filters.map((filter, i) => {
          const frqVal = filter.frequency.value;
          const freqLabel = frqVal >= 1000 ? `${(frqVal/1000).toFixed(1)}k` : frqVal;
          
          return (
            <Col key={`${frqVal} Hz`} xs={6} sm={4} md={3} lg={2} xl={1} className="mb-2 text-center">
              <div>
                <Form.Range
                  min={-26}
                  max={26}
                  step={0.1}
                  defaultValue={0}
                  className="eq-slider"
                  onInput={(e) => {
                    filter.gain.value = parseFloat(e.target.value);
                    // Update our reference to current values
                    if (currentBandValues.current[i]) {
                      currentBandValues.current[i].gain = parseFloat(e.target.value);
                    }
                  }}
                  style={{ width: '100%', writingMode: 'vertical-lr' }}
                />
                <small className="text-white d-block mt-1">{freqLabel}Hz</small>
              </div>
            </Col>
          );
        })}
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyEQ}
          >
            Apply EQ to Region
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