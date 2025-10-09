// contexts/AudioContext.js
'use client';

import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { getCommandManager, createAudioCommand } from '../lib/AudioCommandManager';

const AudioContext = createContext();

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }
  return context;
};

export const AudioProvider = ({ children }) => {
  // Core audio state
  const [audioURL, setAudioURL] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // DAW mode state
  const [dawMode, setDawMode] = useState('single'); // 'single' or 'multi'

  // Undo/redo state
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // References
  const audioRef = useRef(null);
  const wavesurferRef = useRef(null);
  const commandManagerRef = useRef(null);
  const hasInitialAudioRef = useRef(false); // Track if initial audio has been set

  // Initialize command manager
  useEffect(() => {
    const manager = getCommandManager();
    commandManagerRef.current = manager;

    // Listen for state changes
    const handleStateChange = (state) => {
      setCanUndo(state.canUndo);
      setCanRedo(state.canRedo);
    };

    manager.addListener(handleStateChange);

    return () => {
      manager.removeListener(handleStateChange);
    };
  }, []);

  // Set hasInitialAudioRef when audioURL is first set
  useEffect(() => {
    if (audioURL && !hasInitialAudioRef.current) {
      hasInitialAudioRef.current = true;
    }
  }, [audioURL]);
  
  // Load audio and handle updates
  const loadAudio = useCallback(async (url, skipHistory = false) => {
    if (!url) return;

    try {
      setAudioURL(url);

      // Add to history unless explicitly skipped (like during undo/redo)
      if (!skipHistory && commandManagerRef.current) {
        const command = createAudioCommand('Load Audio', url, {
          source: 'user_action'
        });
        commandManagerRef.current.execute(command);
      }

      // The WaveformContext will handle the actual audio loading
      // when it detects the audioURL change
    } catch (error) {
      console.error('Error in loadAudio:', error);
    }
  }, []);
  
  // Add new audio state to history
  const addToEditHistory = useCallback((url, name = 'Edit', metadata = {}) => {
    if (!commandManagerRef.current) return;

    const command = createAudioCommand(name, url, metadata);
    commandManagerRef.current.execute(command);

    // Update current audio URL
    setAudioURL(url);
  }, []);
  
  // Undo operation
  const undo = useCallback(async () => {
    if (!commandManagerRef.current) return;

    const command = commandManagerRef.current.undo();
    if (command) {
      // Simply update the audioURL
      // This will trigger the WaveformContext to reload the audio
      setAudioURL(command.audioData);

      // If there's still a legacy audio element, update it
      if (audioRef.current) {
        audioRef.current.src = command.audioData;
        audioRef.current.load();
      }
    }
  }, []);

  // Redo operation
  const redo = useCallback(async () => {
    if (!commandManagerRef.current) return;

    const command = commandManagerRef.current.redo();
    if (command) {
      // Simply update the audioURL
      // This will trigger the WaveformContext to reload the audio
      setAudioURL(command.audioData);

      // If there's still a legacy audio element, update it
      if (audioRef.current) {
        audioRef.current.src = command.audioData;
        audioRef.current.load();
      }
    }
  }, []);
  
  // Get current command for debugging
  const getCurrentCommand = useCallback(() => {
    if (!commandManagerRef.current) return null;
    return commandManagerRef.current.getCurrentCommand();
  }, []);
  
  // Clear history (useful when switching between parts)
  const clearHistory = useCallback(() => {
    if (!commandManagerRef.current) return;
    commandManagerRef.current.clear();

    // Set hasInitialAudioRef to true so that subsequent edits will be tracked
    // When switching takes, we clear the history but want new edits to be added
    hasInitialAudioRef.current = true;
  }, []);
  
  const value = {
    // State
    audioURL,
    setAudioURL,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    playbackSpeed,
    setPlaybackSpeed,
    
    // DAW mode
    dawMode,
    setDawMode,
    
    // Refs
    audioRef,
    wavesurferRef,
    
    // Command history
    canUndo,
    canRedo,
    addToEditHistory,
    undo,
    redo,
    getCurrentCommand,
    clearHistory,
    
    // Methods
    loadAudio,
  };
  
  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};