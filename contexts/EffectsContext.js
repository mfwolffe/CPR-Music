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