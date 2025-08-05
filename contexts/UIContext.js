'use client';

import { createContext, useContext, useState, useCallback } from 'react';

const UIContext = createContext();

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within UIProvider');
  }
  return context;
};

export const UIProvider = ({ children }) => {
  // DAW visibility
  const [showDAW, setShowDAW] = useState(false);
  const [mapPresent, setMapPresent] = useState(false);
  
  // Effects display mode
  const [useEffectsRack, setUseEffectsRack] = useState(false);
  
  // Modal states
  const [showHelp, setShowHelp] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [activeNaming, setActiveNaming] = useState(-1);
  
  // Hover states for effects buttons
  const [eqHvr, setEqHvr] = useState(false);
  const [mapHvr, setMapHvr] = useState(false);
  const [rvbHvr, setRvbHvr] = useState(false);
  const [chrHvr, setChrHvr] = useState(false);
  
  // Zoom level
  const [zoomLevel, setZoomLevel] = useState(15);
  
  // Toggle minimap
  const toggleMinimap = useCallback(() => {
    setMapPresent(prev => !prev);
  }, []);
  
  // Reset UI state (useful when switching between takes)
  const resetUIState = useCallback(() => {
    setShowDAW(false);
    setMapPresent(false);
    setShowHelp(false);
    setShowRename(false);
    setActiveNaming(-1);
    setZoomLevel(15);
  }, []);
  
  const value = {
    // DAW visibility
    showDAW,
    setShowDAW,
    mapPresent,
    setMapPresent,
    toggleMinimap,
    
    // Effects display mode
    useEffectsRack,
    setUseEffectsRack,
    
    // Modals
    showHelp,
    setShowHelp,
    showRename,
    setShowRename,
    activeNaming,
    setActiveNaming,
    
    // Hover states
    eqHvr,
    setEqHvr,
    mapHvr,
    setMapHvr,
    rvbHvr,
    setRvbHvr,
    chrHvr,
    setChrHvr,
    
    // Zoom
    zoomLevel,
    setZoomLevel,
    
    // Methods
    resetUIState,
  };
  
  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
};