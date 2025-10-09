/**
 * Utility functions for audio processing and blob management
 */

/**
 * Create a new blob URL from audio data
 * Properly manages memory by revoking old URLs
 */
export async function createAudioBlob(audioData, mimeType = 'audio/wav') {
  if (audioData instanceof Blob) {
    return URL.createObjectURL(audioData);
  } else if (audioData instanceof ArrayBuffer) {
    const blob = new Blob([audioData], { type: mimeType });
    return URL.createObjectURL(blob);
  } else if (typeof audioData === 'string') {
    // If it's already a URL, fetch and create new blob
    const response = await fetch(audioData);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }
  
  throw new Error('Invalid audio data type');
}

/**
 * Clone audio data to prevent mutation
 */
export async function cloneAudioData(audioData) {
  if (typeof audioData === 'string') {
    const response = await fetch(audioData);
    const blob = await response.blob();
    return blob;
  } else if (audioData instanceof Blob) {
    return new Blob([audioData], { type: audioData.type });
  } else if (audioData instanceof ArrayBuffer) {
    return audioData.slice(0);
  }
  
  throw new Error('Invalid audio data type for cloning');
}

/**
 * Debounce function to prevent rapid state changes
 */
export function debounce(func, wait) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Format time for display
 */
export function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get audio buffer from various sources
 */
export async function getAudioBuffer(audioContext, source) {
  if (source instanceof AudioBuffer) {
    return source;
  }

  let arrayBuffer;

  if (typeof source === 'string') {
    const response = await fetch(source);
    arrayBuffer = await response.arrayBuffer();
  } else if (source instanceof Blob) {
    arrayBuffer = await source.arrayBuffer();
  } else if (source instanceof ArrayBuffer) {
    arrayBuffer = source;
  } else {
    throw new Error('Invalid audio source type');
  }

  return await audioContext.decodeAudioData(arrayBuffer);
}

/**
 * Trim audio buffer to extract a segment
 * @param {AudioBuffer} audioBuffer - Source audio buffer
 * @param {number} startSec - Start time in seconds
 * @param {number} endSec - End time in seconds
 * @returns {AudioBuffer} - New audio buffer with trimmed audio
 */
export function trimAudioBuffer(audioContext, audioBuffer, startSec, endSec) {
  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;

  const startSample = Math.floor(startSec * sampleRate);
  const endSample = Math.floor(endSec * sampleRate);
  const duration = endSample - startSample;

  // Create new buffer for the trimmed segment
  const newBuffer = audioContext.createBuffer(
    numberOfChannels,
    duration,
    sampleRate
  );

  // Copy audio data for each channel
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const sourceData = audioBuffer.getChannelData(channel);
    const targetData = newBuffer.getChannelData(channel);

    for (let i = 0; i < duration; i++) {
      targetData[i] = sourceData[startSample + i] || 0;
    }
  }

  return newBuffer;
}

/**
 * Concatenate multiple audio buffers
 * @param {AudioContext} audioContext - Web Audio API context
 * @param {AudioBuffer[]} buffers - Array of audio buffers to concatenate
 * @returns {AudioBuffer} - New audio buffer with concatenated audio
 */
export function concatenateAudioBuffers(audioContext, buffers) {
  if (!buffers || buffers.length === 0) {
    throw new Error('No buffers provided');
  }

  const sampleRate = buffers[0].sampleRate;
  const numberOfChannels = buffers[0].numberOfChannels;

  // Calculate total length
  const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);

  // Create new buffer
  const newBuffer = audioContext.createBuffer(
    numberOfChannels,
    totalLength,
    sampleRate
  );

  // Copy data from each buffer
  let offset = 0;
  for (const buffer of buffers) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const targetData = newBuffer.getChannelData(channel);
      targetData.set(sourceData, offset);
    }
    offset += buffer.length;
  }

  return newBuffer;
}

/**
 * Delete a region from audio buffer (remove middle, splice ends)
 * @param {AudioContext} audioContext - Web Audio API context
 * @param {AudioBuffer} audioBuffer - Source audio buffer
 * @param {number} startSec - Start time of region to delete (seconds)
 * @param {number} endSec - End time of region to delete (seconds)
 * @returns {AudioBuffer} - New audio buffer with region removed
 */
export function deleteRegion(audioContext, audioBuffer, startSec, endSec) {
  const duration = audioBuffer.duration;
  const buffers = [];

  // Keep everything before the region
  if (startSec > 0) {
    buffers.push(trimAudioBuffer(audioContext, audioBuffer, 0, startSec));
  }

  // Keep everything after the region
  if (endSec < duration) {
    buffers.push(trimAudioBuffer(audioContext, audioBuffer, endSec, duration));
  }

  if (buffers.length === 0) {
    // If entire buffer was deleted, return silent buffer
    return audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      1,
      audioBuffer.sampleRate
    );
  }

  return concatenateAudioBuffers(audioContext, buffers);
}

/**
 * Excise a region from audio buffer (keep only selection)
 * @param {AudioContext} audioContext - Web Audio API context
 * @param {AudioBuffer} audioBuffer - Source audio buffer
 * @param {number} startSec - Start time of region to keep (seconds)
 * @param {number} endSec - End time of region to keep (seconds)
 * @returns {AudioBuffer} - New audio buffer with only the selected region
 */
export function exciseRegion(audioContext, audioBuffer, startSec, endSec) {
  return trimAudioBuffer(audioContext, audioBuffer, startSec, endSec);
}

/**
 * Convert AudioBuffer to WAV blob
 * @param {AudioBuffer} audioBuffer - Audio buffer to convert
 * @returns {Blob} - WAV file blob
 */
export function audioBufferToWav(audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  const data = new Float32Array(audioBuffer.length * numberOfChannels);

  // Interleave channels
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = audioBuffer.getChannelData(channel)[i];
      data[i * numberOfChannels + channel] = sample;
    }
  }

  const dataLength = data.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // Write WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  // Write audio data
  let offset = 44;
  for (let i = 0; i < data.length; i++) {
    let sample = data[i];

    // Flush denormalized values to zero
    if (Math.abs(sample) < 1e-30) {
      sample = 0;
    }

    // Clamp and convert to 16-bit
    sample = Math.max(-1, Math.min(1, sample));
    const int16 = Math.round(sample * 0x7FFF);
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}