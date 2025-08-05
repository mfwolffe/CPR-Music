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
  
  // Reverb state (actually echo for now)
  const [rvbPresent, setRvbPresent] = useState(false);
  const [inGain, setInGain] = useState(0);
  const [outGain, setOutGain] = useState(0);
  const [delay, setDelay] = useState(0);
  const [decay, setDecay] = useState(0);
  
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
  
  // Reset all effects to default
  const resetEffects = useCallback(() => {
    // Reverb
    setInGain(0);
    setOutGain(0);
    setDelay(0);
    setDecay(0);
    
    // Chorus
    setInGainChr(0);
    setOutGainChr(0);
    setDelayChr(0);
    setDecayChr(0);
    setSpeedChr(0);
    setDepthsChr(0);
    
    // Don't reset filters as they're initialized elsewhere
  }, []);
  
  // Toggle effect panels
  const toggleEQ = useCallback(() => setEqPresent(prev => !prev), []);
  const toggleReverb = useCallback(() => setRvbPresent(prev => !prev), []);
  const toggleChorus = useCallback(() => setChrPresent(prev => !prev), []);
  
  const value = {
    // EQ
    filters,
    setFilters,
    eqPresent,
    setEqPresent,
    toggleEQ,
    
    // Reverb
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