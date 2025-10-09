// contexts/SingleTrackContext.js
'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import audioContextManager from '../components/audio/DAW/Multitrack/AudioContextManager';
import { createTransport } from '../components/audio/DAW/Multitrack/AudioEngine';
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
  // Get global audio URL from AudioContext
  const { audioURL: globalAudioURL } = useAudio();

  // Audio source (synced with global AudioContext)
  const [audioURL, setAudioURL] = useState('');

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Region for effects/splice/excise
  const [region, setRegion] = useState(null); // { start: number, end: number } | null

  // Zoom level (pixels per second)
  const [zoomLevel, setZoomLevel] = useState(100); // 100px = 1 second

  // Transport for playback timing
  const transportRef = useRef(null);
  const audioElementRef = useRef(null); // HTMLAudioElement for playback

  // Sync local audioURL with global AudioContext audioURL
  useEffect(() => {
    if (globalAudioURL && globalAudioURL !== audioURL) {
      console.log('🔄 SingleTrack: Syncing with global audioURL:', globalAudioURL);
      setAudioURL(globalAudioURL);
      // Clear region when audio changes
      setRegion(null);
    }
  }, [globalAudioURL, audioURL]);

  // Initialize transport when duration changes
  useEffect(() => {
    transportRef.current = createTransport({
      onTick: (t) => setCurrentTime(t),
      getProjectDurationSec: () => duration || 0,
    });

    return () => {
      try {
        transportRef.current?.stop?.();
      } catch (err) {
        console.error('Error stopping transport:', err);
      }
    };
  }, [duration]);

  // Get live transport time
  const getTransportTime = useCallback(() => {
    if (!transportRef.current) return 0;
    return transportRef.current.currentTime || 0;
  }, []);

  // Create audio element when URL changes
  useEffect(() => {
    if (!audioURL) return;

    // Create new audio element
    const audio = new Audio(audioURL);
    audio.preload = 'auto';

    // Set up event listeners
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      console.log('🎵 SingleTrack: Audio loaded, duration =', audio.duration);
    };

    const handleEnded = () => {
      if (transportRef.current) {
        transportRef.current.pause();
      }
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    audioElementRef.current = audio;

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.src = '';
    };
  }, [audioURL]);

  // Sync audio element with transport
  useEffect(() => {
    const audio = audioElementRef.current;
    if (!audio || !transportRef.current) return;

    if (isPlaying) {
      // Sync audio element to transport time
      const transportTime = transportRef.current.currentTime;
      if (Math.abs(audio.currentTime - transportTime) > 0.1) {
        audio.currentTime = transportTime;
      }
      audio.play().catch(err => {
        console.error('Error playing audio:', err);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Play from current position or specified time
  const play = useCallback((fromSec = null) => {
    if (!transportRef.current) return;

    if (fromSec !== null) {
      transportRef.current.seek(fromSec);
    }

    transportRef.current.play();
    setIsPlaying(true);
  }, []);

  // Pause playback
  const pause = useCallback(() => {
    if (!transportRef.current) return;

    transportRef.current.pause();
    setIsPlaying(false);
  }, []);

  // Stop playback and return to start
  const stop = useCallback(() => {
    if (!transportRef.current) return;

    transportRef.current.stop();
    setIsPlaying(false);
  }, []);

  // Seek to specific time
  const seek = useCallback((timeInSeconds) => {
    if (!transportRef.current) return;

    const clampedTime = Math.max(0, Math.min(timeInSeconds, duration));
    transportRef.current.seek(clampedTime);

    // Also sync audio element
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = clampedTime;
    }
  }, [duration]);

  // Toggle play/pause
  const playPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const value = {
    // Audio state
    audioURL,
    setAudioURL,
    duration,

    // Playback state
    isPlaying,
    currentTime,

    // Playback controls
    play,
    pause,
    stop,
    seek,
    playPause,
    getTransportTime,

    // Region for effects
    region,
    setRegion,

    // Zoom
    zoomLevel,
    setZoomLevel,

    // Audio element ref (for effects processing)
    audioElementRef,
  };

  return (
    <SingleTrackContext.Provider value={value}>
      {children}
    </SingleTrackContext.Provider>
  );
};
