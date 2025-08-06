// contexts/MultitrackContext.js
'use client';

import { createContext, useContext, useState, useCallback } from 'react';

const MultitrackContext = createContext();

export const useMultitrack = () => {
  const context = useContext(MultitrackContext);
  if (!context) {
    throw new Error('useMultitrack must be used within MultitrackProvider');
  }
  return context;
};

export const MultitrackProvider = ({ children }) => {
  // Track state
  const [tracks, setTracks] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [soloTrackId, setSoloTrackId] = useState(null);

  // Multitrack playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // editor state
  const [activeRegion, setActiveRegion] = useState(null);

  // Track management
  const addTrack = useCallback(
    (trackData = {}) => {
      const newTrack = {
        id: Date.now(),
        name: trackData.name || `Track ${tracks.length + 1}`,
        audioURL: trackData.audioURL || null,
        volume: trackData.volume || 1,
        pan: trackData.pan || 0,
        muted: trackData.muted || false,
        solo: trackData.solo || false,
        color: trackData.color || '#7bafd4',
        wavesurferInstance: null, // Will be set by Track component
      };

      setTracks((prev) => [...prev, newTrack]);
      return newTrack;
    },
    [tracks.length],
  );

  const removeTrack = useCallback(
    (trackId) => {
      setTracks((prev) => prev.filter((track) => track.id !== trackId));
      if (selectedTrackId === trackId) {
        setSelectedTrackId(null);
      }
      if (soloTrackId === trackId) {
        setSoloTrackId(null);
      }
    },
    [selectedTrackId, soloTrackId],
  );

  const updateTrack = useCallback((trackId, updates) => {
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId ? { ...track, ...updates } : track,
      ),
    );
  }, []);

  const clearAllTracks = useCallback(() => {
    setTracks([]);
    setSelectedTrackId(null);
    setSoloTrackId(null);
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  // Playback control
  const play = useCallback(() => {
    // This will be implemented when we add actual multitrack functionality
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const seek = useCallback((time) => {
    setCurrentTime(time);
  }, []);

  const value = {
    // Track state
    tracks,
    setTracks,
    selectedTrackId,
    setSelectedTrackId,
    soloTrackId,
    setSoloTrackId,

    // Playback state
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,

    // Track management
    addTrack,
    removeTrack,
    updateTrack,
    clearAllTracks,

    // Playback control
    play,
    pause,
    stop,
    seek,

    // regions and effects
    activeRegion,
    setActiveRegion,
  };

  return (
    <MultitrackContext.Provider value={value}>
      {children}
    </MultitrackContext.Provider>
  );
};
