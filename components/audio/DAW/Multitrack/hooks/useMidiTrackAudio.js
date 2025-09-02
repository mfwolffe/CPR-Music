// components/audio/DAW/Multitrack/hooks/useMIDITrackAudio.js
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import audioContextManager from '../AudioContextManager';
import { createInstrument } from '../Instruments/WebAudioInstruments';
import ImprovedNoteScheduler from '../ImprovedNoteScheduler';
import ImprovedMIDIRecorder from '../MIDIRecorder';

/**
 * Custom hook to manage MIDI track audio with improved performance
 */
export function useMIDITrackAudio(
  track,
  isGlobalPlaying,
  globalCurrentTime,
  registerTrackInstrument,
) {
  const [isRecording, setIsRecording] = useState(false);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [countInBeat, setCountInBeat] = useState(0);

  const instrumentRef = useRef(null);
  const schedulerRef = useRef(null);
  const recorderRef = useRef(null);
  const masterGainRef = useRef(null);
  const pannerRef = useRef(null);
  const lastPlayStateRef = useRef(false);
  const noteLastPlayedRef = useRef(new Map()); // note -> timestamp

  // Initialize audio nodes
  useEffect(() => {
    const audioContext = audioContextManager.getContext();

    // Create gain node for volume control
    masterGainRef.current = audioContextManager.createGain();
    masterGainRef.current.gain.value = track.volume || 0.75;

    // Create panner node
    pannerRef.current = audioContextManager.createStereoPanner();
    pannerRef.current.pan.value = track.pan || 0;

    // Connect nodes
    masterGainRef.current.connect(pannerRef.current);
    pannerRef.current.connect(audioContextManager.getDestination());

    return () => {
      // Robust cleanup with error handling
      try {
        if (instrumentRef.current) {
          instrumentRef.current.stopAllNotes?.();
          instrumentRef.current.dispose?.();
        }
      } catch (error) {
        console.warn('Error disposing instrument:', error);
      }
      
      try {
        if (schedulerRef.current) {
          schedulerRef.current.stop();
        }
      } catch (error) {
        console.warn('Error stopping scheduler:', error);
      }
      
      try {
        if (recorderRef.current) {
          recorderRef.current.stop();
        }
      } catch (error) {
        console.warn('Error stopping recorder:', error);
      }
      
      try {
        masterGainRef.current?.disconnect();
        pannerRef.current?.disconnect();
      } catch (error) {
        console.warn('Error disconnecting audio nodes:', error);
      }
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = track.muted ? 0 : track.volume || 0.75;
    }
  }, [track.volume, track.muted]);

  // Update pan
  useEffect(() => {
    if (pannerRef.current) {
      pannerRef.current.pan.value = track.pan || 0;
    }
  }, [track.pan]);

  // Create/update instrument (robust connection + fallbacks)
  useEffect(() => {
    let disposed = false;
    const audioContext = audioContextManager.getContext();

    const setup = async () => {
      // Dispose previous instrument
      if (instrumentRef.current) {
        try {
          instrumentRef.current.stopAllNotes?.();
          instrumentRef.current.dispose?.();
        } catch {}
      }

      // Use default instrument if none specified
      const instrument = track.midiData?.instrument || {
        type: 'synth',
        preset: 'default',
        name: 'Basic Synth',
        id: 'basic-synth'
      };

      const { type, preset, name, id } = instrument;
      if (process.env.NODE_ENV === 'development') {
        console.log('🎹 Creating instrument', {
          trackId: track.id,
          type,
          preset,
          name,
          id,
        });
      }

      let inst = null;
      try {
        inst = createInstrument(audioContext, type, preset);
      } catch (e) {
        console.warn(
          'Instrument factory threw; falling back to Basic Synth',
          e,
        );
      }

      // Await readiness for async/sampler instruments
      if (inst?.ready && typeof inst.ready.then === 'function') {
        try {
          await inst.ready;
        } catch (e) {
          console.warn('Instrument ready() failed; will try fallback', e);
        }
      }

      // Fallback if unsupported or missing playNote
      if (!inst || typeof inst.playNote !== 'function') {
        console.warn(
          '⚠️ Unsupported instrument type/preset; using Basic Synth instead',
          { type, preset },
        );
        try {
          inst = createInstrument(audioContext, 'synth', 'default');
        } catch (e) {
          console.error('Fallback Basic Synth creation failed', e);
        }
      }

      if (disposed) return;
      instrumentRef.current = inst;

      // Robust connection to the track chain
      let connected = false;
      try {
        if (inst && typeof inst.connect === 'function') {
          inst.connect(masterGainRef.current);
          connected = true;
        } else if (inst?.output?.connect) {
          inst.output.connect(masterGainRef.current);
          connected = true;
        } else if (inst?.node?.connect) {
          inst.node.connect(masterGainRef.current);
          connected = true;
        }
      } catch (e) {
        console.error('Instrument connect failed', e);
      }
      if (!connected) {
        console.warn(
          'Instrument has no connect()/output; audio may be silent',
          inst,
        );
      } else {
        console.log('✅ Instrument connected to track chain');
      }

      // Register the instrument for preview via context
      registerTrackInstrument(track.id, inst);

      // Rebuild scheduler for this instrument
      if (schedulerRef.current) {
        try {
          schedulerRef.current.stop();
        } catch {}
      }
      schedulerRef.current = new ImprovedNoteScheduler(inst, {
        tempo: track.midiData?.tempo || 120,
      });
      schedulerRef.current.setNotes(track.midiData?.notes || []);
    };

    setup();
    return () => {
      disposed = true;
      registerTrackInstrument(track.id, null);
    };
  }, [
    track.midiData?.instrument?.type,
    track.midiData?.instrument?.preset,
    track.id,
    registerTrackInstrument,
  ]);

  // Update scheduler with notes and tempo
  useEffect(() => {
    if (schedulerRef.current) {
      const notes = track.midiData?.notes || [];
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`🎼 MIDI Track ${track.id}: Setting ${notes.length} notes on scheduler`, {
          trackId: track.id,
          trackName: track.name,
          notesCount: notes.length,
          notes: notes.slice(0, 3),
          tempo: track.midiData?.tempo || 120,
        });
      }
      schedulerRef.current.setNotes(notes);
      schedulerRef.current.setTempo(track.midiData?.tempo || 120);
    }
  }, [track.midiData?.notes, track.midiData?.tempo]);

  // Handle playback state changes
  useEffect(() => {
    if (!schedulerRef.current) return;

    // Don't play live synthesis during mixdown to prevent dual synthesis
    const isMixdownActive = typeof window !== 'undefined' && window.__MIXDOWN_ACTIVE__;
    
    const shouldPlay =
      !isMixdownActive && 
      isGlobalPlaying && 
      !track.muted && 
      track.midiData?.notes?.length > 0;

    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔊 MIDI Track ${track.id} playback decision:`, {
        trackId: track.id,
        isMixdownActive,
        isGlobalPlaying,
        trackMuted: track.muted,
        notesLength: track.midiData?.notes?.length || 0,
        shouldPlay,
        lastPlayState: lastPlayStateRef.current,
      });
    }

    if (shouldPlay && !lastPlayStateRef.current) {
      // Start playback
      const beatPosition =
        (globalCurrentTime * (track.midiData?.tempo || 120)) / 60;
      if (process.env.NODE_ENV === 'development') {
        console.log(`▶️ Starting MIDI playback for track ${track.id} at beat ${beatPosition.toFixed(3)}`);
      }
      schedulerRef.current.start(beatPosition);
    } else if (!shouldPlay && lastPlayStateRef.current) {
      // Stop playback
      if (process.env.NODE_ENV === 'development') {
        console.log(`⏹️ Stopping MIDI playback for track ${track.id}`);
      }
      schedulerRef.current.stop();
    } else if (shouldPlay) {
      // Update position during playback
      const beatPosition =
        (globalCurrentTime * (track.midiData?.tempo || 120)) / 60;
      const currentSchedulerBeat = schedulerRef.current.getCurrentBeat();

      // Detect seeks (large jumps)
      if (Math.abs(beatPosition - currentSchedulerBeat) > 0.5) {
        schedulerRef.current.seek(beatPosition);
      }
    }

    lastPlayStateRef.current = shouldPlay;
  }, [
    isGlobalPlaying,
    globalCurrentTime,
    track.muted,
    track.midiData?.notes,
    track.midiData?.tempo,
  ]);

  // Play a single note (for preview/audition)
  const playNote = useCallback((note, velocity = 1, time) => {
    if (!instrumentRef.current) return;

    // Simple debounce - ignore if same note was just played
    const now = Date.now();
    const lastPlayed = noteLastPlayedRef.current.get(note) || 0;
    if (now - lastPlayed < 20) {
      // 20ms debounce window
      console.log('Debouncing duplicate note:', note);
      return;
    }
    noteLastPlayedRef.current.set(note, now);

    // Rest of playNote implementation...
    const audioContext = audioContextManager.getContext();
    const secondArg = time != null ? time : audioContext.currentTime;
    instrumentRef.current.playNote(note, velocity, secondArg);
  }, []);

  // Stop a single note
  const stopNote = useCallback((note, token = null) => {
    if (instrumentRef.current) {
      const audioContext = audioContextManager.getContext();
      const secondArg = token ?? audioContext.currentTime; // handle-or-time
      instrumentRef.current.stopNote(note, secondArg);
    }
  }, []);

  // Start recording
  const startRecording = useCallback(
    (options = {}) => {
      if (recorderRef.current) {
        recorderRef.current.stop();
      }

      const tempo = track.midiData?.tempo || 120;

      recorderRef.current = new ImprovedMIDIRecorder({
        tempo,
        countInBeats: options.countInBeats || 4,
        quantize: options.quantize || null,
        overdub: options.overdub || false,

        onCountIn: ({ beat, total }) => {
          setCountInBeat(beat);
          setIsCountingIn(beat <= total);
        },

        onStart: () => {
          setIsRecording(true);
          setIsCountingIn(false);
        },

        onStop: ({ notes }) => {
          setIsRecording(false);
          // Notes are returned in seconds, convert to beats
          const beatsPerSecond = tempo / 60;
          const convertedNotes = notes.map((n) => ({
            ...n,
            startTime: n.startTime * beatsPerSecond,
            duration: n.duration * beatsPerSecond,
          }));

          // Callback to update track with recorded notes
          if (options.onNotesRecorded) {
            options.onNotesRecorded(convertedNotes);
          }
        },

        onNote: ({ type, note, velocity }) => {
          // Play note for monitoring
          if (type === 'noteon') {
            playNote(note, velocity);
          } else {
            stopNote(note);
          }
        },
      });

      recorderRef.current.start({
        countIn: options.countIn !== false,
        existingNotes: options.overdub ? track.midiData?.notes : [],
      });
    },
    [track.midiData?.tempo, track.midiData?.notes, playNote, stopNote],
  );

  // Stop recording
  const stopRecording = useCallback(() => {
    if (recorderRef.current) {
      return recorderRef.current.stop();
    }
    return [];
  }, []);

  // Handle MIDI input
  const handleMIDIInput = useCallback(
    (message) => {
      if (recorderRef.current && isRecording) {
        recorderRef.current.handleMIDIMessage(message);
      } else {
        // Just play for monitoring
        if (message.type === 'noteon' && message.velocity > 0) {
          playNote(message.note, message.velocity / 127);
        } else if (
          message.type === 'noteoff' ||
          (message.type === 'noteon' && message.velocity === 0)
        ) {
          stopNote(message.note);
        }
      }
    },
    [isRecording, playNote, stopNote],
  );

  return {
    // State
    isRecording,
    isCountingIn,
    countInBeat,

    // Methods
    playNote,
    stopNote,
    startRecording,
    stopRecording,
    handleMIDIInput,

    // Refs (if needed)
    instrumentRef,
    schedulerRef,
  };
}
