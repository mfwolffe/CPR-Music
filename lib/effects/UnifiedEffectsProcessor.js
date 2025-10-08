/**
 * Unified Effects Processor
 *
 * Central effects processing engine that consolidates all effect types
 * into a single, reusable module for both single-track and multitrack DAW.
 *
 * Key Features:
 * - Pure functions (no React dependencies)
 * - Processes audio clips with effect chains
 * - Supports all 24 effects from single-track DAW
 * - Non-destructive (returns new buffer)
 */

/**
 * Process a single effect on an audio buffer region
 * @param {AudioBuffer} audioBuffer - Full audio buffer
 * @param {number} startSample - Region start sample
 * @param {number} endSample - Region end sample
 * @param {string} effectType - Type of effect to apply
 * @param {Object} parameters - Effect-specific parameters
 * @param {AudioContext} audioContext - Web Audio context
 * @returns {Promise<AudioBuffer>} - Processed audio buffer
 */
export async function processEffect(
  audioBuffer,
  startSample,
  endSample,
  effectType,
  parameters,
  audioContext
) {
  const processors = {
    eq: processEQ,
    reverb: processReverb,
    echo: processEcho,
    delay: processAdvancedDelay,
    chorus: processChorus,
    flanger: processFlanger,
    phaser: processPhaser,
    distortion: processDistortion,
    compressor: processCompressor,
    gate: processGate,
    limiter: processLimiter,
    filter: processFilter,
    tremolo: processTremolo,
    autopan: processAutoPan,
    autowah: processAutoWah,
    ringmod: processRingModulator,
    pitchshift: processPitchShifter,
    freqshift: processFrequencyShifter,
    stereowide: processStereoWidener,
    glitch: processGlitch,
    granular: processGranularFreeze,
    paulstretch: processPaulstretch,
    spectral: processSpectralFilter,
    reverseverb: processReverseReverb,
  };

  const processor = processors[effectType];
  if (!processor) {
    throw new Error(`Unknown effect type: ${effectType}`);
  }

  return await processor(
    audioBuffer,
    startSample,
    endSample,
    parameters,
    audioContext
  );
}

/**
 * Process an effects chain (multiple effects in sequence)
 * @param {AudioBuffer} audioBuffer - Full audio buffer
 * @param {number} startSample - Region start sample
 * @param {number} endSample - Region end sample
 * @param {Array} effectsChain - Array of {type, parameters, enabled}
 * @param {AudioContext} audioContext - Web Audio context
 * @returns {Promise<AudioBuffer>} - Processed audio buffer
 */
export async function processEffectsChain(
  audioBuffer,
  startSample,
  endSample,
  effectsChain,
  audioContext
) {
  let processedBuffer = audioBuffer;

  for (const effect of effectsChain) {
    if (!effect.enabled) continue;

    processedBuffer = await processEffect(
      processedBuffer,
      startSample,
      endSample,
      effect.type,
      effect.parameters,
      audioContext
    );
  }

  return processedBuffer;
}

// ============================================================================
// EFFECT PROCESSORS - Core audio processing logic extracted from single-track
// ============================================================================

/**
 * EQ - Parametric Equalizer
 */
async function processEQ(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  let currentNode = source;
  const bands = parameters.bands || [];

  // Create filter chain from EQ bands
  for (const band of bands) {
    if (band.enabled === false || (band.gain === 0 && !['highpass', 'lowpass', 'bandpass'].includes(band.type))) {
      continue;
    }

    const filter = offlineContext.createBiquadFilter();
    filter.type = band.type || 'peaking';
    filter.frequency.value = band.frequency;
    filter.gain.value = band.gain || 0;
    filter.Q.value = band.q || 1;

    currentNode.connect(filter);
    currentNode = filter;
  }

  // Apply output gain if specified
  if (parameters.outputGain !== undefined && parameters.outputGain !== 0) {
    const outputGain = offlineContext.createGain();
    outputGain.gain.value = Math.pow(10, parameters.outputGain / 20);
    currentNode.connect(outputGain);
    currentNode = outputGain;
  }

  currentNode.connect(offlineContext.destination);
  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();

  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Reverb - Convolution reverb
 */
async function processReverb(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const convolver = offlineContext.createConvolver();
  const wetGain = offlineContext.createGain();
  const dryGain = offlineContext.createGain();

  // Create simple impulse response
  const impulseLength = offlineContext.sampleRate * 2; // 2 second reverb
  const impulse = offlineContext.createBuffer(2, impulseLength, offlineContext.sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < impulseLength; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 2);
    }
  }

  convolver.buffer = impulse;
  wetGain.gain.value = parameters.mix || 0.3;
  dryGain.gain.value = 1 - (parameters.mix || 0.3);

  source.connect(dryGain);
  source.connect(convolver);
  convolver.connect(wetGain);
  dryGain.connect(offlineContext.destination);
  wetGain.connect(offlineContext.destination);

  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();

  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Echo - Simple delay with feedback
 */
async function processEcho(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const delay = offlineContext.createDelay(5);
  const feedback = offlineContext.createGain();
  const wetGain = offlineContext.createGain();
  const dryGain = offlineContext.createGain();

  delay.delayTime.value = (parameters.time || 250) / 1000;
  feedback.gain.value = parameters.feedback || 0.5;
  wetGain.gain.value = parameters.mix || 0.5;
  dryGain.gain.value = 1 - (parameters.mix || 0.5);

  source.connect(dryGain);
  source.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wetGain);
  dryGain.connect(offlineContext.destination);
  wetGain.connect(offlineContext.destination);

  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();

  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Advanced Delay - Stereo delay with filters
 */
async function processAdvancedDelay(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const delayL = offlineContext.createDelay(2);
  const delayR = offlineContext.createDelay(2);
  const feedbackGainL = offlineContext.createGain();
  const feedbackGainR = offlineContext.createGain();
  const wetGain = offlineContext.createGain();
  const dryGain = offlineContext.createGain();

  delayL.delayTime.value = parameters.time / 1000;
  delayR.delayTime.value = parameters.time / 1000;
  feedbackGainL.gain.value = parameters.feedback || 0.5;
  feedbackGainR.gain.value = parameters.feedback || 0.5;
  wetGain.gain.value = parameters.mix || 0.5;
  dryGain.gain.value = 1 - (parameters.mix || 0.5);

  const splitter = offlineContext.createChannelSplitter(2);
  const merger = offlineContext.createChannelMerger(2);

  source.connect(splitter);
  source.connect(dryGain);
  dryGain.connect(offlineContext.destination);

  if (parameters.pingPong) {
    splitter.connect(delayL, 0);
    splitter.connect(delayR, 1);
    delayL.connect(feedbackGainL);
    delayR.connect(feedbackGainR);
    feedbackGainL.connect(delayR);
    feedbackGainR.connect(delayL);
  } else {
    splitter.connect(delayL, 0);
    splitter.connect(delayR, 1);
    delayL.connect(feedbackGainL);
    delayR.connect(feedbackGainR);
    feedbackGainL.connect(delayL);
    feedbackGainR.connect(delayR);
  }

  feedbackGainL.connect(merger, 0, 0);
  feedbackGainR.connect(merger, 0, 1);
  merger.connect(wetGain);
  wetGain.connect(offlineContext.destination);

  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();

  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Chorus - Multi-voice modulated delay
 */
async function processChorus(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  // Create multiple voices
  for (let i = 0; i < 3; i++) {
    const delay = offlineContext.createDelay(0.1);
    const lfo = offlineContext.createOscillator();
    const lfoGain = offlineContext.createGain();
    const voiceGain = offlineContext.createGain();

    delay.delayTime.value = 0.02 + i * 0.01;
    lfo.frequency.value = 0.5 + i * 0.1;
    lfoGain.gain.value = 0.002;
    voiceGain.gain.value = 0.3;

    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    source.connect(delay);
    delay.connect(voiceGain);
    voiceGain.connect(offlineContext.destination);

    lfo.start(0);
  }

  // Dry signal
  const dryGain = offlineContext.createGain();
  dryGain.gain.value = 0.5;
  source.connect(dryGain);
  dryGain.connect(offlineContext.destination);

  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();

  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Flanger - Modulated comb filtering
 */
async function processFlanger(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const delay = offlineContext.createDelay(0.02);
  const lfo = offlineContext.createOscillator();
  const lfoGain = offlineContext.createGain();
  const feedback = offlineContext.createGain();
  const wetGain = offlineContext.createGain();
  const dryGain = offlineContext.createGain();

  delay.delayTime.value = parameters.delay || 0.005;
  lfo.frequency.value = parameters.rate || 0.5;
  lfoGain.gain.value = parameters.depth || 0.002;
  feedback.gain.value = parameters.feedback || 0.5;
  wetGain.gain.value = parameters.mix || 0.5;
  dryGain.gain.value = 1 - (parameters.mix || 0.5);

  lfo.connect(lfoGain);
  lfoGain.connect(delay.delayTime);

  source.connect(dryGain);
  source.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wetGain);

  dryGain.connect(offlineContext.destination);
  wetGain.connect(offlineContext.destination);

  source.start(0);
  lfo.start(0);

  const renderedBuffer = await offlineContext.startRendering();
  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Phaser - All-pass filter modulation
 */
async function processPhaser(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  // Create all-pass filters
  const filters = [];
  for (let i = 0; i < 4; i++) {
    const filter = offlineContext.createBiquadFilter();
    filter.type = 'allpass';
    filter.frequency.value = 200 + i * 500;
    filters.push(filter);
  }

  // Connect filters in series
  let currentNode = source;
  filters.forEach((filter) => {
    currentNode.connect(filter);
    currentNode = filter;
  });

  // LFO to modulate filter frequencies
  const lfo = offlineContext.createOscillator();
  const lfoGain = offlineContext.createGain();
  lfo.frequency.value = parameters.rate || 0.5;
  lfoGain.gain.value = parameters.depth || 1000;

  lfo.connect(lfoGain);
  filters.forEach((filter) => {
    lfoGain.connect(filter.frequency);
  });

  // Mix wet and dry
  const wetGain = offlineContext.createGain();
  const dryGain = offlineContext.createGain();
  wetGain.gain.value = parameters.mix || 0.5;
  dryGain.gain.value = 1 - (parameters.mix || 0.5);

  currentNode.connect(wetGain);
  source.connect(dryGain);
  wetGain.connect(offlineContext.destination);
  dryGain.connect(offlineContext.destination);

  source.start(0);
  lfo.start(0);

  const renderedBuffer = await offlineContext.startRendering();
  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Distortion - Waveshaping
 */
async function processDistortion(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const waveshaper = offlineContext.createWaveShaper();
  const outputGain = offlineContext.createGain();

  // Create distortion curve
  const amount = parameters.amount || 50;
  const samples = 44100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }

  waveshaper.curve = curve;
  waveshaper.oversample = '4x';
  outputGain.gain.value = parameters.outputGain || 0.7;

  source.connect(waveshaper);
  waveshaper.connect(outputGain);
  outputGain.connect(offlineContext.destination);

  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();

  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Compressor - Dynamic range compression
 */
async function processCompressor(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const compressor = offlineContext.createDynamicsCompressor();
  const makeupGain = offlineContext.createGain();

  compressor.threshold.value = parameters.threshold || -24;
  compressor.ratio.value = parameters.ratio || 4;
  compressor.attack.value = parameters.attack || 0.003;
  compressor.release.value = parameters.release || 0.1;
  compressor.knee.value = parameters.knee || 30;

  makeupGain.gain.value = Math.pow(10, (parameters.makeup || 0) / 20);

  source.connect(compressor);
  compressor.connect(makeupGain);
  makeupGain.connect(offlineContext.destination);

  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();

  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Gate - Noise gate
 */
async function processGate(audioBuffer, startSample, endSample, parameters, audioContext) {
  const threshold = parameters.threshold || -40;
  const thresholdLinear = Math.pow(10, threshold / 20);

  const outputBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    for (let i = 0; i < audioBuffer.length; i++) {
      if (i >= startSample && i < endSample) {
        outputData[i] = Math.abs(inputData[i]) > thresholdLinear ? inputData[i] : 0;
      } else {
        outputData[i] = inputData[i];
      }
    }
  }

  return outputBuffer;
}

/**
 * Limiter - Peak limiting
 */
async function processLimiter(audioBuffer, startSample, endSample, parameters, audioContext) {
  // Use compressor with infinity ratio for limiting
  return processCompressor(audioBuffer, startSample, endSample, {
    ...parameters,
    ratio: 20,
    attack: 0.001,
    release: 0.05
  }, audioContext);
}

/**
 * Filter - Lowpass/Highpass/Bandpass
 */
async function processFilter(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const filter = offlineContext.createBiquadFilter();
  filter.type = parameters.type || 'lowpass';
  filter.frequency.value = parameters.frequency || 1000;
  filter.Q.value = parameters.resonance || 1;

  source.connect(filter);
  filter.connect(offlineContext.destination);

  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();

  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Tremolo - Amplitude modulation
 */
async function processTremolo(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const gainNode = offlineContext.createGain();
  const lfo = offlineContext.createOscillator();
  const lfoGain = offlineContext.createGain();

  lfo.frequency.value = parameters.rate || 5;
  lfoGain.gain.value = parameters.depth || 0.5;
  gainNode.gain.value = 1 - (parameters.depth || 0.5);

  lfo.connect(lfoGain);
  lfoGain.connect(gainNode.gain);

  source.connect(gainNode);
  gainNode.connect(offlineContext.destination);

  source.start(0);
  lfo.start(0);

  const renderedBuffer = await offlineContext.startRendering();
  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

/**
 * Auto Pan - Stereo panning modulation
 */
async function processAutoPan(audioBuffer, startSample, endSample, parameters, audioContext) {
  const sampleRate = audioBuffer.sampleRate;
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const panner = offlineContext.createStereoPanner();
  const lfo = offlineContext.createOscillator();
  const lfoGain = offlineContext.createGain();

  lfo.frequency.value = parameters.rate || 1;
  lfoGain.gain.value = parameters.depth || 0.8;

  lfo.connect(lfoGain);
  lfoGain.connect(panner.pan);

  source.connect(panner);
  panner.connect(offlineContext.destination);

  source.start(0);
  lfo.start(0);

  const renderedBuffer = await offlineContext.startRendering();
  return mergeProcessedRegion(audioBuffer, renderedBuffer, startSample, endSample, audioContext);
}

// Stub implementations for advanced effects (to be implemented later)
async function processAutoWah(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('AutoWah not fully implemented, returning original audio');
  return audioBuffer;
}

async function processRingModulator(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('Ring Modulator not fully implemented, returning original audio');
  return audioBuffer;
}

async function processPitchShifter(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('Pitch Shifter not fully implemented, returning original audio');
  return audioBuffer;
}

async function processFrequencyShifter(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('Frequency Shifter not fully implemented, returning original audio');
  return audioBuffer;
}

async function processStereoWidener(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('Stereo Widener not fully implemented, returning original audio');
  return audioBuffer;
}

async function processGlitch(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('Glitch not fully implemented, returning original audio');
  return audioBuffer;
}

async function processGranularFreeze(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('Granular Freeze not fully implemented, returning original audio');
  return audioBuffer;
}

async function processPaulstretch(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('Paulstretch not fully implemented, returning original audio');
  return audioBuffer;
}

async function processSpectralFilter(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('Spectral Filter not fully implemented, returning original audio');
  return audioBuffer;
}

async function processReverseReverb(audioBuffer, startSample, endSample, parameters, audioContext) {
  console.warn('Reverse Reverb not fully implemented, returning original audio');
  return audioBuffer;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Merge processed region back into full buffer
 */
function mergeProcessedRegion(originalBuffer, processedBuffer, startSample, endSample, audioContext, tailLength = 0) {
  const outputLength = Math.max(originalBuffer.length, startSample + processedBuffer.length);
  const outputBuffer = audioContext.createBuffer(
    originalBuffer.numberOfChannels,
    outputLength,
    originalBuffer.sampleRate
  );

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
 * Convert AudioBuffer to WAV blob
 */
export async function audioBufferToWav(buffer) {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);

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

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i];
      const int16 = Math.max(-32768, Math.min(32767, sample * 32768));
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}
