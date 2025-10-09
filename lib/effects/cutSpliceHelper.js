/**
 * Helper functions for cutting and splicing audio regions
 * Works with WaveformContext's audioBuffer
 */

/**
 * Cut/delete a region from the audio buffer
 * @param {AudioBuffer} audioBuffer - The original audio buffer
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {AudioContext} audioContext - Optional AudioContext to use for creating new buffer
 * @returns {AudioBuffer} New audio buffer with region removed
 */
export function cutRegionFromBuffer(audioBuffer, startTime, endTime, audioContext = null) {
  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;

  // Calculate sample positions
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);

  // Calculate new buffer length (original minus cut region)
  const cutLength = endSample - startSample;
  const newLength = audioBuffer.length - cutLength;

  // Use provided context or create new one (fallback for backward compatibility)
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Create new buffer
  const newBuffer = audioContext.createBuffer(
    numberOfChannels,
    newLength,
    sampleRate
  );

  // Copy audio data, skipping the cut region
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const originalData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);

    // Copy before cut region
    for (let i = 0; i < startSample; i++) {
      newData[i] = originalData[i];
    }

    // Copy after cut region
    for (let i = endSample; i < audioBuffer.length; i++) {
      newData[i - cutLength] = originalData[i];
    }
  }

  return newBuffer;
}

/**
 * Splice/excise - keep only the selected region
 * @param {AudioBuffer} audioBuffer - The original audio buffer
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {AudioContext} audioContext - Optional AudioContext to use for creating new buffer
 * @returns {AudioBuffer} New audio buffer with only the selected region
 */
export function spliceRegionFromBuffer(audioBuffer, startTime, endTime, audioContext = null) {
  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;

  // Calculate sample positions
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);

  // Calculate new buffer length (just the selected region)
  const newLength = endSample - startSample;

  // Use provided context or create new one (fallback for backward compatibility)
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Create new buffer
  const newBuffer = audioContext.createBuffer(
    numberOfChannels,
    newLength,
    sampleRate
  );

  // Copy only the selected region
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const originalData = audioBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);

    // Copy selected region
    for (let i = 0; i < newLength; i++) {
      newData[i] = originalData[startSample + i];
    }
  }

  return newBuffer;
}

/**
 * Process region for effects - replaces the region with processed audio
 * @param {AudioBuffer} originalBuffer - The original audio buffer
 * @param {AudioBuffer} processedBuffer - The processed region buffer
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {AudioContext} audioContext - Optional AudioContext to use for creating new buffer
 * @returns {AudioBuffer} New audio buffer with processed region replaced
 */
export function replaceRegionInBuffer(originalBuffer, processedBuffer, startTime, endTime, audioContext = null) {
  const sampleRate = originalBuffer.sampleRate;
  const numberOfChannels = originalBuffer.numberOfChannels;

  // Calculate sample positions
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);
  const regionLength = endSample - startSample;

  console.log('replaceRegionInBuffer called:');
  console.log('- startTime:', startTime, 'endTime:', endTime);
  console.log('- startSample:', startSample, 'endSample:', endSample);
  console.log('- regionLength:', regionLength);
  console.log('- processedBuffer.length:', processedBuffer.length);
  console.log('- originalBuffer.length:', originalBuffer.length);

  // Use provided context or fallback to global/new context (backward compatibility)
  if (!audioContext) {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (window.globalAudioContext) {
      audioContext = window.globalAudioContext;
    } else {
      audioContext = new AudioContextConstructor();
      window.globalAudioContext = audioContext;
    }
  }

  console.log('Using AudioContext:', audioContext === originalBuffer.context ? 'same as original' : 'different');

  // Create new buffer (same length as original)
  const newBuffer = audioContext.createBuffer(
    numberOfChannels,
    originalBuffer.length,
    sampleRate
  );

  // First create clean Float32Arrays with the data
  const channelArrays = [];

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const originalData = originalBuffer.getChannelData(channel);
    const processedData = processedBuffer.getChannelData(Math.min(channel, processedBuffer.numberOfChannels - 1));

    // Create a new clean array
    const cleanData = new Float32Array(originalBuffer.length);

    // Copy before region
    for (let i = 0; i < startSample; i++) {
      cleanData[i] = originalData[i];
    }

    // Copy processed region
    const processedLength = Math.min(processedBuffer.length, regionLength);
    for (let i = 0; i < processedLength; i++) {
      if (startSample + i < cleanData.length) {
        cleanData[startSample + i] = processedData[i];
      }
    }

    // If processed is shorter, fill with silence
    for (let i = processedLength; i < regionLength; i++) {
      if (startSample + i < cleanData.length) {
        cleanData[startSample + i] = 0;
      }
    }

    // Copy after region
    for (let i = endSample; i < originalBuffer.length; i++) {
      cleanData[i] = originalData[i];
    }

    channelArrays.push(cleanData);
  }

  // Now copy the clean arrays to the AudioBuffer
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const newData = newBuffer.getChannelData(channel);
    const cleanData = channelArrays[channel];

    // Use set() method for better performance and to avoid corruption
    newData.set(cleanData);
  }

  // Debug: Check if the replacement worked
  const resultData = newBuffer.getChannelData(0);
  let resultSum = 0;
  let resultMax = 0;
  for (let i = startSample; i < Math.min(startSample + 10000, endSample); i++) {
    resultSum += resultData[i] * resultData[i];
    resultMax = Math.max(resultMax, Math.abs(resultData[i]));
  }
  const resultRMS = Math.sqrt(resultSum / Math.min(10000, endSample - startSample));
  console.log('Result buffer region RMS:', resultRMS);
  console.log('Result buffer region max amplitude:', resultMax);
  console.log('Result buffer region first 5 samples:', Array.from(resultData.slice(startSample, startSample + 5)));

  return newBuffer;
}