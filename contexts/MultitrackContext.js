// contexts/MultitrackContext.js
'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';

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

  // Editor state
  const [activeRegion, setActiveRegion] = useState(null);

  // Playback timer
  const playbackTimerRef = useRef(null);
  
  // MIDI-specific refs
  const trackInstrumentsRef = useRef({}); // Store instrument references for each track
  const midiSchedulerRef = useRef(null); // For future MIDI scheduling

  // Debug: Log when instruments change
  useEffect(() => {
    console.log('🎻 Registered instruments:', Object.keys(trackInstrumentsRef.current));
  }, [tracks]); // Re-log when tracks change

  // Update current time during playback
  useEffect(() => {
    if (isPlaying) {
      playbackTimerRef.current = setInterval(() => {
        // Get current time from the first track with a wavesurfer instance
        const firstTrack = tracks.find((t) => t.wavesurferInstance);
        if (firstTrack && firstTrack.wavesurferInstance) {
          const time = firstTrack.wavesurferInstance.getCurrentTime();
          setCurrentTime(time);
        } else {
          // If no audio tracks, increment time manually for MIDI-only playback
          setCurrentTime(prev => prev + 0.1);
        }
      }, 100); // Update every 100ms
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, [isPlaying, tracks]);

  // Update duration when tracks change
  useEffect(() => {
    // Find the longest duration among all tracks
    let maxDuration = 0;
    
    // Check audio tracks
    tracks.forEach((track) => {
      if (track.wavesurferInstance) {
        try {
          const trackDuration = track.wavesurferInstance.getDuration() || 0;
          maxDuration = Math.max(maxDuration, trackDuration);
        } catch (e) {
          // Ignore errors
        }
      }
    });
    
    // Check MIDI tracks
    tracks.forEach((track) => {
      if (track.type === 'midi' && track.midiData?.notes?.length > 0) {
        const lastNote = track.midiData.notes.reduce((latest, note) => {
          const noteEnd = note.startTime + note.duration;
          return noteEnd > latest ? noteEnd : latest;
        }, 0);
        maxDuration = Math.max(maxDuration, lastNote);
      }
    });

    setDuration(maxDuration);
  }, [tracks]);

  // Track management
  const addTrack = useCallback(
    (trackData = {}) => {
      const newTrack = {
        id: Date.now(),
        name: trackData.name || `Track ${tracks.length + 1}`,
        type: trackData.type || 'audio', // 'audio' or 'midi'
        audioURL: trackData.audioURL || null,
        volume: trackData.volume || 1,
        pan: trackData.pan || 0,
        muted: trackData.muted || false,
        solo: trackData.solo || false,
        color: trackData.color || '#7bafd4',
        wavesurferInstance: null, // Will be set by Track component
        // Preserve any additional properties passed in
        ...trackData,
      };

      console.log('MultitrackContext: Adding track:', newTrack);

      setTracks((prev) => [...prev, newTrack]);
      return newTrack;
    },
    [tracks.length],
  );

  const removeTrack = useCallback(
    (trackId) => {
      // Clean up instrument reference if it's a MIDI track
      if (trackInstrumentsRef.current[trackId]) {
        console.log('🗑️ Removing instrument for track:', trackId);
        delete trackInstrumentsRef.current[trackId];
      }
      
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

    // If wavesurferInstance was updated, trigger a duration recalculation
    if (updates.wavesurferInstance) {
      // Force a re-render to update duration
      setTimeout(() => {
        setTracks((prev) => [...prev]);
      }, 100);
    }
  }, []);

  const clearAllTracks = useCallback(() => {
    // Stop any playing tracks first
    tracks.forEach((track) => {
      if (track.wavesurferInstance) {
        try {
          track.wavesurferInstance.pause();
          track.wavesurferInstance.destroy();
        } catch (e) {
          console.warn('Error cleaning up track:', e);
        }
      }
    });
    
    // Clear instrument references
    trackInstrumentsRef.current = {};

    setTracks([]);
    setSelectedTrackId(null);
    setSoloTrackId(null);
    setCurrentTime(0);
    setIsPlaying(false);
    setActiveRegion(null);
  }, [tracks]);

  // Playback control
  const play = useCallback(() => {
    console.log('MultitrackContext: Playing all tracks');

    // Play all audio tracks (wavesurfer instances)
    tracks.forEach((track) => {
      if (track.wavesurferInstance && !track.muted) {
        // Check if it's solo mode
        if (soloTrackId && track.id !== soloTrackId) {
          return; // Skip non-solo tracks
        }

        try {
          track.wavesurferInstance.play();
        } catch (err) {
          console.error(`Error playing track ${track.id}:`, err);
        }
      }
    });
    
    // MIDI tracks will handle their own playback through their components

    setIsPlaying(true);
  }, [tracks, soloTrackId]);

  const pause = useCallback(() => {
    console.log('MultitrackContext: Pausing all tracks');

    // Pause all wavesurfer instances
    tracks.forEach((track) => {
      if (track.wavesurferInstance) {
        try {
          track.wavesurferInstance.pause();
        } catch (err) {
          console.error(`Error pausing track ${track.id}:`, err);
        }
      }
    });

    setIsPlaying(false);
  }, [tracks]);

  const stop = useCallback(() => {
    console.log('MultitrackContext: Stopping all tracks');

    // Stop all wavesurfer instances and seek to beginning
    tracks.forEach((track) => {
      if (track.wavesurferInstance) {
        try {
          track.wavesurferInstance.pause();
          track.wavesurferInstance.seekTo(0);
        } catch (err) {
          console.error(`Error stopping track ${track.id}:`, err);
        }
      }
    });

    setIsPlaying(false);
    setCurrentTime(0);
  }, [tracks]);

  const seek = useCallback(
    (progress) => {
      // Seek all tracks to the same position (progress is 0-1)
      tracks.forEach((track) => {
        if (track.wavesurferInstance) {
          try {
            track.wavesurferInstance.seekTo(progress);
          } catch (err) {
            console.error(`Error seeking track ${track.id}:`, err);
          }
        }
      });

      // Update current time based on longest track
      const longestDuration = Math.max(
        ...tracks.map((t) => t.wavesurferInstance?.getDuration() || 0),
      );
      setCurrentTime(progress * longestDuration);
    },
    [tracks],
  );

  // MIDI-specific methods
  const registerTrackInstrument = useCallback((trackId, instrument) => {
    console.log('📝 Context: registerTrackInstrument called', { trackId, hasInstrument: !!instrument });
    
    if (instrument) {
      trackInstrumentsRef.current[trackId] = instrument;
      console.log('✅ Instrument registered for track:', trackId);
      console.log('📊 Total registered instruments:', Object.keys(trackInstrumentsRef.current).length);
    } else {
      delete trackInstrumentsRef.current[trackId];
      console.log('❌ Instrument unregistered for track:', trackId);
    }
  }, []);

  const playNoteOnSelectedTrack = useCallback((note, velocity = 0.8) => {
    console.log('🎵 Context: playNoteOnSelectedTrack called', { 
      note, 
      velocity, 
      selectedTrackId,
      availableInstruments: Object.keys(trackInstrumentsRef.current),
      hasInstrumentForTrack: !!trackInstrumentsRef.current[selectedTrackId]
    });
    
    const selectedTrack = tracks.find(t => t.id === selectedTrackId && t.type === 'midi');
    console.log('🎵 Context: Selected track:', selectedTrack);
    
    if (selectedTrack && trackInstrumentsRef.current[selectedTrackId]) {
      console.log('🎵 Context: Found instrument, checking mute/solo state');
      
      // Check if track is muted or if we're in solo mode
      if (selectedTrack.muted) {
        console.log('❌ Track is muted');
        return;
      }
      if (soloTrackId && selectedTrack.id !== soloTrackId) {
        console.log('❌ Track is not soloed');
        return;
      }
      
      try {
        console.log('🎵 Context: Calling instrument.playNote()');
        trackInstrumentsRef.current[selectedTrackId].playNote(note, velocity);
        console.log('✅ Note played successfully');
      } catch (error) {
        console.error('❌ Error playing note:', error);
      }
    } else {
      console.log('❌ No instrument found for track', {
        hasTrack: !!selectedTrack,
        hasInstrument: !!trackInstrumentsRef.current[selectedTrackId],
        trackType: selectedTrack?.type
      });
    }
  }, [selectedTrackId, tracks, soloTrackId]);

  const stopNoteOnSelectedTrack = useCallback((note) => {
    console.log('🎵 Context: stopNoteOnSelectedTrack called', { note, selectedTrackId });
    
    const selectedTrack = tracks.find(t => t.id === selectedTrackId && t.type === 'midi');
    if (selectedTrack && trackInstrumentsRef.current[selectedTrackId]) {
      try {
        trackInstrumentsRef.current[selectedTrackId].stopNote(note);
        console.log('✅ Note stopped successfully');
      } catch (error) {
        console.error('❌ Error stopping note:', error);
      }
    }
  }, [selectedTrackId, tracks]);

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
    
    // MIDI methods
    registerTrackInstrument,
    playNoteOnSelectedTrack,
    stopNoteOnSelectedTrack,
  };

  return (
    <MultitrackContext.Provider value={value}>
      {children}
    </MultitrackContext.Provider>
  );
};