'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardBody, Button, Form, Dropdown, Nav } from 'react-bootstrap';
import { 
  useAudio, 
  useEffects 
} from '../../../../contexts/DAWProvider';
import { ReverbProcessor } from '../../../../lib/ReverbProcessor';
import { getPresetNames, impulseResponsePresets } from '../../../../lib/impulseResponses';

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
  
  // Update preset
  useEffect(() => {
    if (reverbProcessorRef.current && reverbPreset) {
      reverbProcessorRef.current.loadPreset(reverbPreset);
    }
  }, [reverbPreset]);
  
  // Apply reverb permanently to selected region
  const applyReverb = useCallback(async () => {
    if (!cutRegion || !reverbProcessorRef.current || !wavesurferRef.current) {
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
      const duration = wavesurfer.getDuration();
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(cutRegion.start * sampleRate);
      const endSample = Math.floor(cutRegion.end * sampleRate);
      
      // Process the region
      const result = await reverbProcessorRef.current.processRegion(
        audioBuffer,
        startSample,
        endSample
      );
      
      // Create new buffer with processed region
      const outputBuffer = audioContextRef.current.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length + result.tailLength,
        sampleRate
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
      
      // Convert buffer to blob
      const wav = await audioBufferToWav(outputBuffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      
      // Update audio and history
      addToEditHistory(url, 'Apply Reverb', {
        effect: 'reverb',
        parameters: reverbProcessorRef.current.getParameters(),
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
  }, [cutRegion, audioURL, addToEditHistory, wavesurferRef]);
  
  const presetNames = getPresetNames();
  
  return (
    <Card id="reverb" style={{ width: `${width}%` }}>
      <CardHeader className="text-center text-white pt-1 pb-1 bg-daw-toolbars">
        <CardTitle className="pt-0 pb-0 mt-0 mb-0">Reverb</CardTitle>
      </CardHeader>
      <CardBody className="bg-dawcontrol text-white plr-0 pt-2 pb-0 w-100">
        {/* Preset Selector */}
        <div className="mb-2 px-2">
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
        </div>
        
        {/* Main Controls */}
        <div className="flex-even gap-0 mlr-a w-100 plr-0">
          {/* Wet/Dry Mix */}
          <div className="mb-0 pb-0 text-center">
            <input
              min={0}
              max={1}
              step={0.01}
              type="range"
              orient="vertical"
              className="mlr-auto"
              value={reverbWetMix}
              onChange={(e) => setReverbWetMix(parseFloat(e.target.value))}
            />
            <Form.Label className="d-block text-center mb-0">
              Mix<br/>
              <small>{Math.round(reverbWetMix * 100)}%</small>
            </Form.Label>
          </div>
          
          {/* Pre-Delay */}
          <div className="mb-0 pb-0 text-center">
            <input
              min={0}
              max={200}
              step={1}
              type="range"
              orient="vertical"
              className="mlr-auto"
              value={reverbPreDelay}
              onChange={(e) => setReverbPreDelay(parseFloat(e.target.value))}
            />
            <Form.Label className="d-block text-center mb-0">
              Pre-Dly<br/>
              <small>{reverbPreDelay}ms</small>
            </Form.Label>
          </div>
          
          {/* High Damping */}
          <div className="mb-0 pb-0 text-center">
            <input
              min={0}
              max={1}
              step={0.01}
              type="range"
              orient="vertical"
              className="mlr-auto"
              value={reverbHighDamp}
              onChange={(e) => setReverbHighDamp(parseFloat(e.target.value))}
            />
            <Form.Label className="d-block text-center mb-0">
              Hi Damp<br/>
              <small>{Math.round(reverbHighDamp * 100)}%</small>
            </Form.Label>
          </div>
          
          {/* Low Damping */}
          <div className="mb-0 pb-0 text-center">
            <input
              min={0}
              max={1}
              step={0.01}
              type="range"
              orient="vertical"
              className="mlr-auto"
              value={reverbLowDamp}
              onChange={(e) => setReverbLowDamp(parseFloat(e.target.value))}
            />
            <Form.Label className="d-block text-center mb-0">
              Lo Damp<br/>
              <small>{Math.round(reverbLowDamp * 100)}%</small>
            </Form.Label>
          </div>
        </div>
        
        {/* Secondary Controls */}
        <div className="flex-even gap-0 mlr-a w-100 plr-0 mt-2">
          {/* Early/Late */}
          <div className="mb-0 pb-0 text-center">
            <input
              min={0}
              max={1}
              step={0.01}
              type="range"
              orient="vertical"
              className="mlr-auto"
              value={reverbEarlyLate}
              onChange={(e) => setReverbEarlyLate(parseFloat(e.target.value))}
            />
            <Form.Label className="d-block text-center mb-0">
              E/L Mix<br/>
              <small>{Math.round(reverbEarlyLate * 100)}%</small>
            </Form.Label>
          </div>
          
          {/* Stereo Width */}
          <div className="mb-0 pb-0 text-center">
            <input
              min={0}
              max={2}
              step={0.01}
              type="range"
              orient="vertical"
              className="mlr-auto"
              value={reverbStereoWidth}
              onChange={(e) => setReverbStereoWidth(parseFloat(e.target.value))}
            />
            <Form.Label className="d-block text-center mb-0">
              Width<br/>
              <small>{Math.round(reverbStereoWidth * 100)}%</small>
            </Form.Label>
          </div>
          
          {/* Output Gain */}
          <div className="mb-0 pb-0 text-center">
            <input
              min={0}
              max={2}
              step={0.01}
              type="range"
              orient="vertical"
              className="mlr-auto"
              value={reverbOutputGain}
              onChange={(e) => setReverbOutputGain(parseFloat(e.target.value))}
            />
            <Form.Label className="d-block text-center mb-0">
              Output<br/>
              <small>{reverbOutputGain.toFixed(1)}x</small>
            </Form.Label>
          </div>
        </div>
        
        <div className="d-flex justify-content-end px-2">
          <Button
            size="sm"
            className="mb-2 mr-0 mt-1"
            onClick={applyReverb}
          >
            Apply to Region
          </Button>
        </div>
        
        <div className="px-2 pb-2">
          <small className="text-muted">
            Note: Real-time preview coming soon. Select a region and click Apply to hear the reverb.
          </small>
        </div>
      </CardBody>
    </Card>
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