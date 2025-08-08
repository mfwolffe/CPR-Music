// components/audio/DAW/Multitrack/MultitrackEditor.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, Container, Row, Col } from 'react-bootstrap';
import {
  FaPlus,
  FaCut,
  FaCopy,
  FaPaste,
  FaUndo,
  FaRedo,
  FaTrash,
  FaFileImport,
  FaDatabase,
  FaMicrophone,
  FaMusic,
  FaKeyboard,
} from 'react-icons/fa';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import Track from './Track';
import RecordingTrack from './RecordingTrack';
import MIDITrack from './MIDITrack';
import MultitrackTransport from './MultitrackTransport';
import EffectsPanel from './EffectsPanel';
import MultitrackTimeline from './MultitrackTimeline';
import TakesImportModal from './TakesImportModal';
import MultitrackMixdown from './MultitrackMixdown';
import MIDIInputManager from './MIDIInputManager';
import MIDIDeviceSelector from './MIDIDeviceSelector';

// Create singleton MIDI manager
const midiInputManager = new MIDIInputManager();

export default function MultitrackEditor({ availableTakes: propTakes = [] }) {
  console.log('MultitrackEditor rendering');

  const { tracks = [], addTrack, selectedTrackId } = useMultitrack();
  const [showEffectsPanel, setShowEffectsPanel] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showTakesModal, setShowTakesModal] = useState(false);
  const [showMIDIDeviceSelector, setShowMIDIDeviceSelector] = useState(false);
  const [connectedMIDIDevice, setConnectedMIDIDevice] = useState(null);
  const [midiActivity, setMidiActivity] = useState(false);
  const fileInputRef = useRef(null);
  
  // Store MIDI handler ref to avoid recreating
  const midiHandlerRef = useRef(null);

  // Use takes from props if provided, otherwise use empty array
  const availableTakes = propTakes;

  // Initialize MIDI manager on mount
  useEffect(() => {
    midiInputManager.initialize().then(success => {
      if (success) {
        console.log('🎹 MIDI Manager initialized successfully');
      }
    });
  }, []);

  // Global MIDI handler - routes to recording tracks or selected track
  const handleGlobalMIDI = (message) => {
    console.log('🎹 Global MIDI message:', message);
    
    // Flash activity indicator
    setMidiActivity(true);
    setTimeout(() => setMidiActivity(false), 100);
    
    // Find if any MIDI track is recording
    const recordingTrack = tracks.find(t => t.type === 'midi' && t.isRecording);
    
    if (recordingTrack) {
      // Route to recording track
      console.log('📍 Routing MIDI to recording track:', recordingTrack.id);
      // The track component will handle recording through its own recorder
    } else {
      // Route to selected track for live playing
      const selectedTrack = tracks.find(t => t.id === selectedTrackId && t.type === 'midi');
      if (selectedTrack) {
        console.log('📍 Routing MIDI to selected track:', selectedTrack.id);
        // The track will handle live playback
      }
    }
    
    // Broadcast the MIDI message for any track to pick up
    window.dispatchEvent(new CustomEvent('midiMessage', { detail: message }));
  };

  // Store the handler ref
  useEffect(() => {
    midiHandlerRef.current = handleGlobalMIDI;
  }, [tracks, selectedTrackId]);

  // Generate silent audio for empty tracks
  const generateSilentAudio = () => {
    // Create a proper silent audio blob
    const sampleRate = 44100;
    const duration = 1; // 1 second of silence
    const numSamples = sampleRate * duration;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    // Write silence (all zeros)
    // No need to explicitly write zeros as ArrayBuffer is initialized with zeros

    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  };

  // Track management functions
  const handleAddRecordingTrack = () => {
    console.log('Adding recording track');
    const newTrack = {
      name: `Recording ${tracks.length + 1}`,
      isRecordingTrack: true,
      audioURL: null,
      volume: 1,
      pan: 0,
      muted: false,
      solo: false,
    };
    addTrack(newTrack);
  };

  const handleAddSampleTrack = () => {
    console.log('Adding sample track');
    const newTrack = {
      name: `Track ${tracks.length + 1}`,
      audioURL: generateSilentAudio(),
      volume: 1,
      pan: 0,
      muted: false,
      solo: false,
    };
    addTrack(newTrack);
  };

  const handleAddMIDITrack = () => {
    console.log('Adding MIDI track');
    const newTrack = {
      name: `MIDI ${tracks.length + 1}`,
      type: 'midi', // Important: mark this as a MIDI track
      audioURL: null,
      volume: 1,
      pan: 0,
      muted: false,
      solo: false,
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
    };
    addTrack(newTrack);
  };

  // Handle MIDI device selection
  const handleMIDIDeviceSelect = (deviceId) => {
    console.log('🎹 Selecting MIDI device:', deviceId);
    
    // Disconnect previous device if any
    if (connectedMIDIDevice) {
      midiInputManager.disconnectInput(connectedMIDIDevice);
    }
    
    // Connect new device
    if (deviceId) {
      const success = midiInputManager.connectInput(deviceId, (message) => {
        if (midiHandlerRef.current) {
          midiHandlerRef.current(message);
        }
      });
      
      if (success) {
        setConnectedMIDIDevice(deviceId);
        console.log('✅ MIDI device connected');
      } else {
        console.error('❌ Failed to connect MIDI device');
      }
    }
  };

  // Test function to check if tracks are being added
  useEffect(() => {
    console.log('Current tracks:', tracks);
    if (!Array.isArray(tracks)) {
      console.error('Tracks is not an array:', tracks);
    }
  }, [tracks]);

  // Handle file import
  const handleFileImport = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('audio/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const audioURL = e.target.result;
        addTrack({
          name: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
          audioURL: audioURL,
        });
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  return (
    <div className="multitrack-editor-container">
      {/* Top Toolbar - Effects and Edit Actions */}
      <div className="multitrack-toolbar">
        <div className="toolbar-section">
          <Button size="sm" variant="outline-light" disabled>
            <FaCut /> Cut
          </Button>
          <Button size="sm" variant="outline-light" disabled>
            <FaCopy /> Copy
          </Button>
          <Button size="sm" variant="outline-light" disabled>
            <FaPaste /> Paste
          </Button>
          <Button size="sm" variant="outline-light" disabled>
            <FaTrash /> Delete
          </Button>
        </div>

        <div className="toolbar-section">
          <Button size="sm" variant="outline-light" disabled>
            <FaUndo /> Undo
          </Button>
          <Button size="sm" variant="outline-light" disabled>
            <FaRedo /> Redo
          </Button>
        </div>

        <div className="toolbar-section">
          <Button
            size="sm"
            variant={showEffectsPanel ? 'warning' : 'outline-warning'}
            onClick={() => setShowEffectsPanel(!showEffectsPanel)}
          >
            Effects {showEffectsPanel ? '◀' : '▶'}
          </Button>
        </div>

        <div className="toolbar-section">
          <Button
            size="sm"
            variant="outline-primary"
            onClick={() => setShowTakesModal(true)}
          >
            <FaDatabase /> Import Take
          </Button>

          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <FaFileImport /> Import File
          </Button>

          {/* MIDI Device Setup Button */}
          <Button
            size="sm"
            variant={connectedMIDIDevice ? 'success' : 'outline-secondary'}
            onClick={() => setShowMIDIDeviceSelector(true)}
            className="position-relative"
          >
            <FaKeyboard /> 
            {connectedMIDIDevice ? ' MIDI Connected' : ' MIDI Setup'}
            {midiActivity && (
              <span 
                className="position-absolute top-0 start-100 translate-middle p-1 bg-success border border-light rounded-circle"
                style={{ width: '8px', height: '8px' }}
              >
                <span className="visually-hidden">MIDI activity</span>
              </span>
            )}
          </Button>

          {/* MIXDOWN BUTTON */}
          <MultitrackMixdown />
        </div>

        <div className="toolbar-section ms-auto">
          <label className="text-white me-2">Zoom:</label>
          <input
            type="range"
            min="50"
            max="200"
            value={zoomLevel}
            onChange={(e) => setZoomLevel(e.target.value)}
            className="zoom-slider"
          />
          <span className="text-white ms-2">{zoomLevel}%</span>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleFileImport}
      />

      {/* Main Content Area */}
      <div className="multitrack-main-content">
        <Row className="g-0">
          <Col md={showEffectsPanel ? 9 : 12}>
            {/* Timeline */}
            <MultitrackTimeline zoomLevel={zoomLevel} />

            {/* Tracks Area with Add Track Button */}
            <div className="tracks-layout">
              {/* Left side - Add Track Button */}
              <div className="tracks-sidebar">
                <div className="add-track-buttons">
                  <Button
                    onClick={handleAddRecordingTrack}
                    variant="danger"
                    className="add-track-sidebar-btn"
                    title="Add recording track"
                  >
                    <FaMicrophone size={20} />
                  </Button>

                  <Button
                    onClick={handleAddMIDITrack}
                    variant="success"
                    className="add-track-sidebar-btn"
                    title="Add MIDI track"
                  >
                    <FaMusic size={20} />
                  </Button>

                  <Button
                    onClick={handleAddSampleTrack}
                    variant="outline-secondary"
                    className="add-track-sidebar-btn mt-2"
                    title="Add empty audio track"
                    size="sm"
                  >
                    <FaPlus size={16} />
                  </Button>
                </div>
              </div>

              {/* Right side - Tracks */}
              <div className="tracks-area">
                {tracks.length === 0 ? (
                  <div className="empty-state">
                    <p className="text-muted">No tracks yet.</p>
                    <p className="text-muted">
                      Click the + button to add a track or import a take.
                    </p>
                  </div>
                ) : (
                  tracks.map((track, index) => {
                    if (!track) {
                      console.error('Null track found at index:', index);
                      return null;
                    }

                    console.log(`Rendering track ${track.id}:`, {
                      type: track.type,
                      isRecordingTrack: track.isRecordingTrack,
                      track,
                    });

                    // Check track type
                    if (track.type === 'midi') {
                      return (
                        <MIDITrack
                          key={track.id}
                          track={track}
                          index={index}
                          zoomLevel={zoomLevel}
                        />
                      );
                    } else if (track.isRecordingTrack) {
                      return (
                        <RecordingTrack
                          key={track.id}
                          track={track}
                          index={index}
                          zoomLevel={zoomLevel}
                        />
                      );
                    } else {
                      // Regular audio track
                      return (
                        <Track
                          key={track.id}
                          track={track}
                          index={index}
                          zoomLevel={zoomLevel}
                        />
                      );
                    }
                  })
                )}
              </div>
            </div>
          </Col>

          {/* Effects Panel */}
          {showEffectsPanel && (
            <Col md={3}>
              <EffectsPanel />
            </Col>
          )}
        </Row>
      </div>

      {/* Bottom Transport Controls */}
      <div className="multitrack-transport-container">
        <MultitrackTransport />
      </div>

      {/* Takes Import Modal */}
      <TakesImportModal
        show={showTakesModal}
        onHide={() => setShowTakesModal(false)}
        takes={availableTakes}
      />
      
      {/* MIDI Device Selector Modal */}
      <MIDIDeviceSelector
        show={showMIDIDeviceSelector}
        onHide={() => setShowMIDIDeviceSelector(false)}
        midiInputManager={midiInputManager}
        currentDevice={connectedMIDIDevice}
        onDeviceSelect={handleMIDIDeviceSelect}
      />
    </div>
  );
}