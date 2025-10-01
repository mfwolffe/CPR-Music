// components/audio/DAW/Effects/Reverb.js
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardBody, Button, Form, Dropdown, Nav, Container, Row, Col, OverlayTrigger, Tooltip } from 'react-bootstrap';
import {
  useAudio,
  useEffects
} from '../../../../contexts/DAWProvider';
import { ReverbProcessor } from '../../../../lib/ReverbProcessor';
import { getPresetNames, impulseResponsePresets } from '../../../../lib/impulseResponses';
import Knob from '../../../Knob';

/**
 * Educational Tooltips
 */
const ReverbTooltips = {
  preset: "Choose from various space simulations. Small rooms for tight ambience, halls for grandeur, plates for vintage smoothness, chambers for natural space.",
  mix: "Balance between dry (original) and wet (reverb) signal. Lower values (10-30%) add subtle space, higher values (50-80%) create atmospheric effects.",
  preDelay: "Time before reverb begins. Simulates distance to reflective surfaces. 10-30ms adds clarity, 50-100ms creates depth, 100ms+ for special effects.",
  hiDamp: "Reduces high frequencies in reverb tail. Simulates air absorption. Higher values create darker, more natural reverb similar to real spaces.",
  loDamp: "Reduces low frequencies in reverb tail. Prevents muddiness. Use to tighten bass-heavy material or create clearer reverb.",
  earlyLate: "Balance between early reflections (clarity) and late reverb (ambience). Lower values emphasize room character, higher values emphasize spaciousness.",
  width: "Stereo spread of reverb. 100% is natural stereo, lower values narrow the image, higher values enhance width. Use with caution above 150%.",
  output: "Overall reverb output level. Use to match reverb level with dry signal. Values above 1.0x boost the effect, useful for ambient textures."
};

/**
 * Process reverb on an audio buffer region
 * Pure function - no React dependencies
 */
export async function processReverbRegion(audioBuffer, startSample, endSample, parameters) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const reverbProcessor = new ReverbProcessor(audioContext);
  
  // Apply parameters
  reverbProcessor.loadPreset(parameters.preset || 'mediumHall');
  reverbProcessor.setWetDryMix(parameters.wetMix || 0.3);
  reverbProcessor.setPreDelay(parameters.preDelay || 0);
  reverbProcessor.setOutputGain(parameters.outputGain || 1);
  reverbProcessor.setHighDamping(parameters.highDamp || 0.5);
  reverbProcessor.setLowDamping(parameters.lowDamp || 0.1);
  reverbProcessor.setStereoWidth(parameters.stereoWidth || 1);
  reverbProcessor.setEarlyLateBalance(parameters.earlyLate || 0.5);
  
  // Process the region
  const result = await reverbProcessor.processRegion(
    audioBuffer,
    startSample,
    endSample
  );
  
  // Create output buffer with processed region
  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length + result.tailLength,
    audioBuffer.sampleRate
  );
  
  // Copy audio with processed region
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);
    const processedData = result.buffer.getChannelData(channel);
    
    // Copy before region
    for (let i = 0; i < startSample; i++) {
      outputData[i] = inputData[i];
    }
    
    // Copy processed region (including tail)
    for (let i = 0; i < processedData.length; i++) {
      outputData[startSample + i] = processedData[i];
    }
    
    // Copy after region (shifted by tail length)
    for (let i = endSample; i < inputData.length; i++) {
      if (startSample + (i - startSample) + result.tailLength < outputData.length) {
        outputData[startSample + (i - startSample) + result.tailLength] = inputData[i];
      }
    }
  }
  
  return outputBuffer;
}

/**
 * Reverb effect component using Web Audio API
 */
export default function Reverb({ width }) {
  const {
    audioRef,
    wavesurferRef,
    addToEditHistory,
    audioURL
  } = useAudio();
  
  const {
    reverbPreset,
    setReverbPreset,
    reverbWetMix,
    setReverbWetMix,
    reverbPreDelay,
    setReverbPreDelay,
    reverbOutputGain,
    setReverbOutputGain,
    reverbHighDamp,
    setReverbHighDamp,
    reverbLowDamp,
    setReverbLowDamp,
    reverbEarlyLate,
    setReverbEarlyLate,
    reverbStereoWidth,
    setReverbStereoWidth,
    cutRegion
  } = useEffects();
  
  const reverbProcessorRef = useRef(null);
  const audioContextRef = useRef(null);
  
  // Initialize reverb processor (without real-time preview for now)
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (!reverbProcessorRef.current) {
      reverbProcessorRef.current = new ReverbProcessor(audioContextRef.current);
    }
  }, []);
  
  // Update reverb parameters
  useEffect(() => {
    if (reverbProcessorRef.current) {
      reverbProcessorRef.current.setWetDryMix(reverbWetMix);
      reverbProcessorRef.current.setPreDelay(reverbPreDelay);
      reverbProcessorRef.current.setOutputGain(reverbOutputGain);
      reverbProcessorRef.current.setHighDamping(reverbHighDamp);
      reverbProcessorRef.current.setLowDamping(reverbLowDamp);
      reverbProcessorRef.current.setStereoWidth(reverbStereoWidth);
      reverbProcessorRef.current.setEarlyLateBalance(reverbEarlyLate);
    }
  }, [reverbWetMix, reverbPreDelay, reverbOutputGain, reverbHighDamp, reverbLowDamp, reverbStereoWidth, reverbEarlyLate]);
  
  // Update preset and apply preset parameters to knobs
  useEffect(() => {
    if (reverbProcessorRef.current && reverbPreset) {
      reverbProcessorRef.current.loadPreset(reverbPreset);

      // Apply preset parameters to knobs
      const preset = impulseResponsePresets[reverbPreset];
      if (preset && preset.parameters) {
        setReverbWetMix(preset.parameters.wetMix);
        setReverbPreDelay(preset.parameters.preDelay);
        setReverbHighDamp(preset.parameters.highDamp);
        setReverbLowDamp(preset.parameters.lowDamp);
        setReverbEarlyLate(preset.parameters.earlyLate);
        setReverbStereoWidth(preset.parameters.stereoWidth);
        setReverbOutputGain(preset.parameters.outputGain);
      }
    }
  }, [reverbPreset, setReverbWetMix, setReverbPreDelay, setReverbHighDamp, setReverbLowDamp, setReverbEarlyLate, setReverbStereoWidth, setReverbOutputGain]);
  
  // Apply reverb permanently to selected region
  const applyReverb = useCallback(async () => {
    if (!cutRegion || !wavesurferRef.current) {
      alert('Please select a region first');
      return;
    }
    
    try {
      const wavesurfer = wavesurferRef.current;
      
      // Get the audio buffer from current audio
      const response = await fetch(audioURL);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      
      // Calculate sample positions
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(cutRegion.start * sampleRate);
      const endSample = Math.floor(cutRegion.end * sampleRate);
      
      // Use the exported processing function
      const parameters = {
        preset: reverbPreset,
        wetMix: reverbWetMix,
        preDelay: reverbPreDelay,
        outputGain: reverbOutputGain,
        highDamp: reverbHighDamp,
        lowDamp: reverbLowDamp,
        stereoWidth: reverbStereoWidth,
        earlyLate: reverbEarlyLate
      };
      
      const outputBuffer = await processReverbRegion(
        audioBuffer,
        startSample,
        endSample,
        parameters
      );
      
      // Convert buffer to blob
      const wav = await audioBufferToWav(outputBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      // Update audio and history
      addToEditHistory(url, 'Apply Reverb', {
        effect: 'reverb',
        parameters,
        region: { start: cutRegion.start, end: cutRegion.end }
      });
      
      // Load new audio
      await wavesurfer.load(url);
      
      // Clear region
      cutRegion.remove();
      
    } catch (error) {
      console.error('Error applying reverb:', error);
      alert('Error applying reverb. Please try again.');
    }
  }, [cutRegion, audioURL, addToEditHistory, wavesurferRef, reverbPreset, reverbWetMix, reverbPreDelay, reverbOutputGain, reverbHighDamp, reverbLowDamp, reverbStereoWidth, reverbEarlyLate]);
  
  const presetNames = getPresetNames();
  
  return (
    <Container fluid className="p-2">
      <Row className="text-center align-items-end">
        {/* Preset and Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Form.Label className="text-white small mb-1">Preset</Form.Label>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverbTooltips.preset}</Tooltip>}
          >
            <Dropdown
              onSelect={(eventKey) => setReverbPreset(eventKey)}
              size="sm"
            >
              <Dropdown.Toggle
                variant="secondary"
                size="sm"
                className="w-100"
              >
                {impulseResponsePresets[reverbPreset]?.name || 'Select Preset'}
              </Dropdown.Toggle>
              <Dropdown.Menu className="bg-daw-toolbars">
                {presetNames.map(key => (
                  <Dropdown.Item
                    key={key}
                    eventKey={key}
                    className="text-white"
                  >
                    {impulseResponsePresets[key].name}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          </OverlayTrigger>
        </Col>

        {/* Knobs */}
        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverbTooltips.mix}</Tooltip>}
          >
            <div>
              <Knob
                value={reverbWetMix}
                onChange={setReverbWetMix}
                min={0}
                max={1}
                label="Mix"
                displayValue={`${Math.round(reverbWetMix * 100)}%`}
                size={45}
                color="#92ce84"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverbTooltips.preDelay}</Tooltip>}
          >
            <div>
              <Knob
                value={reverbPreDelay}
                onChange={setReverbPreDelay}
                min={0}
                max={200}
                step={1}
                label="Pre-Dly"
                displayValue={`${reverbPreDelay}ms`}
                size={45}
                color="#7bafd4"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverbTooltips.hiDamp}</Tooltip>}
          >
            <div>
              <Knob
                value={reverbHighDamp}
                onChange={setReverbHighDamp}
                min={0}
                max={1}
                label="Hi Damp"
                displayValue={`${Math.round(reverbHighDamp * 100)}%`}
                size={45}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverbTooltips.loDamp}</Tooltip>}
          >
            <div>
              <Knob
                value={reverbLowDamp}
                onChange={setReverbLowDamp}
                min={0}
                max={1}
                label="Lo Damp"
                displayValue={`${Math.round(reverbLowDamp * 100)}%`}
                size={45}
                color="#cbb677"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverbTooltips.earlyLate}</Tooltip>}
          >
            <div>
              <Knob
                value={reverbEarlyLate}
                onChange={setReverbEarlyLate}
                min={0}
                max={1}
                label="E/L Mix"
                displayValue={`${Math.round(reverbEarlyLate * 100)}%`}
                size={45}
                color="#92ceaa"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverbTooltips.width}</Tooltip>}
          >
            <div>
              <Knob
                value={reverbStereoWidth}
                onChange={setReverbStereoWidth}
                min={0}
                max={2}
                label="Width"
                displayValue={`${Math.round(reverbStereoWidth * 100)}%`}
                size={45}
                color="#e75b5c"
              />
            </div>
          </OverlayTrigger>
        </Col>

        <Col xs={6} sm={4} md={2} lg={1}>
          <OverlayTrigger
            placement="top"
            delay={{ show: 1500, hide: 250 }}
            overlay={<Tooltip>{ReverbTooltips.output}</Tooltip>}
          >
            <div>
              <Knob
                value={reverbOutputGain}
                onChange={setReverbOutputGain}
                min={0}
                max={2}
                label="Output"
                displayValue={`${reverbOutputGain.toFixed(1)}x`}
                size={45}
                color="#92ceaa"
              />
            </div>
          </OverlayTrigger>
        </Col>
        
        {/* Apply Button */}
        <Col xs={12} sm={6} md={3} lg={2} className="mb-2">
          <Button
            size="sm"
            className="w-100"
            onClick={applyReverb}
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