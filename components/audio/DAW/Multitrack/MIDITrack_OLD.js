// components/audio/DAW/Multitrack/MIDITrack_NEW.js
'use client';

import { useState, useRef, useEffect, memo } from 'react';
import { Button, Form, Dropdown } from 'react-bootstrap';
import {
  FaKeyboard,
  FaTrash,
  FaVolumeUp,
  FaDownload,
  FaPiano,
  FaEdit
} from 'react-icons/fa';
import { MdPanTool, MdPiano } from 'react-icons/md';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import MIDIRecordingTrack from './recording/MIDIRecordingTrack';
import LiveMIDIVisualizer from './recording/LiveMIDIVisualizer';
import RecordingManager from './recording/RecordingManager';
import MIDIInputManager from './MIDIInputManager';
import MIDIPatternEditors from './MIDIPatternEditors';
import InstrumentSelector from './InstrumentSelector';
import { exportToMIDIFile } from '../../../../lib/midiFileExport';
import { getMidiVisualizer } from './MidiVisualizer';
import useMidiTrackAudio from './hooks/useMidiTrackAudio';

// Get singleton MIDI manager
const midiInputManager = typeof window !== 'undefined' && window.__midiInputManager
  ? window.__midiInputManager
  : new MIDIInputManager();

function MIDITrack({ track, index, zoomLevel = 100 }) {
  const {
    updateTrack,
    removeTrack,
    setSelectedTrackId,
    selectedTrackId,
    soloTrackId,
    getTransportTime,
    isPlaying,
    currentTime,
    registerTrackInstrument,
  } = useMultitrack();

  const canvasRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showInstrumentSelector, setShowInstrumentSelector] = useState(false);
  const [showPianoRoll, setShowPianoRoll] = useState(false);
  const [controlTab, setControlTab] = useState('vol');
  const [selectedMidiDevice, setSelectedMidiDevice] = useState(null);

  // Use MIDI audio hook for playback
  const {
    instrument,
    isLoading: instrumentLoading,
    error: instrumentError,
    scheduleNotes,
    stopAllNotes,
  } = useMidiTrackAudio(track, isPlaying, currentTime, soloTrackId);

  // Register instrument with context
  useEffect(() => {
    if (instrument && registerTrackInstrument) {
      registerTrackInstrument(track.id, instrument);
    }
  }, [instrument, track.id, registerTrackInstrument]);

  // Subscribe to recording events
  useEffect(() => {
    const handleRecordingStart = ({ trackId }) => {
      if (trackId === track.id) {
        setIsRecording(true);
      }
    };

    const handleRecordingStop = ({ trackId }) => {
      if (trackId === track.id) {
        setIsRecording(false);
      }
    };

    const handleRecordingComplete = (data) => {
      if (data.trackId === track.id) {
        console.log(`🎹 MIDITrack: Recording complete, adding notes`);

        // Add recorded notes to track
        const existingNotes = track.midiData?.notes || [];
        const newNotes = data.notes || [];

        updateTrack(track.id, {
          midiData: {
            ...track.midiData,
            notes: [...existingNotes, ...newNotes]
          }
        });
      }
    };

    RecordingManager.on('recording-start', handleRecordingStart);
    RecordingManager.on('recording-stop', handleRecordingStop);
    RecordingManager.on('midi-recording-complete', handleRecordingComplete);

    return () => {
      RecordingManager.off('recording-start', handleRecordingStart);
      RecordingManager.off('recording-stop', handleRecordingStop);
      RecordingManager.off('midi-recording-complete', handleRecordingComplete);
    };
  }, [track.id, track.midiData, updateTrack]);

  // Draw MIDI visualization
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const midiVisualizer = getMidiVisualizer(canvas);

    // Calculate pixels per beat based on zoom
    const pixelsPerBeat = (100 * zoomLevel) / 100;

    // Draw the MIDI notes
    midiVisualizer.draw({
      notes: track.midiData?.notes || [],
      tempo: track.midiData?.tempo || 120,
      pixelsPerBeat,
      currentTimeSec: isRecording ? getTransportTime() : currentTime,
      isPlaying: isPlaying || isRecording,
    });

    // Clean up
    return () => {
      midiVisualizer.clear();
    };
  }, [
    track.midiData,
    zoomLevel,
    currentTime,
    isPlaying,
    isRecording,
    getTransportTime
  ]);

  const handleInstrumentChange = (instrumentName) => {
    console.log(`🎹 MIDITrack: Changing instrument to ${instrumentName}`);
    updateTrack(track.id, {
      midiData: { ...track.midiData, instrument: instrumentName }
    });
    setShowInstrumentSelector(false);
  };

  const handleVolumeChange = (e) => {
    updateTrack(track.id, { volume: parseFloat(e.target.value) / 100 });
  };

  const handlePanChange = (e) => {
    updateTrack(track.id, { pan: parseFloat(e.target.value) / 100 });
  };

  const handleExportMIDI = () => {
    if (!track.midiData?.notes?.length) {
      console.warn('No MIDI data to export');
      return;
    }

    const midiData = {
      notes: track.midiData.notes,
      tempo: track.midiData.tempo || 120,
      name: track.name
    };

    exportToMIDIFile(midiData, `${track.name}.mid`);
  };

  const handleRemove = () => {
    if (window.confirm('Remove this MIDI track?')) {
      stopAllNotes();
      removeTrack(track.id);
    }
  };

  return (
    <div
      className={`track midi-track ${selectedTrackId === track.id ? 'selected' : ''}`}
      onClick={() => setSelectedTrackId(track.id)}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        backgroundColor: selectedTrackId === track.id ? '#3a3a3a' : '#2a2a2a',
        borderBottom: '1px solid #444',
        minHeight: '160px',
        position: 'relative',
        opacity: track.muted && !soloTrackId ? 0.5 : 1,
      }}
    >
      {/* Track Controls */}
      <div
        className="track-controls"
        style={{
          width: '230px',
          padding: '12px',
          borderRight: '1px solid #444',
          backgroundColor: '#1a1a1a',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        {/* Track Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <FaKeyboard style={{ color: '#4CAF50', fontSize: '0.875rem' }} />
          <span style={{ fontSize: '0.75rem', color: '#888' }}>
            MIDI {index + 1}
          </span>
        </div>
        <Form.Control
          type="text"
          value={track.name}
          onChange={(e) => updateTrack(track.id, { name: e.target.value })}
          className="track-name-input"
          onClick={(e) => e.stopPropagation()}
          style={{ marginBottom: '4px', fontSize: '0.85rem', padding: '4px 8px' }}
        />

        {/* Instrument Selector */}
        <div style={{ position: 'relative' }}>
          <Button
            size="sm"
            variant="outline-success"
            onClick={(e) => {
              e.stopPropagation();
              setShowInstrumentSelector(!showInstrumentSelector);
            }}
            style={{ width: '100%', fontSize: '0.75rem' }}
            disabled={instrumentLoading}
          >
            <MdPiano /> {track.midiData?.instrument || 'Select Instrument'}
          </Button>

          {showInstrumentSelector && (
            <InstrumentSelector
              currentInstrument={track.midiData?.instrument}
              onSelect={handleInstrumentChange}
              onClose={() => setShowInstrumentSelector(false)}
            />
          )}
        </div>

        {/* Recording Controls */}
        <MIDIRecordingTrack
          track={track}
          midiInputId={selectedMidiDevice}
          getTransportTime={getTransportTime}
        />

        {/* Editor Buttons */}
        <Button
          size="sm"
          variant={showPianoRoll ? 'success' : 'outline-success'}
          onClick={(e) => {
            e.stopPropagation();
            setShowPianoRoll(!showPianoRoll);
          }}
          style={{ width: '100%' }}
        >
          <FaEdit /> Piano Roll
        </Button>

        {/* Volume/Pan Controls */}
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
            <Button
              size="sm"
              variant={controlTab === 'vol' ? 'primary' : 'outline-secondary'}
              onClick={() => setControlTab('vol')}
              style={{ flex: 1 }}
            >
              <FaVolumeUp />
            </Button>
            <Button
              size="sm"
              variant={controlTab === 'pan' ? 'primary' : 'outline-secondary'}
              onClick={() => setControlTab('pan')}
              style={{ flex: 1 }}
            >
              <MdPanTool />
            </Button>
          </div>

          {controlTab === 'vol' ? (
            <div>
              <Form.Range
                min="0"
                max="100"
                value={track.volume * 100}
                onChange={handleVolumeChange}
                onClick={(e) => e.stopPropagation()}
                style={{ margin: 0 }}
              />
              <div className="text-center" style={{ fontSize: '0.7rem' }}>
                Vol: {Math.round(track.volume * 100)}%
              </div>
            </div>
          ) : (
            <div>
              <Form.Range
                min="-100"
                max="100"
                value={track.pan * 100}
                onChange={handlePanChange}
                onClick={(e) => e.stopPropagation()}
                style={{ margin: 0 }}
              />
              <div className="text-center" style={{ fontSize: '0.7rem' }}>
                Pan: {track.pan === 0 ? 'C' : track.pan > 0 ? `${Math.round(track.pan * 100)}R` : `${Math.abs(Math.round(track.pan * 100))}L`}
              </div>
            </div>
          )}
        </div>

        {/* Export and Delete */}
        <div style={{ display: 'flex', gap: 4 }}>
          <Button
            variant="outline-info"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleExportMIDI();
            }}
            title="Export MIDI"
            style={{ flex: 1 }}
          >
            <FaDownload />
          </Button>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            title="Delete Track"
            style={{ flex: 1 }}
          >
            <FaTrash />
          </Button>
        </div>
      </div>

      {/* Track Content Area */}
      <div
        className="track-content"
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {isRecording ? (
          <LiveMIDIVisualizer
            trackId={track.id}
            height={160}
            color="#4CAF50"
            zoomLevel={zoomLevel}
            getTransportTime={getTransportTime}
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={800}
            height={160}
            style={{
              display: 'block',
              width: '100%',
              height: '160px',
              imageRendering: 'pixelated',
            }}
          />
        )}
      </div>

      {/* Piano Roll Editor Modal */}
      {showPianoRoll && (
        <MIDIPatternEditors
          show={showPianoRoll}
          onHide={() => setShowPianoRoll(false)}
          track={track}
          updateTrack={updateTrack}
        />
      )}
    </div>
  );
}

export default memo(MIDITrack);