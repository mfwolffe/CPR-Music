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
  // EQ state
  const [filters, setFilters] = useState([]);
  const [eqPresent, setEqPresent] = useState(false);
  
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
  
  // Chorus state
  const [chrPresent, setChrPresent] = useState(false);
  const [inGainChr, setInGainChr] = useState(0);
  const [outGainChr, setOutGainChr] = useState(0);
  const [delayChr, setDelayChr] = useState(0);
  const [decayChr, setDecayChr] = useState(0);
  const [speedChr, setSpeedChr] = useState(0);
  const [depthsChr, setDepthsChr] = useState(0);
  
  // Regions for cutting
  const [cutRegion, setCutRegion] = useState('');
  
  // Distortion state
  const [distortionPresent, setDistortionPresent] = useState(false);
  const [distortionAmount, setDistortionAmount] = useState(50);
  const [distortionType, setDistortionType] = useState('overdrive');
  const [distortionTone, setDistortionTone] = useState(5000);
  const [distortionOutputGain, setDistortionOutputGain] = useState(0.7);
  
  // Phaser state
  const [phaserPresent, setPhaserPresent] = useState(false);
  const [phaserRate, setPhaserRate] = useState(0.5);
  const [phaserDepth, setPhaserDepth] = useState(0.7);
  const [phaserFeedback, setPhaserFeedback] = useState(0.5);
  const [phaserStages, setPhaserStages] = useState(4);
  const [phaserWetMix, setPhaserWetMix] = useState(0.5);
  
  // Auto-Pan state
  const [autoPanPresent, setAutoPanPresent] = useState(false);
  const [autoPanRate, setAutoPanRate] = useState(1);
  const [autoPanDepth, setAutoPanDepth] = useState(1);
  const [autoPanWaveform, setAutoPanWaveform] = useState('sine');
  const [autoPanPhase, setAutoPanPhase] = useState(0);
  
  // Tremolo state
  const [tremoloPresent, setTremoloPresent] = useState(false);
  const [tremoloRate, setTremoloRate] = useState(5);
  const [tremoloDepth, setTremoloDepth] = useState(0.5);
  const [tremoloWaveform, setTremoloWaveform] = useState('sine');
  const [tremoloPhase, setTremoloPhase] = useState(0);
  
  // Compressor state
  const [compressorPresent, setCompressorPresent] = useState(false);
  const [compressorThreshold, setCompressorThreshold] = useState(-24);
  const [compressorRatio, setCompressorRatio] = useState(4);
  const [compressorAttack, setCompressorAttack] = useState(0.003);
  const [compressorRelease, setCompressorRelease] = useState(0.1);
  const [compressorKnee, setCompressorKnee] = useState(30);
  const [compressorMakeup, setCompressorMakeup] = useState(0);
  
  // Ring Modulator state
  const [ringModPresent, setRingModPresent] = useState(false);
  const [ringModFrequency, setRingModFrequency] = useState(440);
  const [ringModWaveform, setRingModWaveform] = useState('sine');
  const [ringModMix, setRingModMix] = useState(1);
  const [ringModDepth, setRingModDepth] = useState(1);
  
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
  
  // Granular Freeze state
  const [granularPresent, setGranularPresent] = useState(false);
  const [granularGrainSize, setGranularGrainSize] = useState(100);
  const [granularPosition, setGranularPosition] = useState(0.5);
  const [granularSpray, setGranularSpray] = useState(0);
  const [granularPitch, setGranularPitch] = useState(0);
  const [granularDensity, setGranularDensity] = useState(10);
  
  // Paulstretch state
  const [paulstretchPresent, setPaulstretchPresent] = useState(false);
  const [paulstretchFactor, setPaulstretchFactor] = useState(8);
  const [paulstretchWindow, setPaulstretchWindow] = useState(0.25);
  const [paulstretchSmooth, setPaulstretchSmooth] = useState(10);
  
  // Spectral Filter state
  const [spectralPresent, setSpectralPresent] = useState(false);
  const [spectralType, setSpectralType] = useState('robot');
  const [spectralThreshold, setSpectralThreshold] = useState(0.1);
  const [spectralBands, setSpectralBands] = useState(16);
  const [spectralSpread, setSpectralSpread] = useState(1);
  const [spectralShift, setSpectralShift] = useState(0);
  
  // Reverse Reverb state
  const [reverseReverbPresent, setReverseReverbPresent] = useState(false);
  const [reverseReverbPreset, setReverseReverbPreset] = useState('mediumHall');
  const [reverseReverbMix, setReverseReverbMix] = useState(0.7);
  const [reverseReverbFade, setReverseReverbFade] = useState(0.1);
  const [reverseReverbPredelay, setReverseReverbPredelay] = useState(0);
  const [reverseReverbBuildup, setReverseReverbBuildup] = useState(0.5);
  
  // Advanced Delay state
  const [advDelayPresent, setAdvDelayPresent] = useState(false);
  const [advDelayTime, setAdvDelayTime] = useState(500);
  const [advDelayFeedback, setAdvDelayFeedback] = useState(0.5);
  const [advDelayMix, setAdvDelayMix] = useState(0.5);
  const [advDelayPingPong, setAdvDelayPingPong] = useState(false);
  const [advDelayFilterFreq, setAdvDelayFilterFreq] = useState(2000);
  const [advDelayFilterType, setAdvDelayFilterType] = useState('lowpass');
  
  // Auto-Wah state
  const [autoWahPresent, setAutoWahPresent] = useState(false);
  const [autoWahSensitivity, setAutoWahSensitivity] = useState(0.5);
  const [autoWahFrequency, setAutoWahFrequency] = useState(500);
  const [autoWahRange, setAutoWahRange] = useState(2000);
  const [autoWahQ, setAutoWahQ] = useState(5);
  const [autoWahAttack, setAutoWahAttack] = useState(0.01);
  const [autoWahRelease, setAutoWahRelease] = useState(0.1);
  
  // Flanger state
  const [flangerPresent, setFlangerPresent] = useState(false);
  const [flangerRate, setFlangerRate] = useState(0.5);
  const [flangerDepth, setFlangerDepth] = useState(0.002);
  const [flangerFeedback, setFlangerFeedback] = useState(0.5);
  const [flangerDelay, setFlangerDelay] = useState(0.005);
  const [flangerMix, setFlangerMix] = useState(0.5);
  
  // Gate state
  const [gatePresent, setGatePresent] = useState(false);
  const [gateThreshold, setGateThreshold] = useState(-40);
  const [gateRatio, setGateRatio] = useState(10);
  const [gateAttack, setGateAttack] = useState(0.001);
  const [gateRelease, setGateRelease] = useState(0.1);
  const [gateHold, setGateHold] = useState(0.01);
  const [gateRange, setGateRange] = useState(-60);
  
  // Pitch Shifter state
  const [pitchShiftPresent, setPitchShiftPresent] = useState(false);
  const [pitchShiftSemitones, setPitchShiftSemitones] = useState(0);
  const [pitchShiftCents, setPitchShiftCents] = useState(0);
  const [pitchShiftMix, setPitchShiftMix] = useState(1);
  const [pitchShiftQuality, setPitchShiftQuality] = useState('medium');
  
  // Stereo Widener state
  const [stereoWidenerPresent, setStereoWidenerPresent] = useState(false);
  const [stereoWidenerWidth, setStereoWidenerWidth] = useState(1.5);
  const [stereoWidenerDelay, setStereoWidenerDelay] = useState(10);
  const [stereoWidenerBassRetain, setStereoWidenerBassRetain] = useState(true);
  const [stereoWidenerBassFreq, setStereoWidenerBassFreq] = useState(200);
  
  // Reset all effects to default
  const resetEffects = useCallback(() => {
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
    setInGainChr(0);
    setOutGainChr(0);
    setDelayChr(0);
    setDecayChr(0);
    setSpeedChr(0);
    setDepthsChr(0);
    
    // Distortion
    setDistortionAmount(50);
    setDistortionType('overdrive');
    setDistortionTone(5000);
    setDistortionOutputGain(0.7);
    
    // Phaser
    setPhaserRate(0.5);
    setPhaserDepth(0.7);
    setPhaserFeedback(0.5);
    setPhaserStages(4);
    setPhaserWetMix(0.5);
    
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
    
    // Ring Modulator
    setRingModFrequency(440);
    setRingModWaveform('sine');
    setRingModMix(1);
    setRingModDepth(1);
    
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
    
    // Auto-Wah
    setAutoWahSensitivity(0.5);
    setAutoWahFrequency(500);
    setAutoWahRange(2000);
    setAutoWahQ(5);
    setAutoWahAttack(0.01);
    setAutoWahRelease(0.1);
    
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
    setPitchShiftMix(1);
    setPitchShiftQuality('medium');
    
    // Stereo Widener
    setStereoWidenerWidth(1.5);
    setStereoWidenerDelay(10);
    setStereoWidenerBassRetain(true);
    setStereoWidenerBassFreq(200);
    
    // Don't reset filters as they're initialized elsewhere
  }, []);
  
  // Toggle effect panels
  const toggleEQ = useCallback(() => setEqPresent(prev => !prev), []);
  const toggleReverb = useCallback(() => setRvbPresent(prev => !prev), []);
  const toggleReverbNew = useCallback(() => setReverbPresent(prev => !prev), []);
  const toggleChorus = useCallback(() => setChrPresent(prev => !prev), []);
  const toggleDistortion = useCallback(() => setDistortionPresent(prev => !prev), []);
  const togglePhaser = useCallback(() => setPhaserPresent(prev => !prev), []);
  const toggleAutoPan = useCallback(() => setAutoPanPresent(prev => !prev), []);
  const toggleTremolo = useCallback(() => setTremoloPresent(prev => !prev), []);
  const toggleCompressor = useCallback(() => setCompressorPresent(prev => !prev), []);
  const toggleRingMod = useCallback(() => setRingModPresent(prev => !prev), []);
  const toggleGlitch = useCallback(() => setGlitchPresent(prev => !prev), []);
  const toggleFreqShift = useCallback(() => setFreqShiftPresent(prev => !prev), []);
  const toggleGranular = useCallback(() => setGranularPresent(prev => !prev), []);
  const togglePaulstretch = useCallback(() => setPaulstretchPresent(prev => !prev), []);
  const toggleSpectral = useCallback(() => setSpectralPresent(prev => !prev), []);
  const toggleReverseReverb = useCallback(() => setReverseReverbPresent(prev => !prev), []);
  const toggleAdvDelay = useCallback(() => setAdvDelayPresent(prev => !prev), []);
  const toggleAutoWah = useCallback(() => setAutoWahPresent(prev => !prev), []);
  const toggleFlanger = useCallback(() => setFlangerPresent(prev => !prev), []);
  const toggleGate = useCallback(() => setGatePresent(prev => !prev), []);
  const togglePitchShift = useCallback(() => setPitchShiftPresent(prev => !prev), []);
  const toggleStereoWidener = useCallback(() => setStereoWidenerPresent(prev => !prev), []);
  
  const value = {
    // EQ
    filters,
    setFilters,
    eqPresent,
    setEqPresent,
    toggleEQ,
    
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
    chrPresent,
    setChrPresent,
    toggleChorus,
    inGainChr,
    setInGainChr,
    outGainChr,
    setOutGainChr,
    delayChr,
    setDelayChr,
    decayChr,
    setDecayChr,
    speedChr,
    setSpeedChr,
    depthsChr,
    setDepthsChr,
    
    // Distortion
    distortionPresent,
    setDistortionPresent,
    toggleDistortion,
    distortionAmount,
    setDistortionAmount,
    distortionType,
    setDistortionType,
    distortionTone,
    setDistortionTone,
    distortionOutputGain,
    setDistortionOutputGain,
    
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
    
    // Granular Freeze
    granularPresent,
    setGranularPresent,
    toggleGranular,
    granularGrainSize,
    setGranularGrainSize,
    granularPosition,
    setGranularPosition,
    granularSpray,
    setGranularSpray,
    granularPitch,
    setGranularPitch,
    granularDensity,
    setGranularDensity,
    
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
    spectralType,
    setSpectralType,
    spectralThreshold,
    setSpectralThreshold,
    spectralBands,
    setSpectralBands,
    spectralSpread,
    setSpectralSpread,
    spectralShift,
    setSpectralShift,
    
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
    
    // Auto-Wah
    autoWahPresent,
    setAutoWahPresent,
    toggleAutoWah,
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
    pitchShiftMix,
    setPitchShiftMix,
    pitchShiftQuality,
    setPitchShiftQuality,
    
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