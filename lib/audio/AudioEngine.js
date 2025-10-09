/**
 * AudioEngine - Core audio processing and playback engine
 * Handles audio loading, decoding, and playback using Web Audio API
 */

export class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.audioBuffer = null;
    this.sourceNode = null;
    this.gainNode = null;

    // Playback state
    this.isPlaying = false;
    this.pausedAt = 0;
    this.startedAt = 0;
    this.playbackRate = 1.0;

    // Callbacks
    this.onTimeUpdate = null;
    this.onEnded = null;
    this.onError = null;
  }

  /**
   * Initialize audio context (call this on user interaction)
   */
  async init() {
    if (this.audioContext) return;

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);

    // Resume context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Load and decode audio from URL or Blob
   */
  async loadAudio(urlOrBlob) {
    try {
      await this.init();

      // Stop current playback if any
      this.stop();

      let arrayBuffer;

      if (urlOrBlob instanceof Blob) {
        arrayBuffer = await urlOrBlob.arrayBuffer();
      } else if (typeof urlOrBlob === 'string') {
        const response = await fetch(urlOrBlob);
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.statusText}`);
        }
        arrayBuffer = await response.arrayBuffer();
      } else {
        throw new Error('Invalid audio source');
      }

      // Decode audio data
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      return {
        duration: this.audioBuffer.duration,
        sampleRate: this.audioBuffer.sampleRate,
        numberOfChannels: this.audioBuffer.numberOfChannels,
        length: this.audioBuffer.length
      };
    } catch (error) {
      console.error('Error loading audio:', error);
      if (this.onError) this.onError(error);
      throw error;
    }
  }

  /**
   * Get audio buffer for processing
   */
  getAudioBuffer() {
    return this.audioBuffer;
  }

  /**
   * Play audio from specific time
   */
  play(startTime = 0) {
    if (!this.audioBuffer) {
      console.warn('No audio loaded');
      return;
    }

    if (this.isPlaying) {
      this.stop();
    }

    // Create new source node
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.playbackRate.value = this.playbackRate;
    this.sourceNode.connect(this.gainNode);

    // Set up ended handler
    this.sourceNode.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.pausedAt = this.audioBuffer.duration;
        if (this.onEnded) this.onEnded();
      }
    };

    // Start playback
    const offset = startTime || this.pausedAt;
    this.sourceNode.start(0, offset);
    this.startedAt = this.audioContext.currentTime - offset;
    this.isPlaying = true;
    this.pausedAt = 0;

    // Start time update loop
    this.startTimeUpdateLoop();
  }

  /**
   * Pause audio playback
   */
  pause() {
    if (!this.isPlaying) return;

    this.pausedAt = this.getCurrentTime();
    this.stop();
  }

  /**
   * Stop audio playback
   */
  stop() {
    if (this.sourceNode) {
      this.sourceNode.onended = null;
      try {
        this.sourceNode.stop();
      } catch (e) {
        // Already stopped
      }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    this.isPlaying = false;
    this.stopTimeUpdateLoop();
  }

  /**
   * Seek to specific time
   */
  seek(time) {
    const wasPlaying = this.isPlaying;

    if (wasPlaying) {
      this.stop();
    }

    this.pausedAt = Math.max(0, Math.min(time, this.audioBuffer?.duration || 0));

    if (wasPlaying) {
      this.play();
    }
  }

  /**
   * Get current playback time
   */
  getCurrentTime() {
    if (!this.audioBuffer) return 0;

    if (this.isPlaying && this.audioContext) {
      const elapsed = (this.audioContext.currentTime - this.startedAt) * this.playbackRate;
      return Math.min(elapsed, this.audioBuffer.duration);
    }

    return this.pausedAt;
  }

  /**
   * Get duration
   */
  getDuration() {
    return this.audioBuffer?.duration || 0;
  }

  /**
   * Set playback rate
   */
  setPlaybackRate(rate) {
    this.playbackRate = rate;

    if (this.sourceNode) {
      this.sourceNode.playbackRate.value = rate;
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Start time update loop
   */
  startTimeUpdateLoop() {
    const update = () => {
      if (!this.isPlaying) return;

      if (this.onTimeUpdate) {
        this.onTimeUpdate(this.getCurrentTime());
      }

      this.timeUpdateFrame = requestAnimationFrame(update);
    };

    update();
  }

  /**
   * Stop time update loop
   */
  stopTimeUpdateLoop() {
    if (this.timeUpdateFrame) {
      cancelAnimationFrame(this.timeUpdateFrame);
      this.timeUpdateFrame = null;
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stop();

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.audioBuffer = null;
    this.onTimeUpdate = null;
    this.onEnded = null;
    this.onError = null;
  }
}