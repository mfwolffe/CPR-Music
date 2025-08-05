'use client';

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { Track, getDefaultTrackName, getNextTrackColor } from '../lib/Track';

// Create the context
const MultitrackContext = createContext(null);

// Export the hook to use the context
export const useMultitrack = () => {
  const context = useContext(MultitrackContext);
  if (!context) {
    throw new Error('useMultitrack must be used within MultitrackProvider');
  }
  return context;
};

// Provider component
export function MultitrackProvider({ children }) {
  // Core state
  const [tracks, setTracks] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [masterPan, setMasterPan] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [soloedTracks, setSoloedTracks] = useState(new Set());
  const [cursorPosition, setCursorPosition] = useState(0);

  // Audio context and nodes
  const audioContextRef = useRef(null);
  const masterGainNodeRef = useRef(null);
  const masterPanNodeRef = useRef(null);

  // Playback state
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(0);
  const pauseTimeRef = useRef(0);

  // Initialize audio context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();

      // Create master gain node
      masterGainNodeRef.current = audioContextRef.current.createGain();
      masterGainNodeRef.current.gain.value = masterVolume;

      // Create master pan node
      masterPanNodeRef.current = audioContextRef.current.createStereoPanner();
      masterPanNodeRef.current.pan.value = masterPan;

      // Connect master chain
      masterPanNodeRef.current.connect(masterGainNodeRef.current);
      masterGainNodeRef.current.connect(audioContextRef.current.destination);
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Update master volume
  useEffect(() => {
    if (masterGainNodeRef.current) {
      masterGainNodeRef.current.gain.value = masterVolume;
    }
  }, [masterVolume]);

  // Update master pan
  useEffect(() => {
    if (masterPanNodeRef.current) {
      masterPanNodeRef.current.pan.value = masterPan;
    }
  }, [masterPan]);

  // Calculate total duration when tracks change
  useEffect(() => {
    const maxDuration = tracks.reduce((max, track) => {
      const trackEnd = (track.startTime || 0) + (track.duration || 0);
      return Math.max(max, trackEnd);
    }, 0);
    setDuration(maxDuration);
  }, [tracks]);

  // Add a new track
  const addTrack = useCallback((name = null, color = null) => {
    let newTrack = null;

    setTracks((prevTracks) => {
      newTrack = new Track(
        name || getDefaultTrackName(prevTracks),
        color || getNextTrackColor(prevTracks),
      );

      // Setup audio nodes for the new track
      if (audioContextRef.current) {
        // Create gain node for track volume
        newTrack.gainNode = audioContextRef.current.createGain();
        newTrack.gainNode.gain.value = newTrack.volume;

        // Create pan node
        newTrack.panNode = audioContextRef.current.createStereoPanner();
        newTrack.panNode.pan.value = newTrack.pan;

        // Connect nodes: source -> gain -> pan -> master
        newTrack.gainNode.connect(newTrack.panNode);
        newTrack.panNode.connect(masterPanNodeRef.current);

        // Store nodes on track for reference
        newTrack.audioNodes = {
          gain: newTrack.gainNode,
          pan: newTrack.panNode,
        };
      }

      // Auto-select the new track
      setSelectedTrackId(newTrack.id);

      return [...prevTracks, newTrack];
    });

    return newTrack;
  }, []);

  // Remove a track
  const removeTrack = useCallback(
    (trackId) => {
      setTracks((prevTracks) => {
        const remainingTracks = prevTracks.filter(
          (track) => track.id !== trackId,
        );

        // If removed track was selected, select another
        if (trackId === selectedTrackId) {
          setSelectedTrackId(
            remainingTracks.length > 0 ? remainingTracks[0].id : null,
          );
        }

        // Clean up solo state
        setSoloedTracks((prev) => {
          const newSet = new Set(prev);
          newSet.delete(trackId);
          return newSet;
        });

        return remainingTracks;
      });
    },
    [selectedTrackId],
  );

  // Update track property
  const updateTrack = useCallback(
    (trackId, updates) => {
      setTracks((prevTracks) =>
        prevTracks.map((track) => {
          if (track.id === trackId) {
            // Create a new track object with updates to ensure React detects the change
            const updatedTrack = Object.assign(
              Object.create(Object.getPrototypeOf(track)),
              track,
            );

            // Apply all updates
            Object.keys(updates).forEach((key) => {
              updatedTrack[key] = updates[key];
            });

            // Handle audio node updates
            if ('volume' in updates && updatedTrack.gainNode) {
              const isSoloed = soloedTracks.size > 0;
              const isThisTrackSoloed = soloedTracks.has(trackId);

              if (updatedTrack.mute || (isSoloed && !isThisTrackSoloed)) {
                updatedTrack.gainNode.gain.value = 0;
              } else {
                updatedTrack.gainNode.gain.value = updatedTrack.volume;
              }
            }

            if ('mute' in updates && updatedTrack.gainNode) {
              const isSoloed = soloedTracks.size > 0;
              const isThisTrackSoloed = soloedTracks.has(trackId);

              if (updatedTrack.mute || (isSoloed && !isThisTrackSoloed)) {
                updatedTrack.gainNode.gain.value = 0;
              } else {
                updatedTrack.gainNode.gain.value = updatedTrack.volume;
              }
            }

            if ('pan' in updates && updatedTrack.panNode) {
              updatedTrack.panNode.pan.value = updatedTrack.pan;
            }

            // Handle solo state changes
            if ('solo' in updates) {
              setSoloedTracks((prev) => {
                const newSet = new Set(prev);
                if (updates.solo) {
                  newSet.add(trackId);
                } else {
                  newSet.delete(trackId);
                }
                return newSet;
              });
            }

            return updatedTrack;
          }
          return track;
        }),
      );
    },
    [soloedTracks],
  );

  // Set track audio - FIXED to ensure proper updates trigger waveform reload
  const setTrackAudio = useCallback(
    async (trackId, audioURL, audioBuffer = null) => {
      console.log('setTrackAudio called:', trackId, audioURL);

      // Load audio buffer if not provided
      if (!audioBuffer && audioURL) {
        try {
          const response = await fetch(audioURL);
          const arrayBuffer = await response.arrayBuffer();
          audioBuffer =
            await audioContextRef.current.decodeAudioData(arrayBuffer);
          console.log('Audio buffer loaded:', audioBuffer.duration, 'seconds');
        } catch (error) {
          console.error('Error loading audio:', error);
          return;
        }
      }

      // Update track with new audio data
      setTracks((prevTracks) => {
        return prevTracks.map((track) => {
          if (track.id === trackId) {
            console.log('Updating track with audio:', track.name);
            console.log(
              'Preserving recordingStartTime:',
              track.recordingStartTime,
            );

            // Create a new track instance to ensure React detects the change
            const updatedTrack = Object.assign(
              Object.create(Object.getPrototypeOf(track)),
              track,
            );

            // Update audio properties
            updatedTrack.audioURL = audioURL;
            updatedTrack.audioBuffer = audioBuffer;
            updatedTrack.duration = audioBuffer ? audioBuffer.duration : 0;

            // Preserve recording metadata
            if (track.recordingStartTime !== undefined) {
              updatedTrack.recordingStartTime = track.recordingStartTime;
            }

            // Setup audio nodes if they don't exist
            if (audioContextRef.current && !updatedTrack.gainNode) {
              // Create gain node for track volume
              updatedTrack.gainNode = audioContextRef.current.createGain();
              updatedTrack.gainNode.gain.value = updatedTrack.volume || 1;

              // Create pan node
              updatedTrack.panNode =
                audioContextRef.current.createStereoPanner();
              updatedTrack.panNode.pan.value = updatedTrack.pan || 0;

              // Connect nodes: source -> gain -> pan -> master
              updatedTrack.gainNode.connect(updatedTrack.panNode);
              updatedTrack.panNode.connect(masterPanNodeRef.current);
            }

            // Force update timestamp to ensure waveform reloads
            updatedTrack.lastUpdated = Date.now();

            console.log('Track updated with new audio');
            return updatedTrack;
          }
          return track;
        });
      });

      console.log('setTrackAudio completed');
    },
    [],
  );

  // Playback control functions
  const play = useCallback(() => {
    if (!audioContextRef.current || isPlaying) return;

    const context = audioContextRef.current;
    const now = context.currentTime;

    // Resume context if suspended
    if (context.state === 'suspended') {
      context.resume();
    }

    const startOffset = pauseTimeRef.current || cursorPosition;
    startTimeRef.current = now - startOffset / playbackSpeed;

    // Start all tracks
    tracks.forEach((track) => {
      if (track.audioBuffer && !track.mute) {
        // Calculate when this track should play based on its position
        const trackStartTime = track.recordingStartTime || 0;
        const trackEndTime = trackStartTime + (track.duration || 0);

        // Check if track should be playing at current position
        if (startOffset >= trackStartTime && startOffset < trackEndTime) {
          // Create source node
          if (track.sourceNode) {
            try {
              track.sourceNode.disconnect();
              track.sourceNode = null;
            } catch (e) {
              // Ignore errors
            }
          }

          track.sourceNode = context.createBufferSource();
          track.sourceNode.buffer = track.audioBuffer;
          track.sourceNode.playbackRate.value = playbackSpeed;

          // Connect through track's audio chain
          if (track.gainNode) {
            track.sourceNode.connect(track.gainNode);
          } else {
            // Fallback: connect directly to master
            track.sourceNode.connect(masterPanNodeRef.current);
          }

          // Calculate offset within the audio buffer
          const bufferOffset = startOffset - trackStartTime;
          track.sourceNode.start(0, bufferOffset);

          // Handle end of playback
          track.sourceNode.onended = () => {
            track.sourceNode = null;
          };
        } else if (startOffset < trackStartTime) {
          // Schedule track to start later
          const delay = (trackStartTime - startOffset) / playbackSpeed;

          track.sourceNode = context.createBufferSource();
          track.sourceNode.buffer = track.audioBuffer;
          track.sourceNode.playbackRate.value = playbackSpeed;

          // Connect through track's audio chain
          if (track.gainNode) {
            track.sourceNode.connect(track.gainNode);
          } else {
            track.sourceNode.connect(masterPanNodeRef.current);
          }

          track.sourceNode.start(now + delay);

          // Handle end of playback
          track.sourceNode.onended = () => {
            track.sourceNode = null;
          };
        }
      }
    });

    setIsPlaying(true);

    // Animation loop for time update
    const updateTime = () => {
      if (!isPlaying) return;

      const elapsed =
        (audioContextRef.current.currentTime - startTimeRef.current) *
        playbackSpeed;
      setCurrentTime(elapsed);

      // Stop if reached end
      if (elapsed >= duration) {
        stop();
      } else {
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateTime);
  }, [isPlaying, tracks, duration, playbackSpeed, cursorPosition]);

  const pause = useCallback(() => {
    if (!isPlaying) return;

    pauseTimeRef.current = currentTime;

    // Stop all track source nodes
    tracks.forEach((track) => {
      if (track.sourceNode) {
        try {
          track.sourceNode.stop();
          track.sourceNode.disconnect();
        } catch (e) {
          // Source might already be stopped
        }
        track.sourceNode = null;
      }
    });

    setIsPlaying(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isPlaying, currentTime, tracks]);

  const stop = useCallback(() => {
    // Stop all track source nodes
    tracks.forEach((track) => {
      if (track.sourceNode) {
        try {
          track.sourceNode.stop();
          track.sourceNode.disconnect();
        } catch (e) {
          // Source might already be stopped
        }
        track.sourceNode = null;
      }
    });

    setIsPlaying(false);
    setCurrentTime(0);
    setCursorPosition(0);
    pauseTimeRef.current = 0;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [tracks]);

  const seekTo = useCallback(
    (time) => {
      const clampedTime = Math.max(0, Math.min(time, duration));
      setCurrentTime(clampedTime);
      setCursorPosition(clampedTime);

      if (isPlaying) {
        pause();
        pauseTimeRef.current = clampedTime;
        setTimeout(play, 50); // Small delay to ensure clean restart
      } else {
        pauseTimeRef.current = clampedTime;
      }
    },
    [duration, isPlaying, pause, play],
  );

  // Handle cursor position updates
  const handleCursorPositionChange = useCallback(
    (position) => {
      setCursorPosition(position);
      if (!isPlaying) {
        setCurrentTime(position);
        pauseTimeRef.current = position;
      }
    },
    [isPlaying],
  );

  // Export selected track
  const exportSelectedTrack = useCallback(async () => {
    const track = tracks.find((t) => t.id === selectedTrackId);
    if (!track || !track.audioBuffer) {
      console.error('No track selected or track has no audio');
      return null;
    }

    try {
      // Convert audio buffer to WAV
      const wavBuffer = await audioBufferToWav(track.audioBuffer);
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      return blob;
    } catch (error) {
      console.error('Error exporting track:', error);
      return null;
    }
  }, [tracks, selectedTrackId]);

  const value = {
    // State
    tracks,
    isPlaying,
    currentTime,
    duration,
    playbackSpeed,
    masterVolume,
    masterPan,
    selectedTrackId,
    soloedTracks,
    cursorPosition,

    // Track management
    addTrack,
    removeTrack,
    updateTrack,
    setTrackAudio,
    setSelectedTrackId,

    // Playback controls
    play,
    pause,
    stop,
    seekTo,
    handleCursorPositionChange,

    // Settings
    setPlaybackSpeed,
    setMasterVolume,
    setMasterPan,

    // Export
    exportSelectedTrack,

    // Audio context (for advanced use)
    audioContext: audioContextRef.current,
  };

  return (
    <MultitrackContext.Provider value={value}>
      {children}
    </MultitrackContext.Provider>
  );
}

// Helper function to convert AudioBuffer to WAV
async function audioBufferToWav(buffer) {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  const channels = [];
  let offset = 0;
  let pos = 0;

  // Write WAV header
  const setUint16 = (data) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };
  const setUint32 = (data) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  // RIFF identifier
  setUint32(0x46464952);
  // file length
  setUint32(length - 8);
  // RIFF type
  setUint32(0x45564157);
  // format chunk identifier
  setUint32(0x20746d66);
  // format chunk length
  setUint32(16);
  // sample format (PCM)
  setUint16(1);
  // channel count
  setUint16(buffer.numberOfChannels);
  // sample rate
  setUint32(buffer.sampleRate);
  // byte rate
  setUint32(buffer.sampleRate * buffer.numberOfChannels * 2);
  // block align
  setUint16(buffer.numberOfChannels * 2);
  // bits per sample
  setUint16(16);
  // data chunk identifier
  setUint32(0x61746164);
  // data chunk length
  setUint32(length - pos - 4);

  // Extract channel data
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  // Interleave channels and convert to 16-bit PCM
  while (offset < buffer.length) {
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return arrayBuffer;
}
