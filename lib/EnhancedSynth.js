// lib/EnhancedSynth.js
'use client';

import WavetableSynth from './WavetableSynth';
import ADSREnvelope from './ADSREnvelope';

/**
 * Enhanced Synthesizer combining wavetables, ADSR, and velocity sensitivity
 * This is the main synthesis engine for MIDI tracks
 */
export class EnhancedSynth {
  constructor(audioContext, options = {}) {
    this.audioContext = audioContext;
    this.options = {
      maxVoices: 8,
      wavetable: 'sine',
      filterType: 'lowpass',
      filterFrequency: 2000,
      filterResonance: 1,
      velocitySensitivity: 0.8,
      ...options
    };
    
    // Create master output
    this.output = audioContext.createGain();
    this.output.gain.value = 0.7;
    
    // Voice management
    this.voices = new Map(); // midiNote -> voice object
    this.voiceCount = 0;
    
    // Get wavetable synth instance
    this.wavetableSynth = new WavetableSynth(audioContext, {
      maxVoices: this.options.maxVoices
    });
    
    console.log('EnhancedSynth: Initialized with wavetables:', this.wavetableSynth.getWavetableNames());
  }

  /**
   * Create a complete voice with wavetable, envelope, and filter
   */
  createVoice(midiNote, velocity, time, duration = null) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
    
    // Create oscillator with wavetable
    const osc = this.audioContext.createOscillator();
    const wavetable = this.options.wavetable || 'sine';
    
    // Set up wavetable
    const periodicWave = this.wavetableSynth.createPeriodicWave(wavetable);
    if (periodicWave) {
      osc.setPeriodicWave(periodicWave);
    } else {
      osc.type = this.getOscillatorType(wavetable);
    }
    
    osc.frequency.setValueAtTime(frequency, time);
    
    // Create filter with velocity-sensitive cutoff
    const filter = this.audioContext.createBiquadFilter();
    filter.type = this.options.filterType;
    
    // Velocity affects filter cutoff
    const baseCutoff = this.options.filterFrequency;
    const velocityMod = this.options.velocitySensitivity * velocity + (1 - this.options.velocitySensitivity);
    const cutoff = Math.min(20000, baseCutoff * velocityMod);
    
    filter.frequency.setValueAtTime(cutoff, time);
    filter.Q.setValueAtTime(this.options.filterResonance, time);
    
    // Create ADSR envelope
    const envelope = new ADSREnvelope(this.audioContext, {
      ...this.getEnvelopeSettings(wavetable),
      velocitySensitivity: this.options.velocitySensitivity
    });
    
    // Create voice object
    const voice = {
      oscillator: osc,
      filter: filter,
      envelope: envelope,
      midiNote: midiNote,
      velocity: velocity,
      startTime: time,
      frequency: frequency,
      wavetable: wavetable,
      isActive: true
    };
    
    // Connect audio chain: osc -> filter -> envelope -> output
    osc.connect(filter);
    filter.connect(envelope.input);
    envelope.connect(this.output);
    
    // Start envelope
    envelope.start(time, velocity, duration);
    
    // Start oscillator
    osc.start(time);
    
    return voice;
  }

  /**
   * Get appropriate envelope settings for wavetable type
   */
  getEnvelopeSettings(wavetable) {
    const presets = {
      sine: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 },
      triangle: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 },
      sawtooth: { attack: 0.005, decay: 0.1, sustain: 0.6, release: 0.2 },
      square: { attack: 0.005, decay: 0.05, sustain: 0.5, release: 0.15 },
      organ: { attack: 0.01, decay: 0.05, sustain: 0.9, release: 0.1 },
      strings: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.4 },
      brass: { attack: 0.05, decay: 0.1, sustain: 0.7, release: 0.2 },
      pad: { attack: 0.3, decay: 0.2, sustain: 0.6, release: 1.0 },
      bell: { attack: 0.001, decay: 1.0, sustain: 0.3, release: 2.0 },
      pluck: { attack: 0.001, decay: 0.3, sustain: 0.1, release: 0.1 },
    };
    
    return presets[wavetable] || presets.sine;
  }

  /**
   * Fallback oscillator types for basic Web Audio API
   */
  getOscillatorType(wavetable) {
    const typeMap = {
      sine: 'sine',
      triangle: 'triangle',
      sawtooth: 'sawtooth',
      square: 'square',
      organ: 'sine',
      strings: 'sawtooth',
      brass: 'sawtooth',
      pad: 'triangle',
      bell: 'sine',
      pluck: 'sawtooth'
    };
    
    return typeMap[wavetable] || 'sine';
  }

  /**
   * Play a note
   */
  playNote(midiNote, velocity = 1, time = 0, duration = null) {
    time = time || this.audioContext.currentTime;
    
    // Stop existing note if playing
    if (this.voices.has(midiNote)) {
      this.stopNote(midiNote, time);
    }
    
    // Voice stealing if at limit
    if (this.voices.size >= this.options.maxVoices) {
      this.stealOldestVoice();
    }
    
    // Create and store voice
    const voice = this.createVoice(midiNote, velocity, time, duration);
    this.voices.set(midiNote, voice);
    
    console.log(`EnhancedSynth: Playing note ${midiNote} (${voice.frequency.toFixed(2)}Hz) with ${voice.wavetable} wavetable`);
    
    return voice;
  }

  /**
   * Stop a note
   */
  stopNote(midiNote, time = 0) {
    const voice = this.voices.get(midiNote);
    if (!voice || !voice.isActive) return;
    
    time = time || this.audioContext.currentTime;
    
    // Start envelope release
    voice.envelope.stop(time);
    voice.isActive = false;
    
    // Schedule cleanup after release
    const releaseTime = voice.envelope.release * 1000 + 100;
    setTimeout(() => {
      try {
        if (voice.oscillator && voice.oscillator.stop) {
          voice.oscillator.stop();
        }
      } catch (e) {
        // Oscillator might already be stopped
      }
      
      // Clean up connections
      this.disconnectVoice(voice);
      this.voices.delete(midiNote);
    }, releaseTime);
    
    console.log(`EnhancedSynth: Stopping note ${midiNote}`);
  }

  /**
   * Steal the oldest active voice
   */
  stealOldestVoice() {
    let oldestTime = Infinity;
    let oldestNote = null;
    
    for (const [midiNote, voice] of this.voices) {
      if (voice.startTime < oldestTime) {
        oldestTime = voice.startTime;
        oldestNote = midiNote;
      }
    }
    
    if (oldestNote !== null) {
      console.log(`EnhancedSynth: Stealing voice for note ${oldestNote}`);
      this.stopNote(oldestNote);
    }
  }

  /**
   * Disconnect voice from audio graph
   */
  disconnectVoice(voice) {
    try {
      voice.oscillator?.disconnect();
      voice.filter?.disconnect();
      voice.envelope?.disconnect();
    } catch (e) {
      // May already be disconnected
    }
  }

  /**
   * Stop all notes (panic)
   */
  stopAllNotes(time = 0) {
    const notesToStop = Array.from(this.voices.keys());
    for (const midiNote of notesToStop) {
      this.stopNote(midiNote, time);
    }
  }

  /**
   * Set wavetable type
   */
  setWavetable(wavetableName) {
    if (this.wavetableSynth.getWavetableNames().includes(wavetableName)) {
      this.options.wavetable = wavetableName;
      console.log(`EnhancedSynth: Switched to ${wavetableName} wavetable`);
    }
  }

  /**
   * Set filter parameters
   */
  setFilter(type, frequency, resonance) {
    this.options.filterType = type;
    this.options.filterFrequency = frequency;
    this.options.filterResonance = resonance;
    
    // Update active voices
    for (const voice of this.voices.values()) {
      if (voice.filter) {
        voice.filter.type = type;
        voice.filter.frequency.value = frequency;
        voice.filter.Q.value = resonance;
      }
    }
  }

  /**
   * Set velocity sensitivity
   */
  setVelocitySensitivity(sensitivity) {
    this.options.velocitySensitivity = Math.max(0, Math.min(1, sensitivity));
  }

  /**
   * Connect to destination
   */
  connect(destination) {
    this.output.connect(destination);
  }

  /**
   * Disconnect from all destinations
   */
  disconnect() {
    this.output.disconnect();
  }

  /**
   * Dispose of synthesizer
   */
  dispose() {
    this.stopAllNotes();
    this.disconnect();
    this.wavetableSynth?.dispose();
    this.voices.clear();
  }

  /**
   * Get synthesis statistics
   */
  getStats() {
    return {
      activeVoices: this.voices.size,
      maxVoices: this.options.maxVoices,
      currentWavetable: this.options.wavetable,
      availableWavetables: this.wavetableSynth.getWavetableNames(),
    };
  }

  /**
   * Create instrument presets
   */
  static presets = {
    piano: {
      wavetable: 'sine',
      filterType: 'lowpass',
      filterFrequency: 3000,
      filterResonance: 0.5,
      velocitySensitivity: 0.9
    },
    organ: {
      wavetable: 'organ',
      filterType: 'lowpass', 
      filterFrequency: 4000,
      filterResonance: 0.3,
      velocitySensitivity: 0.5
    },
    strings: {
      wavetable: 'strings',
      filterType: 'lowpass',
      filterFrequency: 2500,
      filterResonance: 0.7,
      velocitySensitivity: 0.8
    },
    brass: {
      wavetable: 'brass',
      filterType: 'lowpass',
      filterFrequency: 3500,
      filterResonance: 1.2,
      velocitySensitivity: 0.9
    },
    pad: {
      wavetable: 'pad',
      filterType: 'lowpass',
      filterFrequency: 1500,
      filterResonance: 0.4,
      velocitySensitivity: 0.6
    },
    bell: {
      wavetable: 'bell',
      filterType: 'lowpass',
      filterFrequency: 5000,
      filterResonance: 0.8,
      velocitySensitivity: 1.0
    },
    pluck: {
      wavetable: 'pluck',
      filterType: 'lowpass',
      filterFrequency: 2000,
      filterResonance: 0.6,
      velocitySensitivity: 0.8
    }
  };

  /**
   * Apply a preset
   */
  applyPreset(presetName) {
    const preset = EnhancedSynth.presets[presetName];
    if (preset) {
      Object.assign(this.options, preset);
      console.log(`EnhancedSynth: Applied ${presetName} preset`);
    }
  }
}

export default EnhancedSynth;