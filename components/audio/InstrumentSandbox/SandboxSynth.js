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
      // Basic
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
      distortion: 0,

      // Advanced parameters
      osc2Enabled: false,
      osc2Type: 'sawtooth',
      osc2Detune: 7,
      osc2Pitch: 0,
      oscMix: 50,
      fmAmount: 0,
      ringModAmount: 0,
      oscSync: false,
      subOscEnabled: false,
      subOscType: 'square',
      subOscLevel: 50,
      noiseLevel: 0,
      noiseType: 'white',
      filterType: 'lowpass',
      filterDrive: 0,
      filterEnvAmount: 0,
      filterAttack: 0.01,
      filterDecay: 0.2,
      filterSustain: 0.5,
      filterRelease: 0.3,
      pulseWidth: 50,
      pwmAmount: 0,
      pwmRate: 4,
      lfo2Target: 'off',
      lfo2Rate: 2,
      lfo2Amount: 0
    };

    // LFO setup
    this.lfo = audioContext.createOscillator();
    this.lfoGain = audioContext.createGain();
    this.lfo.frequency.value = this.params.lfoRate;
    this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain);
    this.lfo.start();

    // LFO 2 setup
    this.lfo2 = audioContext.createOscillator();
    this.lfo2Gain = audioContext.createGain();
    this.lfo2.frequency.value = this.params.lfo2Rate || 2;
    this.lfo2Gain.gain.value = 0;
    this.lfo2.connect(this.lfo2Gain);
    this.lfo2.start();

    // PWM LFO setup
    this.pwmLfo = audioContext.createOscillator();
    this.pwmLfoGain = audioContext.createGain();
    this.pwmLfo.frequency.value = this.params.pwmRate || 4;
    this.pwmLfoGain.gain.value = 0;
    this.pwmLfo.connect(this.pwmLfoGain);
    this.pwmLfo.start();

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

    // Update LFO 2
    this.lfo2.frequency.value = this.params.lfo2Rate || 2;
    this.lfo2Gain.gain.value = (this.params.lfo2Amount || 0) / 100;

    // Update PWM LFO
    this.pwmLfo.frequency.value = this.params.pwmRate || 4;
    this.pwmLfoGain.gain.value = (this.params.pwmAmount || 0) / 100;

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
      oscillator2: null,
      subOscillator: null,
      noiseSource: null,
      oscMixer: null,
      filter: null,
      envelope: null,
      noteGain: null,
      startTime: time,
      cleanup: null // Track cleanup timeout
    };

    // Create oscillator mixer
    voice.oscMixer = this.audioContext.createGain();

    // Main Oscillator
    voice.oscillator = this.audioContext.createOscillator();

    // For square waves with PWM, we'll use a custom periodic wave
    if (this.params.oscillatorType === 'square' && this.params.pwmAmount > 0) {
      // Create a pulse wave with variable width
      const pulseWidth = this.params.pulseWidth / 100;
      const real = new Float32Array(128);
      const imag = new Float32Array(128);

      for (let i = 1; i < 128; i++) {
        const harmonic = i;
        imag[i] = (2 / (Math.PI * harmonic)) * Math.sin(Math.PI * harmonic * pulseWidth);
      }

      const pulseWave = this.audioContext.createPeriodicWave(real, imag);
      voice.oscillator.setPeriodicWave(pulseWave);

      // Store pulse wave data for PWM modulation
      voice.isPulseWave = true;
      voice.basePulseWidth = this.params.pulseWidth;
    } else {
      voice.oscillator.type = this.params.oscillatorType;
      voice.isPulseWave = false;
    }

    voice.oscillator.frequency.value = frequency;
    voice.oscillator.detune.value = this.params.detune;

    // Oscillator 1 gain (controlled by mix)
    const osc1Gain = this.audioContext.createGain();
    osc1Gain.gain.value = this.params.osc2Enabled ? (100 - this.params.oscMix) / 100 : 1;
    voice.oscillator.connect(osc1Gain);
    osc1Gain.connect(voice.oscMixer);

    // Second Oscillator (if enabled)
    if (this.params.osc2Enabled) {
      voice.oscillator2 = this.audioContext.createOscillator();
      voice.oscillator2.type = this.params.osc2Type;
      voice.oscillator2.frequency.value = frequency * Math.pow(2, this.params.osc2Pitch / 12);
      voice.oscillator2.detune.value = this.params.osc2Detune;

      const osc2Gain = this.audioContext.createGain();
      osc2Gain.gain.value = this.params.oscMix / 100;
      voice.oscillator2.connect(osc2Gain);
      osc2Gain.connect(voice.oscMixer);
    }

    // Sub-Oscillator (if enabled)
    if (this.params.subOscEnabled) {
      voice.subOscillator = this.audioContext.createOscillator();
      voice.subOscillator.type = this.params.subOscType;
      voice.subOscillator.frequency.value = frequency / 2; // One octave below

      const subGain = this.audioContext.createGain();
      subGain.gain.value = this.params.subOscLevel / 100;
      voice.subOscillator.connect(subGain);
      subGain.connect(voice.oscMixer);
    }

    // Noise Generator (if enabled)
    if (this.params.noiseLevel > 0) {
      const bufferSize = this.audioContext.sampleRate * 2; // 2 seconds of noise
      const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = noiseBuffer.getChannelData(0);

      // Generate noise based on type
      if (this.params.noiseType === 'white') {
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
      } else if (this.params.noiseType === 'pink') {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
      }

      voice.noiseSource = this.audioContext.createBufferSource();
      voice.noiseSource.buffer = noiseBuffer;
      voice.noiseSource.loop = true;

      const noiseGain = this.audioContext.createGain();
      noiseGain.gain.value = this.params.noiseLevel / 100;
      voice.noiseSource.connect(noiseGain);
      noiseGain.connect(voice.oscMixer);
    }

    // Apply LFO to pitch
    if (this.params.lfoAmount > 0) {
      this.lfoGain.connect(voice.oscillator.frequency);
      if (voice.oscillator2) {
        this.lfoGain.connect(voice.oscillator2.frequency);
      }
    }

    // Apply LFO2 routing
    if (this.params.lfo2Target && this.params.lfo2Target !== 'off' && this.params.lfo2Amount > 0) {
      const lfo2Amount = this.params.lfo2Amount / 100;

      if (this.params.lfo2Target === 'pitch') {
        // Modulate pitch
        const pitchModGain = this.audioContext.createGain();
        pitchModGain.gain.value = frequency * 0.05 * lfo2Amount; // +/- 5% pitch mod
        this.lfo2.connect(pitchModGain);
        pitchModGain.connect(voice.oscillator.frequency);
        if (voice.oscillator2) {
          pitchModGain.connect(voice.oscillator2.frequency);
        }
        voice.lfo2PitchMod = pitchModGain;
      } else if (this.params.lfo2Target === 'filter') {
        // Modulate filter cutoff
        const filterModGain = this.audioContext.createGain();
        filterModGain.gain.value = effectiveCutoff * 0.5 * lfo2Amount;
        this.lfo2.connect(filterModGain);
        filterModGain.connect(voice.filter.frequency);
        voice.lfo2FilterMod = filterModGain;
      } else if (this.params.lfo2Target === 'amp') {
        // Modulate amplitude (tremolo)
        const ampModGain = this.audioContext.createGain();
        ampModGain.gain.value = 0.5 * lfo2Amount;
        this.lfo2.connect(ampModGain);
        ampModGain.connect(voice.envelope.gain);
        voice.lfo2AmpMod = ampModGain;
      }
    }

    // Filter - with multiple types
    voice.filter = this.audioContext.createBiquadFilter();
    voice.filter.type = this.params.filterType;

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

    // Apply Filter Envelope if enabled
    if (this.params.filterEnvAmount && this.params.filterEnvAmount !== 0) {
      const filterEnvAmount = this.params.filterEnvAmount / 100;
      const baseFreq = effectiveCutoff;
      const maxFreq = Math.min(20000, baseFreq + (baseFreq * 4 * Math.abs(filterEnvAmount)));
      const minFreq = Math.max(20, baseFreq - (baseFreq * 0.9 * Math.abs(filterEnvAmount)));

      const targetFreq = filterEnvAmount > 0 ? maxFreq : minFreq;

      // Filter ADSR
      const filterAttackEnd = time + (this.params.filterAttack || 0.01);
      const filterDecayEnd = filterAttackEnd + (this.params.filterDecay || 0.2);
      const filterSustainLevel = this.params.filterSustain || 0.5;

      voice.filter.frequency.cancelScheduledValues(time);
      voice.filter.frequency.setValueAtTime(baseFreq, time);
      voice.filter.frequency.exponentialRampToValueAtTime(targetFreq, filterAttackEnd);
      voice.filter.frequency.exponentialRampToValueAtTime(
        baseFreq + (targetFreq - baseFreq) * filterSustainLevel,
        filterDecayEnd
      );

      // Store for release phase
      voice.filterEnvelope = {
        baseFreq,
        targetFreq,
        sustain: filterSustainLevel
      };
    }

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

    // Connect voice chain (oscMixer -> filter -> envelope -> noteGain -> effects)
    voice.oscMixer.connect(voice.filter);
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

    // Start all oscillators
    voice.oscillator.start(time);
    if (voice.oscillator2) {
      voice.oscillator2.start(time);
    }
    if (voice.subOscillator) {
      voice.subOscillator.start(time);
    }
    if (voice.noiseSource) {
      voice.noiseSource.start(time);
    }

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

        // Apply filter envelope release if it exists
        if (voice.filterEnvelope) {
          const filterReleaseTime = time + (this.params.filterRelease || 0.3);
          voice.filter.frequency.cancelScheduledValues(time);
          const currentFreq = voice.filter.frequency.value;
          voice.filter.frequency.setValueAtTime(currentFreq, time);
          voice.filter.frequency.exponentialRampToValueAtTime(
            voice.filterEnvelope.baseFreq,
            filterReleaseTime
          );
        }

        // Stop all oscillators after release
        voice.oscillator.stop(releaseTime);
        if (voice.oscillator2) {
          voice.oscillator2.stop(releaseTime);
        }
        if (voice.subOscillator) {
          voice.subOscillator.stop(releaseTime);
        }
        if (voice.noiseSource) {
          voice.noiseSource.stop(releaseTime);
        }

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
      if (voice.oscillator2) voice.oscillator2.disconnect();
      if (voice.subOscillator) voice.subOscillator.disconnect();
      if (voice.noiseSource) voice.noiseSource.disconnect();
      if (voice.oscMixer) voice.oscMixer.disconnect();
      voice.filter.disconnect();
      voice.envelope.disconnect();
      voice.noteGain.disconnect();

      // Disconnect LFO2 modulation if exists
      if (voice.lfo2PitchMod) {
        this.lfo2.disconnect(voice.lfo2PitchMod);
        voice.lfo2PitchMod.disconnect();
      }
      if (voice.lfo2FilterMod) {
        this.lfo2.disconnect(voice.lfo2FilterMod);
        voice.lfo2FilterMod.disconnect();
      }
      if (voice.lfo2AmpMod) {
        this.lfo2.disconnect(voice.lfo2AmpMod);
        voice.lfo2AmpMod.disconnect();
      }
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

    // Stop and disconnect all LFOs
    this.lfo.stop();
    this.lfo.disconnect();
    this.lfoGain.disconnect();

    this.lfo2.stop();
    this.lfo2.disconnect();
    this.lfo2Gain.disconnect();

    this.pwmLfo.stop();
    this.pwmLfo.disconnect();
    this.pwmLfoGain.disconnect();

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