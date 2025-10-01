// components/audio/DAW/Multitrack/AudioContextManager.js
'use client';

/**
 * Singleton AudioContextManager to ensure we only have one AudioContext
 * This prevents timing issues and improves performance
 */
class AudioContextManager {
  constructor() {
    this.audioContext = null;
    this.initialized = false;
    this.startTime = 0;
  }

  /**
   * Get or create the shared AudioContext
   */
  getContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      this.startTime = this.audioContext.currentTime;
      this.initialized = true;
    }

    // Resume if suspended (happens on some browsers)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    return this.audioContext;
  }

  /**
   * Get current time relative to start
   */
  getCurrentTime() {
    if (!this.audioContext) return 0;
    return this.audioContext.currentTime - this.startTime;
  }

  /**
   * Schedule a function to run at a specific audio time
   * More accurate than setTimeout for audio scheduling
   */
  scheduleAtTime(callback, audioTime) {
    const context = this.getContext();
    const now = context.currentTime;
    const delay = Math.max(0, audioTime - now);

    if (delay === 0) {
      callback();
    } else {
      // Use a combination of setTimeout and AudioContext time for accuracy
      const timeoutDelay = Math.max(0, (delay - 0.025) * 1000); // 25ms early

      setTimeout(() => {
        // Fine-tune with busy-wait for last few milliseconds
        const checkTime = () => {
          if (context.currentTime >= audioTime) {
            callback();
          } else if (audioTime - context.currentTime < 0.05) {
            // Busy wait for last 50ms for precision
            requestAnimationFrame(checkTime);
          } else {
            // Still too early, check again
            setTimeout(checkTime, 10);
          }
        };
        checkTime();
      }, timeoutDelay);
    }
  }

  /**
   * Create a gain node for volume control
   */
  createGain() {
    const context = this.getContext();
    return context.createGain();
  }

  /**
   * Create a stereo panner
   */
  createStereoPanner() {
    const context = this.getContext();
    return context.createStereoPanner();
  }

  /**
   * Get the destination (speakers)
   */
  getDestination() {
    const context = this.getContext();
    return context.destination;
  }

  /**
   * Clean up (rarely needed)
   */
  dispose() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
      this.initialized = false;
    }
  }
}

// Export singleton instance
const audioContextManager = new AudioContextManager();
export default audioContextManager;
