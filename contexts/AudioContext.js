'use client';

import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

const AudioContext = createContext();

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }
  return context;
};

export const AudioProvider = ({ children }) => {
  // Core audio state - keeping it minimal and stable
  const [audioURL, setAudioURL] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  // References - these won't cause re-renders
  const audioRef = useRef(null);
  const wavesurferRef = useRef(null);
  
  // Edit history for undo/redo
  const [editList, setEditList] = useState([]);
  const [editListIndex, setEditListIndex] = useState(0);
  
  // Carefully managed audio loading
  const loadAudio = useCallback(async (url) => {
    if (!url || !wavesurferRef.current) return;
    
    try {
      setAudioURL(url);
      // We'll let the component handle the actual wavesurfer loading
      // to avoid breaking the delicate setup
    } catch (error) {
      console.error('Error in loadAudio:', error);
    }
  }, []);
  
  // Add to edit history
  const addToEditHistory = useCallback((url) => {
    setEditList(prev => {
      const newList = [...prev.slice(0, editListIndex + 1), url];
      setEditListIndex(newList.length - 1);
      return newList;
    });
  }, [editListIndex]);
  
  // Restore from edit history
  const restoreFromHistory = useCallback((index) => {
    if (index < 0 || index >= editList.length) return;
    
    const url = editList[index];
    setAudioURL(url);
    setEditListIndex(index);
    
    // Return the URL so the component can load it into wavesurfer
    return url;
  }, [editList]);
  
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
    
    // Refs
    audioRef,
    wavesurferRef,
    
    // Edit history
    editList,
    editListIndex,
    setEditListIndex,
    addToEditHistory,
    restoreFromHistory,
    
    // Methods
    loadAudio,
  };
  
  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};