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
  addPatternToArrangement 
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
  const scheduledNotesRef = useRef([]);
  const audioContextRef = useRef(null);
  const instrumentRef = useRef(null);
  const masterGainRef = useRef(null);
  const pannerRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [countInBeat, setCountInBeat] = useState(0);
  const midiRecorderRef = useRef(null);
  const containerRef = useRef(null);

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
  } = useMultitrack();

  // Initialize the MIDI recorder
  useEffect(() => {
    if (!midiRecorderRef.current) {
      midiRecorderRef.current = new MIDIRecorder();
    }

    return () => {
      if (midiRecorderRef.current) {
        midiRecorderRef.current.cleanup();
      }
    };
  }, []);

  // Initialize Audio Context and Instrument
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }

    // Create audio nodes
    if (!masterGainRef.current) {
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.connect(audioContextRef.current.destination);
      masterGainRef.current.gain.value = track.volume || 0.75;
    }

    if (!pannerRef.current) {
      pannerRef.current = audioContextRef.current.createStereoPanner();
      pannerRef.current.connect(masterGainRef.current);
      pannerRef.current.pan.value = track.pan || 0;
    }

    // Create instrument
    const instrumentType = track.midiData?.instrument || {
      type: 'synth',
      name: 'Basic Synth',
      color: '#4a7c9e',
    };

    if (!instrumentRef.current || instrumentRef.current.type !== instrumentType.type) {
      if (instrumentRef.current) {
        instrumentRef.current.disconnect();
      }

      instrumentRef.current = createInstrument(
        audioContextRef.current,
        instrumentType.type,
      );
      instrumentRef.current.connect(pannerRef.current);

      // Register with multitrack context
      registerTrackInstrument(track.id, instrumentRef.current);
    }
  }, [track.id, track.volume, track.pan, track.midiData?.instrument, registerTrackInstrument]);

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

  // Handle playback with pattern support
  useEffect(() => {
    if (!track.midiData || !instrumentRef.current) return;

    // Get notes to play based on view mode
    let notesToPlay = [];
    if (viewMode === 'patterns') {
      notesToPlay = resolvePatternArrangement(track);
    } else {
      notesToPlay = track.midiData.notes || [];
    }

    // Clear previously scheduled notes
    scheduledNotesRef.current.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    scheduledNotesRef.current = [];

    if (globalIsPlaying && !track.muted) {
      if (soloTrackId && track.id !== soloTrackId) return;

      // Schedule all notes that should play
      const upcomingNotes = notesToPlay.filter((note) => {
        const noteEndTime = note.startTime + note.duration;
        return note.startTime >= globalCurrentTime || noteEndTime > globalCurrentTime;
      });

      upcomingNotes.forEach((note) => {
        const delay = Math.max(0, note.startTime - globalCurrentTime);

        // Schedule note on
        const noteOnTimeout = setTimeout(() => {
          instrumentRef.current.playNote(note.note, note.velocity / 127);
        }, delay * 1000);

        // Schedule note off
        const noteOffTimeout = setTimeout(
          () => {
            instrumentRef.current.stopNote(note.note);
          },
          (delay + note.duration) * 1000,
        );

        scheduledNotesRef.current.push(noteOnTimeout, noteOffTimeout);
      });
    } else {
      // Stop all notes when playback stops
      if (instrumentRef.current) {
        instrumentRef.current.stopAllNotes();
      }
    }
  }, [
    globalIsPlaying,
    globalCurrentTime,
    track.muted,
    soloTrackId,
    track.midiData,
    viewMode,
  ]);

  // Convert current notes to a pattern
  const convertNotesToPattern = () => {
    if (!track.midiData.notes || track.midiData.notes.length === 0) {
      alert('No notes to convert to pattern');
      return;
    }

    // Find the length of the notes
    const maxTime = Math.max(...track.midiData.notes.map(n => n.startTime + n.duration));
    const bars = Math.ceil(maxTime / 4); // Assuming 4/4 time

    const newPattern = {
      id: `pattern-${Date.now()}`,
      name: `${track.name} Pattern`,
      length: bars,
      notes: [...track.midiData.notes],
      color: '#4a7c9e'
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
            repeatCount: 1
          }
        ],
        notes: [] // Clear notes as they're now in the pattern
      }
    });

    setViewMode('patterns');
  };

  // Pattern management functions
  const handleCreatePattern = (pattern) => {
    updateTrack(track.id, {
      midiData: {
        ...track.midiData,
        patterns: [...(track.midiData.patterns || []), pattern]
      }
    });
  };

  const handleUpdatePattern = (patternId, updates) => {
    const patterns = track.midiData.patterns || [];
    const updatedPatterns = patterns.map(p => 
      p.id === patternId ? { ...p, ...updates } : p
    );
    
    updateTrack(track.id, {
      midiData: {
        ...track.midiData,
        patterns: updatedPatterns
      }
    });
  };

  const handleDeletePattern = (patternId) => {
    const patterns = (track.midiData.patterns || []).filter(p => p.id !== patternId);
    const arrangement = (track.midiData.arrangement || []).filter(a => a.patternId !== patternId);
    
    updateTrack(track.id, {
      midiData: {
        ...track.midiData,
        patterns,
        arrangement
      }
    });
  };

  const handleSelectPattern = (pattern) => {
    setSelectedPattern(pattern);
    setShowPatternLibrary(false);
  };

  // Canvas mouse events for pattern editing
  const handleCanvasClick = (e) => {
    if (viewMode !== 'patterns') return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pixelsPerBeat = rect.width / 16;
    
    const clickResult = handlePatternClick(x, y, track, pixelsPerBeat, 0);
    if (clickResult) {
      // Double-click to edit pattern
      if (e.detail === 2) {
        setEditingPatternId(clickResult.pattern.id);
        setShowPianoRoll(true);
      }
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, pattern) => {
    setDraggedPattern(pattern);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('pattern', JSON.stringify(pattern));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    const patternData = e.dataTransfer.getData('pattern');
    if (!patternData) return;
    
    const pattern = JSON.parse(patternData);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pixelsPerBeat = rect.width / 16;
    const startTime = (x / pixelsPerBeat);
    
    addPatternToArrangement(track, pattern.id, startTime, updateTrack);
  };

  // Menu actions
  const handleMenuAction = (action) => {
    switch (action) {
      case 'edit-piano-roll':
        setShowPianoRoll(true);
        break;
      case 'open-step-sequencer':
        setShowStepSequencer(true);
        break;
      case 'select-instrument':
        setShowInstrumentSelector(true);
        break;
      case 'delete':
        removeTrack(track.id);
        break;
      case 'duplicate':
        // TODO: Implement track duplication
        console.log('Duplicate track:', track.id);
        break;
      case 'clear':
        updateTrack(track.id, {
          midiData: { ...track.midiData, notes: [] },
        });
        break;
      case 'generate-pattern':
        generateTestPattern();
        break;
      case 'convert-to-pattern':
        convertNotesToPattern();
        break;
      case 'show-patterns':
        setShowPatternLibrary(true);
        break;
    }
  };

  // Generate test patterns based on instrument type
  const generateTestPattern = () => {
    const instrument = track.midiData?.instrument;
    let testNotes = [];

    if (instrument?.type === 'drums') {
      // Drum pattern
      const pattern = [
        { note: 36, beats: [0, 2] }, // Kick on 1 and 3
        { note: 38, beats: [1, 3] }, // Snare on 2 and 4
        { note: 42, beats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] }, // Hi-hat 8ths
      ];

      pattern.forEach(({ note, beats }) => {
        beats.forEach((beat) => {
          testNotes.push({
            note,
            velocity: 100,
            startTime: beat,
            duration: 0.1,
            id: `drum-${note}-${beat}-${Date.now()}`,
          });
        });
      });
    } else {
      // Melodic pattern
      const scale = [60, 62, 64, 65, 67, 69, 71, 72]; // C major scale

      for (let i = 0; i < 16; i++) {
        testNotes.push({
          note: scale[Math.floor(Math.random() * scale.length)],
          velocity: 80 + Math.floor(Math.random() * 40),
          startTime: i * 0.25, // 16th notes
          duration: 0.2,
          id: `test-${i}-${Date.now()}`,
        });
      }
    }

    updateTrack(track.id, {
      midiData: { ...track.midiData, notes: testNotes },
    });
  };

  // Handle instrument selection
  const handleInstrumentSelect = (instrument) => {
    updateTrack(track.id, {
      midiData: { ...track.midiData, instrument },
    });
    setShowInstrumentSelector(false);
  };

  // Handle piano roll save
  const handlePianoRollSave = (notes) => {
    if (editingPatternId) {
      // Update pattern notes
      const patterns = track.midiData.patterns || [];
      const updatedPatterns = patterns.map(p => 
        p.id === editingPatternId ? { ...p, notes } : p
      );
      
      updateTrack(track.id, {
        midiData: {
          ...track.midiData,
          patterns: updatedPatterns
        }
      });
      setEditingPatternId(null);
    } else {
      // Update track notes
      updateTrack(track.id, {
        midiData: { ...track.midiData, notes },
      });
    }
  };

  // Handle recording state changes
  const handleRecordingComplete = (recordedNotes) => {
    updateTrack(track.id, {
      midiData: {
        ...track.midiData,
        notes: [...(track.midiData.notes || []), ...recordedNotes],
      },
    });
    setIsRecording(false);
  };

  // Handle name change
  const handleNameChange = (e) => {
    updateTrack(track.id, { name: e.target.value });
  };

  // Handle track click selection
  const handleTrackClick = () => {
    setSelectedTrackId(track.id);
  };

  // Handle volume change
  const handleVolumeChange = (e) => {
    updateTrack(track.id, { volume: parseFloat(e.target.value) });
  };

  // Handle pan change
  const handlePanChange = (e) => {
    updateTrack(track.id, { pan: parseFloat(e.target.value) });
  };

  // Handle mute
  const handleMute = () => {
    updateTrack(track.id, { muted: !track.muted });
  };

  // Handle solo
  const handleSolo = () => {
    setSoloTrackId(soloTrackId === track.id ? null : track.id);
  };

  // Get instrument icon
  const getInstrumentIcon = () => {
    const instrumentType = track.midiData?.instrument?.type || 'synth';
    switch (instrumentType) {
      case 'piano':
        return MdPiano;
      case 'drums':
        return FaDrum;
      case 'bass':
      case 'synth':
      default:
        return FaWaveSquare;
    }
  };

  // Draw MIDI notes on canvas with pattern support
  useEffect(() => {
    if (!canvasRef.current || !track.midiData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    // Clear canvas
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    // Vertical grid (beats)
    for (let i = 0; i < width; i += width / 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }

    // Draw content based on view mode
    if (viewMode === 'patterns') {
      // Draw pattern clips
      const pixelsPerBeat = width / 16; // 16 beats visible
      drawPatternClips(ctx, track, width, height, pixelsPerBeat, 0);
      
      // Show instructions if no arrangement
      if (!track.midiData.arrangement || track.midiData.arrangement.length === 0) {
        ctx.fillStyle = '#666';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Drag patterns here from the Pattern Library', width / 2, height / 2);
      }
      
      // Show drag over indicator
      if (isDraggingOver) {
        ctx.fillStyle = 'rgba(74, 124, 158, 0.2)';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#4a7c9e';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(2, 2, width - 4, height - 4);
        ctx.setLineDash([]);
      }
    } else {
      // Original note drawing code
      if (track.midiData.notes && track.midiData.notes.length > 0) {
        const instrumentColor = track.midiData.instrument?.color || '#92ce84';
        ctx.fillStyle = instrumentColor;

        track.midiData.notes.forEach((note) => {
          const x = (note.startTime / 4) * width; // Assuming 4 bars view
          const y = height - ((note.note - 21) / 88) * height; // Piano range
          const w = (note.duration / 4) * width;
          const h = height / 88; // Height per note

          ctx.fillRect(x, y - h / 2, w, h);
          ctx.strokeStyle = instrumentColor + 'aa';
          ctx.strokeRect(x, y - h / 2, w, h);
        });
      } else {
        // Show empty state
        ctx.fillStyle = '#666';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Double-click to open Piano Roll', width / 2, height / 2);
      }
    }

    // Draw playhead if playing
    if (globalIsPlaying && globalCurrentTime > 0) {
      const playheadX = (globalCurrentTime / 4) * width; // Assuming 4 bars = 4 seconds at 120bpm
      ctx.strokeStyle = '#ff3030';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }, [track.midiData, zoomLevel, globalIsPlaying, globalCurrentTime, viewMode, isDraggingOver]);

  const InstrumentIcon = getInstrumentIcon();

  return (
    <div
      ref={containerRef}
      className={`track midi-track ${selectedTrackId === track.id ? 'track-selected' : ''}`}
      onClick={handleTrackClick}
    >
      {/* Track Controls */}
      <div className="track-controls">
        {/* Track Header */}
        <div className="track-header">
          <Form.Control
            type="text"
            value={track.name}
            onChange={handleNameChange}
            className="track-name-input"
            onClick={(e) => e.stopPropagation()}
          />
          <Dropdown onClick={(e) => e.stopPropagation()}>
            <Dropdown.Toggle
              as={Button}
              variant="link"
              className="track-menu-btn"
              size="sm"
            >
              ⋮
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => handleMenuAction('edit-piano-roll')}>
                <FaPencilAlt className="me-2" size={12} />
                Edit in Piano Roll
              </Dropdown.Item>
              {track.midiData?.instrument?.type === 'drums' && (
                <Dropdown.Item onClick={() => handleMenuAction('open-step-sequencer')}>
                  <FaTh className="me-2" size={12} />
                  Step Sequencer
                </Dropdown.Item>
              )}
              <Dropdown.Divider />
              <Dropdown.Item
                onClick={() => handleMenuAction('select-instrument')}
              >
                <InstrumentIcon size={16} className="me-2" /> Change Instrument
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={() => handleMenuAction('show-patterns')}>
                <FaThLarge className="me-2" size={12} />
                Pattern Library
              </Dropdown.Item>
              {track.midiData?.notes?.length > 0 && viewMode === 'notes' && (
                <Dropdown.Item onClick={() => handleMenuAction('convert-to-pattern')}>
                  <FaThLarge className="me-2" size={12} />
                  Convert to Pattern
                </Dropdown.Item>
              )}
              <Dropdown.Divider />
              <Dropdown.Item
                onClick={() => handleMenuAction('generate-pattern')}
              >
                <FaMusic className="me-2" /> Generate Test Pattern
              </Dropdown.Item>
              <Dropdown.Item onClick={() => handleMenuAction('clear')}>
                Clear Notes
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={() => handleMenuAction('duplicate')}>
                Duplicate Track
              </Dropdown.Item>
              <Dropdown.Item
                onClick={() => handleMenuAction('delete')}
                className="text-danger"
              >
                <FaTrash className="me-2" /> Delete Track
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>

        {/* Instrument Display */}
        <div
          className="instrument-display"
          onClick={(e) => {
            e.stopPropagation();
            setShowInstrumentSelector(true);
          }}
        >
          <InstrumentIcon size={14} />
          <span>{track.midiData?.instrument?.name || 'Basic Synth'}</span>
        </div>

        {/* View Mode Toggle */}
        <ButtonGroup size="sm" className="w-100 mb-1">
          <Button
            variant={viewMode === 'notes' ? 'primary' : 'outline-secondary'}
            onClick={() => setViewMode('notes')}
            size="sm"
          >
            Notes
          </Button>
          <Button
            variant={viewMode === 'patterns' ? 'primary' : 'outline-secondary'}
            onClick={() => setViewMode('patterns')}
            size="sm"
          >
            Patterns
          </Button>
        </ButtonGroup>

        {/* Pattern Library Button */}
        <Button
          size="sm"
          variant="outline-primary"
          onClick={(e) => {
            e.stopPropagation();
            setShowPatternLibrary(true);
          }}
          className="w-100 mb-1"
        >
          <FaThLarge size={12} /> Patterns ({track.midiData?.patterns?.length || 0})
        </Button>

        {/* Track Buttons */}
        <div className="track-buttons">
          <Button
            size="sm"
            variant={track.muted ? 'danger' : 'secondary'}
            onClick={(e) => {
              e.stopPropagation();
              handleMute();
            }}
            className="track-btn"
          >
            {track.muted ? <FaVolumeMute /> : <FaVolumeUp />} Mute
          </Button>
          <Button
            size="sm"
            variant={soloTrackId === track.id ? 'warning' : 'secondary'}
            onClick={(e) => {
              e.stopPropagation();
              handleSolo();
            }}
            className="track-btn"
          >
            Solo
          </Button>
          <Button
            size="sm"
            variant={isRecording ? 'danger' : 'secondary'}
            onClick={(e) => {
              e.stopPropagation();
              setIsRecording(!isRecording);
            }}
            className="track-btn"
          >
            {isRecording ? <FaStop /> : <FaCircle />} Rec
          </Button>
        </div>

        {/* Volume Control */}
        <div className="track-control">
          <Form.Label className="track-control-label">Volume</Form.Label>
          <Form.Range
            min="0"
            max="1"
            step="0.01"
            value={track.volume || 0.75}
            onChange={handleVolumeChange}
            className="volume-slider"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Pan Control */}
        <div className="track-control">
          <Form.Label className="track-control-label">
            <MdPanTool size={14} /> Pan
          </Form.Label>
          <Form.Range
            min="-1"
            max="1"
            step="0.01"
            value={track.pan || 0}
            onChange={handlePanChange}
            className="pan-slider"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      {/* Track Waveform/MIDI Display */}
      <div
        className="track-waveform midi-track-display"
        onDoubleClick={() => viewMode === 'notes' && setShowPianoRoll(true)}
        onClick={handleCanvasClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={120}
          style={{ width: '100%', height: '100%' }}
        />
        <div className="midi-indicator">
          <MdMusicNote size={10} />
          <span>
            {viewMode === 'patterns' 
              ? `${track.midiData?.patterns?.length || 0} patterns`
              : `${track.midiData?.notes?.length || 0} notes`
            }
          </span>
        </div>
      </div>

      {/* Instrument Selector Modal */}
      {showInstrumentSelector && (
        <InstrumentSelector
          show={showInstrumentSelector}
          onHide={() => setShowInstrumentSelector(false)}
          onSelect={handleInstrumentSelect}
          currentInstrument={track.midiData?.instrument}
        />
      )}

      {/* Piano Roll Editor Modal */}
      {showPianoRoll && (
        <PianoRollEditor
          show={showPianoRoll}
          onHide={() => {
            setShowPianoRoll(false);
            setEditingPatternId(null);
          }}
          notes={editingPatternId 
            ? track.midiData?.patterns?.find(p => p.id === editingPatternId)?.notes || []
            : track.midiData?.notes || []
          }
          onSave={handlePianoRollSave}
          instrument={track.midiData?.instrument}
          trackName={editingPatternId 
            ? track.midiData?.patterns?.find(p => p.id === editingPatternId)?.name || 'Pattern'
            : track.name
          }
        />
      )}

      {/* Pattern Library Modal with drag support */}
      <PatternLibrary
        show={showPatternLibrary}
        onHide={() => setShowPatternLibrary(false)}
        patterns={track.midiData?.patterns || []}
        onCreatePattern={handleCreatePattern}
        onUpdatePattern={handleUpdatePattern}
        onDeletePattern={handleDeletePattern}
        onSelectPattern={handleSelectPattern}
        onDragStart={handleDragStart}
        enableDrag={true}
      />

      {/* Step Sequencer Modal */}
      {showStepSequencer && (
        <StepSequencer
          show={showStepSequencer}
          onHide={() => setShowStepSequencer(false)}
          instrument={track.midiData?.instrument}
          onSave={(pattern) => {
            handleCreatePattern(pattern);
            setShowStepSequencer(false);
          }}
        />
      )}

      {/* MIDI Recorder Component */}
      {isRecording && (
        <MIDIRecorder
          isRecording={isRecording}
          isCountingIn={isCountingIn}
          countInBeat={countInBeat}
          onRecordingComplete={handleRecordingComplete}
          onCountInUpdate={(beat) => setCountInBeat(beat)}
        />
      )}
    </div>
  );
}