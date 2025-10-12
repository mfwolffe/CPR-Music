'use client';

/**
 * SandboxSynth - A flexible synthesizer for the Instrument Sandbox
 * Supports oscillators, filters, envelopes, LFO, and effects
 */

class SandboxSynth {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.activeVoices = new Map(); // Map of voiceId -> voice object
    this.noteToVoices = new Map(); // Map of note -> Set of voiceIds
    this.voiceIdCounter = 0;

    // Master output
    this.masterGain = audioContext.createGain();
    this.masterGain.gain.value = 0.8;

    // Analyser for visualization
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    // Effects chain
    this.setupEffectsChain();

    // Default parameters
    this.params = {
      oscillatorType: 'sawtooth',
      filterCutoff: 8000,  // Higher default for better audibility
      filterResonance: 2,  // Lower default resonance
      attack: 0.01,
      decay: 0.1,
      sustain: 0.7,
      release: 0.3,
      detune: 0,
      lfoRate: 4,
      lfoAmount: 0,
      reverb: 0,
      delay: 0,
      distortion: 0
    };

    // LFO setup
    this.lfo = audioContext.createOscillator();
    this.lfoGain = audioContext.createGain();
    this.lfo.frequency.value = this.params.lfoRate;
    this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain);
    this.lfo.start();

    // Periodic cleanup to catch orphaned voices
    this.cleanupInterval = setInterval(() => {
      this.cleanupOrphanedVoices();
    }, 5000); // Every 5 seconds
  }

  cleanupOrphanedVoices() {
    const now = this.audioContext.currentTime;
    const maxAge = 10; // Voices older than 10 seconds are considered orphaned

    this.activeVoices.forEach((voice, voiceId) => {
      if (now - voice.startTime > maxAge) {
        console.warn(`[SandboxSynth] Cleaning orphaned voice ${voiceId} (age: ${now - voice.startTime}s)`);
        this.cleanupVoice(voiceId);
      }
    });

    // Log current voice count for debugging
    if (this.activeVoices.size > 0) {
      console.log(`[SandboxSynth] Active voices: ${this.activeVoices.size}`);
    }
  }

  setupEffectsChain() {
    // Distortion
    this.distortion = this.audioContext.createWaveShaper();
    this.distortion.curve = this.makeDistortionCurve(0);
    this.distortion.oversample = '4x';
    this.distortionGain = this.audioContext.createGain();
    this.distortionGain.gain.value = 0;

    // Delay
    this.delay = this.audioContext.createDelay(1);
    this.delay.delayTime.value = 0.25;
    this.delayFeedback = this.audioContext.createGain();
    this.delayFeedback.gain.value = 0.3;
    this.delayGain = this.audioContext.createGain();
    this.delayGain.gain.value = 0;

    // Connect delay feedback loop
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.delayGain);

    // Reverb (simple convolution reverb simulation using delays)
    this.reverbGain = this.audioContext.createGain();
    this.reverbGain.gain.value = 0;
    this.reverbDelays = [];
    const reverbDelayTimes = [0.0297, 0.0371, 0.0411, 0.0437, 0.050, 0.0650];

    reverbDelayTimes.forEach(time => {
      const delay = this.audioContext.createDelay(1);
      const feedback = this.audioContext.createGain();
      const gain = this.audioContext.createGain();

      delay.delayTime.value = time;
      feedback.gain.value = 0.5;
      gain.gain.value = 0.3;

      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(gain);
      gain.connect(this.reverbGain);

      this.reverbDelays.push({ delay, feedback, gain });
    });

    // Dry signal path
    this.dryGain = this.audioContext.createGain();
    this.dryGain.gain.value = 1;

    // Connect effects chain
    this.effectsInput = this.audioContext.createGain();

    // Dry path
    this.effectsInput.connect(this.dryGain);

    // Distortion path
    this.effectsInput.connect(this.distortion);
    this.distortion.connect(this.distortionGain);

    // Delay path
    this.effectsInput.connect(this.delay);

    // Reverb path
    this.effectsInput.connect(this.reverbDelays[0].delay);

    // All paths connect to master
    this.dryGain.connect(this.masterGain);
    this.distortionGain.connect(this.masterGain);
    this.delayGain.connect(this.masterGain);
    this.reverbGain.connect(this.masterGain);
  }

  makeDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }

    return curve;
  }

  connect(destination) {
    // Connect through analyser for visualization
    this.masterGain.connect(this.analyser);
    this.analyser.connect(destination);

    // Also connect directly for unaffected audio
    this.masterGain.connect(destination);
  }

  getAnalyser() {
    return this.analyser;
  }

  disconnect() {
    this.masterGain.disconnect();
    this.analyser.disconnect();
  }

  setVolume(value) {
    this.masterGain.gain.value = value;
  }

  updateParams(newParams) {
    this.params = { ...this.params, ...newParams };

    // Update LFO
    this.lfo.frequency.value = this.params.lfoRate;
    this.lfoGain.gain.value = this.params.lfoAmount / 100;

    // Update effects levels
    this.distortionGain.gain.value = this.params.distortion / 100;
    this.delayGain.gain.value = this.params.delay / 100;
    this.reverbGain.gain.value = this.params.reverb / 100;

    // Update distortion curve
    if (this.params.distortion > 0) {
      this.distortion.curve = this.makeDistortionCurve(this.params.distortion);
    }

    // Update dry/wet mix
    const totalWet = (this.params.distortion + this.params.delay + this.params.reverb) / 300;
    this.dryGain.gain.value = Math.max(0.3, 1 - totalWet);
  }

  midiToFrequency(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }

  playNote(midiNote, velocity, time = this.audioContext.currentTime) {
    // Voice limit to prevent memory issues
    const MAX_VOICES = 20;
    if (this.activeVoices.size >= MAX_VOICES) {
      console.warn(`[SandboxSynth] Voice limit reached (${MAX_VOICES}), cleaning oldest voices`);
      // Clean up oldest voices
      const sortedVoices = Array.from(this.activeVoices.entries())
        .sort((a, b) => a[1].startTime - b[1].startTime);
      const toRemove = sortedVoices.slice(0, 5); // Remove oldest 5
      toRemove.forEach(([id]) => this.cleanupVoice(id));
    }

    // Stop all existing instances of this note immediately
    this.stopNote(midiNote, time);

    const frequency = this.midiToFrequency(midiNote);
    const velocityGain = velocity / 127;
    const voiceId = ++this.voiceIdCounter;

    // Create voice
    const voice = {
      id: voiceId,
      note: midiNote,
      oscillator: null,
      filter: null,
      envelope: null,
      noteGain: null,
      startTime: time,
      cleanup: null // Track cleanup timeout
    };

    // Oscillator
    voice.oscillator = this.audioContext.createOscillator();
    voice.oscillator.type = this.params.oscillatorType;
    voice.oscillator.frequency.value = frequency;
    voice.oscillator.detune.value = this.params.detune;

    // Apply LFO to pitch
    if (this.params.lfoAmount > 0) {
      this.lfoGain.connect(voice.oscillator.frequency);
    }

    // Filter - with intelligent handling for different waveforms
    voice.filter = this.audioContext.createBiquadFilter();
    voice.filter.type = 'lowpass';

    // For sine and triangle waves, open up the filter more or bypass if cutoff is low
    let effectiveCutoff = this.params.filterCutoff;
    let effectiveResonance = this.params.filterResonance;

    if (this.params.oscillatorType === 'sine') {
      // Sine waves: ensure filter doesn't cut fundamental
      effectiveCutoff = Math.max(this.params.filterCutoff, frequency * 2, 8000);
      effectiveResonance = Math.min(this.params.filterResonance, 1); // Reduce resonance for sine
    } else if (this.params.oscillatorType === 'triangle') {
      // Triangle waves: need some harmonics but not as aggressive filtering
      effectiveCutoff = Math.max(this.params.filterCutoff, frequency * 3, 4000);
      effectiveResonance = Math.min(this.params.filterResonance, 3);
    }

    voice.filter.frequency.value = effectiveCutoff;
    voice.filter.Q.value = effectiveResonance;

    // Envelope
    voice.envelope = this.audioContext.createGain();
    voice.envelope.gain.value = 0;

    // Note gain (for velocity) - with waveform compensation
    voice.noteGain = this.audioContext.createGain();

    // Gain compensation for different waveforms
    let gainCompensation = 1.0;
    if (this.params.oscillatorType === 'sine') {
      gainCompensation = 1.5; // Sine waves need more gain
    } else if (this.params.oscillatorType === 'triangle') {
      gainCompensation = 1.3; // Triangle waves need some gain boost
    }

    voice.noteGain.gain.value = velocityGain * gainCompensation;

    // Connect voice chain
    voice.oscillator.connect(voice.filter);
    voice.filter.connect(voice.envelope);
    voice.envelope.connect(voice.noteGain);
    voice.noteGain.connect(this.effectsInput);

    // Apply ADSR envelope
    const now = time;
    const attackEnd = now + this.params.attack;
    const decayEnd = attackEnd + this.params.decay;

    voice.envelope.gain.setValueAtTime(0, now);
    voice.envelope.gain.linearRampToValueAtTime(1, attackEnd);
    voice.envelope.gain.linearRampToValueAtTime(this.params.sustain, decayEnd);

    // Start oscillator
    voice.oscillator.start(time);

    // Store voice with unique ID
    this.activeVoices.set(voiceId, voice);

    // Track voice ID by note
    if (!this.noteToVoices.has(midiNote)) {
      this.noteToVoices.set(midiNote, new Set());
    }
    this.noteToVoices.get(midiNote).add(voiceId);

    console.log(`[SandboxSynth] Started voice ${voiceId} for note ${midiNote}`);

    return voice;
  }

  stopNote(midiNote, time = this.audioContext.currentTime) {
    const voiceIds = this.noteToVoices.get(midiNote);
    if (!voiceIds || voiceIds.size === 0) return;

    // Stop all voices for this note
    voiceIds.forEach(voiceId => {
      const voice = this.activeVoices.get(voiceId);
      if (!voice) return;

      console.log(`[SandboxSynth] Stopping voice ${voiceId} for note ${midiNote}`);

      // Clear any existing cleanup timeout
      if (voice.cleanup) {
        clearTimeout(voice.cleanup);
        voice.cleanup = null;
      }

      try {
        // Apply release envelope
        const releaseTime = time + this.params.release;
        voice.envelope.gain.cancelScheduledValues(time);
        const currentGain = voice.envelope.gain.value;
        voice.envelope.gain.setValueAtTime(currentGain, time);
        voice.envelope.gain.linearRampToValueAtTime(0, releaseTime);

        // Stop oscillator after release
        voice.oscillator.stop(releaseTime);

        // Disconnect LFO if it was connected
        if (this.params.lfoAmount > 0) {
          try {
            this.lfoGain.disconnect(voice.oscillator.frequency);
          } catch (e) {
            // Ignore if already disconnected
          }
        }

        // Schedule cleanup
        voice.cleanup = setTimeout(() => {
          this.cleanupVoice(voiceId);
        }, (this.params.release + 0.1) * 1000);

      } catch (error) {
        console.error(`[SandboxSynth] Error stopping voice ${voiceId}:`, error);
        // Force immediate cleanup on error
        this.cleanupVoice(voiceId);
      }
    });
  }

  cleanupVoice(voiceId) {
    const voice = this.activeVoices.get(voiceId);
    if (!voice) return;

    console.log(`[SandboxSynth] Cleaning up voice ${voiceId}`);

    // Clear timeout if exists
    if (voice.cleanup) {
      clearTimeout(voice.cleanup);
      voice.cleanup = null;
    }

    // Disconnect all nodes
    try {
      voice.oscillator.disconnect();
      voice.filter.disconnect();
      voice.envelope.disconnect();
      voice.noteGain.disconnect();
    } catch (e) {
      // Ignore disconnection errors
    }

    // Remove from tracking
    this.activeVoices.delete(voiceId);

    // Remove from note tracking
    const voiceIds = this.noteToVoices.get(voice.note);
    if (voiceIds) {
      voiceIds.delete(voiceId);
      if (voiceIds.size === 0) {
        this.noteToVoices.delete(voice.note);
      }
    }
  }

  stopAllNotes(time = this.audioContext.currentTime) {
    // Stop all notes by iterating through noteToVoices
    const notes = Array.from(this.noteToVoices.keys());
    notes.forEach(note => {
      this.stopNote(note, time);
    });
  }

  dispose() {
    // Clear periodic cleanup
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.stopAllNotes();
    this.lfo.stop();
    this.lfo.disconnect();
    this.lfoGain.disconnect();
    this.masterGain.disconnect();

    // Clean up effects
    this.distortion.disconnect();
    this.distortionGain.disconnect();
    this.delay.disconnect();
    this.delayFeedback.disconnect();
    this.delayGain.disconnect();
    this.reverbGain.disconnect();

    this.reverbDelays.forEach(({ delay, feedback, gain }) => {
      delay.disconnect();
      feedback.disconnect();
      gain.disconnect();
    });

    this.dryGain.disconnect();
    this.effectsInput.disconnect();
  }
}

export default SandboxSynth;