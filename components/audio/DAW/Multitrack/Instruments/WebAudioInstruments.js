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
      const p = envelope.gain;
      const end = when + release;
      if (typeof p.cancelAndHoldAtTime === 'function') {
        p.cancelAndHoldAtTime(when);
      } else {
        p.cancelScheduledValues(when);
        const tc = Math.max(0.01, release * 0.3);
        p.setTargetAtTime(0.0001, when, tc);
      }
      p.exponentialRampToValueAtTime(0.0001, end);
      oscillators.forEach((osc) => {
        try {
          osc.stop(end);
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

// WUULF - Ethereal Time-Warping Synthesizer
export class WuulfSynth extends BaseInstrument {
  constructor(audioContext) {
    super(audioContext);

    // Create effects chain
    this.reverb = this.createReverb();
    this.delay = this.createDelay();
    this.chorus = this.createChorus();
    this.shimmer = this.createShimmer();

    // Master limiter to prevent clipping
    this.limiter = audioContext.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.1;

    // Signal routing
    this.dryGain = audioContext.createGain();
    this.dryGain.gain.value = 0.3;

    this.wetGain = audioContext.createGain();
    this.wetGain.gain.value = 0.7;

    // Connect effects chain
    this.output.connect(this.dryGain);
    this.output.connect(this.chorus);
    this.chorus.connect(this.shimmer);
    this.shimmer.connect(this.delay);
    this.delay.connect(this.reverb);
    this.reverb.connect(this.wetGain);

    this.dryGain.connect(this.limiter);
    this.wetGain.connect(this.limiter);
  }

  connect(destination) {
    this.limiter.connect(destination);
  }

  disconnect() {
    this.limiter.disconnect();
  }

  createReverb() {
    const convolver = this.audioContext.createConvolver();
    const length = this.audioContext.sampleRate * 4; // 4 second reverb
    const impulse = this.audioContext.createBuffer(
      2,
      length,
      this.audioContext.sampleRate,
    );

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Ethereal reverb with exponential decay and random reflections
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }

    convolver.buffer = impulse;
    return convolver;
  }

  createDelay() {
    // Multi-tap delay for spaciousness
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    // Create multiple delay taps
    const delayTimes = [0.375, 0.5, 0.75, 1.0]; // Musical divisions
    const feedbacks = [0.4, 0.3, 0.2, 0.15];

    delayTimes.forEach((delayTime, i) => {
      const delay = this.audioContext.createDelay(5);
      const feedback = this.audioContext.createGain();
      const tapGain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();

      // Each tap has different characteristics
      delay.delayTime.value = delayTime;
      feedback.gain.value = feedbacks[i];
      tapGain.gain.value = 0.5 - i * 0.1;

      // Progressively darker delays
      filter.type = 'lowpass';
      filter.frequency.value = 3000 - i * 500;

      input.connect(delay);
      delay.connect(filter);
      filter.connect(feedback);
      feedback.connect(delay);
      filter.connect(tapGain);
      tapGain.connect(output);
    });

    return output;
  }

  createChorus() {
    // More complex chorus with 6 voices
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();
    const delays = [];
    const lfos = [];
    const gains = [];

    // Create 6 chorus voices for ultra-lush sound
    for (let i = 0; i < 6; i++) {
      const delay = this.audioContext.createDelay(0.1);
      const lfo = this.audioContext.createOscillator();
      const lfoGain = this.audioContext.createGain();
      const voiceGain = this.audioContext.createGain();

      // Varied delay times for thickness
      delay.delayTime.value = 0.015 + i * 0.008;

      // Multiple LFO shapes for complex modulation
      lfo.type = ['sine', 'triangle', 'sine', 'triangle', 'sine', 'triangle'][
        i
      ];
      lfo.frequency.value = 0.3 + i * 0.17; // Different rates
      lfoGain.gain.value = 0.003 + i * 0.0005;

      // Different levels for each voice
      voiceGain.gain.value = 0.7 - i * 0.08;

      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start();

      input.connect(delay);
      delay.connect(voiceGain);
      voiceGain.connect(output);

      delays.push(delay);
      lfos.push(lfo);
      gains.push(voiceGain);
    }

    // Add dry signal for presence
    const dryGain = this.audioContext.createGain();
    dryGain.gain.value = 0.5;
    input.connect(dryGain);
    dryGain.connect(output);

    return input;
  }

  createShimmer() {
    // Pitch shifter for ethereal shimmer
    const shifter = this.audioContext.createGain();
    return shifter; // Simplified for now, would need granular synthesis for true pitch shift
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    // Create a complex voice with multiple oscillators
    const voice = {
      oscillators: [],
      filters: [],
      gains: [],
      lfos: [],
      panners: [],
      startTime: time,
    };

    // Main tone - MORE detuned oscillators for super lush sound
    const detunes = [-12, -7, -3, 0, 3, 7, 12]; // Cents
    for (let i = 0; i < detunes.length; i++) {
      const osc = this.audioContext.createOscillator();
      const filter = this.audioContext.createBiquadFilter();
      const gain = this.audioContext.createGain();
      const panner = this.audioContext.createStereoPanner();

      // Mix of waveforms for complexity
      osc.type = i % 2 === 0 ? 'sawtooth' : 'square';
      osc.frequency.value = frequency;
      osc.detune.value = detunes[i] + (Math.random() - 0.5) * 4; // Slight random detune

      // Warmer, more musical filter
      filter.type = 'lowpass';
      filter.frequency.value = 600 + Math.random() * 400 + midiNote * 10;
      filter.Q.value = 2 + Math.random() * 3;

      // Spread voices across stereo field
      panner.pan.value = (i - 3) * 0.25; // -0.75 to +0.75

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.output);

      voice.oscillators.push(osc);
      voice.filters.push(filter);
      voice.gains.push(gain);
      voice.panners.push(panner);
    }

    // Sub oscillator - TWO octaves for deep lushness
    for (let oct = 1; oct <= 2; oct++) {
      const subOsc = this.audioContext.createOscillator();
      const subGain = this.audioContext.createGain();
      const subPanner = this.audioContext.createStereoPanner();

      subOsc.type = 'sine';
      subOsc.frequency.value = frequency / (oct * 2);
      subOsc.detune.value = (Math.random() - 0.5) * 5; // Slight detune for warmth

      // Slight stereo spread on subs
      subPanner.pan.value = oct === 1 ? -0.2 : 0.2;

      subOsc.connect(subGain);
      subGain.connect(subPanner);
      subPanner.connect(this.output);

      voice.oscillators.push(subOsc);
      voice.gains.push(subGain);
      voice.panners.push(subPanner);
    }

    // Ethereal high harmonics - MORE of them!
    const harmonics = [3, 5, 7, 9, 11, 13]; // More harmonics
    harmonics.forEach((harmonic, i) => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const panner = this.audioContext.createStereoPanner();
      const filter = this.audioContext.createBiquadFilter();

      // Mix of sine and triangle for softer harmonics
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = frequency * harmonic;
      osc.detune.value = (Math.random() - 0.5) * 10; // More detune variation

      // Gentle highpass to remove muddiness
      filter.type = 'highpass';
      filter.frequency.value = 200;

      // Spread harmonics in stereo field
      panner.pan.value = Math.sin(i * 0.7) * 0.8;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.output);

      voice.oscillators.push(osc);
      voice.gains.push(gain);
      voice.filters.push(filter);
      voice.panners.push(panner);
    });

    // MULTIPLE LFOs for rich modulation
    // Filter modulation LFO
    const filterLfo = this.audioContext.createOscillator();
    const filterLfoGain = this.audioContext.createGain();
    filterLfo.type = 'sine';
    filterLfo.frequency.value = 0.1 + Math.random() * 0.2;
    filterLfoGain.gain.value = 200 + midiNote * 8;

    filterLfo.connect(filterLfoGain);
    voice.filters.forEach((filter) => {
      filterLfoGain.connect(filter.frequency);
    });
    filterLfo.start(time);
    voice.lfos.push(filterLfo);

    // Amplitude modulation LFO for shimmer
    const ampLfo = this.audioContext.createOscillator();
    const ampLfoGain = this.audioContext.createGain();
    ampLfo.type = 'triangle';
    ampLfo.frequency.value = 3 + Math.random() * 2; // Faster tremolo
    ampLfoGain.gain.value = 0.1;

    const ampModulator = this.audioContext.createGain();
    ampModulator.gain.value = 1;

    ampLfo.connect(ampLfoGain);
    ampLfoGain.connect(ampModulator.gain);
    ampLfo.start(time);
    voice.lfos.push(ampLfo);

    // Pan modulation for movement
    const panLfo = this.audioContext.createOscillator();
    panLfo.type = 'sine';
    panLfo.frequency.value = 0.2 + Math.random() * 0.1;

    voice.panners.forEach((panner, i) => {
      if (i < 3) {
        // Only modulate main oscillators
        const panGain = this.audioContext.createGain();
        panGain.gain.value = 0.3;
        panLfo.connect(panGain);
        panGain.connect(panner.pan);
      }
    });
    panLfo.start(time);
    voice.lfos.push(panLfo);

    // Complex envelope with multiple stages
    const attack = 1.2 + Math.random() * 0.8; // Even slower attack
    const decay = 1.5;
    const sustain = 0.7;
    const peak = velocity * 0.12; // Slightly lower for headroom

    // Main oscillators envelope - staggered attacks for lushness
    voice.gains.slice(0, 7).forEach((gain, i) => {
      const stagger = i * 0.05; // Slight time offset
      const gainScale = 1 - i * 0.05; // Slightly different levels
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(
        peak * gainScale,
        time + attack + stagger,
      );
      gain.gain.exponentialRampToValueAtTime(
        peak * sustain * gainScale + 0.001,
        time + attack + decay + stagger,
      );
    });

    // Sub oscillators envelope (even slower attack)
    voice.gains.slice(7, 9).forEach((gain, i) => {
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(
        peak * 0.6 * (1 - i * 0.2),
        time + attack * 2,
      );
      gain.gain.exponentialRampToValueAtTime(
        peak * sustain * 0.4 * (1 - i * 0.2) + 0.001,
        time + attack * 2 + decay,
      );
    });

    // Harmonic envelope - cascading bell-like decays
    const harmonicGains = voice.gains.slice(9);
    harmonicGains.forEach((gain, i) => {
      const harmonicAmp = (peak * 0.03) / (i * 0.5 + 1);
      const attackTime = 0.005 + i * 0.002; // Slightly staggered
      const decayTime = 0.8 + i * 0.3; // Longer decays for higher harmonics

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(harmonicAmp, time + attackTime);
      gain.gain.exponentialRampToValueAtTime(
        harmonicAmp * 0.1 + 0.001,
        time + decayTime,
      );
    });

    // Start all oscillators
    voice.oscillators.forEach((osc) => osc.start(time));

    // Store voice
    let set = this.activeNotes.get(midiNote);
    if (!set) {
      set = new Set();
      this.activeNotes.set(midiNote, set);
    }
    set.add(voice);

    return voice;
  }

  stopNote(midiNote, handleOrTime = this.audioContext.currentTime) {
    const voices = this.activeNotes.get(midiNote);
    if (!voices || voices.size === 0) return;

    const stopVoice = (voice, when) => {
      const releaseTime = 3.0; // Long ethereal release

      // Fade out all gains
      voice.gains.forEach((gain) => {
        gain.gain.cancelScheduledValues(when);
        const currentValue = gain.gain.value;
        gain.gain.setValueAtTime(currentValue, when);
        gain.gain.exponentialRampToValueAtTime(0.001, when + releaseTime);
      });

      // Stop oscillators and LFOs after release
      setTimeout(
        () => {
          voice.oscillators.forEach((osc) => {
            try {
              osc.stop();
            } catch {}
          });
          voice.lfos.forEach((lfo) => {
            try {
              lfo.stop();
            } catch {}
          });
          voices.delete(voice);
          if (voices.size === 0) this.activeNotes.delete(midiNote);
        },
        (releaseTime + 0.5) * 1000,
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
      const end = when + release;
      gainNodes.forEach((g) => {
        const p = g.gain;
        if (typeof p.cancelAndHoldAtTime === 'function') {
          p.cancelAndHoldAtTime(when);
        } else {
          // Fallback: cancel future automation and smoothly head towards zero
          p.cancelScheduledValues(when);
          const tc = Math.max(0.01, release * 0.3);
          p.setTargetAtTime(0.0001, when, tc);
        }
        // Ensure we finish very close to zero by the end
        p.exponentialRampToValueAtTime(0.0001, end);
      });
      oscillators.forEach((osc) => {
        try {
          osc.stop(end);
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
    case 'wuulf':
      return new WuulfSynth(audioContext);
    default:
      return new SubtractiveSynth(audioContext, 'default');
  }
}
