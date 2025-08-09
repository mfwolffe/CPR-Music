// components/audio/DAW/Multitrack/MIDITrack.js
'use client';

import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Button, Form, Dropdown, ButtonGroup } from 'react-bootstrap';
import {
  FaTrash,
  FaVolumeMute,
  FaVolumeUp,
  FaMusic,
  FaPiano,
  FaWaveSquare,
  FaDrum,
  FaCircle,
  FaStop,
  FaPencilAlt,
  FaThLarge,
  FaTh,
} from 'react-icons/fa';
import { MdPanTool, MdMusicNote, MdPiano } from 'react-icons/md';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import InstrumentSelector from './InstrumentSelector';
import { createInstrument } from './instruments/WebAudioInstruments';
import MIDIRecorder from './MIDIRecorder';
import PatternLibrary from './PatternLibrary';
import PianoRollEditor from './PianoRollEditor';
import StepSequencer from './StepSequencer';
import {
  drawPatternClips,
  resolvePatternArrangement,
  handlePatternClick,
  addPatternToArrangement,
} from './PatternClipRenderer';

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
  const [isRecording, setIsRecording] = useState(false);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [countInBeat, setCountInBeat] = useState(0);
  const [controlTab, setControlTab] = useState('vol'); // 'vol' or 'pan'
  const scheduledNotesRef = useRef([]);
  const audioContextRef = useRef(null);
  const instrumentRef = useRef(null);
  const masterGainRef = useRef(null);
  const pannerRef = useRef(null);

  const {
    updateTrack,
    removeTrack,
    selectedTrackId,
    setSelectedTrackId,
    soloTrackId,
    setSoloTrackId,
    isPlaying: globalIsPlaying,
    currentTime: globalCurrentTime,
    registerTrackInstrument,
    playNoteOnSelectedTrack,
    stopNoteOnSelectedTrack,
  } = useMultitrack();

  const InstrumentIcon = getInstrumentIcon();

  // Initialize audio nodes
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext ||
      window.webkitAudioContext)();

    // Create gain node for volume control
    masterGainRef.current = audioContextRef.current.createGain();
    masterGainRef.current.gain.value = track.volume || 0.75;

    // Create panner node
    pannerRef.current = audioContextRef.current.createStereoPanner();
    pannerRef.current.pan.value = track.pan || 0;

    // Connect nodes
    masterGainRef.current.connect(pannerRef.current);
    pannerRef.current.connect(audioContextRef.current.destination);

    return () => {
      try {
        registerTrackInstrument(track.id, null);
      } catch {}
      if (instrumentRef.current) {
        try {
          instrumentRef.current.stopAllNotes?.();
        } catch {}
        try {
          instrumentRef.current.dispose?.();
        } catch {}
        instrumentRef.current = null;
      }
      try {
        pannerRef.current?.disconnect?.();
      } catch {}
      try {
        masterGainRef.current?.disconnect?.();
      } catch {}
      const ctx = audioContextRef.current;
      if (ctx && typeof ctx.close === 'function') {
        try {
          ctx.close();
        } catch {}
      }
    };
  }, []);

  // Create/update instrument when it changes
  useEffect(() => {
    if (track.midiData?.instrument && audioContextRef.current) {
      // Dispose old instrument
      if (instrumentRef.current) {
        try {
          instrumentRef.current.stopAllNotes?.();
        } catch {}
        try {
          instrumentRef.current.dispose?.();
        } catch {}
      }

      // Create new instrument
      const instrumentType = track.midiData.instrument;
      instrumentRef.current = createInstrument(
        audioContextRef.current,
        masterGainRef.current,
        instrumentType.type,
      );
      instrumentRef.current.connect(pannerRef.current);

      // Register with multitrack context
      registerTrackInstrument(track.id, instrumentRef.current);
    }
  }, [track.id, track.midiData?.instrument, registerTrackInstrument]);

  useEffect(() => {
    return () => {
      registerTrackInstrument(track.id, null);
    };
  }, [track.id, registerTrackInstrument]);

  // Update volume
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = track.volume || 0.75;
    }
  }, [track.volume]);

  // Update pan
  useEffect(() => {
    if (pannerRef.current) {
      pannerRef.current.pan.value = track.pan || 0;
    }
  }, [track.pan]);

  // Keep preview canvas bitmap in sync with container size (and HiDPI)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const displayW = Math.max(1, Math.floor(rect.width));
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

  // --- Lookahead MIDI scheduler (prevents stuck notes) ---
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const notesRef = useRef([]);
  const tempoRef = useRef(120);
  const mutedRef = useRef(false);
  const soloOkRef = useRef(true);
  const lastScheduledTimeRef = useRef(0);
  const playingNotesRef = useRef(new Map()); // key: `${note.note}:${note.startTime}` -> { onId, offId, endSec }
  const schedulerIdRef = useRef(null);

  // Keep lightweight refs up to date
  useEffect(() => {
    currentTimeRef.current = globalCurrentTime;
  }, [globalCurrentTime]);
  useEffect(() => {
    isPlayingRef.current = globalIsPlaying;
  }, [globalIsPlaying]);
  useEffect(() => {
    tempoRef.current = track.midiData?.tempo || 120;
  }, [track.midiData?.tempo]);
  useEffect(() => {
    mutedRef.current = !!track.muted;
  }, [track.muted]);
  useEffect(() => {
    soloOkRef.current = !soloTrackId || soloTrackId === track.id;
  }, [soloTrackId, track.id]);

  // Flatten notes according to view mode
  useEffect(() => {
    if (!track.midiData) {
      notesRef.current = [];
      return;
    }
    if (viewMode === 'patterns') {
      notesRef.current = resolvePatternArrangement(track) || [];
    } else {
      notesRef.current = track.midiData.notes || [];
    }
  }, [track.midiData, viewMode]);

  // Helper to fully stop/clear everything
  const hardResetPlayback = () => {
    // stop instrument voices
    try {
      instrumentRef.current?.stopAllNotes?.();
    } catch {}
    // clear pending timeouts
    for (const { onId, offId } of playingNotesRef.current.values()) {
      if (onId) clearTimeout(onId);
      if (offId) clearTimeout(offId);
    }
    playingNotesRef.current.clear();
  };

  // Start/stop the periodic scheduler based on play state & routing
  useEffect(() => {
    if (!instrumentRef.current) return; // no instrument yet

    // Always clear any prior interval
    if (schedulerIdRef.current) {
      clearInterval(schedulerIdRef.current);
      schedulerIdRef.current = null;
    }

    // If not actively audible, perform a hard reset and bail
    if (!isPlayingRef.current || mutedRef.current || !soloOkRef.current) {
      hardResetPlayback();
      lastScheduledTimeRef.current = currentTimeRef.current;
      return;
    }

    const lookaheadSec = 0.1; // how far ahead to schedule
    const tickMs = 30; // scheduler tick

    const tick = () => {
      const nowSec = currentTimeRef.current;
      const tempo = tempoRef.current || 120;
      const secPerBeat = 60 / tempo;

      // Detect seeks (large jumps or backwards)
      const last = lastScheduledTimeRef.current;
      if (nowSec < last - 0.05 || nowSec - last > 0.5) {
        hardResetPlayback();
        lastScheduledTimeRef.current = nowSec;
      }

      const windowStart = lastScheduledTimeRef.current;
      const windowEnd = nowSec + lookaheadSec;

      // Schedule notes whose starts fall inside [windowStart, windowEnd)
      const notes = notesRef.current || [];
      for (const n of notes) {
        const startSec = n.startTime * secPerBeat;
        const endSec = (n.startTime + n.duration) * secPerBeat;
        if (startSec >= windowStart && startSec < windowEnd) {
          const key = `${n.note}:${n.startTime}`;
          if (!playingNotesRef.current.has(key)) {
            const delayOn = Math.max(0, startSec - nowSec);
            const onId = setTimeout(() => {
              instrumentRef.current?.playNote?.(
                n.note,
                (n.velocity ?? 100) / 127,
              );
            }, delayOn * 1000);

            const delayOff = Math.max(0, endSec - nowSec);
            const offId = setTimeout(() => {
              instrumentRef.current?.stopNote?.(n.note);
              playingNotesRef.current.delete(key);
            }, delayOff * 1000);

            playingNotesRef.current.set(key, { onId, offId, endSec });
          }
        }
      }

      // Advance the window
      lastScheduledTimeRef.current = windowEnd;
    };

    schedulerIdRef.current = setInterval(tick, tickMs);

    return () => {
      if (schedulerIdRef.current) {
        clearInterval(schedulerIdRef.current);
        schedulerIdRef.current = null;
      }
    };
  }, [globalIsPlaying, track.muted, soloTrackId, track.id]);

  // On stop, ensure everything is silenced
  useEffect(() => {
    if (!globalIsPlaying) {
      hardResetPlayback();
      lastScheduledTimeRef.current = currentTimeRef.current;
    }
  }, [globalIsPlaying]);

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
    updateTrack(track.id, {
      midiData: {
        ...track.midiData,
        patterns: [...(track.midiData.patterns || []), newPattern],
        arrangement: [
          {
            patternId: newPattern.id,
            startTime: 0,
            repeatCount: 1,
          },
        ],
        notes: [], // Clear notes as they're now in the pattern
      },
    });

    setViewMode('patterns');
  };

  // Pattern management functions
  const handleCreatePattern = (pattern) => {
    updateTrack(track.id, {
      midiData: {
        ...track.midiData,
        patterns: [...(track.midiData.patterns || []), pattern],
      },
    });
  };

  const handleUpdatePattern = (patternId, updates) => {
    const patterns = track.midiData.patterns || [];
    const updatedPatterns = patterns.map((p) =>
      p.id === patternId ? { ...p, ...updates } : p,
    );
    updateTrack(track.id, {
      midiData: {
        ...track.midiData,
        patterns: updatedPatterns,
      },
    });
  };

  const handleDeletePattern = (patternId) => {
    const patterns = (track.midiData.patterns || []).filter(
      (p) => p.id !== patternId,
    );
    const arrangement = (track.midiData.arrangement || []).filter(
      (a) => a.patternId !== patternId,
    );
    updateTrack(track.id, {
      midiData: {
        ...track.midiData,
        patterns,
        arrangement,
      },
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
        return FaPiano;
      case 'synth':
        return FaWaveSquare;
      case 'drums':
        return FaDrum;
      default:
        return FaMusic;
    }
  }

  // Handle instrument selection
  const handleInstrumentSelect = (instrument) => {
    updateTrack(track.id, {
      midiData: {
        ...track.midiData,
        instrument,
      },
    });
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

  // Draw the preview (notes or patterns)
  useEffect(() => {
    if (!canvasRef.current || !track.midiData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Clear canvas
    ctx.fillStyle = '#1f2a1f';
    ctx.fillRect(0, 0, width, height);

    if (viewMode === 'patterns') {
      // Draw pattern clips
      drawPatternClips(
        ctx,
        track.midiData.arrangement || [],
        track.midiData.patterns || [],
        width,
        height,
        zoomLevel,
      );
    } else {
      // Draw piano roll preview
      const notes = track.midiData.notes || [];
      if (notes.length === 0) {
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Double-click to add notes', width / 2, height / 2);
        return;
      }

      // Compute content-aware time window
      const allNotes = track.midiData.notes || [];
      const lastBeat = allNotes.length
        ? Math.max(...allNotes.map((n) => n.startTime + n.duration))
        : 16;
      const firstBeat = allNotes.length
        ? Math.min(...allNotes.map((n) => n.startTime))
        : 0;
      // Keep a minimum window so very short clips still show structure
      const beatsVisible = Math.max(16, lastBeat - firstBeat || 16);
      const pixelsPerBeat = width / beatsVisible;

      // Draw grid
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.5;

      // Vertical grid (beats)
      for (let beat = 0; beat <= beatsVisible; beat++) {
        const x = (beat / beatsVisible) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Draw notes
      const instrumentColor = track.midiData.instrument?.color || '#92ce84';

      // Compute dynamic pitch range with bounds to MIDI (A0..C8)
      const minPitch = Math.max(
        21,
        Math.min(...allNotes.map((n) => n.note)) - 1,
      );
      const maxPitch = Math.min(
        108,
        Math.max(...allNotes.map((n) => n.note)) + 1,
      );
      const noteRange = { min: minPitch, max: maxPitch };
      const lanes = Math.max(1, noteRange.max - noteRange.min + 1);
      const laneHeight = height / lanes;

      // Draw horizontal grid lines for octaves
      ctx.strokeStyle = '#444';
      for (let note = noteRange.min; note <= noteRange.max; note += 12) {
        const y = height - ((note - noteRange.min) / lanes) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const sortedNotes = [...allNotes].sort(
        (a, b) => a.startTime - b.startTime,
      );

      // Draw each note
      sortedNotes.forEach((note) => {
        // Skip notes outside the computed pitch range
        if (note.note < noteRange.min || note.note > noteRange.max) return;

        // Calculate note position
        const x = (note.startTime - firstBeat) * pixelsPerBeat;
        const y = height - (note.note - noteRange.min + 1) * laneHeight;

        // Calculate width with proper duration scaling
        const noteWidth = Math.max(2, note.duration * pixelsPerBeat);

        // Clip note width if it extends beyond canvas
        const visibleWidth = Math.min(noteWidth, width - x);

        if (visibleWidth <= 0) return; // Skip if completely outside

        // Note body
        ctx.fillStyle = instrumentColor;
        ctx.fillRect(x, y, visibleWidth, laneHeight - 1);

        // Note border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, visibleWidth, laneHeight - 1);

        // Velocity shading
        const velocityAlpha = note.velocity / 127;
        ctx.fillStyle = `rgba(255, 255, 255, ${velocityAlpha * 0.3})`;
        ctx.fillRect(x, y, visibleWidth, laneHeight - 1);
      });

      // Draw playhead if playing
      if (globalIsPlaying) {
        const tempo = track.midiData?.tempo || 120;
        const secPerBeat = 60 / tempo;
        const currentBeat = globalCurrentTime / secPerBeat;
        const playheadX = ((currentBeat - firstBeat) / beatsVisible) * width;
        ctx.strokeStyle = '#ff3030';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();
      }
    }
  }, [
    track.midiData,
    viewMode,
    zoomLevel,
    globalCurrentTime,
    globalIsPlaying,
    track.midiData?.notes,
    track.midiData?.patterns,
    track.midiData?.arrangement,
  ]);

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
    <div
      className={`track midi-track ${
        selectedTrackId === track.id ? 'track-selected' : ''
      } ${track.muted ? 'track-muted' : ''} ${
        soloTrackId === track.id ? 'track-solo' : ''
      }`}
      onClick={() => setSelectedTrackId(track.id)}
    >
      <div className="track-controls">
        <div className="track-header">
          <span className="track-name">{track.name}</span>
          <Button
            variant="link"
            size="sm"
            className="p-0 text-danger"
            onClick={(e) => {
              e.stopPropagation();
              removeTrack(track.id);
            }}
          >
            <FaTrash />
          </Button>
        </div>

        {/* Instrument Display */}
        <div
          className="instrument-display"
          onClick={(e) => {
            e.stopPropagation();
            setShowInstrumentSelector(true);
          }}
        >
          <InstrumentIcon />
          <span>{track.midiData?.instrument?.name || 'Select Instrument'}</span>
        </div>

        {/* View Mode Toggle */}
        <ButtonGroup className="w-100 mb-2">
          <Button
            size="sm"
            variant={viewMode === 'notes' ? 'primary' : 'outline-primary'}
            onClick={() => setViewMode('notes')}
          >
            <MdMusicNote /> Notes
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'patterns' ? 'primary' : 'outline-primary'}
            onClick={() => setViewMode('patterns')}
          >
            <FaThLarge /> Patterns
          </Button>
        </ButtonGroup>

        {/* Pattern Controls */}
        {viewMode === 'patterns' && (
          <>
            <Button
              size="sm"
              variant="outline-primary"
              className="w-100 mb-2"
              onClick={() => setShowPatternLibrary(true)}
            >
              Pattern Library
            </Button>
            {track.midiData?.notes?.length > 0 && (
              <Button
                size="sm"
                variant="outline-success"
                className="w-100 mb-2"
                onClick={convertNotesToPattern}
              >
                Convert to Pattern
              </Button>
            )}
          </>
        )}

        {/* Track Buttons */}
        <div className="track-buttons">
          <Button
            variant={track.muted ? 'danger' : 'outline-secondary'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              updateTrack(track.id, { muted: !track.muted });
            }}
            title={track.muted ? 'Unmute' : 'Mute'}
          >
            {track.muted ? <FaVolumeMute /> : <FaVolumeUp />}
          </Button>
          <Button
            variant={soloTrackId === track.id ? 'warning' : 'outline-secondary'}
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
            variant={isRecording ? 'danger' : 'outline-danger'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsRecording(!isRecording);
              updateTrack(track.id, { isRecording: !isRecording });
            }}
            title={isRecording ? 'Stop Recording' : 'Record'}
          >
            {isRecording ? <FaStop /> : <FaCircle />}
          </Button>
        </div>

        {/* Compact Vol/Pan switch */}
        <ButtonGroup size="sm" className="control-tabs mb-1">
          <Button
            variant={controlTab === 'vol' ? 'secondary' : 'outline-secondary'}
            onClick={(e) => {
              e.stopPropagation();
              setControlTab('vol');
            }}
          >
            Vol
          </Button>
          <Button
            variant={controlTab === 'pan' ? 'secondary' : 'outline-secondary'}
            onClick={(e) => {
              e.stopPropagation();
              setControlTab('pan');
            }}
          >
            Pan
          </Button>
        </ButtonGroup>

        {controlTab === 'vol' ? (
          <div className="track-control">
            <label className="track-control-label">
              <FaVolumeUp /> Volume
              <span className="track-control-value">
                {Math.round(track.volume * 100)}%
              </span>
            </label>
            <Form.Range
              className="track-volume-slider"
              min="0"
              max="100"
              value={track.volume * 100}
              onChange={handleVolumeChange}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : (
          <div className="track-control">
            <label className="track-control-label">
              <MdPanTool /> Pan
              <span className="track-control-value">
                {track.pan === 0
                  ? 'C'
                  : track.pan > 0
                    ? `${Math.round(track.pan * 100)}R`
                    : `${Math.round(Math.abs(track.pan * 100))}L`}
              </span>
            </label>
            <Form.Range
              className="track-pan-slider"
              min="-100"
              max="100"
              value={track.pan * 100}
              onChange={handlePanChange}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>

      <div className="track-waveform">
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
          {isCountingIn && (
            <div className="count-in-indicator">{countInBeat}</div>
          )}
          <div className="midi-indicator">
            <MdMusicNote /> MIDI
          </div>
          {track.midiData?.tempo && (
            <div className="midi-tempo-display">{track.midiData.tempo} BPM</div>
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
            updateTrack(track.id, {
              midiData: {
                ...track.midiData,
                notes: updatedNotes,
              },
            });
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
              ? track.midiData.patterns?.find((p) => p.id === editingPatternId)
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

      {/* MIDI Recorder Component */}
      {isRecording && (
        <MIDIRecorder
          track={track}
          isRecording={isRecording}
          onRecordingComplete={(notes) => {
            if (notes.length > 0) {
              updateTrack(track.id, {
                midiData: {
                  ...track.midiData,
                  notes: [...(track.midiData.notes || []), ...notes],
                },
              });
            }
            setIsRecording(false);
            updateTrack(track.id, { isRecording: false });
          }}
          audioContext={audioContextRef.current}
          onCountIn={(beat) => {
            setIsCountingIn(true);
            setCountInBeat(beat);
            if (beat === 0) {
              setTimeout(() => setIsCountingIn(false), 500);
            }
          }}
        />
      )}
    </div>
  );
}
