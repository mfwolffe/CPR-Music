// contexts/SingleTrackContextSimple.js
'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { useAudio } from './AudioContext';

const SingleTrackContext = createContext();

export const useSingleTrack = () => {
  const context = useContext(SingleTrackContext);
  if (!context) {
    throw new Error('useSingleTrack must be used within SingleTrackProvider');
  }
  return context;
};

export const SingleTrackProvider = ({ children }) => {
  // Get global audio URL and controls from AudioContext
  const {
    audioURL: globalAudioURL,
    audioRef: globalAudioRef,
    addToEditHistory
  } = useAudio();

  // Local state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [region, setRegion] = useState(null); // { start: number, end: number }
  const [zoomLevel, setZoomLevel] = useState(100); // pixels per second
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // playback rate

  // Audio element reference
  const audioElementRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up audio element on unmount
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = '';
        audioElementRef.current = null;
      }
    };
  }, []);

  // Initialize audio element when URL changes
  useEffect(() => {
    if (!globalAudioURL) {
      setDuration(0);
      setCurrentTime(0);
      setIsPlaying(false);
      // Clean up audio element
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = '';
        audioElementRef.current = null;
      }
      return;
    }

    console.log('🎵 SingleTrack: Loading audio:', globalAudioURL);

    // Clean up previous audio element
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
    }

    // Create new audio element
    const audio = new Audio();
    audio.preload = 'metadata'; // Only load metadata initially
    audioElementRef.current = audio;

    // Set new source
    audio.src = globalAudioURL;

    // Handle metadata load
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      console.log('🎵 SingleTrack: Duration set to', audio.duration);
    };

    // Handle playback end
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration);
    };

    // Handle errors
    const handleError = (e) => {
      console.error('❌ SingleTrack: Audio error:', e);
      setDuration(0);
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // Load the metadata
    audio.load();

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      // Don't destroy the audio element here as it's still in use
    };
  }, [globalAudioURL]);

  // Update current time during playback
  useEffect(() => {
    let frameId = null;
    let lastUpdateTime = 0;

    const updateTime = () => {
      if (!audioElementRef.current || !isPlaying) return;

      const now = Date.now();
      // Throttle updates to 10fps to reduce state updates
      if (now - lastUpdateTime >= 100) {
        setCurrentTime(audioElementRef.current.currentTime);
        lastUpdateTime = now;
      }

      frameId = requestAnimationFrame(updateTime);
    };

    if (isPlaying) {
      updateTime();
    } else {
      // Clear any pending animation frame
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    }

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isPlaying]);

  // Update playback rate when speed changes
  useEffect(() => {
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Playback controls
  const play = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.play().catch(err => {
        console.error('Play error:', err);
      });
      setIsPlaying(true);
    }
  }, []);

  const pause = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, []);

  const seek = useCallback((timeInSeconds) => {
    if (audioElementRef.current) {
      const clampedTime = Math.max(0, Math.min(timeInSeconds, duration));
      audioElementRef.current.currentTime = clampedTime;
      setCurrentTime(clampedTime);
    }
  }, [duration]);

  const playPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const value = {
    // Audio state
    audioURL: globalAudioURL,
    duration,
    isPlaying,
    currentTime,

    // Playback controls
    play,
    pause,
    stop,
    seek,
    playPause,

    // Playback speed
    playbackSpeed,
    setPlaybackSpeed,

    // Region
    region,
    setRegion,

    // Zoom
    zoomLevel,
    setZoomLevel,

    // For effects processing
    audioElementRef,
    addToEditHistory,
  };

  return (
    <SingleTrackContext.Provider value={value}>
      {children}
    </SingleTrackContext.Provider>
  );
};