'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Card, Row, Col, Button, ListGroup, Badge, Form } from 'react-bootstrap';
import { FaSave, FaTrash, FaCheck, FaFolder, FaMagic } from 'react-icons/fa';

const PresetManager = ({ show, onHide, onSelect, currentPreset }) => {
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);

  // Default factory presets
  const factoryPresets = [
    {
      name: 'Default Saw',
      params: {
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
      },
      factory: true
    },
    {
      name: 'Deep Bass',
      params: {
        oscillatorType: 'sine',
        filterCutoff: 400,
        filterResonance: 15,
        attack: 0.01,
        decay: 0.2,
        sustain: 0.8,
        release: 0.2,
        detune: -5,
        lfoRate: 0.5,
        lfoAmount: 10,
        reverb: 10,
        delay: 0,
        distortion: 20
      },
      factory: true
    },
    {
      name: 'Bright Lead',
      params: {
        oscillatorType: 'square',
        filterCutoff: 3500,
        filterResonance: 10,
        attack: 0.005,
        decay: 0.05,
        sustain: 0.6,
        release: 0.5,
        detune: 7,
        lfoRate: 5,
        lfoAmount: 5,
        reverb: 20,
        delay: 30,
        distortion: 10
      },
      factory: true
    },
    {
      name: 'Ambient Pad',
      params: {
        oscillatorType: 'triangle',
        filterCutoff: 1200,
        filterResonance: 2,
        attack: 1.5,
        decay: 0.5,
        sustain: 0.7,
        release: 2.0,
        detune: 12,
        lfoRate: 0.2,
        lfoAmount: 15,
        reverb: 60,
        delay: 40,
        distortion: 0
      },
      factory: true
    },
    {
      name: 'Funky Pluck',
      params: {
        oscillatorType: 'sawtooth',
        filterCutoff: 800,
        filterResonance: 20,
        attack: 0.001,
        decay: 0.3,
        sustain: 0.2,
        release: 0.1,
        detune: 2,
        lfoRate: 8,
        lfoAmount: 30,
        reverb: 15,
        delay: 10,
        distortion: 5
      },
      factory: true
    },
    {
      name: 'Ethereal Bell',
      params: {
        oscillatorType: 'sine',
        filterCutoff: 5000,
        filterResonance: 5,
        attack: 0.001,
        decay: 1.0,
        sustain: 0.3,
        release: 1.5,
        detune: 0,
        lfoRate: 6,
        lfoAmount: 3,
        reverb: 50,
        delay: 25,
        distortion: 0
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
    if (name.includes('bass')) return '🎸';
    if (name.includes('lead')) return '🎹';
    if (name.includes('pad')) return '🌊';
    if (name.includes('bell')) return '🔔';
    if (name.includes('pluck')) return '🎵';
    return '🎼';
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
                          <span style={{ fontSize: '1.2em' }}>{getCategoryIcon(preset)}</span>
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