'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Button, Dropdown, Form } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects 
} from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Spectral Filter effect - FFT-based frequency manipulation
 * Can create robotic voices, whisper effects, and frequency-based morphing
 */
export default function SpectralFilter({ width }) {
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
  const [filterType, setFilterType] = useState('robot');
  const [threshold, setThreshold] = useState(0.1);
  const [bands, setBands] = useState(16);
  const [spread, setSpread] = useState(1);
  const [shift, setShift] = useState(0);
  
  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);
  
  // Apply spectral filter
  const applySpectralFilter = useCallback(async () => {
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
      
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(cutRegion.start * sampleRate);
      const endSample = Math.floor(cutRegion.end * sampleRate);
      const regionLength = endSample - startSample;
      
      // FFT size (must be power of 2)
      const fftSize = 2048;
      const hopSize = fftSize / 4;
      
      // Create output buffer
      const outputBuffer = context.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        sampleRate
      );
      
      // Process each channel
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const inputData = audioBuffer.getChannelData(channel);
        const outputData = outputBuffer.getChannelData(channel);
        
        // Copy original audio
        outputData.set(inputData);
        
        // Process region with overlap-add
        const processedRegion = new Float32Array(regionLength);
        const window = createWindow(fftSize);
        
        for (let pos = 0; pos < regionLength - fftSize; pos += hopSize) {
          // Extract windowed frame
          const frame = new Float32Array(fftSize);
          for (let i = 0; i < fftSize; i++) {
            if (startSample + pos + i < endSample) {
              frame[i] = inputData[startSample + pos + i] * window[i];
            }
          }
          
          // FFT
          const spectrum = fft(frame);
          
          // Apply spectral filter based on type
          switch(filterType) {
            case 'robot':
              // Vocoder-like effect - quantize frequencies
              applyRobotFilter(spectrum, bands);
              break;
              
            case 'whisper':
              // Remove pitched content, keep noise
              applyWhisperFilter(spectrum, threshold);
              break;
              
            case 'harmonicBoost':
              // Enhance harmonics
              applyHarmonicBoost(spectrum, spread);
              break;
              
            case 'frequencyShift':
              // Shift all frequencies
              applyFrequencyShift(spectrum, shift, sampleRate);
              break;
              
            case 'spectralGate':
              // Gate based on magnitude
              applySpectralGate(spectrum, threshold);
              break;
              
            case 'oddHarmonics':
              // Keep only odd harmonics
              applyOddHarmonicsFilter(spectrum);
              break;
          }
          
          // IFFT
          const processed = ifft(spectrum);
          
          // Overlap-add
          for (let i = 0; i < fftSize; i++) {
            if (pos + i < regionLength) {
              processedRegion[pos + i] += processed[i] * window[i];
            }
          }
        }
        
        // Normalize
        let maxVal = 0;
        for (let i = 0; i < regionLength; i++) {
          maxVal = Math.max(maxVal, Math.abs(processedRegion[i]));
        }
        if (maxVal > 0) {
          for (let i = 0; i < regionLength; i++) {
            processedRegion[i] /= maxVal;
          }
        }
        
        // Copy processed region back
        for (let i = 0; i < regionLength; i++) {
          outputData[startSample + i] = processedRegion[i] * 0.8;
        }
      }
      
      // Convert to blob and update
      const wav = await audioBufferToWav(outputBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      // Update audio and history
      addToEditHistory(url, 'Apply Spectral Filter', {
        effect: 'spectralFilter',
        parameters: {
          type: filterType,
          threshold,
          bands,
          spread,
          shift
        },
        region: { start: cutRegion.start, end: cutRegion.end }
      });
      
      // Load new audio
      await wavesurfer.load(url);
      
      // Clear region
      cutRegion.remove();
      
    } catch (error) {
      console.error('Error applying spectral filter:', error);
      alert('Error applying spectral filter. Please try again.');
    }
  }, [audioURL, addToEditHistory, wavesurferRef, filterType, threshold, bands, spread, shift, cutRegion]);
  
  const filterTypes = [
    { key: 'robot', name: 'Robot Voice' },
    { key: 'whisper', name: 'Whisper' },
    { key: 'harmonicBoost', name: 'Harmonic Boost' },
    { key: 'frequencyShift', name: 'Frequency Shift' },
    { key: 'spectralGate', name: 'Spectral Gate' },
    { key: 'oddHarmonics', name: 'Odd Harmonics' }
  ];
  
  // Control visibility based on filter type
  const showThreshold = ['whisper', 'spectralGate'].includes(filterType);
  const showBands = filterType === 'robot';
  const showSpread = filterType === 'harmonicBoost';
  const showShift = filterType === 'frequencyShift';
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        {/* Type selector */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Filter Type</Form.Label>
          <Dropdown
            onSelect={(eventKey) => setFilterType(eventKey)}
            size="sm"
          >
            <Dropdown.Toggle
              variant="secondary"
              size="sm"
              className="w-100"
            >
              {filterTypes.find(t => t.key === filterType)?.name || 'Robot Voice'}
            </Dropdown.Toggle>
            <Dropdown.Menu className="bg-daw-toolbars">
              {filterTypes.map(type => (
                <Dropdown.Item
                  key={type.key}
                  eventKey={type.key}
                  className="text-white"
                >
                  {type.name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </Col>
        
        {/* Dynamic controls */}
        {showThreshold && (
          <Col xs={6} sm={4} md={2} lg={1}>
            <Knob
              value={threshold}
              onChange={setThreshold}
              min={0}
              max={1}
              label="Threshold"
              displayValue={`${Math.round(threshold * 100)}%`}
              size={45}
              color="#e75b5c"
            />
          </Col>
        )}
        
        {showBands && (
          <Col xs={6} sm={4} md={2} lg={1}>
            <Knob
              value={bands}
              onChange={setBands}
              min={4}
              max={64}
              step={1}
              label="Bands"
              displayValue={`${bands}`}
              size={45}
              color="#7bafd4"
            />
          </Col>
        )}
        
        {showSpread && (
          <Col xs={6} sm={4} md={2} lg={1}>
            <Knob
              value={spread}
              onChange={setSpread}
              min={0.5}
              max={3}
              label="Spread"
              displayValue={`${spread.toFixed(1)}x`}
              size={45}
              color="#92ce84"
            />
          </Col>
        )}
        
        {showShift && (
          <Col xs={6} sm={4} md={2} lg={1}>
            <Knob
              value={shift}
              onChange={setShift}
              min={-500}
              max={500}
              step={10}
              label="Shift"
              displayValue={`${shift}Hz`}
              size={45}
              color="#cbb677"
            />
          </Col>
        )}
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applySpectralFilter}
          >
            Apply to Region
          </Button>
        </Col>
      </Row>
    </Container>
  );
}

// Window function
function createWindow(size) {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1));
  }
  return window;
}

// Simple FFT implementation
function fft(signal) {
  const N = signal.length;
  const spectrum = new Float32Array(N * 2);
  
  // Simple DFT for demonstration (inefficient but works)
  for (let k = 0; k < N; k++) {
    let real = 0;
    let imag = 0;
    
    for (let n = 0; n < N; n++) {
      const angle = -2 * Math.PI * k * n / N;
      real += signal[n] * Math.cos(angle);
      imag += signal[n] * Math.sin(angle);
    }
    
    spectrum[k * 2] = real;
    spectrum[k * 2 + 1] = imag;
  }
  
  return spectrum;
}

// Inverse FFT
function ifft(spectrum) {
  const N = spectrum.length / 2;
  const signal = new Float32Array(N);
  
  for (let n = 0; n < N; n++) {
    let real = 0;
    
    for (let k = 0; k < N; k++) {
      const angle = 2 * Math.PI * k * n / N;
      real += spectrum[k * 2] * Math.cos(angle) - spectrum[k * 2 + 1] * Math.sin(angle);
    }
    
    signal[n] = real / N;
  }
  
  return signal;
}

// Filter implementations
function applyRobotFilter(spectrum, bands) {
  const N = spectrum.length / 2;
  const bandSize = Math.floor(N / bands);
  
  for (let band = 0; band < bands; band++) {
    let avgReal = 0;
    let avgImag = 0;
    
    // Calculate average for this band
    for (let i = band * bandSize; i < (band + 1) * bandSize && i < N; i++) {
      avgReal += spectrum[i * 2];
      avgImag += spectrum[i * 2 + 1];
    }
    avgReal /= bandSize;
    avgImag /= bandSize;
    
    // Apply average to all frequencies in band
    for (let i = band * bandSize; i < (band + 1) * bandSize && i < N; i++) {
      spectrum[i * 2] = avgReal;
      spectrum[i * 2 + 1] = avgImag;
    }
  }
}

function applyWhisperFilter(spectrum, threshold) {
  const N = spectrum.length / 2;
  
  for (let i = 0; i < N; i++) {
    const real = spectrum[i * 2];
    const imag = spectrum[i * 2 + 1];
    const mag = Math.sqrt(real * real + imag * imag);
    
    // Randomize phase for frequencies above threshold
    if (mag > threshold) {
      const newPhase = Math.random() * 2 * Math.PI;
      spectrum[i * 2] = mag * Math.cos(newPhase);
      spectrum[i * 2 + 1] = mag * Math.sin(newPhase);
    }
  }
}

function applyHarmonicBoost(spectrum, spread) {
  const N = spectrum.length / 2;
  const fundamental = findFundamental(spectrum);
  
  if (fundamental > 0) {
    for (let harmonic = 2; harmonic <= 10; harmonic++) {
      const freq = fundamental * harmonic;
      const bin = Math.round(freq);
      
      if (bin < N) {
        const boost = Math.pow(spread, harmonic - 1);
        spectrum[bin * 2] *= boost;
        spectrum[bin * 2 + 1] *= boost;
      }
    }
  }
}

function applyFrequencyShift(spectrum, shiftHz, sampleRate) {
  const N = spectrum.length / 2;
  const binShift = Math.round(shiftHz * N / (sampleRate / 2));
  const shifted = new Float32Array(spectrum.length);
  
  for (let i = 0; i < N; i++) {
    const newBin = i + binShift;
    if (newBin >= 0 && newBin < N) {
      shifted[newBin * 2] = spectrum[i * 2];
      shifted[newBin * 2 + 1] = spectrum[i * 2 + 1];
    }
  }
  
  spectrum.set(shifted);
}

function applySpectralGate(spectrum, threshold) {
  const N = spectrum.length / 2;
  
  for (let i = 0; i < N; i++) {
    const real = spectrum[i * 2];
    const imag = spectrum[i * 2 + 1];
    const mag = Math.sqrt(real * real + imag * imag);
    
    if (mag < threshold) {
      spectrum[i * 2] = 0;
      spectrum[i * 2 + 1] = 0;
    }
  }
}

function applyOddHarmonicsFilter(spectrum) {
  const N = spectrum.length / 2;
  const fundamental = findFundamental(spectrum);
  
  if (fundamental > 0) {
    // Zero out all bins first
    const temp = new Float32Array(spectrum.length);
    
    // Keep only odd harmonics
    for (let harmonic = 1; harmonic <= 20; harmonic += 2) {
      const bin = Math.round(fundamental * harmonic);
      if (bin < N) {
        temp[bin * 2] = spectrum[bin * 2];
        temp[bin * 2 + 1] = spectrum[bin * 2 + 1];
      }
    }
    
    spectrum.set(temp);
  }
}

function findFundamental(spectrum) {
  const N = spectrum.length / 2;
  let maxMag = 0;
  let fundamentalBin = 0;
  
  // Start from bin 1 to avoid DC
  for (let i = 1; i < N / 4; i++) {
    const mag = Math.sqrt(spectrum[i * 2] * spectrum[i * 2] + spectrum[i * 2 + 1] * spectrum[i * 2 + 1]);
    if (mag > maxMag) {
      maxMag = mag;
      fundamentalBin = i;
    }
  }
  
  return fundamentalBin;
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