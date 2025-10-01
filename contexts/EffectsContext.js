'use client';

import { createContext, useContext, useState, useRef, useCallback } from 'react';

const EffectsContext = createContext();

export const useEffects = () => {
  const context = useContext(EffectsContext);
  if (!context) {
    throw new Error('useEffects must be used within EffectsProvider');
  }
  return context;
};

export const EffectsProvider = ({ children }) => {
  // Global tempo sync state
  const [globalBPM, setGlobalBPM] = useState(120);
  const [tempoSyncEnabled, setTempoSyncEnabled] = useState(false);
  
  // EQ state - Enhanced with Mid/Side processing
  const [filters, setFilters] = useState([]);
  const [eqPresent, setEqPresent] = useState(false);
  const [eqLinearPhase, setEqLinearPhase] = useState(false);
  const [eqSpectrumAnalyzer, setEqSpectrumAnalyzer] = useState(true);
  const [eqBypass, setEqBypass] = useState(false);
  const [eqGain, setEqGain] = useState(0);
  const [eqMidSideMode, setEqMidSideMode] = useState(false); // Mid/Side processing mode
  const [eqMidFilters, setEqMidFilters] = useState([]); // Separate Mid channel filters
  const [eqSideFilters, setEqSideFilters] = useState([]); // Separate Side channel filters
  const [eqMidGain, setEqMidGain] = useState(0); // Mid channel output gain
  const [eqSideGain, setEqSideGain] = useState(0); // Side channel output gain
  const [eqStereoLink, setEqStereoLink] = useState(true); // Link Mid/Side adjustments
  
  // Echo state (was reverb)
  const [rvbPresent, setRvbPresent] = useState(false);
  const [inGain, setInGain] = useState(0);
  const [outGain, setOutGain] = useState(0);
  const [delay, setDelay] = useState(0);
  const [decay, setDecay] = useState(0);
  
  // Reverb state (new Web Audio reverb)
  const [reverbPresent, setReverbPresent] = useState(false);
  const [reverbPreset, setReverbPreset] = useState('mediumHall');
  const [reverbWetMix, setReverbWetMix] = useState(0.3);
  const [reverbPreDelay, setReverbPreDelay] = useState(0);
  const [reverbOutputGain, setReverbOutputGain] = useState(1);
  // New reverb parameters
  const [reverbHighDamp, setReverbHighDamp] = useState(0.5);
  const [reverbLowDamp, setReverbLowDamp] = useState(0.1);
  const [reverbEarlyLate, setReverbEarlyLate] = useState(0.5);
  const [reverbStereoWidth, setReverbStereoWidth] = useState(1);
  
  // Chorus state - Professional multi-voice chorus
  const [chorusPresent, setChorusPresent] = useState(false);
  const [chorusRate, setChorusRate] = useState(0.5); // LFO rate in Hz (0.1-10)
  const [chorusDepth, setChorusDepth] = useState(0.7); // Modulation depth (0-1)
  const [chorusDelay, setChorusDelay] = useState(10); // Base delay in ms (5-50)
  const [chorusFeedback, setChorusFeedback] = useState(0.2); // Feedback amount (0-0.9)
  const [chorusWetMix, setChorusWetMix] = useState(0.5); // Wet/dry mix (0-1)
  const [chorusVoices, setChorusVoices] = useState(3); // Number of voices (1-8)
  const [chorusStereoWidth, setChorusStereoWidth] = useState(1.0); // Stereo spread (0-2)
  const [chorusPhaseOffset, setChorusPhaseOffset] = useState(90); // Phase offset between L/R (0-180)
  const [chorusTempoSync, setChorusTempoSync] = useState(false);
  const [chorusNoteDivision, setChorusNoteDivision] = useState(4); // Quarter note = 4
  const [chorusWaveform, setChorusWaveform] = useState('sine'); // LFO waveform
  const [chorusOutputGain, setChorusOutputGain] = useState(1.0); // Output gain
  
  // Regions for cutting
  const [cutRegion, setCutRegion] = useState('');
  
  // Distortion state - Professional multi-type distortion/saturation
  const [distortionPresent, setDistortionPresent] = useState(false);
  const [distortionType, setDistortionType] = useState('tubeSaturation'); // Distortion algorithm
  const [distortionDrive, setDistortionDrive] = useState(5); // Drive amount (0-20dB)
  const [distortionTone, setDistortionTone] = useState(5000); // Tone filter frequency
  const [distortionPresence, setDistortionPresence] = useState(0); // High-frequency boost
  const [distortionBass, setDistortionBass] = useState(0); // Low-frequency adjustment
  const [distortionMid, setDistortionMid] = useState(0); // Mid-frequency adjustment
  const [distortionTreble, setDistortionTreble] = useState(0); // High-frequency adjustment
  const [distortionOutputGain, setDistortionOutputGain] = useState(0.7); // Output level
  const [distortionAsymmetry, setDistortionAsymmetry] = useState(0); // Asymmetric clipping
  const [distortionHarmonics, setDistortionHarmonics] = useState(0.5); // Harmonic generation
  const [distortionWetMix, setDistortionWetMix] = useState(1.0); // Wet/dry mix
  
  // Phaser state - Professional multi-stage phaser
  const [phaserPresent, setPhaserPresent] = useState(false);
  const [phaserRate, setPhaserRate] = useState(0.5); // LFO rate in Hz (0.01-10)
  const [phaserDepth, setPhaserDepth] = useState(0.7); // Modulation depth (0-1)
  const [phaserFeedback, setPhaserFeedback] = useState(0.5); // Feedback amount (0-0.95)
  const [phaserStages, setPhaserStages] = useState(4); // Number of all-pass stages (2-12)
  const [phaserWetMix, setPhaserWetMix] = useState(0.5); // Wet/dry mix (0-1)
  const [phaserTempoSync, setPhaserTempoSync] = useState(false);
  const [phaserNoteDivision, setPhaserNoteDivision] = useState(4); // Quarter note = 4
  const [phaserWaveform, setPhaserWaveform] = useState('sine'); // LFO waveform
  const [phaserFreqRange, setPhaserFreqRange] = useState([200, 2000]); // Frequency sweep range
  const [phaserResonance, setPhaserResonance] = useState(0.7); // Filter resonance/Q
  const [phaserStereoPhase, setPhaserStereoPhase] = useState(90); // L/R phase offset (0-180)
  const [phaserOutputGain, setPhaserOutputGain] = useState(1.0); // Output gain
  
  // Auto-Pan state
  const [autoPanPresent, setAutoPanPresent] = useState(false);
  const [autoPanRate, setAutoPanRate] = useState(1);
  const [autoPanDepth, setAutoPanDepth] = useState(1);
  const [autoPanWaveform, setAutoPanWaveform] = useState('sine');
  const [autoPanPhase, setAutoPanPhase] = useState(0);
  const [autoPanTempoSync, setAutoPanTempoSync] = useState(false);
  const [autoPanNoteDivision, setAutoPanNoteDivision] = useState(4);
  
  // Tremolo state
  const [tremoloPresent, setTremoloPresent] = useState(false);
  const [tremoloRate, setTremoloRate] = useState(5);
  const [tremoloDepth, setTremoloDepth] = useState(0.5);
  const [tremoloWaveform, setTremoloWaveform] = useState('sine');
  const [tremoloPhase, setTremoloPhase] = useState(0);
  const [tremoloTempoSync, setTremoloTempoSync] = useState(false);
  const [tremoloNoteDivision, setTremoloNoteDivision] = useState(4);
  
  // Compressor state - Enhanced with Mid/Side and Multiband processing
  const [compressorPresent, setCompressorPresent] = useState(false);
  const [compressorThreshold, setCompressorThreshold] = useState(-24);
  const [compressorRatio, setCompressorRatio] = useState(4);
  const [compressorAttack, setCompressorAttack] = useState(0.003);
  const [compressorRelease, setCompressorRelease] = useState(0.1);
  const [compressorKnee, setCompressorKnee] = useState(30);
  const [compressorMakeup, setCompressorMakeup] = useState(0);
  const [compressorLookahead, setCompressorLookahead] = useState(0);
  const [compressorSidechain, setCompressorSidechain] = useState(false);
  const [compressorModel, setCompressorModel] = useState('modern');
  const [compressorAutoMakeup, setCompressorAutoMakeup] = useState(true);
  
  // Mid/Side processing mode
  const [compressorMidSideMode, setCompressorMidSideMode] = useState(false);
  const [compressorMidThreshold, setCompressorMidThreshold] = useState(-24);
  const [compressorMidRatio, setCompressorMidRatio] = useState(4);
  const [compressorMidAttack, setCompressorMidAttack] = useState(0.003);
  const [compressorMidRelease, setCompressorMidRelease] = useState(0.1);
  const [compressorMidMakeup, setCompressorMidMakeup] = useState(0);
  const [compressorSideThreshold, setCompressorSideThreshold] = useState(-24);
  const [compressorSideRatio, setCompressorSideRatio] = useState(4);
  const [compressorSideAttack, setCompressorSideAttack] = useState(0.003);
  const [compressorSideRelease, setCompressorSideRelease] = useState(0.1);
  const [compressorSideMakeup, setCompressorSideMakeup] = useState(0);
  
  // Multiband processing mode
  const [compressorMultibandMode, setCompressorMultibandMode] = useState(false);
  const [compressorCrossoverFreqs, setCompressorCrossoverFreqs] = useState([250, 2000, 8000]);
  const [compressorBand0Threshold, setCompressorBand0Threshold] = useState(-24);
  const [compressorBand0Ratio, setCompressorBand0Ratio] = useState(4);
  const [compressorBand0Attack, setCompressorBand0Attack] = useState(0.01);
  const [compressorBand0Release, setCompressorBand0Release] = useState(0.2);
  const [compressorBand0Makeup, setCompressorBand0Makeup] = useState(0);
  const [compressorBand1Threshold, setCompressorBand1Threshold] = useState(-24);
  const [compressorBand1Ratio, setCompressorBand1Ratio] = useState(4);
  const [compressorBand1Attack, setCompressorBand1Attack] = useState(0.005);
  const [compressorBand1Release, setCompressorBand1Release] = useState(0.15);
  const [compressorBand1Makeup, setCompressorBand1Makeup] = useState(0);
  const [compressorBand2Threshold, setCompressorBand2Threshold] = useState(-24);
  const [compressorBand2Ratio, setCompressorBand2Ratio] = useState(4);
  const [compressorBand2Attack, setCompressorBand2Attack] = useState(0.003);
  const [compressorBand2Release, setCompressorBand2Release] = useState(0.1);
  const [compressorBand2Makeup, setCompressorBand2Makeup] = useState(0);
  const [compressorBand3Threshold, setCompressorBand3Threshold] = useState(-24);
  const [compressorBand3Ratio, setCompressorBand3Ratio] = useState(4);
  const [compressorBand3Attack, setCompressorBand3Attack] = useState(0.001);
  const [compressorBand3Release, setCompressorBand3Release] = useState(0.05);
  const [compressorBand3Makeup, setCompressorBand3Makeup] = useState(0);
  
  // Ring Modulator state - Professional ring modulation with multiple modes
  const [ringModPresent, setRingModPresent] = useState(false);
  const [ringModFrequency, setRingModFrequency] = useState(440); // Carrier frequency (20-8000 Hz)
  const [ringModWaveform, setRingModWaveform] = useState('sine'); // Carrier waveform
  const [ringModMix, setRingModMix] = useState(1.0); // Wet/dry mix (0-1)
  const [ringModDepth, setRingModDepth] = useState(1.0); // Modulation depth (0-1)
  const [ringModMode, setRingModMode] = useState('classic'); // classic, frequency, amplitude
  const [ringModSync, setRingModSync] = useState(false); // Frequency sync to input
  const [ringModOffset, setRingModOffset] = useState(0); // Frequency offset in Hz
  const [ringModPhase, setRingModPhase] = useState(0); // Phase offset (0-360 degrees)
  const [ringModFilterFreq, setRingModFilterFreq] = useState(20000); // Post-filter frequency
  const [ringModFilterType, setRingModFilterType] = useState('none'); // none, lowpass, highpass, bandpass
  const [ringModOutputGain, setRingModOutputGain] = useState(1.0); // Output gain (0-2)
  const [ringModStereoSpread, setRingModStereoSpread] = useState(0); // Stereo spread (0-1)
  
  // Glitch/Beat Repeat state
  const [glitchPresent, setGlitchPresent] = useState(false);
  const [glitchDivision, setGlitchDivision] = useState(16);
  const [glitchProbability, setGlitchProbability] = useState(0.3);
  const [glitchReverse, setGlitchReverse] = useState(0.2);
  const [glitchPitch, setGlitchPitch] = useState(0);
  const [glitchGate, setGlitchGate] = useState(1);
  
  // Frequency Shifter state
  const [freqShiftPresent, setFreqShiftPresent] = useState(false);
  const [freqShiftAmount, setFreqShiftAmount] = useState(0);
  const [freqShiftFeedback, setFreqShiftFeedback] = useState(0);
  const [freqShiftMix, setFreqShiftMix] = useState(0.5);
  
  // Granular Freeze state (legacy - reusing Sound Lab parameters)
  
  // Paulstretch state
  const [paulstretchPresent, setPaulstretchPresent] = useState(false);
  const [paulstretchFactor, setPaulstretchFactor] = useState(8);
  const [paulstretchWindow, setPaulstretchWindow] = useState(0.25);
  const [paulstretchSmooth, setPaulstretchSmooth] = useState(10);
  
  // Spectral Filter state
  const [spectralPresent, setSpectralPresent] = useState(false);

  // Granular Freeze state
  const [granularPresent, setGranularPresent] = useState(false);

  // Reverse Reverb state
  const [reverseReverbPresent, setReverseReverbPresent] = useState(false);
  const [reverseReverbPreset, setReverseReverbPreset] = useState('mediumHall');
  const [reverseReverbMix, setReverseReverbMix] = useState(0.7);
  const [reverseReverbFade, setReverseReverbFade] = useState(0.1);
  const [reverseReverbPredelay, setReverseReverbPredelay] = useState(0);
  const [reverseReverbBuildup, setReverseReverbBuildup] = useState(0.5);
  
  // Advanced Delay state - Professional multi-tap delay with modulation
  const [advDelayPresent, setAdvDelayPresent] = useState(false);
  const [advDelayTime, setAdvDelayTime] = useState(500); // Main delay time in ms (1-2000)
  const [advDelayFeedback, setAdvDelayFeedback] = useState(0.5); // Feedback amount (0-0.95)
  const [advDelayMix, setAdvDelayMix] = useState(0.5); // Wet/dry mix (0-1)
  const [advDelayPingPong, setAdvDelayPingPong] = useState(false); // Ping-pong stereo mode
  const [advDelayFilterFreq, setAdvDelayFilterFreq] = useState(2000); // Filter frequency (20-20000 Hz)
  const [advDelayFilterType, setAdvDelayFilterType] = useState('lowpass'); // Filter type
  const [advDelayTempoSync, setAdvDelayTempoSync] = useState(false); // Tempo synchronization
  const [advDelayNoteDivision, setAdvDelayNoteDivision] = useState(4); // Note division for sync
  const [advDelayTaps, setAdvDelayTaps] = useState(3); // Number of delay taps (1-8)
  const [advDelaySpread, setAdvDelaySpread] = useState(0.3); // Time spread between taps
  const [advDelayModRate, setAdvDelayModRate] = useState(0.5); // Modulation rate (0.1-10 Hz)
  const [advDelayModDepth, setAdvDelayModDepth] = useState(0.1); // Modulation depth (0-1)
  const [advDelayModWaveform, setAdvDelayModWaveform] = useState('sine'); // Modulation waveform
  const [advDelaySaturation, setAdvDelaySaturation] = useState(0); // Feedback saturation (0-1)
  const [advDelayDiffusion, setAdvDelayDiffusion] = useState(0.3); // Diffusion amount (0-1)
  const [advDelayStereoWidth, setAdvDelayStereoWidth] = useState(1.0); // Stereo width (0-2)
  const [advDelayOutputGain, setAdvDelayOutputGain] = useState(1.0); // Output gain (0-2)
  
  // Auto-Wah state - Enhanced with multiple LFO modes
  const [autoWahPresent, setAutoWahPresent] = useState(false);
  const [autoWahMode, setAutoWahMode] = useState('envelope'); // envelope, lfo, manual, hybrid
  const [autoWahFilterType, setAutoWahFilterType] = useState('bandpass'); // bandpass, lowpass, highpass, peaking
  const [autoWahSensitivity, setAutoWahSensitivity] = useState(0.5);
  const [autoWahFrequency, setAutoWahFrequency] = useState(500);
  const [autoWahRange, setAutoWahRange] = useState(2000);
  const [autoWahQ, setAutoWahQ] = useState(5);
  const [autoWahAttack, setAutoWahAttack] = useState(0.01);
  const [autoWahRelease, setAutoWahRelease] = useState(0.1);
  const [autoWahLfoRate, setAutoWahLfoRate] = useState(0.5); // LFO rate in Hz
  const [autoWahLfoDepth, setAutoWahLfoDepth] = useState(0.5); // LFO modulation depth
  const [autoWahLfoWaveform, setAutoWahLfoWaveform] = useState('sine'); // LFO waveform
  const [autoWahLfoPhase, setAutoWahLfoPhase] = useState(0); // LFO phase offset
  const [autoWahHybridBalance, setAutoWahHybridBalance] = useState(0.5); // Envelope/LFO balance in hybrid mode
  const [autoWahMix, setAutoWahMix] = useState(1.0); // Wet/dry mix
  const [autoWahTempoSync, setAutoWahTempoSync] = useState(false);
  const [autoWahNoteDivision, setAutoWahNoteDivision] = useState(4);
  
  // Flanger state
  const [flangerPresent, setFlangerPresent] = useState(false);
  const [flangerRate, setFlangerRate] = useState(0.5);
  const [flangerDepth, setFlangerDepth] = useState(0.002);
  const [flangerFeedback, setFlangerFeedback] = useState(0.5);
  const [flangerDelay, setFlangerDelay] = useState(0.005);
  const [flangerMix, setFlangerMix] = useState(0.5);
  const [flangerTempoSync, setFlangerTempoSync] = useState(false);
  const [flangerNoteDivision, setFlangerNoteDivision] = useState(4);
  const [flangerThroughZero, setFlangerThroughZero] = useState(false);
  const [flangerStereoPhase, setFlangerStereoPhase] = useState(0);
  const [flangerManualOffset, setFlangerManualOffset] = useState(0);
  
  // Gate state
  const [gatePresent, setGatePresent] = useState(false);
  const [gateThreshold, setGateThreshold] = useState(-40);
  const [gateRatio, setGateRatio] = useState(10);
  const [gateAttack, setGateAttack] = useState(0.001);
  const [gateRelease, setGateRelease] = useState(0.1);
  const [gateHold, setGateHold] = useState(0.01);
  const [gateRange, setGateRange] = useState(-60);
  
  // Pitch Shifter state - Professional pitch shifting with formant correction
  const [pitchShiftPresent, setPitchShiftPresent] = useState(false);
  const [pitchShiftSemitones, setPitchShiftSemitones] = useState(0); // -24 to +24 semitones
  const [pitchShiftCents, setPitchShiftCents] = useState(0); // -100 to +100 cents fine tuning
  const [pitchShiftFormant, setPitchShiftFormant] = useState(0); // -12 to +12 semitones formant shift
  const [pitchShiftFormantCorrection, setPitchShiftFormantCorrection] = useState(true); // Enable formant preservation
  const [pitchShiftMix, setPitchShiftMix] = useState(1.0); // Wet/dry mix (0-1)
  const [pitchShiftQuality, setPitchShiftQuality] = useState('high'); // low, medium, high, ultra
  const [pitchShiftGrainSize, setPitchShiftGrainSize] = useState(1024); // 512, 1024, 2048, 4096 samples
  const [pitchShiftOverlap, setPitchShiftOverlap] = useState(0.5); // Overlap factor (0.25-0.75)
  const [pitchShiftStretch, setPitchShiftStretch] = useState(1.0); // Time stretch factor (0.5-2.0)
  const [pitchShiftPreserveTimbre, setPitchShiftPreserveTimbre] = useState(true); // Preserve timbre
  const [pitchShiftOutputGain, setPitchShiftOutputGain] = useState(1.0); // Output gain (0-2)
  const [pitchShiftPan, setPitchShiftPan] = useState(0); // Stereo positioning (-1 to +1)
  
  // Stereo Widener state - Professional Mid/Side processing with spatial enhancement
  const [stereoWidenerPresent, setStereoWidenerPresent] = useState(false);
  const [stereoWidenerWidth, setStereoWidenerWidth] = useState(1.5); // Stereo width (0-3)
  const [stereoWidenerDelay, setStereoWidenerDelay] = useState(10); // Haas effect delay in ms (0-50)
  const [stereoWidenerBassRetain, setStereoWidenerBassRetain] = useState(true); // Keep bass centered
  const [stereoWidenerBassFreq, setStereoWidenerBassFreq] = useState(200); // Bass cutoff frequency (20-500 Hz)
  const [stereoWidenerMode, setStereoWidenerMode] = useState('classic'); // classic, midside, haas, correlation
  const [stereoWidenerMidGain, setStereoWidenerMidGain] = useState(0); // Mid channel gain (-12 to +12 dB)
  const [stereoWidenerSideGain, setStereoWidenerSideGain] = useState(0); // Side channel gain (-12 to +12 dB)
  const [stereoWidenerPhase, setStereoWidenerPhase] = useState(0); // Phase offset (0-180 degrees)
  const [stereoWidenerCorrelation, setStereoWidenerCorrelation] = useState(0); // Correlation adjustment (-1 to +1)
  const [stereoWidenerHighFreqLimit, setStereoWidenerHighFreqLimit] = useState(20000); // High frequency limit (1000-20000 Hz)
  const [stereoWidenerSafetyLimit, setStereoWidenerSafetyLimit] = useState(true); // Prevent over-widening
  const [stereoWidenerOutputGain, setStereoWidenerOutputGain] = useState(1.0); // Output gain (0-2)
  
  // Filter state - Professional filtering with LFO modulation
  const [filterPresent, setFilterPresent] = useState(false);
  const [filterType, setFilterType] = useState('lowpass'); // Filter type
  const [filterFrequency, setFilterFrequency] = useState(1000); // Cutoff frequency (20-20000 Hz)
  const [filterResonance, setFilterResonance] = useState(1); // Resonance/Q (0.1-30)
  const [filterGain, setFilterGain] = useState(0); // Gain for peaking/shelf filters (-20 to +20 dB)
  const [filterLfoRate, setFilterLfoRate] = useState(0.5); // LFO rate in Hz (0.01-10)
  const [filterLfoDepth, setFilterLfoDepth] = useState(0); // LFO modulation depth (0-1)
  const [filterLfoWaveform, setFilterLfoWaveform] = useState('sine'); // LFO waveform
  const [filterLfoTempoSync, setFilterLfoTempoSync] = useState(false); // Tempo sync enable
  const [filterLfoNoteDiv, setFilterLfoNoteDiv] = useState(4); // Note division for tempo sync
  const [filterMix, setFilterMix] = useState(1.0); // Wet/dry mix (0-1)
  
  // Limiter state - Professional limiting with advanced algorithms
  const [limiterPresent, setLimiterPresent] = useState(false);
  const [limiterCeiling, setLimiterCeiling] = useState(-0.1); // Output ceiling in dB (-3 to 0)
  const [limiterRelease, setLimiterRelease] = useState(50); // Release time in ms (1-1000)
  const [limiterLookahead, setLimiterLookahead] = useState(5); // Lookahead time in ms (0-20)
  const [limiterAlgorithm, setLimiterAlgorithm] = useState('transparent'); // Algorithm type
  const [limiterIsrMode, setLimiterIsrMode] = useState(true); // Inter-Sample Peak detection
  const [limiterDithering, setLimiterDithering] = useState(false); // Dithering enable
  const [limiterMasteringMode, setLimiterMasteringMode] = useState(false); // Multi-stage mastering mode
  const [limiterInputGain, setLimiterInputGain] = useState(0); // Input gain in dB (-12 to +12)
  const [limiterOutputGain, setLimiterOutputGain] = useState(0); // Output gain in dB (-12 to +12)
  
  
  
  
  // Reset all effects to default
  const resetEffects = useCallback(() => {
    // EQ
    setFilters([]);
    setEqLinearPhase(false);
    setEqSpectrumAnalyzer(true);
    setEqBypass(false);
    setEqGain(0);
    setEqMidSideMode(false);
    setEqMidFilters([]);
    setEqSideFilters([]);
    setEqMidGain(0);
    setEqSideGain(0);
    setEqStereoLink(true);
    
    // Echo
    setInGain(0);
    setOutGain(0);
    setDelay(0);
    setDecay(0);
    
    // Reverb
    setReverbPreset('mediumHall');
    setReverbWetMix(0.3);
    setReverbPreDelay(0);
    setReverbOutputGain(1);
    setReverbHighDamp(0.5);
    setReverbLowDamp(0.1);
    setReverbEarlyLate(0.5);
    setReverbStereoWidth(1);
    
    // Chorus
    setChorusRate(0.5);
    setChorusDepth(0.7);
    setChorusDelay(10);
    setChorusFeedback(0.2);
    setChorusWetMix(0.5);
    setChorusVoices(3);
    setChorusStereoWidth(1.0);
    setChorusPhaseOffset(90);
    setChorusWaveform('sine');
    setChorusOutputGain(1.0);
    
    // Distortion
    setDistortionType('tubeSaturation');
    setDistortionDrive(5);
    setDistortionTone(5000);
    setDistortionPresence(0);
    setDistortionBass(0);
    setDistortionMid(0);
    setDistortionTreble(0);
    setDistortionOutputGain(0.7);
    setDistortionAsymmetry(0);
    setDistortionHarmonics(0.5);
    setDistortionWetMix(1.0);
    
    // Phaser
    setPhaserRate(0.5);
    setPhaserDepth(0.7);
    setPhaserFeedback(0.5);
    setPhaserStages(4);
    setPhaserWetMix(0.5);
    setPhaserWaveform('sine');
    setPhaserFreqRange([200, 2000]);
    setPhaserResonance(0.7);
    setPhaserStereoPhase(90);
    setPhaserOutputGain(1.0);
    
    // Auto-Pan
    setAutoPanRate(1);
    setAutoPanDepth(1);
    setAutoPanWaveform('sine');
    setAutoPanPhase(0);
    
    // Tremolo
    setTremoloRate(5);
    setTremoloDepth(0.5);
    setTremoloWaveform('sine');
    setTremoloPhase(0);
    
    // Compressor
    setCompressorThreshold(-24);
    setCompressorRatio(4);
    setCompressorAttack(0.003);
    setCompressorRelease(0.1);
    setCompressorKnee(30);
    setCompressorMakeup(0);
    setCompressorMidSideMode(false);
    setCompressorMidThreshold(-24);
    setCompressorMidRatio(4);
    setCompressorMidAttack(0.003);
    setCompressorMidRelease(0.1);
    setCompressorMidMakeup(0);
    setCompressorSideThreshold(-24);
    setCompressorSideRatio(4);
    setCompressorSideAttack(0.003);
    setCompressorSideRelease(0.1);
    setCompressorSideMakeup(0);
    setCompressorMultibandMode(false);
    setCompressorCrossoverFreqs([250, 2000, 8000]);
    setCompressorBand0Threshold(-24);
    setCompressorBand0Ratio(4);
    setCompressorBand0Attack(0.01);
    setCompressorBand0Release(0.2);
    setCompressorBand0Makeup(0);
    setCompressorBand1Threshold(-24);
    setCompressorBand1Ratio(4);
    setCompressorBand1Attack(0.005);
    setCompressorBand1Release(0.15);
    setCompressorBand1Makeup(0);
    setCompressorBand2Threshold(-24);
    setCompressorBand2Ratio(4);
    setCompressorBand2Attack(0.003);
    setCompressorBand2Release(0.1);
    setCompressorBand2Makeup(0);
    setCompressorBand3Threshold(-24);
    setCompressorBand3Ratio(4);
    setCompressorBand3Attack(0.001);
    setCompressorBand3Release(0.05);
    setCompressorBand3Makeup(0);
    
    // Ring Modulator
    setRingModFrequency(440);
    setRingModWaveform('sine');
    setRingModMix(1.0);
    setRingModDepth(1.0);
    setRingModMode('classic');
    setRingModSync(false);
    setRingModOffset(0);
    setRingModPhase(0);
    setRingModFilterFreq(20000);
    setRingModFilterType('none');
    setRingModOutputGain(1.0);
    setRingModStereoSpread(0);
    
    // Glitch/Beat Repeat
    setGlitchDivision(16);
    setGlitchProbability(0.3);
    setGlitchReverse(0.2);
    setGlitchPitch(0);
    setGlitchGate(1);
    
    // Frequency Shifter
    setFreqShiftAmount(0);
    setFreqShiftFeedback(0);
    setFreqShiftMix(0.5);
    
    // Granular Freeze
    setGranularGrainSize(100);
    setGranularPosition(0.5);
    setGranularSpray(0);
    setGranularPitch(0);
    setGranularDensity(10);
    
    // Paulstretch
    setPaulstretchFactor(8);
    setPaulstretchWindow(0.25);
    setPaulstretchSmooth(10);
    
    // Spectral Filter
    setSpectralType('robot');
    setSpectralThreshold(0.1);
    setSpectralBands(16);
    setSpectralSpread(1);
    setSpectralShift(0);
    
    // Reverse Reverb
    setReverseReverbPreset('mediumHall');
    setReverseReverbMix(0.7);
    setReverseReverbFade(0.1);
    setReverseReverbPredelay(0);
    setReverseReverbBuildup(0.5);
    
    // Advanced Delay
    setAdvDelayTime(500);
    setAdvDelayFeedback(0.5);
    setAdvDelayMix(0.5);
    setAdvDelayPingPong(false);
    setAdvDelayFilterFreq(2000);
    setAdvDelayFilterType('lowpass');
    setAdvDelayTempoSync(false);
    setAdvDelayNoteDivision(4);
    setAdvDelayTaps(3);
    setAdvDelaySpread(0.3);
    setAdvDelayModRate(0.5);
    setAdvDelayModDepth(0.1);
    setAdvDelayModWaveform('sine');
    setAdvDelaySaturation(0);
    setAdvDelayDiffusion(0.3);
    setAdvDelayStereoWidth(1.0);
    setAdvDelayOutputGain(1.0);
    
    // Auto-Wah
    setAutoWahMode('envelope');
    setAutoWahFilterType('bandpass');
    setAutoWahSensitivity(0.5);
    setAutoWahFrequency(500);
    setAutoWahRange(2000);
    setAutoWahQ(5);
    setAutoWahAttack(0.01);
    setAutoWahRelease(0.1);
    setAutoWahLfoRate(0.5);
    setAutoWahLfoDepth(0.5);
    setAutoWahLfoWaveform('sine');
    setAutoWahLfoPhase(0);
    setAutoWahHybridBalance(0.5);
    setAutoWahMix(1.0);
    
    // Flanger
    setFlangerRate(0.5);
    setFlangerDepth(0.002);
    setFlangerFeedback(0.5);
    setFlangerDelay(0.005);
    setFlangerMix(0.5);
    
    // Gate
    setGateThreshold(-40);
    setGateRatio(10);
    setGateAttack(0.001);
    setGateRelease(0.1);
    setGateHold(0.01);
    setGateRange(-60);
    
    // Pitch Shifter
    setPitchShiftSemitones(0);
    setPitchShiftCents(0);
    setPitchShiftFormant(0);
    setPitchShiftFormantCorrection(true);
    setPitchShiftMix(1.0);
    setPitchShiftQuality('high');
    setPitchShiftGrainSize(1024);
    setPitchShiftOverlap(0.5);
    setPitchShiftStretch(1.0);
    setPitchShiftPreserveTimbre(true);
    setPitchShiftOutputGain(1.0);
    setPitchShiftPan(0);
    
    // Stereo Widener
    setStereoWidenerWidth(1.5);
    setStereoWidenerDelay(10);
    setStereoWidenerBassRetain(true);
    setStereoWidenerBassFreq(200);
    setStereoWidenerMode('classic');
    setStereoWidenerMidGain(0);
    setStereoWidenerSideGain(0);
    setStereoWidenerPhase(0);
    setStereoWidenerCorrelation(0);
    setStereoWidenerHighFreqLimit(20000);
    setStereoWidenerSafetyLimit(true);
    setStereoWidenerOutputGain(1.0);
    
    // Filter
    setFilterType('lowpass');
    setFilterFrequency(1000);
    setFilterResonance(1);
    setFilterGain(0);
    setFilterLfoRate(0.5);
    setFilterLfoDepth(0);
    setFilterLfoWaveform('sine');
    setFilterLfoTempoSync(false);
    setFilterLfoNoteDiv(4);
    setFilterMix(1.0);
    
    // Limiter
    setLimiterCeiling(-0.1);
    setLimiterRelease(50);
    setLimiterLookahead(5);
    setLimiterAlgorithm('transparent');
    setLimiterIsrMode(true);
    setLimiterDithering(false);
    setLimiterMasteringMode(false);
    setLimiterInputGain(0);
    setLimiterOutputGain(0);
    
    // Sound Laboratory
    setLabChaosAmount(0.3);
    setLabMorphAmount(0);
    setLabCurrentSnapshot('A');
    setLabGranularActive(false);
    setLabSpectralActive(false);
    setLabTemporalActive(false);
    setLabPhysicalActive(false);
    setLabSpatialActive(false);
    
    // Don't reset filters as they're initialized elsewhere
  }, []);
  
  // Toggle effect panels
  const toggleEQ = useCallback(() => setEqPresent(prev => !prev), []);
  const toggleReverb = useCallback(() => setRvbPresent(prev => !prev), []);
  const toggleReverbNew = useCallback(() => setReverbPresent(prev => !prev), []);
  const toggleChorus = useCallback(() => setChorusPresent(prev => !prev), []);
  const toggleDistortion = useCallback(() => setDistortionPresent(prev => !prev), []);
  const togglePhaser = useCallback(() => setPhaserPresent(prev => !prev), []);
  const toggleAutoPan = useCallback(() => setAutoPanPresent(prev => !prev), []);
  const toggleTremolo = useCallback(() => setTremoloPresent(prev => !prev), []);
  const toggleCompressor = useCallback(() => setCompressorPresent(prev => !prev), []);
  const toggleRingMod = useCallback(() => setRingModPresent(prev => !prev), []);
  const toggleGlitch = useCallback(() => setGlitchPresent(prev => !prev), []);
  const toggleFreqShift = useCallback(() => setFreqShiftPresent(prev => !prev), []);
  const togglePaulstretch = useCallback(() => setPaulstretchPresent(prev => !prev), []);
  const toggleSpectral = useCallback(() => setSpectralPresent(prev => !prev), []);
  const toggleGranular = useCallback(() => setGranularPresent(prev => !prev), []);
  const toggleReverseReverb = useCallback(() => setReverseReverbPresent(prev => !prev), []);
  const toggleAdvDelay = useCallback(() => setAdvDelayPresent(prev => !prev), []);
  const toggleAutoWah = useCallback(() => setAutoWahPresent(prev => !prev), []);
  const toggleFlanger = useCallback(() => setFlangerPresent(prev => !prev), []);
  const toggleGate = useCallback(() => setGatePresent(prev => !prev), []);
  const togglePitchShift = useCallback(() => setPitchShiftPresent(prev => !prev), []);
  const toggleStereoWidener = useCallback(() => setStereoWidenerPresent(prev => !prev), []);
  const toggleFilter = useCallback(() => setFilterPresent(prev => !prev), []);
  const toggleLimiter = useCallback(() => setLimiterPresent(prev => !prev), []);
  
  const value = {
    // Global tempo sync
    globalBPM,
    setGlobalBPM,
    tempoSyncEnabled,
    setTempoSyncEnabled,
    
    // EQ
    filters,
    setFilters,
    eqPresent,
    setEqPresent,
    toggleEQ,
    eqLinearPhase,
    setEqLinearPhase,
    eqSpectrumAnalyzer,
    setEqSpectrumAnalyzer,
    eqBypass,
    setEqBypass,
    eqGain,
    setEqGain,
    eqMidSideMode,
    setEqMidSideMode,
    eqMidFilters,
    setEqMidFilters,
    eqSideFilters,
    setEqSideFilters,
    eqMidGain,
    setEqMidGain,
    eqSideGain,
    setEqSideGain,
    eqStereoLink,
    setEqStereoLink,
    
    // Echo (was Reverb)
    rvbPresent,
    setRvbPresent,
    toggleReverb,
    inGain,
    setInGain,
    outGain,
    setOutGain,
    delay,
    setDelay,
    decay,
    setDecay,
    
    // Reverb (new Web Audio)
    reverbPresent,
    setReverbPresent,
    toggleReverbNew,
    reverbPreset,
    setReverbPreset,
    reverbWetMix,
    setReverbWetMix,
    reverbPreDelay,
    setReverbPreDelay,
    reverbOutputGain,
    setReverbOutputGain,
    reverbHighDamp,
    setReverbHighDamp,
    reverbLowDamp,
    setReverbLowDamp,
    reverbEarlyLate,
    setReverbEarlyLate,
    reverbStereoWidth,
    setReverbStereoWidth,
    
    // Chorus
    chorusPresent,
    setChorusPresent,
    toggleChorus,
    chorusRate,
    setChorusRate,
    chorusDepth,
    setChorusDepth,
    chorusDelay,
    setChorusDelay,
    chorusFeedback,
    setChorusFeedback,
    chorusWetMix,
    setChorusWetMix,
    chorusVoices,
    setChorusVoices,
    chorusStereoWidth,
    setChorusStereoWidth,
    chorusPhaseOffset,
    setChorusPhaseOffset,
    chorusTempoSync,
    setChorusTempoSync,
    chorusNoteDivision,
    setChorusNoteDivision,
    chorusWaveform,
    setChorusWaveform,
    chorusOutputGain,
    setChorusOutputGain,
    
    // Distortion
    distortionPresent,
    setDistortionPresent,
    toggleDistortion,
    distortionType,
    setDistortionType,
    distortionDrive,
    setDistortionDrive,
    distortionTone,
    setDistortionTone,
    distortionPresence,
    setDistortionPresence,
    distortionBass,
    setDistortionBass,
    distortionMid,
    setDistortionMid,
    distortionTreble,
    setDistortionTreble,
    distortionOutputGain,
    setDistortionOutputGain,
    distortionAsymmetry,
    setDistortionAsymmetry,
    distortionHarmonics,
    setDistortionHarmonics,
    distortionWetMix,
    setDistortionWetMix,
    
    // Phaser
    phaserPresent,
    setPhaserPresent,
    togglePhaser,
    phaserRate,
    setPhaserRate,
    phaserDepth,
    setPhaserDepth,
    phaserFeedback,
    setPhaserFeedback,
    phaserStages,
    setPhaserStages,
    phaserWetMix,
    setPhaserWetMix,
    phaserTempoSync,
    setPhaserTempoSync,
    phaserNoteDivision,
    setPhaserNoteDivision,
    phaserWaveform,
    setPhaserWaveform,
    phaserFreqRange,
    setPhaserFreqRange,
    phaserResonance,
    setPhaserResonance,
    phaserStereoPhase,
    setPhaserStereoPhase,
    phaserOutputGain,
    setPhaserOutputGain,
    
    // Auto-Pan
    autoPanPresent,
    setAutoPanPresent,
    toggleAutoPan,
    autoPanRate,
    setAutoPanRate,
    autoPanDepth,
    setAutoPanDepth,
    autoPanWaveform,
    setAutoPanWaveform,
    autoPanPhase,
    setAutoPanPhase,
    autoPanTempoSync,
    setAutoPanTempoSync,
    autoPanNoteDivision,
    setAutoPanNoteDivision,
    
    // Tremolo
    tremoloPresent,
    setTremoloPresent,
    toggleTremolo,
    tremoloRate,
    setTremoloRate,
    tremoloDepth,
    setTremoloDepth,
    tremoloWaveform,
    setTremoloWaveform,
    tremoloPhase,
    setTremoloPhase,
    tremoloTempoSync,
    setTremoloTempoSync,
    tremoloNoteDivision,
    setTremoloNoteDivision,
    
    // Compressor
    compressorPresent,
    setCompressorPresent,
    toggleCompressor,
    compressorThreshold,
    setCompressorThreshold,
    compressorRatio,
    setCompressorRatio,
    compressorAttack,
    setCompressorAttack,
    compressorRelease,
    setCompressorRelease,
    compressorKnee,
    setCompressorKnee,
    compressorMakeup,
    setCompressorMakeup,
    compressorLookahead,
    setCompressorLookahead,
    compressorSidechain,
    setCompressorSidechain,
    compressorModel,
    setCompressorModel,
    compressorAutoMakeup,
    setCompressorAutoMakeup,
    
    // Compressor Mid/Side mode
    compressorMidSideMode,
    setCompressorMidSideMode,
    compressorMidThreshold,
    setCompressorMidThreshold,
    compressorMidRatio,
    setCompressorMidRatio,
    compressorMidAttack,
    setCompressorMidAttack,
    compressorMidRelease,
    setCompressorMidRelease,
    compressorMidMakeup,
    setCompressorMidMakeup,
    compressorSideThreshold,
    setCompressorSideThreshold,
    compressorSideRatio,
    setCompressorSideRatio,
    compressorSideAttack,
    setCompressorSideAttack,
    compressorSideRelease,
    setCompressorSideRelease,
    compressorSideMakeup,
    setCompressorSideMakeup,
    
    // Compressor Multiband mode
    compressorMultibandMode,
    setCompressorMultibandMode,
    compressorCrossoverFreqs,
    setCompressorCrossoverFreqs,
    compressorBand0Threshold,
    setCompressorBand0Threshold,
    compressorBand0Ratio,
    setCompressorBand0Ratio,
    compressorBand0Attack,
    setCompressorBand0Attack,
    compressorBand0Release,
    setCompressorBand0Release,
    compressorBand0Makeup,
    setCompressorBand0Makeup,
    compressorBand1Threshold,
    setCompressorBand1Threshold,
    compressorBand1Ratio,
    setCompressorBand1Ratio,
    compressorBand1Attack,
    setCompressorBand1Attack,
    compressorBand1Release,
    setCompressorBand1Release,
    compressorBand1Makeup,
    setCompressorBand1Makeup,
    compressorBand2Threshold,
    setCompressorBand2Threshold,
    compressorBand2Ratio,
    setCompressorBand2Ratio,
    compressorBand2Attack,
    setCompressorBand2Attack,
    compressorBand2Release,
    setCompressorBand2Release,
    compressorBand2Makeup,
    setCompressorBand2Makeup,
    compressorBand3Threshold,
    setCompressorBand3Threshold,
    compressorBand3Ratio,
    setCompressorBand3Ratio,
    compressorBand3Attack,
    setCompressorBand3Attack,
    compressorBand3Release,
    setCompressorBand3Release,
    compressorBand3Makeup,
    setCompressorBand3Makeup,
    
    // Ring Modulator
    ringModPresent,
    setRingModPresent,
    toggleRingMod,
    ringModFrequency,
    setRingModFrequency,
    ringModWaveform,
    setRingModWaveform,
    ringModMix,
    setRingModMix,
    ringModDepth,
    setRingModDepth,
    ringModMode,
    setRingModMode,
    ringModSync,
    setRingModSync,
    ringModOffset,
    setRingModOffset,
    ringModPhase,
    setRingModPhase,
    ringModFilterFreq,
    setRingModFilterFreq,
    ringModFilterType,
    setRingModFilterType,
    ringModOutputGain,
    setRingModOutputGain,
    ringModStereoSpread,
    setRingModStereoSpread,
    
    // Glitch/Beat Repeat
    glitchPresent,
    setGlitchPresent,
    toggleGlitch,
    glitchDivision,
    setGlitchDivision,
    glitchProbability,
    setGlitchProbability,
    glitchReverse,
    setGlitchReverse,
    glitchPitch,
    setGlitchPitch,
    glitchGate,
    setGlitchGate,
    
    // Frequency Shifter
    freqShiftPresent,
    setFreqShiftPresent,
    toggleFreqShift,
    freqShiftAmount,
    setFreqShiftAmount,
    freqShiftFeedback,
    setFreqShiftFeedback,
    freqShiftMix,
    setFreqShiftMix,
    
    // Paulstretch
    paulstretchPresent,
    setPaulstretchPresent,
    togglePaulstretch,
    paulstretchFactor,
    setPaulstretchFactor,
    paulstretchWindow,
    setPaulstretchWindow,
    paulstretchSmooth,
    setPaulstretchSmooth,
    
    // Spectral Filter
    spectralPresent,
    setSpectralPresent,
    toggleSpectral,

    // Granular Freeze
    granularPresent,
    setGranularPresent,
    toggleGranular,

    // Reverse Reverb
    reverseReverbPresent,
    setReverseReverbPresent,
    toggleReverseReverb,
    reverseReverbPreset,
    setReverseReverbPreset,
    reverseReverbMix,
    setReverseReverbMix,
    reverseReverbFade,
    setReverseReverbFade,
    reverseReverbPredelay,
    setReverseReverbPredelay,
    reverseReverbBuildup,
    setReverseReverbBuildup,
    
    // Advanced Delay
    advDelayPresent,
    setAdvDelayPresent,
    toggleAdvDelay,
    advDelayTime,
    setAdvDelayTime,
    advDelayFeedback,
    setAdvDelayFeedback,
    advDelayMix,
    setAdvDelayMix,
    advDelayPingPong,
    setAdvDelayPingPong,
    advDelayFilterFreq,
    setAdvDelayFilterFreq,
    advDelayFilterType,
    setAdvDelayFilterType,
    advDelayTempoSync,
    setAdvDelayTempoSync,
    advDelayNoteDivision,
    setAdvDelayNoteDivision,
    advDelayTaps,
    setAdvDelayTaps,
    advDelaySpread,
    setAdvDelaySpread,
    advDelayModRate,
    setAdvDelayModRate,
    advDelayModDepth,
    setAdvDelayModDepth,
    advDelayModWaveform,
    setAdvDelayModWaveform,
    advDelaySaturation,
    setAdvDelaySaturation,
    advDelayDiffusion,
    setAdvDelayDiffusion,
    advDelayStereoWidth,
    setAdvDelayStereoWidth,
    advDelayOutputGain,
    setAdvDelayOutputGain,
    
    // Auto-Wah
    autoWahPresent,
    setAutoWahPresent,
    toggleAutoWah,
    autoWahMode,
    setAutoWahMode,
    autoWahFilterType,
    setAutoWahFilterType,
    autoWahSensitivity,
    setAutoWahSensitivity,
    autoWahFrequency,
    setAutoWahFrequency,
    autoWahRange,
    setAutoWahRange,
    autoWahQ,
    setAutoWahQ,
    autoWahAttack,
    setAutoWahAttack,
    autoWahRelease,
    setAutoWahRelease,
    autoWahLfoRate,
    setAutoWahLfoRate,
    autoWahLfoDepth,
    setAutoWahLfoDepth,
    autoWahLfoWaveform,
    setAutoWahLfoWaveform,
    autoWahLfoPhase,
    setAutoWahLfoPhase,
    autoWahHybridBalance,
    setAutoWahHybridBalance,
    autoWahMix,
    setAutoWahMix,
    autoWahTempoSync,
    setAutoWahTempoSync,
    autoWahNoteDivision,
    setAutoWahNoteDivision,
    
    // Flanger
    flangerPresent,
    setFlangerPresent,
    toggleFlanger,
    flangerRate,
    setFlangerRate,
    flangerDepth,
    setFlangerDepth,
    flangerFeedback,
    setFlangerFeedback,
    flangerDelay,
    setFlangerDelay,
    flangerMix,
    setFlangerMix,
    flangerTempoSync,
    setFlangerTempoSync,
    flangerNoteDivision,
    setFlangerNoteDivision,
    flangerThroughZero,
    setFlangerThroughZero,
    flangerStereoPhase,
    setFlangerStereoPhase,
    flangerManualOffset,
    setFlangerManualOffset,
    
    // Gate
    gatePresent,
    setGatePresent,
    toggleGate,
    gateThreshold,
    setGateThreshold,
    gateRatio,
    setGateRatio,
    gateAttack,
    setGateAttack,
    gateRelease,
    setGateRelease,
    gateHold,
    setGateHold,
    gateRange,
    setGateRange,
    
    // Pitch Shifter
    pitchShiftPresent,
    setPitchShiftPresent,
    togglePitchShift,
    pitchShiftSemitones,
    setPitchShiftSemitones,
    pitchShiftCents,
    setPitchShiftCents,
    pitchShiftFormant,
    setPitchShiftFormant,
    pitchShiftFormantCorrection,
    setPitchShiftFormantCorrection,
    pitchShiftMix,
    setPitchShiftMix,
    pitchShiftQuality,
    setPitchShiftQuality,
    pitchShiftGrainSize,
    setPitchShiftGrainSize,
    pitchShiftOverlap,
    setPitchShiftOverlap,
    pitchShiftStretch,
    setPitchShiftStretch,
    pitchShiftPreserveTimbre,
    setPitchShiftPreserveTimbre,
    pitchShiftOutputGain,
    setPitchShiftOutputGain,
    pitchShiftPan,
    setPitchShiftPan,
    
    // Stereo Widener
    stereoWidenerPresent,
    setStereoWidenerPresent,
    toggleStereoWidener,
    stereoWidenerWidth,
    setStereoWidenerWidth,
    stereoWidenerDelay,
    setStereoWidenerDelay,
    stereoWidenerBassRetain,
    setStereoWidenerBassRetain,
    stereoWidenerBassFreq,
    setStereoWidenerBassFreq,
    stereoWidenerMode,
    setStereoWidenerMode,
    stereoWidenerMidGain,
    setStereoWidenerMidGain,
    stereoWidenerSideGain,
    setStereoWidenerSideGain,
    stereoWidenerPhase,
    setStereoWidenerPhase,
    stereoWidenerCorrelation,
    setStereoWidenerCorrelation,
    stereoWidenerHighFreqLimit,
    setStereoWidenerHighFreqLimit,
    stereoWidenerSafetyLimit,
    setStereoWidenerSafetyLimit,
    stereoWidenerOutputGain,
    setStereoWidenerOutputGain,
    
    // Filter
    filterPresent,
    setFilterPresent,
    toggleFilter,
    filterType,
    setFilterType,
    filterFrequency,
    setFilterFrequency,
    filterResonance,
    setFilterResonance,
    filterGain,
    setFilterGain,
    filterLfoRate,
    setFilterLfoRate,
    filterLfoDepth,
    setFilterLfoDepth,
    filterLfoWaveform,
    setFilterLfoWaveform,
    filterLfoTempoSync,
    setFilterLfoTempoSync,
    filterLfoNoteDiv,
    setFilterLfoNoteDiv,
    filterMix,
    setFilterMix,
    
    // Limiter
    limiterPresent,
    setLimiterPresent,
    toggleLimiter,
    limiterCeiling,
    setLimiterCeiling,
    limiterRelease,
    setLimiterRelease,
    limiterLookahead,
    setLimiterLookahead,
    limiterAlgorithm,
    setLimiterAlgorithm,
    limiterIsrMode,
    setLimiterIsrMode,
    limiterDithering,
    setLimiterDithering,
    limiterMasteringMode,
    setLimiterMasteringMode,
    limiterInputGain,
    setLimiterInputGain,
    limiterOutputGain,
    setLimiterOutputGain,
    
    
    // Regions
    cutRegion,
    setCutRegion,
    
    // Methods
    resetEffects,
  };
  
  return (
    <EffectsContext.Provider value={value}>
      {children}
    </EffectsContext.Provider>
  );
};