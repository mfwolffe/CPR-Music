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

  // Update current time during playback
  useEffect(() => {
    if (isPlaying) {
      playbackTimerRef.current = setInterval(() => {
        // Get current time from the first track with a wavesurfer instance
        const firstTrack = tracks.find((t) => t.wavesurferInstance);
        if (firstTrack && firstTrack.wavesurferInstance) {
          const time = firstTrack.wavesurferInstance.getCurrentTime();
          setCurrentTime(time);
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

    // Play all wavesurfer instances
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
