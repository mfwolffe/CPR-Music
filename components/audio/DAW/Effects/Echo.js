'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { Container, Row, Col, Button, Form } from 'react-bootstrap';
import { useAudio, useEffects } from '../../../../contexts/DAWProvider';
import Knob from '../../../Knob';

/**
 * Advanced Echo Processor Class
 * Integrates multi-tap capability and LFO modulation from advanced engines
 */
class AdvancedEchoProcessor {
  constructor(audioContext, maxDelayTime = 2.0) {
    this.context = audioContext;
    this.sampleRate = audioContext.sampleRate;
    this.maxDelayTime = maxDelayTime;
    
    // Create nodes
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();
    this.wetGain = audioContext.createGain();
    this.dryGain = audioContext.createGain();
    
    // Multi-tap delay lines (from Advanced Delay engine)
    this.delayTaps = [];
    this.tapGains = [];
    this.tapFilters = [];
    
    // LFO for modulation (from Chorus engine)
    this.lfo = audioContext.createOscillator();
    this.lfoGain = audioContext.createGain();
    
    // Ping-pong stereo processing
    this.splitter = audioContext.createChannelSplitter(2);
    this.merger = audioContext.createChannelMerger(2);
    
    // Parameters
    this.baseDelayTime = 0.5; // seconds
    this.feedback = 0.5;
    this.inputGain = 1.0;
    this.outputGain = 1.0;
    this.advancedMode = false;
    this.taps = 1; // Start with single tap for basic mode
    this.spread = 0.3;
    this.modRate = 0.5;
    this.modDepth = 0.0; // Start with no modulation for basic mode
    this.modWaveform = 'sine';
    this.pingPong = false;
    this.filterType = 'none';
    this.filterFreq = 2000;
    this.tempoSync = false;
    this.noteDivision = 4;
    this.lfoStarted = false;  // Track whether LFO has been started

    this.setupLFO();
    this.setupDelayTaps(this.taps);
    this.setupRouting();
  }
  
  setupLFO() {
    // LFO system from Chorus engine
    this.lfo.type = this.modWaveform;
    this.lfo.frequency.value = this.modRate;
    this.lfoGain.gain.value = this.modDepth * this.baseDelayTime * 0.1;

    this.lfo.connect(this.lfoGain);

    // Start LFO only if not already started
    if (!this.lfoStarted) {
      this.lfo.start();
      this.lfoStarted = true;
    }
  }
  
  setupDelayTaps(numTaps) {
    // Clean up existing taps
    this.delayTaps.forEach(tap => tap.disconnect());
    this.tapGains.forEach(gain => gain.disconnect());
    this.tapFilters.forEach(filter => filter.disconnect());
    
    this.delayTaps = [];
    this.tapGains = [];
    this.tapFilters = [];
    
    // Create new taps (Multi-tap engine from Advanced Delay)
    for (let i = 0; i < numTaps; i++) {
      // Delay line
      const delay = this.context.createDelay(this.maxDelayTime);
      
      // Gain for tap level
      const gain = this.context.createGain();
      gain.gain.value = 1.0 / numTaps; // Normalize gain
      
      // Filter for each tap
      const filter = this.context.createBiquadFilter();
      filter.type = this.filterType === 'none' ? 'allpass' : this.filterType;
      filter.frequency.value = this.filterFreq;
      filter.Q.value = 1;
      
      this.delayTaps.push(delay);
      this.tapGains.push(gain);
      this.tapFilters.push(filter);
    }
    
    this.updateTapTimes();
    this.connectTaps();
  }
  
  updateTapTimes() {
    for (let i = 0; i < this.delayTaps.length; i++) {
      const tapIndex = i + 1;
      let tapTime;
      
      if (this.spread === 0 || this.delayTaps.length === 1) {
        // All taps at same time (basic mode behavior)
        tapTime = this.baseDelayTime;
      } else {
        // Spread taps across time (advanced mode)
        const spreadRange = this.baseDelayTime * this.spread;
        tapTime = this.baseDelayTime + (tapIndex - 1) * (spreadRange / (this.delayTaps.length - 1 || 1));
      }
      
      this.delayTaps[i].delayTime.setValueAtTime(
        Math.max(0.001, Math.min(this.maxDelayTime, tapTime)),
        this.context.currentTime
      );
    }
  }
  
  connectTaps() {
    // Connect each tap in series with processing
    for (let i = 0; i < this.delayTaps.length; i++) {
      const delay = this.delayTaps[i];
      const gain = this.tapGains[i];
      const filter = this.tapFilters[i];
      
      // Connect: input -> delay -> filter -> gain -> output
      delay.connect(filter);
      filter.connect(gain);
      gain.connect(this.wetGain);
      
      // Connect modulation to delay time (LFO engine from Chorus)
      this.lfoGain.connect(delay.delayTime);
    }
  }
  
  setupRouting() {
    // Input splitting for stereo processing
    this.input.connect(this.splitter);
    this.input.connect(this.dryGain);
    
    // Dry path
    this.dryGain.connect(this.output);
    
    // Wet path
    this.wetGain.connect(this.output);
    
    // Set initial mix (always 50/50 for echo, unlike delay)
    this.setWetDryMix();
  }
  
  setWetDryMix() {
    // For echo, we want both dry and wet signals
    this.wetGain.gain.setValueAtTime(this.outputGain, this.context.currentTime);
    this.dryGain.gain.setValueAtTime(this.inputGain, this.context.currentTime);
  }
  
  // Process audio with feedback routing
  processAudioWithFeedback() {
    // Create feedback path
    const feedbackGain = this.context.createGain();
    feedbackGain.gain.value = this.feedback;
    
    // Input -> taps
    for (let i = 0; i < this.delayTaps.length; i++) {
      if (this.pingPong && i % 2 === 1) {
        // Ping-pong: alternate taps go to opposite channels
        this.splitter.connect(this.delayTaps[i], 1);
      } else {
        this.splitter.connect(this.delayTaps[i], 0);
      }
      
      // Add feedback
      feedbackGain.connect(this.delayTaps[i]);
    }
    
    // Feedback connection
    this.wetGain.connect(feedbackGain);
  }
  
  // Calculate tempo-synced delay time
  getEffectiveDelayTime(globalBPM) {
    if (this.tempoSync && globalBPM > 0) {
      const beatDurationMs = (60 / globalBPM) * 1000;
      return beatDurationMs * (4 / this.noteDivision);
    }
    return this.baseDelayTime * 1000; // Convert to ms
  }
  
  // Parameter setters
  setDelayTime(time) {
    this.baseDelayTime = Math.max(0.001, Math.min(this.maxDelayTime, time / 1000));
    this.updateTapTimes();
    
    // Update LFO modulation depth based on delay time
    this.lfoGain.gain.value = this.modDepth * this.baseDelayTime * 0.1;
  }
  
  setFeedback(feedback) {
    this.feedback = Math.max(0, Math.min(0.99, feedback));
  }
  
  setInputGain(gain) {
    this.inputGain = Math.max(0, Math.min(2, gain));
    this.setWetDryMix();
  }
  
  setOutputGain(gain) {
    this.outputGain = Math.max(0, Math.min(2, gain));
    this.setWetDryMix();
  }
  
  setAdvancedMode(advanced) {
    this.advancedMode = advanced;
    if (!advanced) {
      // Reset to basic mode defaults
      this.setTaps(1);
      this.setModulation(0.5, 0, 'sine'); // No modulation in basic mode
      this.setPingPong(false);
      this.setFilter('none', 2000);
    }
  }
  
  setTaps(taps) {
    this.taps = Math.max(1, Math.min(8, taps));
    this.setupDelayTaps(this.taps);
  }
  
  setSpread(spread) {
    this.spread = Math.max(0, Math.min(1, spread));
    this.updateTapTimes();
  }
  
  setModulation(rate, depth, waveform) {
    this.modRate = Math.max(0.1, Math.min(10, rate));
    this.modDepth = Math.max(0, Math.min(1, depth));
    this.modWaveform = waveform;
    
    this.lfo.frequency.setValueAtTime(this.modRate, this.context.currentTime);
    this.lfo.type = this.modWaveform;
    this.lfoGain.gain.value = this.modDepth * this.baseDelayTime * 0.1;
  }
  
  setPingPong(pingPong) {
    this.pingPong = pingPong;
    this.connectTaps();
  }
  
  setFilter(type, frequency) {
    this.filterType = type;
    this.filterFreq = Math.max(20, Math.min(20000, frequency));
    
    this.tapFilters.forEach(filter => {
      filter.type = this.filterType === 'none' ? 'allpass' : this.filterType;
      filter.frequency.setValueAtTime(this.filterFreq, this.context.currentTime);
    });
  }
  
  setTempoSync(sync) {
    this.tempoSync = sync;
  }
  
  setNoteDivision(division) {
    this.noteDivision = division;
  }
  
  connect(destination) {
    this.output.connect(destination);
  }
  
  disconnect() {
    this.output.disconnect();
  }
}

/**
 * Enhanced echo processing function with advanced capabilities
 */
export async function processEchoRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = audioBuffer.sampleRate;
  const regionLength = endSample - startSample;
  
  // Calculate processing time with echo tails
  const maxDelayTime = (parameters.delay || 500) / 1000;
  const echoTailSamples = Math.floor(maxDelayTime * sampleRate * 10); // Allow for echo decay
  
  // Create offline context
  const totalLength = audioBuffer.length + echoTailSamples;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    totalLength,
    sampleRate
  );
  
  // Create source
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  
  // Create echo processor
  const echoProcessor = new AdvancedEchoProcessor(offlineContext);
  echoProcessor.setDelayTime(parameters.delay || 500);
  echoProcessor.setFeedback(parameters.feedback || 0.5);
  echoProcessor.setInputGain(parameters.inputGain || 1.0);
  echoProcessor.setOutputGain(parameters.outputGain || 1.0);
  
  // Set advanced parameters if in advanced mode
  if (parameters.advancedMode) {
    echoProcessor.setAdvancedMode(true);
    echoProcessor.setTaps(parameters.taps || 1);
    echoProcessor.setSpread(parameters.spread || 0.3);
    echoProcessor.setModulation(
      parameters.modRate || 0.5,
      parameters.modDepth || 0,
      parameters.modWaveform || 'sine'
    );
    echoProcessor.setPingPong(parameters.pingPong || false);
    echoProcessor.setFilter(parameters.filterType || 'none', parameters.filterFreq || 2000);
    echoProcessor.setTempoSync(parameters.tempoSync || false);
    echoProcessor.setNoteDivision(parameters.noteDivision || 4);
  }
  
  // Connect and process
  source.connect(echoProcessor.input);
  echoProcessor.processAudioWithFeedback();
  echoProcessor.connect(offlineContext.destination);
  
  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();
  
  // Create output buffer (trim to original length for UI purposes)
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );
  
  // Mix processed audio back to output
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const processedData = renderedBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);
    
    // Copy original audio
    outputData.set(inputData);
    
    // Mix processed region
    for (let i = 0; i < regionLength; i++) {
      const sampleIndex = startSample + i;
      if (sampleIndex < outputData.length && i < processedData.length) {
        // For echo, we replace the region with processed audio
        outputData[sampleIndex] = processedData[sampleIndex];
      }
    }
  }
  
  return outputBuffer;
}

/**
 * Enhanced Echo effect component with advanced mode
 * Backward compatible with simple interface, expandable to advanced features
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
    globalBPM,
    cutRegion
  } = useEffects();
  
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const canvasRef = useRef(null);
  const [advancedMode, setAdvancedMode] = useState(false);
  
  // Advanced mode parameters (only shown when advanced mode is enabled)
  const [echoTaps, setEchoTaps] = useState(1);
  const [echoSpread, setEchoSpread] = useState(0.3);
  const [echoModRate, setEchoModRate] = useState(0.5);
  const [echoModDepth, setEchoModDepth] = useState(0);
  const [echoModWaveform, setEchoModWaveform] = useState('sine');
  const [echoPingPong, setEchoPingPong] = useState(false);
  const [echoFilterType, setEchoFilterType] = useState('none');
  const [echoFilterFreq, setEchoFilterFreq] = useState(2000);
  const [echoTempoSync, setEchoTempoSync] = useState(false);
  const [echoNoteDivision, setEchoNoteDivision] = useState(4);
  
  // Initialize audio context and processor
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (!processorRef.current) {
      processorRef.current = new AdvancedEchoProcessor(audioContextRef.current);
    }
  }, []);
  
  // Update processor parameters
  useEffect(() => {
    if (processorRef.current) {
      processorRef.current.setDelayTime(getEffectiveDelayTime());
      processorRef.current.setFeedback(decay);
      processorRef.current.setInputGain(inGain);
      processorRef.current.setOutputGain(outGain);
      processorRef.current.setAdvancedMode(advancedMode);
      
      if (advancedMode) {
        processorRef.current.setTaps(echoTaps);
        processorRef.current.setSpread(echoSpread);
        processorRef.current.setModulation(echoModRate, echoModDepth, echoModWaveform);
        processorRef.current.setPingPong(echoPingPong);
        processorRef.current.setFilter(echoFilterType, echoFilterFreq);
        processorRef.current.setTempoSync(echoTempoSync);
        processorRef.current.setNoteDivision(echoNoteDivision);
      }
    }
  }, [delay, decay, inGain, outGain, advancedMode, echoTaps, echoSpread, echoModRate,
      echoModDepth, echoModWaveform, echoPingPong, echoFilterType, echoFilterFreq,
      echoTempoSync, echoNoteDivision, globalBPM]);
  
  // Calculate tempo-synced delay time
  const getEffectiveDelayTime = () => {
    if (echoTempoSync && globalBPM > 0) {
      const beatDurationMs = (60 / globalBPM) * 1000;
      return beatDurationMs * (4 / echoNoteDivision);
    }
    return delay;
  };
  
  // Draw echo visualization
  const drawVisualization = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    const delayTime = getEffectiveDelayTime();
    const maxTime = 2000; // ms
    
    // Draw echo taps
    const displayTaps = advancedMode ? echoTaps : 1;
    for (let i = 0; i < displayTaps; i++) {
      const tapIndex = i + 1;
      let tapTime;
      
      if (!advancedMode || echoSpread === 0 || displayTaps === 1) {
        tapTime = delayTime;
      } else {
        const spreadRange = delayTime * echoSpread;
        tapTime = delayTime + (tapIndex - 1) * (spreadRange / (displayTaps - 1 || 1));
      }
      
      const x = (tapTime / maxTime) * width;
      const tapHeight = (1 - (i / displayTaps)) * height * 0.8 * decay;
      
      // Draw echo tap
      ctx.strokeStyle = echoPingPong && i % 2 === 1 ? '#7bafd4' : '#e75b5c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.lineTo(x, height - tapHeight);
      ctx.stroke();
      
      // Draw tap number if advanced mode
      if (advancedMode && displayTaps > 1) {
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.fillText(`${i + 1}`, x - 5, height - tapHeight - 5);
      }
    }
    
    // Draw modulation wave if enabled
    if (advancedMode && echoModDepth > 0) {
      ctx.strokeStyle = '#cbb677';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let x = 0; x < width; x++) {
        const t = (x / width) * 4 * Math.PI; // 2 cycles
        let y;
        
        switch (echoModWaveform) {
          case 'sine':
            y = Math.sin(t);
            break;
          case 'triangle':
            y = Math.asin(Math.sin(t)) * (2 / Math.PI);
            break;
          case 'square':
            y = Math.sign(Math.sin(t));
            break;
          case 'sawtooth':
            y = 2 * (t / (2 * Math.PI) - Math.floor(t / (2 * Math.PI) + 0.5));
            break;
          default:
            y = Math.sin(t);
        }
        
        y = (height / 2) + (y * echoModDepth * height / 6);
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
    }
    
    // Draw labels
    ctx.fillStyle = '#e75b5c';
    ctx.font = '12px monospace';
    ctx.fillText(`Time: ${delayTime.toFixed(0)}ms`, 10, 20);
    
    if (advancedMode) {
      ctx.fillText(`Taps: ${echoTaps}`, 10, 35);
      if (echoTempoSync) {
        ctx.fillStyle = '#7bafd4';
        ctx.fillText('SYNC', 10, 50);
      }
      if (echoPingPong) {
        ctx.fillStyle = '#cbb677';
        ctx.fillText('PING-PONG', 10, height - 25);
      }
      if (echoModDepth > 0) {
        ctx.fillStyle = '#cbb677';
        ctx.fillText(`Mod: ${echoModRate.toFixed(1)}Hz`, 10, height - 10);
      }
    }
    
  }, [delay, decay, advancedMode, echoTaps, echoSpread, echoModRate, echoModDepth,
      echoModWaveform, echoPingPong, echoTempoSync, echoNoteDivision, globalBPM]);
  
  // Update visualization
  useEffect(() => {
    drawVisualization();
  }, [drawVisualization]);
  
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
      
      // Build parameters object
      const parameters = {
        delay: getEffectiveDelayTime(),
        feedback: decay,
        inputGain: inGain,
        outputGain: outGain,
        advancedMode: advancedMode
      };
      
      // Add advanced parameters if enabled
      if (advancedMode) {
        Object.assign(parameters, {
          taps: echoTaps,
          spread: echoSpread,
          modRate: echoModRate,
          modDepth: echoModDepth,
          modWaveform: echoModWaveform,
          pingPong: echoPingPong,
          filterType: echoFilterType,
          filterFreq: echoFilterFreq,
          tempoSync: echoTempoSync,
          noteDivision: echoNoteDivision
        });
      }
      
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
      addToEditHistory(url, advancedMode ? 'Apply Advanced Echo' : 'Apply Echo', {
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
  }, [audioURL, addToEditHistory, wavesurferRef, cutRegion, delay, decay, inGain, outGain,
      advancedMode, echoTaps, echoSpread, echoModRate, echoModDepth, echoModWaveform,
      echoPingPong, echoFilterType, echoFilterFreq, echoTempoSync, echoNoteDivision, globalBPM]);
  
  const filterTypes = [
    { key: 'none', name: 'No Filter' },
    { key: 'lowpass', name: 'Low Pass' },
    { key: 'highpass', name: 'High Pass' },
    { key: 'bandpass', name: 'Band Pass' }
  ];
  
  const waveformTypes = [
    { key: 'sine', name: 'Sine' },
    { key: 'triangle', name: 'Triangle' },
    { key: 'square', name: 'Square' },
    { key: 'sawtooth', name: 'Sawtooth' }
  ];
  
  const noteValues = [
    { key: 1, name: 'Whole', symbol: '𝅝' },
    { key: 2, name: 'Half', symbol: '𝅗𝅥' },
    { key: 4, name: 'Quarter', symbol: '♩' },
    { key: 8, name: 'Eighth', symbol: '♫' },
    { key: 16, name: 'Sixteenth', symbol: '♬' }
  ];
  
  return (
    <Container fluid className="p-2">
      {/* Echo Visualization */}
      <Row className="mb-3">
        <Col xs={12}>
          <div className="bg-dark border border-secondary rounded position-relative">
            <canvas
              ref={canvasRef}
              width={400}
              height={120}
              style={{ width: '100%', height: '120px' }}
            />
            <div className="position-absolute top-0 right-0 p-2">
              <small className="text-muted">{advancedMode ? 'Multi-Tap Echo' : 'Echo Pattern'}</small>
            </div>
          </div>
        </Col>
      </Row>
      
      {/* Mode Toggle */}
      <Row className="mb-2">
        <Col xs={12} md={6}>
          <Form.Check
            type="switch"
            id="advanced-mode"
            label={`${advancedMode ? 'Advanced' : 'Basic'} Mode`}
            checked={advancedMode}
            onChange={(e) => setAdvancedMode(e.target.checked)}
            className="text-white"
          />
          <small className="text-muted">
            {advancedMode ? 'Multi-tap echo with modulation and filtering' : 'Simple echo with feedback'}
          </small>
        </Col>
        
        {advancedMode && (
          <Col xs={12} md={6} className="d-flex align-items-end">
            <Form.Check
              type="switch"
              id="tempo-sync"
              label="Tempo Sync"
              checked={echoTempoSync}
              onChange={(e) => setEchoTempoSync(e.target.checked)}
              className="text-white"
            />
          </Col>
        )}
      </Row>
      
      {/* Basic Controls - Always Visible */}
      <Row className="mb-2">
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={echoTempoSync ? echoNoteDivision : delay}
            onChange={echoTempoSync ? setEchoNoteDivision : setDelay}
            min={echoTempoSync ? 1 : 0.1}
            max={echoTempoSync ? 16 : 2000}
            step={echoTempoSync ? 1 : 1}
            label="Delay Time"
            displayValue={echoTempoSync ? 
              noteValues.find(n => n.key === echoNoteDivision)?.symbol || `1/${echoNoteDivision}` :
              `${delay.toFixed(0)}ms`}
            size={50}
            color="#e75b5c"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={decay}
            onChange={setDecay}
            min={0}
            max={0.99}
            step={0.01}
            label="Feedback"
            displayValue={`${Math.round(decay * 100)}%`}
            size={50}
            color="#cbb677"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={inGain}
            onChange={setInGain}
            min={0}
            max={2}
            step={0.01}
            label="Input Gain"
            displayValue={`${inGain.toFixed(2)}x`}
            size={50}
            color="#92ceaa"
          />
        </Col>
        
        <Col xs={6} sm={4} md={2}>
          <Knob
            value={outGain}
            onChange={setOutGain}
            min={0}
            max={2}
            step={0.01}
            label="Output Gain"
            displayValue={`${outGain.toFixed(2)}x`}
            size={50}
            color="#ffa500"
          />
        </Col>
      </Row>
      
      {/* Advanced Controls - Only Visible in Advanced Mode */}
      {advancedMode && (
        <>
          <Row className="mb-2">
            <Col xs={12} md={4}>
              <Form.Label className="text-white small">Filter Type</Form.Label>
              <Form.Select
                value={echoFilterType}
                onChange={(e) => setEchoFilterType(e.target.value)}
                className="bg-secondary text-white border-0"
              >
                {filterTypes.map(type => (
                  <option key={type.key} value={type.key}>{type.name}</option>
                ))}
              </Form.Select>
            </Col>
            
            <Col xs={12} md={4}>
              <Form.Label className="text-white small">Mod Waveform</Form.Label>
              <Form.Select
                value={echoModWaveform}
                onChange={(e) => setEchoModWaveform(e.target.value)}
                className="bg-secondary text-white border-0"
              >
                {waveformTypes.map(type => (
                  <option key={type.key} value={type.key}>{type.name}</option>
                ))}
              </Form.Select>
            </Col>
            
            <Col xs={12} md={4} className="d-flex align-items-end">
              <Form.Check
                type="switch"
                id="ping-pong"
                label="Ping-Pong"
                checked={echoPingPong}
                onChange={(e) => setEchoPingPong(e.target.checked)}
                className="text-white"
              />
            </Col>
          </Row>
          
          <Row className="mb-2">
            <Col xs={12}>
              <div className="text-white small mb-2">Advanced Parameters</div>
            </Col>
            
            <Col xs={6} sm={4} md={2}>
              <Knob
                value={echoTaps}
                onChange={setEchoTaps}
                min={1}
                max={8}
                step={1}
                label="Taps"
                displayValue={`${echoTaps}`}
                size={45}
                color="#7bafd4"
              />
            </Col>
            
            <Col xs={6} sm={4} md={2}>
              <Knob
                value={echoSpread}
                onChange={setEchoSpread}
                min={0}
                max={1}
                step={0.01}
                label="Spread"
                displayValue={`${Math.round(echoSpread * 100)}%`}
                size={45}
                color="#dda0dd"
              />
            </Col>
            
            <Col xs={6} sm={4} md={2}>
              <Knob
                value={echoModRate}
                onChange={setEchoModRate}
                min={0.1}
                max={10}
                step={0.1}
                label="Mod Rate"
                displayValue={`${echoModRate.toFixed(1)}Hz`}
                size={45}
                color="#cbb677"
              />
            </Col>
            
            <Col xs={6} sm={4} md={2}>
              <Knob
                value={echoModDepth}
                onChange={setEchoModDepth}
                min={0}
                max={1}
                step={0.01}
                label="Mod Depth"
                displayValue={`${Math.round(echoModDepth * 100)}%`}
                size={45}
                color="#dda0dd"
              />
            </Col>
            
            <Col xs={6} sm={4} md={2}>
              <Knob
                value={echoFilterFreq}
                onChange={setEchoFilterFreq}
                min={20}
                max={20000}
                step={10}
                label="Filter Freq"
                displayValue={echoFilterFreq >= 1000 ? `${(echoFilterFreq/1000).toFixed(1)}k` : `${echoFilterFreq}Hz`}
                size={45}
                color="#7bafd4"
                logarithmic={true}
                disabled={echoFilterType === 'none'}
              />
            </Col>
          </Row>
        </>
      )}
      
      {/* Apply Button */}
      <Row>
        <Col xs={12} sm={6} md={4} lg={3}>
          <Button
            size="sm"
            className="w-100"
            onClick={applyEcho}
          >
            Apply {advancedMode ? 'Advanced ' : ''}Echo to Region
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