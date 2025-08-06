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
} from 'react-icons/fa';
import { useMultitrack } from '../../../../contexts/MultitrackContext';
import Track from './Track';
import MultitrackTransport from './MultitrackTransport';
import EffectsPanel from './EffectsPanel';
import MultitrackTimeline from './MultitrackTimeline';
import TakesImportModal from './TakesImportModal';

export default function MultitrackEditor({ availableTakes: propTakes = [] }) {
  console.log('MultitrackEditor rendering');

  const { tracks, addTrack } = useMultitrack();
  const [showEffectsPanel, setShowEffectsPanel] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showTakesModal, setShowTakesModal] = useState(false);
  const fileInputRef = useRef(null);

  // Use takes from props if provided, otherwise use empty array
  const availableTakes = propTakes;

  // Generate silent audio for empty tracks (like single-track editor does)
  const generateSilentAudio = () => {
    // Use a simple data URL for silence instead of generating it
    // This is 1 second of silence as a WAV data URL
    return 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
  };

  // Handle adding a new empty track
  const handleAddTrack = () => {
    console.log('Adding track with silent audio');
    const silentAudioURL = generateSilentAudio();
    addTrack({
      name: `Track ${tracks.length + 1}`,
      audioURL: silentAudioURL,
      // Add a flag to indicate this is empty/silent
      isEmpty: true,
    });
  };

  // Handle adding track with sample audio
  const handleAddSampleTrack = () => {
    console.log('Adding track with sample');
    addTrack({
      name: `Track ${tracks.length + 1}`,
      audioURL: '/sample_audio/uncso-bruckner4-1.mp3',
    });
  };

  // Test function to check if tracks are being added
  useEffect(() => {
    console.log('Current tracks:', tracks);
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

          {/* Temporary test button */}
          <Button
            size="sm"
            variant="outline-info"
            onClick={handleAddSampleTrack}
          >
            Test Sample
          </Button>
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
                <Button
                  onClick={handleAddTrack}
                  variant="outline-primary"
                  className="add-track-sidebar-btn"
                  title="Add new empty track"
                >
                  <FaPlus size={24} />
                </Button>
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
                  tracks.map((track, index) => (
                    <Track
                      key={track.id}
                      track={track}
                      index={index}
                      zoomLevel={zoomLevel}
                    />
                  ))
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
    </div>
  );
}
