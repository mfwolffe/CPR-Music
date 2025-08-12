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

    // Start just above 0 so micro‑notes don’t step upward at release
    envelope.gain.setValueAtTime(0.0001, time);
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

// WUULF2 :: fractal oscillator structures, granular shimmer with time-stretching,
// chaotic modulation networks, formant synthesis for otherworldly "voices",
// enhanced randomness, and a warp field effect for true time-bending.
export class Wuulf2Synth extends BaseInstrument {
  constructor(audioContext) {
    super(audioContext);

    // Enhanced effects chain with new warp field
    this.reverb = this.createReverb();
    this.delay = this.createDelay();
    this.chorus = this.createChorus();
    this.shimmer = this.createGranularShimmer(); // Now a proper granular pitch shifter
    this.warpField = this.createWarpField(); // New time-warping effect
    this.phaser = this.createPhaser(); // Added for psychedelic sweeps

    // Master limiter with more aggressive settings
    this.limiter = audioContext.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.ratio.value = 30;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.05;

    // Signal routing with more wet signal for immersion
    this.dryGain = audioContext.createGain();
    this.dryGain.gain.value = 0.2;

    this.wetGain = audioContext.createGain();
    this.wetGain.gain.value = 0.8;

    // Connect effects chain — object nodes expose .input/.output
    // Dry path
    this.output.connect(this.dryGain);

    // Wet path
    this.output.connect(this.chorus.input);
    this.chorus.output.connect(this.shimmer.input);
    this.shimmer.output.connect(this.delay.input);
    this.delay.output.connect(this.phaser);
    this.phaser.connect(this.warpField.input);
    this.warpField.output.connect(this.reverb);
    this.reverb.connect(this.wetGain);

    // Feedback from reverb back into shimmer
    const feedbackGain = audioContext.createGain();
    feedbackGain.gain.value = 0.1;
    this.reverb.connect(feedbackGain);
    feedbackGain.connect(this.shimmer.input);

    // Summing to limiter
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
    const length = this.audioContext.sampleRate * 8; // Longer 8-second reverb for deeper ether
    const impulse = this.audioContext.createBuffer(
      2,
      length,
      this.audioContext.sampleRate,
    );

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // More chaotic reverb: fractal-like decay with Perlin noise simulation
        const noise =
          (Math.random() * 2 - 1) * Math.sin((i / length) * Math.PI);
        channelData[i] =
          noise * Math.pow(1 - i / length, 3) * (1 + Math.sin(i * 0.01));
      }
    }

    convolver.buffer = impulse;
    return convolver;
  }

  createDelay() {
    // Enhanced multi-tap delay with more taps and modulation
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    const delayTimes = [0.25, 0.375, 0.5, 0.625, 0.75, 1.0, 1.25]; // More taps for complexity
    const feedbacks = [0.45, 0.35, 0.25, 0.2, 0.15, 0.1, 0.05];

    delayTimes.forEach((delayTime, i) => {
      const delay = this.audioContext.createDelay(10);
      const feedback = this.audioContext.createGain();
      const tapGain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();
      const lfo = this.audioContext.createOscillator(); // Per-tap LFO for time modulation
      const lfoGain = this.audioContext.createGain();

      delay.delayTime.value = delayTime;
      feedback.gain.value = feedbacks[i];
      tapGain.gain.value = 0.6 - i * 0.08;

      filter.type = 'lowpass';
      filter.frequency.value = 4000 - i * 600;

      // Modulate delay time for warping
      lfo.type = 'sine';
      lfo.frequency.value = 0.1 + i * 0.05;
      lfoGain.gain.value = 0.05;
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start();

      input.connect(delay);
      delay.connect(filter);
      filter.connect(feedback);
      feedback.connect(delay);
      filter.connect(tapGain);
      tapGain.connect(output);
    });

    return { input, output }; // Return as object for proper node connection
  }

  createChorus() {
    // Ultra-complex chorus with 12 voices and nested modulation
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();
    const delays = [];
    const lfos = [];
    const gains = [];

    for (let i = 0; i < 12; i++) {
      // Doubled voices for insane lushness
      const delay = this.audioContext.createDelay(0.2);
      const lfo = this.audioContext.createOscillator();
      const lfoGain = this.audioContext.createGain();
      const voiceGain = this.audioContext.createGain();

      delay.delayTime.value = 0.01 + i * 0.005;

      lfo.type = ['sine', 'triangle', 'sawtooth', 'square'][i % 4]; // Varied waveforms
      lfo.frequency.value = 0.2 + i * 0.1;
      lfoGain.gain.value = 0.002 + i * 0.0003;

      voiceGain.gain.value = 0.8 - i * 0.05;

      // Nested modulation: secondary LFO modulates primary LFO frequency
      const metaLfo = this.audioContext.createOscillator();
      const metaLfoGain = this.audioContext.createGain();
      metaLfo.type = 'sine';
      metaLfo.frequency.value = 0.05;
      metaLfoGain.gain.value = 0.05;
      metaLfo.connect(metaLfoGain);
      metaLfoGain.connect(lfo.frequency);
      metaLfo.start();

      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start();

      input.connect(delay);
      delay.connect(voiceGain);
      voiceGain.connect(output);

      delays.push(delay);
      lfos.push(lfo, metaLfo); // Store both
      gains.push(voiceGain);
    }

    // Dry signal
    const dryGain = this.audioContext.createGain();
    dryGain.gain.value = 0.3;
    input.connect(dryGain);
    dryGain.connect(output);

    return { input, output };
  }

  createGranularShimmer() {
    // Proper granular pitch shifter for shimmering octaves with time-stretching
    // Note: This is a simplified conceptual implementation; real granular needs more complexity
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    // Simulate granular by creating multiple delayed, pitch-shifted grains
    const grainCount = 8;
    for (let i = 0; i < grainCount; i++) {
      const delay = this.audioContext.createDelay(0.5);
      const pitchShift = this.audioContext.createWaveShaper(); // Approximate pitch with waveshaper
      const grainGain = this.audioContext.createGain();

      delay.delayTime.value = i * 0.05; // Overlapping grains
      grainGain.gain.value = 0.4 - i * 0.04;

      // Waveshaper curve for +1 octave shift (simplified)
      const curve = new Float32Array(1024);
      for (let j = 0; j < 1024; j++) {
        curve[j] =
          Math.sin((j / 1024) * Math.PI * 2) * (1 + Math.random() * 0.1); // Add randomness
      }
      pitchShift.curve = curve;

      // Random time-stretch simulation via modulated delay
      const stretchLfo = this.audioContext.createOscillator();
      stretchLfo.type = 'sine';
      stretchLfo.frequency.value = 1 + Math.random();
      const stretchGain = this.audioContext.createGain();
      stretchGain.gain.value = 0.1;
      stretchLfo.connect(stretchGain);
      stretchGain.connect(delay.delayTime);
      stretchLfo.start();

      input.connect(delay);
      delay.connect(pitchShift);
      pitchShift.connect(grainGain);
      grainGain.connect(output);
    }

    return { input, output };
  }

  createWarpField() {
    // New effect: Time-warping with variable playback rate and reverse grains
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    // Simulate warping with multiple buffer sources (conceptual; needs audio buffer for real)
    // For simplicity, use delays with modulated time
    const warpDelay = this.audioContext.createDelay(2);
    const rateLfo = this.audioContext.createOscillator();
    const rateGain = this.audioContext.createGain();

    rateLfo.type = 'sawtooth';
    rateLfo.frequency.value = 0.5;
    rateGain.gain.value = 0.5; // Modulate between 0.5-1.5x speed
    rateLfo.connect(rateGain);
    rateGain.connect(warpDelay.delayTime);
    rateLfo.start();

    input.connect(warpDelay);
    warpDelay.connect(output);

    // Add occasional reverse effect (simulated with negative delay modulation)
    return { input, output };
  }

  createPhaser() {
    // Added phaser for sweeping, otherworldly phases
    const phaser = this.audioContext.createBiquadFilter();
    phaser.type = 'allpass';
    phaser.frequency.value = 440;
    phaser.Q.value = 0.5;

    // Modulate frequency for movement
    const lfo = this.audioContext.createOscillator();
    const lfoGain = this.audioContext.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.3;
    lfoGain.gain.value = 1000;
    lfo.connect(lfoGain);
    lfoGain.connect(phaser.frequency);
    lfo.start();

    return phaser;
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    const voice = {
      oscillators: [],
      filters: [],
      gains: [],
      lfos: [],
      panners: [],
      startTime: time,
    };

    // Fractal main tones: Recursive detuning for infinite depth
    const baseDetunes = [-15, -10, -5, 0, 5, 10, 15];
    for (let i = 0; i < baseDetunes.length; i++) {
      const osc = this.audioContext.createOscillator();
      const filter = this.audioContext.createBiquadFilter();
      const gain = this.audioContext.createGain();
      const panner = this.audioContext.createStereoPanner();

      osc.type = ['sawtooth', 'square', 'triangle'][i % 3];
      osc.frequency.value = frequency;
      osc.detune.value = baseDetunes[i] + (Math.random() - 0.5) * 6;

      // Fractal sub-detunes: Add mini-oscillators modulating this one
      const fractalLfo = this.audioContext.createOscillator();
      fractalLfo.type = 'sine';
      fractalLfo.frequency.value = 0.5 + Math.random();
      const fractalGain = this.audioContext.createGain();
      fractalGain.gain.value = 10;
      fractalLfo.connect(fractalGain);
      fractalGain.connect(osc.detune);
      fractalLfo.start(time);

      filter.type = 'lowpass';
      filter.frequency.value = 500 + Math.random() * 500 + midiNote * 15;
      filter.Q.value = 3 + Math.random() * 4;

      panner.pan.value = (i - 3) * 0.3;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.output);

      voice.oscillators.push(osc);
      voice.filters.push(filter);
      voice.gains.push(gain);
      voice.panners.push(panner);
      voice.lfos.push(fractalLfo);
    }

    // Deeper sub oscillators with FM modulation for chaos
    for (let oct = 1; oct <= 3; oct++) {
      const subOsc = this.audioContext.createOscillator();
      const subGain = this.audioContext.createGain();
      const subPanner = this.audioContext.createStereoPanner();
      const fmMod = this.audioContext.createOscillator(); // FM modulator
      const fmGain = this.audioContext.createGain();

      subOsc.type = 'sine';
      subOsc.frequency.value = frequency / (oct * 2);
      subOsc.detune.value = (Math.random() - 0.5) * 8;

      fmMod.type = 'triangle';
      fmMod.frequency.value = frequency / 4;
      fmGain.gain.value = 100 + Math.random() * 200;
      fmMod.connect(fmGain);
      fmGain.connect(subOsc.frequency);
      fmMod.start(time);

      subPanner.pan.value = (oct - 2) * 0.3;

      subOsc.connect(subGain);
      subGain.connect(subPanner);
      subPanner.connect(this.output);

      voice.oscillators.push(subOsc, fmMod);
      voice.gains.push(subGain, fmGain);
      voice.panners.push(subPanner);
    }

    // Otherworldly formant harmonics: Vocal-like filters for eerie "singing"
    const formants = [800, 1150, 2900, 3900, 4950]; // Approximate vowel formants
    formants.forEach((formantFreq, i) => {
      const osc = this.audioContext.createOscillator();
      const formantFilter = this.audioContext.createBiquadFilter();
      const gain = this.audioContext.createGain();
      const panner = this.audioContext.createStereoPanner();

      osc.type = 'sawtooth';
      osc.frequency.value = frequency * (i + 1);
      osc.detune.value = (Math.random() - 0.5) * 15;

      formantFilter.type = 'bandpass';
      formantFilter.frequency.value = formantFreq + (Math.random() - 0.5) * 100;
      formantFilter.Q.value = 20;

      panner.pan.value = Math.cos(i * 1.2) * 0.9;

      osc.connect(formantFilter);
      formantFilter.connect(gain);
      gain.connect(panner);
      panner.connect(this.output);

      voice.oscillators.push(osc);
      voice.filters.push(formantFilter);
      voice.gains.push(gain);
      voice.panners.push(panner);
    });

    // Chaotic modulation network: Multiple interconnected LFOs
    const filterLfo = this.audioContext.createOscillator();
    const filterLfoGain = this.audioContext.createGain();
    filterLfo.type = 'sine';
    filterLfo.frequency.value = 0.15 + Math.random() * 0.3;
    filterLfoGain.gain.value = 300 + midiNote * 10;
    filterLfo.connect(filterLfoGain);
    voice.filters.forEach((filter) => filterLfoGain.connect(filter.frequency));
    filterLfo.start(time);
    voice.lfos.push(filterLfo);

    const ampLfo = this.audioContext.createOscillator();
    const ampLfoGain = this.audioContext.createGain();
    ampLfo.type = 'triangle';
    ampLfo.frequency.value = 4 + Math.random() * 3;
    ampLfoGain.gain.value = 0.15;
    ampLfo.connect(ampLfoGain);
    voice.gains.forEach((gain) => ampLfoGain.connect(gain.gain)); // Modulate all gains
    ampLfo.start(time);
    voice.lfos.push(ampLfo);

    const panLfo = this.audioContext.createOscillator();
    panLfo.type = 'sine';
    panLfo.frequency.value = 0.3 + Math.random() * 0.2;
    voice.panners.forEach((panner, i) => {
      const panGain = this.audioContext.createGain();
      panGain.gain.value = 0.4 + Math.random() * 0.2;
      panLfo.connect(panGain);
      panGain.connect(panner.pan);
    });
    panLfo.start(time);
    voice.lfos.push(panLfo);

    // Add chaos LFO that modulates other LFO frequencies
    const chaosLfo = this.audioContext.createOscillator();
    chaosLfo.type = 'sawtooth';
    chaosLfo.frequency.value = 0.05;
    voice.lfos.forEach((lfo) => {
      const chaosGain = this.audioContext.createGain();
      chaosGain.gain.value = 0.1;
      chaosLfo.connect(chaosGain);
      chaosGain.connect(lfo.frequency);
    });
    chaosLfo.start(time);
    voice.lfos.push(chaosLfo);

    // Ultra-complex envelopes with random variations
    const attack = 1.5 + Math.random() * 1.0; // Slower, more variable
    const decay = 2.0;
    const sustain = 0.6;
    const peak = velocity * 0.1;

    // Main oscillators: Staggered with random offsets
    voice.gains.slice(0, baseDetunes.length).forEach((gain, i) => {
      const stagger = i * 0.07 + Math.random() * 0.03;
      const gainScale = 1 - i * 0.04 + (Math.random() - 0.5) * 0.1;
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

    // Sub oscillators: Even slower, with FM ramp
    voice.gains
      .slice(baseDetunes.length, baseDetunes.length + 3)
      .forEach((gain, i) => {
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(
          peak * 0.5 * (1 - i * 0.15),
          time + attack * 2.5,
        );
        gain.gain.exponentialRampToValueAtTime(
          peak * sustain * 0.3 * (1 - i * 0.15) + 0.001,
          time + attack * 2.5 + decay,
        );
      });

    // Formant envelopes: Pulsing, vocal-like swells
    const formantGains = voice.gains.slice(-formants.length);
    formantGains.forEach((gain, i) => {
      const formantAmp = (peak * 0.05) / (i + 1);
      const attackTime = 0.01 + i * 0.005 + Math.random() * 0.01;
      const decayTime = 1.0 + i * 0.4 + Math.random() * 0.2;

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(formantAmp, time + attackTime);
      gain.gain.exponentialRampToValueAtTime(
        formantAmp * 0.05 + 0.001,
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
      const releaseTime = 4.0; // Longer release for lingering otherworldliness

      voice.gains.forEach((gain) => {
        gain.gain.cancelScheduledValues(when);
        const currentValue = gain.gain.value;
        gain.gain.setValueAtTime(currentValue, when);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          when + releaseTime + Math.random() * 0.5,
        ); // Random release variation
      });

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
        (releaseTime + 1.0) * 1000,
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

// String Ensemble Synthesizer
export class StringEnsemble extends BaseInstrument {
  constructor(audioContext) {
    super(audioContext);

    // Create ensemble effects
    this.ensemble = this.createEnsembleEffect();
    this.reverb = this.createStringReverb();
    this.eq = this.createStringEQ();

    // Gentle master compressor for headroom (prevents crunchy clipping)
    this.masterComp = audioContext.createDynamicsCompressor();
    this.masterComp.threshold.value = -18;
    this.masterComp.ratio.value = 3;
    this.masterComp.attack.value = 0.01;
    this.masterComp.release.value = 0.25;

    // Signal routing
    this.output.connect(this.ensemble.input);
    this.ensemble.output.connect(this.eq);
    this.eq.connect(this.reverb);
    this.reverb.connect(this.masterComp);

    // Vibrato LFO (shared across all voices)
    this.vibratoLfo = audioContext.createOscillator();
    this.vibratoLfo.frequency.value = 5.5;
    this.vibratoLfo.start();
  }

  connect(destination) {
    this.masterComp.connect(destination);
  }

  disconnect() {
    this.masterComp.disconnect();
  }

  createEnsembleEffect() {
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();
    const delays = [];

    // Create 8 string "players" with slight timing/pitch variations
    for (let i = 0; i < 8; i++) {
      const delay = this.audioContext.createDelay(0.05);
      const gain = this.audioContext.createGain();

      // Humanize timing (simulate bow attacks)
      delay.delayTime.value = 0.001 + Math.random() * 0.015;
      gain.gain.value = 0.5 + Math.random() * 0.2;

      input.connect(delay);
      delay.connect(gain);
      gain.connect(output);

      delays.push({ delay, gain });
    }

    return { input, output, delays };
  }

  createStringReverb() {
    const convolver = this.audioContext.createConvolver();
    const length = this.audioContext.sampleRate * 2.5; // Concert hall reverb
    const impulse = this.audioContext.createBuffer(
      2,
      length,
      this.audioContext.sampleRate,
    );

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Early reflections + smooth decay
        const envelope = Math.pow(1 - i / length, 1.5);
        channelData[i] = (Math.random() * 2 - 1) * envelope;

        // Add early reflections
        if (i < 0.1 * length) {
          channelData[i] *= 2;
        }
      }
    }

    convolver.buffer = impulse;

    // Mix control
    const dry = this.audioContext.createGain();
    const wet = this.audioContext.createGain();
    const merger = this.audioContext.createGain();

    dry.gain.value = 0.6;
    wet.gain.value = 0.4;

    // Connect reverb
    const reverbInput = this.audioContext.createGain();
    reverbInput.connect(dry);
    reverbInput.connect(convolver);
    convolver.connect(wet);

    dry.connect(merger);
    wet.connect(merger);

    return merger;
  }

  createStringEQ() {
    // Gentle high shelf for "air"
    const highShelf = this.audioContext.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 8000;
    highShelf.gain.value = 3;

    // Slight mid boost for presence
    const midBoost = this.audioContext.createBiquadFilter();
    midBoost.type = 'peaking';
    midBoost.frequency.value = 2500;
    midBoost.Q.value = 0.7;
    midBoost.gain.value = 2;

    highShelf.connect(midBoost);

    return highShelf;
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    const voice = {
      oscillators: [],
      gains: [],
      filters: [],
      panners: [],
      startTime: time,
    };

    // Violin section (4 layers)
    for (let i = 0; i < 4; i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();
      const panner = this.audioContext.createStereoPanner();
      const vibratoGain = this.audioContext.createGain();

      osc.type = 'sawtooth';
      osc.frequency.value = frequency;
      osc.detune.value = (i - 1.5) * 8 + (Math.random() - 0.5) * 5;

      filter.type = 'bandpass';
      filter.frequency.value = 800 + i * 200;
      filter.Q.value = 3;

      vibratoGain.gain.value = 3 + Math.random() * 2;
      this.vibratoLfo.connect(vibratoGain);
      vibratoGain.connect(osc.detune);

      panner.pan.value = (i - 1.5) * 0.4;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.output);

      voice.oscillators.push(osc);
      voice.gains.push(gain);
      voice.filters.push(filter);
      voice.panners.push(panner);
    }

    // Viola section (2 layers, one octave down)
    for (let i = 0; i < 2; i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();
      const panner = this.audioContext.createStereoPanner();

      osc.type = 'sawtooth';
      osc.frequency.value = frequency / 2;
      osc.detune.value = i * 7 + (Math.random() - 0.5) * 4;

      filter.type = 'bandpass';
      filter.frequency.value = 600 + i * 150;
      filter.Q.value = 2.5;

      panner.pan.value = i === 0 ? -0.3 : 0.3;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.output);

      voice.oscillators.push(osc);
      voice.gains.push(gain);
      voice.filters.push(filter);
      voice.panners.push(panner);
    }

    // Cello/Bass (1 layer, two octaves down)
    const bassOsc = this.audioContext.createOscillator();
    const bassGain = this.audioContext.createGain();
    const bassFilter = this.audioContext.createBiquadFilter();

    bassOsc.type = 'sawtooth';
    bassOsc.frequency.value = frequency / 4;

    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 1200;
    bassFilter.Q.value = 1;

    bassOsc.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(this.output);

    voice.oscillators.push(bassOsc);
    voice.gains.push(bassGain);
    voice.filters.push(bassFilter);

    // String ensemble envelope (slow attack for bowing)
    const attack = 0.08 + Math.random() * 0.04;
    const decay = 0.1;
    const sustain = 0.8;
    const peak = velocity * 0.15;

    // Violins
    voice.gains.slice(0, 4).forEach((gain, i) => {
      const delay = i * 0.01; // Slight stagger
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(peak, time + attack + delay);
      gain.gain.exponentialRampToValueAtTime(
        peak * sustain + 0.001,
        time + attack + decay + delay,
      );
    });

    // Violas (slightly slower attack)
    voice.gains.slice(4, 6).forEach((gain, i) => {
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(peak * 0.7, time + attack * 1.2);
      gain.gain.exponentialRampToValueAtTime(
        peak * sustain * 0.7 + 0.001,
        time + attack * 1.2 + decay,
      );
    });

    // Bass (slowest attack)
    bassGain.gain.setValueAtTime(0.0001, time);
    bassGain.gain.linearRampToValueAtTime(peak * 0.5, time + attack * 1.5);
    bassGain.gain.exponentialRampToValueAtTime(
      peak * sustain * 0.5 + 0.001,
      time + attack * 1.5 + decay,
    );

    // Bow noise transient for realistic onset
    {
      const bowNoise = this.audioContext.createBufferSource();
      const frames = 2048;
      const buf = this.audioContext.createBuffer(
        1,
        frames,
        this.audioContext.sampleRate,
      );
      const data = buf.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
      bowNoise.buffer = buf;

      const bowHP = this.audioContext.createBiquadFilter();
      bowHP.type = 'highpass';
      bowHP.frequency.value = 3000;

      const bowGain = this.audioContext.createGain();
      bowGain.gain.setValueAtTime(0.0001, time);
      bowGain.gain.linearRampToValueAtTime(0.03, time + 0.015);
      bowGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);

      bowNoise.connect(bowHP);
      bowHP.connect(bowGain);
      bowGain.connect(this.output);

      bowNoise.start(time);
      bowNoise.stop(time + 0.2);
    }

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
      const releaseTime = 0.8; // Natural string decay
      voice.gains.forEach((gain) => {
        const p = gain.gain;
        if (typeof p.cancelAndHoldAtTime === 'function') {
          p.cancelAndHoldAtTime(when);
        } else {
          p.cancelScheduledValues(when);
          const tc = Math.max(0.01, releaseTime * 0.25);
          p.setTargetAtTime(0.0001, when, tc);
        }
        p.exponentialRampToValueAtTime(0.0001, when + releaseTime);
      });

      setTimeout(
        () => {
          try {
            voice.oscillators.forEach((osc) => osc.stop());
          } catch {}
          voices.delete(voice);
          if (voices.size === 0) this.activeNotes.delete(midiNote);
        },
        (releaseTime + 0.1) * 1000,
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

// Brass Section Synthesizer
export class BrassSection extends BaseInstrument {
  constructor(audioContext) {
    super(audioContext);

    // Effects chain
    this.compressor = audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -10;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.1;

    this.reverb = this.createBrassReverb();
    this.eq = this.createBrassEQ();

    // Routing with gentle saturation and controlled headroom
    this.saturator = this.audioContext.createWaveShaper();
    this.saturator.curve = (function makeCurve(amount = 0.35) {
      const n = 44100;
      const curve = new Float32Array(n);
      const k = Math.max(0, amount) * 100;
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
      }
      return curve;
    })();
    this.saturator.oversample = '2x';

    this.preDrive = this.audioContext.createGain();
    this.preDrive.gain.value = 0.7; // leave headroom before saturator

    this.output.connect(this.eq);
    this.eq.connect(this.preDrive);
    this.preDrive.connect(this.saturator);
    this.saturator.connect(this.compressor);
    this.compressor.connect(this.reverb);
  }

  connect(destination) {
    this.reverb.connect(destination);
  }

  disconnect() {
    this.reverb.disconnect();
  }

  createBrassReverb() {
    const convolver = this.audioContext.createConvolver();
    const length = this.audioContext.sampleRate * 1.5; // Shorter, brighter reverb
    const impulse = this.audioContext.createBuffer(
      2,
      length,
      this.audioContext.sampleRate,
    );

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const envelope = Math.pow(1 - i / length, 1.2);
        channelData[i] = (Math.random() * 2 - 1) * envelope;
      }
    }

    convolver.buffer = impulse;

    const dry = this.audioContext.createGain();
    const wet = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    dry.gain.value = 0.7;
    wet.gain.value = 0.3;

    const input = this.audioContext.createGain();
    input.connect(dry);
    input.connect(convolver);
    convolver.connect(wet);

    dry.connect(output);
    wet.connect(output);

    return output;
  }

  createBrassEQ() {
    // Presence boost
    const presence = this.audioContext.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 3500;
    presence.Q.value = 0.7;
    presence.gain.value = 4;

    // Low-mid warmth
    const warmth = this.audioContext.createBiquadFilter();
    warmth.type = 'peaking';
    warmth.frequency.value = 250;
    warmth.Q.value = 0.5;
    warmth.gain.value = 2;

    presence.connect(warmth);

    return presence;
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    const voice = {
      oscillators: [],
      gains: [],
      filters: [],
      noiseGains: [],
      startTime: time,
    };

    // Trumpet section (3 layers)
    for (let i = 0; i < 3; i++) {
      const osc1 = this.audioContext.createOscillator();
      const osc2 = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();
      const panner = this.audioContext.createStereoPanner();

      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.value = frequency;
      osc2.frequency.value = frequency;

      osc1.detune.value = (i - 1) * 5 + (Math.random() - 0.5) * 3;
      osc2.detune.value = (i - 1) * 5 + (Math.random() - 0.5) * 3;

      // Tiny pitch blip at note-on for brassy speak
      osc1.detune.setValueAtTime(20, time);
      osc1.detune.linearRampToValueAtTime(0, time + 0.06);
      osc2.detune.setValueAtTime(20, time);
      osc2.detune.linearRampToValueAtTime(0, time + 0.06);

      // Mix oscillators
      const oscMixer = this.audioContext.createGain();
      const osc1Gain = this.audioContext.createGain();
      const osc2Gain = this.audioContext.createGain();

      osc1Gain.gain.value = 0.7;
      osc2Gain.gain.value = 0.3;

      osc1.connect(osc1Gain);
      osc2.connect(osc2Gain);
      osc1Gain.connect(oscMixer);
      osc2Gain.connect(oscMixer);

      // Dynamic filter envelope for brass "blat"
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800 + velocity * 2000, time);
      filter.frequency.linearRampToValueAtTime(
        2000 + velocity * 3000,
        time + 0.03,
      );
      filter.frequency.exponentialRampToValueAtTime(
        900 + velocity * 1200,
        time + 0.25,
      );
      filter.Q.value = 5; // Softer resonance to prevent harshness

      // Stereo spread
      panner.pan.value = (i - 1) * 0.3;

      oscMixer.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.output);

      voice.oscillators.push(osc1, osc2);
      voice.gains.push(gain);
      voice.filters.push(filter);
    }

    // French horn (2 layers, softer)
    for (let i = 0; i < 2; i++) {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();
      const panner = this.audioContext.createStereoPanner();

      osc.type = 'sawtooth';
      osc.frequency.value = frequency / 2; // One octave down
      osc.detune.value = i * 8;

      filter.type = 'bandpass';
      filter.frequency.value = 700;
      filter.Q.value = 2;

      panner.pan.value = i === 0 ? -0.5 : 0.5;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.output);

      voice.oscillators.push(osc);
      voice.gains.push(gain);
      voice.filters.push(filter);
    }

    // Trombone/Tuba (low brass)
    const lowOsc = this.audioContext.createOscillator();
    const lowGain = this.audioContext.createGain();
    const lowFilter = this.audioContext.createBiquadFilter();

    lowOsc.type = 'sawtooth';
    lowOsc.frequency.value = frequency / 4; // Two octaves down

    lowFilter.type = 'lowpass';
    lowFilter.frequency.value = 500;
    lowFilter.Q.value = 3;

    lowOsc.connect(lowFilter);
    lowFilter.connect(lowGain);
    lowGain.connect(this.output);

    voice.oscillators.push(lowOsc);
    voice.gains.push(lowGain);
    voice.filters.push(lowFilter);

    // Breath noise for realism
    const noise = this.audioContext.createBufferSource();
    const noiseBuffer = this.audioContext.createBuffer(
      1,
      4096,
      this.audioContext.sampleRate,
    );
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < 4096; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const noiseFilter = this.audioContext.createBiquadFilter();
    const noiseGain = this.audioContext.createGain();

    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2000;
    noiseFilter.Q.value = 1;

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.output);

    voice.oscillators.push(noise);
    voice.noiseGains.push(noiseGain);

    // Brass envelope (fast attack, quick "blat")
    const attack = 0.01 + Math.random() * 0.02;
    const decay = 0.1;
    const sustain = 0.7;
    const peak = velocity * 0.2;

    // Trumpets with characteristic "blat"
    voice.gains.slice(0, 3).forEach((gain, i) => {
      const delay = i * 0.005;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(peak * 1.2, time + attack + delay); // Overshoot
      gain.gain.exponentialRampToValueAtTime(
        peak * sustain + 0.001,
        time + attack + decay + delay,
      );
    });

    // French horns (softer attack)
    voice.gains.slice(3, 5).forEach((gain, i) => {
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(peak * 0.6, time + attack * 2);
      gain.gain.exponentialRampToValueAtTime(
        peak * sustain * 0.6 + 0.001,
        time + attack * 2 + decay,
      );
    });

    // Low brass (slowest attack)
    lowGain.gain.setValueAtTime(0.0001, time);
    lowGain.gain.linearRampToValueAtTime(peak * 0.4, time + attack * 3);
    lowGain.gain.exponentialRampToValueAtTime(
      peak * sustain * 0.4 + 0.001,
      time + attack * 3 + decay,
    );

    // Breath noise envelope
    noiseGain.gain.setValueAtTime(0.0001, time);
    noiseGain.gain.linearRampToValueAtTime(peak * 0.05, time + attack * 0.5);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + attack + 0.05);

    // Filter modulation for "wah"
    // Already handled above with filter envelope for trumpets

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
      const releaseTime = 0.3; // Quick brass release

      voice.gains.forEach((gain) => {
        const p = gain.gain;
        if (typeof p.cancelAndHoldAtTime === 'function') {
          p.cancelAndHoldAtTime(when);
        } else {
          p.cancelScheduledValues(when);
          const tc = Math.max(0.005, releaseTime * 0.2);
          p.setTargetAtTime(0.0001, when, tc);
        }
        p.exponentialRampToValueAtTime(0.0001, when + releaseTime);
      });

      voice.noiseGains?.forEach((gain) => {
        const p = gain.gain;
        if (typeof p.cancelAndHoldAtTime === 'function') {
          p.cancelAndHoldAtTime(when);
        } else {
          p.cancelScheduledValues(when);
          p.setTargetAtTime(0.0001, when, 0.02);
        }
        p.exponentialRampToValueAtTime(0.0001, when + releaseTime);
      });

      setTimeout(
        () => {
          voice.oscillators.forEach((osc) => {
            try {
              osc.stop();
            } catch {}
          });
          voices.delete(voice);
          if (voices.size === 0) this.activeNotes.delete(midiNote);
        },
        (releaseTime + 0.1) * 1000,
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
      gain.gain.setValueAtTime(0.0001, time);
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

// Basic Pipe Organ Synthesizer
export class PipeOrgan extends BaseInstrument {
  constructor(audioContext) {
    super(audioContext);

    // Pipe organ typically has multiple ranks (sets of pipes)
    // We'll simulate different pipe footages (16', 8', 4', 2', 1')
    this.ranks = {
      16: 0.5, // Sub-octave
      8: 1, // Fundamental
      4: 2, // Octave
      2: 4, // Super-octave
      1: 8, // Two octaves up
      '5⅓': 1.5, // Quint (perfect fifth)
      '2⅔': 3, // Twelfth
    };

    // Rank volumes (drawbar-like settings)
    this.rankGains = {
      16: 0.3,
      8: 1.0, // Fundamental is loudest
      4: 0.7,
      2: 0.4,
      1: 0.2,
      '5⅓': 0.3,
      '2⅔': 0.2,
    };

    // Create a subtle reverb for church-like sound
    this.reverb = this.createOrganReverb();

    // Connect output through reverb
    this.dryGain = audioContext.createGain();
    this.dryGain.gain.value = 0.7;
    this.wetGain = audioContext.createGain();
    this.wetGain.gain.value = 0.3;

    this.output.connect(this.dryGain);
    this.output.connect(this.reverb);
    this.reverb.connect(this.wetGain);

    // Final output
    this.finalOutput = audioContext.createGain();
    this.dryGain.connect(this.finalOutput);
    this.wetGain.connect(this.finalOutput);
  }

  connect(destination) {
    this.finalOutput.connect(destination);
  }

  disconnect() {
    this.finalOutput.disconnect();
  }

  createOrganReverb() {
    const convolver = this.audioContext.createConvolver();
    const length = this.audioContext.sampleRate * 3; // 3 second reverb
    const impulse = this.audioContext.createBuffer(
      2,
      length,
      this.audioContext.sampleRate,
    );

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Create a church-like reverb decay
        const decay = Math.pow(1 - i / length, 2);
        channelData[i] = (Math.random() * 2 - 1) * decay;
      }
    }

    convolver.buffer = impulse;
    return convolver;
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    const voice = {
      oscillators: [],
      gains: [],
      filters: [],
      startTime: time,
    };

    // Create oscillators for each rank
    Object.entries(this.ranks).forEach(([footage, multiplier]) => {
      // Each rank gets slight detuning for richness
      const detuneCents = (Math.random() - 0.5) * 4; // ±2 cents

      // Create the main oscillator for this rank
      const osc = this.audioContext.createOscillator();
      osc.frequency.value = frequency * multiplier;
      osc.detune.value = detuneCents;

      // Pipe organs use relatively simple waveforms
      // Mix of sine (flute pipes) and sawtooth (reed pipes)
      if (footage === '16' || footage === '8') {
        osc.type = 'sine'; // Flute pipes for fundamental tones
      } else {
        osc.type = 'sawtooth'; // Reed pipes for harmonics
      }

      // Create a bandpass filter to shape the tone
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = frequency * multiplier * 2;
      filter.Q.value = 1.5;

      // Individual gain for this rank
      const gain = this.audioContext.createGain();
      gain.gain.value = 0;

      // Connect oscillator -> filter -> gain -> output
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.output);

      voice.oscillators.push(osc);
      voice.gains.push(gain);
      voice.filters.push(filter);
    });

    // Pipe organ envelope - very fast attack, sustained, medium release
    const attack = 0.01; // Instant speech
    const release = 0.5; // Natural pipe decay

    // Apply envelope to all ranks
    voice.gains.forEach((gain, index) => {
      const footage = Object.keys(this.ranks)[index];
      const rankGain = this.rankGains[footage] || 0.5;
      const targetGain = velocity * rankGain * 0.1; // Scale down to prevent clipping

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(targetGain, time + attack);
    });

    // Add subtle tremulant (vibrato) effect
    const tremulant = this.audioContext.createOscillator();
    tremulant.frequency.value = 4.5; // Classic tremulant speed
    tremulant.type = 'sine';

    const tremulantGain = this.audioContext.createGain();
    tremulantGain.gain.value = 2; // Very subtle pitch modulation

    tremulant.connect(tremulantGain);

    // Apply tremulant to each oscillator
    voice.oscillators.forEach((osc) => {
      tremulantGain.connect(osc.detune);
    });

    // Start all oscillators
    voice.oscillators.forEach((osc) => osc.start(time));
    tremulant.start(time);

    // Store the tremulant in voice for cleanup
    voice.tremulant = tremulant;
    voice.release = release;

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
      const { gains, oscillators, tremulant, release } = voice;
      const end = when + release;

      // Fade out all gains
      gains.forEach((gain) => {
        gain.gain.cancelScheduledValues(when);
        const currentValue = gain.gain.value;
        gain.gain.setValueAtTime(currentValue, when);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
      });

      // Stop oscillators after release
      setTimeout(
        () => {
          oscillators.forEach((osc) => {
            try {
              osc.stop();
            } catch {}
          });
          try {
            tremulant.stop();
          } catch {}
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

// Reed Organ/Harmonium Synthesizer
export class ReedOrgan extends BaseInstrument {
  constructor(audioContext) {
    super(audioContext);

    // Reed organs have fewer harmonics than pipe organs
    // They produce a warm, breathy, slightly nasal tone
    this.reedRanks = {
      8: 1, // Fundamental
      4: 2, // Octave
      16: 0.5, // Sub-octave (not all harmoniums have this)
    };

    // Reed organ specific characteristics
    this.reedGains = {
      8: 1.0, // Fundamental is dominant
      4: 0.3, // Gentle octave
      16: 0.4, // Subtle bass
    };

    // Create filters for the characteristic reed organ sound
    this.masterFilter = audioContext.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 2000; // Warm, mellow tone
    this.masterFilter.Q.value = 0.5;

    // Add a highpass to remove mud
    this.highpass = audioContext.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = 80;
    this.highpass.Q.value = 0.7;

    // Subtle chorus for the characteristic harmonium wobble
    this.chorus = this.createHarmoniumChorus();

    // Compression for consistent reed response
    this.compressor = audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.01;
    this.compressor.release.value = 0.1;

    // Signal path
    this.output.connect(this.highpass);
    this.highpass.connect(this.masterFilter);
    this.masterFilter.connect(this.chorus.input);
    this.chorus.output.connect(this.compressor);

    // Final output
    this.finalOutput = audioContext.createGain();
    this.finalOutput.gain.value = 0.7; // Prevent clipping
    this.compressor.connect(this.finalOutput);
  }

  connect(destination) {
    this.finalOutput.connect(destination);
  }

  disconnect() {
    this.finalOutput.disconnect();
  }

  createHarmoniumChorus() {
    // Harmonium has a natural chorus from multiple reeds
    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();

    // Create two delayed paths for chorus effect
    const delay1 = this.audioContext.createDelay(0.05);
    const delay2 = this.audioContext.createDelay(0.05);

    // LFOs for delay modulation - slower than typical chorus
    const lfo1 = this.audioContext.createOscillator();
    const lfo2 = this.audioContext.createOscillator();
    const lfoGain1 = this.audioContext.createGain();
    const lfoGain2 = this.audioContext.createGain();

    lfo1.frequency.value = 0.7; // Slow wobble
    lfo2.frequency.value = 0.9; // Slightly different rate
    lfoGain1.gain.value = 0.002; // Subtle modulation
    lfoGain2.gain.value = 0.0015;

    lfo1.connect(lfoGain1);
    lfo2.connect(lfoGain2);
    lfoGain1.connect(delay1.delayTime);
    lfoGain2.connect(delay2.delayTime);

    delay1.delayTime.value = 0.012;
    delay2.delayTime.value = 0.018;

    // Mix dry and wet
    const dryGain = this.audioContext.createGain();
    const wetGain1 = this.audioContext.createGain();
    const wetGain2 = this.audioContext.createGain();

    dryGain.gain.value = 0.7;
    wetGain1.gain.value = 0.15;
    wetGain2.gain.value = 0.15;

    input.connect(dryGain);
    input.connect(delay1);
    input.connect(delay2);

    delay1.connect(wetGain1);
    delay2.connect(wetGain2);

    dryGain.connect(output);
    wetGain1.connect(output);
    wetGain2.connect(output);

    lfo1.start();
    lfo2.start();

    return { input, output };
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    const voice = {
      oscillators: [],
      gains: [],
      filters: [],
      noiseGain: null,
      startTime: time,
    };

    // Add breath noise for realism
    const noise = this.audioContext.createBufferSource();
    const noiseBuffer = this.audioContext.createBuffer(
      1,
      this.audioContext.sampleRate * 2,
      this.audioContext.sampleRate,
    );
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() - 0.5) * 0.2;
    }
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Filter the noise to make it breathy
    const noiseFilter = this.audioContext.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = frequency * 2;
    noiseFilter.Q.value = 5;

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.value = 0;

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.output);

    voice.noise = noise;
    voice.noiseGain = noiseGain;

    // Create oscillators for each reed rank
    Object.entries(this.reedRanks).forEach(([footage, multiplier]) => {
      // Reed organs have natural beating between reeds
      // Create two slightly detuned oscillators per rank
      for (let i = 0; i < 2; i++) {
        const osc = this.audioContext.createOscillator();
        osc.frequency.value = frequency * multiplier;

        // Natural reed detuning creates beating
        const detuneCents = (i === 0 ? -2 : 2) + (Math.random() - 0.5) * 2;
        osc.detune.value = detuneCents;

        // Reed organs produce a complex waveform
        // Mix between sawtooth (bright reeds) and triangle (mellow reeds)
        osc.type = footage === '16' ? 'triangle' : 'sawtooth';

        // Individual filter for each reed
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = frequency * multiplier * 1.5;
        filter.Q.value = 2; // Fairly resonant

        // Add formant filter for reed character
        const formant = this.audioContext.createBiquadFilter();
        formant.type = 'peaking';
        formant.frequency.value = 700 + (Math.random() - 0.5) * 100;
        formant.Q.value = 3;
        formant.gain.value = 6;

        const gain = this.audioContext.createGain();
        gain.gain.value = 0;

        // Connect: osc -> filter -> formant -> gain -> output
        osc.connect(filter);
        filter.connect(formant);
        formant.connect(gain);
        gain.connect(this.output);

        voice.oscillators.push(osc);
        voice.gains.push(gain);
        voice.filters.push(filter);
      }
    });

    // Reed organ envelope - slow attack (air pressure building)
    const attack = 0.08; // Slower than pipe organ
    const release = 0.3; // Quick release when bellows stop

    // Apply envelope
    const rankFootages = Object.keys(this.reedRanks);
    voice.gains.forEach((gain, index) => {
      const rankIndex = Math.floor(index / 2); // 2 oscillators per rank
      const footage = rankFootages[rankIndex];
      const rankGain = this.reedGains[footage] || 0.5;
      const targetGain = velocity * rankGain * 0.08; // Scale for multiple oscillators

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(targetGain, time + attack);
    });

    // Breath noise envelope
    const noiseLevel = velocity * 0.015; // Very subtle
    voice.noiseGain.gain.setValueAtTime(0.0001, time);
    voice.noiseGain.gain.exponentialRampToValueAtTime(
      noiseLevel,
      time + attack * 0.5,
    );

    // Add subtle pitch bend at start (air pressure stabilizing)
    voice.oscillators.forEach((osc) => {
      const startDetune = osc.detune.value;
      osc.detune.setValueAtTime(startDetune - 10, time);
      osc.detune.linearRampToValueAtTime(startDetune, time + attack);
    });

    // Start all sound sources
    voice.oscillators.forEach((osc) => osc.start(time));
    voice.noise.start(time);

    voice.release = release;

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
      const { gains, oscillators, noise, noiseGain, release } = voice;
      const end = when + release;

      // Fade out all gains
      gains.forEach((gain) => {
        gain.gain.cancelScheduledValues(when);
        const currentValue = gain.gain.value;
        gain.gain.setValueAtTime(currentValue, when);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
      });

      // Fade out breath noise
      noiseGain.gain.cancelScheduledValues(when);
      noiseGain.gain.setValueAtTime(noiseGain.gain.value, when);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, end);

      // Slight pitch drop as air pressure releases
      oscillators.forEach((osc) => {
        const currentDetune = osc.detune.value;
        osc.detune.setValueAtTime(currentDetune, when);
        osc.detune.linearRampToValueAtTime(currentDetune - 5, end);
      });

      // Stop all sources after release
      setTimeout(
        () => {
          oscillators.forEach((osc) => {
            try {
              osc.stop();
            } catch {}
          });
          try {
            noise.stop();
          } catch {}
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

// Theremin Synthesizer
export class Theremin extends BaseInstrument {
  constructor(audioContext) {
    super(audioContext);

    // Theremin characteristics
    this.portamentoTime = 0.1; // Glide between notes
    this.vibratoRate = 5; // Hz
    this.vibratoDepth = 15; // Cents

    // Create vibrato LFO
    this.vibratoLFO = audioContext.createOscillator();
    this.vibratoLFO.frequency.value = this.vibratoRate;
    this.vibratoLFO.type = 'sine';
    this.vibratoGain = audioContext.createGain();
    this.vibratoGain.gain.value = this.vibratoDepth;
    this.vibratoLFO.connect(this.vibratoGain);
    this.vibratoLFO.start();

    // Create tremolo for amplitude modulation
    this.tremoloLFO = audioContext.createOscillator();
    this.tremoloLFO.frequency.value = 4;
    this.tremoloLFO.type = 'sine';
    this.tremoloGain = audioContext.createGain();
    this.tremoloGain.gain.value = 0.1; // Subtle tremolo
    this.tremoloLFO.connect(this.tremoloGain);
    this.tremoloLFO.start();

    // Master filter for tone shaping
    this.toneFilter = audioContext.createBiquadFilter();
    this.toneFilter.type = 'lowpass';
    this.toneFilter.frequency.value = 3000;
    this.toneFilter.Q.value = 2;

    // Add some resonance for character
    this.resonanceFilter = audioContext.createBiquadFilter();
    this.resonanceFilter.type = 'peaking';
    this.resonanceFilter.frequency.value = 1500;
    this.resonanceFilter.Q.value = 5;
    this.resonanceFilter.gain.value = 3;

    // Reverb for that ethereal quality
    this.reverb = this.createThereminReverb();

    // Signal routing
    this.dryGain = audioContext.createGain();
    this.dryGain.gain.value = 0.6;
    this.wetGain = audioContext.createGain();
    this.wetGain.gain.value = 0.4;

    this.output.connect(this.toneFilter);
    this.toneFilter.connect(this.resonanceFilter);
    this.resonanceFilter.connect(this.dryGain);
    this.resonanceFilter.connect(this.reverb);
    this.reverb.connect(this.wetGain);

    // Final output with tremolo
    this.finalOutput = audioContext.createGain();
    this.finalOutput.gain.value = 0.8;

    this.dryGain.connect(this.finalOutput);
    this.wetGain.connect(this.finalOutput);

    // Connect tremolo to final output gain
    this.tremoloGain.connect(this.finalOutput.gain);

    // Track current playing voice for portamento
    this.currentVoice = null;
    this.lastFrequency = 0;
  }

  connect(destination) {
    this.finalOutput.connect(destination);
  }

  disconnect() {
    this.finalOutput.disconnect();
  }

  createThereminReverb() {
    const convolver = this.audioContext.createConvolver();
    const length = this.audioContext.sampleRate * 2;
    const impulse = this.audioContext.createBuffer(
      2,
      length,
      this.audioContext.sampleRate,
    );

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Smooth, ethereal reverb
        const decay = Math.pow(1 - i / length, 1.5);
        channelData[i] = (Math.random() * 2 - 1) * decay * 0.5;
      }
    }

    convolver.buffer = impulse;
    return convolver;
  }

  playNote(midiNote, velocity = 1, time = this.audioContext.currentTime) {
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    // If there's already a note playing, we'll glide to the new one
    if (this.currentVoice && this.activeNotes.size > 0) {
      // Portamento - glide the frequency
      const osc = this.currentVoice.oscillator;
      osc.frequency.cancelScheduledValues(time);
      osc.frequency.setValueAtTime(osc.frequency.value, time);
      osc.frequency.exponentialRampToValueAtTime(
        frequency,
        time + this.portamentoTime,
      );

      // Update heterodyne oscillators
      this.currentVoice.heterodyneOscs.forEach((hetOsc, i) => {
        const hetFreq = frequency + (i === 0 ? 1.5 : -1.2);
        hetOsc.frequency.cancelScheduledValues(time);
        hetOsc.frequency.setValueAtTime(hetOsc.frequency.value, time);
        hetOsc.frequency.exponentialRampToValueAtTime(
          hetFreq,
          time + this.portamentoTime,
        );
      });

      // Update the stored frequency
      this.currentVoice.frequency = frequency;
      this.lastFrequency = frequency;

      // Add to active notes but reuse the same voice
      let set = this.activeNotes.get(midiNote);
      if (!set) {
        set = new Set();
        this.activeNotes.set(midiNote, set);
      }
      set.add(this.currentVoice);

      return this.currentVoice;
    }

    // Create new voice
    const voice = {
      oscillator: null,
      heterodyneOscs: [],
      gains: [],
      frequency: frequency,
      startTime: time,
    };

    // Main oscillator - sine wave for classic theremin
    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = this.lastFrequency || frequency;

    // Glide from last frequency if available
    if (this.lastFrequency && Math.abs(this.lastFrequency - frequency) > 1) {
      osc.frequency.setValueAtTime(this.lastFrequency, time);
      osc.frequency.exponentialRampToValueAtTime(
        frequency,
        time + this.portamentoTime,
      );
    } else {
      osc.frequency.setValueAtTime(frequency, time);
    }

    // Connect vibrato
    this.vibratoGain.connect(osc.detune);

    // Create heterodyne oscillators for richer tone
    // These create the characteristic theremin beating
    const hetFrequencies = [1.5, -1.2]; // Slight frequency offsets

    hetFrequencies.forEach((offset) => {
      const hetOsc = this.audioContext.createOscillator();
      hetOsc.type = 'sine';
      hetOsc.frequency.value = (this.lastFrequency || frequency) + offset;

      if (this.lastFrequency) {
        hetOsc.frequency.setValueAtTime(this.lastFrequency + offset, time);
        hetOsc.frequency.exponentialRampToValueAtTime(
          frequency + offset,
          time + this.portamentoTime,
        );
      }

      const hetGain = this.audioContext.createGain();
      hetGain.gain.value = 0.15; // Subtle beating

      hetOsc.connect(hetGain);
      hetGain.connect(this.output);

      voice.heterodyneOscs.push(hetOsc);
      voice.gains.push(hetGain);
    });

    // Main oscillator gain
    const mainGain = this.audioContext.createGain();
    mainGain.gain.value = 0;

    osc.connect(mainGain);
    mainGain.connect(this.output);

    voice.oscillator = osc;
    voice.gains.push(mainGain);

    // Theremin envelope - smooth attack and release
    const attack = 0.15;
    const release = 0.3;

    const targetGain = velocity * 0.7;
    mainGain.gain.setValueAtTime(0.0001, time);
    mainGain.gain.exponentialRampToValueAtTime(targetGain, time + attack);

    // Heterodyne gains
    voice.heterodyneOscs.forEach((_, i) => {
      const gain = voice.gains[i];
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.15 * velocity, time + attack);
    });

    // Start oscillators
    osc.start(time);
    voice.heterodyneOscs.forEach((ho) => ho.start(time));

    // Store as current voice
    this.currentVoice = voice;
    this.lastFrequency = frequency;
    voice.release = release;

    // Store in active notes
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
      const { gains, oscillator, heterodyneOscs, release } = voice;
      const end = when + release;

      // Only stop if this is the last note
      // (Theremin is monophonic with portamento)
      const totalActiveNotes = Array.from(this.activeNotes.values()).reduce(
        (sum, set) => sum + set.size,
        0,
      );

      if (totalActiveNotes <= 1) {
        // This is the last note, so fade out
        gains.forEach((gain) => {
          gain.gain.cancelScheduledValues(when);
          const currentValue = gain.gain.value;
          gain.gain.setValueAtTime(currentValue, when);
          gain.gain.exponentialRampToValueAtTime(0.0001, end);
        });

        // Stop oscillators after release
        setTimeout(
          () => {
            try {
              oscillator.stop();
            } catch {}
            heterodyneOscs.forEach((osc) => {
              try {
                osc.stop();
              } catch {}
            });

            // Clear current voice
            if (this.currentVoice === voice) {
              this.currentVoice = null;
            }

            voices.delete(voice);
            if (voices.size === 0) this.activeNotes.delete(midiNote);
          },
          (release + 0.1) * 1000,
        );
      } else {
        // Other notes are active, just remove this from tracking
        voices.delete(voice);
        if (voices.size === 0) this.activeNotes.delete(midiNote);
      }
    };

    if (typeof handleOrTime === 'object' && handleOrTime) {
      stopVoice(handleOrTime, this.audioContext.currentTime);
    } else {
      const when = Number(handleOrTime) || this.audioContext.currentTime;
      Array.from(voices).forEach((v) => stopVoice(v, when));
    }
  }

  // Additional methods for real-time control
  setPortamento(time) {
    this.portamentoTime = Math.max(0, Math.min(1, time));
  }

  setVibrato(rate, depth) {
    this.vibratoLFO.frequency.value = rate;
    this.vibratoGain.gain.value = depth;
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
    case 'wuulf2':
      return new Wuulf2Synth(audioContext);
    case 'strings':
      return new StringEnsemble(audioContext);
    case 'brass':
      return new BrassSection(audioContext);
    case 'organ':
      return new PipeOrgan(audioContext);
    case 'reedorgan':
      return new ReedOrgan(audioContext);
    case 'theremin':
      return new Theremin(audioContext);
    default:
      return new SubtractiveSynth(audioContext, 'default');
  }
}
