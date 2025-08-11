// components/audio/DAW/Multitrack/instruments/WebAudioInstruments.js

/**
 * playNote returns a handle (voice object); stopNote accepts either a handle (to stop one voice) or a time (to stop all voices for the note).
 */
'use client';

/**
 * Collection of Web Audio instruments for MIDI playback
 * Updated to accept external AudioContext for better performance
 */

// Base instrument class
class BaseInstrument {
  constructor(audioContext) {
    this.audioContext = audioContext; // Use provided context
    // Map<midiNote, Set<Voice>>; each Voice is an object with nodes/params
    this.activeNotes = new Map();
    this.output = audioContext.createGain();
    this.output.gain.value = 0.8;
  }

  connect(destination) {
    this.output.connect(destination);
  }

  disconnect() {
    this.output.disconnect();
  }

  // Must be implemented by subclasses
  playNote(midiNote, velocity, time) {
    throw new Error('playNote must be implemented');
  }

  stopNote(midiNote, time) {
    throw new Error('stopNote must be implemented');
  }

  stopAllNotes(time = this.audioContext.currentTime) {
    this.activeNotes.forEach((voices, midiNote) => {
      if (!voices) return;
      // Stop all voices for this note at the given time
      this.stopNote(midiNote, time);
    });
  }

  dispose() {
    this.stopAllNotes();
    this.disconnect();
  }
}

// Simple Subtractive Synthesizer
export class SubtractiveSynth extends BaseInstrument {
  constructor(audioContext, preset = 'default') {
    super(audioContext);

    // Preset configurations
    this.presets = {
      default: {
        oscillatorType: 'sawtooth',
        filterFrequency: 2000,
        filterResonance: 5,
        attack: 0.01,
        decay: 0.1,
        sustain: 0.7,
        release: 0.3,
        detune: 0,
      },
      bass: {
        oscillatorType: 'sawtooth',
        filterFrequency: 800,
        filterResonance: 10,
        attack: 0.01,
        decay: 0.2,
        sustain: 0.8,
        release: 0.1,
        detune: 5,
      },
      lead: {
        oscillatorType: 'square',
        filterFrequency: 3000,
        filterResonance: 15,
        attack: 0.005,
        decay: 0.1,
        sustain: 0.6,
        release: 0.5,
        detune: 8,
      },
      pad: {
        oscillatorType: 'sawtooth',
        filterFrequency: 1500,
        filterResonance: 2,
        attack: 0.8,
        decay: 0.3,
        sustain: 0.7,
        release: 1.5,
        detune: 12,
      },
      pluck: {
        oscillatorType: 'triangle',
        filterFrequency: 4000,
        filterResonance: 5,
        attack: 0.001,
        decay: 0.3,
        sustain: 0.0,
        release: 0.5,
        detune: 0,
      },
    };

    this.setPreset(preset);
  }

  setPreset(presetName) {
    this.config = this.presets[presetName] || this.presets.default;
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    // Support overlapping voices of the same note; no auto-stop here

    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    // Create oscillators (2 for detune effect)
    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    osc1.type = this.config.oscillatorType;
    osc2.type = this.config.oscillatorType;
    osc1.frequency.value = frequency;
    osc2.frequency.value = frequency;
    osc2.detune.value = this.config.detune;

    // Create filter
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.config.filterFrequency;
    filter.Q.value = this.config.filterResonance;

    // Create envelope
    const envelope = this.audioContext.createGain();
    envelope.gain.value = 0;

    // Connect nodes
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.output);

    // Apply ADSR envelope
    const attackTime = time + this.config.attack;
    const decayTime = attackTime + this.config.decay;
    const sustainLevel = velocity * this.config.sustain * 0.3;
    const peakLevel = velocity * 0.3;

    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(peakLevel, attackTime);
    envelope.gain.exponentialRampToValueAtTime(sustainLevel + 0.001, decayTime);

    // Start oscillators
    osc1.start(time);
    osc2.start(time);

    const voice = {
      oscillators: [osc1, osc2],
      envelope,
      filter,
      sustainLevel,
      startTime: time,
      release: this.config.release,
    };
    let set = this.activeNotes.get(midiNote);
    if (!set) {
      set = new Set();
      this.activeNotes.set(midiNote, set);
    }
    set.add(voice);
    return voice; // handle
  }

  stopNote(midiNote, handleOrTime = this.audioContext.currentTime) {
    const voices = this.activeNotes.get(midiNote);
    if (!voices || voices.size === 0) return;

    const stopVoice = (voice, when) => {
      const { oscillators, envelope, release = this.config.release } = voice;
      envelope.gain.cancelScheduledValues(when);
      envelope.gain.setValueAtTime(envelope.gain.value, when);
      envelope.gain.exponentialRampToValueAtTime(0.001, when + release);
      oscillators.forEach((osc) => {
        try {
          osc.stop(when + release);
        } catch {}
      });
      setTimeout(
        () => {
          voices.delete(voice);
          if (voices.size === 0) this.activeNotes.delete(midiNote);
        },
        (release + 0.1) * 1000,
      );
    };

    if (typeof handleOrTime === 'object' && handleOrTime) {
      // Treat as a handle → stop just this voice now
      stopVoice(handleOrTime, this.audioContext.currentTime);
    } else {
      // Treat as a time number → stop all voices for this note at that time
      const when = Number(handleOrTime) || this.audioContext.currentTime;
      Array.from(voices).forEach((v) => stopVoice(v, when));
    }
  }
}

// Drum Sampler
export class DrumSampler extends BaseInstrument {
  constructor(audioContext) {
    super(audioContext);
    this.samples = new Map();
    this.loadDefaultKit();
  }

  async loadDefaultKit() {
    // Define the drum mapping for white keys
    // We'll map based on pitch class (C, D, E, F, G, A, B)
    this.drumMapping = {
      0: { name: 'kick', type: 'kick' }, // C (any octave)
      2: { name: 'snare', type: 'snare' }, // D
      4: { name: 'hihat', type: 'hihat' }, // E
      5: { name: 'openhat', type: 'openhat' }, // F
      7: { name: 'crash', type: 'crash' }, // G
      9: { name: 'ride', type: 'ride' }, // A
      11: { name: 'kick', type: 'kick' }, // B (duplicate kick)
    };
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    // Get the note class (0-11) regardless of octave
    const noteClass = midiNote % 12;

    // Check if this note class maps to a drum
    const drumConfig = this.drumMapping[noteClass];
    if (!drumConfig) return; // Not a white key

    // Play the corresponding drum sound
    switch (drumConfig.type) {
      case 'kick':
        this.playKick(velocity, time);
        break;
      case 'snare':
        this.playSnare(velocity, time);
        break;
      case 'hihat':
        this.playHihat(velocity, time);
        break;
      case 'openhat':
        this.playOpenhat(velocity, time);
        break;
      case 'crash':
        this.playCrash(velocity, time);
        break;
      case 'ride':
        this.playRide(velocity, time);
        break;
    }
  }

  playKick(velocity, time) {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.frequency.setValueAtTime(60, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

    gain.gain.setValueAtTime(velocity, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    osc.connect(gain);
    gain.connect(this.output);

    osc.start(time);
    osc.stop(time + 0.5);
  }

  playSnare(velocity, time) {
    // Tone component
    const osc = this.audioContext.createOscillator();
    const oscGain = this.audioContext.createGain();
    osc.frequency.value = 200;
    oscGain.gain.setValueAtTime(velocity * 0.5, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    // Noise component
    const noise = this.audioContext.createBufferSource();
    const noiseBuffer = this.audioContext.createBuffer(
      1,
      4096,
      this.audioContext.sampleRate,
    );
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < 4096; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = noiseBuffer;

    const noiseFilter = this.audioContext.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 2000;

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(velocity * 0.5, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    // Connect
    osc.connect(oscGain);
    oscGain.connect(this.output);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.output);

    // Start
    osc.start(time);
    osc.stop(time + 0.2);
    noise.start(time);
    noise.stop(time + 0.2);
  }

  playHihat(velocity, time) {
    const noise = this.audioContext.createBufferSource();
    const noiseBuffer = this.audioContext.createBuffer(
      1,
      4096,
      this.audioContext.sampleRate,
    );
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < 4096; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = noiseBuffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 8000;
    filter.Q.value = 1;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(velocity * 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);

    noise.start(time);
    noise.stop(time + 0.05);
  }

  playOpenhat(velocity, time) {
    const noise = this.audioContext.createBufferSource();
    const noiseBuffer = this.audioContext.createBuffer(
      1,
      8192,
      this.audioContext.sampleRate,
    );
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < 8192; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = noiseBuffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 5000;
    filter.Q.value = 0.5;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(velocity * 0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);

    noise.start(time);
    noise.stop(time + 0.3);
  }

  playCrash(velocity, time) {
    const noise = this.audioContext.createBufferSource();
    const noiseBuffer = this.audioContext.createBuffer(
      1,
      32768,
      this.audioContext.sampleRate,
    );
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < 32768; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = noiseBuffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3000;
    filter.Q.value = 0.5;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(velocity * 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);

    noise.start(time);
    noise.stop(time + 2);
  }

  playRide(velocity, time) {
    // Similar to crash but shorter and brighter
    const noise = this.audioContext.createBufferSource();
    const noiseBuffer = this.audioContext.createBuffer(
      1,
      16384,
      this.audioContext.sampleRate,
    );
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < 16384; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = noiseBuffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 8000;
    filter.Q.value = 2;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(velocity * 0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);

    noise.start(time);
    noise.stop(time + 0.5);
  }

  stopNote(midiNote, _handleOrTime = this.audioContext.currentTime) {
    // Drums are one‑shots; nothing to release.
  }
}

// Simple Piano using additive synthesis
export class SimplePiano extends BaseInstrument {
  constructor(audioContext) {
    super(audioContext);
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    // Create multiple harmonics for piano-like sound
    const harmonics = [1, 2, 3, 4, 5, 6];
    const amplitudes = [1, 0.5, 0.25, 0.125, 0.0625, 0.03125];

    const oscillators = [];
    const gainNodes = [];

    harmonics.forEach((harmonic, i) => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.frequency.value = frequency * harmonic;
      osc.type = 'sine';

      // Slightly detune higher harmonics for richness
      if (harmonic > 1) {
        osc.detune.value = (Math.random() - 0.5) * 5 * harmonic;
      }

      gain.gain.value = 0;

      osc.connect(gain);
      gain.connect(this.output);

      oscillators.push(osc);
      gainNodes.push(gain);
    });

    // Piano-like envelope
    const attack = 0.002;
    const decay = 0.5;
    const sustain = 0.2;
    const release = 1.5;

    gainNodes.forEach((gain, i) => {
      const amp = velocity * amplitudes[i] * 0.2;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(amp, time + attack);
      gain.gain.exponentialRampToValueAtTime(
        amp * sustain + 0.001,
        time + attack + decay,
      );
    });

    // Start all oscillators
    oscillators.forEach((osc) => osc.start(time));

    const voice = { oscillators, gainNodes, startTime: time, release };
    let set = this.activeNotes.get(midiNote);
    if (!set) {
      set = new Set();
      this.activeNotes.set(midiNote, set);
    }
    set.add(voice);
    return voice; // handle
  }

  stopNote(midiNote, handleOrTime = this.audioContext.currentTime) {
    const voices = this.activeNotes.get(midiNote);
    if (!voices || voices.size === 0) return;

    const stopVoice = (voice, when) => {
      const { oscillators, gainNodes, release } = voice;
      gainNodes.forEach((gain) => {
        gain.gain.cancelScheduledValues(when);
        gain.gain.setValueAtTime(gain.gain.value, when);
        gain.gain.exponentialRampToValueAtTime(0.001, when + release);
      });
      oscillators.forEach((osc) => {
        try {
          osc.stop(when + release);
        } catch {}
      });
      setTimeout(
        () => {
          voices.delete(voice);
          if (voices.size === 0) this.activeNotes.delete(midiNote);
        },
        (release + 0.1) * 1000,
      );
    };

    if (typeof handleOrTime === 'object' && handleOrTime) {
      stopVoice(handleOrTime, this.audioContext.currentTime);
    } else {
      const when = Number(handleOrTime) || this.audioContext.currentTime;
      Array.from(voices).forEach((v) => stopVoice(v, when));
    }
  }
}

// Export instrument factory - Updated to accept external AudioContext
export function createInstrument(audioContext, type, preset) {
  switch (type) {
    case 'synth':
      return new SubtractiveSynth(audioContext, preset);
    case 'drums':
      return new DrumSampler(audioContext);
    case 'piano':
      return new SimplePiano(audioContext);
    default:
      return new SubtractiveSynth(audioContext, 'default');
  }
}
