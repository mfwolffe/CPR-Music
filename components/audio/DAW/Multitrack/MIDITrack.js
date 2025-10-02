// components/audio/DAW/Multitrack/MIDITrack.js
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Button, Form, Dropdown, ButtonGroup } from 'react-bootstrap';
import {
  FaTrash,
  FaVolumeMute,
  FaVolumeUp,
  FaMusic,
  FaWaveSquare,
  FaDrum,
  FaCircle,
  FaStop,
  FaPencilAlt,
  FaThLarge,
  FaTh,
  FaDownload,
  FaFileImport,
} from 'react-icons/fa';
import { useMIDITrackAudio } from './hooks/useMidiTrackAudio';
import MIDIInputManager from './MIDIInputManager';
// Shared MIDI input manager (singleton across app)
const midiInputManager =
  typeof window !== 'undefined' && window.__midiInputManager
    ? window.__midiInputManager
    : new MIDIInputManager();
if (typeof window !== 'undefined' && !window.__midiInputManager) {
  window.__midiInputManager = midiInputManager;
}
import { MdPanTool, MdMusicNote, MdPiano } from 'react-icons/md';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import InstrumentSelector from './InstrumentSelector';
import { createInstrument } from './Instruments/WebAudioInstruments';
import PatternLibrary from './PatternLibrary';
import PianoRollEditor from './PianoRollEditor';
import StepSequencer from './StepSequencer';
import audioContextManager from './AudioContextManager';
import {
  drawPatternClips,
  resolvePatternArrangement,
  handlePatternClick,
  addPatternToArrangement,
} from './PatternClipRenderer';
import { exportToMIDIFile } from '../../../../lib/midiFileExport';

export default function MIDITrack({ track, index, zoomLevel = 100 }) {
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showInstrumentSelector, setShowInstrumentSelector] = useState(false);
  const [showPianoRoll, setShowPianoRoll] = useState(false);
  const [showStepSequencer, setShowStepSequencer] = useState(false);
  const [viewMode, setViewMode] = useState('notes'); // 'notes' or 'patterns'
  const [showPatternLibrary, setShowPatternLibrary] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [draggedPattern, setDraggedPattern] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [editingPatternId, setEditingPatternId] = useState(null);
  const [controlTab, setControlTab] = useState('vol'); // 'vol' or 'pan'

  // Local countdown states (separate from hook states)
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownBeat, setCountdownBeat] = useState(0);

  // Viewport tracking for smooth auto-scroll
  const [viewportFirstBeat, setViewportFirstBeat] = useState(0);
  // const scheduledNotesRef = useRef([]);
  // const audioContextRef = useRef(null);
  // const instrumentRef = useRef(null);
  // const masterGainRef = useRef(null);
  // const pannerRef = useRef(null);

  // NOTE: I previously mounted <MIDIRecorder /> as if it were a React component, but
  // it's a **class** that must be constructed with `new`
  //
  // Short-term:
  //   - Remove the JSX usage and do NOT construct any recorder here yet. The transport
  //     piano already handles audition, and our MultitrackTransport patch writes notes
  //     to the selected MIDI track in **beats** while the transport is playing.
  //   - This avoids the crash while keeping live input working from the transport piano.
  //
  // Long-term:
  //   1) Convert MIDIRecorder into a hook or an imperative class **instantiated with `new`**
  //      from inside a `useEffect` here. Example sketch:
  //         const recorderRef = useRef(null);
  //         useEffect(() => {
  //           if (isRecording && !recorderRef.current) {
  //             // Create once when track enters record-arm state
  //             // recorderRef.current = new MIDIRecorder({ midiInput, clock, onNote, onCountIn });
  //             // recorderRef.current.start();
  //           }
  //           return () => {
  //             // Stop and dispose on unmount or when recording stops
  //             recorderRef.current?.stop?.();
  //             recorderRef.current = null;
  //           };
  //         }, [isRecording, track.id]);
  //
  //   2) `onNote` callback should hand us **seconds**, which we convert to **beats** using
  //      this track's tempo before committing to state, to stay consistent with the preview:
  //         const spb = 60 / (track.midiData?.tempo || 120);
  //         addNoteToSelectedTrack(note, velocity01, startSec / spb, durationSec / spb);
  //
  //   3) Voice management: preview notes should be **tokenized** so note-off always releases
  //      the exact voice that started (prevents drones). Context now supports passing an
  //      opaque handle/token to `stopNoteOnSelectedTrack(note, token)`.
  //
  //   4) Robustness: flush preview voices on window blur / visibility change and when the
  //      transport pauses/stops to prevent stuck notes.
  //
  // Until we reintroduce a proper recorder here, we keep this ref as a placeholder so the
  // intent is clear and future work is straightforward.
  const recorderRef = useRef(null);

  const {
    updateTrack,
    removeTrack,
    selectedTrackId,
    setSelectedTrackId,
    soloTrackId,
    setSoloTrackId,
    isPlaying: globalIsPlaying,
    currentTime: globalCurrentTime,
    duration,
    registerTrackInstrument,
    playNoteOnSelectedTrack,
    stopNoteOnSelectedTrack,
    play,
    stop,
    startRecordingTimer,
    stopRecordingTimer,
    flushNoteBuffer,
    setTracks,
  } = useMultitrack();

  const {
    isRecording,
    playNote,
    stopNote,
    startRecording,
    stopRecording,
    handleMIDIInput,
    instrumentRef,
  } = useMIDITrackAudio(
    track,
    globalIsPlaying,
    globalCurrentTime,
    registerTrackInstrument,
  );

  const InstrumentIcon = getInstrumentIcon();

  useEffect(() => {
    if (instrumentRef.current) {
      registerTrackInstrument(track.id, instrumentRef.current);
    }
    return () => {
      try {
        registerTrackInstrument(track.id, null);
      } catch {}
    };
  }, [track.id, registerTrackInstrument, instrumentRef]);

  useEffect(() => {
    if (track.id === selectedTrackId && track.armed) {
      const handleGlobalMIDI = (message) => {
        handleMIDIInput(message);
      };

      // Subscribe to MIDI input manager
      midiInputManager.addListener('message', handleGlobalMIDI);

      return () => {
        midiInputManager.removeListener('message', handleGlobalMIDI);
      };
    }
  }, [track.id, selectedTrackId, track.armed, handleMIDIInput]);

  // Keep preview canvas bitmap in sync with container size (and HiDPI)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      // Use the same width calculation as the timeline container
      const timelineWidth = 310 + 3000 * (zoomLevel / 100); // 80px sidebar + 230px track controls
      const displayW = Math.max(1, Math.floor(timelineWidth - 230)); // Subtract control width
      const displayH = Math.max(1, Math.floor(rect.height));

      const targetW = Math.floor(displayW * dpr);
      const targetH = Math.floor(displayH * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        const ctx = canvas.getContext('2d');
        // reset before resize to avoid compounding transforms
        if (ctx) ctx.setTransform(1, 0, 0, 1, 0, 0);
        canvas.width = targetW;
        canvas.height = targetH;
        if (ctx && dpr !== 1) {
          // Draw using CSS pixels thereafter
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }
    };

    resize();
    const ro = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    ro?.observe(parent);
    window.addEventListener('resize', resize);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  const handleRecord = () => {
    if (isRecording || isCountingDown) {
      // Stop recording or cancel countdown
      if (isRecording) {
        stopRecording();
        // Stop recording timer
        stopRecordingTimer();
        // Flush any buffered notes immediately
        flushNoteBuffer();
      }
      setIsCountingDown(false);
      setCountdownBeat(0);
      // Update track state - clear both isRecording and armed
      updateTrack(track.id, { isRecording: false, armed: false });
    } else {
      // Start countdown
      setIsCountingDown(true);
      setCountdownBeat(3);
      
      // Countdown timer
      const countdownInterval = setInterval(() => {
        setCountdownBeat((prev) => {
          if (prev <= 1) {
            // Start recording
            clearInterval(countdownInterval);
            setIsCountingDown(false);
            setCountdownBeat(0);
            // Start the actual recording via the hook
            startRecording({
              countIn: false,
              overdub: false,
              onNotesRecorded: (recordedNotes) => {
                // Add recorded notes to the track
                if (recordedNotes && recordedNotes.length > 0) {
                  updateTrack(track.id, (t) => {
                    const existingNotes = t.midiData?.notes || [];
                    return {
                      midiData: {
                        ...(t.midiData || {}),
                        notes: [...existingNotes, ...recordedNotes],
                      },
                    };
                  });
                  console.log(`✅ Added ${recordedNotes.length} recorded notes to track ${track.id}`);
                }
              },
            });
            // Start recording timer to move playhead
            startRecordingTimer();
            // Initialize viewport with playhead near left edge for recording
            const tempo = track.midiData?.tempo || 120;
            const secPerBeat = 60 / tempo;
            const currentBeat = globalCurrentTime / secPerBeat;
            setViewportFirstBeat(Math.max(0, currentBeat - 2)); // Playhead near left edge with room to advance
            // Update track state - set both isRecording and armed
            updateTrack(track.id, { isRecording: true, armed: true });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  // Convert current notes to a pattern
  const convertNotesToPattern = () => {
    if (!track.midiData.notes || track.midiData.notes.length === 0) {
      alert('No notes to convert to pattern');
      return;
    }

    // Find the length of the notes
    const maxTime = Math.max(
      ...track.midiData.notes.map((n) => n.startTime + n.duration),
    );
    const bars = Math.ceil(maxTime / 4); // Assuming 4/4 time

    const newPattern = {
      id: `pattern-${Date.now()}`,
      name: `${track.name} Pattern`,
      length: bars,
      notes: [...track.midiData.notes],
      color: '#4a7c9e',
    };

    // Add pattern to track
    updateTrack(track.id, (t) => ({
      midiData: {
        patterns: [...(t.midiData?.patterns || []), newPattern],
        arrangement: [
          { patternId: newPattern.id, startTime: 0, repeatCount: 1 },
        ],
        notes: [],
      },
    }));
  };

  // Pattern management functions
  const handleCreatePattern = (pattern) => {
    updateTrack(track.id, (t) => ({
      midiData: {
        patterns: [...(t.midiData?.patterns || []), pattern],
      },
    }));
  };

  const handleUpdatePattern = (patternId, updates) => {
    updateTrack(track.id, (t) => {
      const patterns = t.midiData?.patterns || [];
      const updatedPatterns = patterns.map((p) =>
        p.id === patternId ? { ...p, ...updates } : p,
      );
      return { midiData: { patterns: updatedPatterns } };
    });
  };

  const handleDeletePattern = (patternId) => {
    updateTrack(track.id, (t) => {
      const patterns = (t.midiData?.patterns || []).filter(
        (p) => p.id !== patternId,
      );
      const arrangement = (t.midiData?.arrangement || []).filter(
        (a) => a.patternId !== patternId,
      );
      return { midiData: { patterns, arrangement } };
    });
  };

  const handlePatternDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);

    if (!draggedPattern || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Calculate drop position in beats (assuming 50px per beat)
    const dropBeat = Math.round(x / 50);

    addPatternToArrangement(
      track,
      draggedPattern.id,
      dropBeat,
      1,
      (updatedTrack) => {
        updateTrack(track.id, updatedTrack);
      },
    );

    setDraggedPattern(null);
  };

  // Handle canvas click for pattern mode
  const handleCanvasClick = (e) => {
    if (viewMode !== 'patterns' || !track.midiData.arrangement) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const clickedClip = handlePatternClick(
      x,
      track.midiData.arrangement,
      track.midiData.patterns || [],
    );

    if (clickedClip) {
      setEditingPatternId(clickedClip.patternId);
      setShowStepSequencer(true);
    }
  };

  // Instrument icon helper
  function getInstrumentIcon() {
    const instrumentType = track.midiData?.instrument?.type;
    switch (instrumentType) {
      case 'piano':
        return MdPiano;
      case 'synth':
        return FaWaveSquare;
      case 'drums':
        return FaDrum;
      default:
        return FaMusic;
    }
  }

  // Handle instrument selection (supports preview-only audition)
  const handleInstrumentSelect = (instrument, previewOnly = false) => {
    if (previewOnly) {
      try {
        instrumentRef.current?.preview?.(60);
      } catch {}
      return; // don't close modal or commit on preview
    }
    updateTrack(track.id, (t) => ({
      midiData: { ...(t.midiData || {}), instrument },
    }));
    setShowInstrumentSelector(false);
  };

  // Generate test pattern for development
  const generateTestPattern = () => {
    const notes = [];
    const scale = [60, 62, 64, 65, 67, 69, 71, 72]; // C major scale
    for (let i = 0; i < 16; i++) {
      if (Math.random() > 0.5) {
        notes.push({
          note: scale[Math.floor(Math.random() * scale.length)],
          velocity: 80,
          startTime: i * 0.25,
          duration: 0.25,
        });
      }
    }
    handleCreatePattern({
      id: `pattern-${Date.now()}`,
      name: 'Test Pattern',
      length: 4,
      notes,
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    });
  };

  // Export MIDI file
  const handleExportMIDI = () => {
    const notes = track.midiData?.notes || [];
    if (notes.length === 0) {
      alert('No notes to export');
      return;
    }

    const tempo = track.midiData?.tempo || 120;
    const filename = `${track.name.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.mid`;

    try {
      exportToMIDIFile(notes, tempo, filename);
      console.log(`✅ Exported ${notes.length} notes to ${filename}`);
    } catch (error) {
      console.error('❌ MIDI export failed:', error);
      alert('Failed to export MIDI file');
    }
  };


  // Debounce canvas redraws during recording to reduce flashing
  const redrawTimerRef = useRef(null);
  const requestRedraw = useCallback(() => {
    if (redrawTimerRef.current) {
      cancelAnimationFrame(redrawTimerRef.current);
    }

    redrawTimerRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas || !track.midiData) return;

      const ctx = canvas.getContext('2d');
      performCanvasRender(ctx, canvas);
    });
  }, [track.midiData, viewMode, zoomLevel, globalCurrentTime, isRecording, viewportFirstBeat]);

  // Actual rendering logic extracted for reuse
  const performCanvasRender = useCallback((ctx, canvas) => {
    if (!ctx || !canvas) return;

    // Use canvas dimensions instead of getBoundingClientRect
    // This ensures we use the actual canvas size
    const width = canvas.width;
    const height = canvas.height;

    // If canvas has no size, skip drawing
    if (width === 0 || height === 0) {
      console.warn('Canvas has no size, skipping draw');
      return;
    }

    // Account for device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = width / dpr;
    const displayHeight = height / dpr;

    // Save context state
    ctx.save();

    // Reset transform to handle DPR correctly
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Clear canvas
    ctx.fillStyle = '#1f2a1f';
    ctx.fillRect(0, 0, width, height);

    // Apply DPR scaling
    ctx.scale(dpr, dpr);

    if (viewMode === 'patterns') {
      // Draw pattern clips
      drawPatternClips(
        ctx,
        track.midiData.arrangement || [],
        track.midiData.patterns || [],
        displayWidth,
        displayHeight,
        zoomLevel,
      );
    } else {
      // Draw piano roll preview
      const notes = track.midiData.notes || [];
      const allNotes = track.midiData.notes || []; // Make allNotes available throughout

      if (notes.length === 0) {
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          'Double-click to add notes',
          displayWidth / 2,
          displayHeight / 2,
        );
        ctx.restore();
        return;
      }

      // Compute content-aware time window - UNIFIED SECONDS-BASED SYSTEM (matches MultitrackEditor)
      let firstSecond, secondsVisible;
      const tempo = track.midiData?.tempo || 120;
      const secPerBeat = 60 / tempo;
      
      // CRITICAL: Use the SAME time scale as the global timeline for BOTH recording and playback
      // This ensures 1 second of audio = 1 second of visual pixels consistently
      const projectDuration = duration > 0 ? duration : Math.max(30, globalCurrentTime + 10);
      secondsVisible = projectDuration;

      if (isRecording && globalCurrentTime > 0) {
        // PRO DAW-STYLE AUTO-SCROLL: Playhead stays at fixed 75% position, content scrolls past
        const currentSecond = globalCurrentTime;

        // FIXED PLAYHEAD POSITION: Keep playhead at 75% from left edge (like Pro Tools/Logic)
        const playheadScreenPosition = 0.75; // 75% from left

        // Calculate where viewport should start so currentTime appears at 75% position
        const targetFirstSecond = Math.max(0, currentSecond - (secondsVisible * playheadScreenPosition));

        // Smooth the viewport updates to avoid jank - only update if significantly different
        const currentViewportStart = viewportFirstBeat * secPerBeat;
        const timeDifference = Math.abs(targetFirstSecond - currentViewportStart);

        if (timeDifference > 0.1) { // Update if >100ms difference
          setViewportFirstBeat(targetFirstSecond / secPerBeat);
          firstSecond = targetFirstSecond;

          if (process.env.NODE_ENV === 'development') {
            console.log('🎬 DAW Auto-scroll (Fixed Playhead @ 75%):', {
              currentTime: currentSecond.toFixed(3),
              viewportStart: targetFirstSecond.toFixed(3),
              playheadWillAppearAt: `${(playheadScreenPosition * 100)}%`,
              timeDiff: timeDifference.toFixed(3)
            });
          }
        } else {
          // Use existing viewport position (no significant change needed)
          firstSecond = currentViewportStart;
        }
      } else {
        // Normal mode: show all existing notes from timeline start (0:00)
        // CRITICAL: firstSecond must be 0 to align with audio scheduler's absolute timeline
        firstSecond = 0;
      }

      // Match MultitrackEditor's pixelsPerSecond calculation exactly
      const pixelsPerSecond = displayWidth / secondsVisible;

      // Draw grid - using seconds-based coordinates
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.5;

      // Vertical grid (beats) - convert beat positions to seconds, then to pixels
      const beatsToShow = Math.ceil(secondsVisible / secPerBeat);
      for (let beat = 0; beat <= beatsToShow; beat++) {
        const beatTimeInSeconds = firstSecond + (beat * secPerBeat);
        // Round to integer pixels for crisp grid lines
        const x = Math.round((beatTimeInSeconds - firstSecond) * pixelsPerSecond);
        if (x >= 0 && x <= displayWidth) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, displayHeight);
          ctx.stroke();
        }
      }

      // Draw notes
      const instrumentColor = track.midiData.instrument?.color || '#92ce84';

      // Compute dynamic pitch range with bounds to MIDI (A0..C8)
      const minPitch = allNotes.length > 0 
        ? Math.max(21, Math.min(...allNotes.map((n) => n.note)) - 1)
        : 60; // Default to C4 if no notes
      const maxPitch = allNotes.length > 0
        ? Math.min(108, Math.max(...allNotes.map((n) => n.note)) + 1)
        : 72; // Default to C5 if no notes
      const noteRange = { min: minPitch, max: maxPitch };
      const lanes = Math.max(1, noteRange.max - noteRange.min + 1);
      const laneHeight = displayHeight / lanes;

      // Draw horizontal grid lines for octaves
      ctx.strokeStyle = '#444';
      for (let note = noteRange.min; note <= noteRange.max; note += 12) {
        const y =
          displayHeight - ((note - noteRange.min) / lanes) * displayHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(displayWidth, y);
        ctx.stroke();
      }

      const sortedNotes = [...allNotes].sort(
        (a, b) => a.startTime - b.startTime,
      );

      // Draw each note
      sortedNotes.forEach((note) => {
        // Skip notes outside the computed pitch range
        if (note.note < noteRange.min || note.note > noteRange.max) return;

        // Calculate note position - UNIFIED SECONDS-BASED COORDINATES
        const noteStartTimeInSeconds = note.startTime * secPerBeat; // Convert beats to seconds
        // Round to integer pixels to eliminate sub-pixel anti-aliasing offset
        const x = Math.round((noteStartTimeInSeconds - firstSecond) * pixelsPerSecond);
        const y = Math.round(displayHeight - (note.note - noteRange.min + 1) * laneHeight);

        // Calculate width with proper duration scaling - UNIFIED SECONDS-BASED COORDINATES
        const noteDurationInSeconds = note.duration * secPerBeat; // Convert beat duration to seconds
        const noteWidth = Math.max(1, Math.round(noteDurationInSeconds * pixelsPerSecond));

        // Clip note width if it extends beyond canvas
        const visibleWidth = Math.min(noteWidth, displayWidth - x);

        if (visibleWidth <= 0) return; // Skip if completely outside

        // Note body
        ctx.fillStyle = instrumentColor;
        ctx.fillRect(x, y, visibleWidth, laneHeight - 1);

        // Note border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, visibleWidth, laneHeight - 1);

        // Velocity shading
        const velocityAlpha = (note.velocity || 100) / 127;
        ctx.fillStyle = `rgba(255, 255, 255, ${velocityAlpha * 0.3})`;
        ctx.fillRect(x, y, visibleWidth, laneHeight - 1);
      });

      // Playhead is now handled by MultitrackEditor's main timeline playhead overlay
      // This eliminates dual playhead systems and ensures single source of truth
    }

    // Restore context state
    ctx.restore();
  }, [track.midiData, viewMode, zoomLevel, globalCurrentTime, isRecording, viewportFirstBeat]);

  // Draw the preview (notes or patterns) - now debounced
  useEffect(() => {
    requestRedraw();
  }, [requestRedraw]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (redrawTimerRef.current) {
        cancelAnimationFrame(redrawTimerRef.current);
      }
    };
  }, []);

  // Handle volume change
  const handleVolumeChange = (e) => {
    e.stopPropagation();
    updateTrack(track.id, { volume: e.target.value / 100 });
  };

  // Handle pan change
  const handlePanChange = (e) => {
    e.stopPropagation();
    updateTrack(track.id, { pan: e.target.value / 100 });
  };

  return (
    <div className="track-container" style={{ display: 'flex' }}>
      {/* Sidebar spacer - matches timeline sidebar */}
      <div
        className="track-sidebar"
        style={{
          width: '80px',
          backgroundColor: '#1e1e1e',
          borderRight: '1px solid #3a3a3a',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Track number with recording indicator (match RecordingTrack) */}
        <span
          style={{
            color: isRecording ? '#ff6b6b' : '#666',
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {isRecording && <FaCircle size={8} />}
          {index + 1}
        </span>
      </div>

      {/* Main track div */}
      <div
        className={`track midi-track ${
          selectedTrackId === track.id ? 'track-selected' : ''
        } ${track.muted ? 'track-muted' : ''} ${
          soloTrackId === track.id ? 'track-solo' : ''
        }`}
        onClick={() => setSelectedTrackId(track.id)}
      >
        <div
          className="track-controls"
        >
          <div className="track-header">
            <Form.Control
              type="text"
              value={track.name}
              onChange={(e) => updateTrack(track.id, { name: e.target.value })}
              className="track-name-input"
              onClick={(e) => e.stopPropagation()}
              style={{ marginBottom: '4px', fontSize: '0.85rem', padding: '4px 8px' }}
            />
          </div>

          {/* Instrument Display */}
          <div
            className="instrument-display"
            onClick={(e) => {
              e.stopPropagation();
              setShowInstrumentSelector(true);
            }}
            style={{ marginBottom: '4px', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 4px' }}
          >
            <InstrumentIcon />
            <span>
              {track.midiData?.instrument?.name || 'Select Instrument'}
            </span>
          </div>

          {/* View Mode Toggle */}
          <ButtonGroup className="w-100" style={{ marginBottom: '4px' }}>
            <Button
              size="sm"
              variant={viewMode === 'notes' ? 'primary' : 'outline-primary'}
              onClick={() => setViewMode('notes')}
              title="Notes Mode - Edit individual MIDI notes"
            >
              <MdMusicNote /> Notes
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'patterns' ? 'primary' : 'outline-primary'}
              onClick={() => setViewMode('patterns')}
              title="Patterns Mode - Work with repeating sequences"
            >
              <FaThLarge /> Patterns
            </Button>
          </ButtonGroup>

          {/* Pattern Controls - Collapsible */}
          {viewMode === 'patterns' && (
            <div style={{ marginBottom: '4px' }}>
              <Button
                size="sm"
                variant="outline-primary"
                className="w-100"
                style={{ marginBottom: '2px', padding: '2px 4px', fontSize: '0.75rem' }}
                onClick={() => setShowPatternLibrary(true)}
              >
                Pattern Library
              </Button>
              {track.midiData?.notes?.length > 0 && (
                <Button
                  size="sm"
                  variant="outline-success"
                  className="w-100"
                  style={{ padding: '2px 4px', fontSize: '0.75rem' }}
                  onClick={convertNotesToPattern}
                >
                  Convert to Pattern
                </Button>
              )}
            </div>
          )}

          {/* Track Buttons */}
          <div className="track-buttons" style={{ marginBottom: '4px' }}>
            <Button
              variant={track.muted ? 'danger' : 'outline-secondary'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                updateTrack(track.id, (t) => ({ muted: !t.muted }));
              }}
              title={track.muted ? 'Unmute' : 'Mute'}
            >
              {track.muted ? <FaVolumeMute /> : <FaVolumeUp />}
            </Button>
            <Button
              variant={
                soloTrackId === track.id ? 'warning' : 'outline-secondary'
              }
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSoloTrackId(soloTrackId === track.id ? null : track.id);
              }}
              title="Solo"
            >
              S
            </Button>
            <Button
              variant={
                isRecording || isCountingDown ? 'danger' : 'outline-danger'
              }
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRecord();
              }}
              title={
                isRecording
                  ? 'Stop Recording'
                  : isCountingDown
                  ? 'Cancel Countdown'
                  : 'Record'
              }
            >
              {isRecording ? <FaStop /> : isCountingDown ? countdownBeat : <FaCircle />}
            </Button>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleExportMIDI();
              }}
              title="Export MIDI File"
              disabled={!track.midiData?.notes || track.midiData.notes.length === 0}
            >
              <FaDownload />
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                removeTrack(track.id);
              }}
              title="Delete Track"
            >
              <FaTrash />
            </Button>
          </div>

          {/* Compact Vol/Pan toggle */}
          <ButtonGroup size="sm" className="w-100" style={{ marginBottom: '2px' }}>
            <Button
              variant={controlTab === 'vol' ? 'secondary' : 'outline-secondary'}
              onClick={(e) => {
                e.stopPropagation();
                setControlTab('vol');
              }}
              style={{ padding: '4px' }}
            >
              <FaVolumeUp />
            </Button>
            <Button
              variant={controlTab === 'pan' ? 'secondary' : 'outline-secondary'}
              onClick={(e) => {
                e.stopPropagation();
                setControlTab('pan');
              }}
              style={{ padding: '4px' }}
            >
              <MdPanTool />
            </Button>
          </ButtonGroup>

          {/* Volume or Pan Control (toggled) */}
          {controlTab === 'vol' ? (
            <div className="track-control" style={{ marginBottom: 0 }}>
              <Form.Range
                className="track-volume-slider"
                min="0"
                max="100"
                value={track.volume * 100}
                onChange={handleVolumeChange}
                onClick={(e) => e.stopPropagation()}
                style={{ margin: 0 }}
              />
            </div>
          ) : (
            <div className="track-control" style={{ marginBottom: 0 }}>
              <Form.Range
                className="track-pan-slider"
                min="-100"
                max="100"
                value={track.pan * 100}
                onChange={handlePanChange}
                onClick={(e) => e.stopPropagation()}
                style={{ margin: 0 }}
              />
            </div>
          )}
        </div>

        <div className="track-waveform" style={{ flex: 1 }}>
          <div
            className="midi-track-display"
            onDoubleClick={() => {
              if (viewMode === 'notes') {
                setShowPianoRoll(true);
              } else {
                setShowStepSequencer(true);
              }
            }}
            onClick={handleCanvasClick}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handlePatternDrop}
          >
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
              }}
            />
            {isRecording && <div className="midi-recording-indicator">REC</div>}
            {isCountingDown && (
              <div className="count-in-indicator">{countdownBeat}</div>
            )}
            <div className="midi-indicator">
              <MdMusicNote /> MIDI
            </div>
            {track.midiData?.tempo && (
              <div className="midi-tempo-display">
                {track.midiData.tempo} BPM
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        {showInstrumentSelector && (
          <InstrumentSelector
            show={showInstrumentSelector}
            onHide={() => setShowInstrumentSelector(false)}
            onSelect={handleInstrumentSelect}
            currentInstrument={track.midiData?.instrument}
          />
        )}

        {showPianoRoll && (
          <PianoRollEditor
            show={showPianoRoll}
            onHide={() => setShowPianoRoll(false)}
            notes={track.midiData?.notes || []}
            onSave={(updatedNotes) => {
              updateTrack(track.id, { midiData: { notes: updatedNotes } });
              setShowPianoRoll(false);
            }}
            instrument={instrumentRef.current}
            trackName={track.name}
            tempo={track.midiData?.tempo || 120}
            isPlaying={globalIsPlaying}
            currentTime={globalCurrentTime}
          />
        )}

        {showStepSequencer && (
          <StepSequencer
            show={showStepSequencer}
            onHide={() => {
              setShowStepSequencer(false);
              setEditingPatternId(null);
            }}
            pattern={
              editingPatternId
                ? track.midiData.patterns?.find(
                    (p) => p.id === editingPatternId,
                  )
                : null
            }
            onSave={(pattern) => {
              if (editingPatternId) {
                handleUpdatePattern(editingPatternId, pattern);
              } else {
                handleCreatePattern(pattern);
              }
              setShowStepSequencer(false);
              setEditingPatternId(null);
            }}
            instrument={instrumentRef.current}
          />
        )}

        {showPatternLibrary && (
          <PatternLibrary
            show={showPatternLibrary}
            onHide={() => setShowPatternLibrary(false)}
            patterns={track.midiData.patterns || []}
            onPatternSelect={(pattern) => {
              setDraggedPattern(pattern);
              setShowPatternLibrary(false);
            }}
            onPatternCreate={handleCreatePattern}
            onPatternUpdate={handleUpdatePattern}
            onPatternDelete={handleDeletePattern}
            onGenerateTestPattern={generateTestPattern}
          />
        )}

        {/* TODO(recorder): When MIDIRecorder is refactored into a hook or imperative class
            constructed with `new`, instantiate it via useEffect above (see docs there) and
            remove this placeholder. Recording from the transport piano already writes notes
            in beats while playing, so this UI mount is not required to avoid crashes. */}
      </div>
    </div>
  );
}
