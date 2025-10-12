'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Card, Row, Col, Button, ListGroup, Badge, Form } from 'react-bootstrap';
import { FaSave, FaTrash, FaCheck, FaFolder, FaMagic, FaGuitar, FaKeyboard, FaWater, FaBell, FaMusic, FaWaveSquare, FaDrum, FaMicrophone } from 'react-icons/fa';
import { GiSoundWaves, GiPianoKeys } from 'react-icons/gi';
import { MdGraphicEq } from 'react-icons/md';
import { IoMusicalNotes } from 'react-icons/io5';

const PresetManager = ({ show, onHide, onSelect, currentPreset }) => {
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);

  // Default factory presets
  const factoryPresets = [
    {
      name: 'Default Saw',
      params: {
        oscillatorType: 'sawtooth',
        filterCutoff: 8000,
        filterResonance: 2,
        filterType: 'lowpass',
        attack: 0.01,
        decay: 0.1,
        sustain: 0.7,
        release: 0.3,
        detune: 0,
        lfoRate: 4,
        lfoAmount: 0,
        reverb: 0,
        delay: 0,
        distortion: 0,
        osc2Enabled: false,
        osc2Type: 'sawtooth',
        osc2Detune: 7,
        osc2Pitch: 0,
        oscMix: 50,
        subOscEnabled: false,
        subOscType: 'square',
        subOscLevel: 50,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        noiseType: 'white',
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0
      },
      factory: true
    },
    {
      name: 'Deep Bass',
      params: {
        oscillatorType: 'sine',
        filterCutoff: 400,
        filterResonance: 15,
        filterType: 'lowpass',
        attack: 0.01,
        decay: 0.2,
        sustain: 0.8,
        release: 0.2,
        detune: -5,
        lfoRate: 0.5,
        lfoAmount: 10,
        reverb: 10,
        delay: 0,
        distortion: 20,
        osc2Enabled: false,
        subOscEnabled: true,
        subOscType: 'square',
        subOscLevel: 60,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0
      },
      factory: true
    },
    {
      name: 'Dual Saw Lead',
      params: {
        oscillatorType: 'sawtooth',
        filterCutoff: 3500,
        filterResonance: 10,
        filterType: 'lowpass',
        attack: 0.005,
        decay: 0.05,
        sustain: 0.6,
        release: 0.5,
        detune: 0,
        lfoRate: 5,
        lfoAmount: 5,
        reverb: 20,
        delay: 30,
        distortion: 10,
        osc2Enabled: true,
        osc2Type: 'sawtooth',
        osc2Detune: 7,
        osc2Pitch: 0,
        oscMix: 45,
        subOscEnabled: false,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0
      },
      factory: true
    },
    {
      name: 'Ambient Pad',
      params: {
        oscillatorType: 'triangle',
        filterCutoff: 1200,
        filterResonance: 2,
        filterType: 'lowpass',
        attack: 1.5,
        decay: 0.5,
        sustain: 0.7,
        release: 2.0,
        detune: 12,
        lfoRate: 0.2,
        lfoAmount: 15,
        reverb: 60,
        delay: 40,
        distortion: 0,
        osc2Enabled: true,
        osc2Type: 'sine',
        osc2Pitch: 12,
        osc2Detune: 2,
        oscMix: 30,
        subOscEnabled: false,
        noiseLevel: 5,
        noiseType: 'pink',
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0
      },
      factory: true
    },
    {
      name: 'Funky Bass',
      params: {
        oscillatorType: 'square',
        filterCutoff: 800,
        filterResonance: 20,
        filterType: 'lowpass',
        attack: 0.001,
        decay: 0.3,
        sustain: 0.2,
        release: 0.1,
        detune: 2,
        lfoRate: 8,
        lfoAmount: 30,
        reverb: 15,
        delay: 10,
        distortion: 5,
        osc2Enabled: false,
        subOscEnabled: true,
        subOscType: 'sine',
        subOscLevel: 70,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0
      },
      factory: true
    },
    {
      name: 'Noise Sweep',
      params: {
        oscillatorType: 'sawtooth',
        filterCutoff: 2000,
        filterResonance: 15,
        filterType: 'bandpass',
        attack: 0.5,
        decay: 0.3,
        sustain: 0.5,
        release: 1.0,
        detune: 0,
        lfoRate: 2,
        lfoAmount: 40,
        reverb: 40,
        delay: 20,
        distortion: 0,
        osc2Enabled: false,
        subOscEnabled: false,
        noiseLevel: 50,
        noiseType: 'white',
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0
      },
      factory: true
    },
    {
      name: 'Super Saw',
      params: {
        oscillatorType: 'sawtooth',
        filterCutoff: 5000,
        filterResonance: 5,
        filterType: 'lowpass',
        attack: 0.01,
        decay: 0.1,
        sustain: 0.8,
        release: 0.3,
        detune: 10,
        lfoRate: 4,
        lfoAmount: 0,
        reverb: 25,
        delay: 15,
        distortion: 0,
        osc2Enabled: true,
        osc2Type: 'sawtooth',
        osc2Detune: -10,
        osc2Pitch: 0,
        oscMix: 50,
        subOscEnabled: false,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0
      },
      factory: true
    },
    {
      name: 'Hi-Pass Pluck',
      params: {
        oscillatorType: 'square',
        filterCutoff: 4000,
        filterResonance: 8,
        filterType: 'highpass',
        attack: 0.001,
        decay: 0.2,
        sustain: 0.1,
        release: 0.5,
        detune: 0,
        lfoRate: 6,
        lfoAmount: 10,
        reverb: 30,
        delay: 20,
        distortion: 0,
        osc2Enabled: true,
        osc2Type: 'triangle',
        osc2Pitch: -12,
        osc2Detune: 3,
        oscMix: 35,
        subOscEnabled: false,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0
      },
      factory: true
    },
    {
      name: 'Filter Sweep',
      params: {
        oscillatorType: 'sawtooth',
        filterCutoff: 500,
        filterResonance: 12,
        filterType: 'lowpass',
        attack: 0.01,
        decay: 0.3,
        sustain: 0.6,
        release: 0.5,
        detune: 5,
        lfoRate: 3,
        lfoAmount: 10,
        reverb: 35,
        delay: 25,
        distortion: 0,
        osc2Enabled: true,
        osc2Type: 'sawtooth',
        osc2Detune: -5,
        osc2Pitch: 0,
        oscMix: 50,
        subOscEnabled: false,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        // Filter envelope
        filterEnvAmount: 80,
        filterAttack: 0.02,
        filterDecay: 0.5,
        filterSustain: 0.3,
        filterRelease: 0.8,
        // No PWM for sawtooth
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        // LFO2 modulating filter
        lfo2Target: 'filter',
        lfo2Rate: 0.5,
        lfo2Amount: 30
      },
      factory: true
    },
    {
      name: 'PWM Pad',
      params: {
        oscillatorType: 'square',
        filterCutoff: 2000,
        filterResonance: 5,
        filterType: 'lowpass',
        attack: 0.8,
        decay: 0.2,
        sustain: 0.8,
        release: 1.5,
        detune: 0,
        lfoRate: 4,
        lfoAmount: 0,
        reverb: 50,
        delay: 35,
        distortion: 0,
        osc2Enabled: false,
        subOscEnabled: false,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        // Filter envelope
        filterEnvAmount: -50,
        filterAttack: 1.0,
        filterDecay: 0.5,
        filterSustain: 0.6,
        filterRelease: 2.0,
        // PWM settings
        pulseWidth: 50,
        pwmAmount: 70,
        pwmRate: 0.3,
        // No LFO2
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0
      },
      factory: true
    },
    {
      name: 'Tremolo Lead',
      params: {
        oscillatorType: 'square',
        filterCutoff: 4000,
        filterResonance: 8,
        filterType: 'lowpass',
        attack: 0.001,
        decay: 0.05,
        sustain: 0.8,
        release: 0.2,
        detune: 2,
        lfoRate: 5,
        lfoAmount: 8,
        reverb: 20,
        delay: 15,
        distortion: 10,
        osc2Enabled: true,
        osc2Type: 'triangle',
        osc2Detune: 1,
        osc2Pitch: 12,
        oscMix: 30,
        subOscEnabled: false,
        noiseLevel: 0,
        filterEnvAmount: 0,
        filterAttack: 0.01,
        filterDecay: 0.2,
        filterSustain: 0.5,
        filterRelease: 0.3,
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        lfo2Target: 'off',
        lfo2Rate: 2,
        lfo2Amount: 0,
        // Filter envelope
        filterEnvAmount: 40,
        filterAttack: 0.001,
        filterDecay: 0.1,
        filterSustain: 0.5,
        filterRelease: 0.2,
        // No PWM
        pulseWidth: 50,
        pwmAmount: 0,
        pwmRate: 4,
        // LFO2 modulating amplitude
        lfo2Target: 'amp',
        lfo2Rate: 6,
        lfo2Amount: 40
      },
      factory: true
    }
  ];

  // Load presets from localStorage
  useEffect(() => {
    const loadedPresets = JSON.parse(localStorage.getItem('instrumentPresets') || '[]');
    setPresets([...factoryPresets, ...loadedPresets]);
  }, []);

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset);
  };

  const handleApplyPreset = () => {
    if (selectedPreset) {
      onSelect(selectedPreset);
    }
  };

  const handleDeletePreset = (presetToDelete, e) => {
    e.stopPropagation();
    if (presetToDelete.factory) {
      alert('Cannot delete factory presets');
      return;
    }

    if (confirm(`Are you sure you want to delete "${presetToDelete.name}"?`)) {
      const updatedPresets = presets.filter(p => p !== presetToDelete);
      const userPresets = updatedPresets.filter(p => !p.factory);
      localStorage.setItem('instrumentPresets', JSON.stringify(userPresets));
      setPresets(updatedPresets);

      if (selectedPreset === presetToDelete) {
        setSelectedPreset(null);
      }
    }
  };

  const getCategoryIcon = (preset) => {
    const name = preset.name.toLowerCase();

    // Bass presets - deep purple
    if (name.includes('bass')) return <FaGuitar size={20} style={{ color: '#9b59b6' }} />;
    if (name.includes('funky')) return <FaGuitar size={20} style={{ color: '#8e44ad' }} />;

    // Lead presets - bright blue
    if (name.includes('lead')) return <FaKeyboard size={20} style={{ color: '#3498db' }} />;
    if (name.includes('dual')) return <IoMusicalNotes size={20} style={{ color: '#2980b9' }} />;

    // Pad presets - teal
    if (name.includes('pad')) return <FaWater size={20} style={{ color: '#1abc9c' }} />;
    if (name.includes('ambient')) return <FaWater size={20} style={{ color: '#16a085' }} />;
    if (name.includes('pwm')) return <IoMusicalNotes size={20} style={{ color: '#1abc9c' }} />;

    // Bell/Pluck presets - gold
    if (name.includes('bell')) return <FaBell size={20} style={{ color: '#f39c12' }} />;
    if (name.includes('pluck')) return <GiPianoKeys size={20} style={{ color: '#e67e22' }} />;

    // Effect-based presets - green
    if (name.includes('sweep')) return <MdGraphicEq size={20} style={{ color: '#27ae60' }} />;
    if (name.includes('filter')) return <MdGraphicEq size={20} style={{ color: '#2ecc71' }} />;
    if (name.includes('tremolo')) return <FaMicrophone size={20} style={{ color: '#27ae60' }} />;

    // Noise/Texture presets - orange
    if (name.includes('noise')) return <GiSoundWaves size={20} style={{ color: '#e74c3c' }} />;

    // Saw presets - pink
    if (name.includes('saw')) return <FaWaveSquare size={20} style={{ color: '#e91e63' }} />;
    if (name.includes('super')) return <FaDrum size={20} style={{ color: '#c2185b' }} />;

    // Warm/Pure presets - warm orange
    if (name.includes('warm') || name.includes('triangle')) return <GiSoundWaves size={20} style={{ color: '#ff9800' }} />;
    if (name.includes('pure') || name.includes('sine')) return <FaMusic size={20} style={{ color: '#ff5722' }} />;

    // Default preset - gray-blue
    if (name.includes('default')) return <FaWaveSquare size={20} style={{ color: '#607d8b' }} />;

    // Fallback - primary blue
    return <FaMusic size={20} style={{ color: '#0d6efd' }} />;
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="bg-dark text-light border-secondary">
        <Modal.Title className="d-flex align-items-center gap-2">
          <FaFolder /> Preset Manager
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="bg-dark">
        <Row>
          {/* Preset List */}
          <Col md={8}>
            <Card className="bg-secondary border-0">
              <Card.Header className="bg-dark text-light border-secondary">
                <div className="d-flex justify-content-between align-items-center">
                  <span>Available Presets</span>
                  <Badge bg="primary">{presets.length} presets</Badge>
                </div>
              </Card.Header>
              <Card.Body className="p-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <ListGroup variant="flush">
                  {presets.map((preset, index) => (
                    <ListGroup.Item
                      key={index}
                      className={`bg-dark text-light border-secondary ${selectedPreset === preset ? 'border border-primary' : ''}`}
                      action
                      onClick={() => handleSelectPreset(preset)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-2">
                          <div className="d-flex align-items-center justify-content-center" style={{ width: '24px' }}>
                            {getCategoryIcon(preset)}
                          </div>
                          <div>
                            <div className="fw-bold">{preset.name}</div>
                            <div className="small text-muted">
                              {preset.factory ? (
                                <Badge bg="info" size="sm">Factory</Badge>
                              ) : (
                                <Badge bg="success" size="sm">Custom</Badge>
                              )}
                              {currentPreset === preset.name && (
                                <Badge bg="warning" className="ms-2" size="sm">
                                  <FaCheck /> Current
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        {!preset.factory && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={(e) => handleDeletePreset(preset, e)}
                          >
                            <FaTrash />
                          </Button>
                        )}
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </Card.Body>
            </Card>
          </Col>

          {/* Preset Details */}
          <Col md={4}>
            <Card className="bg-secondary border-0">
              <Card.Header className="bg-dark text-light border-secondary">
                <span>Preset Details</span>
              </Card.Header>
              <Card.Body className="text-light">
                {selectedPreset ? (
                  <div>
                    <h6 className="mb-3">{selectedPreset.name}</h6>
                    <div className="small">
                      <div className="mb-2">
                        <strong>Oscillator:</strong> {selectedPreset.params.oscillatorType}
                      </div>
                      <div className="mb-2">
                        <strong>Filter:</strong> {selectedPreset.params.filterCutoff}Hz
                      </div>
                      <div className="mb-2">
                        <strong>Envelope:</strong> A:{selectedPreset.params.attack}s D:{selectedPreset.params.decay}s
                      </div>
                      <div className="mb-2">
                        <strong>Effects:</strong>
                        <div className="ms-2">
                          Reverb: {selectedPreset.params.reverb}%<br />
                          Delay: {selectedPreset.params.delay}%<br />
                          Distortion: {selectedPreset.params.distortion}%
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted py-5">
                    <FaMagic size={48} className="mb-3" />
                    <p>Select a preset to view details</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Modal.Body>

      <Modal.Footer className="bg-dark border-secondary">
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleApplyPreset}
          disabled={!selectedPreset}
        >
          Apply Preset
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PresetManager;