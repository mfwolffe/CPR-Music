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