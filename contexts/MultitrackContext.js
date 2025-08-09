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
    console.log(
      '🎻 Registered instruments:',
      Object.keys(trackInstrumentsRef.current),
    );
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
          setCurrentTime((prev) => prev + 0.1);
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
    console.log('📝 Context: registerTrackInstrument called', {
      trackId,
      hasInstrument: !!instrument,
    });

    if (instrument) {
      trackInstrumentsRef.current[trackId] = instrument;
      console.log('✅ Instrument registered for track:', trackId);
      console.log(
        '📊 Total registered instruments:',
        Object.keys(trackInstrumentsRef.current).length,
      );
    } else {
      delete trackInstrumentsRef.current[trackId];
      console.log('❌ Instrument unregistered for track:', trackId);
    }
  }, []);

  const playNoteOnSelectedTrack = useCallback(
    (note, velocity = 0.8) => {
      console.log('🎵 Context: playNoteOnSelectedTrack called', {
        note,
        velocity,
        selectedTrackId,
        availableInstruments: Object.keys(trackInstrumentsRef.current),
        hasInstrumentForTrack: !!trackInstrumentsRef.current[selectedTrackId],
      });

      const selectedTrack = tracks.find(
        (t) => t.id === selectedTrackId && t.type === 'midi',
      );
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
          trackType: selectedTrack?.type,
        });
      }
    },
    [selectedTrackId, tracks, soloTrackId],
  );

  const stopNoteOnSelectedTrack = useCallback(
    (note) => {
      console.log('🎵 Context: stopNoteOnSelectedTrack called', {
        note,
        selectedTrackId,
      });

      const selectedTrack = tracks.find(
        (t) => t.id === selectedTrackId && t.type === 'midi',
      );
      if (selectedTrack && trackInstrumentsRef.current[selectedTrackId]) {
        try {
          trackInstrumentsRef.current[selectedTrackId].stopNote(note);
          console.log('✅ Note stopped successfully');
        } catch (error) {
          console.error('❌ Error stopping note:', error);
        }
      }
    },
    [selectedTrackId, tracks],
  );

  // --- Region editing helpers (audio + MIDI) ---
  function audioBufferToWav(buffer) {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    let pos = 0;
    const setUint16 = (d) => {
      view.setUint16(pos, d, true);
      pos += 2;
    };
    const setUint32 = (d) => {
      view.setUint32(pos, d, true);
      pos += 4;
    };

    // RIFF/WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8);
    setUint32(0x45564157); // "WAVE"
    // fmt chunk
    setUint32(0x20746d66); // "fmt "
    setUint32(16);
    setUint16(1); // PCM
    setUint16(buffer.numberOfChannels);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels);
    setUint16(buffer.numberOfChannels * 2);
    setUint16(16);
    // data chunk
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    // Interleave & write samples
    let offset = pos;
    const channels = [];
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      channels[ch] = buffer.getChannelData(ch);
    }
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const s = Math.max(-1, Math.min(1, channels[ch][i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  async function deleteAudioSegment(buffer, startSec, endSec) {
    const sr = buffer.sampleRate;
    const startS = Math.max(
      0,
      Math.min(buffer.length, Math.round(startSec * sr)),
    );
    const endS = Math.max(
      startS,
      Math.min(buffer.length, Math.round(endSec * sr)),
    );
    const cutLen = endS - startS;
    if (cutLen <= 0) return buffer;

    const newLen = buffer.length - cutLen;
    const out = new AudioBuffer({
      numberOfChannels: buffer.numberOfChannels,
      length: newLen,
      sampleRate: sr,
    });

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch);
      const dst = out.getChannelData(ch);
      // Pre-cut
      dst.set(src.subarray(0, startS), 0);
      // Post-cut, moved left
      dst.set(src.subarray(endS), startS);

      // 5ms crossfade at the join to avoid clicks
      const cross = Math.min(Math.floor(sr * 0.005), startS, newLen - startS);
      for (let i = 0; i < cross; i++) {
        const t = i / cross;
        const a = dst[startS - cross + i];
        const b = dst[startS + i];
        dst[startS - cross + i] = a * (1 - t) + b * t;
      }
    }
    return out;
  }

  function exciseAudioSegment(buffer, startSec, endSec) {
    const sr = buffer.sampleRate;
    const startS = Math.max(
      0,
      Math.min(buffer.length, Math.round(startSec * sr)),
    );
    const endS = Math.max(
      startS,
      Math.min(buffer.length, Math.round(endSec * sr)),
    );
    const newLen = Math.max(0, endS - startS);
    const out = new AudioBuffer({
      numberOfChannels: buffer.numberOfChannels,
      length: newLen,
      sampleRate: sr,
    });

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch);
      const dst = out.getChannelData(ch);
      dst.set(src.subarray(startS, endS), 0);

      // 5ms fade in/out so trims are click‑free
      const fade = Math.min(Math.floor(sr * 0.005), newLen);
      for (let i = 0; i < fade; i++) {
        const t = i / fade;
        dst[i] *= t; // fade-in
        dst[newLen - 1 - i] *= t; // fade-out
      }
    }
    return out;
  }

  const deleteRegion = useCallback(
    async (region) => {
      if (!region) return;
      const rStart = Math.max(
        0,
        Math.min(
          region.start ?? region.startTime ?? 0,
          region.end ?? region.endTime ?? 0,
        ),
      );
      const rEnd = Math.max(
        rStart,
        region.end ?? region.endTime ?? region.start ?? region.startTime ?? 0,
      );

      try {
        pause();
      } catch {}

      const updatedTracks = await Promise.all(
        tracks.map(async (track) => {
          // AUDIO: ripple delete (remove time & close gap)
          if (track.wavesurferInstance && track.audioURL) {
            try {
              const buffer = await track.wavesurferInstance.getDecodedData();
              if (!buffer) return track;
              const edited = await deleteAudioSegment(buffer, rStart, rEnd);
              if (edited.length === buffer.length) return track; // nothing changed
              const blob = audioBufferToWav(edited);
              const newURL = URL.createObjectURL(blob);
              const oldURL = track.audioURL;
              setTimeout(() => {
                try {
                  URL.revokeObjectURL(oldURL);
                } catch {}
              }, 1000);
              return { ...track, audioURL: newURL, wavesurferInstance: null };
            } catch (e) {
              console.warn(
                'Delete region (audio) failed for track',
                track.id,
                e,
              );
              return track;
            }
          }

          // MIDI: trim/split notes and shift later notes left
          if (track.type === 'midi' && track.midiData) {
            const tempo = track.midiData.tempo || 120;
            const spb = 60 / tempo;
            const rs = rStart / spb;
            const re = rEnd / spb;
            const delta = re - rs;

            const src = Array.isArray(track.midiData.notes)
              ? track.midiData.notes
              : [];
            const out = [];
            for (const n of src) {
              const s = n.startTime;
              const e = n.startTime + n.duration;

              if (e <= rs) {
                out.push(n); // before region
              } else if (s >= re) {
                out.push({ ...n, startTime: s - delta }); // after region → shift left
              } else if (s < rs && e > re) {
                // spans the region → split into two notes
                const leftDur = Math.max(0, rs - s);
                const rightDur = Math.max(0, e - re);
                if (leftDur > 1e-6) out.push({ ...n, duration: leftDur });
                if (rightDur > 1e-6)
                  out.push({ ...n, startTime: re - delta, duration: rightDur });
              } else if (s < rs && e > rs && e <= re) {
                const leftDur = Math.max(0, rs - s); // overlap left edge → keep left part
                if (leftDur > 1e-6) out.push({ ...n, duration: leftDur });
              } else if (s >= rs && s < re && e > re) {
                const rightDur = Math.max(0, e - re); // overlap right edge → keep right part
                if (rightDur > 1e-6)
                  out.push({ ...n, startTime: re - delta, duration: rightDur });
              }
              // fully inside region → dropped
            }

            return { ...track, midiData: { ...track.midiData, notes: out } };
          }

          return track;
        }),
      );

      setTracks(updatedTracks);
      setActiveRegion(null);
      setCurrentTime(rStart);
    },
    [tracks, pause, setTracks, setActiveRegion, setCurrentTime],
  );

  const exciseRegion = useCallback(
    async (region) => {
      if (!region) return;
      const rStart = Math.max(
        0,
        Math.min(
          region.start ?? region.startTime ?? 0,
          region.end ?? region.endTime ?? 0,
        ),
      );
      const rEnd = Math.max(
        rStart,
        region.end ?? region.endTime ?? region.start ?? region.startTime ?? 0,
      );

      try {
        pause();
      } catch {}

      const updatedTracks = await Promise.all(
        tracks.map(async (track) => {
          // AUDIO: keep only selection (rebased to 0s)
          if (track.wavesurferInstance && track.audioURL) {
            try {
              const buffer = await track.wavesurferInstance.getDecodedData();
              if (!buffer) return track;
              const clipped = exciseAudioSegment(buffer, rStart, rEnd);
              const blob = audioBufferToWav(clipped);
              const newURL = URL.createObjectURL(blob);
              const oldURL = track.audioURL;
              setTimeout(() => {
                try {
                  URL.revokeObjectURL(oldURL);
                } catch {}
              }, 1000);
              return { ...track, audioURL: newURL, wavesurferInstance: null };
            } catch (e) {
              console.warn(
                'Excise region (audio) failed for track',
                track.id,
                e,
              );
              return track;
            }
          }

          // MIDI: keep only overlapping notes, trim to edges, rebase start to 0
          if (track.type === 'midi' && track.midiData) {
            const tempo = track.midiData.tempo || 120;
            const spb = 60 / tempo;
            const rs = rStart / spb;
            const re = rEnd / spb;
            const src = Array.isArray(track.midiData.notes)
              ? track.midiData.notes
              : [];
            const out = [];
            for (const n of src) {
              const s = n.startTime;
              const e = n.startTime + n.duration;
              const clipStart = Math.max(s, rs);
              const clipEnd = Math.min(e, re);
              const dur = Math.max(0, clipEnd - clipStart);
              if (dur > 1e-6)
                out.push({ ...n, startTime: clipStart - rs, duration: dur });
            }
            return { ...track, midiData: { ...track.midiData, notes: out } };
          }

          return track;
        }),
      );

      setTracks(updatedTracks);
      setActiveRegion(null);
      setCurrentTime(0);
    },
    [tracks, pause, setTracks, setActiveRegion, setCurrentTime],
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
    deleteRegion,
    exciseRegion,

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
