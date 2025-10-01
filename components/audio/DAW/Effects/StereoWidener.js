'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Form, Button } from 'react-bootstrap';
import { useAudio, useEffects } from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Stereo Processing Modes
 */
const StereoModes = {
  classic: { 
    name: 'Classic Width', 
    description: 'Traditional stereo width control' 
  },
  midside: { 
    name: 'Mid/Side Processing', 
    description: 'Independent mid and side channel control' 
  },
  haas: { 
    name: 'Haas Effect', 
    description: 'Psychoacoustic delay-based widening' 
  },
  correlation: { 
    name: 'Correlation Control', 
    description: 'Stereo correlation adjustment' 
  }
};

/**
 * Professional Stereo Widener Processor
 * Features: Mid/Side processing, correlation monitoring, frequency-dependent widening
 */
class StereoWidenerProcessor {
  constructor(audioContext) {
    this.context = audioContext;
    this.sampleRate = audioContext.sampleRate;
    
    // Create nodes
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();
    
    // Mid/Side processing
    this.midGain = audioContext.createGain();
    this.sideGain = audioContext.createGain();
    
    // Bass mono filtering
    this.bassFilterLeft = audioContext.createBiquadFilter();
    this.bassFilterRight = audioContext.createBiquadFilter();
    this.bassMidGain = audioContext.createGain();
    
    // High frequency limiting
    this.highLimitFilterLeft = audioContext.createBiquadFilter();
    this.highLimitFilterRight = audioContext.createBiquadFilter();
    
    // Haas delay
    this.haasDelay = audioContext.createDelay(0.1);
    this.haasGain = audioContext.createGain();
    
    // Stereo field manipulation
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);
    
    // Parameters
    this.width = 1.5;
    this.delay = 10; // ms
    this.bassRetain = true;
    this.bassFreq = 200;
    this.mode = 'classic';
    this.midGainValue = 0; // dB
    this.sideGainValue = 0; // dB
    this.phase = 0; // degrees
    this.correlation = 0;
    this.highFreqLimit = 20000;
    this.safetyLimit = true;
    this.outputGain = 1.0;
    
    this.setupFilters();
    this.setupRouting();
  }
  
  setupFilters() {
    // Bass mono filters (high-pass to isolate highs)
    this.bassFilterLeft.type = 'highpass';
    this.bassFilterLeft.frequency.value = this.bassFreq;
    this.bassFilterLeft.Q.value = 0.707;
    
    this.bassFilterRight.type = 'highpass';
    this.bassFilterRight.frequency.value = this.bassFreq;
    this.bassFilterRight.Q.value = 0.707;
    
    // High frequency limiting filters
    this.highLimitFilterLeft.type = 'lowpass';
    this.highLimitFilterLeft.frequency.value = this.highFreqLimit;
    this.highLimitFilterLeft.Q.value = 0.707;
    
    this.highLimitFilterRight.type = 'lowpass';
    this.highLimitFilterRight.frequency.value = this.highFreqLimit;
    this.highLimitFilterRight.Q.value = 0.707;
    
    // Haas delay
    this.haasDelay.delayTime.value = this.delay / 1000;
    this.haasGain.gain.value = 0.8;
  }
  
  setupRouting() {
    // Basic routing
    this.input.connect(this.splitter);
    this.merger.connect(this.output);
  }
  
  /**
   * Calculate stereo correlation between L and R channels
   */
  calculateCorrelation(leftData, rightData, startSample, endSample) {
    let correlation = 0;
    let leftSum = 0;
    let rightSum = 0;
    let leftSquareSum = 0;
    let rightSquareSum = 0;
    let crossSum = 0;
    
    const length = endSample - startSample;
    
    for (let i = startSample; i < endSample; i++) {
      const left = leftData[i] || 0;
      const right = rightData[i] || 0;
      
      leftSum += left;
      rightSum += right;
      leftSquareSum += left * left;
      rightSquareSum += right * right;
      crossSum += left * right;
    }
    
    const leftMean = leftSum / length;
    const rightMean = rightSum / length;
    
    const leftVariance = (leftSquareSum / length) - (leftMean * leftMean);
    const rightVariance = (rightSquareSum / length) - (rightMean * rightMean);
    const covariance = (crossSum / length) - (leftMean * rightMean);
    
    const denominator = Math.sqrt(leftVariance * rightVariance);
    if (denominator > 0) {
      correlation = covariance / denominator;
    }
    
    return Math.max(-1, Math.min(1, correlation));
  }
  
  /**
   * Apply Mid/Side processing
   */
  processMidSide(leftData, rightData, startSample, endSample) {
    const outputLeft = new Float32Array(leftData.length);
    const outputRight = new Float32Array(rightData.length);
    
    // Copy original data
    outputLeft.set(leftData);
    outputRight.set(rightData);
    
    const midGainLinear = Math.pow(10, this.midGainValue / 20);
    const sideGainLinear = Math.pow(10, this.sideGainValue / 20);
    const phaseRadians = (this.phase * Math.PI) / 180;
    
    for (let i = startSample; i < endSample; i++) {
      const left = leftData[i] || 0;
      const right = rightData[i] || 0;
      
      // Convert to Mid/Side
      let mid = (left + right) * 0.5;
      let side = (left - right) * 0.5;
      
      // Apply mode-specific processing
      switch (this.mode) {
        case 'classic':
          side *= this.width;
          break;
          
        case 'midside':
          mid *= midGainLinear;
          side *= sideGainLinear * this.width;
          break;
          
        case 'haas':
          // Haas effect is applied later in the chain
          side *= this.width;
          break;
          
        case 'correlation':
          // Adjust side signal based on correlation target
          const currentCorr = this.calculateCorrelation(leftData, rightData, i, Math.min(i + 1024, endSample));
          const corrAdjust = this.correlation - currentCorr;
          side *= this.width * (1 + corrAdjust * 0.5);
          break;
      }
      
      // Apply phase offset to side signal
      if (this.phase !== 0) {
        side *= Math.cos(phaseRadians);
      }
      
      // Convert back to L/R
      outputLeft[i] = mid + side;
      outputRight[i] = mid - side;
    }
    
    return { left: outputLeft, right: outputRight };
  }
  
  /**
   * Apply bass mono retention
   */
  applyBassMono(leftData, rightData, startSample, endSample) {
    if (!this.bassRetain) return { left: leftData, right: rightData };
    
    const outputLeft = new Float32Array(leftData.length);
    const outputRight = new Float32Array(rightData.length);
    
    // Copy original data
    outputLeft.set(leftData);
    outputRight.set(rightData);
    
    // Simple high-pass filter to separate bass and highs
    const fc = this.bassFreq;
    const dt = 1 / this.sampleRate;
    const RC = 1 / (2 * Math.PI * fc);
    const alpha = dt / (RC + dt);
    
    let bassStateLeft = 0;
    let bassStateRight = 0;
    
    for (let i = startSample; i < endSample; i++) {
      const left = leftData[i] || 0;
      const right = rightData[i] || 0;
      
      // Low-pass filter to extract bass
      bassStateLeft += alpha * (left - bassStateLeft);
      bassStateRight += alpha * (right - bassStateRight);
      
      // Create mono bass
      const bassMono = (bassStateLeft + bassStateRight) * 0.5;
      
      // High-pass the original signal (remove bass)
      const highsLeft = left - bassStateLeft;
      const highsRight = right - bassStateRight;
      
      // Recombine with mono bass
      outputLeft[i] = highsLeft + bassMono;
      outputRight[i] = highsRight + bassMono;
    }
    
    return { left: outputLeft, right: outputRight };
  }
  
  /**
   * Apply Haas effect delay
   */
  applyHaasEffect(leftData, rightData, startSample, endSample) {
    if (this.mode !== 'haas' || this.delay === 0) {
      return { left: leftData, right: rightData };
    }
    
    const outputLeft = new Float32Array(leftData.length);
    const outputRight = new Float32Array(rightData.length);
    
    // Copy original data
    outputLeft.set(leftData);
    outputRight.set(rightData);
    
    const delaySamples = Math.floor((this.delay / 1000) * this.sampleRate);
    
    for (let i = startSample; i < endSample; i++) {
      const delayedIndex = i - delaySamples;
      
      if (delayedIndex >= 0 && delayedIndex < rightData.length) {
        // Apply delay to right channel with slight attenuation
        outputRight[i] = rightData[delayedIndex] * 0.8 + rightData[i] * 0.2;
      }
    }
    
    return { left: outputLeft, right: outputRight };
  }
  
  /**
   * Apply safety limiting to prevent over-widening
   */
  applySafetyLimiting(leftData, rightData, startSample, endSample) {
    if (!this.safetyLimit) return { left: leftData, right: rightData };
    
    const outputLeft = new Float32Array(leftData.length);
    const outputRight = new Float32Array(rightData.length);
    
    // Copy original data
    outputLeft.set(leftData);
    outputRight.set(rightData);
    
    for (let i = startSample; i < endSample; i++) {
      let left = leftData[i] || 0;
      let right = rightData[i] || 0;
      
      // Calculate side signal magnitude
      const side = Math.abs(left - right) * 0.5;
      const mid = Math.abs(left + right) * 0.5;
      
      // If side signal is much larger than mid, apply limiting
      if (side > mid * 2) {
        const ratio = (mid * 2) / side;
        const reducedSide = (left - right) * ratio * 0.5;
        const preservedMid = (left + right) * 0.5;
        
        left = preservedMid + reducedSide;
        right = preservedMid - reducedSide;
      }
      
      // Soft limiting
      outputLeft[i] = Math.tanh(left * 0.8) / 0.8;
      outputRight[i] = Math.tanh(right * 0.8) / 0.8;
    }
    
    return { left: outputLeft, right: outputRight };
  }
  
  // Parameter setters
  setWidth(width) {
    this.width = Math.max(0, Math.min(3, width));
  }
  
  setDelay(delay) {
    this.delay = Math.max(0, Math.min(50, delay));
    this.haasDelay.delayTime.setValueAtTime(this.delay / 1000, this.context.currentTime);
  }
  
  setBassRetain(retain) {
    this.bassRetain = retain;
  }
  
  setBassFreq(freq) {
    this.bassFreq = Math.max(20, Math.min(500, freq));
    this.bassFilterLeft.frequency.setValueAtTime(this.bassFreq, this.context.currentTime);
    this.bassFilterRight.frequency.setValueAtTime(this.bassFreq, this.context.currentTime);
  }
  
  setMode(mode) {
    this.mode = mode;
  }
  
  setMidGain(gain) {
    this.midGainValue = Math.max(-12, Math.min(12, gain));
  }
  
  setSideGain(gain) {
    this.sideGainValue = Math.max(-12, Math.min(12, gain));
  }
  
  setPhase(phase) {
    this.phase = Math.max(0, Math.min(180, phase));
  }
  
  setCorrelation(correlation) {
    this.correlation = Math.max(-1, Math.min(1, correlation));
  }
  
  setHighFreqLimit(freq) {
    this.highFreqLimit = Math.max(1000, Math.min(20000, freq));
    this.highLimitFilterLeft.frequency.setValueAtTime(this.highFreqLimit, this.context.currentTime);
    this.highLimitFilterRight.frequency.setValueAtTime(this.highFreqLimit, this.context.currentTime);
  }
  
  setSafetyLimit(enable) {
    this.safetyLimit = enable;
  }
  
  setOutputGain(gain) {
    this.output.gain.setValueAtTime(Math.max(0, Math.min(2, gain)), this.context.currentTime);
    this.outputGain = gain;
  }
  
  connect(destination) {
    this.output.connect(destination);
  }
  
  disconnect() {
    this.output.disconnect();
  }
}

/**
 * Process stereo widener on an audio buffer region
 */
export async function processStereoWidenerRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  
  // Check if audio is stereo
  if (audioBuffer.numberOfChannels < 2) {
    throw new Error('Stereo widener requires stereo audio');
  }
  
  // Create processor
  const processor = new StereoWidenerProcessor(audioContext);
  processor.setWidth(parameters.width || 1.5);
  processor.setDelay(parameters.delay || 10);
  processor.setBassRetain(parameters.bassRetain !== false);
  processor.setBassFreq(parameters.bassFreq || 200);
  processor.setMode(parameters.mode || 'classic');
  processor.setMidGain(parameters.midGain || 0);
  processor.setSideGain(parameters.sideGain || 0);
  processor.setPhase(parameters.phase || 0);
  processor.setCorrelation(parameters.correlation || 0);
  processor.setHighFreqLimit(parameters.highFreqLimit || 20000);
  processor.setSafetyLimit(parameters.safetyLimit !== false);
  processor.setOutputGain(parameters.outputGain || 1.0);
  
  // Create output buffer
  const outputBuffer = audioContext.createBuffer(
    2, // Ensure stereo
    audioBuffer.length,
    sampleRate
  );
  
  // Get channel data
  const leftData = audioBuffer.getChannelData(0);
  const rightData = audioBuffer.getChannelData(1);
  const leftOut = outputBuffer.getChannelData(0);
  const rightOut = outputBuffer.getChannelData(1);
  
  // Copy original audio
  leftOut.set(leftData);
  rightOut.set(rightData);
  
  // Process the selected region through the processor chain
  let processed = processor.processMidSide(leftData, rightData, startSample, endSample);
  processed = processor.applyBassMono(processed.left, processed.right, startSample, endSample);
  processed = processor.applyHaasEffect(processed.left, processed.right, startSample, endSample);
  processed = processor.applySafetyLimiting(processed.left, processed.right, startSample, endSample);
  
  // Apply output gain and copy processed region to output
  const outputGainLinear = processor.outputGain;
  for (let i = startSample; i < endSample; i++) {
    if (i < outputBuffer.length) {
      leftOut[i] = processed.left[i] * outputGainLinear;
      rightOut[i] = processed.right[i] * outputGainLinear;
    }
  }
  
  return outputBuffer;
}

/**
 * Professional Stereo Widener Effect
 * Features: Mid/Side processing, correlation monitoring, frequency-dependent widening
 */
export default function StereoWidener({ width }) {
  const {
    audioRef,
    wavesurferRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const {
    cutRegion,
    stereoWidenerWidth,
    setStereoWidenerWidth,
    stereoWidenerDelay,
    setStereoWidenerDelay,
    stereoWidenerBassRetain,
    setStereoWidenerBassRetain,
    stereoWidenerBassFreq,
    setStereoWidenerBassFreq,
    stereoWidenerMode,
    setStereoWidenerMode,
    stereoWidenerMidGain,
    setStereoWidenerMidGain,
    stereoWidenerSideGain,
    setStereoWidenerSideGain,
    stereoWidenerPhase,
    setStereoWidenerPhase,
    stereoWidenerCorrelation,
    setStereoWidenerCorrelation,
    stereoWidenerHighFreqLimit,
    setStereoWidenerHighFreqLimit,
    stereoWidenerSafetyLimit,
    setStereoWidenerSafetyLimit,
    stereoWidenerOutputGain,
    setStereoWidenerOutputGain
  } = useEffects();
  
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const canvasRef = useRef(null);
  const [correlationValue, setCorrelationValue] = useState(0);
  
  // Initialize audio context and processor
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (!processorRef.current) {
      processorRef.current = new StereoWidenerProcessor(audioContextRef.current);
    }
  }, []);
  
  // Update processor parameters
  useEffect(() => {
    if (processorRef.current) {
      processorRef.current.setWidth(stereoWidenerWidth);
      processorRef.current.setDelay(stereoWidenerDelay);
      processorRef.current.setBassRetain(stereoWidenerBassRetain);
      processorRef.current.setBassFreq(stereoWidenerBassFreq);
      processorRef.current.setMode(stereoWidenerMode);
      processorRef.current.setMidGain(stereoWidenerMidGain);
      processorRef.current.setSideGain(stereoWidenerSideGain);
      processorRef.current.setPhase(stereoWidenerPhase);
      processorRef.current.setCorrelation(stereoWidenerCorrelation);
      processorRef.current.setHighFreqLimit(stereoWidenerHighFreqLimit);
      processorRef.current.setSafetyLimit(stereoWidenerSafetyLimit);
      processorRef.current.setOutputGain(stereoWidenerOutputGain);
    }
  }, [stereoWidenerWidth, stereoWidenerDelay, stereoWidenerBassRetain, stereoWidenerBassFreq,
      stereoWidenerMode, stereoWidenerMidGain, stereoWidenerSideGain, stereoWidenerPhase,
      stereoWidenerCorrelation, stereoWidenerHighFreqLimit, stereoWidenerSafetyLimit,
      stereoWidenerOutputGain]);
  
  // Draw stereo field visualization
  const drawVisualization = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    // Center lines
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    
    // Draw stereo field circle
    const radius = Math.min(width, height) * 0.4;
    ctx.strokeStyle = '#555';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Draw original stereo image (before processing)
    ctx.strokeStyle = '#7bafd4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.6, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Draw processed stereo image
    const processedRadius = radius * 0.6 * stereoWidenerWidth;
    ctx.strokeStyle = '#e75b5c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.min(processedRadius, radius * 0.95), 0, 2 * Math.PI);
    ctx.stroke();
    
    // Draw phase offset visualization
    if (stereoWidenerPhase > 0) {
      const phaseAngle = (stereoWidenerPhase * Math.PI) / 180;
      const phaseX = centerX + Math.cos(phaseAngle) * radius * 0.3;
      const phaseY = centerY + Math.sin(phaseAngle) * radius * 0.3;
      
      ctx.strokeStyle = '#dda0dd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(phaseX, phaseY);
      ctx.stroke();
    }
    
    // Draw correlation indicator
    const corrColor = correlationValue > 0.5 ? '#92ceaa' : 
                     correlationValue < -0.5 ? '#e75b5c' : '#cbb677';
    ctx.fillStyle = corrColor;
    ctx.fillRect(10, height - 30, Math.abs(correlationValue) * 100, 10);
    
    // Draw labels
    ctx.fillStyle = '#e75b5c';
    ctx.font = '12px monospace';
    ctx.fillText(`Width: ${stereoWidenerWidth.toFixed(1)}x`, 10, 20);
    ctx.fillText(`Mode: ${StereoModes[stereoWidenerMode]?.name || 'Classic'}`, 10, 35);
    
    if (stereoWidenerMode === 'haas' && stereoWidenerDelay > 0) {
      ctx.fillStyle = '#7bafd4';
      ctx.fillText(`Haas: ${stereoWidenerDelay.toFixed(1)}ms`, 10, 50);
    }
    
    if (stereoWidenerBassRetain) {
      ctx.fillStyle = '#cbb677';
      ctx.fillText(`Bass Mono: ${stereoWidenerBassFreq}Hz`, 10, height - 45);
    }
    
    ctx.fillStyle = corrColor;
    ctx.fillText(`Correlation: ${correlationValue.toFixed(2)}`, 10, height - 15);
    
    // Labels for L/R
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText('L', 10, centerY + 5);
    ctx.fillText('R', width - 20, centerY + 5);
    ctx.fillText('C', centerX - 5, 15);
    
  }, [stereoWidenerWidth, stereoWidenerMode, stereoWidenerDelay, stereoWidenerPhase,
      stereoWidenerBassRetain, stereoWidenerBassFreq, correlationValue]);
  
  // Update visualization
  useEffect(() => {
    drawVisualization();
  }, [drawVisualization]);
  
  // Apply stereo widener to selected region
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
      
      // Calculate correlation for display
      const leftData = audioBuffer.getChannelData(0);
      const rightData = audioBuffer.getChannelData(1);
      const correlation = processorRef.current?.calculateCorrelation(leftData, rightData, startSample, endSample) || 0;
      setCorrelationValue(correlation);
      
      // Use the exported processing function
      const parameters = {
        width: stereoWidenerWidth,
        delay: stereoWidenerDelay,
        bassRetain: stereoWidenerBassRetain,
        bassFreq: stereoWidenerBassFreq,
        mode: stereoWidenerMode,
        midGain: stereoWidenerMidGain,
        sideGain: stereoWidenerSideGain,
        phase: stereoWidenerPhase,
        correlation: stereoWidenerCorrelation,
        highFreqLimit: stereoWidenerHighFreqLimit,
        safetyLimit: stereoWidenerSafetyLimit,
        outputGain: stereoWidenerOutputGain
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
  }, [audioURL, addToEditHistory, wavesurferRef, cutRegion, stereoWidenerWidth,
      stereoWidenerDelay, stereoWidenerBassRetain, stereoWidenerBassFreq, stereoWidenerMode,
      stereoWidenerMidGain, stereoWidenerSideGain, stereoWidenerPhase, stereoWidenerCorrelation,
      stereoWidenerHighFreqLimit, stereoWidenerSafetyLimit, stereoWidenerOutputGain]);
  
  return (
    <Container fluid className="p-2">
      {/* Stereo Field Visualization */}
      <Row className="mb-3">
        <Col xs={12}>
          <div className="bg-dark border border-secondary rounded position-relative">
            <canvas
              ref={canvasRef}
              width={400}
              height={200}
              style={{ width: '100%', height: '200px' }}
            />
            <div className="position-absolute top-0 right-0 p-2">
              <small className="text-muted">Stereo Field</small>
            </div>
          </div>
        </Col>
      </Row>
      
      {/* Mode Selection */}
      <Row className="mb-2">
        <Col xs={12} md={6}>
          <Form.Label className="text-white small">Processing Mode</Form.Label>
          <Form.Select
            value={stereoWidenerMode}
            onChange={(e) => setStereoWidenerMode(e.target.value)}
            className="bg-secondary text-white border-0"
          >
            {Object.entries(StereoModes).map(([key, mode]) => (
              <option key={key} value={key}>{mode.name}</option>
            ))}
          </Form.Select>
          <small className="text-muted">{StereoModes[stereoWidenerMode]?.description}</small>
        </Col>
        
        <Col xs={12} md={3} className="d-flex align-items-end">
          <Form.Check
            type="switch"
            id="bass-retain"
            label="Bass Mono"
            checked={stereoWidenerBassRetain}
            onChange={(e) => setStereoWidenerBassRetain(e.target.checked)}
            className="text-white"
          />
        </Col>
        
        <Col xs={12} md={3} className="d-flex align-items-end">
          <Form.Check
            type="switch"
            id="safety-limit"
            label="Safety Limit"
            checked={stereoWidenerSafetyLimit}
            onChange={(e) => setStereoWidenerSafetyLimit(e.target.checked)}
            className="text-white"
          />
        </Col>
      </Row>
      
      {/* Main Controls */}
      <Row className="mb-2">
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={stereoWidenerWidth}
            onChange={setStereoWidenerWidth}
            min={0}
            max={3}
            step={0.01}
            label="Width"
            displayValue={`${stereoWidenerWidth.toFixed(2)}x`}
            size={50}
            color="#e75b5c"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={stereoWidenerDelay}
            onChange={setStereoWidenerDelay}
            min={0}
            max={50}
            step={0.1}
            label="Haas Delay"
            displayValue={`${stereoWidenerDelay.toFixed(1)}ms`}
            size={50}
            color="#7bafd4"
            disabled={stereoWidenerMode !== 'haas'}
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={stereoWidenerMidGain}
            onChange={setStereoWidenerMidGain}
            min={-12}
            max={12}
            step={0.1}
            label="Mid Gain"
            displayValue={`${stereoWidenerMidGain > 0 ? '+' : ''}${stereoWidenerMidGain.toFixed(1)}dB`}
            size={50}
            color="#cbb677"
            disabled={stereoWidenerMode !== 'midside'}
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={stereoWidenerSideGain}
            onChange={setStereoWidenerSideGain}
            min={-12}
            max={12}
            step={0.1}
            label="Side Gain"
            displayValue={`${stereoWidenerSideGain > 0 ? '+' : ''}${stereoWidenerSideGain.toFixed(1)}dB`}
            size={50}
            color="#dda0dd"
            disabled={stereoWidenerMode !== 'midside'}
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={stereoWidenerPhase}
            onChange={setStereoWidenerPhase}
            min={0}
            max={180}
            step={1}
            label="Phase"
            displayValue={`${stereoWidenerPhase}°`}
            size={50}
            color="#92ceaa"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={stereoWidenerOutputGain}
            onChange={setStereoWidenerOutputGain}
            min={0}
            max={2}
            step={0.01}
            label="Output"
            displayValue={`${stereoWidenerOutputGain.toFixed(2)}x`}
            size={50}
            color="#ffa500"
          />
        </Col>
      </Row>
      
      {/* Advanced Controls */}
      <Row className="mb-2">
        <Col xs={12}>
          <div className="text-white small mb-2">Advanced Controls</div>
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={stereoWidenerBassFreq}
            onChange={setStereoWidenerBassFreq}
            min={20}
            max={500}
            step={5}
            label="Bass Freq"
            displayValue={`${stereoWidenerBassFreq}Hz`}
            size={45}
            color="#cbb677"
            disabled={!stereoWidenerBassRetain}
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={stereoWidenerHighFreqLimit}
            onChange={setStereoWidenerHighFreqLimit}
            min={1000}
            max={20000}
            step={100}
            label="High Limit"
            displayValue={stereoWidenerHighFreqLimit >= 1000 ? `${(stereoWidenerHighFreqLimit/1000).toFixed(1)}k` : `${stereoWidenerHighFreqLimit}Hz`}
            size={45}
            color="#7bafd4"
            logarithmic={true}
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={stereoWidenerCorrelation}
            onChange={setStereoWidenerCorrelation}
            min={-1}
            max={1}
            step={0.01}
            label="Correlation"
            displayValue={`${stereoWidenerCorrelation > 0 ? '+' : ''}${stereoWidenerCorrelation.toFixed(2)}`}
            size={45}
            color="#dda0dd"
            disabled={stereoWidenerMode !== 'correlation'}
          />
        </Col>
        
        <Col xs={6} sm={4} md={3}>
          <div className="text-white small">Current Correlation</div>
          <div className="bg-secondary rounded p-2">
            <div 
              className={`small ${correlationValue > 0.5 ? 'text-success' : 
                             correlationValue < -0.5 ? 'text-danger' : 'text-warning'}`}
            >
              {correlationValue.toFixed(3)}
            </div>
            <div className="small text-muted">
              {correlationValue > 0.7 ? 'Mono' : 
               correlationValue > 0.3 ? 'Narrow' :
               correlationValue > -0.3 ? 'Normal' :
               correlationValue > -0.7 ? 'Wide' : 'Uncorrelated'}
            </div>
          </div>
        </Col>
      </Row>
      
      {/* Apply Button */}
      <Row>
        <Col xs={12} sm={6} md={4} lg={3}>
          <Button
            size="sm"
            className="w-100"
            onClick={applyStereoWidener}
          >
            Apply Stereo Widener to Region
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