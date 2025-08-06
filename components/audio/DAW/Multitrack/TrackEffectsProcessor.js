// components/audio/DAW/Multitrack/TrackEffectsProcessor.js

/**
 * TrackEffectsProcessor - Adapter for using single-track effects in multitrack
 * 
 * This processor extracts the core audio processing logic from existing effects
 * without their React dependencies or context manipulation
 */

class TrackEffectsProcessor {
  /**
   * Process a region with any effect from the single-track DAW
   * @param {AudioBuffer} inputBuffer - The full track audio
   * @param {number} startTime - Region start in seconds
   * @param {number} endTime - Region end in seconds
   * @param {string} effectType - Type of effect to apply
   * @param {Object} parameters - Effect parameters
   * @param {AudioContext} audioContext - Web Audio context
   * @returns {Promise<AudioBuffer>} - Full buffer with processed region
   */
  static async processRegion(inputBuffer, startTime, endTime, effectType, parameters, audioContext) {
    const sampleRate = inputBuffer.sampleRate;
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(endTime * sampleRate);
    
    // Map of effect types to their processing logic
    const effectProcessors = {
      'reverb': this.processReverb,
      'echo': this.processEcho,
      'delay': this.processAdvancedDelay,
      'chorus': this.processChorus,
      'flanger': this.processFlanger,
      'phaser': this.processPhaser,
      'distortion': this.processDistortion,
      'autowah': this.processAutoWah,
      'ringmod': this.processRingModulator,
      'tremolo': this.processTremolo,
      'autopan': this.processAutoPan,
      'pitch': this.processPitchShifter,
      'freqshift': this.processFrequencyShifter,
      'stereo': this.processStereoWidener,
      'glitch': this.processGlitch,
      'granular': this.processGranularFreeze,
      'paulstretch': this.processPaulstretch,
      'spectral': this.processSpectralFilter,
      'reverseverb': this.processReverseReverb,
      'compressor': this.processCompressor,
      'gate': this.processGate,
      'eq': this.processEQ
    };

    const processor = effectProcessors[effectType];
    if (!processor) {
      throw new Error(`Unknown effect type: ${effectType}`);
    }

    // Process the region using the existing effect logic
    return await processor.call(this, inputBuffer, startSample, endSample, parameters, audioContext);
  }

  /**
   * Extract reverb processing from existing Reverb.js
   */
  static async processReverb(audioBuffer, startSample, endSample, parameters, audioContext) {
    const { ReverbProcessor } = await import('../../../../lib/ReverbProcessor');
    const reverbProcessor = new ReverbProcessor(audioContext);
    
    // Apply parameters
    reverbProcessor.loadPreset(parameters.preset || 'mediumHall');
    reverbProcessor.setWetDryMix(parameters.wetMix || 0.3);
    reverbProcessor.setPreDelay(parameters.preDelay || 0);
    reverbProcessor.setOutputGain(parameters.outputGain || 1);
    
    // Process the region
    const result = await reverbProcessor.processRegion(
      audioBuffer,
      startSample,
      endSample
    );
    
    return this.mergeProcessedRegion(audioBuffer, result.buffer, startSample, endSample, result.tailLength);
  }

  /**
   * Extract delay processing from existing AdvancedDelay.js
   */
  static async processAdvancedDelay(audioBuffer, startSample, endSample, parameters, audioContext) {
    const regionLength = endSample - startSample;
    const sampleRate = audioBuffer.sampleRate;
    
    // Calculate delay parameters
    const delaySamples = Math.floor((parameters.time / 1000) * sampleRate);
    const maxDelayTaps = 10;
    const totalLength = audioBuffer.length + (delaySamples * maxDelayTaps);
    
    // Create offline context
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      totalLength,
      sampleRate
    );
    
    // This mirrors the logic from AdvancedDelay.js
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    
    const delayL = offlineContext.createDelay(2);
    const delayR = offlineContext.createDelay(2);
    const feedbackGainL = offlineContext.createGain();
    const feedbackGainR = offlineContext.createGain();
    const filterL = offlineContext.createBiquadFilter();
    const filterR = offlineContext.createBiquadFilter();
    const wetGain = offlineContext.createGain();
    const dryGain = offlineContext.createGain();
    
    // Apply parameters
    delayL.delayTime.value = parameters.time / 1000;
    delayR.delayTime.value = parameters.time / 1000;
    feedbackGainL.gain.value = parameters.feedback || 0.5;
    feedbackGainR.gain.value = parameters.feedback || 0.5;
    wetGain.gain.value = parameters.mix || 0.5;
    dryGain.gain.value = 1 - (parameters.mix || 0.5);
    
    filterL.type = parameters.filterType || 'lowpass';
    filterR.type = parameters.filterType || 'lowpass';
    filterL.frequency.value = parameters.filterFreq || 2000;
    filterR.frequency.value = parameters.filterFreq || 2000;
    
    // Connect nodes (simplified from original)
    const splitter = offlineContext.createChannelSplitter(2);
    const merger = offlineContext.createChannelMerger(2);
    
    source.connect(splitter);
    source.connect(dryGain);
    dryGain.connect(offlineContext.destination);
    
    if (parameters.pingPong) {
      // Ping-pong routing
      splitter.connect(delayL, 0);
      splitter.connect(delayR, 1);
      delayL.connect(filterL);
      delayR.connect(filterR);
      filterL.connect(feedbackGainL);
      filterR.connect(feedbackGainR);
      feedbackGainL.connect(delayR);
      feedbackGainR.connect(delayL);
    } else {
      // Standard routing
      splitter.connect(delayL, 0);
      splitter.connect(delayR, 1);
      delayL.connect(filterL);
      delayR.connect(filterR);
      filterL.connect(feedbackGainL);
      filterR.connect(feedbackGainR);
      feedbackGainL.connect(delayL);
      feedbackGainR.connect(delayR);
    }
    
    filterL.connect(merger, 0, 0);
    filterR.connect(merger, 0, 1);
    merger.connect(wetGain);
    wetGain.connect(offlineContext.destination);
    
    source.start(0);
    const renderedBuffer = await offlineContext.startRendering();
    
    return this.mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, 0);
  }

  /**
   * Extract EQ processing from existing EQ.js
   */
  static async processEQ(audioBuffer, startSample, endSample, parameters, audioContext) {
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    
    // Create filter chain from parameters
    let currentNode = source;
    const bands = parameters.bands || [
      { frequency: 100, gain: 0 },
      { frequency: 250, gain: 0 },
      { frequency: 500, gain: 0 },
      { frequency: 1000, gain: 0 },
      { frequency: 2000, gain: 0 },
      { frequency: 4000, gain: 0 },
      { frequency: 8000, gain: 0 },
      { frequency: 16000, gain: 0 }
    ];
    
    bands.forEach(band => {
      const filter = offlineContext.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = band.frequency;
      filter.gain.value = band.gain;
      filter.Q.value = 1;
      
      currentNode.connect(filter);
      currentNode = filter;
    });
    
    currentNode.connect(offlineContext.destination);
    source.start(0);
    
    const renderedBuffer = await offlineContext.startRendering();
    return this.mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, 0);
  }

  /**
   * Helper: Merge processed region back into full buffer
   */
  static mergeProcessedRegion(originalBuffer, processedBuffer, startSample, endSample, tailLength = 0) {
    const outputLength = Math.max(originalBuffer.length, startSample + processedBuffer.length);
    const outputBuffer = new AudioBuffer({
      numberOfChannels: originalBuffer.numberOfChannels,
      length: outputLength,
      sampleRate: originalBuffer.sampleRate
    });
    
    for (let channel = 0; channel < originalBuffer.numberOfChannels; channel++) {
      const originalData = originalBuffer.getChannelData(channel);
      const processedData = processedBuffer.getChannelData(channel);
      const outputData = outputBuffer.getChannelData(channel);
      
      // Copy before region
      for (let i = 0; i < startSample; i++) {
        outputData[i] = originalData[i];
      }
      
      // Copy processed region
      for (let i = 0; i < processedData.length && startSample + i < outputLength; i++) {
        outputData[startSample + i] = processedData[i];
      }
      
      // Copy after region (if needed)
      const afterStart = Math.max(endSample, startSample + processedData.length);
      for (let i = afterStart; i < originalData.length; i++) {
        if (i < outputLength) {
          outputData[i] = originalData[i];
        }
      }
    }
    
    return outputBuffer;
  }

  /**
   * Convert AudioBuffer to WAV blob (reused from effects)
   */
  static async audioBufferToWav(buffer) {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    
    // Write WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, length - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, buffer.numberOfChannels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * 2 * buffer.numberOfChannels, true);
    view.setUint16(32, buffer.numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length - 44, true);
    
    // Write audio data
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const sample = buffer.getChannelData(channel)[i];
        const int16 = Math.max(-32768, Math.min(32767, sample * 32768));
        view.setInt16(offset, int16, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  // Add more effect processors as needed...
  // We'll implement these by extracting the core logic from each effect component
}

export default TrackEffectsProcessor;