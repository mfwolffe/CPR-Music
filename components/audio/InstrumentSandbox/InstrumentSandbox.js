'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, ButtonGroup, Badge } from 'react-bootstrap';
import { FaPlay, FaStop, FaVolumeUp, FaSave, FaFolder } from 'react-icons/fa';
import { GiSoundWaves } from 'react-icons/gi';
import SynthControls from './SynthControls';
import PianoKeyboard from '../DAW/Multitrack/PianoKeyboard';
import SandboxSynth from './SandboxSynth';
import PresetManager from './PresetManager';
import WaveformVisualizer from './WaveformVisualizer';

const InstrumentSandbox = () => {
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNotes, setActiveNotes] = useState([]);
  const [currentPreset, setCurrentPreset] = useState('default');
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [analyserNode, setAnalyserNode] = useState(null);

  // Synth parameters state
  const [synthParams, setSynthParams] = useState({
    oscillatorType: 'sawtooth',
    filterCutoff: 2000,
    filterResonance: 5,
    attack: 0.01,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3,
    detune: 0,
    lfoRate: 4,
    lfoAmount: 0,
    reverb: 0,
    delay: 0,
    distortion: 0
  });

  // Refs
  const synthRef = useRef(null);
  const audioContextRef = useRef(null);

  // Initialize audio context and synth
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      synthRef.current = new SandboxSynth(audioContextRef.current);
      synthRef.current.connect(audioContextRef.current.destination);
      synthRef.current.setVolume(masterVolume);

      // Get analyser node for visualization
      setAnalyserNode(synthRef.current.getAnalyser());

      // Apply initial params
      synthRef.current.updateParams(synthParams);
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Update synth when parameters change
  useEffect(() => {
    if (synthRef.current) {
      synthRef.current.updateParams(synthParams);
    }
  }, [synthParams]);

  // Update master volume
  useEffect(() => {
    if (synthRef.current) {
      synthRef.current.setVolume(masterVolume);
    }
  }, [masterVolume]);

  // Handle parameter changes from controls
  const handleParamChange = useCallback((param, value) => {
    setSynthParams(prev => ({
      ...prev,
      [param]: value
    }));
  }, []);

  // Handle note events from piano
  const handleNoteClick = useCallback((note, type) => {
    if (!synthRef.current || !audioContextRef.current) return;

    if (type === 'down') {
      synthRef.current.playNote(note, 100, audioContextRef.current.currentTime);
      setActiveNotes(prev => [...prev, note]);
    } else if (type === 'up') {
      synthRef.current.stopNote(note, audioContextRef.current.currentTime);
      setActiveNotes(prev => prev.filter(n => n !== note));
    }
  }, []);

  // Handle preset selection
  const handlePresetSelect = useCallback((preset) => {
    setSynthParams(preset.params);
    setCurrentPreset(preset.name);
    setShowPresetModal(false);
  }, []);

  // Handle preset save
  const handlePresetSave = useCallback((name) => {
    // This will be handled by PresetManager
    const preset = {
      name,
      params: synthParams,
      timestamp: Date.now()
    };
    // Save to localStorage or backend
    const existingPresets = JSON.parse(localStorage.getItem('instrumentPresets') || '[]');
    existingPresets.push(preset);
    localStorage.setItem('instrumentPresets', JSON.stringify(existingPresets));
    return preset;
  }, [synthParams]);

  return (
    <Container fluid className="instrument-sandbox p-0">
      {/* Header Controls */}
      <Card className="mb-3 border-0 shadow-sm" style={{ backgroundColor: '#1a1a1a' }}>
        <Card.Body className="py-2">
          <Row className="align-items-center">
            <Col xs="auto">
              <div className="d-flex align-items-center gap-2">
                <GiSoundWaves size={24} className="text-primary" />
                <h5 className="mb-0 text-light">Virtual Instrument Designer</h5>
              </div>
            </Col>
            <Col xs="auto" className="ms-auto">
              <ButtonGroup size="sm">
                <Button
                  variant={isPlaying ? 'danger' : 'success'}
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? <FaStop /> : <FaPlay />}
                  {isPlaying ? ' Stop' : ' Test'}
                </Button>
                <Button
                  variant="outline-primary"
                  onClick={() => setShowPresetModal(true)}
                >
                  <FaFolder /> Presets
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={() => {
                    const name = prompt('Enter preset name:');
                    if (name) handlePresetSave(name);
                  }}
                >
                  <FaSave /> Save
                </Button>
              </ButtonGroup>
            </Col>
            <Col xs="auto">
              <div className="d-flex align-items-center gap-2">
                <FaVolumeUp className="text-muted" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={masterVolume * 100}
                  onChange={(e) => setMasterVolume(e.target.value / 100)}
                  style={{ width: '100px' }}
                  className="form-range"
                />
                <Badge bg="dark">{Math.round(masterVolume * 100)}%</Badge>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Main Content */}
      <Row className="g-3">
        {/* Synth Controls */}
        <Col lg={8}>
          <Card className="h-100 border-0 shadow" style={{ backgroundColor: '#2a2a2a' }}>
            <Card.Body>
              <SynthControls
                params={synthParams}
                onParamChange={handleParamChange}
              />
            </Card.Body>
          </Card>
        </Col>

        {/* Visual Feedback */}
        <Col lg={4}>
          <Card className="h-100 border-0 shadow" style={{ backgroundColor: '#2a2a2a' }}>
            <Card.Header className="bg-dark text-light border-0">
              <h6 className="mb-0">Waveform Visualizer</h6>
            </Card.Header>
            <Card.Body className="p-2" style={{ backgroundColor: '#1a1a1a' }}>
              <WaveformVisualizer
                analyserNode={analyserNode}
                isPlaying={isPlaying}
                activeNotes={activeNotes}
              />

              {/* Current Preset Display */}
              <div className="mt-3 p-3 rounded" style={{ backgroundColor: '#1a1a1a' }}>
                <small className="text-muted">Current Preset</small>
                <h6 className="text-light mb-0">{currentPreset}</h6>
              </div>

              {/* Active Notes Display */}
              <div className="mt-3 p-3 rounded" style={{ backgroundColor: '#1a1a1a' }}>
                <small className="text-muted">Active Notes</small>
                <div className="mt-2">
                  {activeNotes.length > 0 ? (
                    activeNotes.map(note => (
                      <Badge key={note} bg="primary" className="me-1">
                        {note}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted small">No active notes</span>
                  )}
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Piano Keyboard */}
      <Card className="mt-3 border-0 shadow" style={{ backgroundColor: '#2a2a2a' }}>
        <Card.Header className="bg-dark text-light border-0">
          <h6 className="mb-0">Virtual Keyboard</h6>
        </Card.Header>
        <Card.Body className="d-flex justify-content-center" style={{ backgroundColor: '#1a1a1a' }}>
          <PianoKeyboard
            startNote={36} // C2
            endNote={84}   // C6
            activeNotes={activeNotes}
            onNoteClick={handleNoteClick}
            width={900}
            height={150}
            showNoteNames={true}
            captureComputerKeyboard={true}
          />
        </Card.Body>
        <Card.Footer className="bg-dark text-muted small border-0">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>Keyboard Controls:</strong> Z-M (white keys), S/D/G/H/J (black keys) | Q-I (upper octave) | [ ] (shift octave)
            </div>
            <div>
              Press and hold keys to sustain notes
            </div>
          </div>
        </Card.Footer>
      </Card>

      {/* Preset Manager Modal */}
      {showPresetModal && (
        <PresetManager
          show={showPresetModal}
          onHide={() => setShowPresetModal(false)}
          onSelect={handlePresetSelect}
          currentPreset={currentPreset}
        />
      )}

      {/* Inline styles for dark theme */}
      <style jsx>{`
        .instrument-sandbox {
          min-height: 600px;
        }

        .form-range {
          accent-color: #0d6efd;
        }
      `}</style>
    </Container>
  );
};

export default InstrumentSandbox;