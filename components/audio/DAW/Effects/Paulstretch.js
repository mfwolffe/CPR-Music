'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects 
} from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Paulstretch effect - extreme time stretching algorithm
 * Based on the algorithm by Paul Nasca
 */
export default function Paulstretch({ width }) {
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
  
  // Initialize audio context
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);
  
  // Paulstretch parameters
  const [stretchFactor, setStretchFactor] = useState(8);
  const [windowSize, setWindowSize] = useState(0.25);
  const [onset, setOnset] = useState(10);
  
  // Hann window function
  const hannWindow = (length) => {
    const window = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (length - 1)));
    }
    return window;
  };
  
  // Apply Paulstretch algorithm
  const applyPaulstretch = useCallback(async () => {
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
      
      // Paulstretch parameters
      const stretch = stretchFactor;
      const windowSizeSamples = Math.floor(windowSize * sampleRate);
      const halfWindow = Math.floor(windowSizeSamples / 2);
      
      // Make sure window size is even
      const fftSize = Math.pow(2, Math.ceil(Math.log2(windowSizeSamples)));
      
      // Output length after stretching
      const outputLength = Math.floor(regionLength * stretch);
      
      // Create output buffer
      const outputBuffer = context.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length - regionLength + outputLength,
        sampleRate
      );
      
      // Process each channel
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const inputData = audioBuffer.getChannelData(channel);
        const outputData = outputBuffer.getChannelData(channel);
        
        // Copy before region
        for (let i = 0; i < startSample; i++) {
          outputData[i] = inputData[i];
        }
        
        // Extract region data
        const regionData = new Float32Array(regionLength);
        for (let i = 0; i < regionLength; i++) {
          regionData[i] = inputData[startSample + i];
        }
        
        // Paulstretch processing
        const stretchedData = new Float32Array(outputLength);
        const window = hannWindow(windowSizeSamples);
        
        // Process overlapping windows
        const hopSize = Math.floor(windowSizeSamples / onset);
        const outputHopSize = Math.floor(hopSize * stretch);
        
        let inputPos = 0;
        let outputPos = 0;
        
        while (inputPos + windowSizeSamples < regionLength && outputPos + windowSizeSamples < outputLength) {
          // Extract windowed segment
          const segment = new Float32Array(fftSize);
          for (let i = 0; i < windowSizeSamples; i++) {
            if (inputPos + i < regionLength) {
              segment[i] = regionData[inputPos + i] * window[i];
            }
          }
          
          // FFT
          const fft = new FFT(fftSize);
          const spectrum = fft.forward(segment);
          
          // Randomize phases while keeping magnitudes
          for (let i = 0; i < spectrum.length; i += 2) {
            const mag = Math.sqrt(spectrum[i] * spectrum[i] + spectrum[i + 1] * spectrum[i + 1]);
            const phase = Math.random() * 2 * Math.PI;
            spectrum[i] = mag * Math.cos(phase);
            spectrum[i + 1] = mag * Math.sin(phase);
          }
          
          // IFFT
          const stretched = fft.inverse(spectrum);
          
          // Add to output with windowing
          for (let i = 0; i < windowSizeSamples; i++) {
            if (outputPos + i < outputLength) {
              stretchedData[outputPos + i] += stretched[i] * window[i];
            }
          }
          
          inputPos += hopSize;
          outputPos += outputHopSize;
        }
        
        // Normalize
        let maxVal = 0;
        for (let i = 0; i < outputLength; i++) {
          maxVal = Math.max(maxVal, Math.abs(stretchedData[i]));
        }
        if (maxVal > 0) {
          for (let i = 0; i < outputLength; i++) {
            stretchedData[i] /= maxVal;
          }
        }
        
        // Copy stretched data to output
        for (let i = 0; i < outputLength; i++) {
          outputData[startSample + i] = stretchedData[i] * 0.8; // Scale down to prevent clipping
        }
        
        // Copy after region
        for (let i = endSample; i < inputData.length; i++) {
          const outputIndex = startSample + outputLength + (i - endSample);
          if (outputIndex < outputData.length) {
            outputData[outputIndex] = inputData[i];
          }
        }
      }
      
      // Convert to blob and update
      const wav = await audioBufferToWav(outputBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      // Update audio and history
      addToEditHistory(url, 'Apply Paulstretch', {
        effect: 'paulstretch',
        parameters: {
          stretchFactor: stretch,
          windowSize: windowSize,
          onset: onset
        },
        region: { start: cutRegion.start, end: cutRegion.end }
      });
      
      // Load new audio
      await wavesurfer.load(url);
      
      // Clear region
      cutRegion.remove();
      
    } catch (error) {
      console.error('Error applying Paulstretch:', error);
      alert('Error applying Paulstretch. Please try again.');
    }
  }, [audioURL, addToEditHistory, wavesurferRef, cutRegion]);
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={stretchFactor}
            onChange={setStretchFactor}
            min={2}
            max={50}
            step={1}
            label="Stretch"
            displayValue={`${stretchFactor}x`}
            size={45}
            color="#e75b5c"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={windowSize}
            onChange={setWindowSize}
            min={0.05}
            max={1}
            step={0.05}
            label="Window"
            displayValue={`${(windowSize * 1000).toFixed(0)}ms`}
            size={45}
            color="#7bafd4"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2} lg={1}>
          <Knob
            value={onset}
            onChange={setOnset}
            min={2}
            max={50}
            step={1}
            label="Smoothness"
            displayValue={`${onset}`}
            size={45}
            color="#92ce84"
          />
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyPaulstretch}
          >
            Apply to Region
          </Button>
        </Col>
      </Row>
    </Container>
  );
}

// Simple FFT implementation for Paulstretch
class FFT {
  constructor(size) {
    this.size = size;
    this.invSize = 1 / size;
    this.bSi = 2 / size;
    this.twiddleReal = new Float32Array(size);
    this.twiddleImag = new Float32Array(size);
    
    for (let i = 0; i < size; i++) {
      const angle = -2 * Math.PI * i / size;
      this.twiddleReal[i] = Math.cos(angle);
      this.twiddleImag[i] = Math.sin(angle);
    }
  }
  
  forward(real) {
    const size = this.size;
    const output = new Float32Array(size * 2);
    
    // Copy real values, set imaginary to 0
    for (let i = 0; i < size; i++) {
      output[i * 2] = real[i];
      output[i * 2 + 1] = 0;
    }
    
    // Bit reversal
    let j = 0;
    for (let i = 0; i < size - 1; i++) {
      if (i < j) {
        // Swap
        let tempR = output[i * 2];
        let tempI = output[i * 2 + 1];
        output[i * 2] = output[j * 2];
        output[i * 2 + 1] = output[j * 2 + 1];
        output[j * 2] = tempR;
        output[j * 2 + 1] = tempI;
      }
      let k = size >> 1;
      while (j >= k) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }
    
    // FFT computation
    for (let len = 2; len <= size; len <<= 1) {
      const halfLen = len >> 1;
      const step = size / len;
      
      for (let i = 0; i < size; i += len) {
        let k = 0;
        for (let j = 0; j < halfLen; j++) {
          const tR = this.twiddleReal[k];
          const tI = this.twiddleImag[k];
          
          const evenR = output[(i + j) * 2];
          const evenI = output[(i + j) * 2 + 1];
          const oddR = output[(i + j + halfLen) * 2];
          const oddI = output[(i + j + halfLen) * 2 + 1];
          
          const tR_oddR = tR * oddR - tI * oddI;
          const tI_oddR = tR * oddI + tI * oddR;
          
          output[(i + j) * 2] = evenR + tR_oddR;
          output[(i + j) * 2 + 1] = evenI + tI_oddR;
          output[(i + j + halfLen) * 2] = evenR - tR_oddR;
          output[(i + j + halfLen) * 2 + 1] = evenI - tI_oddR;
          
          k += step;
        }
      }
    }
    
    return output;
  }
  
  inverse(spectrum) {
    const size = this.size;
    const output = new Float32Array(size);
    
    // Conjugate
    for (let i = 0; i < size; i++) {
      spectrum[i * 2 + 1] = -spectrum[i * 2 + 1];
    }
    
    // Forward FFT
    const result = this.forward(spectrum);
    
    // Extract real part and scale
    for (let i = 0; i < size; i++) {
      output[i] = result[i * 2] * this.invSize;
    }
    
    return output;
  }
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