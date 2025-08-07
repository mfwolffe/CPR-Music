// components/audio/DAW/Multitrack/MIDITrack.js
'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Form, Dropdown } from 'react-bootstrap';
import {
  FaTrash,
  FaVolumeMute,
  FaVolumeUp,
  FaMusic,
  FaPiano,
  FaWaveSquare,
  FaDrum,
} from 'react-icons/fa';
import { MdPanTool, MdMusicNote, MdPiano } from 'react-icons/md';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import InstrumentSelector from './InstrumentSelector';
import { createInstrument } from './instruments/WebAudioInstruments';

export default function MIDITrack({ track, index, zoomLevel = 100 }) {
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showInstrumentSelector, setShowInstrumentSelector] = useState(false);
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
  } = useMultitrack();

  // Initialize audio context and routing WITH DEBUG
  useEffect(() => {
    console.log('🎛️ MIDITrack: Initializing for track', track.id);
    
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    console.log('🎛️ MIDITrack: Audio context created, state:', audioContextRef.current.state);
    
    // Resume audio context on user interaction (for browsers with autoplay policy)
    const resumeAudio = async () => {
      if (audioContextRef.current.state === 'suspended') {
        console.log('🔊 Resuming suspended audio context');
        try {
          await audioContextRef.current.resume();
          console.log('🔊 Audio context resumed, new state:', audioContextRef.current.state);
        } catch (error) {
          console.error('❌ Failed to resume audio context:', error);
        }
      }
    };
    
    // Try to resume immediately
    resumeAudio();
    
    // Also resume on first user interaction
    const handleUserInteraction = () => {
      console.log('👆 User interaction detected, checking audio context');
      resumeAudio();
    };
    
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    
    // Create audio routing chain
    masterGainRef.current = audioContextRef.current.createGain();
    pannerRef.current = audioContextRef.current.createStereoPanner();
    
    // Connect routing
    pannerRef.current.connect(masterGainRef.current);
    masterGainRef.current.connect(audioContextRef.current.destination);
    console.log('🔌 Audio routing chain created and connected');
    
    // Initialize track with MIDI-specific properties if needed
    if (!track.midiData) {
      console.log('📝 Initializing MIDI data for track');
      updateTrack(track.id, {
        midiData: {
          notes: [],
          tempo: 120,
          instrument: {
            id: 'synth-default',
            type: 'synth',
            preset: 'default',
            name: 'Basic Synth'
          }
        }
      });
    }
    
    // Create initial instrument
    const instrumentConfig = track.midiData?.instrument || { type: 'synth', preset: 'default' };
    console.log('🎸 Creating instrument:', instrumentConfig);
    
    try {
      instrumentRef.current = createInstrument(
        audioContextRef.current, 
        instrumentConfig.type, 
        instrumentConfig.preset
      );
      instrumentRef.current.connect(pannerRef.current);
      console.log('✅ Instrument created and connected');
      
      // Register instrument with context
      console.log('📋 Registering instrument for track', track.id);
      registerTrackInstrument(track.id, instrumentRef.current);
      
    } catch (error) {
      console.error('❌ Failed to create instrument:', error);
    }
    
    return () => {
      console.log('🧹 Cleaning up track', track.id);
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      
      // Unregister on cleanup
      registerTrackInstrument(track.id, null);
      
      if (instrumentRef.current) {
        instrumentRef.current.disconnect();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [track.id, registerTrackInstrument, updateTrack]);

  // Update instrument when selection changes WITH DEBUG
  useEffect(() => {
    if (!audioContextRef.current || !track.midiData?.instrument) return;
    
    console.log('🔄 Instrument changed, recreating:', track.midiData.instrument);
    
    // Disconnect old instrument
    if (instrumentRef.current) {
      instrumentRef.current.stopAllNotes();
      instrumentRef.current.disconnect();
    }
    
    // Create new instrument
    const { type, preset } = track.midiData.instrument;
    try {
      instrumentRef.current = createInstrument(audioContextRef.current, type, preset);
      instrumentRef.current.connect(pannerRef.current);
      console.log('✅ New instrument created and connected');
      
      // Re-register with context
      registerTrackInstrument(track.id, instrumentRef.current);
    } catch (error) {
      console.error('❌ Failed to create new instrument:', error);
    }
  }, [track.midiData?.instrument, track.id, registerTrackInstrument]);

  // Update volume
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = track.muted ? 0 : track.volume;
      console.log('🔊 Volume updated:', track.muted ? 'MUTED' : track.volume);
    }
  }, [track.volume, track.muted]);

  // Update pan
  useEffect(() => {
    if (pannerRef.current) {
      pannerRef.current.pan.value = track.pan;
    }
  }, [track.pan]);

  // Get instrument icon
  const getInstrumentIcon = () => {
    const instrument = track.midiData?.instrument;
    if (!instrument) return FaWaveSquare;
    
    switch (instrument.type) {
      case 'piano': return MdPiano;
      case 'drums': return FaDrum;
      default: return FaWaveSquare;
    }
  };

  // TEST BUTTON - Direct instrument test
  const handleTestInstrument = () => {
    console.log('🧪 TEST BUTTON CLICKED');
    console.log('🧪 Audio context state:', audioContextRef.current?.state);
    console.log('🧪 Instrument exists:', !!instrumentRef.current);
    console.log('🧪 Master gain value:', masterGainRef.current?.gain.value);
    
    if (instrumentRef.current && audioContextRef.current) {
      try {
        console.log('🎵 Playing test note (Middle C)');
        instrumentRef.current.playNote(60, 0.8);
        
        setTimeout(() => {
          console.log('🎵 Stopping test note');
          instrumentRef.current.stopNote(60);
        }, 500);
      } catch (error) {
        console.error('❌ Test failed:', error);
      }
    } else {
      console.error('❌ No instrument or audio context!');
    }
  };

  // Draw MIDI notes on canvas (simple piano roll preview)
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
    
    // Draw MIDI notes
    if (track.midiData.notes && track.midiData.notes.length > 0) {
      const instrumentColor = track.midiData.instrument?.color || '#92ce84';
      ctx.fillStyle = instrumentColor;
      
      track.midiData.notes.forEach(note => {
        const x = (note.startTime / 4) * width; // Assuming 4 bars view
        const y = height - ((note.note - 21) / 88) * height; // Piano range
        const w = (note.duration / 4) * width;
        const h = height / 88; // Height per note
        
        ctx.fillRect(x, y - h/2, w, h);
        ctx.strokeStyle = instrumentColor + 'aa';
        ctx.strokeRect(x, y - h/2, w, h);
      });
    } else {
      // Show empty state
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Double-click to edit MIDI', width / 2, height / 2);
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
  }, [track.midiData, zoomLevel, globalIsPlaying, globalCurrentTime]);

  // Handle track click selection
  const handleTrackClick = () => {
    console.log('🎯 Track clicked, selecting:', track.id);
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

  // Handle track name change
  const handleNameChange = (e) => {
    updateTrack(track.id, { name: e.target.value });
  };

  // Handle instrument selection
  const handleInstrumentSelect = (instrument, isPreview = false) => {
    if (isPreview) {
      // Play a preview note
      if (instrumentRef.current) {
        const previewNote = instrument.type === 'drums' ? 36 : 60; // C1 for drums, C4 for others
        instrumentRef.current.playNote(previewNote, 0.8);
        setTimeout(() => {
          instrumentRef.current.stopNote(previewNote);
        }, 500);
      }
    } else {
      // Update track instrument
      updateTrack(track.id, {
        midiData: {
          ...track.midiData,
          instrument: {
            id: instrument.id,
            type: instrument.type,
            preset: instrument.preset,
            name: instrument.name,
            color: instrument.color
          }
        }
      });
    }
  };

  // Playback handling
  useEffect(() => {
    if (!track.midiData || !track.midiData.notes || !instrumentRef.current) return;
    
    // Clear previously scheduled notes
    scheduledNotesRef.current.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    scheduledNotesRef.current = [];
    
    if (globalIsPlaying && !track.muted) {
      // Check if solo mode
      if (soloTrackId && track.id !== soloTrackId) return;
      
      // Schedule all notes that should play
      const notesToPlay = track.midiData.notes.filter(note => {
        const noteEndTime = note.startTime + note.duration;
        return note.startTime >= globalCurrentTime || noteEndTime > globalCurrentTime;
      });
      
      notesToPlay.forEach(note => {
        const delay = Math.max(0, note.startTime - globalCurrentTime);
        
        // Schedule note on
        const noteOnTimeout = setTimeout(() => {
          instrumentRef.current.playNote(note.note, note.velocity / 127);
        }, delay * 1000);
        
        // Schedule note off
        const noteOffTimeout = setTimeout(() => {
          instrumentRef.current.stopNote(note.note);
        }, (delay + note.duration) * 1000);
        
        scheduledNotesRef.current.push(noteOnTimeout, noteOffTimeout);
      });
    } else {
      // Stop all notes when playback stops
      if (instrumentRef.current) {
        instrumentRef.current.stopAllNotes();
      }
    }
  }, [globalIsPlaying, globalCurrentTime, track.muted, soloTrackId, track.midiData]);

  // Double-click to open piano roll (placeholder)
  const handleDoubleClick = () => {
    console.log('Open piano roll editor for track:', track.id);
    // TODO: Open piano roll modal/panel
  };

  // Menu actions
  const handleMenuAction = (action) => {
    switch (action) {
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
          midiData: { ...track.midiData, notes: [] }
        });
        break;
      case 'generate-pattern':
        generateTestPattern();
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
        { note: 36, beats: [0, 2] },      // Kick on 1 and 3
        { note: 38, beats: [1, 3] },      // Snare on 2 and 4
        { note: 42, beats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] }, // Hi-hat 8ths
      ];
      
      pattern.forEach(({ note, beats }) => {
        beats.forEach(beat => {
          testNotes.push({
            note,
            velocity: 100,
            startTime: beat,
            duration: 0.1,
            id: `drum-${note}-${beat}-${Date.now()}`
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
          id: `test-${i}-${Date.now()}`
        });
      }
    }
    
    updateTrack(track.id, {
      midiData: { ...track.midiData, notes: testNotes }
    });
  };

  const InstrumentIcon = getInstrumentIcon();

  return (
    <div 
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
              <Dropdown.Item onClick={() => handleMenuAction('select-instrument')}>
                <InstrumentIcon size={16} /> Change Instrument
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={() => handleMenuAction('generate-pattern')}>
                <FaMusic /> Generate Test Pattern
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
                <FaTrash /> Delete Track
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
          style={{
            padding: '4px 8px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: '3px',
            cursor: 'pointer',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem'
          }}
        >
          <InstrumentIcon size={14} />
          <span>{track.midiData?.instrument?.name || 'Basic Synth'}</span>
        </div>

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
        </div>

        {/* TEST BUTTON - For debugging */}
        <Button
          size="sm"
          variant="outline-info"
          onClick={(e) => {
            e.stopPropagation();
            handleTestInstrument();
          }}
          className="track-btn w-100 mt-1"
        >
          🧪 Test Sound
        </Button>

        {/* Track Sliders */}
        <div className="track-sliders">
          <div className="slider-group">
            <label>
              <MdPanTool />
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={track.pan}
                onChange={handlePanChange}
                className="track-pan-slider"
                onClick={(e) => e.stopPropagation()}
              />
              <span>{(track.pan * 100).toFixed(0)}</span>
            </label>
          </div>
          <div className="slider-group">
            <label>
              <FaVolumeUp />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={track.volume}
                onChange={handleVolumeChange}
                className="track-volume-slider"
                onClick={(e) => e.stopPropagation()}
              />
              <span>{Math.round(track.volume * 100)}</span>
            </label>
          </div>
        </div>
      </div>

      {/* MIDI Canvas */}
      <div className="track-waveform" onDoubleClick={handleDoubleClick}>
        <canvas
          ref={canvasRef}
          width={800}
          height={120}
          style={{ width: '100%', height: '100%' }}
        />
        
        {/* MIDI indicator icon */}
        <div className="midi-indicator">
          <MdMusicNote /> MIDI
        </div>
      </div>

      {/* Instrument Selector Modal */}
      <InstrumentSelector
        show={showInstrumentSelector}
        onHide={() => setShowInstrumentSelector(false)}
        onSelect={handleInstrumentSelect}
        currentInstrument={track.midiData?.instrument?.id}
      />
    </div>
  );
}